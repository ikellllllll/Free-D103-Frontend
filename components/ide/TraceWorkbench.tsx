"use client";

import { useRef, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { mockApi } from "@/lib/api/mockApi";
import type { AgentRunTrace, AgentSpan } from "@/lib/types/trace";

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  COMPLETED: "trace-dot--ok", FAILED: "trace-dot--err",
  RUNNING: "trace-dot--run", PENDING: "trace-dot--idle", CANCELLED: "trace-dot--idle"
};
const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "완료", FAILED: "실패", RUNNING: "실행 중", PENDING: "대기", CANCELLED: "취소"
};
const STATUS_BADGE: Record<string, string> = {
  COMPLETED: "twb-badge twb-badge--ok", FAILED: "twb-badge twb-badge--err",
  RUNNING: "twb-badge twb-badge--run", PENDING: "twb-badge twb-badge--idle", CANCELLED: "twb-badge twb-badge--idle"
};

function fmtDuration(ms: number | null) {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
function fmtTokens(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`; }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getDate().toString().padStart(2, "0")} ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

// ─── Tooltip (position:fixed to escape overflow:hidden ancestors) ─────────────

function Tooltip({ text }: { text: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ x: r.left, y: r.bottom + 6 });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="twb-tooltip-icon"
        onMouseEnter={show}
        onMouseLeave={() => setCoords(null)}
      >
        ?
      </button>
      {coords && (
        <div
          className="twb-tooltip-bubble"
          style={{ position: "fixed", left: coords.x, top: coords.y }}
        >
          {text}
        </div>
      )}
    </>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, count, accent = "default", defaultOpen = true, children, empty
}: {
  icon: string; title: string; count?: number;
  accent?: "blue" | "green" | "amber" | "violet" | "default";
  defaultOpen?: boolean; children: React.ReactNode; empty?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`twb-section twb-section--${accent}`}>
      <button type="button" className="twb-section__head" onClick={() => setOpen(v => !v)}>
        <span className="twb-section__icon">{icon}</span>
        <span className="twb-section__title">{title}</span>
        {count !== undefined && <span className="twb-section__count">{count}</span>}
        <span className="twb-section__arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="twb-section__body">
          {empty ? <div className="twb-section__empty">{empty}</div> : children}
        </div>
      )}
    </div>
  );
}

// ─── JsonTable ────────────────────────────────────────────────────────────────

function flattenJson(obj: Record<string, unknown>, prefix = ""): Array<{ path: string; value: string; type: string }> {
  const rows: Array<{ path: string; value: string; type: string }> = [];
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      rows.push(...flattenJson(val as Record<string, unknown>, path));
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        if (typeof item === "object" && item !== null) {
          rows.push(...flattenJson(item as Record<string, unknown>, `${path}[${idx}]`));
        } else {
          rows.push({ path: `${path}[${idx}]`, value: String(item), type: typeof item });
        }
      });
    } else {
      rows.push({ path, value: val === null ? "null" : String(val), type: val === null ? "null" : typeof val });
    }
  }
  return rows;
}

function JsonTable({ data }: { data: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rows = useMemo(() => (data ? flattenJson(data) : []), [data]);
  if (!data || Object.keys(data).length === 0) return null;
  const toggle = (p: string) => setExpanded(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  return (
    <table className="twb-io-table">
      <thead><tr><th style={{ width: "38%" }}>Key</th><th>Value</th></tr></thead>
      <tbody>
        {rows.map(row => {
          const isLong = row.value.length > 80;
          const isExp = expanded.has(row.path);
          return (
            <tr key={row.path}>
              <td className="twb-io-path">{row.path}</td>
              <td className={`twb-io-val--${row.type}`}>
                {isLong && !isExp
                  ? <>{row.value.slice(0, 80)}… <button type="button" className="twb-expand-btn" onClick={() => toggle(row.path)}>펼치기</button></>
                  : <>{row.value}{isLong && <button type="button" className="twb-expand-btn" onClick={() => toggle(row.path)}> 접기</button>}</>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── LogTimeline ──────────────────────────────────────────────────────────────

interface LogEntry { offsetMs: number; kind: "llm" | "tool" | "patch" | "span"; label: string; detail: string; status?: string; }

function buildLogEntries(span: AgentSpan): LogEntry[] {
  const entries: LogEntry[] = [];
  entries.push({ offsetMs: 0, kind: "span", label: `[span] ${span.spanName} 시작`, detail: fmtTime(span.startedAt), status: "START" });
  let llmOff = 200;
  span.llmCalls.forEach(llm => {
    entries.push({ offsetMs: llmOff, kind: "llm", label: `[llm] ${llm.modelName}`, detail: `${fmtTokens(llm.inputTokens)} → ${fmtTokens(llm.outputTokens)} tok · ${fmtDuration(llm.latencyMs)}`, status: llm.status });
    llmOff += (llm.latencyMs ?? 1000) + 100;
  });
  let toolOff = 100;
  span.toolCalls.forEach(tc => {
    entries.push({ offsetMs: toolOff, kind: "tool", label: `[tool] ${tc.toolName}`, detail: tc.argsJson ? Object.entries(tc.argsJson).map(([k, v]) => `${k}: ${v}`).join(" · ") : "-", status: tc.status });
    toolOff += (tc.durationMs ?? 200) + 50;
  });
  span.patches.forEach((p, i) => {
    entries.push({ offsetMs: (span.durationMs ?? 5000) - 300 + i * 50, kind: "patch", label: `[patch] ${p.filePath.split("/").pop()}`, detail: `+${p.additions} -${p.deletions} · ${p.filePath}`, status: "APPLIED" });
  });
  if (span.endedAt) entries.push({ offsetMs: span.durationMs ?? 0, kind: "span", label: `[span] ${span.spanName} 종료`, detail: `${STATUS_LABEL[span.status]} · ${fmtDuration(span.durationMs)}`, status: span.status });
  entries.sort((a, b) => a.offsetMs - b.offsetMs);
  return entries;
}

const LOG_ICON: Record<string, string>  = { llm: "🤖", tool: "🔧", patch: "📄", span: "⏱" };
const LOG_CLASS: Record<string, string> = { llm: "twb-log-row--llm", tool: "twb-log-row--tool", patch: "twb-log-row--patch", span: "twb-log-row--span" };

function LogTimeline({ span }: { span: AgentSpan }) {
  const entries = useMemo(() => buildLogEntries(span), [span]);
  return (
    <div className="twb-log-timeline">
      <div className="twb-log-header"><span>offset</span><span>event</span><span>detail</span></div>
      {entries.map((e, i) => (
        <div key={i} className={`twb-log-row ${LOG_CLASS[e.kind]}`}>
          <span className="twb-log-offset">+{fmtDuration(e.offsetMs)}</span>
          <span className="twb-log-label"><span className="twb-log-icon">{LOG_ICON[e.kind]}</span>{e.label}</span>
          <span className="twb-log-detail">{e.detail}</span>
          {e.status && (
            <span className={`twb-badge ${e.status === "COMPLETED" || e.status === "APPLIED" || e.status === "START" ? "twb-badge--ok" : e.status === "FAILED" ? "twb-badge--err" : "twb-badge--run"}`}>
              {e.status === "START" ? "▶" : e.status === "APPLIED" ? "✓" : e.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Col 3: Span Detail ───────────────────────────────────────────────────────

function SpanDetail({ span }: { span: AgentSpan }) {
  const [tab, setTab] = useState<"preview" | "log">("preview");
  const totalIn  = span.llmCalls.reduce((a, c) => a + c.inputTokens, 0);
  const totalOut = span.llmCalls.reduce((a, c) => a + c.outputTokens, 0);
  const models   = [...new Set(span.llmCalls.map(c => c.modelName))];

  return (
    <div className="twb-detail">
      <div className="twb-detail__head">
        <span className={`trace-dot ${STATUS_DOT[span.status] ?? "trace-dot--idle"}`} />
        <strong className="twb-detail__name">{span.spanName}</strong>
        <span className={STATUS_BADGE[span.status] ?? "twb-badge twb-badge--idle"}>{STATUS_LABEL[span.status]}</span>
        <span className="twb-detail__seq">#{span.sequenceNo}</span>
      </div>

      <div className="twb-chips">
        <span className="twb-chip"><span className="twb-chip__label">Latency</span><span className="twb-chip__val">{fmtDuration(span.durationMs)}</span></span>
        {span.startedAt && <span className="twb-chip"><span className="twb-chip__label">Started</span><span className="twb-chip__val">{fmtTime(span.startedAt)}</span></span>}
        {span.llmCalls.length > 0 && <span className="twb-chip"><span className="twb-chip__label">Tokens</span><span className="twb-chip__val">{fmtTokens(totalIn)} → {fmtTokens(totalOut)}</span></span>}
        {models.length > 0 && <span className="twb-chip"><span className="twb-chip__label">Model</span><span className="twb-chip__val">{models[0]}</span></span>}
        {span.toolCalls.length > 0 && <span className="twb-chip"><span className="twb-chip__label">Tools</span><span className="twb-chip__val">{span.toolCalls.length}회</span></span>}
        {span.patches.length > 0 && <span className="twb-chip"><span className="twb-chip__label">Patches</span><span className="twb-chip__val">{span.patches.length}개</span></span>}
      </div>

      <div className="twb-tabs">
        {(["preview", "log"] as const).map(t => (
          <button key={t} type="button" className={tab === t ? "twb-tab twb-tab--active" : "twb-tab"} onClick={() => setTab(t)}>
            {t === "preview" ? "Preview" : "Log View"}
          </button>
        ))}
      </div>

      {tab === "preview" ? (
        <div className="twb-detail__body twb-detail__body--preview">
          <SectionCard icon="📥" title="Input" accent="blue" count={span.inputJson ? flattenJson(span.inputJson).length : 0} empty={!span.inputJson ? "Input 데이터 없음" : undefined}>
            <JsonTable data={span.inputJson} />
          </SectionCard>
          <SectionCard icon="📤" title="Output" accent="green" count={span.outputJson ? flattenJson(span.outputJson).length : 0} empty={!span.outputJson ? "Output 데이터 없음" : undefined}>
            <JsonTable data={span.outputJson} />
          </SectionCard>
          {span.toolCalls.length > 0 && (
            <SectionCard icon="🔧" title="Tool Calls" accent="amber" count={span.toolCalls.length}>
              <table className="twb-io-table">
                <thead><tr><th>Tool</th><th>인자</th><th>Status</th><th>Duration</th></tr></thead>
                <tbody>
                  {span.toolCalls.map(tc => (
                    <tr key={tc.toolCallId} className={tc.status === "FAILED" ? "twb-io-row--fail" : ""}>
                      <td className="twb-io-path">{tc.toolName}</td>
                      <td className="twb-io-val">{tc.argsJson ? Object.entries(tc.argsJson).map(([k, v]) => `${k}: ${v}`).join(" · ") : "-"}</td>
                      <td><span className={tc.status === "FAILED" ? "twb-badge twb-badge--err" : "twb-badge twb-badge--ok"}>{tc.status === "COMPLETED" ? "✓" : tc.status === "FAILED" ? "✗" : tc.status}</span></td>
                      <td className="twb-io-val--number">{fmtDuration(tc.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}
          {span.llmCalls.length > 0 && (
            <SectionCard icon="🤖" title="LLM Calls" accent="violet" count={span.llmCalls.length}>
              <table className="twb-io-table">
                <thead><tr><th>Model</th><th>Input</th><th>Output</th><th>Latency</th><th>Finish</th></tr></thead>
                <tbody>
                  {span.llmCalls.map(llm => (
                    <tr key={llm.llmCallId}>
                      <td className="twb-io-path">{llm.modelName}</td>
                      <td className="twb-io-val--number">{fmtTokens(llm.inputTokens)} tok</td>
                      <td className="twb-io-val--number">{fmtTokens(llm.outputTokens)} tok</td>
                      <td className="twb-io-val--number">{fmtDuration(llm.latencyMs)}</td>
                      <td><span className="twb-finish-reason">{llm.finishReason ?? "-"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}
          {span.patches.length > 0 && (
            <SectionCard icon="📄" title="File Patches" accent="default" count={span.patches.length}>
              <table className="twb-io-table">
                <thead><tr><th>File</th><th>추가</th><th>삭제</th></tr></thead>
                <tbody>
                  {span.patches.map(p => (
                    <tr key={p.patchId}>
                      <td className="twb-io-path">{p.filePath}</td>
                      <td className="twb-diff--add">+{p.additions}</td>
                      <td className="twb-diff--del">-{p.deletions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}
        </div>
      ) : (
        <div className="twb-detail__body twb-detail__body--log">
          <LogTimeline span={span} />
        </div>
      )}
    </div>
  );
}

// ─── Col 2: Span List ─────────────────────────────────────────────────────────

function SpanList({ run, selectedSpanId, onSelect }: {
  run: AgentRunTrace | null; selectedSpanId: string | null; onSelect: (s: AgentSpan) => void;
}) {
  if (!run) {
    return (
      <div className="twb-col twb-col--spans">
        <div className="twb-col-head">
          <span className="twb-col-head__title">Spans</span>
          <Tooltip text="선택된 Trace 안에서 에이전트가 실행한 단계 목록입니다. 각 Span은 분석 · 수정 · 검증 등 하나의 작업 단위를 나타냅니다." />
        </div>
        <div className="twb-col-divider" />
        <div className="twb-empty twb-empty--center twb-empty--sm">
          <span>왼쪽에서 Trace를</span>
          <span>선택하세요</span>
        </div>
      </div>
    );
  }

  const sortedSpans = [...run.spans].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const totalTokens = run.totalInputTokens + run.totalOutputTokens;

  return (
    <div className="twb-col twb-col--spans">
      <div className="twb-col-head">
        <span className="twb-col-head__title">Spans</span>
        <Tooltip text="선택된 Trace 안에서 에이전트가 실행한 단계 목록입니다. 각 Span은 분석 · 수정 · 검증 등 하나의 작업 단위를 나타냅니다." />
      </div>
      <div className="twb-col-divider" />

      {/* run summary */}
      <div className="twb-run-card">
        <div className="twb-run-card__row">
          <span className={`trace-dot ${STATUS_DOT[run.status]}`} />
          <span className={STATUS_BADGE[run.status]}>{STATUS_LABEL[run.status]}</span>
          <span className="twb-run-card__dur">{fmtDuration(run.durationMs)}</span>
        </div>
        <div className="twb-run-card__meta">
          <span>{fmtTokens(totalTokens)} tok</span>
          <span>·</span>
          <span>{run.totalCostCredits} cr</span>
          <span>·</span>
          <span>{sortedSpans.length}개 span</span>
        </div>
        {run.summaryText && <p className="twb-run-card__summary">{run.summaryText}</p>}
        {run.errorMessage && <p className="twb-run-card__error">{run.errorMessage}</p>}
      </div>

      <div className="twb-col-divider--strong" />
      <div className="twb-col-section-label">SPAN 목록</div>

      {sortedSpans.map(span => {
        const childCount = span.toolCalls.length + span.llmCalls.length + span.patches.length;
        const isSelected = selectedSpanId === span.spanId;
        return (
          <button key={span.spanId} type="button"
            className={`twb-span-row${isSelected ? " twb-span-row--active" : ""}${span.status === "FAILED" ? " twb-span-row--fail" : ""}`}
            onClick={() => onSelect(span)}
          >
            <span className={`trace-dot ${STATUS_DOT[span.status] ?? "trace-dot--idle"}`} />
            <span className="twb-span-row__name">{span.spanName}</span>
            <span className="twb-span-row__meta">
              {childCount > 0 && <span className="twb-span-row__count">{childCount}</span>}
              <span className="twb-span-row__dur">{fmtDuration(span.durationMs)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Col 1: Trace List ────────────────────────────────────────────────────────

function TraceList({ runs, selectedId, isLoading, onSelect }: {
  runs: AgentRunTrace[]; selectedId: string | null; isLoading: boolean; onSelect: (r: AgentRunTrace) => void;
}) {
  return (
    <div className="twb-col twb-col--runs">
      <div className="twb-col-head">
        <span className="twb-col-head__title">Trace 목록</span>
        <Tooltip text="에이전트 모드로 실행한 기록입니다. 각 Trace는 한 번의 에이전트 실행을 나타내며, 성공/실패 여부와 소요 시간을 확인할 수 있습니다." />
      </div>
      <div className="twb-col-divider--strong" />

      {isLoading ? (
        <div className="twb-empty">불러오는 중...</div>
      ) : runs.length === 0 ? (
        <div className="twb-empty twb-empty--center twb-empty--sm">
          <span>실행 기록 없음</span>
        </div>
      ) : (
        runs.map(run => {
          const isSelected = selectedId === run.agentTraceId;
          const totalTokens = run.totalInputTokens + run.totalOutputTokens;
          return (
            <button key={run.agentTraceId} type="button"
              className={`twb-run-row${isSelected ? " twb-run-row--active" : ""}${run.status === "FAILED" ? " twb-run-row--fail" : ""}`}
              onClick={() => onSelect(run)}
            >
              <div className="twb-run-row__top">
                <span className={`trace-dot ${STATUS_DOT[run.status]}`} />
                <span className={STATUS_BADGE[run.status]}>{STATUS_LABEL[run.status]}</span>
                <span className="twb-run-row__dur">{fmtDuration(run.durationMs)}</span>
              </div>
              <div className="twb-run-row__date">{fmtDate(run.startedAt)}</div>
              {run.summaryText && (
                <p className="twb-run-row__summary">{run.summaryText}</p>
              )}
              {run.status === "FAILED" && run.errorMessage && (
                <p className="twb-run-row__error">{run.errorMessage}</p>
              )}
              <div className="twb-run-row__meta">
                <span>{fmtTokens(totalTokens)} tok</span>
                <span>{run.spans.length} spans</span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

// ─── Col 3 placeholder ───────────────────────────────────────────────────────

function DetailPane({ span }: { span: AgentSpan | null }) {
  return (
    <div className="twb-col twb-col--detail">
      <div className="twb-col-head">
        <span className="twb-col-head__title">Span 상세</span>
        <Tooltip text="선택된 Span의 Input/Output 데이터, Tool 호출 내역, LLM 호출 정보, 파일 패치 내역을 확인할 수 있습니다. Log View에서 실행 타임라인을 볼 수 있습니다." />
      </div>
      <div className="twb-col-divider" />
      {span ? (
        <SpanDetail span={span} />
      ) : (
        <div className="twb-empty twb-empty--center twb-empty--sm">
          <span>Span을 선택하면</span>
          <span>상세 정보가 표시됩니다</span>
        </div>
      )}
    </div>
  );
}

// ─── TraceWorkbench ───────────────────────────────────────────────────────────

export function TraceWorkbench({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [selectedRun,  setSelectedRun]  = useState<AgentRunTrace | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<AgentSpan | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["agentTraces", sessionId],
    queryFn:  () => mockApi.getAgentTraces(sessionId),
    staleTime: 30_000,
    refetchInterval: (query) => {
      // 완료/실패/취소된 Trace만 있으면 폴링 중단, 진행 중인 Trace가 있으면 5초 폴링
      const TERMINAL: string[] = ["COMPLETED", "FAILED", "CANCELLED"];
      const hasActive = (query.state.data ?? []).some((r) => !TERMINAL.includes(r.status));
      return hasActive ? 5000 : false;
    }
  });

  const handleSelectRun = (run: AgentRunTrace) => {
    setSelectedRun(run);
    setSelectedSpan(null); // 새 Trace 선택 시 Span 초기화
  };

  return (
    <div className="twb-shell">
      {/* title bar */}
      <div className="twb-titlebar">
        <span className="panel-title panel-title--compact">trace</span>
        <strong>에이전트 Trace</strong>
        {selectedRun && (
          <>
            <span className="twb-titlebar__sep">›</span>
            <span className="twb-titlebar__crumb">
              {STATUS_LABEL[selectedRun.status]} · {fmtDate(selectedRun.startedAt)}
            </span>
          </>
        )}
        {selectedRun && selectedSpan && (
          <>
            <span className="twb-titlebar__sep">›</span>
            <span className="twb-titlebar__crumb">{selectedSpan.spanName}</span>
          </>
        )}
        <button type="button" className="twb-close-btn" onClick={onClose} title="코드 화면으로 돌아가기">×</button>
      </div>

      {/* 3-column body */}
      <div className="twb-3col">
        <TraceList
          runs={runs}
          selectedId={selectedRun?.agentTraceId ?? null}
          isLoading={isLoading}
          onSelect={handleSelectRun}
        />
        <div className="twb-col-resizer" />
        <SpanList
          run={selectedRun}
          selectedSpanId={selectedSpan?.spanId ?? null}
          onSelect={setSelectedSpan}
        />
        <div className="twb-col-resizer" />
        <DetailPane span={selectedSpan} />
      </div>
    </div>
  );
}

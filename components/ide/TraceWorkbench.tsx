"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AgentRunTrace, AgentSpan } from "@/lib/types/trace";
import { useAgentUIState } from "@/hooks/useAgentUIState";
import { useIdeStore } from "@/store/ideStore";

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
const TRACE_PAGE_SIZE = 6;

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
function getSortedSpans(run: AgentRunTrace) {
  return [...run.spans].sort((a, b) => a.sequenceNo - b.sequenceNo);
}

// ─── Tooltip (position:fixed to escape overflow:hidden ancestors) ─────────────

function Tooltip({ text }: { text: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const show = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ x: r.left, y: r.bottom + 6 });
  };

  // bubble 을 document.body 에 portal 로 띄움 — 부모 .twb-drawer 의 transform 때문에
  // position:fixed 가 그 안에 갇혀서 안 보이거나 잘못된 위치로 가는 문제 회피.
  const bubble =
    coords && mounted
      ? createPortal(
          <div
            className="twb-tooltip-bubble"
            style={{ position: "fixed", left: coords.x, top: coords.y }}
          >
            {text}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="twb-tooltip-icon"
        aria-label="도움말"
        onMouseEnter={show}
        onMouseLeave={() => setCoords(null)}
        onFocus={show}
        onBlur={() => setCoords(null)}
      >
        ?
      </button>
      {bubble}
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

// ─── ToolCallRow ──────────────────────────────────────────────────────────────
// argsPreview / resultPreview 를 한 줄 미리보기로 보여주고, 클릭하면 detail row 펼침.
// argsPreview 안에는 보통 { inputs: {...}, metadata: {...}, tags: [...], identity: {...} } 가 있다.
// 가장 의미 있는 건 inputs — 도구의 실제 호출 인자. 미리보기엔 inputs 만 짧게.
function ToolCallRow({ tc }: { tc: import("@/lib/types/trace").AgentToolCall }) {
  const [open, setOpen] = useState(false);

  const inputs =
    tc.argsPreview && typeof tc.argsPreview === "object" && "inputs" in tc.argsPreview
      ? (tc.argsPreview as { inputs?: Record<string, unknown> }).inputs ?? null
      : tc.argsPreview;
  const inputsPreview = inputs
    ? Object.entries(inputs)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(" · ")
        .slice(0, 120)
    : "-";

  const hasDetail = tc.argsPreview || tc.resultPreview;

  return (
    <>
      <tr
        className={tc.status === "FAILED" ? "twb-io-row--fail twb-tool-row" : "twb-tool-row"}
        onClick={() => hasDetail && setOpen((v) => !v)}
        style={{ cursor: hasDetail ? "pointer" : "default" }}
      >
        <td className="twb-io-path">
          {hasDetail ? <span className="twb-tool-caret">{open ? "▾" : "▸"}</span> : null}
          {tc.toolName}
        </td>
        <td className="twb-io-val">{inputsPreview}</td>
        <td>
          <span className={tc.status === "FAILED" ? "twb-badge twb-badge--err" : "twb-badge twb-badge--ok"}>
            {tc.status === "COMPLETED" ? "✓" : tc.status === "FAILED" ? "✗" : tc.status}
          </span>
        </td>
        <td className="twb-io-val--number">{fmtDuration(tc.durationMs)}</td>
      </tr>
      {open && hasDetail ? (
        <tr className="twb-tool-detail-row">
          <td colSpan={4}>
            {tc.argsPreview ? (
              <div className="twb-tool-detail">
                <strong className="twb-tool-detail__label">인자</strong>
                <JsonTable data={tc.argsPreview as Record<string, unknown>} />
              </div>
            ) : null}
            {tc.resultPreview ? (
              <div className="twb-tool-detail">
                <strong className="twb-tool-detail__label">결과</strong>
                <JsonTable data={tc.resultPreview as Record<string, unknown>} />
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ─── GanttView — tool/llm calls 시간 분포를 horizontal bar 로 ──────────────────
// LogTimeline 이 시간순 list 라면, GanttView 는 같은 데이터의 visual timeline.
// 각 row 는 tool/llm 1개. x 축은 span 의 시작 ~ 종료. duration 만큼 막대.
function GanttView({ span }: { span: AgentSpan }) {
  const spanStart = span.startedAt ? new Date(span.startedAt).getTime() : 0;
  const spanEnd =
    span.endedAt ? new Date(span.endedAt).getTime() : spanStart + (span.durationMs ?? 0);
  const spanDur = Math.max(1, spanEnd - spanStart);

  type Bar = { kind: "tool" | "llm"; label: string; status: string; offsetMs: number; durMs: number };
  const bars: Bar[] = [
    // tool calls — log entry 의 startedAt 가 없어 누적 추정 어려움. duration 만 알기 때문에
    // 단순 누적 offset 으로 표현 (실제 startedAt 데이터 추가되면 교체).
    ...span.toolCalls.map((tc) => ({
      kind: "tool" as const,
      label: tc.toolName,
      status: tc.status,
      offsetMs: 0,
      durMs: tc.durationMs ?? 0
    })),
    ...span.llmCalls.map((lc) => ({
      kind: "llm" as const,
      label: lc.modelName,
      status: lc.status,
      offsetMs: 0,
      durMs: lc.latencyMs ?? 0
    }))
  ];

  // 누적 offset 시뮬레이션 — startedAt 없으니 sequential 가정
  let acc = 0;
  for (const b of bars) {
    b.offsetMs = acc;
    acc += b.durMs;
  }
  const totalDur = Math.max(spanDur, acc, 1);

  return (
    <div className="twb-gantt">
      <div className="twb-gantt__meta">
        총 {bars.length}개 · 전체 {(totalDur / 1000).toFixed(2)}s
      </div>
      {bars.length === 0 ? (
        <div className="twb-empty twb-empty--sm">표시할 호출이 없습니다.</div>
      ) : (
        <div className="twb-gantt__rows">
          {bars.map((bar, idx) => {
            const widthPct = (bar.durMs / totalDur) * 100;
            const leftPct = (bar.offsetMs / totalDur) * 100;
            return (
              <div key={`${bar.kind}-${idx}`} className="twb-gantt__row" title={`${bar.label} · ${bar.durMs}ms`}>
                <span className={`twb-gantt__label twb-gantt__label--${bar.kind}`}>{bar.label}</span>
                <div className="twb-gantt__track">
                  <span
                    className={`twb-gantt__bar twb-gantt__bar--${bar.kind} twb-gantt__bar--${bar.status === "FAILED" ? "fail" : "ok"}`}
                    style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
                  />
                </div>
                <span className="twb-gantt__dur">{bar.durMs}ms</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="twb-gantt__hint">※ tool/llm 의 정확한 시작 offset 데이터 부족으로 sequential 추정 표시</p>
    </div>
  );
}

function SpanDetail({ span, sessionId, agentTraceId }: { span: AgentSpan; sessionId: string; agentTraceId: string | number | null }) {
  const [tab, setTab] = useState<"preview" | "log" | "gantt">("preview");
  // ui-state — span 단위가 아닌 trace 단위 (변경 파일 + reviewStatus + diffSummary).
  // Trace 단위라 같은 span 안의 patches 와 별개로 추가 정보를 보여준다.
  const { data: uiState } = useAgentUIState(sessionId, agentTraceId);
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
        {(["preview", "log", "gantt"] as const).map(t => (
          <button key={t} type="button" className={tab === t ? "twb-tab twb-tab--active" : "twb-tab"} onClick={() => setTab(t)}>
            {t === "preview" ? "Preview" : t === "log" ? "Log View" : "Gantt"}
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
                    <ToolCallRow key={tc.toolCallId} tc={tc} />
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
          {uiState && uiState.changedFiles.length > 0 ? (
            <SectionCard icon="🔍" title="Worktree 변경 + Review 상태" accent="default" count={uiState.changedFileCount}>
              <table className="twb-io-table">
                <thead><tr><th>File</th><th>변경</th><th>+/-</th><th>리뷰 상태</th></tr></thead>
                <tbody>
                  {uiState.changedFiles.map(cf => (
                    <tr key={cf.fileChangedRequestId}>
                      <td className="twb-io-path" title={cf.diffSummary ?? ""}>{cf.relativePath}</td>
                      <td className="twb-io-val">{cf.changeType}</td>
                      <td className="twb-io-val--number">
                        <span className="twb-diff--add">+{cf.additions}</span> / <span className="twb-diff--del">-{cf.deletions}</span>
                      </td>
                      <td>
                        <span className={
                          cf.reviewStatus === "APPROVED" || cf.reviewStatus === "APPLIED"
                            ? "twb-badge twb-badge--ok"
                            : cf.reviewStatus === "REJECTED"
                              ? "twb-badge twb-badge--err"
                              : "twb-badge twb-badge--idle"
                        }>
                          {cf.reviewStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          ) : null}
        </div>
      ) : tab === "log" ? (
        <div className="twb-detail__body twb-detail__body--log">
          <LogTimeline span={span} />
        </div>
      ) : (
        <div className="twb-detail__body">
          <GanttView span={span} />
        </div>
      )}
    </div>
  );
}

// ─── Col 2: Span List ─────────────────────────────────────────────────────────

function SpanList({ run, selectedSpanId, onSelect, showRunSummary = true }: {
  run: AgentRunTrace | null; selectedSpanId: string | null; onSelect: (s: AgentSpan) => void; showRunSummary?: boolean;
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

  const sortedSpans = getSortedSpans(run);
  const totalTokens = run.totalInputTokens + run.totalOutputTokens;

  return (
    <div className="twb-col twb-col--spans">
      <div className="twb-col-head">
        <span className="twb-col-head__title">Spans</span>
        <Tooltip text="선택된 Trace 안에서 에이전트가 실행한 단계 목록입니다. 각 Span은 분석 · 수정 · 검증 등 하나의 작업 단위를 나타냅니다." />
      </div>
      <div className="twb-col-divider" />

      {showRunSummary ? (
        <>
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
        </>
      ) : (
        <div className="twb-col-divider--strong" />
      )}
      <div className="twb-col-section-label">SPAN 목록</div>

      {sortedSpans.map(span => {
        const childCount =
          (span.toolCallCount ?? span.toolCalls.length) +
          (span.llmCallCount ?? span.llmCalls.length) +
          span.patches.length;
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

function TraceList({ runs, selectedId, isLoading, page, totalPages, totalRuns, onPageChange, onSelect }: {
  runs: AgentRunTrace[];
  selectedId: string | null;
  isLoading: boolean;
  page: number;
  totalPages: number;
  totalRuns: number;
  onPageChange: (page: number) => void;
  onSelect: (r: AgentRunTrace) => void;
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "FAILED" | "RUNNING">("ALL");

  // client-side 필터링 — page 단위로 받아오는 prop runs 안에서만 필터.
  // 헤드라인/요약/에러 메시지/상태 매칭.
  const filteredRuns = useMemo(() => {
    let result = runs;
    if (statusFilter !== "ALL") {
      result = result.filter((r) => r.status === statusFilter);
    }
    const q = filterQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => {
        return (
          (r.summaryText ?? "").toLowerCase().includes(q) ||
          (r.headline ?? "").toLowerCase().includes(q) ||
          (r.errorMessage ?? "").toLowerCase().includes(q) ||
          String(r.agentTraceId).includes(q)
        );
      });
    }
    return result;
  }, [runs, statusFilter, filterQuery]);

  const pageNumbers = useMemo(() => {
    if (totalRuns === 0 || totalPages <= 0) return [];
    const windowSize = 5;
    const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1));
    const end = Math.min(totalPages, start + windowSize - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages, totalRuns]);

  return (
    <div className="twb-col twb-col--runs twb-col--runs-main">
      <div className="twb-col-head">
        <span className="twb-col-head__title">Trace 목록</span>
        <Tooltip text="에이전트 모드로 실행한 기록입니다. 각 Trace는 한 번의 에이전트 실행을 나타내며, 성공/실패 여부와 소요 시간을 확인할 수 있습니다." />
      </div>
      <div className="twb-col-divider--strong" />

      <div className="twb-list-toolbar">
        <div className="twb-list-toolbar__meta">
          <strong>총 {totalRuns}개{filterQuery || statusFilter !== "ALL" ? ` · 필터 ${filteredRuns.length}개` : ""}</strong>
          <span>{totalRuns > 0 ? `${page} / ${totalPages} 페이지` : "페이지 없음"}</span>
        </div>
        <div className="twb-pagination twb-pagination--compact">
          <button type="button" className="twb-pagination__nav" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            이전
          </button>
          <div className="twb-pagination__pages">
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={pageNumber === page ? "twb-pagination__page twb-pagination__page--active" : "twb-pagination__page"}
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
          </div>
          <button type="button" className="twb-pagination__nav" onClick={() => onPageChange(page + 1)} disabled={totalRuns === 0 || page >= totalPages}>
            다음
          </button>
        </div>
      </div>

      <div className="twb-list-filter">
        <input
          className="twb-list-filter__input"
          type="text"
          placeholder="요약·헤드라인·에러 검색…"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        <div className="twb-list-filter__chips">
          {(["ALL", "COMPLETED", "FAILED", "RUNNING"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={statusFilter === s ? "twb-list-filter__chip twb-list-filter__chip--active" : "twb-list-filter__chip"}
              onClick={() => setStatusFilter(s)}
            >
              {s === "ALL" ? "전체" : STATUS_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="twb-run-list">
        {isLoading ? (
          <div className="twb-empty">불러오는 중...</div>
        ) : filteredRuns.length === 0 ? (
          <div className="twb-empty twb-empty--center twb-empty--sm">
            <span>{runs.length === 0 ? "실행 기록 없음" : "필터 결과 없음"}</span>
          </div>
        ) : (
          filteredRuns.map(run => {
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
                  {/* run.spans 는 trace 목록 API 응답엔 없고 detail 호출 후에만 채워짐.
                      목록 단계에선 backend가 주는 totalSpanCount 를 우선 사용한다. */}
                  <span>{(run.spans?.length ?? 0) > 0 ? run.spans.length : (run.totalSpanCount ?? 0)} spans</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Col 3 placeholder ───────────────────────────────────────────────────────

function DetailPane({ span, sessionId, agentTraceId }: { span: AgentSpan | null; sessionId: string; agentTraceId: string | number | null }) {
  return (
    <div className="twb-col twb-col--detail">
      <div className="twb-col-head">
        <span className="twb-col-head__title">Span 상세</span>
        <Tooltip text="선택된 Span의 Input/Output 데이터, Tool 호출 내역, LLM 호출 정보, 파일 패치 내역을 확인할 수 있습니다. Log View에서 실행 타임라인을 볼 수 있습니다." />
      </div>
      <div className="twb-col-divider" />
      {span ? (
        <SpanDetail span={span} sessionId={sessionId} agentTraceId={agentTraceId} />
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
  const [page, setPage] = useState(1);
  const [selectedRunId,  setSelectedRunId]  = useState<string | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const traceJumpToId = useIdeStore((state) => state.traceJumpToId);
  const setTraceJumpToId = useIdeStore((state) => state.setTraceJumpToId);

  // Agent 진행 카드의 "Trace 보기" 버튼이 setTraceJumpToId 로 박은 ID 가 있으면 한 번 consume.
  useEffect(() => {
    if (!traceJumpToId) return;
    setSelectedRunId(traceJumpToId);
    setSelectedSpanId(null);  // 첫 span 자동 선택 effect 가 알아서 잡음
    setTraceJumpToId(null);   // consume — 다음 클릭 시 다시 trigger
  }, [traceJumpToId, setTraceJumpToId]);
  type AgentTraceListData = Awaited<ReturnType<typeof sessionApi.getAgentTraceList>>;

  const { data: traceList, isLoading } = useQuery<AgentTraceListData>({
    queryKey: ["agentTraces", sessionId, page],
    queryFn:  async (): Promise<AgentTraceListData> =>
      isBackendSessionId(sessionId)
        ? sessionApi.getAgentTraceList(sessionId, page, TRACE_PAGE_SIZE)
        : mockApi.getAgentTraces(sessionId).then((runs) => ({
            runs,
            totalCount: runs.length,
            page,
            size: TRACE_PAGE_SIZE,
            totalPages: Math.max(1, Math.ceil(runs.length / TRACE_PAGE_SIZE)),
            hasNext: page < Math.max(1, Math.ceil(runs.length / TRACE_PAGE_SIZE))
          })),
    staleTime: 30_000,
    refetchInterval: (query) => {
      // 완료/실패/취소된 Trace만 있으면 폴링 중단, 진행 중인 Trace가 있으면 5초 폴링
      const TERMINAL: string[] = ["COMPLETED", "FAILED", "CANCELLED"];
      const hasActive = (query.state.data?.runs ?? []).some((r) => !TERMINAL.includes(r.status));
      return hasActive ? 5000 : false;
    }
  });

  const runs = traceList?.runs ?? [];
  const totalPages = traceList?.totalPages ?? 1;
  const totalRuns = traceList?.totalCount ?? runs.length;

  const { data: selectedRunDetail } = useQuery<AgentRunTrace>({
    queryKey: ["agentTraceDetail", sessionId, selectedRunId],
    queryFn: async (): Promise<AgentRunTrace> =>
      sessionApi.getAgentTraceDetail(sessionId, selectedRunId ?? ""),
    enabled: isBackendSessionId(sessionId) && !!selectedRunId,
    staleTime: 30_000
  });

  const selectedRun = useMemo(
    () =>
      isBackendSessionId(sessionId) && selectedRunDetail && selectedRunDetail.agentTraceId === selectedRunId
        ? selectedRunDetail
        : runs.find((run) => run.agentTraceId === selectedRunId) ?? null,
    [runs, selectedRunDetail, selectedRunId, sessionId]
  );
  const selectedSpan = useMemo(
    () => selectedRun?.spans.find((span) => span.spanId === selectedSpanId) ?? null,
    [selectedRun, selectedSpanId]
  );
  const selectedRunSpans = useMemo(() => (selectedRun ? getSortedSpans(selectedRun) : []), [selectedRun]);
  const selectedRunTokens = selectedRun ? selectedRun.totalInputTokens + selectedRun.totalOutputTokens : 0;

  // 페이지 수 줄어들면 현재 페이지 클램프
  useEffect(() => {
    setPage((cur) => Math.min(cur, totalPages));
  }, [totalPages]);

  // 선택된 Trace가 사라지면 초기화, 첫 Span 자동 선택
  useEffect(() => {
    if (!selectedRun) {
      if (selectedRunId) setSelectedRunId(null);
      if (selectedSpanId) setSelectedSpanId(null);
      return;
    }
    const apiSelectedSpan = selectedRunSpans.find((span) => span.isSelected);
    if (apiSelectedSpan && apiSelectedSpan.spanId !== selectedSpanId) {
      setSelectedSpanId(apiSelectedSpan.spanId);
      return;
    }
    const hasSelectedSpan = selectedSpanId && selectedRun.spans.some((s) => s.spanId === selectedSpanId);
    if (!hasSelectedSpan) {
      setSelectedSpanId(selectedRunSpans[0]?.spanId ?? null);
    }
  }, [selectedRun, selectedRunId, selectedRunSpans, selectedSpanId]);

  // Escape 키로 드로어 닫기
  useEffect(() => {
    if (!selectedRunId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRunId(null);
        setSelectedSpanId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRunId]);

  const handleSelectRun = (run: AgentRunTrace) => {
    setSelectedRunId(run.agentTraceId);
    setSelectedSpanId(getSortedSpans(run)[0]?.spanId ?? null);
  };

  const handleCloseDetail = () => {
    setSelectedRunId(null);
    setSelectedSpanId(null);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
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

      {/* list + drawer body */}
      <div className={`twb-stage${selectedRun ? " twb-stage--drawer-open" : ""}`}>
        <TraceList
          runs={runs}
          selectedId={selectedRunId}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          totalRuns={totalRuns}
          onPageChange={handlePageChange}
          onSelect={handleSelectRun}
        />

        {/* slide-in drawer for span detail */}
        <div className={selectedRun ? "twb-drawer-layer twb-drawer-layer--open" : "twb-drawer-layer"}>
          <button
            type="button"
            className="twb-drawer__scrim"
            aria-label="Trace 상세 닫기"
            onClick={handleCloseDetail}
            tabIndex={selectedRun ? 0 : -1}
          />
          <aside
            className={selectedRun ? "twb-drawer twb-drawer--open" : "twb-drawer"}
            role="dialog"
            aria-modal="true"
            aria-label="Trace 상세"
            aria-hidden={!selectedRun}
          >
            <div className="twb-drawer__header">
              <div className="twb-drawer__title-wrap">
                <span className="panel-title panel-title--compact">trace detail</span>
                <strong>Trace 상세</strong>
                {selectedRun && <span className={STATUS_BADGE[selectedRun.status]}>{STATUS_LABEL[selectedRun.status]}</span>}
              </div>
              <button type="button" className="twb-close-btn" onClick={handleCloseDetail} title="Trace 상세 닫기">×</button>
            </div>

            {selectedRun && (
              <>
                <div className="twb-drawer__summary">
                  <div className="twb-drawer__summary-top">
                    <span className={`trace-dot ${STATUS_DOT[selectedRun.status] ?? "trace-dot--idle"}`} />
                    <strong>{fmtDate(selectedRun.startedAt)}</strong>
                    <span className="twb-drawer__summary-sep">·</span>
                    <span>{fmtDuration(selectedRun.durationMs)}</span>
                    <span className="twb-drawer__summary-sep">·</span>
                    <span>{fmtTokens(selectedRunTokens)} tok</span>
                    <span className="twb-drawer__summary-sep">·</span>
                    <span>{selectedRun.totalCostCredits} cr</span>
                    <span className="twb-drawer__summary-sep">·</span>
                    <span>{selectedRunSpans.length} spans</span>
                  </div>
                  {selectedRun.summaryText && <p className="twb-drawer__summary-text">{selectedRun.summaryText}</p>}
                  {selectedRun.errorMessage && <p className="twb-drawer__summary-error">{selectedRun.errorMessage}</p>}
                </div>

                <div className="twb-drawer__body">
                  <SpanList
                    run={selectedRun}
                    selectedSpanId={selectedSpanId}
                    onSelect={(span) => setSelectedSpanId(span.spanId)}
                    showRunSummary={false}
                  />
                  <div className="twb-col-resizer" />
                  <DetailPane span={selectedSpan} sessionId={sessionId} agentTraceId={selectedRun?.agentTraceId ?? null} />
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

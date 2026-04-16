"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { mockApi } from "@/lib/api/mockApi";
import type { AgentRunTrace, AgentSpan } from "@/lib/types/trace";

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  COMPLETED: "trace-dot--ok",
  FAILED:    "trace-dot--err",
  RUNNING:   "trace-dot--run",
  PENDING:   "trace-dot--idle",
  CANCELLED: "trace-dot--idle"
};
const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "완료", FAILED: "실패", RUNNING: "실행 중", PENDING: "대기", CANCELLED: "취소"
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  COMPLETED: "twb-badge twb-badge--ok",
  FAILED:    "twb-badge twb-badge--err",
  RUNNING:   "twb-badge twb-badge--run",
  PENDING:   "twb-badge twb-badge--idle",
  CANCELLED: "twb-badge twb-badge--idle"
};

function fmtDuration(ms: number | null) {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, count, accent = "default", defaultOpen = true, children, empty
}: {
  icon: string;
  title: string;
  count?: number;
  accent?: "blue" | "green" | "amber" | "violet" | "default";
  defaultOpen?: boolean;
  children: React.ReactNode;
  empty?: string;
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
      const type = val === null ? "null" : typeof val;
      rows.push({ path, value: val === null ? "null" : String(val), type });
    }
  }
  return rows;
}

function JsonTable({ data }: { data: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!data || Object.keys(data).length === 0) return null;

  const rows = flattenJson(data);

  const toggle = (path: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(path) ? next.delete(path) : next.add(path);
    return next;
  });

  return (
    <table className="twb-io-table">
      <thead>
        <tr>
          <th style={{ width: "38%" }}>Key</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const isLong = row.value.length > 80;
          const isExpanded = expanded.has(row.path);
          return (
            <tr key={row.path}>
              <td className="twb-io-path">{row.path}</td>
              <td className={`twb-io-val twb-io-val--${row.type}`}>
                {isLong && !isExpanded
                  ? <>
                      {row.value.slice(0, 80)}…{" "}
                      <button type="button" className="twb-expand-btn" onClick={() => toggle(row.path)}>펼치기</button>
                    </>
                  : <>
                      {row.value}
                      {isLong && <button type="button" className="twb-expand-btn" onClick={() => toggle(row.path)}> 접기</button>}
                    </>
                }
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── LogTimeline ──────────────────────────────────────────────────────────────

interface LogEntry {
  offsetMs: number;
  kind: "llm" | "tool" | "patch" | "span";
  label: string;
  detail: string;
  status?: string;
}

function buildLogEntries(span: AgentSpan): LogEntry[] {
  const entries: LogEntry[] = [];
  const base = new Date(span.startedAt).getTime();

  entries.push({
    offsetMs: 0,
    kind: "span",
    label: `[span] ${span.spanName} 시작`,
    detail: fmtTime(span.startedAt),
    status: "START"
  });

  // LLM calls — assume they happen near start
  let llmOffset = 200;
  span.llmCalls.forEach(llm => {
    entries.push({
      offsetMs: llmOffset,
      kind: "llm",
      label: `[llm] ${llm.modelName}`,
      detail: `${fmtTokens(llm.inputTokens)} in → ${fmtTokens(llm.outputTokens)} out · ${fmtDuration(llm.latencyMs)} · ${llm.finishReason ?? "-"}`,
      status: llm.status
    });
    llmOffset += (llm.latencyMs ?? 1000) + 100;
  });

  // Tool calls
  let toolOffset = 100;
  span.toolCalls.forEach(tc => {
    entries.push({
      offsetMs: toolOffset,
      kind: "tool",
      label: `[tool] ${tc.toolName}`,
      detail: tc.argsJson
        ? Object.entries(tc.argsJson).map(([k, v]) => `${k}: ${v}`).join(" · ")
        : "인자 없음",
      status: tc.status
    });
    toolOffset += (tc.durationMs ?? 200) + 50;
  });

  // Patches
  span.patches.forEach((p, i) => {
    entries.push({
      offsetMs: (span.durationMs ?? 5000) - 500 + i * 50,
      kind: "patch",
      label: `[patch] ${p.filePath.split("/").pop()}`,
      detail: `+${p.additions} -${p.deletions} · ${p.filePath}`,
      status: "APPLIED"
    });
  });

  // Span end
  if (span.endedAt) {
    entries.push({
      offsetMs: span.durationMs ?? 0,
      kind: "span",
      label: `[span] ${span.spanName} 종료`,
      detail: `${STATUS_LABEL[span.status]} · ${fmtDuration(span.durationMs)}`,
      status: span.status
    });
  }

  entries.sort((a, b) => a.offsetMs - b.offsetMs);
  return entries;
}

const LOG_KIND_ICON: Record<string, string> = {
  llm: "🤖", tool: "🔧", patch: "📄", span: "⏱"
};
const LOG_KIND_CLASS: Record<string, string> = {
  llm: "twb-log-row--llm", tool: "twb-log-row--tool", patch: "twb-log-row--patch", span: "twb-log-row--span"
};

function LogTimeline({ span }: { span: AgentSpan }) {
  const entries = buildLogEntries(span);

  return (
    <div className="twb-log-timeline">
      <div className="twb-log-header">
        <span>offset</span>
        <span>event</span>
        <span>detail</span>
      </div>
      {entries.map((entry, i) => (
        <div key={i} className={`twb-log-row ${LOG_KIND_CLASS[entry.kind]}`}>
          <span className="twb-log-offset">+{fmtDuration(entry.offsetMs)}</span>
          <span className="twb-log-label">
            <span className="twb-log-icon">{LOG_KIND_ICON[entry.kind]}</span>
            {entry.label}
          </span>
          <span className="twb-log-detail">{entry.detail}</span>
          {entry.status && (
            <span className={`twb-badge ${
              entry.status === "COMPLETED" || entry.status === "APPLIED" || entry.status === "START"
                ? "twb-badge--ok"
                : entry.status === "FAILED"
                  ? "twb-badge--err"
                  : "twb-badge--run"
            }`}>
              {entry.status === "START" ? "▶" : entry.status === "APPLIED" ? "✓" : entry.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── SpanDetail (right pane) ──────────────────────────────────────────────────

function SpanDetail({ span }: { span: AgentSpan }) {
  const [detailTab, setDetailTab] = useState<"preview" | "log">("preview");

  const totalInputTokens  = span.llmCalls.reduce((acc, c) => acc + c.inputTokens, 0);
  const totalOutputTokens = span.llmCalls.reduce((acc, c) => acc + c.outputTokens, 0);
  const modelNames = [...new Set(span.llmCalls.map(c => c.modelName))];

  return (
    <div className="twb-detail">
      {/* ── header ── */}
      <div className="twb-detail__head">
        <span className={`trace-dot ${STATUS_DOT[span.status] ?? "trace-dot--idle"}`} />
        <strong className="twb-detail__name">{span.spanName}</strong>
        <span className={STATUS_BADGE_CLASS[span.status] ?? "twb-badge twb-badge--idle"}>
          {STATUS_LABEL[span.status]}
        </span>
        <span className="twb-detail__seq">#{span.sequenceNo}</span>
      </div>

      {/* ── chips ── */}
      <div className="twb-chips">
        <span className="twb-chip"><span className="twb-chip__label">Latency</span><span className="twb-chip__val">{fmtDuration(span.durationMs)}</span></span>
        {span.startedAt && (
          <span className="twb-chip"><span className="twb-chip__label">Started</span><span className="twb-chip__val">{fmtTime(span.startedAt)}</span></span>
        )}
        {span.llmCalls.length > 0 && (
          <span className="twb-chip"><span className="twb-chip__label">Tokens</span><span className="twb-chip__val">{fmtTokens(totalInputTokens)} → {fmtTokens(totalOutputTokens)}</span></span>
        )}
        {modelNames.length > 0 && (
          <span className="twb-chip"><span className="twb-chip__label">Model</span><span className="twb-chip__val">{modelNames[0]}</span></span>
        )}
        {span.toolCalls.length > 0 && (
          <span className="twb-chip"><span className="twb-chip__label">Tools</span><span className="twb-chip__val">{span.toolCalls.length}회</span></span>
        )}
        {span.patches.length > 0 && (
          <span className="twb-chip"><span className="twb-chip__label">Patches</span><span className="twb-chip__val">{span.patches.length}개</span></span>
        )}
      </div>

      {/* ── tabs ── */}
      <div className="twb-tabs">
        {(["preview", "log"] as const).map(t => (
          <button key={t} type="button"
            className={detailTab === t ? "twb-tab twb-tab--active" : "twb-tab"}
            onClick={() => setDetailTab(t)}
          >
            {t === "preview" ? "Preview" : "Log View"}
          </button>
        ))}
      </div>

      {/* ── preview ── */}
      {detailTab === "preview" ? (
        <div className="twb-detail__body twb-detail__body--preview">

          <SectionCard icon="📥" title="Input" accent="blue"
            count={span.inputJson ? flattenJson(span.inputJson).length : 0}
            empty={!span.inputJson ? "Input 데이터 없음" : undefined}
          >
            <JsonTable data={span.inputJson} />
          </SectionCard>

          <SectionCard icon="📤" title="Output" accent="green"
            count={span.outputJson ? flattenJson(span.outputJson).length : 0}
            empty={!span.outputJson ? "Output 데이터 없음" : undefined}
          >
            <JsonTable data={span.outputJson} />
          </SectionCard>

          {span.toolCalls.length > 0 && (
            <SectionCard icon="🔧" title="Tool Calls" accent="amber" count={span.toolCalls.length}>
              <table className="twb-io-table">
                <thead>
                  <tr><th>Tool</th><th>인자</th><th>Status</th><th>Duration</th></tr>
                </thead>
                <tbody>
                  {span.toolCalls.map(tc => (
                    <tr key={tc.toolCallId} className={tc.status === "FAILED" ? "twb-io-row--fail" : ""}>
                      <td className="twb-io-path">{tc.toolName}</td>
                      <td className="twb-io-val">
                        {tc.argsJson
                          ? Object.entries(tc.argsJson).map(([k, v]) => `${k}: ${v}`).join(" · ")
                          : "-"}
                      </td>
                      <td>
                        <span className={tc.status === "FAILED" ? "twb-badge twb-badge--err" : "twb-badge twb-badge--ok"}>
                          {tc.status === "COMPLETED" ? "✓" : tc.status === "FAILED" ? "✗" : tc.status}
                        </span>
                      </td>
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
                <thead>
                  <tr><th>Model</th><th>Input</th><th>Output</th><th>Latency</th><th>Finish</th></tr>
                </thead>
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
                <thead>
                  <tr><th>File</th><th>추가</th><th>삭제</th></tr>
                </thead>
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
        /* ── log ── */
        <div className="twb-detail__body twb-detail__body--log">
          <LogTimeline span={span} />
        </div>
      )}
    </div>
  );
}

// ─── Left pane ────────────────────────────────────────────────────────────────

function SpanTreeRow({ span, isSelected, onSelect }: {
  span: AgentSpan; isSelected: boolean; onSelect: (s: AgentSpan) => void;
}) {
  const childCount = span.toolCalls.length + span.llmCalls.length + span.patches.length;
  return (
    <button
      type="button"
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
}

function RunSection({ run, defaultOpen, selectedSpanId, onSelectSpan }: {
  run: AgentRunTrace; defaultOpen: boolean; selectedSpanId: string | null; onSelectSpan: (s: AgentSpan) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalTokens = run.totalInputTokens + run.totalOutputTokens;
  const sortedSpans = [...run.spans].sort((a, b) => a.sequenceNo - b.sequenceNo);

  return (
    <div className={`twb-run${run.status === "FAILED" ? " twb-run--failed" : ""}`}>
      <button type="button" className="twb-run__head" onClick={() => setOpen(v => !v)}>
        <span className={`trace-dot ${STATUS_DOT[run.status] ?? "trace-dot--idle"}`} />
        <span className="twb-run__label">{STATUS_LABEL[run.status]}</span>
        <span className="twb-run__meta">
          <span>{fmtDuration(run.durationMs)}</span>
          <span>{fmtTokens(totalTokens)} tok</span>
        </span>
        <span className="twb-run__arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="twb-run__spans">
          {sortedSpans.map(span => (
            <SpanTreeRow key={span.spanId} span={span}
              isSelected={selectedSpanId === span.spanId}
              onSelect={onSelectSpan}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TraceWorkbench ───────────────────────────────────────────────────────────

export function TraceWorkbench({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [selectedSpan, setSelectedSpan] = useState<AgentSpan | null>(null);
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["agentTraces", sessionId],
    queryFn: () => mockApi.getAgentTraces(sessionId),
    refetchInterval: 10000
  });

  return (
    <div className="twb-shell">
      <div className="twb-titlebar">
        <span className="panel-title panel-title--compact">trace</span>
        <strong>에이전트 Trace</strong>
        <span className="twb-titlebar__meta">실행 기록 {runs.length}개</span>
        <button type="button" className="twb-close-btn" onClick={onClose} title="코드 화면으로 돌아가기">×</button>
      </div>

      <div className="twb-body">
        <aside className="twb-tree">
          {isLoading ? (
            <div className="twb-empty">불러오는 중...</div>
          ) : runs.length === 0 ? (
            <div className="twb-empty">아직 실행 기록이 없습니다.</div>
          ) : (
            runs.map((run, i) => (
              <RunSection key={run.agentTraceId} run={run} defaultOpen={i === 0}
                selectedSpanId={selectedSpan?.spanId ?? null}
                onSelectSpan={setSelectedSpan}
              />
            ))
          )}
        </aside>

        <div className="twb-detail-pane">
          {selectedSpan ? (
            <SpanDetail span={selectedSpan} />
          ) : (
            <div className="twb-empty twb-empty--center">
              <span>왼쪽 트리에서 Span을 선택하면</span>
              <span>입출력 정보와 실행 기록을 확인할 수 있습니다.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

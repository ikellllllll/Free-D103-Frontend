"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { mockApi } from "@/lib/api/mockApi";
import type { AgentRunTrace, AgentSpan } from "@/lib/types/trace";

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  COMPLETED: "trace-dot--ok",
  FAILED: "trace-dot--err",
  RUNNING: "trace-dot--run",
  PENDING: "trace-dot--idle",
  CANCELLED: "trace-dot--idle"
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "완료",
  FAILED: "실패",
  RUNNING: "실행 중",
  PENDING: "대기",
  CANCELLED: "취소"
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  COMPLETED: "twb-badge twb-badge--ok",
  FAILED: "twb-badge twb-badge--err",
  RUNNING: "twb-badge twb-badge--run",
  PENDING: "twb-badge twb-badge--idle",
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
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

// ─── JsonTable ────────────────────────────────────────────────────────────────

function flattenJson(obj: Record<string, unknown>, prefix = ""): Array<{ path: string; value: string }> {
  const rows: Array<{ path: string; value: string }> = [];

  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      rows.push(...flattenJson(val as Record<string, unknown>, path));
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        if (typeof item === "object" && item !== null) {
          rows.push(...flattenJson(item as Record<string, unknown>, `${path}[${idx}]`));
        } else {
          rows.push({ path: `${path}[${idx}]`, value: String(item) });
        }
      });
    } else {
      rows.push({ path, value: val === null ? "null" : String(val) });
    }
  }

  return rows;
}

function JsonTable({ data, label }: { data: Record<string, unknown> | null; label: string }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="twb-io-section">
        <span className="twb-io-label">{label}</span>
        <div className="twb-io-empty">데이터 없음</div>
      </div>
    );
  }

  const rows = flattenJson(data);

  return (
    <div className="twb-io-section">
      <span className="twb-io-label">{label}</span>
      <table className="twb-io-table">
        <thead>
          <tr>
            <th>Path</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path}>
              <td className="twb-io-path">{row.path}</td>
              <td className="twb-io-val">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SpanDetail (right pane) ──────────────────────────────────────────────────

function SpanDetail({ span }: { span: AgentSpan }) {
  const [detailTab, setDetailTab] = useState<"preview" | "log">("preview");

  const totalInputTokens = span.llmCalls.reduce((acc, c) => acc + c.inputTokens, 0);
  const totalOutputTokens = span.llmCalls.reduce((acc, c) => acc + c.outputTokens, 0);
  const modelNames = [...new Set(span.llmCalls.map((c) => c.modelName))];

  return (
    <div className="twb-detail">
      {/* header */}
      <div className="twb-detail__head">
        <span className={`trace-dot ${STATUS_DOT[span.status] ?? "trace-dot--idle"}`} />
        <strong className="twb-detail__name">{span.spanName}</strong>
        <span className={STATUS_BADGE_CLASS[span.status] ?? "twb-badge twb-badge--idle"}>
          {STATUS_LABEL[span.status]}
        </span>
      </div>

      {/* metadata chips */}
      <div className="twb-chips">
        <span className="twb-chip">
          <span className="twb-chip__label">Latency</span>
          <span className="twb-chip__val">{fmtDuration(span.durationMs)}</span>
        </span>
        {span.startedAt && (
          <span className="twb-chip">
            <span className="twb-chip__label">Started</span>
            <span className="twb-chip__val">{fmtTime(span.startedAt)}</span>
          </span>
        )}
        {span.llmCalls.length > 0 && (
          <span className="twb-chip">
            <span className="twb-chip__label">Tokens</span>
            <span className="twb-chip__val">{fmtTokens(totalInputTokens)} → {fmtTokens(totalOutputTokens)}</span>
          </span>
        )}
        {modelNames.length > 0 && (
          <span className="twb-chip">
            <span className="twb-chip__label">Model</span>
            <span className="twb-chip__val">{modelNames[0]}</span>
          </span>
        )}
        {span.toolCalls.length > 0 && (
          <span className="twb-chip">
            <span className="twb-chip__label">Tools</span>
            <span className="twb-chip__val">{span.toolCalls.length}회</span>
          </span>
        )}
        {span.patches.length > 0 && (
          <span className="twb-chip">
            <span className="twb-chip__label">Patches</span>
            <span className="twb-chip__val">{span.patches.length}개 파일</span>
          </span>
        )}
      </div>

      {/* tabs */}
      <div className="twb-tabs">
        <button
          type="button"
          className={detailTab === "preview" ? "twb-tab twb-tab--active" : "twb-tab"}
          onClick={() => setDetailTab("preview")}
        >
          Preview
        </button>
        <button
          type="button"
          className={detailTab === "log" ? "twb-tab twb-tab--active" : "twb-tab"}
          onClick={() => setDetailTab("log")}
        >
          Log View
        </button>
      </div>

      {/* tab body */}
      {detailTab === "preview" ? (
        <div className="twb-detail__body twb-detail__body--preview">
          <JsonTable data={span.inputJson} label="Input" />
          <JsonTable data={span.outputJson} label="Output" />

          {/* tool calls */}
          {span.toolCalls.length > 0 && (
            <div className="twb-io-section">
              <span className="twb-io-label">Tool Calls</span>
              <table className="twb-io-table">
                <thead>
                  <tr>
                    <th>Tool</th>
                    <th>Args</th>
                    <th>Status</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {span.toolCalls.map((tc) => (
                    <tr key={tc.toolCallId} className={tc.status === "FAILED" ? "twb-io-row--fail" : ""}>
                      <td className="twb-io-path">{tc.toolName}</td>
                      <td className="twb-io-val">
                        {tc.argsJson ? Object.entries(tc.argsJson).map(([k, v]) => `${k}: ${v}`).join(", ") : "-"}
                      </td>
                      <td>
                        <span className={tc.status === "FAILED" ? "twb-badge twb-badge--err" : "twb-badge twb-badge--ok"}>
                          {tc.status}
                        </span>
                      </td>
                      <td>{fmtDuration(tc.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* LLM calls */}
          {span.llmCalls.length > 0 && (
            <div className="twb-io-section">
              <span className="twb-io-label">LLM Calls</span>
              <table className="twb-io-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Input tok</th>
                    <th>Output tok</th>
                    <th>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {span.llmCalls.map((llm) => (
                    <tr key={llm.llmCallId}>
                      <td className="twb-io-path">{llm.modelName}</td>
                      <td>{fmtTokens(llm.inputTokens)}</td>
                      <td>{fmtTokens(llm.outputTokens)}</td>
                      <td>{fmtDuration(llm.latencyMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* patches */}
          {span.patches.length > 0 && (
            <div className="twb-io-section">
              <span className="twb-io-label">File Patches</span>
              <table className="twb-io-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>+</th>
                    <th>-</th>
                  </tr>
                </thead>
                <tbody>
                  {span.patches.map((p) => (
                    <tr key={p.patchId}>
                      <td className="twb-io-path">{p.filePath}</td>
                      <td className="twb-diff--add">+{p.additions}</td>
                      <td className="twb-diff--del">-{p.deletions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="twb-detail__body twb-detail__body--log">
          <pre className="twb-raw-json">
            {JSON.stringify(
              {
                spanId: span.spanId,
                spanName: span.spanName,
                status: span.status,
                startedAt: span.startedAt,
                endedAt: span.endedAt,
                durationMs: span.durationMs,
                input: span.inputJson,
                output: span.outputJson,
                toolCalls: span.toolCalls,
                llmCalls: span.llmCalls,
                patches: span.patches
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Left pane – span tree ────────────────────────────────────────────────────

function SpanTreeRow({
  span,
  isSelected,
  onSelect
}: {
  span: AgentSpan;
  isSelected: boolean;
  onSelect: (span: AgentSpan) => void;
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

function RunSection({
  run,
  defaultOpen,
  selectedSpanId,
  onSelectSpan
}: {
  run: AgentRunTrace;
  defaultOpen: boolean;
  selectedSpanId: string | null;
  onSelectSpan: (span: AgentSpan) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalTokens = run.totalInputTokens + run.totalOutputTokens;
  const sortedSpans = [...run.spans].sort((a, b) => a.sequenceNo - b.sequenceNo);

  return (
    <div className={`twb-run${run.status === "FAILED" ? " twb-run--failed" : ""}`}>
      <button type="button" className="twb-run__head" onClick={() => setOpen((v) => !v)}>
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
          {sortedSpans.map((span) => (
            <SpanTreeRow
              key={span.spanId}
              span={span}
              isSelected={selectedSpanId === span.spanId}
              onSelect={onSelectSpan}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TraceWorkbench (main export) ────────────────────────────────────────────

export function TraceWorkbench({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [selectedSpan, setSelectedSpan] = useState<AgentSpan | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["agentTraces", sessionId],
    queryFn: () => mockApi.getAgentTraces(sessionId),
    refetchInterval: 10000
  });

  return (
    <div className="twb-shell">
      {/* ── title bar ── */}
      <div className="twb-titlebar">
        <span className="panel-title panel-title--compact">trace</span>
        <strong>에이전트 Trace</strong>
        <span className="twb-titlebar__meta">실행 기록 {runs.length}개</span>
        <button type="button" className="twb-close-btn" onClick={onClose} title="코드 화면으로 돌아가기">
          ×
        </button>
      </div>

      {/* ── two-pane body ── */}
      <div className="twb-body">
        {/* left: span tree */}
        <aside className="twb-tree">
          {isLoading ? (
            <div className="twb-empty">불러오는 중...</div>
          ) : runs.length === 0 ? (
            <div className="twb-empty">아직 실행 기록이 없습니다.</div>
          ) : (
            runs.map((run, i) => (
              <RunSection
                key={run.agentTraceId}
                run={run}
                defaultOpen={i === 0}
                selectedSpanId={selectedSpan?.spanId ?? null}
                onSelectSpan={setSelectedSpan}
              />
            ))
          )}
        </aside>

        {/* right: span detail */}
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

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AgentRunTrace, AgentSpan } from "@/lib/types/trace";

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

function fmtDuration(ms: number | null) {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
}

function SpanRow({ span }: { span: AgentSpan }) {
  const [open, setOpen] = useState(false);
  const hasChildren = span.toolCalls.length + span.llmCalls.length + span.patches.length > 0;

  return (
    <div className="trace-span">
      <button
        type="button"
        className="trace-span__head"
        onClick={() => hasChildren && setOpen((v) => !v)}
        style={{ cursor: hasChildren ? "pointer" : "default" }}
      >
        <span className={`trace-dot ${STATUS_DOT[span.status] ?? "trace-dot--idle"}`} />
        <span className="trace-span__name">{span.spanName}</span>
        {hasChildren && (
          <span className="trace-span__arrow">{open ? "▾" : "▸"}</span>
        )}
        <span className="trace-span__dur">{fmtDuration(span.durationMs)}</span>
      </button>

      {open && (
        <div className="trace-span__body">
          {span.llmCalls.map((llm) => (
            <div key={llm.llmCallId} className="trace-child trace-child--llm">
              <span className="trace-child__icon">🤖</span>
              <span className="trace-child__name">{llm.modelName}</span>
              <span className="trace-child__meta">
                {fmtTokens(llm.inputTokens + llm.outputTokens)} tok
              </span>
              <span className="trace-child__dur">{fmtDuration(llm.latencyMs)}</span>
            </div>
          ))}

          {span.toolCalls.map((tc) => (
            <div
              key={tc.toolCallId}
              className={`trace-child trace-child--tool${tc.status === "FAILED" ? " trace-child--fail" : ""}`}
            >
              <span className="trace-child__icon">🔧</span>
              <span className="trace-child__name">{tc.toolName}</span>
              {tc.argsJson && Object.keys(tc.argsJson).length > 0 && (
                <span className="trace-child__meta">
                  {Object.values(tc.argsJson)[0] as string}
                </span>
              )}
              <span className="trace-child__dur">{fmtDuration(tc.durationMs)}</span>
            </div>
          ))}

          {span.patches.map((p) => (
            <div key={p.patchId} className="trace-child trace-child--patch">
              <span className="trace-child__icon">📄</span>
              <span className="trace-child__name">{p.filePath.split("/").pop()}</span>
              <span className="trace-child__diff">
                <span className="trace-diff--add">+{p.additions}</span>
                <span className="trace-diff--del">-{p.deletions}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({ run, defaultOpen }: { run: AgentRunTrace; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const totalTokens = run.totalInputTokens + run.totalOutputTokens;

  return (
    <div className={`trace-run${run.status === "FAILED" ? " trace-run--failed" : ""}`}>
      <button type="button" className="trace-run__head" onClick={() => setOpen((v) => !v)}>
        <span className={`trace-dot ${STATUS_DOT[run.status] ?? "trace-dot--idle"}`} />
        <span className="trace-run__label">{STATUS_LABEL[run.status]}</span>
        <span className="trace-run__dur">{fmtDuration(run.durationMs)}</span>
        <span className="trace-run__tokens">{fmtTokens(totalTokens)} tok</span>
        <span className="trace-run__arrow">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="trace-run__body">
          {run.summaryText && (
            <p className="trace-run__summary">{run.summaryText}</p>
          )}
          {run.errorMessage && (
            <p className="trace-run__error">{run.errorMessage}</p>
          )}

          <div className="trace-run__stats">
            <span>입력 {fmtTokens(run.totalInputTokens)}</span>
            <span>출력 {fmtTokens(run.totalOutputTokens)}</span>
            <span>크레딧 {run.totalCostCredits}</span>
          </div>

          <div className="trace-spans">
            {run.spans
              .sort((a, b) => a.sequenceNo - b.sequenceNo)
              .map((span) => (
                <SpanRow key={span.spanId} span={span} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TracePanel({ sessionId }: { sessionId: string }) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["agentTraces", sessionId],
    queryFn: () => (isBackendSessionId(sessionId) ? sessionApi.getAgentTraces(sessionId) : mockApi.getAgentTraces(sessionId)),
    refetchInterval: 10000
  });

  if (isLoading) {
    return (
      <div className="sidebar-section">
        <div className="empty-inline">트레이스를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="sidebar-section">
      <div className="sidebar-summary">
        <strong>에이전트 Trace</strong>
        <span>실행 기록 {runs.length}개</span>
      </div>

      {runs.length === 0 ? (
        <div className="empty-inline">아직 에이전트가 실행되지 않았습니다.</div>
      ) : (
        <div className="trace-runs">
          {runs.map((run, i) => (
            <RunCard key={run.agentTraceId} run={run} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// DDL 기반 Agent Trace 타입 정의

export type TraceRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type SpanStatus = "RUNNING" | "PENDING" | "COMPLETED" | "FAILED";

export interface AgentLlmCall {
  llmCallId: string;
  vendor: "OPENAI" | "CLAUDE";
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number | null;
  finishReason: string | null;
  status: "RUNNING" | "COMPLETED" | "FAILED";
}

export interface AgentToolCall {
  toolCallId: string;
  toolName: string;
  argsJson: Record<string, unknown> | null;
  durationMs: number | null;
  status: "COMPLETED" | "FAILED" | "CANCELLED";
}

export interface AgentPatch {
  patchId: string;
  filePath: string;
  additions: number;
  deletions: number;
}

export interface AgentSpan {
  spanId: string;
  parentSpanId: string | null;
  spanName: string;
  sequenceNo: number;
  status: SpanStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  toolCalls: AgentToolCall[];
  llmCalls: AgentLlmCall[];
  patches: AgentPatch[];
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
}

export interface AgentRunTrace {
  agentTraceId: string;
  status: TraceRunStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  outcome: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCredits: number;
  summaryText: string | null;
  errorMessage: string | null;
  spans: AgentSpan[];
}

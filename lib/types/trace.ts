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
  /** 백엔드 응답명: argsPreview. 기존 코드 호환을 위해 argsJson 도 같이 가지고 다닌다. */
  argsJson: Record<string, unknown> | null;
  argsPreview?: Record<string, unknown> | null;
  resultPreview?: Record<string, unknown> | null;
  durationMs: number | null;
  status: "COMPLETED" | "FAILED" | "CANCELLED";
  exitCode?: number | null;
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
  latencyMs?: number | null;
  interactionCount?: number;
  toolCallCount?: number;
  llmCallCount?: number;
  isSelected?: boolean;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  } | null;
  primaryModel?: string | null;
  toolCalls: AgentToolCall[];
  llmCalls: AgentLlmCall[];
  patches: AgentPatch[];
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
}

export interface AgentRunTrace {
  agentTraceId: string;
  problemSessionId?: string;
  status: TraceRunStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  outcome: string | null;
  headline?: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCredits: number;
  totalSpanCount?: number;
  summaryText: string | null;
  errorMessage: string | null;
  spans: AgentSpan[];
}

// 백엔드 GET /api/v1/ai/sessions/{sid}/agent/runs/{trace}/ui-state 응답.
// 진행 중인 agent 의 focus(파일/줄/컬럼) + 변경된 파일 목록(diff stats 포함).
export interface AgentUIStateChangedFile {
  fileChangedRequestId: number;
  relativePath: string;
  changeType: string;          // CREATE | EDIT | DELETE 등 백엔드 enum
  reviewStatus: string;        // PENDING | APPROVED | REJECTED | ...
  diffSummary: string | null;
  additions: number;
  deletions: number;
}

export interface AgentUIState {
  agentTraceId: number;
  agentWorkspaceId: number;
  problemSessionId: number;
  status: TraceRunStatus;
  focus: { path: string; line: number | null; column: number | null } | null;
  changedFileCount: number;
  changedFiles: AgentUIStateChangedFile[];
}

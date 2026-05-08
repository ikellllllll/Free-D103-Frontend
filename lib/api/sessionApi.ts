import { authClient, BASE_URL } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { mockApi } from "@/lib/api/mockApi";
import { normalizeApiDateTime, parseApiDateTime } from "@/lib/dateTime";
import { createInitialSession } from "@/lib/mock-data";
import type { AiMessage, TraceEvent } from "@/lib/types/ai";
import type { ProblemLanguage, RunResult, SolveSession, TestRunResult, WorkspaceFile } from "@/lib/types/session";
import type { AgentLlmCall, AgentPatch, AgentRunTrace, AgentSpan, AgentToolCall } from "@/lib/types/trace";

interface ApiResponse<T> {
  httpStatusCode: number;
  responseMessage: string;
  data: T;
  errorMessage?: string;
}

interface StartSessionResponse {
  problemSessionId: number;
  problemId: number;
  language?: "JAVA" | "PYTHON" | ProblemLanguage;
  status: "IN_PROGRESS" | "ENDED" | "EXPIRED";
  startedAt: string;
}

interface EndSessionResponse {
  problemSessionId: number;
  status?: "IN_PROGRESS" | "ENDED" | "EXPIRED";
  endedAt: string;
}

interface ExecutionResponse {
  executionId: number;
}

interface ExecutionResultItemResponse {
  testName: string;
  status: string;
  durationMs?: number | null;
  message?: string | null;
}

interface GetExecutionResultResponse {
  executionId: number;
  status: "RUNNING" | "COMPLETED" | "FAILED" | string;
  stdout?: string | null;
  stderr?: string | null;
  exitCode?: number | null;
  total: number;
  passed: number;
  failed: number;
  passRate?: number | null;
  results: ExecutionResultItemResponse[];
}

interface HarnessBuildResponse {
  sessionHarnessVersionId: number;
  parentVersionId?: number | null;
  versionNo: number;
  compileStatus: string;
  validErrors?: Array<{ path?: string | null; code?: string | null; message?: string | null }> | null;
  runtimeConfig?: Record<string, unknown> | null;
}

interface FileTreeItemResponse {
  fileId: number;
  path: string;
  name: string;
  nodeType: "FILE" | "DIRECTORY";
  language?: string | null;
}

interface GetFileTreeResponse {
  files: FileTreeItemResponse[];
  worktree: FileTreeItemResponse[];
}

interface GetFileContentResponse {
  fileId?: number;
  path?: string;
  name?: string;
  language?: string | null;
  content?: string | null;
}

interface GetWorktreeFileResponse {
  fileId: number;
  path: string;
  name: string;
  language: string;
  content: string;
  originType: "COPIED_FROM_REAL" | "GENERATED";
  presenceStatus: "ACTIVE" | "DELETED";
}

type SessionFileNodeType = "FILE" | "DIRECTORY";

interface CreateFileRequest {
  path: string;
  nodeType: SessionFileNodeType;
  content?: string | null;
  language?: string | null;
}

interface SaveFileRequest {
  path: string;
  content: string;
  language?: string | null;
}

type AgentTraceListPayload =
  | AgentRunTrace[]
  | {
      traces?: AgentRunTrace[];
      runs?: AgentRunTrace[];
      items?: AgentRunTrace[];
    };

interface AgentTraceTokenUsageResponse {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

interface AgentTraceSummaryResponse {
  traceId: number | string;
  problemSessionId?: number | string;
  status?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  duration?: number | null;
  durationMs?: number | null;
  summary?: string | null;
  headline?: string | null;
  outcome?: string | null;
  errorMessage?: string | null;
  tokenUsage?: AgentTraceTokenUsageResponse | null;
  totalCostCredits?: number | null;
  totalSpanCount?: number | null;
}

interface AgentTraceListResponse {
  problemSessionId: number;
  totalCount: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  traces: AgentTraceSummaryResponse[];
}

interface AgentTraceSpanSummaryResponse {
  spanId: number | string;
  sequenceNo?: number | null;
  spanName?: string | null;
  status?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  latencyMs?: number | null;
  interactionCount?: number | null;
  toolCallCount?: number | null;
  llmCallCount?: number | null;
  isSelected?: boolean | null;
}

interface AgentTraceSelectedSpanResponse extends AgentTraceSpanSummaryResponse {
  tokenUsage?: AgentTraceTokenUsageResponse | null;
  primaryModel?: string | null;
  preview?: {
    input?: Record<string, unknown> | null;
    output?: Record<string, unknown> | null;
  } | null;
  logView?: {
    inputJson?: Record<string, unknown> | null;
    outputJson?: Record<string, unknown> | null;
  } | null;
  toolCalls?: AgentToolCall[] | null;
  llmCalls?: AgentLlmCall[] | null;
  patches?: AgentPatch[] | null;
}

interface AgentTraceDetailResponse {
  trace: AgentTraceSummaryResponse;
  spans: AgentTraceSpanSummaryResponse[];
  selectedSpan?: AgentTraceSelectedSpanResponse | null;
}

interface AgentTraceListResult {
  runs: AgentRunTrace[];
  totalCount: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
}

const EXTERNAL_SESSION_READY_DELAY_MS = 1600;
const EXECUTION_POLL_INTERVAL_MS = 900;
// 도커 러너 회귀검증 (108분 × 114 fixtures) 실측:
//   Java: 평균 107s · max 300s (컨테이너 hard cap)
//   Python: 평균 6.66s
// 프로덕트 결정: 154초 (171 × 900ms ≈ 153.9s).
// 너무 짧으면 정상 빌드를 끊을 위험, 너무 길면 사용자가 멈춘 줄 모름 — 평균치(107s) 위 약간 위.
const EXECUTION_POLL_MAX_ATTEMPTS = 171;
const WORKTREE_PREFIX = ".worktree/";
const externalFileIdBySession = new Map<string, Map<string, number>>();

const inferLanguageFromPath = (path: string): string => {
  const lower = path.toLowerCase();

  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".properties")) return "properties";
  if (lower.endsWith(".sql")) return "sql";

  return "plaintext";
};

const toSessionFileLanguage = (path: string): string | null => {
  const lower = path.toLowerCase();
  const fileName = getFileName(path).toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() ?? null : null;

  if (!extension) {
    return null;
  }

  switch (extension) {
    case "md":
      return "md";
    case "yml":
    case "yaml":
      return "yml";
    case "properties":
      return "properties";
    default:
      return extension;
  }
};

const normalizeWorktreePath = (path: string) =>
  path.startsWith(WORKTREE_PREFIX) ? path : `${WORKTREE_PREFIX}${path}`;
const getFileName = (path: string) => path.split("/").pop() ?? path;
const getFolderPath = (path: string) => path.split("/").slice(0, -1).join("/") || null;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveRememberedFileId = async (sessionId: string, path: string) => {
  const remembered = externalFileIdBySession.get(sessionId)?.get(path);
  if (remembered) {
    return remembered;
  }

  const res = await authClient.get(`api/v1/sessions/${sessionId}/files`)
    .json<ApiResponse<GetFileTreeResponse>>();
  rememberFileIds(sessionId, res.data);
  return externalFileIdBySession.get(sessionId)?.get(path) ?? null;
};

const buildExternalSession = (
  payload: StartSessionResponse,
  userId: string,
  language: ProblemLanguage,
  aiModel: string,
  aiProvider: string
): SolveSession => {
  const startedAt = normalizeApiDateTime(payload.startedAt) ?? payload.startedAt;
  const seeded = createInitialSession(
    String(payload.problemSessionId),
    userId,
    String(payload.problemId),
    language
  );

  return {
    ...seeded,
    id: String(payload.problemSessionId),
    workspaceId: `ws-${payload.problemSessionId}`,
    problemId: String(payload.problemId),
    userId,
    language,
    status: "CREATING",
    createdAt: startedAt,
    lastSavedAt: startedAt,
    readyAt: Date.now() + EXTERNAL_SESSION_READY_DELAY_MS,
    aiModel,
    aiProvider
  };
};

const rememberFileIds = (sessionId: string, payload: GetFileTreeResponse) => {
  const mapping = new Map<string, number>();

  payload.files.forEach((item) => {
    if (item.nodeType === "FILE") {
      mapping.set(item.path, item.fileId);
    }
  });

  payload.worktree.forEach((item) => {
    if (item.nodeType === "FILE") {
      mapping.set(normalizeWorktreePath(item.path), item.fileId);
    }
  });

  externalFileIdBySession.set(sessionId, mapping);
};

const toWorkspaceFiles = (
  sessionId: string,
  payload: GetFileTreeResponse,
  existingFiles: WorkspaceFile[] = []
): WorkspaceFile[] => {
  rememberFileIds(sessionId, payload);
  const existingContent = new Map(existingFiles.map((file) => [file.path, file.content]));
  const sourceContent = new Map<string, string>();

  const sourceFiles = payload.files
    .filter((item) => item.nodeType === "FILE")
    .map((item) => {
      const content = existingContent.get(item.path) ?? "";
      sourceContent.set(item.path, content);

      return {
        path: item.path,
        language: item.language?.toLowerCase() || inferLanguageFromPath(item.path),
        content
      } satisfies WorkspaceFile;
    });

  const worktreeFiles = payload.worktree
    .filter((item) => item.nodeType === "FILE")
    .map((item) => {
      const nextPath = normalizeWorktreePath(item.path);
      const sourcePath = item.path.replace(/^\.worktree\//, "");

      return {
        path: nextPath,
        language: item.language?.toLowerCase() || inferLanguageFromPath(item.path),
        content: existingContent.get(nextPath) ?? sourceContent.get(sourcePath) ?? ""
      } satisfies WorkspaceFile;
    });

  return [...sourceFiles, ...worktreeFiles];
};

const formatTraceTime = (iso: string) =>
  (parseApiDateTime(iso) ?? new Date(iso)).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

const normalizeToolCalls = (calls: AgentToolCall[] | null | undefined): AgentToolCall[] =>
  (calls ?? []).map((call, index) => ({
    toolCallId: String(call?.toolCallId ?? `tool-${index + 1}`),
    toolName: String(call?.toolName ?? "tool"),
    argsJson: call?.argsJson ?? null,
    durationMs: call?.durationMs ?? null,
    status: call?.status ?? "COMPLETED"
  }));

const normalizeLlmCalls = (calls: AgentLlmCall[] | null | undefined): AgentLlmCall[] =>
  (calls ?? []).map((call, index) => ({
    llmCallId: String(call?.llmCallId ?? `llm-${index + 1}`),
    vendor: call?.vendor ?? "OPENAI",
    modelName: String(call?.modelName ?? "unknown"),
    inputTokens: Number(call?.inputTokens ?? 0),
    outputTokens: Number(call?.outputTokens ?? 0),
    latencyMs: call?.latencyMs ?? null,
    finishReason: call?.finishReason ?? null,
    status: call?.status ?? "COMPLETED"
  }));

const normalizePatches = (patches: AgentPatch[] | null | undefined): AgentPatch[] =>
  (patches ?? []).map((patch, index) => ({
    patchId: String(patch?.patchId ?? `patch-${index + 1}`),
    filePath: String(patch?.filePath ?? ""),
    additions: Number(patch?.additions ?? 0),
    deletions: Number(patch?.deletions ?? 0)
  }));

const normalizeSpans = (spans: AgentSpan[] | null | undefined): AgentSpan[] =>
  (spans ?? []).map((span, index) => ({
    spanId: String(span?.spanId ?? `span-${index + 1}`),
    parentSpanId: span?.parentSpanId ?? null,
    spanName: String(span?.spanName ?? `span-${index + 1}`),
    sequenceNo: Number(span?.sequenceNo ?? index + 1),
    status: span?.status ?? "COMPLETED",
    startedAt: span?.startedAt ?? new Date().toISOString(),
    endedAt: span?.endedAt ?? null,
    durationMs: span?.durationMs ?? null,
    toolCalls: normalizeToolCalls(span?.toolCalls),
    llmCalls: normalizeLlmCalls(span?.llmCalls),
    patches: normalizePatches(span?.patches),
    inputJson: span?.inputJson ?? null,
    outputJson: span?.outputJson ?? null
  }));

const toTraceRunStatus = (value: string | null | undefined): AgentRunTrace["status"] => {
  switch ((value ?? "").toUpperCase()) {
    case "RUNNING":
      return "RUNNING";
    case "PENDING":
      return "PENDING";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "COMPLETED";
  }
};

const toSpanStatus = (value: string | null | undefined): AgentSpan["status"] => {
  switch ((value ?? "").toUpperCase()) {
    case "RUNNING":
      return "RUNNING";
    case "PENDING":
      return "PENDING";
    case "FAILED":
      return "FAILED";
    default:
      return "COMPLETED";
  }
};

const normalizeTraceSummary = (trace: AgentTraceSummaryResponse): AgentRunTrace => ({
  agentTraceId: String(trace.traceId),
  problemSessionId: trace.problemSessionId != null ? String(trace.problemSessionId) : undefined,
  status: toTraceRunStatus(trace.status),
  startedAt: trace.startedAt ?? new Date().toISOString(),
  endedAt: trace.endedAt ?? null,
  durationMs: trace.durationMs ?? trace.duration ?? null,
  outcome: trace.outcome ?? null,
  headline: trace.headline ?? null,
  totalInputTokens: Number(trace.tokenUsage?.inputTokens ?? 0),
  totalOutputTokens: Number(trace.tokenUsage?.outputTokens ?? 0),
  totalCostCredits: Number(trace.totalCostCredits ?? 0),
  totalSpanCount: Number(trace.totalSpanCount ?? 0),
  summaryText: trace.summary ?? trace.headline ?? null,
  errorMessage: trace.errorMessage ?? null,
  spans: []
});

const normalizeSpanSummary = (span: AgentTraceSpanSummaryResponse): AgentSpan => ({
  spanId: String(span.spanId),
  parentSpanId: null,
  spanName: String(span.spanName ?? "span"),
  sequenceNo: Number(span.sequenceNo ?? 0),
  status: toSpanStatus(span.status),
  startedAt: span.startedAt ?? new Date().toISOString(),
  endedAt: span.endedAt ?? null,
  durationMs: span.latencyMs ?? null,
  latencyMs: span.latencyMs ?? null,
  interactionCount: Number(span.interactionCount ?? 0),
  toolCallCount: Number(span.toolCallCount ?? 0),
  llmCallCount: Number(span.llmCallCount ?? 0),
  isSelected: Boolean(span.isSelected),
  toolCalls: [],
  llmCalls: [],
  patches: [],
  inputJson: null,
  outputJson: null
});

const normalizeSelectedSpan = (span: AgentTraceSelectedSpanResponse): AgentSpan => ({
  spanId: String(span.spanId),
  parentSpanId: null,
  spanName: String(span.spanName ?? "span"),
  sequenceNo: Number(span.sequenceNo ?? 0),
  status: toSpanStatus(span.status),
  startedAt: span.startedAt ?? new Date().toISOString(),
  endedAt: span.endedAt ?? null,
  durationMs: span.latencyMs ?? null,
  latencyMs: span.latencyMs ?? null,
  interactionCount: Number(span.interactionCount ?? 0),
  toolCallCount: Number(span.toolCallCount ?? 0),
  llmCallCount: Number(span.llmCallCount ?? 0),
  isSelected: true,
  tokenUsage: {
    inputTokens: Number(span.tokenUsage?.inputTokens ?? 0),
    outputTokens: Number(span.tokenUsage?.outputTokens ?? 0)
  },
  primaryModel: span.primaryModel ?? null,
  toolCalls: normalizeToolCalls(span.toolCalls),
  llmCalls: normalizeLlmCalls(span.llmCalls),
  patches: normalizePatches(span.patches),
  inputJson: span.logView?.inputJson ?? span.preview?.input ?? null,
  outputJson: span.logView?.outputJson ?? span.preview?.output ?? null
});

const normalizeAgentTraceListResult = (payload: AgentTraceListResponse): AgentTraceListResult => ({
  runs: payload.traces.map(normalizeTraceSummary),
  totalCount: Number(payload.totalCount ?? payload.traces.length),
  page: Number(payload.page ?? 1),
  size: Number(payload.size ?? payload.traces.length),
  totalPages: Number(payload.totalPages ?? 1),
  hasNext: Boolean(payload.hasNext)
});

const normalizeAgentTraceDetail = (payload: AgentTraceDetailResponse): AgentRunTrace => {
  const run = normalizeTraceSummary(payload.trace);
  const summarySpans = (payload.spans ?? []).map(normalizeSpanSummary);
  const selectedSpan = payload.selectedSpan ? normalizeSelectedSpan(payload.selectedSpan) : null;

  run.spans = summarySpans.map((span) =>
    selectedSpan && span.spanId === selectedSpan.spanId
      ? {
          ...span,
          ...selectedSpan
        }
      : span
  );

  if (selectedSpan && !run.spans.some((span) => span.spanId === selectedSpan.spanId)) {
    run.spans.push(selectedSpan);
  }

  run.spans.sort((left, right) => left.sequenceNo - right.sequenceNo);
  return run;
};

const extractTraceRuns = (payload: AgentTraceListPayload): AgentRunTrace[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.traces ?? payload.runs ?? payload.items ?? [];
};

const normalizeAgentRuns = (payload: AgentTraceListPayload): AgentRunTrace[] =>
  extractTraceRuns(payload).map((run, index) => ({
    agentTraceId: String(run?.agentTraceId ?? `trace-${index + 1}`),
    status: run?.status ?? "COMPLETED",
    startedAt: run?.startedAt ?? new Date().toISOString(),
    endedAt: run?.endedAt ?? null,
    durationMs: run?.durationMs ?? null,
    outcome: run?.outcome ?? null,
    totalInputTokens: Number(run?.totalInputTokens ?? 0),
    totalOutputTokens: Number(run?.totalOutputTokens ?? 0),
    totalCostCredits: Number(run?.totalCostCredits ?? 0),
    summaryText: run?.summaryText ?? null,
    errorMessage: run?.errorMessage ?? null,
    spans: normalizeSpans(run?.spans)
  }));

const toSessionTraces = (runs: AgentRunTrace[]): TraceEvent[] =>
  runs.map((run) => ({
    id: run.agentTraceId,
    time: formatTraceTime(run.startedAt),
    type: "실행" as TraceEvent["type"],
    summary: run.summaryText ?? `Trace ${run.agentTraceId}`,
    detail:
      run.status === "FAILED"
        ? run.errorMessage ?? "실패"
        : `${run.spans.length} spans · ${run.totalInputTokens + run.totalOutputTokens} tok`
  }));

export const isBackendSessionId = (value: string) => /^\d+$/.test(value);
export const isBackendProblemId = (value: string) => /^\d+$/.test(value);

const toProblemLanguage = (language: StartSessionResponse["language"] | null | undefined): ProblemLanguage | null => {
  if (!language) return null;
  const normalized = String(language).toLowerCase();
  if (normalized === "java" || normalized === "python") {
    return normalized;
  }

  return null;
};

const normalizeExecutionStatus = (status: string): RunResult["status"] =>
  status === "COMPLETED" ? "COMPLETED" : "ERROR";

const normalizeTestStatus = (status: string): "PASS" | "FAIL" => {
  const normalized = status.toUpperCase();
  return normalized === "PASS" || normalized === "PASSED" || normalized === "SUCCESS" || normalized === "SUCCESSFUL"
    ? "PASS"
    : "FAIL";
};

const toRunResult = (payload: GetExecutionResultResponse): RunResult => ({
  status: normalizeExecutionStatus(payload.status),
  stdout: payload.stdout ?? "",
  stderr: payload.stderr ?? "",
  exitCode: payload.exitCode ?? (payload.status === "COMPLETED" ? 0 : -1),
  durationMs: payload.results.reduce((sum, item) => sum + (item.durationMs ?? 0), 0)
});

const toTestRunResult = (payload: GetExecutionResultResponse): TestRunResult => ({
  total: payload.total,
  passed: payload.passed,
  failed: payload.failed,
  results: payload.results.map((item, index) => ({
    id: `${payload.executionId}-${index}`,
    name: item.testName || `Test ${index + 1}`,
    status: normalizeTestStatus(item.status),
    time: item.durationMs == null ? "-" : `${item.durationMs}ms`,
    detail: item.message ?? undefined
  }))
});

export const sessionApi = {
  async startSession(
    problemId: string,
    userId: string,
    language: ProblemLanguage = "java",
    aiModel = "aig-default",
    aiProvider = "default"
  ) {
    // 백엔드 StartSessionRequest는 Language enum (JAVA | PYTHON, 대문자) 을 body 로 받음
    const res = await authClient
      .post(`api/v1/problems/${problemId}/sessions`, {
        json: { language: language.toUpperCase() }
      })
      .json<ApiResponse<StartSessionResponse>>();

    const sessionLanguage = toProblemLanguage(res.data.language) ?? language;
    const session = buildExternalSession(res.data, userId, sessionLanguage, aiModel, aiProvider);
    await mockApi.registerExternalSession(session);
    return session;
  },

  async getWorkspace(sessionId: string) {
    const existingSession = await mockApi.getSession(sessionId);
    const res = await authClient.get(`api/v1/sessions/${sessionId}/files`)
      .json<ApiResponse<GetFileTreeResponse>>();

    const files = toWorkspaceFiles(sessionId, res.data, existingSession.files);
    return mockApi.syncExternalWorkspace(sessionId, files);
  },

  async createFile(sessionId: string, input: CreateFileRequest) {
    const resolvedLanguage =
      input.nodeType === "DIRECTORY"
        ? null
        : input.language ?? toSessionFileLanguage(input.path) ?? inferLanguageFromPath(input.path);
    const resolvedContent = input.nodeType === "DIRECTORY" ? null : input.content ?? "";

    await authClient.post(`api/v1/sessions/${sessionId}/files`, {
      json: {
        path: input.path,
        name: getFileName(input.path),
        nodeType: input.nodeType,
        language: resolvedLanguage,
        content: resolvedContent
      }
    });

    const workspace = await this.getWorkspace(sessionId);

    if (input.nodeType === "FILE") {
      await mockApi.syncExternalFileContent(
        sessionId,
        input.path,
        resolvedContent ?? "",
        resolvedLanguage ?? inferLanguageFromPath(input.path)
      );
    }

    return workspace;
  },

  async getWorktreeFileContent(sessionId: string, worktreeFileId: number) {
    try {
      const res = await authClient.get(`api/v1/sessions/${sessionId}/worktrees/${worktreeFileId}`)
        .json<ApiResponse<GetWorktreeFileResponse>>();
      return res.data as GetFileContentResponse;
    } catch {
      return null;
    }
  },

  async getFileContent(sessionId: string, path: string) {
    const fileId = externalFileIdBySession.get(sessionId)?.get(path);
    if (!fileId) {
      return null;
    }

    let payload: GetFileContentResponse | null = null;

    if (path.startsWith(WORKTREE_PREFIX)) {
      payload = await this.getWorktreeFileContent(sessionId, fileId);
    } else {
      try {
        const res = await authClient.get(`api/v1/sessions/${sessionId}/files/${fileId}`)
          .json<ApiResponse<GetFileContentResponse>>();
        payload = res.data;
      } catch {
        try {
          const res = await authClient.get(`api/v1/sessions/${sessionId}/files/${fileId}/content`)
            .json<ApiResponse<GetFileContentResponse>>();
          payload = res.data;
        } catch {
          payload = null;
        }
      }
    }

    const content = payload?.content ?? "";
    const language = payload?.language?.toLowerCase() ?? inferLanguageFromPath(path);
    await mockApi.syncExternalFileContent(sessionId, path, content, language);
    return { path, content, language };
  },

  async getAgentTraces(sessionId: string) {
    try {
      const result = await this.getAgentTraceList(sessionId, 1, 10);
      if (result.runs.length === 0) return mockApi.getAgentTraces(sessionId);
      await mockApi.syncExternalTraces(sessionId, toSessionTraces(result.runs));
      return result.runs;
    } catch {
      return mockApi.getAgentTraces(sessionId);
    }
  },

  async getAgentTraceList(sessionId: string, page = 1, size = 10) {
    try {
      const res = await authClient.get(`api/v1/sessions/${sessionId}/traces`, {
        searchParams: {
          page,
          size
        }
      })
        .json<ApiResponse<AgentTraceListResponse | AgentTraceListPayload>>();

      const data = res.data;
      if (Array.isArray(data) || "traces" in data === false && "runs" in data === false && "items" in data === false && "page" in data === false) {
        const runs = normalizeAgentRuns(data as AgentTraceListPayload);
        return {
          runs,
          totalCount: runs.length,
          page,
          size,
          totalPages: Math.max(1, Math.ceil(runs.length / size)),
          hasNext: false
        } satisfies AgentTraceListResult;
      }

      if ("page" in data && "size" in data && "totalPages" in data && "traces" in data) {
        return normalizeAgentTraceListResult(data as AgentTraceListResponse);
      }

      const runs = normalizeAgentRuns(data as AgentTraceListPayload);
      return {
        runs,
        totalCount: runs.length,
        page,
        size,
        totalPages: Math.max(1, Math.ceil(runs.length / size)),
        hasNext: false
      } satisfies AgentTraceListResult;
    } catch {
      const runs = await mockApi.getAgentTraces(sessionId);
      return {
        runs,
        totalCount: runs.length,
        page,
        size,
        totalPages: 1,
        hasNext: false
      } satisfies AgentTraceListResult;
    }
  },

  async getAgentTraceDetail(sessionId: string, traceId: string) {
    try {
      const res = await authClient.get(`api/v1/sessions/${sessionId}/traces/${traceId}`)
        .json<ApiResponse<AgentTraceDetailResponse | AgentRunTrace>>();

      const data = res.data;
      if ("trace" in data && "spans" in data) {
        return normalizeAgentTraceDetail(data as AgentTraceDetailResponse);
      }

      return normalizeAgentRuns([data as AgentRunTrace])[0];
    } catch {
      const runs = await mockApi.getAgentTraces(sessionId);
      return runs.find((run) => run.agentTraceId === traceId) ?? runs[0];
    }
  },

  async getChatMessages(sessionId: string): Promise<AiMessage[]> {
    try {
      const res = await authClient
        .get(`api/v1/ai/sessions/${sessionId}/messages`)
        .json<ApiResponse<{ messages: Array<{ agentSessionMsgId: number; msgKind: "AI" | "HUMAN"; content: string; createdAt: string }> }>>();

      const messages = res.data?.messages ?? [];
      // 백엔드가 정상 응답한 경우 (빈 배열 포함) 그대로 반환 — 신규 세션의 mock 시드 채팅 누설 방지
      return messages.map((m) => ({
        id: String(m.agentSessionMsgId),
        role: m.msgKind === "HUMAN" ? "user" : "assistant",
        content: m.content,
        createdAt: m.createdAt
      }));
    } catch {
      return mockApi.getChatMessages(sessionId);
    }
  },

  async saveFile(sessionId: string, input: SaveFileRequest) {
    const fileId = await resolveRememberedFileId(sessionId, input.path);
    if (!fileId) {
      throw new Error("저장할 파일 정보를 찾지 못했습니다.");
    }

    const language = input.language ?? toSessionFileLanguage(input.path) ?? inferLanguageFromPath(input.path);

    await authClient.patch(`api/v1/sessions/${sessionId}/files/${fileId}/content`, {
      json: { content: input.content }
    });

    await mockApi.syncExternalFileContent(sessionId, input.path, input.content, language);
    return {
      path: input.path,
      content: input.content,
      language
    };
  },

  async startExecution(sessionId: string) {
    const res = await authClient
      .post(`api/v1/sessions/${sessionId}/executions`)
      .json<ApiResponse<ExecutionResponse>>();

    return String(res.data.executionId);
  },

  async getExecutionResult(executionId: string) {
    const res = await authClient
      .get(`api/v1/executions/${executionId}/results`)
      .json<ApiResponse<GetExecutionResultResponse>>();

    return res.data;
  },

  async runExecution(sessionId: string) {
    const executionId = await this.startExecution(sessionId);
    let payload = await this.getExecutionResult(executionId);

    for (let attempt = 0; payload.status === "RUNNING" && attempt < EXECUTION_POLL_MAX_ATTEMPTS; attempt += 1) {
      await wait(EXECUTION_POLL_INTERVAL_MS);
      payload = await this.getExecutionResult(executionId);
    }

    if (payload.status === "RUNNING") {
      throw new Error("실행 결과 대기 시간이 초과되었습니다.");
    }

    return {
      executionId,
      raw: payload,
      runResult: toRunResult(payload),
      testResult: toTestRunResult(payload)
    };
  },

  async buildHarness(sessionId: string, baseModel: string) {
    const res = await authClient
      .post(`api/v1/ai/sessions/${sessionId}/harness/build`, {
        json: { baseModel }
      })
      .json<ApiResponse<HarnessBuildResponse>>();

    return res.data;
  },

  async endSession(sessionId: string) {
    const res = await authClient.post(`api/v1/sessions/${sessionId}/end`)
      .json<ApiResponse<EndSessionResponse>>();

    return {
      ...res.data,
      endedAt: normalizeApiDateTime(res.data.endedAt) ?? res.data.endedAt
    };
  },

  /**
   * AI 채팅 SSE streaming.
   * 백엔드: POST /api/v1/ai/sessions/{id}/chat/stream (text/event-stream).
   * 응답 프레임: event: {metadata|data|end|error} + data: <json>
   *   - data: { type: "AIMessageChunk", content, modelName, additional_kwargs }
   * EventSource 는 GET 만 지원해서 native fetch + ReadableStream 으로 직접 파싱.
   * authClient (ky) 의 401 자동 refresh 가 SSE 응답에 잘 안 맞아 단순화: 401 이면 에러 throw.
   */
  async streamChat(
    sessionId: string,
    payload: {
      chat: string;
      modelName?: string | null;
      systemPrompt?: string | null;
      referenceContents?: string[];
    },
    handlers: {
      onMetadata?: (data: { run_id?: string } & Record<string, unknown>) => void;
      onChunk: (content: string, modelName: string) => void;
      onEnd?: () => void;
      onError?: (code: string, message: string) => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const { tokens } = useAuthStore.getState();
    if (!tokens?.accessToken) {
      throw new Error("로그인이 필요합니다.");
    }

    const body: Record<string, unknown> = { chat: payload.chat };
    if (payload.modelName) body.modelName = payload.modelName;
    if (payload.systemPrompt) body.systemPrompt = payload.systemPrompt;
    if (payload.referenceContents) body.referenceContents = payload.referenceContents;

    const res = await fetch(`${BASE_URL}/api/v1/ai/sessions/${sessionId}/chat/stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify(body),
      signal
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("세션이 만료됐습니다. 다시 로그인해주세요.");
      }
      const text = await res.text().catch(() => "");
      throw new Error(`AI 응답 실패 (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    if (!res.body) {
      throw new Error("AI 스트림 응답 본문이 없습니다.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 프레임은 빈 줄 (\n\n) 으로 구분.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (!frame.trim()) continue;

          let eventName = "message";
          let dataStr = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (eventName === "metadata") {
            handlers.onMetadata?.(parsed);
          } else if (eventName === "data") {
            const content = typeof parsed?.content === "string" ? parsed.content : "";
            const modelName = typeof parsed?.modelName === "string" ? parsed.modelName : "";
            if (content) handlers.onChunk(content, modelName);
          } else if (eventName === "end") {
            handlers.onEnd?.();
            return;
          } else if (eventName === "error") {
            const code = typeof parsed?.code === "string" ? parsed.code : "AI_ERROR";
            const message = typeof parsed?.message === "string" ? parsed.message : "AI 응답 중 오류가 발생했습니다.";
            handlers.onError?.(code, message);
            return;
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* noop */
      }
    }
  },

  /** 코드 제출 — 새 Execution(SUBMISSION) 생성. executionId 반환. */
  async submitSession(sessionId: string): Promise<{ executionId: number }> {
    const res = await authClient
      .post(`api/v1/sessions/${sessionId}/submissions`)
      .json<ApiResponse<{ executionId: number }>>();
    return res.data;
  },

  /**
   * 제출 결과 폴링 — RUNNING/COMPLETED/FAILED + public/hidden 분리 카운트.
   * 백엔드 명세상:
   *   - total/passed/failed/passRate 는 합산값 (legacy)
   *   - publicPassedCount/publicTotalCount/hiddenPassedCount/hiddenTotalCount 가 product 의도
   * 두 형식 모두 옵셔널로 받고, public/hidden 분리값이 있으면 그걸 우선 사용.
   */
  async getSubmissionResult(executionId: string) {
    const res = await authClient
      .get(`api/v1/executions/${executionId}/submission-results`)
      .json<ApiResponse<{
        executionId: number;
        status: string;
        total?: number;
        passed?: number;
        failed?: number;
        passRate?: number;
        publicPassedCount?: number;
        publicTotalCount?: number;
        hiddenPassedCount?: number;
        hiddenTotalCount?: number;
      }>>();

    // mock Submission 형식과 호환되도록 어댑터.
    // FAILED 도 terminal state 라 COMPLETED 로 매핑해야 polling 이 중단됨.
    const data = res.data;
    const isTerminal = data.status === "COMPLETED" || data.status === "FAILED";

    // public/hidden 분리값이 오면 그걸로 합산값을 derive (백엔드가 합산값을 안 줘도 채워짐).
    const hasSplit =
      typeof data.publicTotalCount === "number" || typeof data.hiddenTotalCount === "number";
    const publicPassed = data.publicPassedCount ?? 0;
    const publicTotal = data.publicTotalCount ?? 0;
    const hiddenPassed = data.hiddenPassedCount ?? 0;
    const hiddenTotal = data.hiddenTotalCount ?? 0;

    const totalDerived = hasSplit ? publicTotal + hiddenTotal : data.total ?? 0;
    const passedDerived = hasSplit ? publicPassed + hiddenPassed : data.passed ?? 0;
    const failedDerived = hasSplit
      ? totalDerived - passedDerived
      : data.failed ?? 0;
    const passRateDerived =
      hasSplit && totalDerived > 0
        ? (passedDerived / totalDerived) * 100
        : data.passRate ?? 0;

    return {
      id: String(data.executionId),
      sessionId: "",
      status: isTerminal ? "COMPLETED" as const : "PROCESSING" as const,
      submittedAt: new Date().toISOString(),
      readyAt: 0,
      // 합산값
      total: totalDerived,
      passed: passedDerived,
      failed: failedDerived,
      passRate: passRateDerived,
      // public/hidden 분리값 (있을 때만)
      publicPassed: hasSplit ? publicPassed : undefined,
      publicTotal: hasSplit ? publicTotal : undefined,
      hiddenPassed: hasSplit ? hiddenPassed : undefined,
      hiddenTotal: hasSplit ? hiddenTotal : undefined,
      rawStatus: data.status
    };
  }
};

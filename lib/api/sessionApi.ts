import { authClient } from "@/lib/api/authApi";
import { mockApi } from "@/lib/api/mockApi";
import { createInitialSession } from "@/lib/mock-data";
import type { TraceEvent } from "@/lib/types/ai";
import type { ProblemLanguage, SolveSession, WorkspaceFile } from "@/lib/types/session";
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
  status: "IN_PROGRESS" | "COMPLETED";
  startedAt: string;
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

type AgentTraceListPayload =
  | AgentRunTrace[]
  | {
      traces?: AgentRunTrace[];
      runs?: AgentRunTrace[];
      items?: AgentRunTrace[];
    };

const EXTERNAL_SESSION_READY_DELAY_MS = 1600;
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

const normalizeWorktreePath = (path: string) =>
  path.startsWith(WORKTREE_PREFIX) ? path : `${WORKTREE_PREFIX}${path}`;

const buildExternalSession = (
  payload: StartSessionResponse,
  userId: string,
  language: ProblemLanguage,
  aiModel: string,
  aiProvider: string
): SolveSession => {
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
    createdAt: payload.startedAt,
    lastSavedAt: payload.startedAt,
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
  new Date(iso).toLocaleTimeString("ko-KR", {
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

export const sessionApi = {
  async startSession(
    problemId: string,
    userId: string,
    language: ProblemLanguage = "java",
    aiModel = "aig-default",
    aiProvider = "default"
  ) {
    const res = await authClient.post(`api/v1/problems/${problemId}/sessions`)
      .json<ApiResponse<StartSessionResponse>>();

    const session = buildExternalSession(res.data, userId, language, aiModel, aiProvider);
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

  async getFileContent(sessionId: string, path: string) {
    const fileId = externalFileIdBySession.get(sessionId)?.get(path);
    if (!fileId) {
      return null;
    }

    let payload: GetFileContentResponse | null = null;

    try {
      const res = await authClient.get(`api/v1/sessions/${sessionId}/files/${fileId}`)
        .json<ApiResponse<GetFileContentResponse>>();
      payload = res.data;
    } catch {
      const res = await authClient.get(`api/v1/sessions/${sessionId}/files/${fileId}/content`)
        .json<ApiResponse<GetFileContentResponse>>();
      payload = res.data;
    }

    const content = payload?.content ?? "";
    const language = payload?.language?.toLowerCase() ?? inferLanguageFromPath(path);
    await mockApi.syncExternalFileContent(sessionId, path, content, language);
    return { path, content, language };
  },

  async getAgentTraces(sessionId: string) {
    const res = await authClient.get(`api/v1/sessions/${sessionId}/traces`)
      .json<ApiResponse<AgentTraceListPayload>>();

    const runs = normalizeAgentRuns(res.data);
    await mockApi.syncExternalTraces(sessionId, toSessionTraces(runs));
    return runs;
  }
};

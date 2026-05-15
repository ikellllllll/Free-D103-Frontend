import { authApi, authClient, BASE_URL, tryRefreshAccessToken, type ActiveSession } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { mockApi } from "@/lib/api/mockApi";
import { normalizeApiDateTime, parseApiDateTime } from "@/lib/dateTime";
import { createInitialSession } from "@/lib/mock-data";
import type { AiMessage, TraceEvent } from "@/lib/types/ai";
import type { ProblemLanguage, RunResult, SolveSession, TestRunResult, WorkspaceFile } from "@/lib/types/session";
import type { AgentLlmCall, AgentPatch, AgentRunTrace, AgentSpan, AgentToolCall, AgentUIState } from "@/lib/types/trace";

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
  /**
   * 세션 종료 후 AI 평가(feedback_report) 단계 (백엔드 2026-05-13~).
   * 백엔드 측 endSession 안에서 AI evaluator @Async 트리거가 추가될 때까지는
   * 항상 "PENDING" 으로 응답된다. 후속 작업 후엔 "PROCEEDING"/"GENERATED"/"FAILED" 로 전이.
   */
  reportStatus?: "PENDING" | "PROCEEDING" | "GENERATED" | "FAILED";
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
  /**
   * AI 서버 build_harness 의 compile_status (COMPLETED / PARTIAL / FAILED).
   *
   * 2026-05-13 백엔드 매핑 fix(@JsonProperty("compile_status")) 가 record 직렬화에도
   * 양방향으로 적용돼 백엔드 → 프론트 응답 키가 snake_case 그대로 나간다.
   * 따라서 클라이언트는 snake_case 와 camelCase 양쪽을 모두 받아들이도록 한다.
   * buildHarness() 응답 normalize 단계에서 compileStatus 로 통일해서 반환.
   */
  compileStatus?: "COMPLETED" | "PARTIAL" | "FAILED" | string | null;
  compile_status?: "COMPLETED" | "PARTIAL" | "FAILED" | string | null;
  validErrors?: Array<{ path?: string | null; code?: string | null; message?: string | null }> | null;
  valid_errors?: Array<{ path?: string | null; code?: string | null; message?: string | null }> | null;
  runtimeConfig?: Record<string, unknown> | null;
  runtime_config?: Record<string, unknown> | null;
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
  // 세션 하네스 파일 (AGENTS.md, prompts/, skills/, sub_agent/ 등) — 백엔드 raw path
  // 프론트는 explorer 표시 시 'agent/' prefix 를 붙여 폴더로 묶는다.
  agent?: FileTreeItemResponse[] | null;
  worktree: FileTreeItemResponse[];
}

const AGENT_PREFIX = "agent/";
// 백엔드 raw harness path (예: 'AGENTS.md', 'skills/foo/SKILL.md') → 프론트 표시 path ('agent/AGENTS.md').
const toAgentPrefixedPath = (path: string) =>
  path.startsWith(AGENT_PREFIX) ? path : `${AGENT_PREFIX}${path}`;

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
  // 백엔드 OriginType enum: DELETED | EDITED | GENERATED.
  // 이전엔 "COPIED_FROM_REAL" | "GENERATED" 로 잘못 적혀 있었음 (실제로는 EDITED 가 옴).
  // presenceStatus 는 백엔드 응답에 없음 — 잠복 리스크라 제거.
  originType?: "DELETED" | "EDITED" | "GENERATED" | null;
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

interface MoveFileResponse {
  toPath: string;
  updatedAt: string;
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

// createFile / 그 외 mutation 직렬화 큐 (#11) — concurrent createFile race 방지.
// 같은 sessionId 에 대해 mutation 이 in-flight 면 chain.
const sessionMutationQueues = new Map<string, Promise<unknown>>();
function enqueueSessionMutation<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionMutationQueues.get(sessionId) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  sessionMutationQueues.set(
    sessionId,
    next.catch(() => undefined)
  );
  return next;
}

/**
 * path → Monaco editor language ID 매핑.
 * IdeShell.tsx 의 동명 함수와 동일 규칙으로 유지 (사용자 보고: 새 파일 highlighting 누락).
 * Monaco 가 기본 지원 안 하는 toml/dockerfile 등은 시각적으로 가까운 기본 언어로 fallback.
 */
const inferLanguageFromPath = (path: string): string => {
  const lower = path.toLowerCase();
  const fileName = lower.split("/").pop() ?? lower;

  if (fileName === "dockerfile" || fileName.startsWith("dockerfile.")) return "dockerfile";
  if (fileName === "makefile") return "shell";

  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".kt") || lower.endsWith(".kts")) return "kotlin";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
    return "javascript";
  if (lower.endsWith(".py") || lower.endsWith(".pyi")) return "python";
  if (lower.endsWith(".rb")) return "ruby";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".php")) return "php";
  if (lower.endsWith(".sh") || lower.endsWith(".bash") || lower.endsWith(".zsh")) return "shell";
  if (lower.endsWith(".ps1")) return "powershell";
  if (lower.endsWith(".md") || lower.endsWith(".mdx") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  // toml/ini/conf/cfg — Monaco 기본 미지원 toml 은 ini 가 시각적으로 가장 가까움.
  if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".conf") || lower.endsWith(".cfg"))
    return "ini";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".scss")) return "scss";
  if (lower.endsWith(".less")) return "less";
  if (lower.endsWith(".properties")) return "properties";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".gradle") || lower.endsWith(".groovy")) return "groovy";
  if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".cxx") || lower.endsWith(".hpp"))
    return "cpp";
  if (lower.endsWith(".c") || lower.endsWith(".h")) return "c";

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
// 백엔드는 src/main/java/, src/test/java/ 풀 경로를 사용하지만 프론트는 src/ 로 단축한다 (mockApi.normalizeWorkspaceFiles 와 동일 규칙).
// fileId 매핑도 같은 단축 경로를 키로 써야 클릭한 파일을 GET /files/{fileId} 로 매핑할 수 있다.
const normalizeBackendPath = (path: string) =>
  path.replace(/^src\/main\/java\//, "src/").replace(/^src\/test\/java\//, "src/");
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

const buildSessionStubFromActive = (item: ActiveSession): SolveSession => {
  // /users/me/sessions/active 응답 → SolveSession 최소 스텁.
  // files/messages/traces 는 IdeShell 의 workspace/agentTraces 쿼리가 별도로 채움.
  // problemId 가 있어야 problem 쿼리가 enable 되므로 반드시 채워야 한다.
  const language: ProblemLanguage = item.language === "PYTHON" ? "python" : "java";
  const authUserId = useAuthStore.getState().user?.id ?? "";
  return {
    id: String(item.problemSessionId),
    workspaceId: `ws-${item.problemSessionId}`,
    problemId: String(item.problemId),
    userId: String(authUserId),
    language,
    status: "IN_PROGRESS",
    aiRequestCount: 0,
    lastSavedAt: item.startedAt,
    createdAt: item.startedAt,
    readyAt: Date.now(),
    files: [],
    messages: [],
    traces: [],
    aiModel: "aig-default",
    aiProvider: "default"
  };
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
      // src/main/java 경로 단축 + 원본 경로 둘 다 등록 (어느 쪽으로 lookup 와도 매칭)
      const normalized = normalizeBackendPath(item.path);
      mapping.set(item.path, item.fileId);
      if (normalized !== item.path) {
        mapping.set(normalized, item.fileId);
      }
    }
  });

  // 세션 하네스 파일은 raw path + prefixed path 둘 다 등록 (어느 쪽으로 lookup 와도 매칭)
  (payload.agent ?? []).forEach((item) => {
    if (item.nodeType === "FILE") {
      const prefixed = toAgentPrefixedPath(item.path);
      mapping.set(item.path, item.fileId);
      mapping.set(prefixed, item.fileId);
    }
  });

  payload.worktree.forEach((item) => {
    if (item.nodeType === "FILE") {
      mapping.set(normalizeWorktreePath(item.path), item.fileId);
    }
  });

  externalFileIdBySession.set(sessionId, mapping);
};

/**
 * 백엔드 응답에 swagger 예시값 (`path="string"` / `name="string"`) 같은 placeholder noise 가
 * 섞여 들어오는 케이스를 방어. path 가 비어있거나 "string" 같은 placeholder 면 트리에서 제외.
 * (실제 사례: GET /sessions/{id}/files 응답에 nodeType=DIRECTORY + path="string" + name="string"
 *  인 항목이 섞여 나옴 — 백엔드 OpenAPI 예시 직렬화 흔적.)
 */
const isNoisePathItem = (item: FileTreeItemResponse): boolean => {
  const path = (item.path ?? "").trim();
  const name = (item.name ?? "").trim();
  if (!path) return true;
  if (path === "string" && (name === "string" || !name)) return true;
  return false;
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
    .filter((item) => item.nodeType === "FILE" && !isNoisePathItem(item))
    .map((item) => {
      const content = existingContent.get(item.path) ?? "";
      sourceContent.set(item.path, content);

      return {
        path: item.path,
        language: item.language?.toLowerCase() || inferLanguageFromPath(item.path),
        content
      } satisfies WorkspaceFile;
    });

  // 세션 하네스 파일 — raw path 에 'agent/' prefix 를 붙여 explorer 에서 한 폴더로 묶는다.
  const agentFiles = (payload.agent ?? [])
    .filter((item) => item.nodeType === "FILE" && !isNoisePathItem(item))
    .map((item) => {
      const nextPath = toAgentPrefixedPath(item.path);
      return {
        path: nextPath,
        language: item.language?.toLowerCase() || inferLanguageFromPath(item.path),
        content: existingContent.get(nextPath) ?? ""
      } satisfies WorkspaceFile;
    });

  const worktreeFiles = payload.worktree
    .filter((item) => item.nodeType === "FILE" && !isNoisePathItem(item))
    .map((item) => {
      const nextPath = normalizeWorktreePath(item.path);
      const sourcePath = item.path.replace(/^\.worktree\//, "");

      return {
        path: nextPath,
        language: item.language?.toLowerCase() || inferLanguageFromPath(item.path),
        content: existingContent.get(nextPath) ?? sourceContent.get(sourcePath) ?? ""
      } satisfies WorkspaceFile;
    });

  return [...sourceFiles, ...agentFiles, ...worktreeFiles];
};

const formatTraceTime = (iso: string) =>
  (parseApiDateTime(iso) ?? new Date(iso)).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

const normalizeToolCalls = (calls: AgentToolCall[] | null | undefined): AgentToolCall[] =>
  (calls ?? []).map((call, index) => {
    // 백엔드는 argsPreview / resultPreview 로 응답. 옛 코드 호환 위해 argsJson 에도 같은 값 미러.
    const rawArgs = (call as unknown as { argsPreview?: Record<string, unknown> | null }).argsPreview
      ?? call?.argsJson
      ?? null;
    const rawResult = (call as unknown as { resultPreview?: Record<string, unknown> | null }).resultPreview ?? null;
    return {
      toolCallId: String(call?.toolCallId ?? `tool-${index + 1}`),
      toolName: String(call?.toolName ?? "tool"),
      argsJson: rawArgs,
      argsPreview: rawArgs,
      resultPreview: rawResult,
      durationMs: call?.durationMs ?? null,
      status: call?.status ?? "COMPLETED",
      exitCode: (call as unknown as { exitCode?: number | null }).exitCode ?? null
    };
  });

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
    spans: normalizeSpans(run?.spans),
    // backend 의 trace 목록 응답에는 spans 배열은 없고 totalSpanCount(int) 만 있음.
    // detail 호출 전까지 trace 항목에 "N spans" 표시하려면 이 필드를 그대로 들고 있어야 한다.
    totalSpanCount: Number(run?.totalSpanCount ?? 0)
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

const toTestRunResult = (payload: GetExecutionResultResponse): TestRunResult => {
  // 빌드/컴파일 실패 추정: 백엔드가 COMPLETED 로 와도 total/passed/failed 가 0 이고 stderr 가 있으면
  // 사실상 컴파일 안 됐다는 뜻 — UI 에서 "0/0 통과" 대신 "빌드 실패 + stderr" 로 노출하기 위한 flag.
  const noTestsRun = payload.total === 0 && payload.passed === 0 && payload.failed === 0;
  const hasStderr = !!(payload.stderr && payload.stderr.trim());
  const buildFailed = noTestsRun && hasStderr;
  return {
    total: payload.total,
    passed: payload.passed,
    failed: payload.failed,
    results: payload.results.map((item, index) => ({
      id: `${payload.executionId}-${index}`,
      name: item.testName || `Test ${index + 1}`,
      status: normalizeTestStatus(item.status),
      time: item.durationMs == null ? "-" : `${item.durationMs}ms`,
      detail: item.message ?? undefined
    })),
    buildFailed,
    buildStderr: hasStderr ? payload.stderr : null,
    // stderr 는 buildFailed 여부와 무관하게 항상 채움 — 일반 실패에서도 사용자가 원인 파악 가능하도록.
    // (이전엔 buildFailed 가 아닐 때 stderr 가 UI 에 노출되지 않아 "왜 실패했는지 모르겠다" 라는 피드백이 있었음.)
    stderr: hasStderr ? payload.stderr : null,
    rawStatus: payload.status
  };
};

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

  /**
   * 세션 메타데이터 조회 (deep-link / 다른 브라우저 / localStorage 클리어 대응).
   *
   * 백엔드에는 `GET /api/v1/sessions/{id}` 단일 조회 엔드포인트가 없고, 프론트는 startSession
   * 응답을 mockDb 에 캐싱해서 후속 페이지에서 재사용한다. 그러나 다음 케이스에서 mockDb 에
   * entry 가 없을 수 있다.
   *   1. 다른 브라우저/탭에서 startSession 했고 사용자가 현재 브라우저로 deep-link 진입
   *   2. localStorage 가 클리어된 직후 새로고침
   *   3. 시크릿 모드 / 캐시 무효 환경에서 직접 URL 입력
   * 이 때 mockApi.getSession 이 throw → useQuery 가 isLoading 으로 영원히 머묾 → IDE
   * 가 "코드 한 줄도 안 보임" 상태. (#사고: 2026-05-14 세션 236 화면 stale 의 더 깊은 원인 후보)
   *
   * 해결: 활성 세션 목록 (`/users/me/sessions/active`) 에서 매칭되는 항목을 찾아 SolveSession
   * 스텁으로 mockDb 에 등록. files/messages/traces 는 후속 workspace/trace 쿼리가 채운다.
   * 활성 목록에도 없으면 ENDED/EXPIRED 로 보고 원래 에러를 그대로 던진다 (호출자가 fallback UI).
   */
  async getOrHydrateSession(sessionId: string): Promise<SolveSession> {
    try {
      return await mockApi.getSession(sessionId);
    } catch (notFoundError) {
      if (!isBackendSessionId(sessionId)) throw notFoundError;
      try {
        const active = await authApi.getActiveSessions();
        const found = active.find((s) => String(s.problemSessionId) === sessionId);
        if (!found) throw notFoundError;
        const stub = buildSessionStubFromActive(found);
        await mockApi.registerExternalSession(stub);
        return stub;
      } catch (hydrateError) {
        // active 조회 실패 시 (네트워크/401) 도 원래 not-found 그대로. 호출자가 보여줄 메시지.
        throw notFoundError;
      }
    }
  },

  async getWorkspace(sessionId: string) {
    // getWorkspace 도 mockDb 의존 — 같은 hydrate 보장.
    const existingSession = await this.getOrHydrateSession(sessionId);
    const res = await authClient.get(`api/v1/sessions/${sessionId}/files`)
      .json<ApiResponse<GetFileTreeResponse>>();

    const files = toWorkspaceFiles(sessionId, res.data, existingSession.files);
    return mockApi.syncExternalWorkspace(sessionId, files);
  },

  async createFile(sessionId: string, input: CreateFileRequest) {
    // 같은 세션의 mutation 이 직렬화되도록 큐에 삽입 (#11) — POST → getWorkspace 사이에 다른 mutation 끼어들기 방지.
    return enqueueSessionMutation(sessionId, async () => {
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
    });
  },

  async getWorktreeFileContent(sessionId: string, worktreeFileId: number) {
    // ⚠️ silent failure 시 throw — 호출 측 (getFileContent) 의 catch 가 loadedBackendFilesRef 에서 path 를 제거해서
    // 다음에 retry 가능하도록 함. 이전엔 null 반환 + 빈 content cache 로 영구 빈 파일로 보였음 (#12).
    const res = await authClient.get(`api/v1/sessions/${sessionId}/worktrees/${worktreeFileId}`)
      .json<ApiResponse<GetWorktreeFileResponse>>();
    return res.data as GetFileContentResponse;
  },

  async getFileContent(sessionId: string, path: string) {
    const fileId = externalFileIdBySession.get(sessionId)?.get(path);
    if (!fileId) {
      return null;
    }

    let payload: GetFileContentResponse | null = null;

    if (path.startsWith(WORKTREE_PREFIX)) {
      payload = await this.getWorktreeFileContent(sessionId, fileId);
    } else if (path.startsWith(AGENT_PREFIX)) {
      // SessionHarnessFile — 별도 endpoint (2026-05-09~). 백엔드가 단수→복수로 통일 (2026-05-11~).
      try {
        const res = await authClient.get(`api/v1/sessions/${sessionId}/harness/${fileId}`)
          .json<ApiResponse<GetFileContentResponse>>();
        payload = res.data;
      } catch {
        payload = null;
      }
    } else {
      // 일반 SessionFile — GET /sessions/{id}/files/{fileId} 단일 경로.
      // 과거에 /files/{fileId}/content fallback 이 있었으나 백엔드엔 그 GET 경로가 없음 (PATCH 만) — 항상 404 → 제거.
      try {
        const res = await authClient.get(`api/v1/sessions/${sessionId}/files/${fileId}`)
          .json<ApiResponse<GetFileContentResponse>>();
        payload = res.data;
      } catch {
        payload = null;
      }
    }

    const content = payload?.content ?? "";
    const language = payload?.language?.toLowerCase() ?? inferLanguageFromPath(path);
    await mockApi.syncExternalFileContent(sessionId, path, content, language);
    return { path, content, language };
  },

  async getAgentTraces(sessionId: string) {
    // ⚠️ 백엔드 세션은 mockApi fallback 절대 금지.
    // mock 의 user-sort 패치 (`starter/src/main/java/...`) 가 explorerFiles 에 가짜 worktree 파일로 inject 되어,
    // localStorage editorLayout 에 저장된 diff 탭이 활성 상태로 복원되면 effect 가 activePath 를 mock sourcePath ↔ real README 로 무한 토글 → React #185.
    try {
      const result = await this.getAgentTraceList(sessionId, 1, 10);
      if (result.runs.length === 0) return [];
      const hydratedRuns = await Promise.all(
        result.runs.map(async (run) => {
          const hasPatchSummary = run.spans.some((span) => span.patches.length > 0);
          if (hasPatchSummary) return run;

          try {
            return await this.getAgentTraceDetail(sessionId, run.agentTraceId);
          } catch {
            return run;
          }
        })
      );
      await mockApi.syncExternalTraces(sessionId, toSessionTraces(hydratedRuns));
      return hydratedRuns;
    } catch {
      return [];
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
      // 백엔드 호출 실패 시 mockApi 폴백 금지 — 일시적 장애에 가짜 trace 가 inject 되는 누수 패턴 (worktree 누수 #75481de 와 동일).
      const empty: AgentTraceListResult = {
        runs: [],
        totalCount: 0,
        page,
        size,
        totalPages: 1,
        hasNext: false
      };
      return empty;
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
    } catch (error) {
      // mockApi 폴백 금지 — 위 getAgentTraceList 와 동일 사유.
      // React Query 가 isError 로 처리하도록 그대로 throw.
      throw error;
    }
  },

  async getChatMessages(sessionId: string): Promise<AiMessage[]> {
    try {
      const res = await authClient
        .get(`api/v1/ai/sessions/${sessionId}/messages`)
        .json<ApiResponse<{ messages: Array<{
          agentSessionMsgId: number;
          msgKind: "AI" | "HUMAN";
          content: string;
          createdAt: string;
          /** "CHAT" | "AGENT" — 백엔드 2026-05-13~ chat/agent union 조회 후 origin 필드 추가됨.
           *  두 테이블 PK 시퀀스가 별도라 React unique key 충돌 회피용으로 origin 을 prefix 한다. */
          origin?: "CHAT" | "AGENT";
        }> }>>();

      const messages = res.data?.messages ?? [];
      // 백엔드가 정상 응답한 경우 (빈 배열 포함) 그대로 반환 — 신규 세션의 mock 시드 채팅 누설 방지
      return messages.map((m) => ({
        id: `${m.origin ?? "AGENT"}-${m.agentSessionMsgId}`,
        role: m.msgKind === "HUMAN" ? "user" : "assistant",
        content: m.content,
        createdAt: m.createdAt,
        // AI Pair 패널이 Chat/Agent 토글에 맞춰 이 origin 으로 필터링한다.
        origin: m.origin ?? "AGENT"
      }));
    } catch {
      // mockApi 폴백 금지 — 일시적 장애에 가짜 시드 채팅 누설 방지.
      return [];
    }
  },

  async saveFile(sessionId: string, input: SaveFileRequest) {
    const fileId = await resolveRememberedFileId(sessionId, input.path);
    if (!fileId) {
      throw new Error("저장할 파일 정보를 찾지 못했습니다.");
    }

    const language = input.language ?? toSessionFileLanguage(input.path) ?? inferLanguageFromPath(input.path);

    // agent/* 경로는 SessionHarnessFile — 별도 endpoint (2026-05-09~).
    // 그 외는 기존 SessionFile endpoint.
    // 백엔드가 단수→복수로 통일됨 (2026-05-11~) — 둘 다 `/sessions` (복수).
    const isHarnessFile = input.path.startsWith(AGENT_PREFIX);
    const url = isHarnessFile
      ? `api/v1/sessions/${sessionId}/harness/${fileId}/content`
      : `api/v1/sessions/${sessionId}/files/${fileId}/content`;

    await authClient.patch(url, {
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

    // 백엔드가 record + @JsonProperty 양방향 매핑으로 snake_case 키 그대로 응답함.
    // 호출자는 camelCase 로만 접근 가능하도록 여기서 한 번 normalize.
    const raw = res.data ?? {};
    const normalized: HarnessBuildResponse = {
      compileStatus: raw.compileStatus ?? raw.compile_status ?? null,
      validErrors: raw.validErrors ?? raw.valid_errors ?? [],
      runtimeConfig: raw.runtimeConfig ?? raw.runtime_config ?? null
    };
    return normalized;
  },

  /**
   * Agent 실행 UI 상태 조회 — GET /api/v1/ai/sessions/{sid}/agent/runs/{traceId}/ui-state (2026-05-13~).
   * 응답: { status, focus(path/line/column), changedFileCount, changedFiles[] }.
   *  - RUNNING 일 때: focus 가 현재 agent 가 작업 중인 파일/줄. follow-along UI 에 사용.
   *  - COMPLETED/FAILED 일 때: changedFiles 가 최종 변경 리스트 + diff stats + review_status.
   * 진행 중 trace 면 1-2초 폴링, 종료 trace 면 한 번만 호출.
   */
  async getAgentUIState(sessionId: string, agentTraceId: string | number): Promise<AgentUIState | null> {
    // 일부 trace 는 AI 서버에 ui-state 데이터 없음 → 백엔드가 400/404 반환. 빨간 콘솔 줄 안 뜨도록
    // ky 의 throwHttpErrors 끄고 status 직접 체크.
    try {
      const res = await authClient
        .get(`api/v1/ai/sessions/${sessionId}/agent/runs/${agentTraceId}/ui-state`, {
          throwHttpErrors: false
        });
      if (!res.ok) return null;
      const body = await res.json<ApiResponse<AgentUIState>>();
      return body.data ?? null;
    } catch {
      // 네트워크 에러 등 — null 반환.
      return null;
    }
  },

  /**
   * 세션 하네스 파일 생성 — POST /api/v1/sessions/{id}/harness (2026-05-11~).
   * body: { path, name, nodeType: FILE|DIRECTORY, fileType: INSTRUCTION|SKILL|MEMORY|RULE|OTHER, content? }
   */
  async addHarnessFile(sessionId: string, input: {
    path: string;
    name: string;
    nodeType: "FILE" | "DIRECTORY";
    fileType: string;          // HarnessFileType enum 값 (백엔드와 정합)
    content?: string;
  }) {
    const res = await authClient
      .post(`api/v1/sessions/${sessionId}/harness`, {
        json: input
      })
      .json<ApiResponse<{
        sessionHarnessFileId: number;
        path: string;
        name: string;
        fileType: string;
        nodeType: "FILE" | "DIRECTORY";
        content: string;
        sizeBytes: number;
        createdAt: string;
      }>>();

    return res.data;
  },

  /**
   * 파일 / 하네스 파일 삭제 — DELETE (2026-05-12~).
   * - 일반 SessionFile: DELETE /api/v1/sessions/{sessionId}/files/{fileId}
   * - SessionHarnessFile (agent/* prefix): DELETE /api/v1/sessions/{sessionId}/harness/{fileId}
   *
   * UI 는 path 만 들고 있으므로 path 보고 endpoint 분기 + fileId 매핑은 내부에서.
   */
  async deleteFile(sessionId: string, path: string): Promise<void> {
    const fileId = await resolveRememberedFileId(sessionId, path);
    if (!fileId) {
      throw new Error("삭제할 파일 정보를 찾지 못했습니다. 워크스페이스를 새로고침해 주세요.");
    }
    const url = path.startsWith(AGENT_PREFIX)
      ? `api/v1/sessions/${sessionId}/harness/${fileId}`
      : `api/v1/sessions/${sessionId}/files/${fileId}`;
    await authClient.delete(url);
  },

  /**
   * 파일 / 하네스 파일 이동 (rename + path 변경) — PATCH (2026-05-12~).
   * - 일반 SessionFile: PATCH /api/v1/sessions/{sessionId}/files/{fileId}/path
   * - SessionHarnessFile: PATCH /api/v1/sessions/{sessionId}/harness/{fileId}/path
   * body: { toPath: string }
   *
   * agent/* prefix 는 백엔드 path 에서 stripping (서버는 agent prefix 없이 저장됨).
   */
  async moveFile(sessionId: string, fromPath: string, toPath: string): Promise<void> {
    const fileId = await resolveRememberedFileId(sessionId, fromPath);
    if (!fileId) {
      throw new Error("이동할 파일 정보를 찾지 못했습니다. 워크스페이스를 새로고침해 주세요.");
    }
    const isHarness = fromPath.startsWith(AGENT_PREFIX);
    const url = isHarness
      ? `api/v1/sessions/${sessionId}/harness/${fileId}/path`
      : `api/v1/sessions/${sessionId}/files/${fileId}/path`;
    // 하네스 파일이면 toPath 의 agent/ prefix 제거 (백엔드는 raw path 저장)
    const backendToPath = isHarness && toPath.startsWith(AGENT_PREFIX)
      ? toPath.slice(AGENT_PREFIX.length)
      : toPath;
    await authClient.patch(url, { json: { toPath: backendToPath } });
  },

  /**
   * AI 부분 수정 승인 또는 거절 — POST /api/v1/ai/sessions/{id}/chat/edit?isApproved={t|f} (2026-05-11~).
   * body: { originFileId, worktreeFileId }.
   *
   * 사용처는 worktree path (`.worktree/src/...`) 만 들고 있으므로 path → fileId 매핑은 내부에서 처리.
   * - worktreeFileId = lookup(`.worktree/src/...`)        → AgentWorktreeFile.worktreeFileId
   * - originFileId   = lookup(`src/...`)                  → SessionFile.fileId
   */
  async partialEdit(sessionId: string, input: {
    worktreePath: string;          // ".worktree/src/..."
    isApproved: boolean;
  }) {
    const worktreePath = input.worktreePath.startsWith(WORKTREE_PREFIX)
      ? input.worktreePath
      : `${WORKTREE_PREFIX}${input.worktreePath}`;
    const sourcePath = worktreePath.slice(WORKTREE_PREFIX.length);

    const worktreeFileId = await resolveRememberedFileId(sessionId, worktreePath);
    if (!worktreeFileId) {
      throw new Error("적용할 worktree 파일을 찾지 못했습니다. 워크스페이스를 새로고침해 주세요.");
    }
    // originFileId 는 EDITED / DELETED 케이스에서만 매칭되고, GENERATED (새 파일) 케이스에선
    // src/ 에 origin 이 없는 게 정상. 백엔드 validateOriginFileId 가 originType==GENERATED 면
    // originFileId 가 null 이어야 한다고 강제하므로 lookup 실패 시 null 로 보내고 호출.
    const originFileId = await resolveRememberedFileId(sessionId, sourcePath);

    await authClient.post(`api/v1/ai/sessions/${sessionId}/chat/edit`, {
      json: { originFileId: originFileId ?? null, worktreeFileId },
      searchParams: { isApproved: String(input.isApproved) }
    });
  },

  /**
   * AI 전체 수정 승인/거절 — POST /api/v1/ai/sessions/{id}/chat/edit-all?isApproved={t|f} (2026-05-12~).
   * body: { worktreeFileIds: number[] }.
   *
   * worktree path 목록(`.worktree/src/...` 등) 을 받아서 fileId 배열로 변환 후 호출.
   * 한 번에 여러 파일을 일괄 승인/거절할 때 사용.
   */
  async allEdit(sessionId: string, input: {
    worktreePaths: string[];     // [".worktree/src/...", ...]
    isApproved: boolean;
  }) {
    const ids: number[] = [];
    for (const raw of input.worktreePaths) {
      const path = raw.startsWith(WORKTREE_PREFIX) ? raw : `${WORKTREE_PREFIX}${raw}`;
      const id = await resolveRememberedFileId(sessionId, path);
      if (id) ids.push(id);
    }
    if (ids.length === 0) {
      throw new Error("적용할 파일 정보를 찾지 못했습니다. 워크스페이스를 새로고침해 주세요.");
    }
    await authClient.post(`api/v1/ai/sessions/${sessionId}/chat/edit-all`, {
      json: { worktreeFileIds: ids },
      searchParams: { isApproved: String(input.isApproved) }
    });
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
   * 리포트 생성 상태 조회 — GET /api/v1/sessions/{problemSessionId}/report-status (2026-05-14~).
   * 백엔드 SessionController#getFeedbackStatus → FeedbackStatusResponse { reportStatus }.
   *
   * /reports 페이지의 pending 마커 polling 에서 사용. 백엔드가 실제 enum (PENDING/PROCEEDING/
   * GENERATED/FAILED) 을 노출하므로 GENERATED 즉시 마커 제거, FAILED 즉시 표기 — 이전엔
   * GET /users/me/reports 가 GENERATED 만 응답한다는 가정 하에 5분 클라이언트 timeout 으로
   * FAILED 를 추정하던 우회를 대체.
   */
  async getReportStatus(problemSessionId: string | number) {
    const res = await authClient
      .get(`api/v1/sessions/${problemSessionId}/report-status`)
      .json<
        ApiResponse<{ reportStatus: "PENDING" | "PROCEEDING" | "GENERATED" | "FAILED" }>
      >();
    return res.data.reportStatus;
  },

  /**
   * 리포트 재생성 요청 — POST /api/v1/sessions/{problemSessionId}/report-retry (2026-05-15~ 확인).
   * 백엔드 SessionController#retryReport, reportStatus=FAILED 인 세션만 허용.
   * 응답: { problemSessionId } — feedbackReportId 는 포함 안 됨, 폴링으로 별도 확인.
   *
   * 기존엔 endSession (POST /sessions/{id}/end) 재호출로 우회 처리했으나 정식 endpoint 가 있어 교체.
   */
  async retryReport(problemSessionId: string | number) {
    const res = await authClient
      .post(`api/v1/sessions/${problemSessionId}/report-retry`)
      .json<ApiResponse<{ problemSessionId: number }>>();
    return res.data;
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

    const doFetch = (accessToken: string) =>
      fetch(`${BASE_URL}/api/v1/ai/sessions/${sessionId}/chat/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify(body),
        signal
      });

    let res = await doFetch(tokens.accessToken);
    // 토큰 만료 시 자동 갱신 후 한 번만 재시도 (refresh token 도 죽었으면 signOut + throw)
    if (res.status === 401) {
      const refreshed = await tryRefreshAccessToken();
      if (!refreshed) {
        throw new Error("세션이 만료됐습니다. 다시 로그인해주세요.");
      }
      res = await doFetch(refreshed.accessToken);
    }

    if (!res.ok) {
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
      // event:end / event:error / 에러 throw 로 빠져나갈 때 reader.releaseLock() 만 하면 백엔드는
      // 클라이언트가 끊은 줄 모르고 한참 더 스트리밍 시도 (소켓 잡고 있음). 명시적 cancel() 로 신호.
      // cancel() 은 자동으로 lock 도 풀지만, race 가능성 있어 release 한 번 더 시도.
      try { await reader.cancel(); } catch { /* already cancelled / locked elsewhere */ }
      try { reader.releaseLock(); } catch { /* already released by cancel */ }
    }
  },

  /**
   * Agent (DeepAgent) 실행 SSE streaming.
   * 백엔드: POST /api/v1/ai/sessions/{id}/agent-runs (text/event-stream).
   * 백엔드가 AI 서비스의 NDJSON stream 을 SSE 로 변환해 relay.
   * 응답 프레임: event 타입별로 분기 (RUN/LLM/TOOL/VFS) — 백엔드 AgentRelayEventMapper 참고.
   * 사전조건: 세션 IN_PROGRESS + sessionHarness 빌드 완료. 미빌드면 400 ("AGENT가 빌드되지 않은 상태").
   */
  async streamAgentChat(
    sessionId: string,
    payload: { message: string },
    handlers: {
      onMetadata?: (data: Record<string, unknown>) => void;
      onEvent: (eventName: string, data: Record<string, unknown>) => void;
      onEnd?: () => void;
      onError?: (code: string, message: string) => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const { tokens } = useAuthStore.getState();
    if (!tokens?.accessToken) {
      throw new Error("로그인이 필요합니다.");
    }

    const doFetch = (accessToken: string) =>
      fetch(`${BASE_URL}/api/v1/ai/sessions/${sessionId}/agent-runs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify({ message: payload.message }),
        signal
      });

    let res = await doFetch(tokens.accessToken);
    if (res.status === 401) {
      const refreshed = await tryRefreshAccessToken();
      if (!refreshed) {
        throw new Error("세션이 만료됐습니다. 다시 로그인해주세요.");
      }
      res = await doFetch(refreshed.accessToken);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Agent 실행 실패 (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    if (!res.body) {
      throw new Error("Agent 스트림 응답 본문이 없습니다.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

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
          } else if (eventName === "end") {
            handlers.onEnd?.();
            return;
          } else if (eventName === "error") {
            const code = typeof parsed?.code === "string" ? parsed.code : "AGENT_ERROR";
            const message =
              typeof parsed?.message === "string" ? parsed.message : "Agent 실행 중 오류가 발생했습니다.";
            handlers.onError?.(code, message);
            return;
          } else {
            handlers.onEvent(eventName, parsed);
          }
        }
      }
    } finally {
      // streamChat 과 동일 — 명시적 cancel() 로 백엔드에 종료 통지.
      try { await reader.cancel(); } catch { /* already cancelled */ }
      try { reader.releaseLock(); } catch { /* already released */ }
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

    // Terminal (COMPLETED/FAILED) 도달 시 추가로 /executions/{id}/results 호출해서 stdout/stderr/exitCode 합침.
    // 제출 결과 응답엔 컴파일/런타임 에러 텍스트가 없어서, 빌드 실패 케이스에 사용자가 원인 파악 불가했음.
    // RUNNING 중에는 호출 안 함 (제출 폴링 1.2초마다 도는데 매 tick 마다 두 번 호출하면 백엔드 부담).
    let stderr: string | null = null;
    let stdout: string | null = null;
    let exitCode: number | null = null;
    if (isTerminal) {
      try {
        const execRes = await this.getExecutionResult(String(data.executionId));
        stderr = execRes?.stderr ?? null;
        stdout = execRes?.stdout ?? null;
        exitCode = typeof execRes?.exitCode === "number" ? execRes.exitCode : null;
      } catch {
        /* /results 호출 실패해도 메인 응답은 정상 반환 — stderr 만 null */
      }
    }

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
      rawStatus: data.status,
      // 빌드/런타임 에러 메시지 — buildFailed 판정 + UI 노출에 사용.
      stdout,
      stderr,
      exitCode
    };
  }
};

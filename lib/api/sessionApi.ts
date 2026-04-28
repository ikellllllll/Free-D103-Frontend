import { authClient } from "@/lib/api/authApi";
import { mockApi } from "@/lib/api/mockApi";
import { createInitialSession } from "@/lib/mock-data";
import type { ProblemLanguage, SolveSession, WorkspaceFile } from "@/lib/types/session";

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

const EXTERNAL_SESSION_READY_DELAY_MS = 1600;
const WORKTREE_PREFIX = ".worktree/";

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

const toWorkspaceFiles = (payload: GetFileTreeResponse, existingFiles: WorkspaceFile[] = []): WorkspaceFile[] => {
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

    const files = toWorkspaceFiles(res.data, existingSession.files);
    return mockApi.syncExternalWorkspace(sessionId, files);
  }
};

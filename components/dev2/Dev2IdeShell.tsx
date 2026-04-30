"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Play,
  Send,
  Code2,
  GitBranch,
  TestTube,
  Bot,
  FolderTree,
  Search,
  Plus,
  Command,
  Sun,
  Moon,
  Wrench,
  Check,
  ChevronRight,
  ChevronDown,
  Paperclip,
  Slash,
  Mic,
  AlertCircle,
  ExternalLink,
  Filter,
  SlidersHorizontal,
  X,
  Clock,
  Trash2,
  SplitSquareVertical,
  ListChecks,
  Loader2,
  Network,
  type LucideIcon
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useAiChat } from "@/hooks/useAiChat";
import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import { getProblemById } from "@/lib/mock-data";
import { useIdeStore, type SelectionRange } from "@/store/ideStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";
import type { AiMessage, TraceEvent } from "@/lib/types/ai";
import type { ProblemDetail as ProblemDetailType } from "@/lib/types/problem";
import type { WorkspaceFile } from "@/lib/types/session";
import type { AgentRunTrace } from "@/lib/types/trace";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  { ssr: false }
);

const MonacoDiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  { ssr: false }
);

/* ───────────────────────────────────────────────── Types + Helpers */

type TabKey = "code" | "problem" | "trace";
type RailKey = "files" | "problem" | "trace" | "tests" | "ai" | "harness";
type BottomTabKey = "terminal" | "tests" | "problems" | "output";
type DragMode = "sidebar" | "ai" | "bottom";

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

const DIFF_TAB_PREFIX = "diff:";
const isDiffTabId = (value: string) => value.startsWith(DIFF_TAB_PREFIX);
const createDiffTabId = (path: string) => `${DIFF_TAB_PREFIX}${path}`;
const getWorktreeSourcePath = (path: string) => path.replace(/^\.worktree\//, "src/");
const getFileName = (path: string) => path.split("/").pop() ?? path;
const clampNum = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface TreeFolder {
  kind: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}
interface TreeFile {
  kind: "file";
  name: string;
  path: string;
  file: WorkspaceFile;
}
type TreeNode = TreeFolder | TreeFile;

/* ───────────────────────────────────────────────── Helpers */

function buildFileTree(files: WorkspaceFile[], filter = ""): TreeNode[] {
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? files.filter((f) => f.path.toLowerCase().includes(q))
    : files;
  const root: TreeFolder = { kind: "folder", name: "", path: "", children: [] };

  for (const file of filtered) {
    const parts = file.path.split("/").filter(Boolean);
    let cursor: TreeFolder = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/");
      let next = cursor.children.find(
        (c): c is TreeFolder => c.kind === "folder" && c.name === name
      );
      if (!next) {
        next = { kind: "folder", name, path: folderPath, children: [] };
        cursor.children.push(next);
      }
      cursor = next;
    }
    const leafName = parts[parts.length - 1];
    cursor.children.push({ kind: "file", name: leafName, path: file.path, file });
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    const rootFolderOrder: Record<string, number> = {
      src: 0,
      agent: 1,
      starter: 2,
      ".worktree": 3
    };
    const getRootFolderRank = (node: TreeFolder) =>
      node.path && !node.path.includes("/") ? rootFolderOrder[node.name] ?? 99 : 99;
    const folders = nodes
      .filter((n): n is TreeFolder => n.kind === "folder")
      .sort((a, b) => {
        const rankDiff = getRootFolderRank(a) - getRootFolderRank(b);
        return rankDiff || a.name.localeCompare(b.name);
      })
      .map((f) => ({ ...f, children: sortNodes(f.children) }));
    const leafs = nodes
      .filter((n): n is TreeFile => n.kind === "file")
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...leafs];
  };

  return sortNodes(root.children);
}

function isAgentConfigFile(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  const name = normalized.split("/").pop() ?? normalized;
  const isMd = name.endsWith(".md") || name.endsWith(".mdx");

  return (
    normalized.startsWith("agent/") ||
    normalized.startsWith("agents/") ||
    normalized.startsWith(".agents/") ||
    normalized.startsWith("skills/") ||
    normalized.includes("/skills/") ||
    name === "agents.md" ||
    name === "agent.md" ||
    name === "harness.md" ||
    (isMd && /(instruction|instructions|prompt|skill|harness)/.test(name))
  );
}

function deriveBadge(file: WorkspaceFile):
  | { letter: "H"; tint: string }
  | { letter: "M"; tint: string }
  | { letter: "J"; tint: string }
  | { letter: "P"; tint: string }
  | { letter: "X"; tint: string }
  | { letter: "Y"; tint: string }
  | { letter: "T"; tint: string } {
  const name = file.path.split("/").pop()?.toLowerCase() ?? "";
  if (name === "harness.md") return { letter: "H", tint: "bg-indigo-100 text-indigo-700" };
  if (name.endsWith(".md")) return { letter: "M", tint: "bg-slate-100 text-slate-600" };
  if (name.endsWith(".java")) return { letter: "J", tint: "bg-orange-100 text-orange-700" };
  if (name.endsWith(".py")) return { letter: "P", tint: "bg-emerald-100 text-emerald-700" };
  if (name.endsWith(".xml")) return { letter: "X", tint: "bg-amber-100 text-amber-700" };
  if (name.endsWith(".yml") || name.endsWith(".yaml"))
    return { letter: "Y", tint: "bg-teal-100 text-teal-700" };
  return { letter: "T", tint: "bg-gray-100 text-gray-600" };
}

function formatRelativeSeconds(iso: string | null): string {
  if (!iso) return "자동 저장 대기";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "방금 저장됨";
  if (diff < 60) return `${Math.round(diff)}초 전 저장됨`;
  if (diff < 3600) return `${Math.round(diff / 60)}분 전 저장됨`;
  return `${Math.round(diff / 3600)}시간 전 저장됨`;
}

function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function languageFromFile(file: WorkspaceFile | null): string {
  if (!file) return "plaintext";
  const p = file.path.toLowerCase();
  if (p.endsWith(".java")) return "java";
  if (p.endsWith(".py")) return "python";
  if (p.endsWith(".md")) return "markdown";
  if (p.endsWith(".xml")) return "xml";
  if (p.endsWith(".yml") || p.endsWith(".yaml")) return "yaml";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".ts") || p.endsWith(".tsx")) return "typescript";
  if (p.endsWith(".js") || p.endsWith(".jsx")) return "javascript";
  return file.language || "plaintext";
}

/* ───────────────────────────────────────────────── Root */

export function Dev2IdeShell({ sessionId }: { sessionId: string }) {
  const { withPrefix } = useRouteScope();
  const router = useRouter();
  const themeMode = useThemeStore((s) => s.theme);

  const [activeRail, setActiveRail] = useState<RailKey>("files");
  const [activeTab, setActiveTab] = useState<TabKey>("code");
  const [composerValue, setComposerValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);

  // Multi-file tab strip
  const [openTabPaths, setOpenTabPaths] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const files = useIdeStore((s) => s.files);
  const activePath = useIdeStore((s) => s.activePath);
  const setWorkspace = useIdeStore((s) => s.setWorkspace);
  const setActivePath = useIdeStore((s) => s.setActivePath);
  const updateFileContent = useIdeStore((s) => s.updateFileContent);
  const markSaved = useIdeStore((s) => s.markSaved);
  const setMessages = useIdeStore((s) => s.setMessages);
  const setSelection = useIdeStore((s) => s.setSelection);
  const aiMode = useIdeStore((s) => s.aiMode);
  const setAiMode = useIdeStore((s) => s.setAiMode);
  const setRunResult = useIdeStore((s) => s.setRunResult);
  const setTestResult = useIdeStore((s) => s.setTestResult);
  const runResult = useIdeStore((s) => s.runResult);
  const testResult = useIdeStore((s) => s.testResult);
  const lastSavedAt = useIdeStore((s) => s.lastSavedAt);
  const unsavedPaths = useIdeStore((s) => s.unsavedPaths);
  const messages = useIdeStore((s) => s.messages);
  const resetSession = useIdeStore((s) => s.resetSession);
  const suggestion = useIdeStore((s) => s.suggestion);
  const setSuggestion = useIdeStore((s) => s.setSuggestion);

  // Panel widths (resizable)
  const sidebarWidth = useIdeStore((s) => s.sidebarWidth);
  const setSidebarWidth = useIdeStore((s) => s.setSidebarWidth);
  const aiPanelWidth = useIdeStore((s) => s.aiPanelWidth);
  const setAiPanelWidth = useIdeStore((s) => s.setAiPanelWidth);
  const bottomPanelHeight = useIdeStore((s) => s.bottomPanelHeight);
  const setBottomPanelHeight = useIdeStore((s) => s.setBottomPanelHeight);

  const dragStateRef = useRef<DragState | null>(null);

  const { send, streaming, requestCount, loadMessages } = useAiChat(sessionId);
  const addToast = useUiStore((s) => s.addToast);

  // Bootstrap: fetch session
  const sessionQuery = useQuery({
    queryKey: ["dev2-ide-session", sessionId],
    queryFn: () => mockApi.getSession(sessionId),
    retry: 0
  });
  const session = sessionQuery.data;
  const problem = useMemo(
    () => getProblemById(session?.problemId ?? "todo-api") ?? null,
    [session?.problemId]
  );
  const traces = useMemo(() => session?.traces ?? [], [session?.traces]);
  const agentTraceQuery = useQuery<AgentRunTrace[]>({
    queryKey: ["dev2-ide-agent-traces", sessionId],
    queryFn: async (): Promise<AgentRunTrace[]> =>
      isBackendSessionId(sessionId)
        ? sessionApi.getAgentTraces(sessionId)
        : mockApi.getAgentTraces(sessionId),
    enabled: activeTab === "trace" || activeRail === "trace",
    refetchInterval: (query) => {
      const runs = query.state.data ?? [];
      return runs.some((run) => !["COMPLETED", "FAILED", "CANCELLED"].includes(run.status))
        ? 1500
        : false;
    }
  });

  useEffect(() => {
    if (!session) return;
    setWorkspace(session.files, session.files[0]?.path);
    setMessages(session.messages ?? []);
  }, [session, setWorkspace, setMessages]);

  useEffect(() => {
    if (sessionQuery.isError) {
      addToast("세션을 찾을 수 없습니다.", "error");
      router.replace(withPrefix("/sessions"));
    }
  }, [sessionQuery.isError, addToast, router, withPrefix]);

  // Reset store on unmount
  useEffect(() => {
    return () => {
      resetSession();
    };
  }, [resetSession]);

  // Load chat messages once session is ready
  useEffect(() => {
    if (!sessionQuery.data) return;
    loadMessages().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionQuery.data?.id]);

  // Elapsed timer
  useEffect(() => {
    const t = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Autosave
  useAutoSave(sessionId);

  // Open file tab logic
  const handleOpenFile = useCallback(
    (path: string) => {
      setActivePath(path);
      setOpenTabPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActiveTabId(path);
      setActiveTab("code");
    },
    [setActivePath]
  );

  const handleOpenDiff = useCallback(
    (targetPath: string) => {
      const id = createDiffTabId(targetPath);
      setOpenTabPaths((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setActiveTabId(id);
      setActiveTab("code");
      setSelection("", null);
      setSuggestion(null);
      setAiMode("chat");
    },
    [setSelection, setSuggestion, setAiMode]
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      setOpenTabPaths((prev) => {
        const idx = prev.indexOf(id);
        const next = prev.filter((p) => p !== id);
        if (activeTabId === id) {
          const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null;
          setActiveTabId(fallback);
          if (fallback && !isDiffTabId(fallback)) {
            setActivePath(fallback);
          }
        }
        return next;
      });
    },
    [activeTabId, setActivePath]
  );

  // Auto-open first file when session loads
  useEffect(() => {
    if (!files.length) {
      setOpenTabPaths([]);
      setActiveTabId(null);
      return;
    }
    // Prune stale tab paths
    setOpenTabPaths((prev) => {
      const pruned = prev.filter((id) => {
        if (isDiffTabId(id)) {
          const target = id.slice(DIFF_TAB_PREFIX.length);
          return files.some((f) => f.path === target);
        }
        return files.some((f) => f.path === id);
      });
      if (!pruned.length && files[0]) {
        return [files[0].path];
      }
      return pruned.length === prev.length ? prev : pruned;
    });
    setActiveTabId((prev) => {
      if (prev && !isDiffTabId(prev) && files.some((f) => f.path === prev)) return prev;
      if (prev && isDiffTabId(prev)) {
        const target = prev.slice(DIFF_TAB_PREFIX.length);
        if (files.some((f) => f.path === target)) return prev;
      }
      return files[0]?.path ?? null;
    });
  }, [files]);

  // Active tab data
  const activeTabData = useMemo(() => {
    if (!activeTabId) return null;
    if (isDiffTabId(activeTabId)) {
      const targetPath = activeTabId.slice(DIFF_TAB_PREFIX.length);
      const targetFile = files.find((f) => f.path === targetPath);
      const sourcePath = getWorktreeSourcePath(targetPath);
      const sourceFile = files.find((f) => f.path === sourcePath);
      if (!targetFile || !sourceFile) return null;
      return {
        kind: "diff" as const,
        id: activeTabId,
        path: targetPath,
        title: `${getFileName(sourcePath)} diff`,
        sourceFile,
        targetFile
      };
    }
    const file = files.find((f) => f.path === activeTabId);
    if (!file) return null;
    return {
      kind: "file" as const,
      id: activeTabId,
      path: activeTabId,
      title: getFileName(activeTabId),
      file
    };
  }, [activeTabId, files]);

  const openTabs = useMemo(
    () =>
      openTabPaths
        .map((id) => {
          if (isDiffTabId(id)) {
            const targetPath = id.slice(DIFF_TAB_PREFIX.length);
            const targetFile = files.find((f) => f.path === targetPath);
            const sourcePath = getWorktreeSourcePath(targetPath);
            const sourceFile = files.find((f) => f.path === sourcePath);
            if (!targetFile || !sourceFile) return null;
            return {
              kind: "diff" as const,
              id,
              path: targetPath,
              title: `${getFileName(sourcePath)} · diff`,
              dirty: false
            };
          }
          const file = files.find((f) => f.path === id);
          if (!file) return null;
          return {
            kind: "file" as const,
            id,
            path: id,
            title: getFileName(id),
            dirty: unsavedPaths.includes(id)
          };
        })
        .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    [openTabPaths, files, unsavedPaths]
  );

  const activeFile = useMemo(() => {
    if (activeTabData?.kind === "file") return activeTabData.file;
    if (activeTabData?.kind === "diff") return activeTabData.sourceFile;
    return files.find((f) => f.path === activePath) ?? null;
  }, [activeTabData, files, activePath]);

  // Panel resize pointer handlers
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      if (ds.mode === "sidebar") {
        setSidebarWidth(clampNum(ds.startWidth + (e.clientX - ds.startX), 200, 480));
      } else if (ds.mode === "ai") {
        setAiPanelWidth(clampNum(ds.startWidth - (e.clientX - ds.startX), 280, 560));
      } else {
        setBottomPanelHeight(clampNum(ds.startHeight - (e.clientY - ds.startY), 120, 420));
      }
    };
    const handleUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [setSidebarWidth, setAiPanelWidth, setBottomPanelHeight]);

  const beginResize = useCallback(
    (mode: DragMode) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragStateRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: mode === "sidebar" ? sidebarWidth : aiPanelWidth,
        startHeight: bottomPanelHeight
      };
      document.body.style.cursor = mode === "bottom" ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth, aiPanelWidth, bottomPanelHeight]
  );

  const [saveLoading, setSaveLoading] = useState(false);

  // Save all unsaved files. Run/test/submit call this first so mock API sees the latest buffer.
  const handleSaveAll = useCallback(async (options?: { silent?: boolean }) => {
    const dirtyFiles = files.filter((f) => unsavedPaths.includes(f.path));
    if (!dirtyFiles.length) {
      if (!options?.silent) {
        addToast("저장할 변경 사항이 없습니다.", "info");
      }
      return true;
    }
    setSaveLoading(true);
    try {
      await Promise.all(
        dirtyFiles.map((f) => mockApi.saveFile(sessionId, f.path, f.content))
      );
      markSaved(undefined, new Date().toISOString());
      if (!options?.silent) {
        addToast(`${dirtyFiles.length}개 파일 저장됨`, "success");
      }
      return true;
    } catch (err) {
      addToast(err instanceof Error ? err.message : "저장 실패", "error");
      return false;
    } finally {
      setSaveLoading(false);
    }
  }, [files, unsavedPaths, sessionId, markSaved, addToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSave) {
        e.preventDefault();
        void handleSaveAll();
        return;
      }
      if (e.key === "Escape") {
        if (suggestion) {
          setSuggestion(null);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleSaveAll, suggestion, setSuggestion]);

  // Action handlers
  const [runLoading, setRunLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleRunTests = useCallback(async () => {
    const saved = await handleSaveAll({ silent: true });
    if (!saved) return;
    setTestLoading(true);
    try {
      const result = await mockApi.runTests(sessionId);
      setTestResult(result);
      void sessionQuery.refetch();
      void agentTraceQuery.refetch();
      addToast(`테스트 결과 ${result.passed}/${result.total} 통과`, result.failed ? "warning" : "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "테스트 실행 실패", "error");
    } finally {
      setTestLoading(false);
    }
  }, [handleSaveAll, sessionId, setTestResult, sessionQuery, agentTraceQuery, addToast]);

  const handleRunCode = useCallback(async () => {
    const saved = await handleSaveAll({ silent: true });
    if (!saved) return;
    setRunLoading(true);
    try {
      const result = await mockApi.runCode(sessionId);
      setRunResult(result);
      void sessionQuery.refetch();
      void agentTraceQuery.refetch();
      addToast(result.status === "COMPLETED" ? "실행 완료" : "실행 오류", result.status === "COMPLETED" ? "success" : "error");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "실행 실패", "error");
    } finally {
      setRunLoading(false);
    }
  }, [handleSaveAll, sessionId, setRunResult, sessionQuery, agentTraceQuery, addToast]);

  const handleSubmit = useCallback(async () => {
    if (unsavedPaths.length > 0) {
      const ok = window.confirm("저장되지 않은 변경이 있습니다. 저장 후 제출할까요?");
      if (!ok) return;
      const saved = await handleSaveAll({ silent: true });
      if (!saved) return;
    }
    setSubmitLoading(true);
    try {
      const submission = await mockApi.submitSession(sessionId);
      addToast("제출 완료", "success");
      router.push(withPrefix(`/submissions/${submission.id}`));
    } catch (err) {
      addToast(err instanceof Error ? err.message : "제출 실패", "error");
      setSubmitLoading(false);
    }
  }, [handleSaveAll, sessionId, unsavedPaths, router, withPrefix, addToast]);

  const handleSendChat = useCallback(async () => {
    const trimmed = composerValue.trim();
    if (!trimmed || streaming) return;
    const suffix = attachments.length
      ? `\n\n— 첨부 파일 —\n${attachments.join("\n")}`
      : "";
    setComposerValue("");
    try {
      await send(trimmed + suffix, activePath ?? undefined);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "AI 요청 실패", "error");
    }
  }, [composerValue, streaming, attachments, send, activePath, addToast]);

  const aiQuota = 40;

  if (sessionQuery.isLoading || !sessionQuery.data) {
    return (
      <div
        className="dev2-ide-shell h-screen w-screen flex items-center justify-center"
        data-theme={themeMode}
      >
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin text-indigo-500" />
          세션 불러오는 중…
        </div>
      </div>
    );
  }

  return (
    <div
      className="dev2-ide-shell h-screen w-screen flex flex-col overflow-hidden"
      data-theme={themeMode}
    >
      <TopBar
        sessionId={sessionId}
        problem={problem}
        withPrefix={withPrefix}
        elapsed={elapsed}
        lastSavedAt={lastSavedAt}
        unsavedCount={unsavedPaths.length}
        saveLoading={saveLoading}
        runLoading={runLoading}
        testLoading={testLoading}
        submitLoading={submitLoading}
        onSaveAll={() => void handleSaveAll()}
        onRunCode={handleRunCode}
        onRunTests={handleRunTests}
        onSubmit={handleSubmit}
      />

      <div className="dev2-ide-body flex-1 flex min-h-0">
        <ActivityRail active={activeRail} onChange={setActiveRail} />

        <div className="dev2-ide-sidebar relative shrink-0 flex" style={{ width: sidebarWidth }}>
          <SecondaryPanel
            railKey={activeRail}
            files={files}
            activePath={activePath}
            unsavedPaths={unsavedPaths}
            onSelect={handleOpenFile}
            onOpenDiff={handleOpenDiff}
            problem={problem}
            traces={traces}
            agentRuns={agentTraceQuery.data ?? []}
            testResult={testResult}
          />
          <ResizeHandle mode="vertical" onPointerDown={beginResize("sidebar")} />
        </div>

        <div className="dev2-ide-center flex-1 flex flex-col min-w-0">
          <MainWorkspace
            activeTab={activeTab}
            onTabChange={setActiveTab}
            activeFile={activeFile}
            activeTabData={activeTabData}
            openTabs={openTabs}
            activeTabId={activeTabId}
            onSelectTab={(id) => {
              setActiveTabId(id);
              if (!isDiffTabId(id)) setActivePath(id);
            }}
            onCloseTab={handleCloseTab}
            problem={problem}
            traces={traces}
            agentRuns={agentTraceQuery.data ?? []}
            unsavedPaths={unsavedPaths}
            updateFileContent={updateFileContent}
            setSelection={setSelection}
            runLoading={runLoading}
            testLoading={testLoading}
            submitLoading={submitLoading}
            onRunCode={handleRunCode}
            onRunTests={handleRunTests}
            onSubmit={handleSubmit}
            onFormatClick={() => addToast("이 파일에서 사용할 수 있는 포맷터가 없습니다.", "info")}
            onFindClick={() => addToast("에디터가 아직 준비되지 않았습니다.", "info")}
          />
          <div className="dev2-ide-bottom-slot relative" style={{ height: bottomPanelHeight }}>
            <ResizeHandle mode="horizontal" onPointerDown={beginResize("bottom")} />
            <BottomTray
              runResult={runResult}
              testResult={testResult}
              onRunCode={handleRunCode}
              runLoading={runLoading}
            />
          </div>
        </div>

        <div className="dev2-ide-ai-slot relative shrink-0 flex" style={{ width: aiPanelWidth }}>
          <ResizeHandle mode="vertical" side="left" onPointerDown={beginResize("ai")} />
          <AiPairPanel
            aiMode={aiMode}
            setAiMode={setAiMode}
            composerValue={composerValue}
            setComposerValue={setComposerValue}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            streaming={streaming}
            requestCount={requestCount}
            aiQuota={aiQuota}
            onSend={handleSendChat}
            sessionId={sessionId}
            activeFile={activeFile}
            onAfterMutation={() => {
              void sessionQuery.refetch();
              void agentTraceQuery.refetch();
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────── Resize handle */

function ResizeHandle({
  mode,
  side = "right",
  onPointerDown
}: {
  mode: "vertical" | "horizontal";
  side?: "left" | "right";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  if (mode === "vertical") {
    return (
      <div
        onPointerDown={onPointerDown}
        className={`absolute top-0 bottom-0 w-1.5 z-20 cursor-col-resize hover:bg-indigo-300/40 active:bg-indigo-400/60 transition-colors ${
          side === "right" ? "-right-1" : "-left-1"
        }`}
      />
    );
  }
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute left-0 right-0 -top-1 h-1.5 z-20 cursor-row-resize hover:bg-indigo-300/40 active:bg-indigo-400/60 transition-colors"
    />
  );
}

/* ───────────────────────────────────────────────── TopBar */

function TopBar({
  sessionId,
  problem,
  withPrefix,
  elapsed,
  lastSavedAt,
  unsavedCount,
  saveLoading,
  runLoading,
  testLoading,
  submitLoading,
  onSaveAll,
  onRunCode,
  onRunTests,
  onSubmit
}: {
  sessionId: string;
  problem: ProblemDetailType | null;
  withPrefix: (p: string) => string;
  elapsed: number;
  lastSavedAt: string | null;
  unsavedCount: number;
  saveLoading: boolean;
  runLoading: boolean;
  testLoading: boolean;
  submitLoading: boolean;
  onSaveAll: () => void;
  onRunCode: () => void;
  onRunTests: () => void;
  onSubmit: () => void;
}) {
  const shortId = sessionId.replace(/^session-/, "").slice(0, 6);
  const busy = saveLoading || runLoading || testLoading || submitLoading;
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <header className="dev2-ide-topbar h-14 shrink-0 bg-white border-b border-gray-100 flex items-center px-4 gap-4">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={withPrefix("/problems")}
          className="inline-flex items-center gap-1.5 font-display font-bold text-gray-900 cursor-pointer"
        >
          <Sparkles size={18} strokeWidth={2.2} className="text-indigo-600" />
          <span>AIG</span>
        </Link>
        <span className="h-5 w-px bg-gray-200" />
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 font-mono truncate">
          <Link href={withPrefix("/problems")} className="hover:text-indigo-600 transition-colors cursor-pointer">
            과제
          </Link>
          <ChevronRight size={12} className="text-gray-300" />
          <Link
            href={withPrefix("/sessions")}
            className="hover:text-indigo-600 transition-colors cursor-pointer"
          >
            세션
          </Link>
          <ChevronRight size={12} className="text-gray-300" />
          <span className="text-gray-700">#{shortId || "a1b2c3"}</span>
        </nav>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 whitespace-nowrap">
          Lv {problem?.level ?? "-"}
        </span>
      </div>

      {/* Center status */}
      <div className="flex-1 flex items-center justify-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-indigo-500 opacity-60 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-indigo-500" />
          </span>
          <span className="text-xs font-semibold text-indigo-700">
            {problem?.title ?? "세션 로딩 중"}
          </span>
        </div>
        <span className="text-xs font-mono text-gray-700 tabular-nums">{formatElapsed(elapsed)}</span>
        <span className="text-xs text-gray-400">
          {unsavedCount > 0 ? `${unsavedCount}개 미저장` : formatRelativeSeconds(lastSavedAt)}
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSaveAll}
          disabled={saveLoading || unsavedCount === 0}
          aria-busy={saveLoading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
            saveLoading || unsavedCount === 0
              ? "border-gray-200 text-gray-400 cursor-not-allowed"
              : "border-gray-300 text-gray-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50"
          }`}
        >
          {saveLoading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.4} />}
          <span>{saveLoading ? "저장 중…" : "저장"}</span>
        </button>
        <button
          type="button"
          onClick={onRunCode}
          disabled={busy}
          aria-busy={runLoading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
            busy
              ? "border-gray-200 text-gray-400 cursor-not-allowed"
              : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          }`}
        >
          {runLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} strokeWidth={2.4} fill="currentColor" />
          )}
          <span>{runLoading ? "실행 중…" : "실행"}</span>
        </button>
        <button
          type="button"
          onClick={onRunTests}
          disabled={busy}
          aria-busy={testLoading}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
            busy
              ? "border-teal-200 text-teal-400 cursor-not-allowed opacity-70"
              : "border-teal-300 text-teal-700 hover:bg-teal-50"
          }`}
        >
          {testLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} strokeWidth={2.4} fill="currentColor" />
          )}
          <span>{testLoading ? "실행 중…" : "테스트 실행"}</span>
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          aria-busy={submitLoading}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-sm font-bold transition-all shadow-sm hover:shadow-md cursor-pointer ${
            busy ? "opacity-70 cursor-not-allowed" : ""
          }`}
          style={{
            backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)"
          }}
        >
          {submitLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Send size={13} strokeWidth={2.4} />
          )}
          <span>{submitLoading ? "제출 중…" : "제출"}</span>
        </button>
        <button
          type="button"
          title="테마 전환"
          aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
        >
          <ThemeIcon size={14} strokeWidth={2.2} />
        </button>
        <div className="ml-2 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
          JD
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────────────────────────────── ActivityRail */

function ActivityRail({
  active,
  onChange
}: {
  active: RailKey;
  onChange: (k: RailKey) => void;
}) {
  const items: { key: RailKey; icon: LucideIcon; label: string }[] = [
    { key: "files", icon: FolderTree, label: "파일" },
    { key: "problem", icon: ListChecks, label: "과제" },
    { key: "trace", icon: GitBranch, label: "Trace" },
    { key: "tests", icon: TestTube, label: "테스트" },
    { key: "ai", icon: Bot, label: "AI" },
    { key: "harness", icon: Network, label: "하네스" }
  ];
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <aside className="dev2-ide-activity-rail w-14 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center pt-3 pb-14 gap-1">
      {items.map((it) => {
        const isActive = it.key === active;
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            title={it.label}
            aria-label={`${it.label} 패널 열기`}
            aria-pressed={isActive}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isActive
                ? "bg-indigo-600 text-white shadow-sm scale-[1.02]"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <Icon size={16} strokeWidth={2.2} />
          </button>
        );
      })}
      <div className="flex-1" />
      <div className="w-8 h-px bg-gray-100 my-1" />
      <button
        type="button"
        title="단축키 (Ctrl+K)"
        className="w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
      >
        <Command size={14} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        title="사이드바 테마 전환"
        aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
        onClick={toggleTheme}
        className="w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
      >
        <ThemeIcon size={14} strokeWidth={2.2} />
      </button>
    </aside>
  );
}

/* ───────────────────────────────────────────────── SecondaryPanel */

function SecondaryPanel({
  railKey,
  files,
  activePath,
  unsavedPaths,
  onSelect,
  onOpenDiff,
  testResult,
  problem,
  traces,
  agentRuns
}: {
  railKey: RailKey;
  files: WorkspaceFile[];
  activePath: string | null;
  unsavedPaths: string[];
  onSelect: (path: string) => void;
  onOpenDiff: (path: string) => void;
  testResult: ReturnType<typeof useIdeStore.getState>["testResult"];
  problem: ProblemDetailType | null;
  traces: TraceEvent[];
  agentRuns: AgentRunTrace[];
}) {
  if (railKey === "files")
    return (
      <FilesPanel
        files={files}
        activePath={activePath}
        unsavedPaths={unsavedPaths}
        onSelect={onSelect}
        onOpenDiff={onOpenDiff}
        testResult={testResult}
      />
    );
  if (railKey === "tests") return <TestsSidePanel testResult={testResult} />;
  if (railKey === "problem") return <ProblemSidePanel problem={problem} />;
  if (railKey === "trace") return <TraceSidePanel traces={traces} agentRuns={agentRuns} />;
  if (railKey === "harness") return <HarnessPanel />;
  return <AiSidePanel />;
}

function FilesPanel({
  files,
  activePath,
  unsavedPaths,
  onSelect,
  onOpenDiff,
  testResult
}: {
  files: WorkspaceFile[];
  activePath: string | null;
  unsavedPaths: string[];
  onSelect: (path: string) => void;
  onOpenDiff: (path: string) => void;
  testResult: ReturnType<typeof useIdeStore.getState>["testResult"];
}) {
  const [query, setQuery] = useState("");
  const agentFiles = useMemo(() => files.filter((file) => isAgentConfigFile(file.path)), [files]);
  const workspaceFiles = useMemo(() => files.filter((file) => !isAgentConfigFile(file.path)), [files]);
  const agentTree = useMemo(() => buildFileTree(agentFiles, query), [agentFiles, query]);
  const workspaceTree = useMemo(() => buildFileTree(workspaceFiles, query), [workspaceFiles, query]);
  const hasVisibleFiles = agentTree.length > 0 || workspaceTree.length > 0;

  const resultSummary = testResult
    ? { ok: testResult.failed === 0, text: `${testResult.passed}/${testResult.total} 통과` }
    : null;

  return (
    <aside className="dev2-ide-panel w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-gray-900 text-[15px]">파일</span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
            {files.length}
          </span>
        </div>
        <button
          type="button"
          className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600 flex items-center justify-center transition-colors cursor-pointer"
          title="새 파일"
        >
          <Plus size={14} strokeWidth={2.4} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search
            size={12}
            strokeWidth={2}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="파일 검색"
            className="w-full pl-7 pr-2 py-1.5 rounded-md bg-gray-50 border border-gray-100 text-xs text-gray-700 placeholder-gray-400 focus:bg-white focus:border-indigo-300 outline-none"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2 px-2 text-sm">
        {!hasVisibleFiles ? (
          <div className="px-2 py-4 text-xs text-gray-400 text-center">파일이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {agentTree.length > 0 && (
              <ExplorerSection
                title="Agent 설정"
                description="지시문 · skills · harness"
                count={agentFiles.length}
                tone="agent"
              >
                <TreeView
                  nodes={agentTree}
                  activePath={activePath}
                  unsavedPaths={unsavedPaths}
                  onSelect={onSelect}
                  onOpenDiff={onOpenDiff}
                />
              </ExplorerSection>
            )}

            {workspaceTree.length > 0 && (
              <ExplorerSection
                title="워크스페이스"
                description="소스 · 테스트 · 설정"
                count={workspaceFiles.length}
                tone="workspace"
              >
                <TreeView
                  nodes={workspaceTree}
                  activePath={activePath}
                  unsavedPaths={unsavedPaths}
                  onSelect={onSelect}
                  onOpenDiff={onOpenDiff}
                />
              </ExplorerSection>
            )}
          </div>
        )}
      </div>

      {/* Run output collapsed card */}
      <div className="border-t border-gray-100 px-3 py-2.5">
        <div className="w-full flex items-center justify-between gap-2 text-left">
          <span className="flex items-center gap-2 min-w-0">
            <span
              className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                resultSummary?.ok
                  ? "bg-green-100 text-green-700"
                  : resultSummary
                    ? "bg-rose-100 text-rose-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              <Check size={11} strokeWidth={3} />
            </span>
            <span className="text-xs text-gray-700 truncate">
              <strong className="font-semibold">실행 결과</strong>
              <span className="text-gray-400">
                {resultSummary ? ` · ${resultSummary.text}` : " · 아직 없음"}
              </span>
            </span>
          </span>
          <ChevronDown size={12} className="text-gray-400 shrink-0" />
        </div>
      </div>
    </aside>
  );
}

function ExplorerSection({
  title,
  description,
  count,
  tone,
  children
}: {
  title: string;
  description: string;
  count: number;
  tone: "agent" | "workspace";
  children: ReactNode;
}) {
  const isAgent = tone === "agent";

  return (
    <section
      className={`overflow-hidden rounded-xl border ${
        isAgent
          ? "border-indigo-200 bg-indigo-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
          : "border-gray-200 bg-white"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 border-b px-2.5 py-2 ${
          isAgent ? "border-indigo-100 bg-white/60" : "border-gray-100 bg-gray-50"
        }`}
      >
        <span className="min-w-0">
          <span
            className={`block truncate text-[11px] font-black uppercase tracking-[0.12em] ${
              isAgent ? "text-indigo-700" : "text-gray-500"
            }`}
          >
            {title}
          </span>
          <span className="block truncate text-[10px] text-gray-400">{description}</span>
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
            isAgent ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"
          }`}
        >
          {count}
        </span>
      </div>
      <div className="py-1">{children}</div>
    </section>
  );
}

function TreeView({
  nodes,
  activePath,
  unsavedPaths,
  onSelect,
  onOpenDiff,
  depth = 0
}: {
  nodes: TreeNode[];
  activePath: string | null;
  unsavedPaths: string[];
  onSelect: (path: string) => void;
  onOpenDiff: (path: string) => void;
  depth?: number;
}) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.path}
          node={node}
          activePath={activePath}
          unsavedPaths={unsavedPaths}
          onSelect={onSelect}
          onOpenDiff={onOpenDiff}
          depth={depth}
        />
      ))}
    </div>
  );
}

function TreeNodeRow({
  node,
  activePath,
  unsavedPaths,
  onSelect,
  onOpenDiff,
  depth
}: {
  node: TreeNode;
  activePath: string | null;
  unsavedPaths: string[];
  onSelect: (path: string) => void;
  onOpenDiff: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(true);

  if (node.kind === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-50 text-left text-gray-700 cursor-pointer"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? (
            <ChevronDown size={12} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-gray-400 shrink-0" />
          )}
          <FolderTree size={13} className="text-indigo-500 shrink-0" />
          <span className="text-sm font-mono truncate">{node.name}</span>
        </button>
        {open && (
          <TreeView
            nodes={node.children}
            activePath={activePath}
            unsavedPaths={unsavedPaths}
            onSelect={onSelect}
            onOpenDiff={onOpenDiff}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  const isActive = node.path === activePath;
  const dirty = unsavedPaths.includes(node.path);
  const badge = deriveBadge(node.file);
  const isWorktree = node.path.startsWith(".worktree/");

  return (
    <div
      className={`relative w-full flex items-center gap-1.5 py-1 rounded-md text-[13px] font-mono transition-colors ${
        isActive ? "bg-indigo-50/70" : "hover:bg-gray-50"
      }`}
      style={{ paddingLeft: `${depth * 12 + 18}px`, paddingRight: "8px" }}
    >
      {isActive && (
        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500 rounded-r" />
      )}
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className="flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer"
      >
        <span
          className={`shrink-0 w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${badge.tint}`}
        >
          {badge.letter}
        </span>
        <span
          className={`flex-1 truncate ${
            isActive ? "text-indigo-900 font-semibold" : "text-gray-700"
          }`}
        >
          {node.name}
        </span>
      </button>
      {isWorktree && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDiff(node.path);
          }}
          title="Diff 보기"
          className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer transition-colors"
        >
          Diff
        </button>
      )}
      {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
    </div>
  );
}

function TestsSidePanel({
  testResult
}: {
  testResult: ReturnType<typeof useIdeStore.getState>["testResult"];
}) {
  return (
    <aside className="dev2-ide-panel w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="font-display font-bold text-gray-900 text-[15px]">테스트</span>
        {testResult && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              testResult.failed === 0 ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            {testResult.passed}/{testResult.total}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {!testResult ? (
          <div className="h-full flex items-center justify-center px-4 text-center">
            <p className="text-xs text-gray-400">상단의 테스트 실행 버튼으로 공개 테스트를 확인할 수 있습니다.</p>
          </div>
        ) : (
          testResult.results.map((test) => (
            <div
              key={test.id}
              className={`rounded-xl border p-3 ${
                test.status === "PASS" ? "border-green-100 bg-green-50/60" : "border-rose-100 bg-rose-50/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{test.name}</div>
                  {test.detail && <p className="mt-1 text-xs text-gray-500 leading-relaxed">{test.detail}</p>}
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    test.status === "PASS" ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {test.status}
                </span>
              </div>
              <div className="mt-2 text-[11px] font-mono text-gray-400">{test.time}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function ProblemSidePanel({ problem }: { problem: ProblemDetailType | null }) {
  return (
    <aside className="dev2-ide-panel w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="font-display font-bold text-gray-900 text-[15px]">과제 개요</div>
        <p className="mt-1 text-xs text-gray-500 truncate">{problem?.title ?? "과제 정보를 불러오는 중입니다."}</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {problem ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-indigo-100 text-indigo-700">
                {problem.category}
              </span>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">
                Lv {problem.level}
              </span>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">
                {problem.status}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{problem.summary}</p>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                <Clock size={10} />
                예상 시간
              </div>
              <div className="font-display font-bold text-gray-900">{problem.estimate}</div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 mb-2">요구 사항</h3>
              <ul className="space-y-2">
                {problem.requirements.slice(0, 5).map((requirement) => (
                  <li key={requirement} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                    <Check size={11} strokeWidth={3} className="mt-0.5 shrink-0 text-green-600" />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 mb-2">공개 케이스</h3>
              <div className="space-y-2">
                {problem.publicCases.map((test) => (
                  <div key={test.id} className="rounded-lg border border-gray-100 p-2">
                    <div className="text-xs font-semibold text-gray-800">{test.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-gray-500">{test.detail}</div>
                    <div className="mt-1 text-[11px] text-green-700 font-semibold">{test.result}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-gray-400 text-center">
            세션에 연결된 과제를 찾지 못했습니다.
          </div>
        )}
      </div>
    </aside>
  );
}

function TraceSidePanel({
  traces,
  agentRuns
}: {
  traces: TraceEvent[];
  agentRuns: AgentRunTrace[];
}) {
  const latestRun = agentRuns[0] ?? null;
  const failedSpans = latestRun?.spans.filter((span) => span.status === "FAILED") ?? [];
  return (
    <aside className="dev2-ide-panel w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="font-display font-bold text-gray-900 text-[15px]">Trace 세션</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
          {latestRun ? latestRun.status : `${traces.length} events`}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {latestRun ? (
          <>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500 mb-1">최근 Agent Run</div>
              <div className="font-mono text-xs text-gray-900 truncate">{latestRun.agentTraceId}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                <span>{latestRun.spans.length} spans</span>
                <span>{latestRun.totalInputTokens + latestRun.totalOutputTokens} tokens</span>
                <span>{latestRun.totalCostCredits} credits</span>
                <span>{latestRun.durationMs ? `${(latestRun.durationMs / 1000).toFixed(1)}s` : "진행 중"}</span>
              </div>
            </div>
            {latestRun.summaryText && (
              <p className="text-sm text-gray-700 leading-relaxed">{latestRun.summaryText}</p>
            )}
            {latestRun.errorMessage && (
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 leading-relaxed">
                {latestRun.errorMessage}
              </div>
            )}
            <div>
              <h3 className="text-xs font-bold text-gray-900 mb-2">Span 상태</h3>
              <div className="space-y-2">
                {latestRun.spans.slice(0, 8).map((span) => (
                  <div key={span.spanId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-gray-700 truncate">{span.spanName}</span>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        span.status === "FAILED"
                          ? "bg-rose-100 text-rose-700"
                          : span.status === "RUNNING"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {span.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {failedSpans.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs font-bold text-amber-800 mb-1">확인 필요</div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  실패 span {failedSpans.length}개가 있습니다. Trace 탭에서 상세 입력/출력을 확인하세요.
                </p>
              </div>
            )}
          </>
        ) : traces.length > 0 ? (
          traces.slice(-8).reverse().map((trace) => (
            <div key={trace.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-gray-900">{trace.type}</span>
                <span className="font-mono text-gray-400">{trace.time}</span>
              </div>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed">{trace.summary}</p>
            </div>
          ))
        ) : (
          <div className="h-full flex items-center justify-center px-4 text-center">
            <p className="text-xs text-gray-400">AI 요청, 실행, 테스트를 수행하면 Trace가 쌓입니다.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ───────────────────────────────────────────────── HarnessPanel */

const HARNESS_NODE_TYPES = [
  { type: "instruction", icon: "📋", label: "Instruction", desc: "시스템 프롬프트 · CLAUDE.md" },
  { type: "agent",       icon: "🤖", label: "Agent",       desc: "에이전트 역할 · 모델 설정" },
  { type: "skill",       icon: "🔧", label: "Skill",       desc: "개별 스킬 파일" },
  { type: "harness",     icon: "⚙️", label: "Harness",     desc: "오케스트레이션 설정" }
] as const;

function HarnessPanel() {
  const [mode, setMode] = useState<"empty" | "canvas">("empty");

  return (
    <aside className="dev2-ide-panel w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Network size={14} strokeWidth={2.2} className="text-indigo-500" />
          <span className="font-display font-bold text-gray-900 text-[15px]">하네스</span>
        </div>
        {mode === "canvas" && (
          <button
            type="button"
            onClick={() => setMode("empty")}
            title="초기화"
            className="w-6 h-6 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {mode === "empty" ? (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 gap-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Network size={22} strokeWidth={1.8} className="text-indigo-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 mb-1">하네스 구성</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              에이전트, 스킬, 인스트럭션 파일을<br />
              노드 캔버스로 시각화하고 편집합니다.
            </p>
          </div>
          <div className="w-full flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setMode("canvas")}
              className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              마법사로 시작하기
            </button>
            <button
              type="button"
              onClick={() => setMode("canvas")}
              className="w-full py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              직접 구성하기
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 노드 팔레트 */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">노드 추가</p>
            <div className="grid grid-cols-2 gap-1.5">
              {HARNESS_NODE_TYPES.map((n) => (
                <button
                  key={n.type}
                  type="button"
                  title={n.desc}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-gray-100 bg-gray-50 hover:border-indigo-200 hover:bg-indigo-50 transition-colors text-left"
                >
                  <span className="text-sm leading-none">{n.icon}</span>
                  <span className="text-[11px] font-semibold text-gray-700">{n.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 캔버스 영역 */}
          <div className="flex-1 relative bg-[#fafafa] overflow-hidden">
            {/* 격자 배경 */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="harness-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#harness-grid)" />
            </svg>

            {/* 빈 캔버스 힌트 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <p className="text-[11px] text-gray-400 font-medium">위 버튼으로 노드를 추가하세요</p>
              <p className="text-[10px] text-gray-300">노드 클릭 → 편집 · 드래그 → 연결</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function AiSidePanel() {
  return (
    <aside className="dev2-ide-panel w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="font-display font-bold text-gray-900 text-[15px]">AI 도우미</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 text-center">
        <p className="text-xs text-gray-400">오른쪽 AI 페어 패널에서 채팅과 코드 제안을 사용할 수 있습니다.</p>
      </div>
    </aside>
  );
}

function SidePlaceholder({ title }: { title: string }) {
  return (
    <aside className="dev2-ide-panel w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="font-display font-bold text-gray-900 text-[15px]">{title}</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 text-center">
        <p className="text-xs text-gray-400">곧 추가될 예정입니다.</p>
      </div>
    </aside>
  );
}

/* ───────────────────────────────────────────────── MainWorkspace */

type OpenTabDescriptor =
  | { kind: "file"; id: string; path: string; title: string; dirty: boolean }
  | { kind: "diff"; id: string; path: string; title: string; dirty: boolean };

type ActiveTabData =
  | {
      kind: "file";
      id: string;
      path: string;
      title: string;
      file: WorkspaceFile;
    }
  | {
      kind: "diff";
      id: string;
      path: string;
      title: string;
      sourceFile: WorkspaceFile;
      targetFile: WorkspaceFile;
    }
  | null;

function MainWorkspace({
  activeTab,
  onTabChange,
  activeFile,
  activeTabData,
  openTabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  problem,
  traces,
  agentRuns,
  unsavedPaths,
  updateFileContent,
  setSelection,
  runLoading,
  testLoading,
  submitLoading,
  onRunCode,
  onRunTests,
  onSubmit,
  onFormatClick,
  onFindClick
}: {
  activeTab: TabKey;
  onTabChange: (t: TabKey) => void;
  activeFile: WorkspaceFile | null;
  activeTabData: ActiveTabData;
  openTabs: OpenTabDescriptor[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  problem: ProblemDetailType | null;
  traces: TraceEvent[];
  agentRuns: AgentRunTrace[];
  unsavedPaths: string[];
  updateFileContent: (path: string, content: string) => void;
  setSelection: (code: string, range: SelectionRange | null) => void;
  runLoading: boolean;
  testLoading: boolean;
  submitLoading: boolean;
  onRunCode: () => void;
  onRunTests: () => void;
  onSubmit: () => void;
  onFormatClick: () => void;
  onFindClick: () => void;
}) {
  const anyDirty = openTabs.some((t) => t.dirty);
  const traceCount = agentRuns[0]?.spans.length ?? traces.length;
  const tabs: {
    key: TabKey;
    label: string;
    icon: LucideIcon;
    dirty?: boolean;
    count?: number;
  }[] = [
    { key: "code", label: "코드", icon: Code2, dirty: anyDirty },
    { key: "problem", label: "과제", icon: ListChecks },
    { key: "trace", label: "Trace", icon: GitBranch, count: traceCount || undefined }
  ];

  return (
    <section className="dev2-ide-main-panel flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Top-level tab strip */}
      <div className="dev2-ide-primary-tabs flex items-stretch border-b border-gray-100 gap-0">
        {tabs.map((t) => {
          const active = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              aria-label={`${t.label} 탭 열기`}
              aria-pressed={active}
              className={`relative inline-flex h-11 items-center gap-2 px-4 rounded-none border-0 border-r border-gray-100 text-sm transition-colors cursor-pointer ${
                active
                  ? "bg-indigo-50 border-indigo-100 text-indigo-700 font-bold shadow-sm"
                  : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-medium"
              }`}
            >
              <Icon
                size={14}
                strokeWidth={2.2}
                className={active ? "text-indigo-600" : "text-gray-400"}
              />
              <span>{t.label}</span>
              {t.dirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
              {t.count != null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t.count}
                </span>
              )}
              {active && (
                <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* File tab strip (only on code tab) */}
      {activeTab === "code" && openTabs.length > 0 && (
        <div className="dev2-ide-file-tabs flex items-center border-b border-gray-100 bg-gray-50/40 overflow-x-auto">
          {openTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isDiff = tab.kind === "diff";
            return (
              <div
                key={tab.id}
                className={`dev2-ide-file-tab group shrink-0 flex items-center gap-1.5 border-r border-gray-100 pl-3 pr-1.5 py-1.5 text-xs transition-colors ${
                  isActive ? "bg-indigo-50/70 text-indigo-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  aria-label={`${tab.title} 탭 열기`}
                  className="inline-flex items-center gap-1.5 font-mono cursor-pointer"
                >
                  {isDiff ? (
                    <span className="text-[9px] font-bold uppercase px-1 rounded bg-amber-100 text-amber-700">
                      Diff
                    </span>
                  ) : null}
                  <span className={`${isActive ? "font-semibold" : ""}`}>{tab.title}</span>
                  {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  aria-label="탭 닫기"
                  className="w-4 h-4 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center cursor-pointer opacity-60 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "code" &&
          (activeTabData?.kind === "diff" ? (
            <DiffCodeView
              sourceFile={activeTabData.sourceFile}
              targetFile={activeTabData.targetFile}
              title={activeTabData.title}
            />
          ) : (
            <CodeView
              activeFile={activeFile}
              isDirty={activeFile ? unsavedPaths.includes(activeFile.path) : false}
              updateFileContent={updateFileContent}
              setSelection={setSelection}
              onFormatClick={onFormatClick}
              onFindClick={onFindClick}
            />
          ))}
        {activeTab === "problem" && (
          <ProblemView
            problem={problem}
            runLoading={runLoading}
            testLoading={testLoading}
            submitLoading={submitLoading}
            onRunCode={onRunCode}
            onRunTests={onRunTests}
            onSubmit={onSubmit}
          />
        )}
        {activeTab === "trace" && <TraceView traces={traces} agentRuns={agentRuns} />}
      </div>
    </section>
  );
}

/* ─── Diff View (Monaco DiffEditor on .worktree/ tabs) ─── */

function DiffCodeView({
  sourceFile,
  targetFile,
  title
}: {
  sourceFile: WorkspaceFile;
  targetFile: WorkspaceFile;
  title: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const language = useMemo(() => languageFromFile(sourceFile), [sourceFile]);
  return (
    <>
      <div className="dev2-ide-subtoolbar flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50 gap-3">
        <div className="flex items-center gap-2.5 min-w-0 text-sm">
          <code className="font-mono text-gray-700 truncate">{title}</code>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
            읽기 전용
          </span>
          <span className="text-xs text-gray-400 truncate">
            {sourceFile.path} ↔ {targetFile.path}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <MonacoDiffEditor
          original={sourceFile.content}
          modified={targetFile.content}
          language={language}
          theme={theme === "dark" ? "vs-dark" : "vs"}
          options={{
            readOnly: true,
            renderSideBySide: true,
            fontSize: 13,
            lineHeight: 22,
            minimap: { enabled: false },
            automaticLayout: true,
            originalEditable: false,
            scrollBeyondLastLine: false
          }}
        />
      </div>
      <div className="dev2-ide-statusbar h-6 shrink-0 flex items-center justify-between px-4 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500">
        <span>diff · {language.toUpperCase()} · 읽기 전용</span>
        <span className="text-gray-400">왼쪽: 원본 / 오른쪽: AI 제안</span>
      </div>
    </>
  );
}

/* ─── Code View (Monaco) ─── */

function CodeView({
  activeFile,
  isDirty,
  updateFileContent,
  setSelection,
  onFormatClick,
  onFindClick
}: {
  activeFile: WorkspaceFile | null;
  isDirty: boolean;
  updateFileContent: (path: string, content: string) => void;
  setSelection: (code: string, range: SelectionRange | null) => void;
  onFormatClick: () => void;
  onFindClick: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const editorRef = useRef<unknown>(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, column: 1 });
  const lineCount = useMemo(
    () => (activeFile?.content ? activeFile.content.split("\n").length : 0),
    [activeFile?.content]
  );
  const language = useMemo(() => languageFromFile(activeFile), [activeFile]);

  const handleMount = useCallback(
    (editor: unknown, monaco: unknown) => {
      editorRef.current = editor;
      const e = editor as {
        onDidChangeCursorPosition: (cb: (evt: { position: { lineNumber: number; column: number } }) => void) => void;
        onDidChangeCursorSelection: (cb: (evt: unknown) => void) => void;
        getModel: () => { getValueInRange: (range: unknown) => string } | null;
        getSelection: () =>
          | { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number; isEmpty: () => boolean }
          | null;
      };
      e.onDidChangeCursorPosition((evt) => {
        setCursorInfo({ line: evt.position.lineNumber, column: evt.position.column });
      });
      let timer: number | null = null;
      e.onDidChangeCursorSelection(() => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          const sel = e.getSelection();
          const model = e.getModel();
          if (!sel || !model) return;
          if (sel.isEmpty()) {
            setSelection("", null);
            return;
          }
          const code = model.getValueInRange(sel as unknown as object);
          setSelection(code, {
            startLineNumber: sel.startLineNumber,
            startColumn: sel.startColumn,
            endLineNumber: sel.endLineNumber,
            endColumn: sel.endColumn
          });
        }, 80);
      });
    },
    [setSelection]
  );

  const runEditorAction = useCallback((actionId: string, fallback: () => void) => {
    const editor = editorRef.current as
      | {
          getAction?: (id: string) => { run: () => void | Promise<void> } | null;
          focus?: () => void;
        }
      | null;
    const action = editor?.getAction?.(actionId);
    if (!action) {
      fallback();
      return;
    }
    editor?.focus?.();
    void action.run();
  }, []);

  const handleFormatClick = useCallback(() => {
    runEditorAction("editor.action.formatDocument", onFormatClick);
  }, [onFormatClick, runEditorAction]);

  const handleFindClick = useCallback(() => {
    runEditorAction("actions.find", onFindClick);
  }, [onFindClick, runEditorAction]);

  return (
    <>
      {/* Sub-toolbar */}
      <div className="dev2-ide-subtoolbar flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50 gap-3">
        <div className="flex items-center gap-2.5 min-w-0 text-sm">
          <code className="font-mono text-gray-700 truncate">
            {activeFile?.path ?? "파일을 선택하세요"}
          </code>
          {isDirty && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
              저장 안됨
            </span>
          )}
          <span className="text-xs text-gray-400 tabular-nums">{lineCount}줄</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ToolbarBtn icon={SlidersHorizontal} label="정렬" onClick={handleFormatClick} />
          <ToolbarBtn icon={Search} label="찾기" onClick={handleFindClick} />
          <ToolbarBtn icon={Command} label="Vim 꺼짐" muted />
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 min-h-0 relative">
        {!activeFile ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            파일 트리에서 파일을 선택해 주세요.
          </div>
        ) : (
          <MonacoEditor
            key={activeFile.path}
            path={activeFile.path}
            language={language}
            value={activeFile.content}
            theme={theme === "dark" ? "vs-dark" : "vs"}
            onChange={(value) => updateFileContent(activeFile.path, value ?? "")}
            onMount={handleMount}
            options={{
              fontSize: 13,
              lineHeight: 22,
              minimap: { enabled: true },
              padding: { top: 14, bottom: 14 },
              smoothScrolling: true,
              stickyScroll: { enabled: false },
              overviewRulerLanes: 0,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            }}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="dev2-ide-statusbar h-6 shrink-0 flex items-center justify-between px-4 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500">
        <span>
          Ln {cursorInfo.line}, Col {cursorInfo.column} · UTF-8 · LF · {language.toUpperCase()}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          AI 컨텍스트: {activeFile ? `${activeFile.path.split("/").pop()}` : "없음"}
        </span>
      </div>
    </>
  );
}

function ToolbarBtn({
  icon: Icon,
  label,
  muted,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
        muted
          ? "text-gray-400 border-gray-100 hover:bg-gray-50"
          : "text-gray-600 border-gray-200 bg-white hover:border-indigo-300 hover:text-indigo-600"
      }`}
    >
      <Icon size={11} strokeWidth={2.2} />
      <span>{label}</span>
    </button>
  );
}

/* ─── Problem View ─── */

function ProblemView({
  problem,
  runLoading,
  testLoading,
  submitLoading,
  onRunCode,
  onRunTests,
  onSubmit
}: {
  problem: ProblemDetailType | null;
  runLoading: boolean;
  testLoading: boolean;
  submitLoading: boolean;
  onRunCode: () => void;
  onRunTests: () => void;
  onSubmit: () => void;
}) {
  const description = useMemo(
    () => problem?.description.replace(/^#\s+[^\n]+\n?/, "").trim() ?? "",
    [problem?.description]
  );
  const busy = runLoading || testLoading || submitLoading;

  if (!problem) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center px-8 py-7 text-sm text-gray-400">
        세션에 연결된 과제를 찾지 못했습니다.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto px-8 py-7">
      <div className="flex items-start gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-indigo-100 text-indigo-700">
              {problem.category}
            </span>
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">
              Lv {problem.level}
            </span>
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">
              {problem.status}
            </span>
          </div>
          <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight">
            {problem.title}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRunCode}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
              busy ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            {runLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
            실행
          </button>
          <button
            type="button"
            onClick={onRunTests}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
              busy ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-teal-300 text-teal-700 hover:bg-teal-50"
            }`}
          >
            {testLoading ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
            테스트
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-bold transition-colors cursor-pointer ${
              busy ? "opacity-70 cursor-not-allowed" : "hover:bg-indigo-700"
            }`}
          >
            {submitLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            제출
          </button>
        </div>
      </div>

      <p className="text-[15px] text-gray-600 leading-relaxed mb-6 max-w-3xl whitespace-pre-line">
        {description || problem.summary}
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6">
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="font-display font-bold text-gray-900 text-lg mb-3">요구 사항</h2>
            <ul className="space-y-2">
              {problem.requirements.map((requirement) => (
                <li key={requirement} className="flex items-start gap-2.5 text-[15px] text-gray-700">
                  <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-gray-900 text-lg mb-3">API 엔드포인트</h2>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">메서드</th>
                    <th className="text-left px-3 py-2 font-semibold">엔드포인트</th>
                  </tr>
                </thead>
                <tbody>
                  {problem.endpoints.map((endpoint) => {
                    const [methodCandidate, ...pathParts] = endpoint.split(" ");
                    const method = pathParts.length > 0 ? methodCandidate : "";
                    const path = pathParts.length > 0 ? pathParts.join(" ") : endpoint;
                    return (
                      <tr key={endpoint} className="border-t border-gray-100">
                        <td className="px-3 py-2 w-24">
                          {method ? (
                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                method === "GET"
                                  ? "bg-green-100 text-green-700"
                                  : method === "DELETE"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-indigo-100 text-indigo-700"
                              }`}
                            >
                              {method}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{path}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display font-bold text-gray-900 text-lg mb-3">공개 테스트 케이스</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {problem.publicCases.map((test) => (
                <div key={test.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{test.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">
                      공개
                    </span>
                  </div>
                  <code className="mt-3 block rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap">
                    {test.detail}
                  </code>
                  <p className="mt-2 text-xs font-semibold text-green-700">{test.result}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
            <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
              <Clock size={10} />
              예상 시간
            </div>
            <div className="font-display font-bold text-gray-900">{problem.estimate}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="font-display font-bold text-gray-900 text-[15px] mb-3">
              수용 기준
            </h3>
            <ul className="space-y-2">
              {problem.criteria.map((criterion) => (
                <li key={criterion} className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
                  <ListChecks size={13} className="mt-0.5 shrink-0 text-indigo-600" />
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
            <div className="flex items-center gap-2 font-display font-bold text-gray-900 text-[15px] mb-2">
              <Sparkles size={14} className="text-violet-600" />
              AI 활용 가이드
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{problem.aiGuide}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─── Trace View ─── */

function kindFromTraceType(t: TraceEvent["type"]): "llm" | "tool" | "patch" | "root" {
  if (t === "AI 요청" || t === "AI 응답") return "llm";
  if (t === "코드 수정") return "patch";
  return "tool";
}

type TraceSpanView = {
  id: string;
  name: string;
  kind: "llm" | "tool" | "patch" | "root";
  start: number;
  dur: number;
  active?: boolean;
  status?: string;
  detail?: string;
  meta?: string;
};

function kindFromAgentSpan(span: AgentRunTrace["spans"][number]): TraceSpanView["kind"] {
  if (span.patches.length > 0) return "patch";
  if (span.llmCalls.length > 0) return "llm";
  if (span.toolCalls.length > 0) return "tool";
  return "root";
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function TraceView({
  traces,
  agentRuns
}: {
  traces: TraceEvent[];
  agentRuns: AgentRunTrace[];
}) {
  const latestRun = agentRuns[0] ?? null;

  const { spans, total, runId, runTime, runStatus, summary, errorMessage, tokenTotal, costCredits } =
    useMemo(() => {
      if (latestRun) {
        const baseMs = new Date(latestRun.startedAt).getTime();
        const spansFromRun: TraceSpanView[] = [...latestRun.spans]
          .sort((a, b) => a.sequenceNo - b.sequenceNo)
          .map((span) => {
            const startedAt = new Date(span.startedAt).getTime();
            const endedAt = span.endedAt ? new Date(span.endedAt).getTime() : Date.now();
            const start = Math.max(0, startedAt - baseMs);
            const dur = Math.max(180, span.durationMs ?? endedAt - startedAt);
            const toolNames = span.toolCalls.map((call) => call.toolName).join(", ");
            const llmNames = span.llmCalls.map((call) => call.modelName).join(", ");
            const patchNames = span.patches.map((patch) => patch.filePath).join(", ");
            return {
              id: span.spanId,
              name: span.spanName,
              kind: kindFromAgentSpan(span),
              start,
              dur,
              active: span.status === "RUNNING" || span.status === "PENDING",
              status: span.status,
              detail: patchNames || toolNames || llmNames || undefined,
              meta:
                span.toolCalls.length > 0
                  ? `${span.toolCalls.length} tools`
                  : span.llmCalls.length > 0
                    ? `${span.llmCalls.length} llm`
                    : span.patches.length > 0
                      ? `${span.patches.length} patches`
                      : undefined
            };
          });
        const rawTotal =
          latestRun.durationMs ??
          spansFromRun.reduce((max, span) => Math.max(max, span.start + span.dur), 1000);
        return {
          spans: spansFromRun,
          total: Math.max(rawTotal, 1),
          runId: latestRun.agentTraceId.replace(/^trace-/, ""),
          runTime: new Date(latestRun.startedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          }),
          runStatus: latestRun.status,
          summary: latestRun.summaryText,
          errorMessage: latestRun.errorMessage,
          tokenTotal: latestRun.totalInputTokens + latestRun.totalOutputTokens,
          costCredits: latestRun.totalCostCredits
        };
      }

      let cursor = 0;
      const spansFromEvents: TraceSpanView[] = traces.map((event, index) => {
        const kind = kindFromTraceType(event.type);
        const dur = kind === "llm" ? 900 : kind === "patch" ? 650 : 460;
        const start = cursor;
        cursor += dur + 160;
        return {
          id: event.id,
          name: event.summary || event.type,
          kind,
          start,
          dur,
          active: index === traces.length - 1,
          status: event.type,
          detail: event.detail,
          meta: event.time
        };
      });
      const rawTotal = spansFromEvents.reduce((max, span) => Math.max(max, span.start + span.dur), 1000);
      return {
        spans: spansFromEvents,
        total: Math.max(rawTotal, 1),
        runId: traces[0]?.id.slice(0, 8) ?? "-",
        runTime: traces[0]?.time ?? "-",
        runStatus: traces.length > 0 ? "EVENTS" : "EMPTY",
        summary: null,
        errorMessage: null,
        tokenTotal: 0,
        costCredits: 0
      };
    }, [latestRun, traces]);

  const markers = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="flex-1 min-h-0 overflow-auto p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700">
          <GitBranch size={14} className="text-indigo-600" />
          Run {runId}
        </span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500 tabular-nums">{runTime}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-700 font-semibold tabular-nums">
          {formatDurationMs(total)}
        </span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-700 font-semibold tabular-nums">
          {spans.length} spans
        </span>
        {latestRun && (
          <>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-700 font-semibold tabular-nums">
              {tokenTotal.toLocaleString()} tokens
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-700 font-semibold tabular-nums">
              {costCredits} credits
            </span>
          </>
        )}
        {runStatus === "EMPTY" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
            대기
          </span>
        ) : runStatus === "RUNNING" || runStatus === "EVENTS" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            라이브
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              runStatus === "FAILED" ? "bg-rose-100 text-rose-700" : "bg-indigo-100 text-indigo-700"
            }`}
          >
            {runStatus}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <ToolbarBtn icon={Filter} label="필터" />
          <ToolbarBtn icon={SlidersHorizontal} label="뷰 옵션" />
        </div>
      </div>

      {(summary || errorMessage) && (
        <div
          className={`mb-4 rounded-xl border p-4 text-sm leading-relaxed ${
            errorMessage ? "border-rose-100 bg-rose-50 text-rose-700" : "border-indigo-100 bg-indigo-50/60 text-gray-700"
          }`}
        >
          {errorMessage ?? summary}
        </div>
      )}

      {/* Waterfall */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center text-[10px] text-gray-400 font-mono border-b border-gray-100 px-3 py-2">
          <span className="w-56 shrink-0" />
          <div className="flex-1 relative h-3">
            {markers.map((marker) => (
              <span
                key={marker}
                className="absolute top-0 tabular-nums"
                style={{ left: `${marker * 100}%`, transform: marker === 1 ? "translateX(-100%)" : undefined }}
              >
                {formatDurationMs(total * marker)}
              </span>
            ))}
          </div>
        </div>

        {spans.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            아직 표시할 Trace가 없습니다. AI 요청, 코드 실행, 테스트를 수행하면 여기에 기록됩니다.
          </div>
        )}

        {spans.map((s, i) => {
          const left = (s.start / total) * 100;
          const width = (s.dur / total) * 100;
          const color =
            s.kind === "llm"
              ? "#A78BFA"
              : s.kind === "tool"
                ? "#5EEAD4"
                : s.kind === "patch"
                  ? "#FCD34D"
                  : "#818CF8";
          const active = s.active;
          return (
            <div
              key={s.id}
              className={`flex items-center text-xs px-3 py-1.5 border-b border-gray-50 last:border-b-0 ${
                active ? "bg-indigo-50/60" : "hover:bg-gray-50"
              } transition-colors cursor-pointer`}
            >
              <div
                className="w-56 shrink-0 flex items-center gap-2 font-mono truncate"
                style={{ paddingLeft: i === 0 ? 0 : `${Math.min(i, 3) * 12}px` }}
              >
                {s.kind === "root" ? (
                  <ChevronDown size={10} className="text-gray-400" />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span
                  className={`truncate ${active ? "text-indigo-900 font-semibold" : "text-gray-700"}`}
                  title={s.detail}
                >
                  {s.name}
                </span>
                {s.status && (
                  <span
                    className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded ${
                      s.status === "FAILED"
                        ? "bg-rose-100 text-rose-700"
                        : s.status === "RUNNING"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {s.status}
                  </span>
                )}
              </div>
              <div className="flex-1 relative h-5">
                <div
                  className="absolute top-0.5 h-4 rounded-sm"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 0.5)}%`,
                    backgroundColor: color,
                    opacity: active ? 1 : 0.85
                  }}
                />
                <span
                  className="absolute top-0.5 h-4 flex items-center text-[10px] text-gray-500 font-mono tabular-nums"
                  style={{ left: `calc(${left + width}% + 6px)` }}
                >
                  {s.meta ? `${formatDurationMs(s.dur)} · ${s.meta}` : formatDurationMs(s.dur)}
                </span>
              </div>
            </div>
          );
        })}

        <div className="flex items-center gap-5 px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          <LegendDot color="#A78BFA" label="LLM" />
          <LegendDot color="#5EEAD4" label="도구" />
          <LegendDot color="#FCD34D" label="패치 / 재시도" />
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/* ───────────────────────────────────────────────── AI Pair */

function AiPairPanel({
  aiMode,
  setAiMode,
  composerValue,
  setComposerValue,
  attachments,
  setAttachments,
  messages,
  streaming,
  requestCount,
  aiQuota,
  onSend,
  sessionId,
  activeFile,
  onAfterMutation
}: {
  aiMode: "chat" | "edit";
  setAiMode: (m: "chat" | "edit") => void;
  composerValue: string;
  setComposerValue: (s: string) => void;
  attachments: string[];
  setAttachments: (a: string[]) => void;
  messages: AiMessage[];
  streaming: boolean;
  requestCount: number;
  aiQuota: number;
  onSend: () => void;
  sessionId: string;
  activeFile: WorkspaceFile | null;
  onAfterMutation?: () => void;
}) {
  const addToast = useUiStore((s) => s.addToast);
  const selectedCode = useIdeStore((s) => s.selectedCode);
  const suggestion = useIdeStore((s) => s.suggestion);
  const setSuggestion = useIdeStore((s) => s.setSuggestion);
  const updateFileContent = useIdeStore((s) => s.updateFileContent);
  const markSaved = useIdeStore((s) => s.markSaved);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming, suggestion]);

  const [editLoading, setEditLoading] = useState(false);

  const handleRequestEdit = useCallback(async () => {
    if (!activeFile) {
      addToast("먼저 편집할 파일을 선택해 주세요.", "warning");
      return;
    }
    if (!selectedCode.trim()) {
      addToast("에디터에서 수정할 코드 영역을 선택해 주세요.", "warning");
      return;
    }
    const instruction = composerValue.trim() || "선택 영역을 개선해 주세요.";
    setEditLoading(true);
    try {
      const next = await mockApi.requestAiEdit(
        sessionId,
        activeFile.path,
        activeFile.content,
        selectedCode,
        instruction
      );
      setSuggestion(next);
      setComposerValue("");
      addToast("AI 수정 제안이 준비되었습니다.", "success");
      onAfterMutation?.();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "AI 수정 실패", "error");
    } finally {
      setEditLoading(false);
    }
  }, [activeFile, selectedCode, composerValue, sessionId, setSuggestion, setComposerValue, addToast, onAfterMutation]);

  const handleApplySuggestion = useCallback(async () => {
    if (!activeFile || !suggestion) return;
    const nextContent = activeFile.content.replace(suggestion.original, suggestion.replacement);
    updateFileContent(activeFile.path, nextContent);
    try {
      await mockApi.applyAiEdit(sessionId, activeFile.path, nextContent, suggestion.summary);
      markSaved(activeFile.path, new Date().toISOString());
      addToast("패치를 적용했습니다.", "success");
      setSuggestion(null);
      onAfterMutation?.();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "패치 적용 실패", "error");
    }
  }, [activeFile, suggestion, updateFileContent, sessionId, markSaved, addToast, setSuggestion, onAfterMutation]);

  const placeholder =
    aiMode === "chat"
      ? "AI에게 질문하거나 요청할 내용을 입력하세요…"
      : "선택한 코드를 어떻게 고칠지 설명해 주세요…";

  const disabled = streaming || (aiMode === "edit" && editLoading);

  return (
    <aside className="dev2-ide-ai-panel w-full shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-gray-900 text-[16px]">AI 페어</span>
            <span className="inline-flex items-center text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              claude-sonnet-4-6
            </span>
          </div>
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
            {([
              { key: "chat", label: "채팅" },
              { key: "edit", label: "에이전트" }
            ] as const).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setAiMode(m.key)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  aiMode === m.key
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-gray-500 tabular-nums">
          요청 {requestCount}/{aiQuota} · 토큰 1.2k/8k
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && !streaming && aiMode === "chat" && (
          <div className="inline-flex items-start gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-gray-400" />
            <span>무엇을 도와드릴까요? 이 과제에 대해 자유롭게 질문해 보세요.</span>
          </div>
        )}

        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}

        {streaming && (
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
              <Sparkles size={13} className="animate-pulse" />
            </span>
            <div className="flex-1 min-w-0 text-sm text-gray-500 leading-relaxed">
              응답 생성 중
              <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-0.5 align-text-bottom animate-pulse" />
            </div>
          </div>
        )}

        {aiMode === "edit" && suggestion && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-indigo-700 font-semibold">
              <Sparkles size={12} />
              <span>AI 수정 제안</span>
            </div>
            <p className="text-sm text-gray-700">{suggestion.summary}</p>
            <div className="bg-[#0F0C2F] text-gray-100 rounded-lg p-3 text-[12px] font-mono leading-5 whitespace-pre overflow-x-auto max-h-60">
              {suggestion.replacement}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleApplySuggestion}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors cursor-pointer"
              >
                <Check size={10} strokeWidth={3} />
                적용하기
              </button>
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-white text-gray-700 border border-gray-200 hover:border-rose-300 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <X size={10} />
                거절
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-100 p-3">
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {attachments.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full"
              >
                {a}
                <button
                  type="button"
                  onClick={() => setAttachments(attachments.filter((x) => x !== a))}
                  className="text-gray-400 hover:text-rose-600 cursor-pointer"
                  aria-label="첨부 제거"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-colors">
          <textarea
            value={composerValue}
            onChange={(e) => setComposerValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (aiMode === "chat") onSend();
                else handleRequestEdit();
              }
            }}
            placeholder={placeholder}
            rows={2}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none resize-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100">
            <div className="flex items-center gap-0.5">
              <IconBtn
                icon={Paperclip}
                label="첨부"
                onClick={() => {
                  if (!activeFile) return;
                  const name = activeFile.path.split("/").pop() ?? activeFile.path;
                  if (attachments.includes(name)) return;
                  setAttachments([...attachments, name]);
                }}
              />
              <IconBtn icon={Slash} label="명령" />
              <IconBtn icon={Mic} label="받아쓰기" />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600 px-2 py-1 rounded border border-gray-200 hover:border-indigo-300 transition-colors cursor-pointer"
              >
                <span>Sonnet 4.6</span>
                <ChevronDown size={10} />
              </button>
              <button
                type="button"
                onClick={() => (aiMode === "chat" ? onSend() : handleRequestEdit())}
                disabled={disabled || !composerValue.trim()}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm transition-all cursor-pointer ${
                  disabled || !composerValue.trim()
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-md"
                }`}
                style={{ backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)" }}
              >
                {disabled ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} strokeWidth={2.4} />
                )}
                <span>{aiMode === "chat" ? "보내기" : "제안 요청"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="w-7 h-7 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors cursor-pointer"
    >
      <Icon size={13} strokeWidth={2} />
    </button>
  );
}

function ChatBubble({ message }: { message: AiMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2 text-sm text-white whitespace-pre-wrap"
          style={{ backgroundImage: "linear-gradient(90deg, #4F46E5, #6366F1)" }}
        >
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === "assistant") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
          <Sparkles size={13} strokeWidth={2.2} />
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-xs text-gray-400 tabular-nums">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  }
  // system / tool
  return (
    <div className="inline-flex items-start gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700">
      <Wrench size={14} className="shrink-0 mt-0.5 text-gray-400" />
      <span>{message.content}</span>
    </div>
  );
}

/* ───────────────────────────────────────────────── BottomTray */

function BottomTray({
  runResult,
  testResult,
  onRunCode,
  runLoading
}: {
  runResult: ReturnType<typeof useIdeStore.getState>["runResult"];
  testResult: ReturnType<typeof useIdeStore.getState>["testResult"];
  onRunCode: () => void;
  runLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<BottomTabKey>("terminal");

  // Auto-switch when new results arrive
  const prevRun = useRef(runResult);
  const prevTest = useRef(testResult);
  useEffect(() => {
    if (runResult && runResult !== prevRun.current) {
      setActiveTab("terminal");
      prevRun.current = runResult;
    }
  }, [runResult]);
  useEffect(() => {
    if (testResult && testResult !== prevTest.current) {
      setActiveTab("tests");
      prevTest.current = testResult;
    }
  }, [testResult]);

  const problemCount = testResult?.failed ?? 0;

  const tabs: { key: BottomTabKey; label: string; count?: number }[] = [
    { key: "terminal", label: "터미널" },
    { key: "tests", label: "테스트" },
    { key: "problems", label: "문제", count: problemCount || undefined },
    { key: "output", label: "출력" }
  ];

  return (
    <section className="dev2-ide-bottom-panel h-full shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 gap-2">
        <div className="flex items-center gap-1">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{t.label}</span>
                {t.count != null && (
                  <span
                    className={`text-[9px] font-bold px-1 py-0 rounded ${
                      active ? "bg-indigo-100 text-indigo-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRunCode}
            disabled={runLoading}
            aria-busy={runLoading}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
              runLoading
                ? "border-indigo-100 text-indigo-300 cursor-not-allowed opacity-70"
                : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            {runLoading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} strokeWidth={2.4} />
            )}
            {runLoading ? "실행 중…" : "코드 실행"}
          </button>
          <IconBtn icon={Plus} label="새 터미널" />
          <IconBtn icon={SplitSquareVertical} label="분할" />
          <IconBtn icon={Trash2} label="지우기" />
        </div>
      </div>
      <div className="dev2-ide-terminal flex-1 min-h-0 p-3 bg-[#0F0C2F] font-mono text-xs text-gray-200 overflow-auto">
        {activeTab === "terminal" && <TerminalBody runResult={runResult} />}
        {activeTab === "tests" && <TestsBody testResult={testResult} />}
        {activeTab === "problems" && <ProblemsBody testResult={testResult} />}
        {activeTab === "output" && <OutputBody runResult={runResult} />}
      </div>
    </section>
  );
}

function TerminalBody({
  runResult
}: {
  runResult: ReturnType<typeof useIdeStore.getState>["runResult"];
}) {
  if (!runResult) {
    return (
      <pre className="leading-5 text-gray-400">
        <span className="text-gray-500">$</span> <span className="text-gray-500">코드 실행 버튼을 눌러 보세요.</span>
        {"\n"}
        <span className="inline-block w-2 h-4 bg-gray-500 align-text-bottom animate-pulse" />
      </pre>
    );
  }
  const isOk = runResult.status === "COMPLETED";
  return (
    <pre className="leading-5 whitespace-pre-wrap">
      <span className="text-gray-400">$</span>{" "}
      <span className={isOk ? "text-teal-300" : "text-rose-300"}>
        {isOk ? "[완료]" : "[오류]"} exit {runResult.exitCode} · {runResult.durationMs}ms
      </span>
      {"\n"}
      {runResult.stdout && <span className="text-gray-200">{runResult.stdout}</span>}
      {runResult.stderr && <span className="text-rose-400">{runResult.stderr}</span>}
      {"\n"}
      <span className="text-gray-400">$</span>{" "}
      <span className="inline-block w-2 h-4 bg-gray-300 align-text-bottom animate-pulse" />
    </pre>
  );
}

function TestsBody({
  testResult
}: {
  testResult: ReturnType<typeof useIdeStore.getState>["testResult"];
}) {
  if (!testResult) {
    return <div className="text-gray-400">테스트 실행 로그가 없습니다. 상단 “테스트 실행” 버튼을 눌러 보세요.</div>;
  }
  return (
    <div className="space-y-1.5">
      <div className="text-gray-300">
        총 {testResult.total} · 통과{" "}
        <span className="text-teal-300">{testResult.passed}</span> · 실패{" "}
        <span className="text-rose-300">{testResult.failed}</span>
      </div>
      <div className="space-y-0.5">
        {testResult.results.map((r) => (
          <div
            key={r.id}
            className={`flex items-center justify-between gap-3 ${
              r.status === "PASS" ? "text-teal-300" : "text-rose-300"
            }`}
          >
            <span className="truncate">
              {r.status === "PASS" ? "✓" : "✕"} {r.name}
            </span>
            <span className="tabular-nums text-gray-400">{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProblemsBody({
  testResult
}: {
  testResult: ReturnType<typeof useIdeStore.getState>["testResult"];
}) {
  if (!testResult) {
    return <div className="text-gray-400">감지된 문제가 없습니다.</div>;
  }
  const fails = testResult.results.filter((r) => r.status === "FAIL");
  if (!fails.length) {
    return <div className="text-teal-300">모든 테스트가 통과했습니다.</div>;
  }
  return (
    <div className="space-y-1">
      {fails.map((r) => (
        <div key={r.id} className="text-rose-400">
          ✕ {r.name} {r.detail ? `— ${r.detail}` : ""}
        </div>
      ))}
    </div>
  );
}

function OutputBody({
  runResult
}: {
  runResult: ReturnType<typeof useIdeStore.getState>["runResult"];
}) {
  if (!runResult || !runResult.stdout) {
    return <div className="text-gray-400">출력이 없습니다.</div>;
  }
  return <pre className="leading-5 whitespace-pre-wrap text-gray-200">{runResult.stdout}</pre>;
}

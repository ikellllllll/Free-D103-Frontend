"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { LangIcon } from "@/components/common/LangIcon";
import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { TracePanel } from "@/components/ide/TracePanel";
import { TraceWorkbench } from "@/components/ide/TraceWorkbench";
import { useAiChat } from "@/hooks/useAiChat";
import { useAutoSave } from "@/hooks/useAutoSave";
import { mockApi } from "@/lib/api/mockApi";
import { problemApi } from "@/lib/api/problemApi";
import { isBackendProblemId, isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import { getProblemById } from "@/lib/mock-data";
import type { TraceEvent } from "@/lib/types/ai";
import type { WorkspaceFile } from "@/lib/types/session";
import type { BottomPanelTab, SelectionRange, SidebarView } from "@/store/ideStore";
import { useIdeStore } from "@/store/ideStore";
import { useThemeStore } from "@/store/themeStore";
import { useUiStore } from "@/store/uiStore";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="editor-loading">에디터를 불러오는 중...</div>
});

const MonacoDiffEditor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.DiffEditor), {
  ssr: false,
  loading: () => <div className="editor-loading">Diff 에디터를 불러오는 중...</div>
});

const activityItems: Array<{ id: SidebarView; short: string; label: string; description: string }> = [
  { id: "explorer",   short: "EX", label: "탐색기",      description: "파일 트리" },
  { id: "search",     short: "SR", label: "검색",        description: "파일명과 코드 검색" },
  { id: "trace",      short: "TR", label: "Trace",       description: "에이전트 실행 기록" },
  { id: "extensions", short: "XT", label: "확장",        description: "설치된 워크벤치 도구" }
];

const bottomTabs: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "output", label: "출력" },
  { id: "tests", label: "테스트" },
  { id: "trace", label: "Trace" }
];

const AI_REQUEST_QUOTA = 5;
const SOLVE_TIMER_INTERVAL_MS = 1000;
const MAX_SELECTED_CODE_CHARS = 12000;

const extensionItems = [
  {
    name: "AIG Assistant",
    summary: "AI 채팅, 코드 수정, 제출 흐름을 IDE 안에서 묶어 주는 보조 패널",
    state: "활성"
  },
  {
    name: "Extension Pack for Java",
    summary: "Java 편집, 테스트 실행, 패키지 구조 탐색용 기본 확장 묶음",
    state: "설치됨"
  },
  {
    name: "Spring Boot Dashboard",
    summary: "서비스 실행과 테스트 흐름을 시각적으로 정리하는 보조 도구",
    state: "설치됨"
  },
  {
    name: "REST Client",
    summary: "엔드포인트 확인과 요청 흐름 점검에 쓰는 API 실험 도구",
    state: "추천"
  }
];

const INITIAL_AGENT_SNAPSHOT_VERSION = 1;

type ExplorerSectionKey = "project";
type DragMode = "sidebar" | "ai" | "bottom";

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

interface TreeNode {
  key: string;
  name: string;
  path: string | null;
  kind: "folder" | "file";
  file?: ExplorerFile;
  children: TreeNode[];
}

interface ExplorerFile extends WorkspaceFile {
  isVirtual?: boolean;
  badge?: string;
}

interface FileWorkspaceTab {
  id: string;
  kind: "file";
  path: string;
  title: string;
  file: WorkspaceFile;
}

interface DiffWorkspaceTab {
  id: string;
  kind: "diff";
  path: string;
  title: string;
  sourcePath: string;
  sourceFile: WorkspaceFile;
  targetFile: ExplorerFile;
}

type WorkspaceTab = FileWorkspaceTab | DiffWorkspaceTab;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const pad2 = (value: number) => String(value).padStart(2, "0");
const toTimestamp = (value?: string | null) => {
  if (!value) return Date.now();
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
};
const formatSolveElapsed = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}일 ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  return `${pad2(minutes)}:${pad2(seconds)}`;
};
const clampSelectionCode = (code: string) =>
  code.length > MAX_SELECTED_CODE_CHARS ? `${code.slice(0, MAX_SELECTED_CODE_CHARS)}\n/* selection truncated */` : code;
const getFileName = (path: string) => path.split("/").pop() ?? path;
const getFolderPath = (path: string) => path.split("/").slice(0, -1).join("/");
const getFileExtension = (file: Pick<WorkspaceFile, "path" | "language">) => {
  const name = getFileName(file.path);
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  return extension || file.language.toLowerCase();
};
const DIFF_TAB_PREFIX = "diff:";
const isDiffTabId = (value: string) => value.startsWith(DIFF_TAB_PREFIX);
const createDiffTabId = (path: string) => `${DIFF_TAB_PREFIX}${path}`;
const getWorktreeSourcePath = (path: string) => path.replace(/^\.worktree\//, "src/");
const getMaxSidebarWidth = (viewportWidth: number) => {
  if (viewportWidth <= 0) {
    return 280;
  }

  if (viewportWidth <= 1180) {
    return clamp(Math.round(viewportWidth * 0.22), 200, 228);
  }

  if (viewportWidth <= 1360) {
    return clamp(Math.round(viewportWidth * 0.23), 220, 248);
  }

  return clamp(Math.round(viewportWidth * 0.26), 248, 420);
};

const getMaxAiPanelWidth = (viewportWidth: number) => {
  if (viewportWidth <= 0) {
    return 360;
  }

  if (viewportWidth <= 1180) {
    return clamp(Math.round(viewportWidth * 0.25), 240, 280);
  }

  if (viewportWidth <= 1360) {
    return clamp(Math.round(viewportWidth * 0.28), 280, 320);
  }

  return clamp(Math.round(viewportWidth * 0.28), 320, 520);
};

const getMaxBottomPanelHeight = (viewportHeight: number) => {
  if (viewportHeight <= 0) {
    return 220;
  }

  return clamp(Math.round(viewportHeight * 0.3), 168, 360);
};

const getFileToken = (file: Pick<WorkspaceFile, "path" | "language">) => {
  const extension = file.path.split(".").pop()?.toLowerCase();

  if (extension === "java") {
    return "JV";
  }

  if (extension === "py") {
    return "PY";
  }

  if (extension === "md") {
    return "MD";
  }

  if (extension === "json") {
    return "{}";
  }

  if (extension === "yml" || extension === "yaml") {
    return "YM";
  }

  if (extension === "ts") {
    return "TS";
  }

  if (extension === "js") {
    return "JS";
  }

  return file.language.slice(0, 2).toUpperCase();
};

const buildExplorerFiles = (files: WorkspaceFile[]): ExplorerFile[] => {
  const sourceFiles = files.map((file) => ({
    ...file,
    isVirtual: file.path.startsWith(".worktree/"),
    badge: file.path.startsWith(".worktree/") ? "ai" : undefined
  }));
  const existingPaths = new Set(sourceFiles.map((file) => file.path));

  const agentSupportFiles: ExplorerFile[] = [
    {
      path: "agent/skills/README.md",
      language: "markdown",
      content: "# Agent Skills\n\n가상 탐색기 구조용 보조 파일입니다.",
      isVirtual: true,
      badge: "meta"
    },
    {
      path: "agent/.sandbox/README.md",
      language: "markdown",
      content: "# Agent Sandbox\n\n임시 실행 흔적을 두는 가상 디렉터리입니다.",
      isVirtual: true,
      badge: "temp"
    },
    {
      path: "agent/instuction.md",
      language: "markdown",
      content: "# Agent Instuction\n\n에이전트 보조 지시를 두는 가상 파일입니다.",
      isVirtual: true,
      badge: "meta"
    }
  ].filter((file) => !existingPaths.has(file.path));

  return [...sourceFiles, ...agentSupportFiles];
};

const buildFileTree = (files: ExplorerFile[]) => {
  const root: TreeNode = {
    key: "root",
    name: "root",
    path: null,
    kind: "folder",
    children: []
  };

  files.forEach((file) => {
    const segments = file.path.split("/");
    let current = root;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;

      if (isFile) {
        current.children.push({
          key: currentPath,
          name: segment,
          path: file.path,
          kind: "file",
          file,
          children: []
        });
        return;
      }

      let folder = current.children.find((node) => node.kind === "folder" && node.name === segment);

      if (!folder) {
        folder = {
          key: currentPath,
          name: segment,
          path: currentPath,
          kind: "folder",
          children: []
        };
        current.children.push(folder);
      }

      current = folder;
    });
  });

  const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
    [...nodes]
      .sort((left, right) => {
        const rootFolderOrder: Record<string, number> = {
          src: 0,
          agent: 1,
          ".worktree": 2
        };

        const leftRank = left.kind === "folder" && left.path && !left.path.includes("/") ? rootFolderOrder[left.name] ?? 99 : 99;
        const rightRank = right.kind === "folder" && right.path && !right.path.includes("/") ? rootFolderOrder[right.name] ?? 99 : 99;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (left.kind !== right.kind) {
          return left.kind === "folder" ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children)
      }));

  return sortNodes(root.children);
};

export function IdeShell({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { withPrefix } = useRouteScope();
  const { themeTone } = useDevTheme();
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);
  const setWorkspace = useIdeStore((state) => state.setWorkspace);
  const resetSession = useIdeStore((state) => state.resetSession);
  const activePath = useIdeStore((state) => state.activePath);
  const files = useIdeStore((state) => state.files);
  const unsavedPaths = useIdeStore((state) => state.unsavedPaths);
  const setActivePath = useIdeStore((state) => state.setActivePath);
  const updateFileContent = useIdeStore((state) => state.updateFileContent);
  const selectedCode = useIdeStore((state) => state.selectedCode);
  const selectedRange = useIdeStore((state) => state.selectedRange);
  const setSelection = useIdeStore((state) => state.setSelection);
  const editInstruction = useIdeStore((state) => state.editInstruction);
  const setEditInstruction = useIdeStore((state) => state.setEditInstruction);
  const suggestion = useIdeStore((state) => state.suggestion);
  const setSuggestion = useIdeStore((state) => state.setSuggestion);
  const aiMode = useIdeStore((state) => state.aiMode);
  const setAiMode = useIdeStore((state) => state.setAiMode);
  const runResult = useIdeStore((state) => state.runResult);
  const testResult = useIdeStore((state) => state.testResult);
  const setRunResult = useIdeStore((state) => state.setRunResult);
  const setTestResult = useIdeStore((state) => state.setTestResult);
  const lastSavedAt = useIdeStore((state) => state.lastSavedAt);
  const sidebarView = useIdeStore((state) => state.sidebarView);
  const sidebarOpen = useIdeStore((state) => state.sidebarOpen);
  const sidebarWidth = useIdeStore((state) => state.sidebarWidth);
  const aiOpen = useIdeStore((state) => state.aiOpen);
  const aiPanelWidth = useIdeStore((state) => state.aiPanelWidth);
  const bottomPanelOpen = useIdeStore((state) => state.bottomPanelOpen);
  const bottomPanelTab = useIdeStore((state) => state.bottomPanelTab);
  const bottomPanelHeight = useIdeStore((state) => state.bottomPanelHeight);
  const setSidebarView = useIdeStore((state) => state.setSidebarView);
  const setSidebarOpen = useIdeStore((state) => state.setSidebarOpen);
  const setSidebarWidth = useIdeStore((state) => state.setSidebarWidth);
  const toggleAiOpen = useIdeStore((state) => state.toggleAiOpen);
  const setAiOpen = useIdeStore((state) => state.setAiOpen);
  const setAiPanelWidth = useIdeStore((state) => state.setAiPanelWidth);
  const setBottomPanelOpen = useIdeStore((state) => state.setBottomPanelOpen);
  const setBottomPanelTab = useIdeStore((state) => state.setBottomPanelTab);
  const setBottomPanelHeight = useIdeStore((state) => state.setBottomPanelHeight);
  const theme = useThemeStore((state) => state.theme);

  const editorRef = useRef<any>(null);
  const diffEditorRef = useRef<any>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const monacoRef = useRef<any>(null);
  const editorDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const trackedModelUrisRef = useRef<Set<string>>(new Set());
  const selectionDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [extensionQuery, setExtensionQuery] = useState("");
  const [agentSnapshotVersion, setAgentSnapshotVersion] = useState(INITIAL_AGENT_SNAPSHOT_VERSION);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<"code" | "problem" | "trace">("code");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [openTabPaths, setOpenTabPaths] = useState<string[]>([]);
  const [solveNow, setSolveNow] = useState(() => Date.now());
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [explorerSections, setExplorerSections] = useState<Record<ExplorerSectionKey, boolean>>({
    project: true
  });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const isV0 = isV0ThemeTone(themeTone);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => mockApi.getSession(sessionId)
  });
  const { data: workspace } = useQuery({
    queryKey: ["workspace", sessionId],
    queryFn: () => (isBackendSessionId(sessionId) ? sessionApi.getWorkspace(sessionId) : mockApi.getWorkspace(sessionId)),
    enabled: !!session
  });
  const isApiProblem = isBackendProblemId(session?.problemId ?? "");
  const { data: apiProblem } = useQuery({
    queryKey: ["problem", session?.problemId],
    queryFn: () => problemApi.getProblemDetail(session!.problemId),
    enabled: !!session?.problemId && isApiProblem
  });

  const maxSidebarWidth = getMaxSidebarWidth(viewportSize.width);
  const maxAiPanelWidth = getMaxAiPanelWidth(viewportSize.width);
  const maxBottomPanelHeight = getMaxBottomPanelHeight(viewportSize.height);
  const effectiveSidebarWidth = Math.min(sidebarWidth, maxSidebarWidth);
  const effectiveAiPanelWidth = Math.min(aiPanelWidth, maxAiPanelWidth);
  const effectiveBottomPanelHeight = Math.min(bottomPanelHeight, maxBottomPanelHeight);

  const requestEditorLayout = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const editor = activeTabId && isDiffTabId(activeTabId) ? diffEditorRef.current : editorRef.current;
        const host = editorHostRef.current;

        if (!editor || !host || typeof editor.layout !== "function") {
          return;
        }

        const width = host.clientWidth;
        const height = host.clientHeight;

        if (!width || !height) {
          return;
        }

        editor.layout({ width, height });
      });
    });
  }, []);

  const syncMonacoAuxInputs = useCallback(() => {
    const host = editorHostRef.current;

    if (!host) {
      return;
    }

    const imeTextarea = host.querySelector<HTMLTextAreaElement>("textarea.ime-text-area");

    if (imeTextarea) {
      imeTextarea.id = "ide-ime-textarea";
      imeTextarea.setAttribute("name", "ide-ime-textarea");
    }
  }, []);

  const updateCursorPosition = useCallback((next: { line: number; column: number }) => {
    setCursorPosition((current) =>
      current.line === next.line && current.column === next.column ? current : next
    );
  }, []);

  const cleanupEditorSubscriptions = useCallback(() => {
    if (selectionDebounceTimerRef.current) {
      clearTimeout(selectionDebounceTimerRef.current);
      selectionDebounceTimerRef.current = null;
    }

    editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
    editorDisposablesRef.current = [];
  }, []);

  const trackMonacoModels = useCallback((editor: any, monaco?: any) => {
    if (monaco) {
      monacoRef.current = monaco;
    }

    const model = editor?.getModel?.();
    const models = model?.original || model?.modified
      ? [model.original, model.modified]
      : model
        ? [model]
        : [];

    models.forEach((item) => {
      const uri = item?.uri?.toString?.();
      if (uri) {
        trackedModelUrisRef.current.add(uri);
      }
    });
  }, []);

  const disposeTrackedMonacoModels = useCallback(() => {
    const monaco = monacoRef.current;
    const trackedUris = trackedModelUrisRef.current;

    if (!monaco?.editor?.getModels || trackedUris.size === 0) {
      return;
    }

    monaco.editor.getModels().forEach((model: any) => {
      const uri = model?.uri?.toString?.();
      if (uri && trackedUris.has(uri)) {
        model.dispose?.();
      }
    });

    trackedUris.clear();
  }, []);

  const { messages, streaming, requestCount, loadMessages, send } = useAiChat(sessionId);
  useAutoSave(sessionId);

  useEffect(() => {
    const syncViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    return () => {
      resetSession();
    };
  }, [resetSession]);

  useEffect(() => {
    return () => {
      cleanupEditorSubscriptions();
      disposeTrackedMonacoModels();
      editorRef.current = null;
      diffEditorRef.current = null;
      monacoRef.current = null;
    };
  }, [cleanupEditorSubscriptions, disposeTrackedMonacoModels]);

  useEffect(() => {
    if (workspace?.files?.length) {
      setWorkspace(workspace.files, workspace.files[1]?.path ?? workspace.files[0]?.path);
    }
  }, [setWorkspace, workspace]);

  useEffect(() => {
    if (session) {
      void loadMessages();
    }
  }, [loadMessages, session]);

  useEffect(() => {
    if (!session?.createdAt) {
      return;
    }

    const syncSolveNow = () => setSolveNow(Date.now());
    syncSolveNow();

    const timerId = window.setInterval(syncSolveNow, SOLVE_TIMER_INTERVAL_MS);
    document.addEventListener("visibilitychange", syncSolveNow);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", syncSolveNow);
    };
  }, [session?.createdAt]);

  useEffect(() => {
    setCollapsedFolders(new Set());
  }, [sessionId]);

  useEffect(() => {
    if (selectedCode) {
      setAiOpen(true);
    }
  }, [selectedCode, setAiOpen]);

  useEffect(() => {
    if (!chatScrollRef.current) {
      return;
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    if (!editorHostRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      requestEditorLayout();
    });

    observer.observe(editorHostRef.current);

    return () => {
      observer.disconnect();
    };
  }, [activeWorkbenchTab, requestEditorLayout]);

  useEffect(() => {
    if (!editorHostRef.current || typeof MutationObserver === "undefined") {
      return;
    }

    syncMonacoAuxInputs();

    const observer = new MutationObserver(() => {
      syncMonacoAuxInputs();
    });

    observer.observe(editorHostRef.current, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
    };
  }, [activeWorkbenchTab, syncMonacoAuxInputs]);

  useEffect(() => {
    const clampWorkbenchLayout = () => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const nextBottomMax = getMaxBottomPanelHeight(viewportHeight);
      if (bottomPanelHeight > nextBottomMax) {
        setBottomPanelHeight(nextBottomMax);
      }

      const nextAiMax = getMaxAiPanelWidth(viewportWidth);
      if (aiPanelWidth > nextAiMax) {
        setAiPanelWidth(nextAiMax);
      }

      const nextSidebarMax = getMaxSidebarWidth(viewportWidth);
      if (sidebarWidth > nextSidebarMax) {
        setSidebarWidth(nextSidebarMax);
      }
    };

    clampWorkbenchLayout();
    window.addEventListener("resize", clampWorkbenchLayout);

    return () => {
      window.removeEventListener("resize", clampWorkbenchLayout);
    };
  }, [aiPanelWidth, bottomPanelHeight, setAiPanelWidth, setBottomPanelHeight, setSidebarWidth, sidebarWidth]);

  useEffect(() => {
    requestEditorLayout();
  }, [
    activePath,
    activeWorkbenchTab,
    aiOpen,
    bottomPanelOpen,
    effectiveAiPanelWidth,
    effectiveBottomPanelHeight,
    effectiveSidebarWidth,
    requestEditorLayout,
    sidebarOpen,
    viewportSize.height,
    viewportSize.width
  ]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      if (dragState.mode === "sidebar") {
        const nextWidth = clamp(dragState.startWidth + (event.clientX - dragState.startX), 220, maxSidebarWidth);
        setSidebarWidth(nextWidth);
        return;
      }

      if (dragState.mode === "ai") {
        const nextWidth = clamp(dragState.startWidth - (event.clientX - dragState.startX), 280, maxAiPanelWidth);
        setAiPanelWidth(nextWidth);
        return;
      }

      const nextHeight = clamp(dragState.startHeight - (event.clientY - dragState.startY), 140, maxBottomPanelHeight);
      setBottomPanelHeight(nextHeight);
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [maxAiPanelWidth, maxBottomPanelHeight, maxSidebarWidth, setAiPanelWidth, setBottomPanelHeight, setSidebarWidth]);

  const problem = useMemo(
    () => apiProblem ?? getProblemById(session?.problemId ?? "todo-api"),
    [apiProblem, session?.problemId]
  );
  const traces = useMemo(() => session?.traces ?? [], [session?.traces]);
  const explorerFiles = useMemo(() => buildExplorerFiles(files), [files]);
  const fileTree = useMemo(() => buildFileTree(explorerFiles), [explorerFiles]);
  const openTabs = useMemo(
    () =>
      openTabPaths
        .map((path): WorkspaceTab | null => {
          if (isDiffTabId(path)) {
            const targetPath = path.slice(DIFF_TAB_PREFIX.length);
            const targetFile = explorerFiles.find((file) => file.path === targetPath && file.isVirtual);
            const sourcePath = getWorktreeSourcePath(targetPath);
            const sourceFile = files.find((file) => file.path === sourcePath);

            if (!targetFile || !sourceFile) {
              return null;
            }

            return {
              id: path,
              kind: "diff",
              path,
              title: `${getFileName(sourcePath)} diff`,
              sourcePath,
              sourceFile,
              targetFile
            };
          }

          const file = explorerFiles.find((item) => item.path === path);

          if (!file) {
            return null;
          }

          return {
            id: path,
            kind: "file",
            path,
            title: getFileName(path),
            file
          };
        })
        .filter((tab): tab is WorkspaceTab => Boolean(tab)),
    [explorerFiles, files, openTabPaths]
  );
  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.id === activeTabId) ?? openTabs[0] ?? null,
    [activeTabId, openTabs]
  );
  const activeFile = useMemo(() => {
    if (activeTab?.kind === "diff") {
      return activeTab.sourceFile;
    }

    if (activeTab?.kind === "file") {
      return activeTab.file;
    }

    return files.find((file) => file.path === activePath) ?? files[0] ?? null;
  }, [activePath, activeTab, files]);

  useEffect(() => {
    if (!files.length) {
      setOpenTabPaths((state) => (state.length ? [] : state));
      setActiveTabId((state) => (state === null ? state : null));
      return;
    }

    const fallbackPath = activePath ?? files[0].path;

    setOpenTabPaths((state) => {
      const filtered = state.filter((path) => {
        if (isDiffTabId(path)) {
          const targetPath = path.slice(DIFF_TAB_PREFIX.length);
          return explorerFiles.some((file) => file.path === targetPath && file.isVirtual);
        }

        return files.some((file) => file.path === path) || explorerFiles.some((file) => file.path === path && file.isVirtual);
      });

      const next = activeTabId || filtered.length ? filtered : [fallbackPath];
      return areStringArraysEqual(state, next) ? state : next;
    });

    if (!activeTabId) {
      setActiveTabId(fallbackPath);
    }
  }, [activePath, activeTabId, explorerFiles, files]);

  useEffect(() => {
    if (!openTabs.length) {
      if (activeTabId) {
        setActiveTabId(null);
      }
      return;
    }

    if (!activeTabId || !openTabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(openTabs[0].id);
    }
  }, [activeTabId, openTabs]);

  useEffect(() => {
    if (!activeTab) {
      return;
    }

    const nextPath = activeTab.kind === "diff" ? activeTab.sourcePath : activeTab.path;

    if (nextPath !== activePath) {
      setActivePath(nextPath);
    }

    if (activeTab.kind === "diff") {
      setSelection("", null);
      setSuggestion(null);
      setAiMode("chat");
    }
  }, [activePath, activeTab, setActivePath, setAiMode, setSelection, setSuggestion]);

  const searchMatches = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return [];
    }

    return files.flatMap((file) => {
      const pathMatch = file.path.toLowerCase().includes(keyword)
        ? [
            {
              key: `${file.path}-path`,
              path: file.path,
              lineNumber: 1,
              preview: file.path
            }
          ]
        : [];

      const lineMatches = file.content
        .split("\n")
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter((line) => line.line.toLowerCase().includes(keyword))
        .slice(0, 5)
        .map((line) => ({
          key: `${file.path}-${line.lineNumber}`,
          path: file.path,
          lineNumber: line.lineNumber,
          preview: line.line.trim() || "(빈 줄)"
        }));

      return [...pathMatch, ...lineMatches];
    });
  }, [files, searchQuery]);
  const extensionMatches = useMemo(() => {
    const keyword = extensionQuery.trim().toLowerCase();

    if (!keyword) {
      return extensionItems;
    }

    return extensionItems.filter((item) =>
      `${item.name} ${item.summary} ${item.state}`.toLowerCase().includes(keyword)
    );
  }, [extensionQuery]);

  const selectionSummary = selectedRange
    ? `${selectedRange.startLineNumber}:${selectedRange.startColumn} - ${selectedRange.endLineNumber}:${selectedRange.endColumn}`
    : "선택 없음";
  const selectionLabel = selectedRange
    ? `${Math.abs(selectedRange.endLineNumber - selectedRange.startLineNumber) + 1}줄 선택`
    : `Ln ${cursorPosition.line}, Col ${cursorPosition.column}`;
  const lineCount = activeFile?.content.split("\n").length ?? 0;
  const requestTotal = requestCount || session?.aiRequestCount || 0;
  const aiQuotaLabel = `${Math.min(requestTotal, AI_REQUEST_QUOTA)}/${AI_REQUEST_QUOTA}`;
  const agentSnapshotLabel = `v0.${agentSnapshotVersion}`;
  const dirtyCount = unsavedPaths.length;
  const problemRequirementsCount = problem?.requirements.length ?? 0;
  const problemCasesCount = problem?.publicCases.length ?? 0;
  const breadcrumbParts =
    activeWorkbenchTab === "problem"
      ? ["problem", problem?.title ?? "brief"]
      : activeWorkbenchTab === "trace"
        ? ["trace", "에이전트 실행 기록"]
        : activeFile?.path.split("/") ?? [];
  const bottomTabMeta: Record<BottomPanelTab, string> = {
    output: runResult ? `code ${runResult.exitCode}` : "ready",
    tests: testResult ? `${testResult.passed}/${testResult.total}` : "idle",
    trace: `${traces.length}`
  };
  const activityMeta: Record<SidebarView | "ai" | "output", string | null> = {
    explorer: dirtyCount ? `${dirtyCount}` : openTabs.length ? `${openTabs.length}` : `${files.length}`,
    search: searchQuery.trim() ? `${searchMatches.length}` : null,
    trace: null,
    extensions: `${extensionItems.length}`,
    ai: aiQuotaLabel,
    output: testResult ? `${testResult.failed}` : traces.length ? `${traces.length}` : null
  };
  const lastSavedLabel = lastSavedAt
    ? `저장 ${new Date(lastSavedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })}`
    : "자동 저장 대기";
  const solveElapsedLabel = formatSolveElapsed(solveNow - toTimestamp(session?.createdAt));
  const solveTargetLabel = problem?.estimate ? `목표 ${problem.estimate}` : "목표 미정";
  const showEmptyEditor = activeWorkbenchTab === "code" && openTabs.length === 0;
  const showBottomPanel = bottomPanelOpen;

  const handleMount = (editor: any, monaco: any) => {
    cleanupEditorSubscriptions();
    editorRef.current = editor;
    trackMonacoModels(editor, monaco);
    const initialPosition = editor.getPosition();

    if (initialPosition) {
      updateCursorPosition({
        line: initialPosition.lineNumber,
        column: initialPosition.column
      });
    }

    const selectionDisposable = editor.onDidChangeCursorSelection(() => {
      if (selectionDebounceTimerRef.current) clearTimeout(selectionDebounceTimerRef.current);
      selectionDebounceTimerRef.current = setTimeout(() => {
        const selection = editor.getSelection();

        if (!selection || selection.isEmpty()) {
          const position = editor.getPosition();

          if (position) {
            updateCursorPosition({
              line: position.lineNumber,
              column: position.column
            });
          }

          setSelection("", null);
          return;
        }

        const position = selection.getPosition();
        const model = editor.getModel();
        if (!model) return;

        const code = clampSelectionCode(model.getValueInRange(selection) ?? "");
        const lineCount = model.getLineCount();
        const startLine = Math.min(selection.startLineNumber, lineCount);
        const endLine = Math.min(selection.endLineNumber, lineCount);
        const range: SelectionRange = {
          startLineNumber: startLine,
          startColumn: selection.startColumn,
          endLineNumber: endLine,
          endColumn: selection.endColumn
        };

        updateCursorPosition({
          line: position.lineNumber,
          column: position.column
        });
        setSelection(code, range);
      }, 80);
    });
    editorDisposablesRef.current.push(selectionDisposable);

    requestEditorLayout();
    syncMonacoAuxInputs();
  };

  const handleDiffMount = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;
    trackMonacoModels(editor, monaco);
    requestEditorLayout();
  };

  const handleTabRailWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    const rail = event.currentTarget;

    if (rail.scrollWidth <= rail.clientWidth) {
      return;
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

    if (!delta) {
      return;
    }

    rail.scrollLeft += delta;
  }, []);

  const beginResize = (mode: DragMode) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: mode === "sidebar" ? effectiveSidebarWidth : effectiveAiPanelWidth,
      startHeight: effectiveBottomPanelHeight
    };

    document.body.style.cursor = mode === "bottom" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  };

  const focusLine = (path: string, lineNumber?: number) => {
    setActiveWorkbenchTab("code");
    setOpenTabPaths((state) => (state.includes(path) ? state : [...state, path]));
    setActiveTabId(path);
    setActivePath(path);

    window.requestAnimationFrame(() => {
      if (!editorRef.current || !lineNumber) {
        return;
      }

      editorRef.current.focus();
      editorRef.current.revealLineInCenter(lineNumber);
      editorRef.current.setPosition({ lineNumber, column: 1 });
    });
  };

  const openDiffTab = (targetPath: string) => {
    const diffTabId = createDiffTabId(targetPath);

    setActiveWorkbenchTab("code");
    setOpenTabPaths((state) => (state.includes(diffTabId) ? state : [...state, diffTabId]));
    setActiveTabId(diffTabId);
    setSelection("", null);
    setSuggestion(null);
    setAiMode("chat");
  };

  const handleOpenCodeWorkbench = () => {
    setActiveWorkbenchTab("code");
  };

  const handleActivityClick = (view: SidebarView) => {
    handleOpenCodeWorkbench();

    if (sidebarView === view && sidebarOpen) {
      setSidebarOpen(false);
      return;
    }

    setSidebarView(view);
  };

  const handleToggleSidebarPanel = () => {
    handleOpenCodeWorkbench();
    setSidebarOpen(!sidebarOpen);
  };

  const handleToggleBottomPanel = () => {
    handleOpenCodeWorkbench();
    setBottomPanelOpen(!bottomPanelOpen);
  };

  const handleToggleAiPanel = () => {
    handleOpenCodeWorkbench();
    toggleAiOpen();
  };

  const refreshSession = () => {
    void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
  };


  const toggleExplorerSection = (key: ExplorerSectionKey) => {
    setExplorerSections((state) => ({
      ...state,
      [key]: !state[key]
    }));
  };

  const handleOpenProblemTab = () => {
    setActiveWorkbenchTab("problem");
  };

  const handleCloseFileTab = (tabId: string) => {
    setOpenTabPaths((state) => {
      const currentIndex = state.indexOf(tabId);
      const next = state.filter((item) => item !== tabId);

      if (activeTabId === tabId) {
        const fallback = next[currentIndex] ?? next[currentIndex - 1] ?? next[0] ?? null;

        setActiveTabId(fallback);
        setActiveWorkbenchTab("code");

        if (!fallback) {
          setSelection("", null);
          setSuggestion(null);
        }
      }

      return next;
    });
  };

  const handleRequestEdit = async () => {
    if (!selectedCode) {
      addToast("먼저 에디터에서 코드를 선택하세요.", "warning");
      return;
    }

    setEditLoading(true);
    try {
      const nextSuggestion = await mockApi.requestAiEdit(
        sessionId,
        activeFile.path,
        activeFile.content,
        selectedCode,
        editInstruction
      );
      setSuggestion(nextSuggestion);
      addToast("AI 수정 제안을 불러왔습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 수정 요청에 실패했습니다.", "error");
    } finally {
      setEditLoading(false);
    }
  };

  const handleApplyEdit = async () => {
    if (!editorRef.current || !selectedRange || !suggestion || !activeFile) {
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    const clampedRange = {
      startLineNumber: Math.min(selectedRange.startLineNumber, lineCount),
      startColumn: selectedRange.startColumn,
      endLineNumber: Math.min(selectedRange.endLineNumber, lineCount),
      endColumn: selectedRange.endColumn
    };

    editorRef.current.executeEdits("ai-edit", [
      {
        range: clampedRange,
        text: suggestion.replacement
      }
    ]);

    const nextContent = model.getValue() ?? "";
    updateFileContent(activeFile.path, nextContent);
    await mockApi.applyAiEdit(sessionId, activeFile.path, nextContent, suggestion.summary);
    setSuggestion(null);
    setAiMode("chat");
    refreshSession();
    addToast("AI 제안을 에디터에 반영했습니다.", "success");
  };

  const handleRun = async () => {
    setRunLoading(true);
    try {
      const result = await mockApi.runCode(sessionId);
      setRunResult(result);
      refreshSession();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "실행에 실패했습니다.", "error");
    } finally {
      setRunLoading(false);
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    try {
      const result = await mockApi.runTests(sessionId);
      setTestResult(result);
      refreshSession();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "테스트 실행에 실패했습니다.", "error");
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      const submission = await mockApi.submitSession(sessionId);
      addToast("제출이 생성되었습니다.", "success");
      router.push(withPrefix(`/submissions/${submission.id}`));
    } catch (error) {
      addToast(error instanceof Error ? error.message : "제출에 실패했습니다.", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAgentBuild = () => {
    const nextVersion = agentSnapshotVersion + 1;

    setAgentSnapshotVersion(nextVersion);
    addToast(`Agent Build를 준비했습니다. 스냅샷 v0.${nextVersion}`, "success");
  };

  const handleSend = async () => {
    if (!chatInput.trim()) {
      return;
    }

    const message = chatInput.trim();
    setChatInput("");

    try {
      await send(message, activeFile?.path);
      refreshSession();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "AI 요청에 실패했습니다.", "error");
    }
  };

  const renderSectionToggle = (key: ExplorerSectionKey, label: string, meta?: string) => (
    <button type="button" className="section-toggle" onClick={() => toggleExplorerSection(key)}>
      <span className="section-toggle__caret">{explorerSections[key] ? "v" : ">"}</span>
      <span>{label}</span>
      {meta ? <small>{meta}</small> : null}
    </button>
  );

  const toggleFolder = useCallback((folderKey: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderKey)) {
        next.delete(folderKey);
      } else {
        next.add(folderKey);
      }
      return next;
    });
  }, []);

  const renderTreeNodes = (nodes: TreeNode[], depth = 0): Array<JSX.Element> =>
    nodes.flatMap((node, index) => {
      const isLast = index === nodes.length - 1;
      const treeGuideLeft = `${8 + depth * 14}px`;
      const treeGuideBottom = isLast ? "50%" : "-4px";

      if (node.kind === "folder") {
        const collapsed = collapsedFolders.has(node.key);
        return [
          <button
            key={node.key}
            type="button"
            className={"tree-folder" + (collapsed ? " tree-folder--closed" : " tree-folder--open")}
            aria-expanded={!collapsed}
            style={{
              ["--tree-depth" as string]: depth,
              ["--tree-guide-left" as string]: treeGuideLeft,
              ["--tree-guide-bottom" as string]: treeGuideBottom,
              paddingLeft: `${12 + depth * 14}px`
            }}
            onClick={() => toggleFolder(node.key)}
          >
            <span className="tree-row__twistie">{collapsed ? ">" : "v"}</span>
            <span className="tree-folder__icon" aria-hidden />
            <span className="tree-row__folder">{node.name}</span>
          </button>,
          ...(collapsed ? [] : renderTreeNodes(node.children, depth + 1))
        ];
      }

      const file = node.file;

      if (!file) {
        return [];
      }

      if (file.isVirtual) {
        const isWorktree = file.path.startsWith(".worktree/");
        const isActiveVirtual = isWorktree
          ? activeTabId === createDiffTabId(file.path)
          : activeTabId === file.path;
        return [
          <button
            key={node.key}
            type="button"
            className={
              isActiveVirtual
                ? "tree-row tree-row--file tree-row--virtual tree-row--active"
                : "tree-row tree-row--file tree-row--virtual"
            }
            style={{
              ["--tree-depth" as string]: depth,
              ["--tree-guide-left" as string]: treeGuideLeft,
              ["--tree-guide-bottom" as string]: treeGuideBottom,
              paddingLeft: `${18 + depth * 14}px`
            }}
            onClick={() => isWorktree ? openDiffTab(file.path) : focusLine(file.path)}
          >
            <span className="tree-row__main">
              <span className="file-icon" data-file-ext={getFileExtension(file)}>{getFileToken(file)}</span>
              <span className="tree-row__label">{node.name}</span>
            </span>
            {file.badge ? <span className="tree-row__badge">{file.badge}</span> : null}
          </button>
        ];
      }

      return [
        <button
          key={node.key}
          type="button"
          className={file.path === activePath ? "tree-row tree-row--file tree-row--active" : "tree-row tree-row--file"}
          style={{
            ["--tree-depth" as string]: depth,
            ["--tree-guide-left" as string]: treeGuideLeft,
            ["--tree-guide-bottom" as string]: treeGuideBottom,
            paddingLeft: `${18 + depth * 14}px`
          }}
          onClick={() => focusLine(file.path)}
        >
          <span className="tree-row__main">
            <span className="file-icon" data-file-ext={getFileExtension(file)}>{getFileToken(file)}</span>
            <span className="tree-row__label">{node.name}</span>
          </span>
          {unsavedPaths.includes(file.path) ? <span className="file-row__dot" /> : null}
        </button>
      ];
    });

  const renderSidebarBody = () => {
    if (sidebarView === "search") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-summary">
            <strong>전역 검색</strong>
            <span>열린 워크스페이스 {files.length}개 파일 기준</span>
          </div>

          <label className="field">
            <span>검색</span>
            <input
              id="ide-search-query"
              name="searchQuery"
              className="input input--compact"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="파일명 또는 코드 검색"
            />
          </label>

          <div className="search-results">
            {searchQuery.trim() ? (
              searchMatches.length ? (
                searchMatches.map((match) => (
                  <button
                    key={match.key}
                    type="button"
                    className="search-result"
                    onClick={() => focusLine(match.path, match.lineNumber)}
                  >
                    <strong>{match.path.split("/").pop()}</strong>
                    <span>{match.path}</span>
                    <small>
                      {match.lineNumber}행 · {match.preview}
                    </small>
                  </button>
                ))
              ) : (
                <div className="empty-inline">검색 결과가 없습니다.</div>
              )
            ) : (
              <div className="empty-inline">검색어를 입력하면 파일과 코드 줄을 함께 찾습니다.</div>
            )}
          </div>
        </div>
      );
    }

    if (sidebarView === "trace") {
      return <TracePanel sessionId={sessionId} />;
    }

    if (sidebarView === "extensions") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-summary">
            <strong>확장 도구</strong>
            <span>실행 흐름에 필요한 확장을 모아 둔 패널입니다.</span>
          </div>

          <label className="field">
            <span>확장 검색</span>
            <input
              id="ide-extension-query"
              name="extensionQuery"
              className="input input--compact"
              value={extensionQuery}
              onChange={(event) => setExtensionQuery(event.target.value)}
              placeholder="도구 이름 또는 설명 검색"
            />
          </label>

          {extensionMatches.map((item) => (
            <div key={item.name} className="extension-card">
              <div className="extension-card__head">
                <strong>{item.name}</strong>
                <Badge tone={item.state === "추천" ? "amber" : "accent"}>{item.state}</Badge>
              </div>
              <p>{item.summary}</p>
            </div>
          ))}

          {!extensionMatches.length ? <div className="empty-inline">조건에 맞는 확장이 없습니다.</div> : null}
        </div>
      );
    }

    return (
      <div className="sidebar-section">
        <div className="section-block">
          {renderSectionToggle("project", "EXPLORER", problem?.title ?? session?.workspaceId)}
          {explorerSections.project ? (
            <div className="tree-root">
              <div className="tree-folder tree-folder--root">
                <span className="tree-row__twistie">v</span>
                <span className="tree-folder__icon" aria-hidden />
                <span className="tree-row__folder">{session?.problemId ?? "workspace"}</span>
              </div>
              <div className="tree-root__children">{renderTreeNodes(fileTree, 1)}</div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderBottomPanel = () => {
    if (bottomPanelTab === "tests") {
      return (
        <div className="bottom-panel__body">
          <div className="bottom-summary">
            <strong>{testResult ? `${testResult.passed} / ${testResult.total} 통과` : "테스트 결과 없음"}</strong>
            <span>{testResult ? `${testResult.failed}개 실패` : "아직 테스트를 실행하지 않았습니다."}</span>
          </div>

          <div className="stack-12">
            {testResult
              ? testResult.results.map((result) => (
                  <div key={result.id} className="test-row">
                    <span>{result.name}</span>
                    <Badge tone={result.status === "PASS" ? "green" : "red"}>{result.status}</Badge>
                    <small>{result.time}</small>
                  </div>
                ))
              : null}
          </div>
        </div>
      );
    }

    if (bottomPanelTab === "trace") {
      return (
        <div className="bottom-panel__body">
          {traces.length ? (
            <div className="trace-list">
              {traces.map((trace: TraceEvent) => (
                <div key={trace.id} className="trace-row">
                  <span className="trace-row__time">{trace.time}</span>
                  <div className="trace-row__body">
                    <strong>{trace.type}</strong>
                    <span>{trace.summary}</span>
                    <small>{trace.detail ?? "상세 정보 없음"}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">아직 기록된 Trace가 없습니다.</div>
          )}
        </div>
      );
    }

    return (
      <div className="bottom-panel__body">
        <div className="output-grid">
          <Card className="mini-panel mini-panel--flat">
            <strong>stdout</strong>
            <pre>{runResult?.stdout ?? "아직 실행한 결과가 없습니다."}</pre>
          </Card>

          <Card className="mini-panel mini-panel--flat">
            <strong>stderr</strong>
            <pre>{runResult?.stderr || "에러 출력 없음"}</pre>
          </Card>
        </div>

        <div className="bottom-summary">
          <strong>{runResult ? `exit code ${runResult.exitCode}` : "실행 대기"}</strong>
          <span>{runResult ? `${runResult.durationMs}ms` : "실행 버튼으로 결과를 확인하세요."}</span>
        </div>
      </div>
    );
  };

  const renderProblemWorkspace = () => {
    if (!problem) {
      return <div className="problem-workspace problem-workspace--empty">문제 정보를 불러오지 못했습니다.</div>;
    }

    return (
      <div className="problem-workspace">
        <aside className="problem-workspace__rail">
          <div className="problem-card problem-card--primary">
            <span className="eyebrow">문제 브리프</span>
            <h2>{problem.title}</h2>
            <p className="muted-copy">{problem.summary}</p>

            <div className="problem-card__pills">
              <span className="problem-pill">Lv.{problem.level}</span>
              <span className="problem-pill">{problem.category}</span>
              <span className="problem-pill">{problem.estimate}</span>
              <span className="problem-pill">{problem.status}</span>
              <span className="problem-pill">{lastSavedLabel}</span>
            </div>

            <div className="problem-card__actions">
              <button type="button" className="ide-command-button" onClick={handleRun} disabled={runLoading}>
                {runLoading ? "실행 중..." : "실행"}
              </button>
              <button type="button" className="ide-command-button" onClick={handleTest} disabled={testLoading}>
                {testLoading ? "테스트 중..." : "테스트"}
              </button>
              <button
                type="button"
                className="ide-command-button ide-command-button--primary"
                onClick={handleSubmit}
                disabled={submitLoading}
              >
                {submitLoading ? "제출 중..." : "제출"}
              </button>
            </div>
          </div>

          <div className="problem-card">
            <strong>문제 체크포인트</strong>
            <ul className="problem-list">
              <li>요구사항 {problemRequirementsCount}개</li>
              <li>공개 테스트 {problemCasesCount}개</li>
              <li>엔드포인트 {problem.endpoints.length}개</li>
              <li>현재 세션 AI quota {aiQuotaLabel}</li>
            </ul>
          </div>
        </aside>

        <div className="problem-workspace__main">
          <section className="problem-card problem-card--feature">
            <strong>핵심 요구사항</strong>
            <ul className="problem-list">
              {problem.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="problem-card problem-card--feature">
            <strong>API 엔드포인트</strong>
            <div className="problem-endpoints">
              {problem.endpoints.map((endpoint) => (
                <code key={endpoint} className="problem-endpoint">
                  {endpoint}
                </code>
              ))}
            </div>
          </section>
        </div>

        <aside className="problem-workspace__aside">
          <section className="problem-card">
            <strong>공개 테스트</strong>
            <div className="problem-cases">
              {problem.publicCases.map((testCase) => (
                <div key={testCase.id} className="problem-case">
                  <div className="problem-case__head">
                    <span>{testCase.name}</span>
                    <Badge tone="teal">{testCase.result}</Badge>
                  </div>
                  <small>{testCase.detail}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="problem-card">
            <strong>평가 기준</strong>
            <ul className="problem-list">
              {problem.criteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="problem-card">
            <strong>AI 활용 팁</strong>
            <p className="muted-copy">{problem.aiGuide}</p>
          </section>
        </aside>
      </div>
    );
  };

  const renderEditorTabs = () => (
    <div className="editor-tabbar">
      <div className="editor-tabbar__row editor-tabbar__row--tabs">
        <div className="editor-tabs" onWheel={handleTabRailWheel}>
          {openTabs.map((tab) => (
            <div
              key={tab.id}
              className={
                activeWorkbenchTab === "code" && tab.id === activeTab?.id
                  ? "editor-tabs__item editor-tabs__item--active"
                  : "editor-tabs__item"
              }
            >
              <button
                type="button"
                className="editor-tabs__select"
                onClick={() => {
                  if (tab.kind === "diff") {
                    openDiffTab(tab.targetFile.path);
                    return;
                  }

                  focusLine(tab.path);
                }}
              >
                <span className="file-icon file-icon--tab">{tab.kind === "diff" ? "DI" : getFileToken(tab.file)}</span>
                <span>{tab.title}</span>
                {tab.kind === "file" && unsavedPaths.includes(tab.path) ? <span className="editor-tabs__dot" /> : null}
              </button>
              <button
                type="button"
                className="editor-tabs__close"
                aria-label={`${tab.title} 닫기`}
                onClick={() => handleCloseFileTab(tab.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="editor-tabbar__row editor-tabbar__row--meta">
        <div className="editor-tabbar__context">
          <span className="editor-tabbar__meta editor-tabbar__meta--problem">{problem?.title ?? "문제 풀이"}</span>
          <span className="editor-tabbar__metric editor-tabbar__metric--time">풀이 {solveElapsedLabel}</span>
          <span className="editor-tabbar__metric">{solveTargetLabel}</span>
          <span className="editor-tabbar__meta">{lastSavedLabel}</span>
        </div>

        <div className="editor-tabbar__actions">
          {session?.language && (
            <LangIcon language={session.language} size={13} showLabel className="ide-lang-badge" />
          )}

          {session?.aiModel && session.aiModel !== "aig-default" && (
            <span className="ide-model-badge">{session.aiModel}</span>
          )}

          <span className="editor-tabbar__divider" />

          <button type="button" className="ide-command-button" onClick={handleRun} disabled={runLoading}>
            {runLoading ? "실행 중..." : "실행"}
          </button>
          <button type="button" className="ide-command-button" onClick={handleTest} disabled={testLoading}>
            {testLoading ? "테스트 중..." : "테스트"}
          </button>
          <button
            type="button"
            className="ide-command-button ide-command-button--primary"
            onClick={handleSubmit}
            disabled={submitLoading}
          >
            {submitLoading ? "제출 중..." : "제출"}
          </button>
        </div>
      </div>
    </div>
  );

  if (isLoading || !session || !activeFile) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">워크스페이스</span>
          <strong>IDE를 준비하고 있습니다.</strong>
        </div>
      </div>
    );
  }

  return (
    <div
      className={"ide-route ide-route--workspace" + (isV0 ? " ide-route--v0" : "")}
      data-v0-ide={isV0 ? themeTone : undefined}
    >
      <section className="ide-shell ide-shell--workbench">
        <aside className="activity-bar">
          <div className="activity-bar__group">
            <button
              type="button"
              className={activeWorkbenchTab === "problem" ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="문제"
              onClick={handleOpenProblemTab}
            >
              <span className="activity-bar__label">PR</span>
              <span className="activity-bar__badge">{problemRequirementsCount}</span>
            </button>

            {activityItems.map((item) =>
              item.id === "trace" ? (
                <button
                  key={item.id}
                  type="button"
                  className={
                    activeWorkbenchTab === "trace"
                      ? "activity-bar__item activity-bar__item--active"
                      : "activity-bar__item"
                  }
                  title={item.label}
                  onClick={() => setActiveWorkbenchTab("trace")}
                >
                  <span className="activity-bar__label">{item.short}</span>
                  {activityMeta[item.id] ? <span className="activity-bar__badge">{activityMeta[item.id]}</span> : null}
                </button>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className={
                    activeWorkbenchTab === "code" && sidebarOpen && sidebarView === item.id
                      ? "activity-bar__item activity-bar__item--active"
                      : "activity-bar__item"
                  }
                  title={item.label}
                  onClick={() => handleActivityClick(item.id)}
                >
                  <span className="activity-bar__label">{item.short}</span>
                  {activityMeta[item.id] ? <span className="activity-bar__badge">{activityMeta[item.id]}</span> : null}
                </button>
              )
            )}

            <button
              type="button"
              className={activeWorkbenchTab === "code" && showBottomPanel ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="콘솔"
              onClick={handleToggleBottomPanel}
            >
              <span className="activity-bar__label">{">_"}</span>
              {activityMeta.output ? <span className="activity-bar__badge">{activityMeta.output}</span> : null}
            </button>

            <button
              type="button"
              className={activeWorkbenchTab === "code" && aiOpen ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="AI 보조 패널"
              onClick={handleToggleAiPanel}
            >
              <span className="activity-bar__label">AI</span>
              {activityMeta.ai ? <span className="activity-bar__badge">{activityMeta.ai}</span> : null}
            </button>
          </div>
        </aside>

        {activeWorkbenchTab === "trace" ? (
          <div className="ide-shell__trace-wb">
            <TraceWorkbench sessionId={sessionId} onClose={() => setActiveWorkbenchTab("code")} />
          </div>
        ) : activeWorkbenchTab === "problem" ? (
          <div className="ide-shell__problem">
            <div className="problem-stage">{renderProblemWorkspace()}</div>
            <div className="status-bar">
              <div className="status-bar__group">
                <span>problem</span>
                <span>Lv.{problem?.level ?? 1}</span>
                <span>{problem?.category ?? "문제"}</span>
                <span>공개케이스 {problemCasesCount}개</span>
              </div>
              <div className="status-bar__group">
                <span>{problem?.estimate ?? "예상 시간 없음"}</span>
                <span>AI quota {aiQuotaLabel}</span>
                <span>{dirtyCount ? `미저장 ${dirtyCount}개` : "저장됨"}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {sidebarOpen ? (
              <>
                <aside className="ide-shell__sidebar" style={{ width: effectiveSidebarWidth }}>
                  <div className="sidebar-header">
                    <div>
                      <span className="panel-title panel-title--compact">{sidebarView}</span>
                      <strong>{activityItems.find((item) => item.id === sidebarView)?.label ?? "탐색기"}</strong>
                    </div>
                  </div>

                  {renderSidebarBody()}
                </aside>

                <div
                  className="pane-resizer pane-resizer--vertical"
                  onMouseDown={beginResize("sidebar")}
                  aria-hidden="true"
                />
              </>
            ) : null}

            <div className="ide-shell__main">
              {renderEditorTabs()}

              <div className="editor-stage">
                {showEmptyEditor ? (
                  <div className="editor-empty-state">
                    <strong>열린 탭이 없습니다.</strong>
                    <span>왼쪽 탐색기에서 파일을 열거나, 문제 아이콘으로 문제 화면을 확인하세요.</span>
                  </div>
                ) : (
                  <div ref={editorHostRef} className="editor-host">
                    {activeTab?.kind === "diff" ? (
                      <MonacoDiffEditor
                        theme={theme === "dark" ? "vs-dark" : "vs"}
                        height="100%"
                        original={activeTab.sourceFile.content}
                        modified={activeTab.targetFile.content}
                        language={activeTab.sourceFile.language}
                        onMount={handleDiffMount}
                        options={{
                          readOnly: true,
                          renderSideBySide: viewportSize.width > 1480,
                          originalEditable: false,
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          fontFamily: "var(--font-mono)",
                          lineHeight: 22,
                          automaticLayout: false,
                          smoothScrolling: true,
                          stickyScroll: { enabled: false },
                          overviewRulerBorder: false,
                          minimap: { enabled: false }
                        }}
                      />
                    ) : (
                      <MonacoEditor
                        path={activeFile.path}
                        theme={theme === "dark" ? "vs-dark" : "vs"}
                        height="100%"
                        language={activeFile.language}
                        value={activeFile.content}
                        onMount={handleMount}
                        onChange={(value) => {
                          const nextContent = value ?? "";
                          if (nextContent !== activeFile.content) {
                            updateFileContent(activeFile.path, nextContent);
                          }
                        }}
                        options={{
                          minimap: { enabled: true, scale: 0.9, showSlider: "mouseover" },
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          fontFamily: "var(--font-mono)",
                          lineHeight: 22,
                          automaticLayout: false,
                          smoothScrolling: true,
                          padding: { top: 14 },
                          stickyScroll: { enabled: false },
                          overviewRulerBorder: false
                        }}
                      />
                    )}
                  </div>
                )}

                {showBottomPanel ? (
                  <>
                    <div
                      className="pane-resizer pane-resizer--horizontal"
                      onMouseDown={beginResize("bottom")}
                      aria-hidden="true"
                    />
                    <section className="bottom-panel" style={{ height: effectiveBottomPanelHeight }}>
                      <div className="bottom-panel__tabs">
                        <div className="bottom-panel__tab-list">
                          {bottomTabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              className={
                                bottomPanelTab === tab.id
                                  ? "bottom-panel__tab bottom-panel__tab--active"
                                  : "bottom-panel__tab"
                              }
                              onClick={() => setBottomPanelTab(tab.id)}
                            >
                              {tab.label}
                              <small>{bottomTabMeta[tab.id]}</small>
                            </button>
                          ))}
                        </div>
                      </div>

                      {renderBottomPanel()}
                    </section>
                  </>
                ) : null}
              </div>

              <div className="status-bar">
                <div className="status-bar__group">
                  <span>main</span>
                  <span>{activeFile.language.toUpperCase()}</span>
                  <span>UTF-8</span>
                  <span>LF</span>
                  <span>{lineCount} lines</span>
                </div>

                <div className="status-bar__group">
                  <span>{dirtyCount ? `미저장 ${dirtyCount}개` : "저장됨"}</span>
                  <span>{selectionLabel}</span>
                  <span>{aiMode === "chat" ? "AIG Chat" : "AIG Edit"}</span>
                  <span>{activeTab?.kind === "diff" ? "DIFF" : bottomPanelTab.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {aiOpen ? (
              <>
                <div
                  className="pane-resizer pane-resizer--vertical"
                  onMouseDown={beginResize("ai")}
                  aria-hidden="true"
                />

                <aside className="ide-shell__ai" style={{ width: effectiveAiPanelWidth }}>
                  <div className="sidebar-header">
                    <div>
                      <span className="panel-title panel-title--compact">aig assistant</span>
                      <div className="assistant-header__title">
                        <strong>AI 보조 패널</strong>
                        <span className="ai-context-chip assistant-version-chip">{agentSnapshotLabel}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="button button--primary button--tiny assistant-build-button"
                      onClick={handleAgentBuild}
                    >
                      Agent Build
                    </button>
                  </div>

                  {aiMode === "chat" ? (
                    <div className="ai-panel ai-panel--chat">
                      <div className="ai-panel__head">
                        <div className="ai-tabs">
                          <button
                            type="button"
                            className="chip chip--active"
                            onClick={() => {
                              setAiMode("chat");
                              setSuggestion(null);
                            }}
                          >
                            chat mode
                          </button>
                          <button
                            type="button"
                            className="chip"
                            onClick={() => setAiMode("edit")}
                          >
                            agent mode
                          </button>
                        </div>

                        <div className="ai-context-strip">
                          <span className="ai-context-chip">{getFileName(activeFile.path)}</span>
                          <span className="ai-context-chip">{selectedRange ? selectionSummary : "선택 없음"}</span>
                          <span className="ai-context-chip">AI quota {aiQuotaLabel}</span>
                        </div>
                      </div>

                      <div ref={chatScrollRef} className="chat-stack chat-stack--panel">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={message.role === "user" ? "chat-bubble chat-bubble--user" : "chat-bubble"}
                          >
                            {message.content}
                          </div>
                        ))}
                        {streaming ? <div className="chat-status">AI 응답 생성 중...</div> : null}
                      </div>

                      <div className="chat-input-row">
                        <textarea
                          id="ide-chat-input"
                          name="chatPrompt"
                          className="input input--textarea"
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="현재 문제나 코드에 대해 질문하세요"
                        />
                        <button className="button button--primary" onClick={handleSend}>
                          전송
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ai-panel ai-panel--edit">
                      <div className="ai-panel__head">
                        <div className="ai-tabs">
                          <button
                            type="button"
                            className="chip"
                            onClick={() => {
                              setAiMode("chat");
                              setSuggestion(null);
                            }}
                          >
                            chat mode
                          </button>
                          <button
                            type="button"
                            className="chip chip--active"
                            onClick={() => setAiMode("edit")}
                          >
                            agent mode
                          </button>
                        </div>

                        <div className="ai-context-strip">
                          <span className="ai-context-chip">{getFolderPath(activeFile.path) || "workspace"}</span>
                          <span className="ai-context-chip">{selectionLabel}</span>
                          <span className="ai-context-chip">AI quota {aiQuotaLabel}</span>
                        </div>
                      </div>

                      <Card className="mini-panel mini-panel--flat">
                        <strong>선택 코드</strong>
                        <pre>{selectedCode || "에디터에서 코드를 선택하면 AI 수정 모드가 활성화됩니다."}</pre>
                      </Card>

                      <label className="field">
                        <span>수정 지시</span>
                        <textarea
                          id="ide-edit-instruction"
                          name="editInstruction"
                          className="input input--textarea"
                          value={editInstruction}
                          onChange={(event) => setEditInstruction(event.target.value)}
                        />
                      </label>

                      <button className="button" onClick={handleRequestEdit} disabled={editLoading}>
                        {editLoading ? "생성 중..." : "AI 수정 제안 받기"}
                      </button>

                      {suggestion ? (
                        <Card className="mini-panel mini-panel--flat">
                          <strong>AI 제안</strong>
                          <div className="diff-block">
                            <span className="diff-block__remove">- {suggestion.original}</span>
                            <span className="diff-block__add">+ {suggestion.replacement}</span>
                          </div>
                          <p className="muted-copy">{suggestion.summary}</p>
                          <div className="hero-actions">
                            <button className="button" onClick={() => setSuggestion(null)}>
                              닫기
                            </button>
                            <button className="button button--primary" onClick={handleApplyEdit}>
                              반영
                            </button>
                          </div>
                        </Card>
                      ) : null}
                    </div>
                  )}
                </aside>
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { useAiChat } from "@/hooks/useAiChat";
import { useAutoSave } from "@/hooks/useAutoSave";
import { mockApi } from "@/lib/api/mockApi";
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

const activityItems: Array<{ id: SidebarView; short: string; label: string; description: string }> = [
  { id: "explorer", short: "EX", label: "탐색기", description: "파일 트리" },
  { id: "search", short: "SR", label: "검색", description: "파일명과 코드 검색" },
  { id: "extensions", short: "XT", label: "확장", description: "설치된 워크벤치 도구" }
];

const bottomTabs: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "output", label: "출력" },
  { id: "tests", label: "테스트" },
  { id: "trace", label: "Trace" }
];

const AI_REQUEST_QUOTA = 5;

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

const promptPresets = [
  "현재 파일 기준으로 문제 원인부터 짚어줘",
  "공개 테스트를 우선 통과하는 순서로 정리해줘",
  "선택 코드만 최소 수정으로 안전하게 바꿔줘"
];

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
  file?: WorkspaceFile;
  children: TreeNode[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getFileName = (path: string) => path.split("/").pop() ?? path;
const getFolderPath = (path: string) => path.split("/").slice(0, -1).join("/");

const getFileToken = (file: Pick<WorkspaceFile, "path" | "language">) => {
  const extension = file.path.split(".").pop()?.toLowerCase();

  if (extension === "java") {
    return "JV";
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

const buildFileTree = (files: WorkspaceFile[]) => {
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
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [extensionQuery, setExtensionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<"code" | "problem">("code");
  const [openTabPaths, setOpenTabPaths] = useState<string[]>([]);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [explorerSections, setExplorerSections] = useState<Record<ExplorerSectionKey, boolean>>({
    project: true
  });

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => mockApi.getSession(sessionId)
  });
  const { data: workspace } = useQuery({
    queryKey: ["workspace", sessionId],
    queryFn: () => mockApi.getWorkspace(sessionId),
    enabled: !!session
  });

  const maxSidebarWidth = viewportSize.width > 0 && viewportSize.width <= 1360 ? 248 : 280;
  const maxAiPanelWidth = viewportSize.width > 0 && viewportSize.width <= 1360 ? 320 : 360;
  const maxBottomPanelHeight =
    viewportSize.height > 0 ? (viewportSize.height <= 740 ? 168 : viewportSize.height <= 860 ? 196 : 220) : 220;
  const effectiveSidebarWidth = Math.min(sidebarWidth, maxSidebarWidth);
  const effectiveAiPanelWidth = Math.min(aiPanelWidth, maxAiPanelWidth);
  const effectiveBottomPanelHeight = Math.min(bottomPanelHeight, maxBottomPanelHeight);

  const requestEditorLayout = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const editor = editorRef.current;
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
    if (workspace?.files?.length) {
      setWorkspace(workspace.files, workspace.files[1]?.path ?? workspace.files[0]?.path);
    }
  }, [setWorkspace, workspace]);

  useEffect(() => {
    if (!files.length) {
      setOpenTabPaths([]);
      return;
    }

    setOpenTabPaths((state) => {
      const next = state.filter((path) => files.some((file) => file.path === path));

      if (!next.length) {
        next.push(activePath ?? files[0].path);
      }

      if (activePath && !next.includes(activePath)) {
        next.push(activePath);
      }

      return next;
    });
  }, [activePath, files]);

  useEffect(() => {
    if (session) {
      void loadMessages();
    }
  }, [loadMessages, session]);

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

      const nextBottomMax = viewportHeight <= 740 ? 168 : viewportHeight <= 860 ? 196 : 220;
      if (bottomPanelHeight > nextBottomMax) {
        setBottomPanelHeight(nextBottomMax);
      }

      const nextAiMax = viewportWidth <= 1360 ? 320 : 360;
      if (aiPanelWidth > nextAiMax) {
        setAiPanelWidth(nextAiMax);
      }

      const nextSidebarMax = viewportWidth <= 1360 ? 248 : 280;
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
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      if (dragState.mode === "sidebar") {
        const nextWidth = clamp(dragState.startWidth + (event.clientX - dragState.startX), 220, 420);
        setSidebarWidth(nextWidth);
        return;
      }

      if (dragState.mode === "ai") {
        const nextWidth = clamp(dragState.startWidth - (event.clientX - dragState.startX), 280, 520);
        setAiPanelWidth(nextWidth);
        return;
      }

      const nextHeight = clamp(dragState.startHeight - (event.clientY - dragState.startY), 140, 360);
      setBottomPanelHeight(nextHeight);
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setAiPanelWidth, setBottomPanelHeight, setSidebarWidth]);

  const activeFile = useMemo(
    () => files.find((file) => file.path === activePath) ?? files[0] ?? null,
    [activePath, files]
  );
  const problem = useMemo(() => getProblemById(session?.problemId ?? "todo-api"), [session?.problemId]);
  const traces = useMemo(() => session?.traces ?? [], [session?.traces]);
  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const openFiles = useMemo(
    () =>
      openTabPaths
        .map((path) => files.find((file) => file.path === path))
        .filter((file): file is WorkspaceFile => Boolean(file)),
    [files, openTabPaths]
  );

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
  const dirtyCount = unsavedPaths.length;
  const problemRequirementsCount = problem?.requirements.length ?? 0;
  const problemCasesCount = problem?.publicCases.length ?? 0;
  const breadcrumbParts =
    activeWorkbenchTab === "problem" ? ["problem", problem?.title ?? "brief"] : activeFile?.path.split("/") ?? [];
  const bottomTabMeta: Record<BottomPanelTab, string> = {
    output: runResult ? `code ${runResult.exitCode}` : "ready",
    tests: testResult ? `${testResult.passed}/${testResult.total}` : "idle",
    trace: `${traces.length}`
  };
  const activityMeta: Record<SidebarView | "ai" | "output", string | null> = {
    explorer: dirtyCount ? `${dirtyCount}` : openFiles.length ? `${openFiles.length}` : `${files.length}`,
    search: searchQuery.trim() ? `${searchMatches.length}` : null,
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
  const showEmptyEditor = activeWorkbenchTab === "code" && openFiles.length === 0;
  const showBottomPanel = bottomPanelOpen && !showEmptyEditor;

  const handleMount = (editor: any) => {
    editorRef.current = editor;
    const initialPosition = editor.getPosition();

    if (initialPosition) {
      setCursorPosition({
        line: initialPosition.lineNumber,
        column: initialPosition.column
      });
    }

    let selectionDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    editor.onDidChangeCursorSelection(() => {
      if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);
      selectionDebounceTimer = setTimeout(() => {
        const selection = editor.getSelection();

        if (!selection || selection.isEmpty()) {
          const position = editor.getPosition();

          if (position) {
            setCursorPosition({
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

        const code = model.getValueInRange(selection) ?? "";
        const lineCount = model.getLineCount();
        const startLine = Math.min(selection.startLineNumber, lineCount);
        const endLine = Math.min(selection.endLineNumber, lineCount);
        const range: SelectionRange = {
          startLineNumber: startLine,
          startColumn: selection.startColumn,
          endLineNumber: endLine,
          endColumn: selection.endColumn
        };

        setCursorPosition({
          line: position.lineNumber,
          column: position.column
        });
        setSelection(code, range);
      }, 80);
    });

    requestEditorLayout();
    syncMonacoAuxInputs();
  };

  const beginResize = (mode: DragMode) => (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

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

  const fillPresetPrompt = (value: string) => {
    setAiOpen(true);
    setAiMode("chat");
    setSuggestion(null);
    setChatInput(value);
  };

  const handleOpenProblemTab = () => {
    setActiveWorkbenchTab("problem");
  };

  const handleCloseFileTab = (path: string) => {
    setOpenTabPaths((state) => {
      const currentIndex = state.indexOf(path);
      const next = state.filter((item) => item !== path);

      if (activePath === path) {
        const fallback = next[currentIndex] ?? next[currentIndex - 1] ?? next[0] ?? null;

        if (fallback) {
          setActivePath(fallback);
          setActiveWorkbenchTab("code");
        } else {
          setActiveWorkbenchTab("code");
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
      const nextSuggestion = await mockApi.requestAiEdit(sessionId, selectedCode, editInstruction);
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
      refreshSession();
      addToast("제출이 생성되었습니다.", "success");
      router.push(withPrefix(`/submissions/${submission.id}`));
    } catch (error) {
      addToast(error instanceof Error ? error.message : "제출에 실패했습니다.", "error");
    } finally {
      setSubmitLoading(false);
    }
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

  const renderTreeNodes = (nodes: TreeNode[], depth = 0): Array<JSX.Element> =>
    nodes.flatMap((node) => {
      if (node.kind === "folder") {
        return [
          <div key={node.key} className="tree-folder" style={{ paddingLeft: `${12 + depth * 14}px` }}>
            <span className="tree-row__twistie">v</span>
            <span className="tree-row__folder">{node.name}</span>
          </div>,
          ...renderTreeNodes(node.children, depth + 1)
        ];
      }

      const file = node.file;

      if (!file) {
        return [];
      }

      return [
        <button
          key={node.key}
          type="button"
          className={file.path === activePath ? "tree-row tree-row--active" : "tree-row"}
          style={{ paddingLeft: `${18 + depth * 14}px` }}
          onClick={() => focusLine(file.path)}
        >
          <span className="tree-row__main">
            <span className="file-icon">{getFileToken(file)}</span>
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
      <div className="editor-tabs">
        {openFiles.map((file) => (
          <div
            key={file.path}
            className={
              activeWorkbenchTab === "code" && file.path === activePath
                ? "editor-tabs__item editor-tabs__item--active"
                : "editor-tabs__item"
            }
          >
            <button type="button" className="editor-tabs__select" onClick={() => focusLine(file.path)}>
              <span className="file-icon file-icon--tab">{getFileToken(file)}</span>
              <span>{getFileName(file.path)}</span>
              {unsavedPaths.includes(file.path) ? <span className="editor-tabs__dot" /> : null}
            </button>
            <button
              type="button"
              className="editor-tabs__close"
              aria-label={`${getFileName(file.path)} 닫기`}
              onClick={() => handleCloseFileTab(file.path)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="editor-tabbar__actions">
        <span className="editor-tabbar__meta">{problem?.title ?? "문제 풀이"}</span>
        <span className="editor-tabbar__meta">{lastSavedLabel}</span>
        <span className="editor-tabbar__meta">AI {aiQuotaLabel}</span>
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
    <div className="ide-route ide-route--workspace">
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

            {activityItems.map((item) => (
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
            ))}

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

        {activeWorkbenchTab === "problem" ? (
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
                    <MonacoEditor
                      path={activeFile.path}
                      theme={theme === "dark" ? "vs-dark" : "vs"}
                      height="100%"
                      language={activeFile.language}
                      value={activeFile.content}
                      onMount={handleMount}
                      onChange={(value) => updateFileContent(activeFile.path, value ?? "")}
                      options={{
                        minimap: { enabled: true, scale: 0.9, showSlider: "mouseover" },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        fontFamily: "var(--font-mono)",
                        lineHeight: 22,
                        automaticLayout: true,
                        smoothScrolling: true,
                        padding: { top: 14 },
                        stickyScroll: { enabled: false },
                        overviewRulerBorder: false
                      }}
                    />
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
                  <span>{bottomPanelTab.toUpperCase()}</span>
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
                      <strong>AI 보조 패널</strong>
                    </div>
                  </div>

                  <div className="ai-tabs">
                    <button
                      type="button"
                      className={aiMode === "chat" ? "chip chip--active" : "chip"}
                      onClick={() => {
                        setAiMode("chat");
                        setSuggestion(null);
                      }}
                    >
                      채팅
                    </button>
                    <button
                      type="button"
                      className={aiMode === "edit" ? "chip chip--active" : "chip"}
                      onClick={() => setAiMode("edit")}
                    >
                      수정
                    </button>
                  </div>

                  {aiMode === "chat" ? (
                    <div className="ai-panel ai-panel--chat">
                      <div className="ai-context-strip">
                        <span className="ai-context-chip">{getFileName(activeFile.path)}</span>
                        <span className="ai-context-chip">{selectedRange ? selectionSummary : "선택 없음"}</span>
                        <span className="ai-context-chip">AI quota {aiQuotaLabel}</span>
                      </div>

                      <div className="chat-presets">
                        {promptPresets.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            className="chat-preset"
                            onClick={() => fillPresetPrompt(prompt)}
                          >
                            {prompt}
                          </button>
                        ))}
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
                      <Card className="mini-panel mini-panel--flat">
                        <strong>선택 코드</strong>
                        <pre>{selectedCode || "에디터에서 코드를 선택하면 AI 수정 모드가 활성화됩니다."}</pre>
                      </Card>

                      <div className="ai-context-strip">
                        <span className="ai-context-chip">{getFolderPath(activeFile.path) || "workspace"}</span>
                        <span className="ai-context-chip">{selectionLabel}</span>
                      </div>

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

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
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
  { id: "explorer", short: "EX", label: "탐색기", description: "파일 트리와 아웃라인" },
  { id: "search", short: "SR", label: "검색", description: "파일명과 코드 검색" },
  { id: "extensions", short: "XT", label: "확장", description: "설치된 워크벤치 도구" }
];

const bottomTabs: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "output", label: "출력" },
  { id: "tests", label: "테스트" },
  { id: "trace", label: "Trace" }
];

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

type ExplorerSectionKey = "openEditors" | "project" | "outline";
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

const extractOutline = (file: WorkspaceFile | null) => {
  if (!file) {
    return [];
  }

  return file.content
    .split("\n")
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(
      ({ line }) =>
        Boolean(line) &&
        (line.startsWith("@") ||
          /\b(class|interface|enum|record)\b/.test(line) ||
          /\b(public|private|protected)\b.*\(.*\)/.test(line))
    )
    .slice(0, 10)
    .map(({ line, lineNumber }) => ({
      id: `${file.path}-${lineNumber}`,
      label: line.replace(/\s*\{$/, ""),
      lineNumber
    }));
};

export function IdeShell({ sessionId }: { sessionId: string }) {
  const router = useRouter();
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
  const [explorerSections, setExplorerSections] = useState<Record<ExplorerSectionKey, boolean>>({
    openEditors: true,
    project: true,
    outline: true
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

  const { messages, streaming, requestCount, loadMessages, send } = useAiChat(sessionId);
  useAutoSave(sessionId);

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
  const outlineItems = useMemo(() => extractOutline(activeFile), [activeFile]);

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
  const dirtyCount = unsavedPaths.length;
  const breadcrumbParts = activeFile?.path.split("/") ?? [];
  const bottomTabMeta: Record<BottomPanelTab, string> = {
    output: runResult ? `code ${runResult.exitCode}` : "ready",
    tests: testResult ? `${testResult.passed}/${testResult.total}` : "idle",
    trace: `${traces.length}`
  };
  const activityMeta: Record<SidebarView | "ai" | "output", string | null> = {
    explorer: dirtyCount ? `${dirtyCount}` : `${files.length}`,
    search: searchQuery.trim() ? `${searchMatches.length}` : null,
    extensions: `${extensionItems.length}`,
    ai: requestTotal ? `${requestTotal}` : null,
    output: testResult ? `${testResult.failed}` : traces.length ? `${traces.length}` : null
  };

  const handleMount = (editor: any) => {
    editorRef.current = editor;
    const initialPosition = editor.getPosition();

    if (initialPosition) {
      setCursorPosition({
        line: initialPosition.lineNumber,
        column: initialPosition.column
      });
    }

    editor.onDidChangeCursorSelection(() => {
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
      const code = editor.getModel()?.getValueInRange(selection) ?? "";
      const range: SelectionRange = {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn
      };

      setCursorPosition({
        line: position.lineNumber,
        column: position.column
      });
      setSelection(code, range);
    });
  };

  const beginResize = (mode: DragMode) => (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    dragStateRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: mode === "sidebar" ? sidebarWidth : aiPanelWidth,
      startHeight: bottomPanelHeight
    };

    document.body.style.cursor = mode === "bottom" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  };

  const focusLine = (path: string, lineNumber?: number) => {
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

  const handleActivityClick = (view: SidebarView) => {
    if (sidebarView === view && sidebarOpen) {
      setSidebarOpen(false);
      return;
    }

    setSidebarView(view);
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
    setChatInput(value);
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

    editorRef.current.executeEdits("ai-edit", [
      {
        range: selectedRange,
        text: suggestion.replacement
      }
    ]);

    const nextContent = editorRef.current.getValue();
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
      router.push(`/submissions/${submission.id}`);
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
          {renderSectionToggle("openEditors", "OPEN EDITORS", `${files.length}`)}
          {explorerSections.openEditors ? (
            <div className="stack-8">
              {files.map((file) => (
                <button
                  key={`${file.path}-open`}
                  type="button"
                  className={file.path === activePath ? "file-row file-row--active" : "file-row"}
                  onClick={() => focusLine(file.path)}
                >
                  <span className="file-row__main">
                    <span className="file-icon">{getFileToken(file)}</span>
                    <span className="file-row__copy">
                      <span className="file-row__name">{getFileName(file.path)}</span>
                      <small className="file-row__meta">{getFolderPath(file.path) || "workspace"}</small>
                    </span>
                  </span>
                  {unsavedPaths.includes(file.path) ? <span className="file-row__dot" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

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

        <div className="section-block">
          {renderSectionToggle("outline", "OUTLINE", getFileName(activeFile?.path ?? ""))}
          {explorerSections.outline ? (
            outlineItems.length ? (
              <div className="outline-list">
                {outlineItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="outline-row"
                    onClick={() => focusLine(activeFile?.path ?? "", item.lineNumber)}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.lineNumber}행</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-inline">표시할 심볼이 없습니다.</div>
            )
          ) : null}
        </div>

        <div className="sidebar-callout">
          <strong>현재 컨텍스트</strong>
          <span>{activeFile?.path ?? "파일 없음"}</span>
          <small>{selectionSummary}</small>
          <small>{dirtyCount ? `미저장 변경 ${dirtyCount}건` : "모든 변경이 저장되었습니다."}</small>
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
    <div className="stack-16 ide-route">
      <Card className="ide-hero ide-hero--workspace">
        <div>
          <span className="eyebrow">AIG IDE</span>
          <div className="inline-heading">
            <h1>{problem?.title ?? "Todo API 구현"}</h1>
            <Badge tone="accent">AI 요청 {requestCount || session.aiRequestCount}회</Badge>
            <Badge tone="teal">
              {lastSavedAt
                ? `저장 ${new Date(lastSavedAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                  })}`
                : "자동 저장 대기"}
            </Badge>
          </div>
          <p className="muted-copy ide-hero__description">{problem?.summary}</p>
        </div>

        <div className="hero-actions">
          <button className="button" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "탐색기 닫기" : "탐색기 열기"}
          </button>
          <button className="button" onClick={() => setBottomPanelOpen(!bottomPanelOpen)}>
            {bottomPanelOpen ? "하단 패널 닫기" : "하단 패널 열기"}
          </button>
          <button className="button" onClick={toggleAiOpen}>
            {aiOpen ? "AI 패널 닫기" : "AI 패널 열기"}
          </button>
          <button className="button" onClick={handleRun} disabled={runLoading}>
            {runLoading ? "실행 중..." : "실행"}
          </button>
          <button className="button" onClick={handleTest} disabled={testLoading}>
            {testLoading ? "테스트 중..." : "테스트"}
          </button>
          <button className="button button--primary" onClick={handleSubmit} disabled={submitLoading}>
            {submitLoading ? "제출 중..." : "제출"}
          </button>
        </div>
      </Card>

      <section className="ide-shell ide-shell--workbench">
        <aside className="activity-bar">
          <div className="activity-bar__group">
            {activityItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  sidebarOpen && sidebarView === item.id
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
          </div>

          <div className="activity-bar__group activity-bar__group--bottom">
            <button
              type="button"
              className={aiOpen ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"}
              title="AI 보조 패널"
              onClick={toggleAiOpen}
            >
              <span className="activity-bar__label">AI</span>
              {activityMeta.ai ? <span className="activity-bar__badge">{activityMeta.ai}</span> : null}
            </button>
            <button
              type="button"
              className={
                bottomPanelOpen ? "activity-bar__item activity-bar__item--active" : "activity-bar__item"
              }
              title="하단 패널"
              onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
            >
              <span className="activity-bar__label">OUT</span>
              {activityMeta.output ? <span className="activity-bar__badge">{activityMeta.output}</span> : null}
            </button>
          </div>
        </aside>

        {sidebarOpen ? (
          <>
            <aside className="ide-shell__sidebar" style={{ width: sidebarWidth }}>
              <div className="sidebar-header">
                <div>
                  <span className="panel-title panel-title--compact">{sidebarView}</span>
                  <strong>{activityItems.find((item) => item.id === sidebarView)?.label ?? "탐색기"}</strong>
                </div>
                <button type="button" className="icon-button" onClick={() => setSidebarOpen(false)}>
                  닫기
                </button>
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
          <div className="editor-tabs">
            {files.map((file) => (
              <button
                key={file.path}
                type="button"
                className={
                  file.path === activePath ? "editor-tabs__item editor-tabs__item--active" : "editor-tabs__item"
                }
                onClick={() => focusLine(file.path)}
              >
                <span className="file-icon file-icon--tab">{getFileToken(file)}</span>
                <span>{getFileName(file.path)}</span>
                {unsavedPaths.includes(file.path) ? <span className="editor-tabs__dot" /> : null}
              </button>
            ))}
          </div>

          <div className="editor-breadcrumbs">
            {breadcrumbParts.map((part, index) => (
              <span key={`${part}-${index}`} className="editor-breadcrumbs__item">
                {part}
              </span>
            ))}
          </div>

          <div className="editor-stage">
            <div className="editor-host">
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

            {bottomPanelOpen ? (
              <>
                <div
                  className="pane-resizer pane-resizer--horizontal"
                  onMouseDown={beginResize("bottom")}
                  aria-hidden="true"
                />
                <section className="bottom-panel" style={{ height: bottomPanelHeight }}>
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

                    <button type="button" className="icon-button" onClick={() => setBottomPanelOpen(false)}>
                      닫기
                    </button>
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

            <aside className="ide-shell__ai" style={{ width: aiPanelWidth }}>
              <div className="sidebar-header">
                <div>
                  <span className="panel-title panel-title--compact">aig assistant</span>
                  <strong>AI 보조 패널</strong>
                </div>
                <button type="button" className="icon-button" onClick={toggleAiOpen}>
                  닫기
                </button>
              </div>

              <div className="ai-tabs">
                <button
                  type="button"
                  className={aiMode === "chat" ? "chip chip--active" : "chip"}
                  onClick={() => setAiMode("chat")}
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
                    <span className="ai-context-chip">요청 {requestTotal}회</span>
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
      </section>
    </div>
  );
}

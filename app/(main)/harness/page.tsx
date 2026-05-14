"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  FlaskConical,
  ScrollText,
  Wrench,
  RotateCcw,
  Save,
  Eye,
  Pencil,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  FilePlus2,
  Trash2,
  Edit3,
  Loader2,
  X,
  type LucideIcon
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  userHarnessApi,
  type UserHarnessFileType,
  type UserHarnessTreeItem
} from "@/lib/api/userHarnessApi";
import { useUiStore } from "@/store/uiStore";

/* ─── User harness file helpers ─── */

type HarnessTag = "main" | "meta" | "temp";

interface HarnessCreateDraft {
  nodeType: "FILE" | "DIRECTORY";
  parentPath: string;
  value: string;
}

interface HarnessRenameDraft {
  target: UserHarnessTreeItem;
  parentPath: string;
  value: string;
}

const TAG_STYLE: Record<HarnessTag, string> = {
  main: "harness-file-chip harness-file-chip--main",
  meta: "harness-file-chip harness-file-chip--meta",
  temp: "harness-file-chip harness-file-chip--temp"
};

const getFileName = (path: string) => path.split("/").filter(Boolean).at(-1) ?? path;

const normalizeHarnessPath = (path: string) => path.trim().replace(/^\/+|\/+$/g, "");

const getPathDepth = (path: string) => Math.max(0, normalizeHarnessPath(path).split("/").length - 1);

const getParentPath = (path: string) => normalizeHarnessPath(path).split("/").slice(0, -1).join("/");

const inferFileType = (path: string): UserHarnessFileType | null => {
  const extension = getFileName(path).toLowerCase().split(".").pop();
  if (extension === "md" || extension === "markdown") return "MARKDOWN";
  if (extension === "toml") return "TOML";
  if (extension === "yaml" || extension === "yml") return "YAML";
  return null;
};

const sortHarnessTree = (items: UserHarnessTreeItem[]) =>
  [...items].sort((left, right) => {
    const byPath = left.path.localeCompare(right.path, "ko");
    if (byPath !== 0) return byPath;
    return left.userHarnessFileId - right.userHarnessFileId;
  });

const getHarnessTag = (file: UserHarnessTreeItem | null | undefined): HarnessTag => {
  const path = file?.path.toLowerCase() ?? "";
  if (path.endsWith("agents.md") || path.endsWith("harness.md")) return "main";
  if (path.includes(".sandbox")) return "temp";
  return "meta";
};

const getHarnessIcon = (file: UserHarnessTreeItem | null | undefined): LucideIcon => {
  if (!file || file.nodeType === "DIRECTORY") return FolderOpen;
  const path = file.path.toLowerCase();
  if (path.endsWith("agents.md") || path.endsWith("harness.md")) return ScrollText;
  if (path.includes("skill")) return Wrench;
  if (path.includes(".sandbox")) return FlaskConical;
  return FileText;
};

const getHarnessSummary = (file: UserHarnessTreeItem | null | undefined) => {
  if (!file) return "API에서 받아온 하네스 파일을 선택하세요.";
  if (file.nodeType === "DIRECTORY") return "사용자 하네스 폴더";
  if (getHarnessTag(file) === "main") return "에이전트 실행 지침 파일";
  if (file.path.toLowerCase().includes("skill")) return "에이전트 스킬/도구 지침 파일";
  if (file.path.toLowerCase().includes(".sandbox")) return "실험용 하네스 작업 파일";
  return "사용자 하네스 구성 파일";
};

const isMarkdownFile = (file: UserHarnessTreeItem | null | undefined) =>
  file?.fileType === "MARKDOWN" || file?.path.toLowerCase().endsWith(".md");

/* Glass surface preset (Glassmorphism 2.0) */
const GLASS = "harness-glass";

const IDE_TONE = {
  workbench: "var(--harness-ide-workbench)",
  sidebar: "var(--harness-ide-sidebar)",
  activity: "var(--harness-ide-activity)",
  tab: "var(--harness-ide-tab)",
  tabActive: "var(--harness-ide-tab-active)",
  border: "var(--harness-ide-border)",
  hover: "var(--harness-ide-hover)",
  pill: "var(--harness-ide-pill)",
  status: "var(--harness-ide-status)",
  accent: "var(--harness-ide-accent)",
  accentDim: "var(--harness-ide-accent-dim)",
  text: "var(--harness-ide-text)",
  muted: "var(--harness-ide-muted)",
  muted2: "var(--harness-ide-muted-2)",
  code: "var(--harness-ide-code)",
  codeMuted: "var(--harness-ide-code-muted)",
  divider: "var(--harness-ide-divider)"
};

/* ─── Page ─── */

export default function HarnessPage() {
  const addToast = useUiStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [actionLoading, setActionLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: UserHarnessTreeItem | null;
  } | null>(null);
  const [createDraft, setCreateDraft] = useState<HarnessCreateDraft | null>(null);
  const [renameDraft, setRenameDraft] = useState<HarnessRenameDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserHarnessTreeItem | null>(null);
  const [resetTarget, setResetTarget] = useState<UserHarnessTreeItem | null>(null);
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [closedTabKeys, setClosedTabKeys] = useState<Set<string>>(new Set());
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [tabDropHint, setTabDropHint] = useState<{ targetId: string; position: "before" | "after" } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const initializedActiveRef = useRef(false);
  const tabRailRef = useRef<HTMLDivElement>(null);

  const {
    data: treeItems = [],
    isLoading: treeLoading,
    isError: treeError,
    refetch: refetchTree
  } = useQuery({
    queryKey: ["userHarnessTree"],
    queryFn: userHarnessApi.getTree
  });

  const harnessFiles = useMemo(() => sortHarnessTree(treeItems), [treeItems]);
  const editableFiles = useMemo(
    () => harnessFiles.filter((file) => file.nodeType === "FILE"),
    [harnessFiles]
  );
  const orderedEditableFiles = useMemo(() => {
    const visibleEditableFiles = editableFiles.filter((file) => !closedTabKeys.has(String(file.userHarnessFileId)));
    const fileByKey = new Map(visibleEditableFiles.map((file) => [String(file.userHarnessFileId), file]));
    const ordered = tabOrder
      .map((fileKey) => fileByKey.get(fileKey))
      .filter((file): file is UserHarnessTreeItem => Boolean(file));
    const orderedKeys = new Set(ordered.map((file) => String(file.userHarnessFileId)));
    return [
      ...ordered,
      ...visibleEditableFiles.filter((file) => !orderedKeys.has(String(file.userHarnessFileId)))
    ];
  }, [closedTabKeys, editableFiles, tabOrder]);
  const activeFile = useMemo(
    () => harnessFiles.find((file) => String(file.userHarnessFileId) === activeId) ?? null,
    [activeId, harnessFiles]
  );
  const activeFileKey = activeFile ? String(activeFile.userHarnessFileId) : null;
  const activeIsFile = activeFile?.nodeType === "FILE";

  const {
    data: activeFilePayload,
    isFetching: contentLoading
  } = useQuery({
    queryKey: ["userHarnessFile", activeFileKey],
    queryFn: () => userHarnessApi.getFile(Number(activeFileKey)),
    enabled: !!activeFileKey && activeIsFile
  });

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  useEffect(() => {
    const fileKeys = editableFiles.map((file) => String(file.userHarnessFileId));
    setTabOrder((prev) => {
      const liveKeys = new Set(fileKeys);
      const next = [
        ...prev.filter((fileKey) => liveKeys.has(fileKey)),
        ...fileKeys.filter((fileKey) => !prev.includes(fileKey))
      ];
      return next.length === prev.length && next.every((fileKey, index) => fileKey === prev[index]) ? prev : next;
    });
  }, [editableFiles]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeContextMenu = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (harnessFiles.length === 0) {
      setActiveId(null);
      initializedActiveRef.current = false;
      return;
    }

    if (activeId && harnessFiles.some((file) => String(file.userHarnessFileId) === activeId)) {
      initializedActiveRef.current = true;
      return;
    }

    if (initializedActiveRef.current) {
      setActiveId(null);
      return;
    }

    const firstFile = editableFiles[0] ?? harnessFiles[0];
    setActiveId(String(firstFile.userHarnessFileId));
    initializedActiveRef.current = true;
  }, [activeId, editableFiles, harnessFiles]);

  useEffect(() => {
    if (!activeFilePayload) return;
    const key = String(activeFilePayload.userHarnessFileId);
    const nextContent = activeFilePayload.content ?? "";
    setContents((prev) => {
      if (dirty.has(key) || prev[key] === nextContent) return prev;
      return { ...prev, [key]: nextContent };
    });
  }, [activeFilePayload, dirty]);

  const activeContent = activeFileKey ? contents[activeFileKey] ?? activeFilePayload?.content ?? "" : "";
  const totalDirty = dirty.size;
  const activeTag = getHarnessTag(activeFile);

  const handleContentChange = (value: string) => {
    if (!activeFileKey || !activeIsFile) return;
    setContents((prev) => ({ ...prev, [activeFileKey]: value }));
    setDirty((prev) => new Set(prev).add(activeFileKey));
  };

  const openFileInTab = (fileKey: string) => {
    setClosedTabKeys((prev) => {
      if (!prev.has(fileKey)) return prev;
      const next = new Set(prev);
      next.delete(fileKey);
      return next;
    });
    setActiveId(fileKey);
  };

  const handleCloseTab = (file: UserHarnessTreeItem) => {
    const closingKey = String(file.userHarnessFileId);
    const visibleKeys = orderedEditableFiles.map((item) => String(item.userHarnessFileId));
    const closingIndex = visibleKeys.indexOf(closingKey);
    const nextActiveKey =
      activeId === closingKey
        ? visibleKeys[closingIndex + 1] ?? visibleKeys[closingIndex - 1] ?? null
        : activeId;

    setClosedTabKeys((prev) => new Set(prev).add(closingKey));
    if (activeId === closingKey) {
      setActiveId(nextActiveKey);
    }
  };

  const handleSaveActive = async () => {
    if (!activeFile || !activeFileKey || !activeIsFile) return;
    setActionLoading(true);
    try {
      await userHarnessApi.saveFile(activeFile.userHarnessFileId, activeContent);
      await queryClient.invalidateQueries({ queryKey: ["userHarnessFile", activeFileKey] });
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(activeFileKey);
        return next;
      });
      addToast(`${activeFile.name} 저장 완료`, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "하네스 파일 저장에 실패했습니다.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!activeFileKey || !activeIsFile || actionLoading || !dirty.has(activeFileKey)) return;
      void handleSaveActive();
    };

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [activeFileKey, activeIsFile, actionLoading, dirty, handleSaveActive]);

  const handleSaveAll = async () => {
    const targets = editableFiles.filter((file) => dirty.has(String(file.userHarnessFileId)));
    if (targets.length === 0) return;
    setActionLoading(true);
    try {
      await Promise.all(
        targets.map((file) => {
          const key = String(file.userHarnessFileId);
          return userHarnessApi.saveFile(file.userHarnessFileId, contents[key] ?? "");
        })
      );
      await queryClient.invalidateQueries({ queryKey: ["userHarnessTree"] });
      targets.forEach((file) => {
        void queryClient.invalidateQueries({ queryKey: ["userHarnessFile", String(file.userHarnessFileId)] });
      });
      setDirty(new Set());
      addToast(`${targets.length}개 파일 저장 완료`, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "하네스 파일 저장에 실패했습니다.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async (targetFile = activeFile) => {
    if (!targetFile || targetFile.nodeType !== "FILE") return;
    const targetKey = String(targetFile.userHarnessFileId);
    if (dirty.has(targetKey)) {
      setResetTarget(targetFile);
      return;
    }
    await performReset(targetFile);
  };

  const performReset = async (targetFile = resetTarget) => {
    if (!targetFile || targetFile.nodeType !== "FILE") return;
    const targetKey = String(targetFile.userHarnessFileId);
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(targetKey);
      return next;
    });
    await queryClient.invalidateQueries({ queryKey: ["userHarnessFile", targetKey] });
    setResetTarget(null);
    addToast(`${targetFile.name}을 서버 내용으로 되돌렸습니다.`, "success");
  };

  const beginCreate = (nodeType: "FILE" | "DIRECTORY", parentPath = "") => {
    setContextMenu(null);
    setRenameDraft(null);
    setCreateDraft({
      nodeType,
      parentPath: normalizeHarnessPath(parentPath),
      value: ""
    });
  };

  const cancelCreate = () => setCreateDraft(null);

  const commitCreate = async () => {
    if (!createDraft) return;
    const rawName = createDraft.value.trim().replace(/^\/+|\/+$/g, "");
    if (!rawName) {
      setCreateDraft(null);
      return;
    }
    const nextPath = normalizeHarnessPath(createDraft.parentPath ? `${createDraft.parentPath}/${rawName}` : rawName);
    if (!nextPath) return;

    const name = getFileName(nextPath);
    const fileType = createDraft.nodeType === "FILE" ? inferFileType(nextPath) : null;
    if (createDraft.nodeType === "FILE" && !fileType) {
      addToast("사용자 하네스 파일은 .md / .toml / .yaml 파일만 만들 수 있습니다.", "warning");
      return;
    }
    if (harnessFiles.some((file) => file.path === nextPath)) {
      addToast("같은 경로의 파일 또는 폴더가 이미 있습니다.", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const created = await userHarnessApi.createFile({
        path: nextPath,
        name,
        nodeType: createDraft.nodeType,
        fileType,
        content: createDraft.nodeType === "FILE" ? "" : null
      });
      await queryClient.invalidateQueries({ queryKey: ["userHarnessTree"] });
      if (created.nodeType === "FILE") {
        const createdKey = String(created.userHarnessFileId);
        setContents((prev) => ({ ...prev, [createdKey]: created.content ?? "" }));
      setTabOrder((prev) => [...prev.filter((fileKey) => fileKey !== createdKey), createdKey]);
      setClosedTabKeys((prev) => {
        if (!prev.has(createdKey)) return prev;
        const next = new Set(prev);
        next.delete(createdKey);
        return next;
      });
      setActiveId(createdKey);
      }
      setCreateDraft(null);
      addToast(`${name} 생성 완료`, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "하네스 파일 생성에 실패했습니다.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const beginRename = (targetFile = activeFile) => {
    if (!targetFile) return;
    setContextMenu(null);
    setCreateDraft(null);
    setRenameDraft({
      target: targetFile,
      parentPath: getParentPath(targetFile.path),
      value: getFileName(targetFile.path)
    });
    setActiveId(String(targetFile.userHarnessFileId));
  };

  const cancelRename = () => setRenameDraft(null);

  const commitRename = async () => {
    if (!renameDraft) return;
    const rawName = renameDraft.value.trim().replace(/^\/+|\/+$/g, "");
    if (!rawName) {
      setRenameDraft(null);
      return;
    }
    const toPath = normalizeHarnessPath(renameDraft.parentPath ? `${renameDraft.parentPath}/${rawName}` : rawName);
    if (!toPath || toPath === renameDraft.target.path) {
      setRenameDraft(null);
      return;
    }
    if (harnessFiles.some((file) => file.userHarnessFileId !== renameDraft.target.userHarnessFileId && file.path === toPath)) {
      addToast("같은 경로의 파일 또는 폴더가 이미 있습니다.", "warning");
      return;
    }

    setActionLoading(true);
    try {
      await userHarnessApi.moveFile(renameDraft.target.userHarnessFileId, toPath);
      await queryClient.invalidateQueries({ queryKey: ["userHarnessTree"] });
      setActiveId(String(renameDraft.target.userHarnessFileId));
      setRenameDraft(null);
      addToast(`${getFileName(toPath)} 경로 변경 완료`, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "하네스 파일 이동에 실패했습니다.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const requestDelete = (targetFile = activeFile) => {
    if (!targetFile) return;
    setContextMenu(null);
    setDeleteTarget(targetFile);
  };

  const performDelete = async () => {
    const targetFile = deleteTarget;
    if (!targetFile) return;
    const deletedKey = String(targetFile.userHarnessFileId);
    setActionLoading(true);
    try {
      await userHarnessApi.deleteFile(targetFile.userHarnessFileId);
      await queryClient.invalidateQueries({ queryKey: ["userHarnessTree"] });
      setContents((prev) => {
        const next = { ...prev };
        delete next[deletedKey];
        return next;
      });
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(deletedKey);
        return next;
      });
      setTabOrder((prev) => prev.filter((fileKey) => fileKey !== deletedKey));
      setClosedTabKeys((prev) => {
        const next = new Set(prev);
        next.delete(deletedKey);
        return next;
      });
      if (activeId === deletedKey) {
        setActiveId(null);
      }
      setDeleteTarget(null);
      addToast(`${targetFile.name} 삭제 완료`, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "하네스 파일 삭제에 실패했습니다.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const openContextMenu = (event: React.MouseEvent<HTMLElement>, target: UserHarnessTreeItem | null) => {
    event.preventDefault();
    event.stopPropagation();
    if (target) {
      openFileInTab(String(target.userHarnessFileId));
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target
    });
  };

  const handleOpenFromContextMenu = () => {
    if (contextMenu?.target) {
      openFileInTab(String(contextMenu.target.userHarnessFileId));
    }
    setContextMenu(null);
  };

  const getContextParentPath = () => {
    const target = contextMenu?.target;
    if (!target) return "";
    return target.nodeType === "DIRECTORY" ? target.path : getParentPath(target.path);
  };

  const clearTabDragState = () => {
    setDraggedTabId(null);
    setTabDropHint(null);
  };

  const getTabDropPosition = (event: React.DragEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX - bounds.left > bounds.width / 2 ? "after" : "before";
  };

  const handleTabDragStart = (event: React.DragEvent<HTMLDivElement>, tabId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tabId);
    setDraggedTabId(tabId);
    setTabDropHint(null);
  };

  const handleTabDragOver = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    const sourceId = draggedTabId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const position = getTabDropPosition(event);
    setTabDropHint((current) =>
      current?.targetId === targetId && current.position === position ? current : { targetId, position }
    );
  };

  const handleTabDrop = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    event.stopPropagation();

    const sourceId = draggedTabId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      clearTabDragState();
      return;
    }

    const position = tabDropHint?.targetId === targetId ? tabDropHint.position : getTabDropPosition(event);
    const liveTabKeys = orderedEditableFiles.map((file) => String(file.userHarnessFileId));
    setTabOrder((prev) => {
      const base = prev.length > 0 ? prev.filter((fileKey) => liveTabKeys.includes(fileKey)) : liveTabKeys;
      const withMissing = [...base, ...liveTabKeys.filter((fileKey) => !base.includes(fileKey))];
      const withoutSource = withMissing.filter((fileKey) => fileKey !== sourceId);
      const targetIndex = withoutSource.indexOf(targetId);
      if (targetIndex < 0) return withMissing;
      const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
      return [
        ...withoutSource.slice(0, insertIndex),
        sourceId,
        ...withoutSource.slice(insertIndex)
      ];
    });
    setActiveId(sourceId);
    clearTabDragState();
  };

  useEffect(() => {
    const rail = tabRailRef.current;
    if (!rail) return;

    const onWheel = (event: WheelEvent) => {
      if (rail.scrollWidth <= rail.clientWidth) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      rail.scrollLeft += delta;
    };

    rail.addEventListener("wheel", onWheel, { passive: false });
    return () => rail.removeEventListener("wheel", onWheel);
  }, []);

  /* Line count for meta display */
  const lineCount = useMemo(() => activeContent.split("\n").length, [activeContent]);

  return (
    <div className="harness-page relative min-h-screen overflow-hidden bg-[#EEF2FF]">
      {/* ─── Aurora / Mesh background ─── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Base mesh wash */}
        {/* Background grid */}
        {/* Grid pattern overlay */}
        <div className="harness-grid-overlay absolute inset-0 bg-grid-pattern opacity-[0.18]" />
        {/* Bottom fade to solid surface */}
        <div className="harness-page__fade absolute inset-x-0 bottom-0 h-[30vh]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16 space-y-6">
        {/* ── HEADER ── */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 animate-slide-up">
          <div className="min-w-0">
            <h1 className="harness-page__title text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-[1.05] mb-3 text-balance">
              하네스 에이전트 실행 환경 관리
            </h1>
            <p className="harness-page__subtitle text-[15px] text-gray-500 leading-relaxed whitespace-nowrap">
              에이전트가 세션에서 읽는 지침·행동 규칙·스킬 파일을 직접 수정합니다.
              저장된 내용은 새 풀이 세션부터 즉시 반영돼요.
            </p>
          </div>

          <div className="shrink-0" />
        </section>

        {/* ── EDITOR BODY (VS Code style) ── */}
        <section className="relative">
          <div
            className="harness-window rounded-xl overflow-hidden border-4 shadow-[0_0_0_1px_rgba(0,0,0,0.95),0_24px_60px_-24px_rgba(79,70,229,0.28)]"
            style={{ backgroundColor: IDE_TONE.workbench, borderColor: IDE_TONE.border }}
          >
            {/* Window titlebar — VS Code on Windows style */}
            <div
              className="flex items-center h-8 border-b select-none"
              style={{ backgroundColor: IDE_TONE.activity, borderColor: IDE_TONE.divider }}
            >
              {/* Center: title + save status */}
              <div className="flex-1 flex items-center justify-center gap-2 min-w-0 px-4">
                  <span className="text-[12px] font-mono font-semibold truncate" style={{ color: IDE_TONE.text }}>
                    {activeFile?.path ?? "user-harness"}
                  </span>
                {totalDirty > 0 && (
                  <span className="text-[11px] text-amber-400 shrink-0">●</span>
                )}
              </div>

              {/* Right: save + Windows-style controls */}
              <div className="flex items-stretch h-full shrink-0">
                {totalDirty > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleSaveAll()}
                    disabled={actionLoading}
                    className="flex items-center gap-1 px-3 h-full text-[11px] text-amber-300 hover:bg-amber-400/20 transition-colors font-mono disabled:opacity-40"
                  >
                    <Save size={10} strokeWidth={2.5} />
                    {actionLoading ? "저장 중" : `${totalDirty}개 저장`}
                  </button>
                )}
                {/* Minimize — horizontal line */}
                <button
                  type="button"
                  aria-label="최소화"
                  className="flex items-center justify-center w-11 h-full transition-colors"
                  style={{ color: IDE_TONE.muted }}
                >
                  <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
                    <rect width="10" height="1" fill="currentColor" />
                  </svg>
                </button>
                {/* Restore — square outline */}
                <button
                  type="button"
                  aria-label="최대화"
                  className="flex items-center justify-center w-11 h-full transition-colors"
                  style={{ color: IDE_TONE.muted }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </button>
                {/* Close — X */}
                <button
                  type="button"
                  aria-label="닫기"
                  className="flex items-center justify-center w-11 h-full transition-colors group"
                  style={{ color: IDE_TONE.muted }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="group-hover:stroke-white" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex" style={{ minHeight: "560px" }}>
              {/* ── Explorer sidebar ── */}
              <div
                className="w-52 shrink-0 flex flex-col border-r-2"
                style={{ backgroundColor: IDE_TONE.sidebar, borderColor: IDE_TONE.divider }}
              >
                {/* Explorer header */}
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: IDE_TONE.divider }}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: IDE_TONE.text }}>
                    Explorer
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono tabular-nums" style={{ color: IDE_TONE.muted2 }}>
                      {harnessFiles.length} files
                    </span>
                    <button
                      type="button"
                      title="파일 생성"
                      onClick={() => beginCreate("FILE")}
                      disabled={actionLoading}
                      className="p-1 rounded hover:bg-white/10 disabled:opacity-40"
                      style={{ color: IDE_TONE.muted }}
                    >
                      <FilePlus2 size={12} />
                    </button>
                    <button
                      type="button"
                      title="폴더 생성"
                      onClick={() => beginCreate("DIRECTORY")}
                      disabled={actionLoading}
                      className="p-1 rounded hover:bg-white/10 disabled:opacity-40"
                      style={{ color: IDE_TONE.muted }}
                    >
                      <FolderPlus size={12} />
                    </button>
                  </div>
                </div>

                {/* Workspace folder */}
                <div className="py-1" onContextMenu={(event) => openContextMenu(event, null)}>
                  {/* Folder row */}
                  <div className="flex items-center gap-1 px-2 py-1 select-none" style={{ color: IDE_TONE.text }}>
                    <ChevronDown size={13} className="shrink-0" style={{ color: IDE_TONE.muted }} />
                    <FolderOpen size={13} className="shrink-0" style={{ color: "#5b8dff" }} />
                    <span className="text-[11px] font-bold uppercase tracking-wide ml-0.5" style={{ color: IDE_TONE.text }}>
                      user-harness
                    </span>
                  </div>

                  {createDraft?.parentPath === "" && (
                    <div
                      className="flex items-center gap-2 pl-7 pr-3 py-[5px] text-[13px] font-mono"
                      style={{ color: IDE_TONE.text }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {createDraft.nodeType === "DIRECTORY" ? (
                        <FolderPlus size={14} className="shrink-0 text-sky-400" strokeWidth={1.8} />
                      ) : (
                        <FilePlus2 size={14} className="shrink-0 text-sky-400" strokeWidth={1.8} />
                      )}
                      <input
                        autoFocus
                        value={createDraft.value}
                        placeholder={createDraft.nodeType === "DIRECTORY" ? "폴더 이름" : "파일 이름"}
                        onChange={(event) => setCreateDraft((state) => (state ? { ...state, value: event.target.value } : state))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitCreate();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelCreate();
                          }
                        }}
                        onBlur={cancelCreate}
                        className="min-w-0 flex-1 rounded border bg-transparent px-1.5 py-0.5 text-[12px] outline-none"
                        style={{ borderColor: IDE_TONE.accent, color: IDE_TONE.text }}
                      />
                    </div>
                  )}

                  {treeLoading ? (
                    <div className="flex items-center gap-2 pl-7 pr-3 py-2 text-[12px] font-mono" style={{ color: IDE_TONE.muted }}>
                      <Loader2 size={13} className="animate-spin" />
                      불러오는 중
                    </div>
                  ) : treeError ? (
                    <button
                      type="button"
                      onClick={() => void refetchTree()}
                      className="w-full pl-7 pr-3 py-2 text-left text-[12px] font-mono"
                      style={{ color: "#fca5a5" }}
                    >
                      파일 트리 재시도
                    </button>
                  ) : harnessFiles.length === 0 ? (
                    <div className="pl-7 pr-3 py-3 text-[12px] leading-relaxed" style={{ color: IDE_TONE.muted }}>
                      API에서 받아온 하네스 파일이 없습니다.
                    </div>
                  ) : harnessFiles.map((file) => {
                    const fileKey = String(file.userHarnessFileId);
                    const active = activeId === fileKey;
                    const isDirty = dirty.has(fileKey);
                    const Icon = getHarnessIcon(file);
                    const isRenameTarget = renameDraft?.target.userHarnessFileId === file.userHarnessFileId;
                    const isCreateParent = file.nodeType === "DIRECTORY" && createDraft?.parentPath === file.path;
                    const tag = getHarnessTag(file);
                    const tagColors: Record<HarnessTag, string> = {
                      main: "text-sky-400",
                      meta: "text-slate-400",
                      temp: "text-violet-400"
                    };
                    return (
                      <div key={file.userHarnessFileId}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openFileInTab(fileKey)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            openFileInTab(fileKey);
                          }}
                          onContextMenu={(event) => openContextMenu(event, file)}
                          className="w-full flex items-center gap-2 pl-7 pr-3 py-[5px] text-left text-[13px] font-mono transition-colors"
                          style={{
                            paddingLeft: `${28 + getPathDepth(file.path) * 14}px`,
                            backgroundColor:
                              active
                                ? IDE_TONE.accentDim
                                : contextMenu?.target?.userHarnessFileId === file.userHarnessFileId
                                  ? IDE_TONE.hover
                                  : "transparent",
                            color: active ? IDE_TONE.text : IDE_TONE.muted
                          }}
                        >
                          <Icon
                            size={14}
                            strokeWidth={1.8}
                            className={`shrink-0 ${active ? "" : tagColors[tag]}`}
                            style={active ? { color: IDE_TONE.accent } : undefined}
                          />
                          {isRenameTarget ? (
                            <input
                              autoFocus
                              value={renameDraft.value}
                              onChange={(event) =>
                                setRenameDraft((state) => (state ? { ...state, value: event.target.value } : state))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void commitRename();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelRename();
                                }
                              }}
                              onBlur={cancelRename}
                              onClick={(event) => event.stopPropagation()}
                              className="min-w-0 flex-1 rounded border bg-transparent px-1.5 py-0.5 text-[12px] outline-none"
                              style={{ borderColor: IDE_TONE.accent, color: IDE_TONE.text }}
                            />
                          ) : (
                            <span className="flex-1 truncate">{file.name}</span>
                          )}
                          {isDirty && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                              title="저장 안 됨"
                            />
                          )}
                        </div>
                        {isCreateParent && (
                          <div
                            className="flex items-center gap-2 pl-7 pr-3 py-[5px] text-[13px] font-mono"
                            style={{
                              paddingLeft: `${42 + getPathDepth(file.path) * 14}px`,
                              color: IDE_TONE.text
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {createDraft.nodeType === "DIRECTORY" ? (
                              <FolderPlus size={14} className="shrink-0 text-sky-400" strokeWidth={1.8} />
                            ) : (
                              <FilePlus2 size={14} className="shrink-0 text-sky-400" strokeWidth={1.8} />
                            )}
                            <input
                              autoFocus
                              value={createDraft.value}
                              placeholder={createDraft.nodeType === "DIRECTORY" ? "폴더 이름" : "파일 이름"}
                              onChange={(event) =>
                                setCreateDraft((state) => (state ? { ...state, value: event.target.value } : state))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void commitCreate();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelCreate();
                                }
                              }}
                              onBlur={cancelCreate}
                              className="min-w-0 flex-1 rounded border bg-transparent px-1.5 py-0.5 text-[12px] outline-none"
                              style={{ borderColor: IDE_TONE.accent, color: IDE_TONE.text }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* File summary at bottom */}
                <div className="mt-auto border-t p-3" style={{ borderColor: IDE_TONE.divider }}>
                  <div className="text-[11px] font-mono mb-1 uppercase tracking-wider" style={{ color: IDE_TONE.muted2 }}>
                    선택됨
                  </div>
                  <div className="text-[11px] leading-relaxed" style={{ color: IDE_TONE.muted }}>
                    {getHarnessSummary(activeFile)}
                  </div>
                  {activeFile && (
                    <span
                      className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${TAG_STYLE[activeTag]}`}
                    >
                      {activeTag}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Editor panel ── */}
              <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: IDE_TONE.workbench }}>
                {/* Tab bar */}
                <div
                  className="flex items-stretch border-b"
                  style={{ backgroundColor: IDE_TONE.tab, borderColor: IDE_TONE.divider }}
                >
                  <div ref={tabRailRef} className="harness-tabs-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden">
                    {orderedEditableFiles.map((file) => {
                      const fileKey = String(file.userHarnessFileId);
                      const active = activeId === fileKey;
                      const isDirty = dirty.has(fileKey);
                      const isDragging = draggedTabId === fileKey;
                      const showDropBefore = tabDropHint?.targetId === fileKey && tabDropHint.position === "before";
                      const showDropAfter = tabDropHint?.targetId === fileKey && tabDropHint.position === "after";
                      return (
                        <div
                          key={file.userHarnessFileId}
                          role="button"
                          tabIndex={0}
                          aria-selected={active}
                          draggable
                          onClick={() => openFileInTab(fileKey)}
                          onContextMenu={(event) => openContextMenu(event, file)}
                          onDragStart={(event) => handleTabDragStart(event, fileKey)}
                          onDragOver={(event) => handleTabDragOver(event, fileKey)}
                          onDrop={(event) => handleTabDrop(event, fileKey)}
                          onDragEnd={clearTabDragState}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            openFileInTab(fileKey);
                          }}
                          className="group relative flex min-w-[150px] max-w-[220px] shrink-0 cursor-grab items-center gap-2 px-3 py-2 text-[12px] font-mono whitespace-nowrap border-r border-b transition-colors active:cursor-grabbing"
                          style={{
                            backgroundColor: active ? IDE_TONE.tabActive : "transparent",
                            borderColor: IDE_TONE.divider,
                            color: active ? IDE_TONE.text : IDE_TONE.muted,
                            opacity: isDragging ? 0.52 : 1
                          }}
                        >
                          {showDropBefore && (
                            <span
                              className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full"
                              style={{ backgroundColor: IDE_TONE.accent }}
                            />
                          )}
                          {showDropAfter && (
                            <span
                              className="pointer-events-none absolute right-0 top-1.5 bottom-1.5 w-[2px] rounded-full"
                              style={{ backgroundColor: IDE_TONE.accent }}
                            />
                          )}
                          {/* Active top border */}
                          {active && (
                            <span className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: IDE_TONE.accent }} />
                          )}
                          <span className="min-w-0 truncate">{file.name}</span>
                          {isDirty && (
                            <span className="w-2 h-2 rounded-full opacity-80 shrink-0" style={{ backgroundColor: IDE_TONE.muted }} />
                          )}
                          <span className="ml-1 flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            <button
                              type="button"
                              title="탭 닫기"
                              aria-label={`${file.name} 탭 닫기`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCloseTab(file);
                              }}
                              className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-white/10"
                              style={{ color: IDE_TONE.muted }}
                            >
                              <X size={11} strokeWidth={2.5} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions pushed to right */}
                  <div className="flex shrink-0 items-center gap-1 px-3">
                    <div className="flex items-center rounded overflow-hidden" style={{ boxShadow: `0 0 0 1px ${IDE_TONE.divider}` }}>
                      <button
                        type="button"
                        onClick={() => setViewMode("edit")}
                        title="편집 모드"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] transition-colors"
                        style={{
                          backgroundColor: viewMode === "edit" ? IDE_TONE.accent : IDE_TONE.pill,
                          color: viewMode === "edit" ? "#ffffff" : IDE_TONE.muted
                        }}
                      >
                        <Pencil size={11} strokeWidth={2.4} />
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("preview")}
                        title="미리보기"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] transition-colors border-l"
                        style={{
                          backgroundColor: viewMode === "preview" ? IDE_TONE.accent : IDE_TONE.pill,
                          borderColor: IDE_TONE.divider,
                          color: viewMode === "preview" ? "#ffffff" : IDE_TONE.muted
                        }}
                      >
                        <Eye size={11} strokeWidth={2.4} />
                        미리보기
                      </button>
                    </div>
                  </div>
                </div>

                {/* Breadcrumb */}
                <div
                  className="flex items-center gap-1 px-4 py-1.5 text-[11px] font-mono border-y"
                  style={{ backgroundColor: IDE_TONE.workbench, borderColor: IDE_TONE.divider, color: IDE_TONE.muted }}
                >
                  <span>user-harness</span>
                  {activeFile?.path.split("/").filter(Boolean).map((segment, index) => (
                    <span key={`${segment}-${index}`} className="contents">
                      <ChevronRight size={11} style={{ color: IDE_TONE.muted2 }} />
                      <span style={{ color: IDE_TONE.text }}>{segment}</span>
                    </span>
                  ))}
                  {activeFileKey && dirty.has(activeFileKey) && (
                    <>
                      <span className="mx-2" style={{ color: IDE_TONE.divider }}>·</span>
                      <span className="text-amber-400">수정됨</span>
                    </>
                  )}
                  {contentLoading && (
                    <>
                      <span className="mx-2" style={{ color: IDE_TONE.divider }}>·</span>
                      <span className="flex items-center gap-1" style={{ color: IDE_TONE.muted }}>
                        <Loader2 size={10} className="animate-spin" />
                        내용 조회
                      </span>
                    </>
                  )}
                </div>

                {/* Editor body */}
                {!activeFile ? (
                  <div
                    className="flex flex-1 items-center justify-center text-[13px] font-mono"
                    style={{ minHeight: "460px", backgroundColor: IDE_TONE.workbench, color: IDE_TONE.muted }}
                  >
                    사용자 하네스 파일을 생성하거나 선택하세요.
                  </div>
                ) : activeFile.nodeType === "DIRECTORY" ? (
                  <div
                    className="flex flex-1 items-center justify-center gap-2 text-[13px] font-mono"
                    style={{ minHeight: "460px", backgroundColor: IDE_TONE.workbench, color: IDE_TONE.muted }}
                  >
                    <FolderOpen size={16} />
                    폴더는 내용 조회 대상이 아닙니다.
                  </div>
                ) : viewMode === "edit" ? (
                  <div className="flex flex-1 overflow-hidden" style={{ minHeight: "460px" }}>
                    {/* Line numbers */}
                    <div
                      ref={lineNumbersRef}
                      className="overflow-hidden select-none shrink-0 text-right pt-4 pb-4 pr-3 font-mono text-[13px] leading-6"
                      style={{ backgroundColor: IDE_TONE.workbench, color: IDE_TONE.muted, minWidth: "48px" }}
                    >
                      {activeContent.split("\n").map((_, i) => (
                        <div key={i} style={{ lineHeight: "24px" }}>
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    {/* Code textarea */}
                    <textarea
                      ref={textareaRef}
                      value={activeContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      onScroll={handleEditorScroll}
                      disabled={contentLoading || actionLoading}
                      spellCheck={false}
                      style={{
                        caretColor: IDE_TONE.accent,
                        color: IDE_TONE.code,
                        lineHeight: "24px",
                        backgroundColor: IDE_TONE.workbench
                      }}
                      className="harness-textarea-v2 flex-1 font-mono text-[13px] outline-none border-0 resize-none pt-4 pb-4 pr-6 overflow-y-auto selection:bg-indigo-200 selection:text-gray-950"
                    />
                  </div>
                ) : (
                  <div
                    className="flex-1 px-10 py-6 overflow-auto"
                    style={{ minHeight: "460px", backgroundColor: IDE_TONE.workbench }}
                  >
                    <div
                      className="harness-preview text-[14px] text-gray-800 leading-relaxed
                        [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-950 [&_h1]:mb-4 [&_h1]:mt-0 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-indigo-100
                        [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-950 [&_h2]:mt-6 [&_h2]:mb-2.5
                        [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-700 [&_h3]:mt-4 [&_h3]:mb-2
                        [&_p]:mb-3 [&_p]:text-gray-700
                        [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mb-3 [&_ul>li]:list-disc [&_ul>li]:marker:text-indigo-400
                        [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:mb-3 [&_ol]:marker:text-slate-400
                        [&_code]:bg-indigo-50 [&_code]:text-violet-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono [&_code]:ring-1 [&_code]:ring-indigo-100
                        [&_pre]:bg-slate-50 [&_pre]:text-gray-800 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre]:ring-1 [&_pre]:ring-indigo-100 [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_pre_code]:ring-0
                        [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:my-3 [&_blockquote]:text-slate-500 [&_blockquote]:italic
                        [&_hr]:my-5 [&_hr]:border-t [&_hr]:border-indigo-100
                        [&_strong]:font-bold [&_strong]:text-gray-950
                        [&_a]:text-indigo-400 [&_a]:underline [&_a]:underline-offset-2"
                    >
                      {isMarkdownFile(activeFile) ? (
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {activeContent || "*내용이 비어있습니다*"}
                        </Markdown>
                      ) : (
                        <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-slate-700">
                          {activeContent || "내용이 비어있습니다"}
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {/* Status bar */}
                <div
                  className="flex items-center justify-between px-4 h-6 text-white text-[11px] font-mono shrink-0 border-t"
                  style={{ backgroundColor: IDE_TONE.status, borderColor: IDE_TONE.divider }}
                >
                  <div className="flex items-center gap-4">
                    <span>{activeFile?.fileType ?? "HARNESS"}</span>
                    <span className="text-white/75">{activeFile?.path ?? "user-harness"}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {activeFileKey && dirty.has(activeFileKey) && (
                      <span className="text-amber-300">● 저장 안 됨</span>
                    )}
                    <span>Ln 1 — {lineCount} lines</span>
                    <span>UTF-8</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {deleteTarget && (
          <div
            className="ide-save-modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!actionLoading) setDeleteTarget(null);
            }}
          >
            <div
              className="ide-save-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="harness-delete-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="ide-save-modal__head">
                <strong id="harness-delete-modal-title">삭제할까요?</strong>
                <span>
                  {deleteTarget.path}을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                </span>
              </div>
              <div className="ide-save-modal__actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={actionLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => void performDelete()}
                  disabled={actionLoading}
                  style={{ borderColor: "rgba(248,113,113,0.5)", color: "#fecaca" }}
                >
                  {actionLoading ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </div>
          </div>
        )}

        {resetTarget && (
          <div
            className="ide-save-modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!actionLoading) setResetTarget(null);
            }}
          >
            <div
              className="ide-save-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="harness-reset-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="ide-save-modal__head">
                <strong id="harness-reset-modal-title">서버 내용으로 되돌릴까요?</strong>
                <span>
                  {resetTarget.name}의 저장하지 않은 변경사항이 사라집니다.
                </span>
              </div>
              <div className="ide-save-modal__actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setResetTarget(null)}
                  disabled={actionLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void performReset()}
                  disabled={actionLoading}
                >
                  되돌리기
                </button>
              </div>
            </div>
          </div>
        )}

        {contextMenu && (
          <div
            className="fixed z-[120] min-w-[184px] rounded-lg border p-1.5 shadow-2xl backdrop-blur-md"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              backgroundColor: IDE_TONE.tabActive,
              borderColor: IDE_TONE.divider,
              color: IDE_TONE.text
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {contextMenu.target && (
              <>
                <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-mono truncate" style={{ color: IDE_TONE.muted2 }}>
                  {contextMenu.target.path}
                </div>
                <button
                  type="button"
                  className="flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[12px] font-mono transition-colors hover:bg-white/10"
                  onClick={handleOpenFromContextMenu}
                >
                  <Eye size={13} strokeWidth={2.2} />
                  <span>{contextMenu.target.nodeType === "FILE" ? "내용 조회" : "폴더 선택"}</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[12px] font-mono transition-colors hover:bg-white/10"
              onClick={() => {
                const parentPath = getContextParentPath();
                setContextMenu(null);
                beginCreate("FILE", parentPath);
              }}
            >
              <FilePlus2 size={13} strokeWidth={2.2} />
              <span>파일 생성</span>
            </button>
            <button
              type="button"
              className="flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[12px] font-mono transition-colors hover:bg-white/10"
              onClick={() => {
                const parentPath = getContextParentPath();
                setContextMenu(null);
                beginCreate("DIRECTORY", parentPath);
              }}
            >
              <FolderPlus size={13} strokeWidth={2.2} />
              <span>폴더 생성</span>
            </button>
            {contextMenu.target && (
              <>
                <div className="my-1 h-px" style={{ backgroundColor: IDE_TONE.divider }} />
                <button
                  type="button"
                  disabled={actionLoading}
                  className="flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[12px] font-mono transition-colors hover:bg-white/10 disabled:opacity-40"
                  onClick={() => {
                    const target = contextMenu.target;
                    setContextMenu(null);
                    if (target) beginRename(target);
                  }}
                >
                  <Edit3 size={13} strokeWidth={2.2} />
                  <span>이름 변경/이동</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  className="flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[12px] font-mono text-red-200 transition-colors hover:bg-red-500/15 disabled:opacity-40"
                  onClick={() => {
                    const target = contextMenu.target;
                    setContextMenu(null);
                    if (target) requestDelete(target);
                  }}
                >
                  <Trash2 size={13} strokeWidth={2.2} />
                  <span>삭제</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* ── INFO BANNER (glass) ── */}
        <section className={`rounded-2xl px-5 py-4 ${GLASS}`}>
          <div className="harness-info-copy text-sm text-gray-700 leading-relaxed">
            <strong className="font-bold text-gray-900">실행 환경 안내 · </strong>
            <code className="harness-inline-code font-mono text-xs bg-white/70 ring-1 ring-white/80 px-1.5 py-0.5 rounded">HARNESS.md</code>
            <span className="mx-1">+</span>
            <code className="harness-inline-code font-mono text-xs bg-white/70 ring-1 ring-white/80 px-1.5 py-0.5 rounded">instruction.md</code>
            는 모든 세션의 에이전트 프롬프트에 주입됩니다.
            <code className="harness-inline-code font-mono text-xs bg-white/70 ring-1 ring-white/80 px-1.5 py-0.5 rounded ml-1">.sandbox</code>는
            실험용이며 세션 평가·리포트 생성에 영향을 주지 않아요.
            API 키 관리는{" "}
            <a
              href="mypage"
              className="underline font-semibold text-indigo-700 hover:text-indigo-900 decoration-indigo-300 hover:decoration-indigo-500 underline-offset-2"
            >
              마이페이지
            </a>
            에서 할 수 있습니다.
          </div>
        </section>
      </div>
    </div>
  );
}

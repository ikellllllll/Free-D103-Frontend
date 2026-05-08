"use client";

import { create } from "zustand";

import type { AiEditSuggestion, AiMessage } from "@/lib/types/ai";
import type { RunResult, SubmissionResult, TestRunResult, WorkspaceFile } from "@/lib/types/session";

export interface SelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export type SidebarView = "explorer" | "search" | "extensions" | "trace" | "harness";
export type BottomPanelTab = "output" | "tests" | "trace" | "submission";

const isSameSelectionRange = (left: SelectionRange | null, right: SelectionRange | null) => {
  if (left === right) return true;
  if (!left || !right) return false;

  return (
    left.startLineNumber === right.startLineNumber &&
    left.startColumn === right.startColumn &&
    left.endLineNumber === right.endLineNumber &&
    left.endColumn === right.endColumn
  );
};

interface IdeState {
  files: WorkspaceFile[];
  activePath: string | null;
  unsavedPaths: string[];
  savedContents: Record<string, string>;
  selectedCode: string;
  selectedRange: SelectionRange | null;
  editInstruction: string;
  suggestion: AiEditSuggestion | null;
  aiMode: "chat" | "edit";
  messages: AiMessage[];
  runResult: RunResult | null;
  testResult: TestRunResult | null;
  submissionResult: SubmissionResult | null;
  submissionExecutionId: string | null;
  submissionLoading: boolean;
  lastSavedAt: string | null;
  sidebarView: SidebarView;
  sidebarOpen: boolean;
  sidebarWidth: number;
  aiOpen: boolean;
  aiPanelWidth: number;
  bottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;
  bottomPanelHeight: number;
  setWorkspace: (files: WorkspaceFile[], activePath?: string) => void;
  createWorkspaceFile: (file: WorkspaceFile, activate?: boolean) => void;
  renameWorkspaceFile: (fromPath: string, toPath: string) => void;
  removeWorkspaceFile: (path: string) => void;
  setActivePath: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  hydrateFileContent: (path: string, content: string, language?: string) => void;
  markSaved: (path?: string, savedAt?: string) => void;
  discardFileChanges: (path: string) => void;
  setSelection: (code: string, range: SelectionRange | null) => void;
  setEditInstruction: (value: string) => void;
  setSuggestion: (value: AiEditSuggestion | null) => void;
  setAiMode: (value: "chat" | "edit") => void;
  setMessages: (messages: AiMessage[]) => void;
  appendMessages: (messages: AiMessage[]) => void;
  setRunResult: (result: RunResult | null) => void;
  setTestResult: (result: TestRunResult | null) => void;
  setSubmissionResult: (result: SubmissionResult | null) => void;
  setSubmissionExecutionId: (id: string | null) => void;
  setSubmissionLoading: (value: boolean) => void;
  resetSubmission: () => void;
  setSidebarView: (value: SidebarView) => void;
  setSidebarOpen: (value: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (value: number) => void;
  setAiOpen: (value: boolean) => void;
  toggleAiOpen: () => void;
  setAiPanelWidth: (value: number) => void;
  setBottomPanelOpen: (value: boolean) => void;
  setBottomPanelTab: (value: BottomPanelTab) => void;
  setBottomPanelHeight: (value: number) => void;
  resetSession: () => void;
}

export const useIdeStore = create<IdeState>((set) => ({
  files: [],
  activePath: null,
  unsavedPaths: [],
  savedContents: {},
  selectedCode: "",
  selectedRange: null,
  editInstruction: "예외 처리와 반환 흐름이 안전하도록 수정해줘",
  suggestion: null,
  aiMode: "chat",
  messages: [],
  runResult: null,
  testResult: null,
  submissionResult: null,
  submissionExecutionId: null,
  submissionLoading: false,
  lastSavedAt: null,
  sidebarView: "explorer",
  sidebarOpen: true,
  sidebarWidth: 280,
  aiOpen: true,
  aiPanelWidth: 360,
  bottomPanelOpen: true,
  bottomPanelTab: "output",
  bottomPanelHeight: 220,
  // 백엔드에서 받은 files 와 store 의 기존 files 를 머지.
  // 사유:
  //  (a) sessionApi.createFile 후 setWorkspace 가 호출되면 백엔드 응답의 content (대부분 빈 문자열) 가
  //      기존 store 의 content 를 덮어써서 다른 파일들 내용이 사라지는 버그 방지 (#1).
  //  (b) savedContents (saved baseline) 도 같이 덮어쓰면 dirty 가 baseline 으로 굳어버려 discardChanges 불가 + autosave 가 dirty 를 영구 저장 (#1).
  //  (c) caller 가 activePath 를 안 주면 store 의 기존 activePath 가 valid 한 동안은 보존, invalidate 시 random 점프 방지 (#3).
  setWorkspace: (files, activePath) =>
    set((state) => {
      const existingContent = new Map(state.files.map((file) => [file.path, file.content]));
      const mergedFiles = files.map((file) => {
        const existing = existingContent.get(file.path);
        // 기존 content 가 있고 비어있지 않으면 보존. 그 외엔 백엔드 응답 사용.
        return existing && existing.length > 0 ? { ...file, content: existing } : file;
      });
      const validPaths = new Set(mergedFiles.map((f) => f.path));
      const nextUnsavedPaths = state.unsavedPaths.filter((p) => validPaths.has(p));
      // activePath 우선순위: caller 명시 > store 의 기존 activePath (valid 한 경우) > files[0] > null
      const nextActivePath =
        activePath ??
        (state.activePath && validPaths.has(state.activePath) ? state.activePath : mergedFiles[0]?.path ?? null);
      // savedContents: 기존 baseline 보존 + 새로 들어온 파일 (또는 빈 baseline 이었던 파일) 만 새 content 로 등록.
      // dirty 가 있는 파일의 baseline 을 dirty content 로 덮어쓰지 않도록 방어.
      const nextSavedContents = { ...state.savedContents };
      mergedFiles.forEach((file) => {
        const existingBaseline = nextSavedContents[file.path];
        if (existingBaseline === undefined) {
          // 신규 파일 또는 기존 baseline 없음 — 백엔드 content 를 baseline 으로.
          nextSavedContents[file.path] = file.content;
        }
        // 기존 baseline 있으면 그대로 유지 (dirty 보존).
      });
      // 사라진 파일의 baseline prune.
      Object.keys(nextSavedContents).forEach((path) => {
        if (!validPaths.has(path)) delete nextSavedContents[path];
      });
      return {
        files: mergedFiles,
        activePath: nextActivePath,
        unsavedPaths: nextUnsavedPaths,
        savedContents: nextSavedContents
      };
    }),
  createWorkspaceFile: (file, activate) =>
    set((state) => {
      if (state.files.some((item) => item.path === file.path)) {
        return activate ? { activePath: file.path } : state;
      }

      return {
        files: [...state.files, file],
        activePath: activate ? file.path : state.activePath ?? file.path,
        savedContents: {
          ...state.savedContents,
          [file.path]: file.content
        }
      };
    }),
  renameWorkspaceFile: (fromPath, toPath) =>
    set((state) => {
      const nextSavedContents = { ...state.savedContents };
      if (fromPath in nextSavedContents) {
        nextSavedContents[toPath] = nextSavedContents[fromPath];
        delete nextSavedContents[fromPath];
      }

      return {
        files: state.files.map((file) => (file.path === fromPath ? { ...file, path: toPath } : file)),
        activePath: state.activePath === fromPath ? toPath : state.activePath,
        unsavedPaths: state.unsavedPaths.map((path) => (path === fromPath ? toPath : path)),
        savedContents: nextSavedContents
      };
    }),
  removeWorkspaceFile: (path) =>
    set((state) => {
      const nextSavedContents = { ...state.savedContents };
      delete nextSavedContents[path];

      return {
        files: state.files.filter((file) => file.path !== path),
        activePath: state.activePath === path ? state.files.find((file) => file.path !== path)?.path ?? null : state.activePath,
        unsavedPaths: state.unsavedPaths.filter((item) => item !== path),
        savedContents: nextSavedContents
      };
    }),
  setActivePath: (path) => set({ activePath: path }),
  updateFileContent: (path, content) =>
    set((state) => {
      const savedContent = state.savedContents[path] ?? "";
      const nextUnsavedPaths =
        content === savedContent
          ? state.unsavedPaths.filter((item) => item !== path)
          : state.unsavedPaths.includes(path)
            ? state.unsavedPaths
            : [...state.unsavedPaths, path];

      return {
        files: state.files.map((file) => (file.path === path ? { ...file, content } : file)),
        unsavedPaths: nextUnsavedPaths
      };
    }),
  // 백엔드에서 받은 file content 로 store 채우기 (lazy load).
  // ⚠️ 사용자가 그 사이에 편집 중이면 (dirty) skip — race condition 으로 dirty 덮어쓰기 방지 (#8).
  hydrateFileContent: (path, content, language) =>
    set((state) => {
      const isDirty = state.unsavedPaths.includes(path);
      if (isDirty) {
        // 사용자가 편집 중. content 만 덮어쓰지 않고 language 만 갱신 (있으면).
        if (language) {
          return {
            files: state.files.map((file) =>
              file.path === path ? { ...file, language } : file
            )
          };
        }
        return state;
      }
      return {
        files: state.files.map((file) =>
          file.path === path
            ? {
                ...file,
                content,
                language: language ?? file.language
              }
            : file
        ),
        savedContents: {
          ...state.savedContents,
          [path]: content
        },
        unsavedPaths: state.unsavedPaths.filter((item) => item !== path)
      };
    }),
  markSaved: (path, savedAt) =>
    set((state) => {
      const targetPaths = path ? [path] : state.unsavedPaths;
      const nextSavedContents = { ...state.savedContents };

      targetPaths.forEach((targetPath) => {
        const file = state.files.find((item) => item.path === targetPath);
        if (file) {
          nextSavedContents[targetPath] = file.content;
        }
      });

      return {
        unsavedPaths: path ? state.unsavedPaths.filter((item) => item !== path) : [],
        savedContents: nextSavedContents,
        lastSavedAt: savedAt ?? new Date().toISOString()
      };
    }),
  discardFileChanges: (path) =>
    set((state) => {
      const savedContent = state.savedContents[path];
      if (savedContent === undefined) {
        return state;
      }

      return {
        files: state.files.map((file) => (file.path === path ? { ...file, content: savedContent } : file)),
        unsavedPaths: state.unsavedPaths.filter((item) => item !== path)
      };
    }),
  setSelection: (code, range) =>
    set((state) => {
      const nextAiMode = code ? "edit" : state.aiMode;

      if (
        state.selectedCode === code &&
        isSameSelectionRange(state.selectedRange, range) &&
        state.aiMode === nextAiMode
      ) {
        return state;
      }

      return {
        selectedCode: code,
        selectedRange: range,
        aiMode: nextAiMode
      };
    }),
  setEditInstruction: (value) => set({ editInstruction: value }),
  setSuggestion: (value) => set({ suggestion: value }),
  setAiMode: (value) => set({ aiMode: value }),
  setMessages: (messages) => set({ messages }),
  appendMessages: (messages) =>
    set((state) => ({
      messages: [...state.messages, ...messages]
    })),
  setRunResult: (result) => set({ runResult: result, bottomPanelOpen: true, bottomPanelTab: "output" }),
  setTestResult: (result) => set({ testResult: result, bottomPanelOpen: true, bottomPanelTab: "tests" }),
  setSubmissionResult: (result) => set({ submissionResult: result }),
  setSubmissionExecutionId: (id) => set({ submissionExecutionId: id }),
  setSubmissionLoading: (value) => set({ submissionLoading: value }),
  resetSubmission: () =>
    set({ submissionExecutionId: null, submissionResult: null, submissionLoading: false }),
  setSidebarView: (value) => set({ sidebarView: value, sidebarOpen: true }),
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarWidth: (value) => set({ sidebarWidth: value }),
  setAiOpen: (value) => set({ aiOpen: value }),
  toggleAiOpen: () => set((state) => ({ aiOpen: !state.aiOpen })),
  setAiPanelWidth: (value) => set({ aiPanelWidth: value }),
  setBottomPanelOpen: (value) => set({ bottomPanelOpen: value }),
  setBottomPanelTab: (value) => set({ bottomPanelTab: value, bottomPanelOpen: true }),
  setBottomPanelHeight: (value) => set({ bottomPanelHeight: value }),
  resetSession: () =>
    set({
      files: [],
      activePath: null,
      unsavedPaths: [],
      savedContents: {},
      selectedCode: "",
      selectedRange: null,
      editInstruction: "예외 처리와 반환 흐름이 안전하도록 수정해줘",
      suggestion: null,
      aiMode: "chat",
      messages: [],
      runResult: null,
      testResult: null,
      submissionResult: null,
      submissionExecutionId: null,
      submissionLoading: false,
      lastSavedAt: null,
      sidebarView: "explorer",
      sidebarOpen: true,
      sidebarWidth: 280,
      aiOpen: true,
      aiPanelWidth: 360,
      bottomPanelOpen: true,
      bottomPanelTab: "output",
      bottomPanelHeight: 220
    })
}));

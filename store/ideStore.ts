"use client";

import { create } from "zustand";

import type { AiEditSuggestion, AiMessage } from "@/lib/types/ai";
import type { RunResult, TestRunResult, WorkspaceFile } from "@/lib/types/session";

export interface SelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export type SidebarView = "explorer" | "search" | "extensions" | "trace";
export type BottomPanelTab = "output" | "tests" | "trace";

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
  selectedCode: string;
  selectedRange: SelectionRange | null;
  editInstruction: string;
  suggestion: AiEditSuggestion | null;
  aiMode: "chat" | "edit";
  messages: AiMessage[];
  runResult: RunResult | null;
  testResult: TestRunResult | null;
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
  setSelection: (code: string, range: SelectionRange | null) => void;
  setEditInstruction: (value: string) => void;
  setSuggestion: (value: AiEditSuggestion | null) => void;
  setAiMode: (value: "chat" | "edit") => void;
  setMessages: (messages: AiMessage[]) => void;
  appendMessages: (messages: AiMessage[]) => void;
  setRunResult: (result: RunResult | null) => void;
  setTestResult: (result: TestRunResult | null) => void;
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
  selectedCode: "",
  selectedRange: null,
  editInstruction: "예외 처리와 반환 흐름이 안전하도록 수정해줘",
  suggestion: null,
  aiMode: "chat",
  messages: [],
  runResult: null,
  testResult: null,
  lastSavedAt: null,
  sidebarView: "explorer",
  sidebarOpen: true,
  sidebarWidth: 280,
  aiOpen: true,
  aiPanelWidth: 360,
  bottomPanelOpen: true,
  bottomPanelTab: "output",
  bottomPanelHeight: 220,
  setWorkspace: (files, activePath) =>
    set({
      files,
      activePath: activePath ?? files[0]?.path ?? null
    }),
  createWorkspaceFile: (file, activate) =>
    set((state) => {
      if (state.files.some((item) => item.path === file.path)) {
        return activate ? { activePath: file.path } : state;
      }

      return {
        files: [...state.files, file],
        activePath: activate ? file.path : state.activePath ?? file.path
      };
    }),
  renameWorkspaceFile: (fromPath, toPath) =>
    set((state) => ({
      files: state.files.map((file) => (file.path === fromPath ? { ...file, path: toPath } : file)),
      activePath: state.activePath === fromPath ? toPath : state.activePath,
      unsavedPaths: state.unsavedPaths.map((path) => (path === fromPath ? toPath : path))
    })),
  removeWorkspaceFile: (path) =>
    set((state) => ({
      files: state.files.filter((file) => file.path !== path),
      activePath: state.activePath === path ? state.files.find((file) => file.path !== path)?.path ?? null : state.activePath,
      unsavedPaths: state.unsavedPaths.filter((item) => item !== path)
    })),
  setActivePath: (path) => set({ activePath: path }),
  updateFileContent: (path, content) =>
    set((state) => ({
      files: state.files.map((file) => (file.path === path ? { ...file, content } : file)),
      unsavedPaths: state.unsavedPaths.includes(path)
        ? state.unsavedPaths
        : [...state.unsavedPaths, path]
    })),
  hydrateFileContent: (path, content, language) =>
    set((state) => ({
      files: state.files.map((file) =>
        file.path === path
          ? {
              ...file,
              content,
              language: language ?? file.language
            }
          : file
      )
    })),
  markSaved: (path, savedAt) =>
    set((state) => ({
      unsavedPaths: path ? state.unsavedPaths.filter((item) => item !== path) : [],
      lastSavedAt: savedAt ?? new Date().toISOString()
    })),
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
      selectedCode: "",
      selectedRange: null,
      editInstruction: "예외 처리와 반환 흐름이 안전하도록 수정해줘",
      suggestion: null,
      aiMode: "chat",
      messages: [],
      runResult: null,
      testResult: null,
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

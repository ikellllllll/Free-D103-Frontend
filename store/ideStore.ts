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

/**
 * 한 세션의 메시지 / agent 이벤트 누적량 상한.
 *
 * - MESSAGE 무한 누적 → 긴 세션에서 탭 OOM (수십 turn × agentEvents 수백 개 × O(N²) re-render).
 * - AGENT_EVENT 무한 누적 → 한 agent run 안에서 수백 이벤트가 들어오면 같은 메시지 객체에
 *   `agentEvents: [...events]` 으로 매번 새 배열 생성 → O(N²) 메모리/렌더 부하.
 *
 * 둘 다 head-trim. 가장 오래된 항목부터 제거. 사용자가 백엔드 hydrate (loadMessages) 호출하면
 * 서버가 최신 N 개만 줘서 자연스레 같은 상한 안으로 들어옴.
 */
const MAX_MESSAGES_PER_SESSION = 500;
const MAX_AGENT_EVENTS_PER_MESSAGE = 600;

const capMessages = (messages: AiMessage[]): AiMessage[] => {
  if (messages.length <= MAX_MESSAGES_PER_SESSION) return messages;
  return messages.slice(messages.length - MAX_MESSAGES_PER_SESSION);
};

export const capAgentEvents = <T>(events: T[]): T[] => {
  if (events.length <= MAX_AGENT_EVENTS_PER_MESSAGE) return events;
  return events.slice(events.length - MAX_AGENT_EVENTS_PER_MESSAGE);
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
  /** 마지막 하네스 빌드 결과 — 빌드 버튼 옆 indicator + valid_errors 드롭다운에서 사용. */
  lastBuildResult: {
    compileStatus: "COMPLETED" | "PARTIAL" | "FAILED" | string | null;
    validErrors: Array<{ path?: string | null; code?: string | null; message?: string | null }>;
    builtAt: string;
    baseModel: string | null;
  } | null;
  /** Agent 진행 카드의 "Trace 보기" 버튼이 한 번 점프하라고 신호. TraceWorkbench 가 effect 로 구독하고 한 번 consume 후 비움. */
  traceJumpToId: string | null;
  /** 채팅 composer 에 stage 된 다중 코드 첨부. send 시 backend content 에 fenced block 으로 join. */
  stagedAttachments: Array<{ path: string; code: string; lineRange?: string }>;
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
  /**
   * 특정 메시지 id 를 patch — useAiChat 의 SSE 콜백이 자신의 assistant 메시지만 갱신하려고 사용.
   * 이전엔 send() 시점 messages snapshot 을 [...baseMessages, updatedAssistant] 로 통째 덮어써서
   * 두 send 가 겹치거나 storage event 로 messages 가 바뀐 사이에 도착한 chunk 가 그 변경을 wipe.
   * id 매칭 안 되면 state 그대로 (사용자가 메시지를 정리/리셋한 사이에 늦은 chunk 도착해도 안전).
   */
  updateMessageById: (id: string, patch: Partial<AiMessage>) => void;
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
  setLastBuildResult: (value: IdeState["lastBuildResult"]) => void;
  setTraceJumpToId: (value: string | null) => void;
  addStagedAttachment: (item: { path: string; code: string; lineRange?: string }) => void;
  removeStagedAttachment: (index: number) => void;
  clearStagedAttachments: () => void;
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
  lastBuildResult: null,
  traceJumpToId: null,
  stagedAttachments: [],
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
      // 코드 선택만 한다고 aiMode 를 자동 변경하지 않는다 — chat 모드에서도 선택 코드를
      // 컨텍스트로 사용할 수 있어야 자연스러움. 모드 전환은 사용자가 직접 토글.
      if (
        state.selectedCode === code &&
        isSameSelectionRange(state.selectedRange, range)
      ) {
        return state;
      }

      return {
        selectedCode: code,
        selectedRange: range
      };
    }),
  setEditInstruction: (value) => set({ editInstruction: value }),
  setSuggestion: (value) => set({ suggestion: value }),
  setAiMode: (value) => set({ aiMode: value }),
  setMessages: (messages) =>
    // 너무 긴 세션에서 messages 배열이 무한히 누적되는 걸 차단. backend 도 페이지네이션 없이
    // 응답해도 IDE 메모리 한도가 먼저 망가지지 않도록 head trim. (대화 맨 처음 메시지부터 잘림)
    set({ messages: capMessages(messages) }),
  appendMessages: (messages) =>
    set((state) => ({
      messages: capMessages([...state.messages, ...messages])
    })),
  updateMessageById: (id, patch) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.id === id);
      if (idx === -1) return state; // 매칭 없음 — 사용자가 리셋한 사이에 늦게 도착한 chunk 등.
      const nextMessages = state.messages.slice();
      nextMessages[idx] = { ...nextMessages[idx], ...patch };
      return { messages: nextMessages };
    }),
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
  setLastBuildResult: (value) => set({ lastBuildResult: value }),
  setTraceJumpToId: (value) => set({ traceJumpToId: value }),
  addStagedAttachment: (item) =>
    set((state) => {
      // 같은 path + lineRange 중복은 무시.
      const dup = state.stagedAttachments.some(
        (a) => a.path === item.path && a.lineRange === item.lineRange
      );
      return dup ? state : { stagedAttachments: [...state.stagedAttachments, item] };
    }),
  removeStagedAttachment: (index) =>
    set((state) => ({
      stagedAttachments: state.stagedAttachments.filter((_, i) => i !== index)
    })),
  clearStagedAttachments: () => set({ stagedAttachments: [] }),
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
      bottomPanelHeight: 220,
      lastBuildResult: null,
      traceJumpToId: null,
      stagedAttachments: []
    })
}));

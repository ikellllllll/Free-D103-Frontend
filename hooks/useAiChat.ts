"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AgentProgressEvent, AiMessage } from "@/lib/types/ai";
import { useIdeStore } from "@/store/ideStore";

export function useAiChat(sessionId: string) {
  const messages = useIdeStore((state) => state.messages);
  const setMessages = useIdeStore((state) => state.setMessages);
  const appendMessages = useIdeStore((state) => state.appendMessages);
  const queryClient = useQueryClient();
  const [streaming, setStreaming] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  // 현재 진행 중인 SSE 요청의 AbortController — 사용자가 "중지" 누르면 abort() 호출.
  const abortControllerRef = useRef<AbortController | null>(null);
  // Agent streaming 중 동작하는 trace 폴링 interval id.
  // unmount 시 cleanup 에서 clearInterval — 페이지 이탈 후에도 invalidate 가 늦게 실행되던 버그 차단.
  const tracePollIntervalRef = useRef<number | null>(null);
  // mock streaming 의 setInterval id — unmount 시 timer 가 끝까지 store/state 갱신하던 leak 차단.
  const mockStreamTimerRef = useRef<number | null>(null);
  // unmount 후 setState 호출 차단용.
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 진행 중인 SSE / interval / mock timer 모두 정리.
      try { abortControllerRef.current?.abort(); } catch { /* noop */ }
      if (tracePollIntervalRef.current != null) {
        window.clearInterval(tracePollIntervalRef.current);
        tracePollIntervalRef.current = null;
      }
      if (mockStreamTimerRef.current != null) {
        window.clearInterval(mockStreamTimerRef.current);
        mockStreamTimerRef.current = null;
      }
    };
  }, []);

  const loadMessages = useCallback(async () => {
    const data = isBackendSessionId(sessionId)
      ? await sessionApi.getChatMessages(sessionId)
      : await mockApi.getChatMessages(sessionId);
    setMessages(data);
    return data;
  }, [sessionId, setMessages]);

  /** agent 이벤트 type 별 prefix — onEvent 에서 받은 frame 을 한 줄씩 메시지에 누적할 때 사용. */
  const AGENT_EVENT_PREFIX: Record<string, string> = {
    RUN_STARTED:           "🚀",
    ASSISTANT_STATUS:      "💬",
    REASONING_SUMMARY:     "🤔",
    TOOL_CALL_STARTED:     "🔧",
    TOOL_CALL_COMPLETED:   "✅",
    TOOL_CALL_FAILED:      "❌",
    LLM_CALL_STARTED:      "⚙️",
    LLM_CALL_COMPLETED:    "⚙️",
    VFS_FILE_READ:         "📖",
    VFS_FILE_WRITTEN:      "📝",
    VFS_FILE_PATCHED:      "✏️",
    VFS_FILE_DELETED:      "🗑️",
    PATCH_PROPOSED:        "🩹",
    PATCH_APPLIED:         "✅",
    HITL_REVIEW_REQUESTED: "⏸️",
    RUN_COMPLETED:         "🎉",
    RUN_FAILED:            "❌"
  };

  const send = useCallback(async (
    question: string,
    currentFile?: string,
    modelName?: string | null,
    attachedCode?: AiMessage["attachedCode"],
    mode: "chat" | "agent" = "chat"
  ) => {
    // UI 표시용 content (question 만), 백엔드 전송용 content (fenced code 포함)
    const backendContent = attachedCode
      ? `${question}\n\n---\n선택한 코드 (${attachedCode.path}${attachedCode.lineRange ? ` ${attachedCode.lineRange}` : ""}):\n\`\`\`\n${attachedCode.code}\n\`\`\``
      : question;

    const optimistic: AiMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: question,           // UI 에는 질문만
      attachedCode,                // 코드는 별도 chip 으로 렌더
      createdAt: new Date().toISOString(),
      // Chat/Agent 토글 필터링 대상 — 현재 모드 기준으로 표시. 백엔드 hydrate 후 실제 값으로 교체된다.
      origin: mode === "agent" ? "AGENT" : "CHAT"
    };

    const baseMessages = [...messages, optimistic];
    setMessages(baseMessages);
    setStreaming(true);

    // unmount 후엔 store 갱신 하지 않도록 guard. agent/chat 스트림 callback 들이 abort
    // 직전 도착한 chunk 로 store 를 오염시키던 케이스 + loadMessages() 가 이탈한 세션의
    // 메시지로 덮어쓰던 케이스 둘 다 차단.
    const safeSetMessages = (next: typeof messages) => {
      if (!mountedRef.current) return;
      setMessages(next);
    };

    // 백엔드 세션이면 SSE streaming 으로 실 AI 응답을 받는다.
    // mock 세션이면 기존 페이크 streaming (28ms per 6 chars) 유지.
    if (isBackendSessionId(sessionId)) {
      const assistantId = `assistant-${Date.now()}`;
      const assistantBase: AiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        origin: mode === "agent" ? "AGENT" : "CHAT"
      };
      appendMessages([assistantBase]);

      let accumulated = "";
      // Agent 진행 로그 — 카드로 묶어서 표시하기 위해 구조화된 배열로 누적.
      const events: AgentProgressEvent[] = [];
      // RUN_STARTED 이벤트에서 추출한 trace ID — 카드의 "Trace 보기" deep link 용.
      let traceId: string | undefined;

      // === Agent 모드 — DeepAgent SSE (RUN_STARTED, TOOL_*, VFS_*, RUN_COMPLETED/FAILED 등). ===
      if (mode === "agent") {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        // Trace 목록 실시간 폴링 — agent_runs_traces 에 row 가 insert 되기까지 시간 차이가 있고,
        // 첫 trace 가 list 에 보이기 전엔 TraceWorkbench 의 useQuery 가 폴링 안 함 (hasActive 가 false).
        // streaming 중 강제로 2.5s 마다 invalidate → trace 가 db 에 들어오자마자 list 반영.
        const tracePollInterval = window.setInterval(() => {
          if (!mountedRef.current) return;
          queryClient.invalidateQueries({ queryKey: ["agentTraces", sessionId] });
        }, 2500);
        tracePollIntervalRef.current = tracePollInterval;
        try {
          await sessionApi.streamAgentChat(
            sessionId,
            { message: backendContent },
            {
              onEvent: (_eventName, data) => {
                const type = typeof data?.type === "string" ? data.type : "";
                const message = typeof data?.message === "string" ? data.message : "";
                const payload = (data?.payload ?? {}) as Record<string, unknown>;
                const prefix = AGENT_EVENT_PREFIX[type] ?? "·";
                // RUN_STARTED 시점에 payload.agent_trace_id 가 들어옴 — 카드에서 Trace 보기 deep link 에 사용.
                if (type === "RUN_STARTED" && payload?.agent_trace_id !== undefined && traceId === undefined) {
                  traceId = String(payload.agent_trace_id);
                }

                // RUN_FAILED 는 payload.error_message 가 더 정확.
                const finalMessage =
                  type === "RUN_FAILED" && typeof payload?.error_message === "string"
                    ? `${message}\n\n> ${payload.error_message}`
                    : message;

                // tool / vfs 이벤트는 payload 안에 path/tool_name 같은 키 추가 노출.
                const extras: string[] = [];
                if (typeof payload?.tool_name === "string") extras.push(`\`${payload.tool_name}\``);
                if (typeof payload?.path === "string") extras.push(`\`${payload.path}\``);
                const detail = extras.length ? extras.join(" ") : undefined;

                if (!finalMessage) return;

                events.push({ prefix, type, message: finalMessage, detail });
                safeSetMessages([
                  ...baseMessages,
                  { ...assistantBase, content: "", agentEvents: [...events], traceId }
                ]);
              },
              onError: (_code, msg) => {
                events.push({ prefix: "❌", type: "ERROR", message: msg });
                safeSetMessages([
                  ...baseMessages,
                  { ...assistantBase, content: "", agentEvents: [...events], traceId }
                ]);
                accumulated = "❌ " + msg;
              }
            },
            controller.signal
          );
          setRequestCount((count) => count + 1);
        } catch (error) {
          // AbortError 는 사용자가 의도적으로 중지한 케이스 — 별도 메시지 표시.
          const isAbort = error instanceof DOMException && error.name === "AbortError";
          const errMsg = isAbort
            ? "사용자가 중지했습니다."
            : error instanceof Error ? error.message : "Agent 실행에 실패했습니다.";
          events.push({ prefix: isAbort ? "⏹️" : "❌", type: isAbort ? "ABORTED" : "EXCEPTION", message: errMsg });
          safeSetMessages([
            ...baseMessages,
            { ...assistantBase, content: "", agentEvents: [...events] }
          ]);
          accumulated = (isAbort ? "⏹️ " : "❌ ") + errMsg;
        } finally {
          window.clearInterval(tracePollInterval);
          tracePollIntervalRef.current = null;
          abortControllerRef.current = null;
          if (mountedRef.current) setStreaming(false);
          // unmount 후엔 invalidate / loadMessages 모두 skip — 이탈한 세션의 메시지로 store 가
          // 덮이거나 다음 진입 직후 race 가 나는 케이스 차단.
          if (mountedRef.current) {
            // Agent 가 worktree 에 새 파일을 만들고 끝났는데 workspace query 가 stale 상태로 남으면
            // 파일 트리에 .worktree (ai) 자식이 안 보임. invalidate 로 강제 refetch 해서 즉시 hydrate.
            // session(트레이스 카운트 갱신용) / agentTraces (Trace 탭) 도 같이 무효화.
            await queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
            await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
            await queryClient.invalidateQueries({ queryKey: ["agentTraces", sessionId] });
            // SSE 누적은 "🚀 작업 시작 / 📖 파일 읽음 / ..." 진행 로그라, 종료 후엔 백엔드가 저장한
            // 최종 assistant 메시지(변경 요약 등) 로 덮어써야 새로고침 없이도 깔끔한 결과를 본다.
            try { await loadMessages(); } catch { /* noop — 다음 진입 시 재시도 */ }
          }
        }
        return;
      }

      // === Chat 모드 (기본) — text-only LLM chunks. ===
      // 이전엔 chat 모드 streamChat 호출에 abort signal 을 안 넘겨서 UI "중지" 버튼이나
      // 페이지 이탈 시 fetch/read loop 가 계속 살아 있었음. agent 모드와 동일하게 controller
      // 등록해서 abort() 호출 가능하게.
      const chatController = new AbortController();
      abortControllerRef.current = chatController;
      try {
        await sessionApi.streamChat(
          sessionId,
          { chat: backendContent, modelName: modelName ?? null },
          {
            onChunk: (content) => {
              accumulated += content;
              safeSetMessages([
                ...baseMessages,
                { ...assistantBase, content: accumulated }
              ]);
            },
            onError: (_code, msg) => {
              accumulated = accumulated
                ? `${accumulated}\n\n[오류] ${msg}`
                : `[오류] ${msg}`;
              safeSetMessages([
                ...baseMessages,
                { ...assistantBase, content: accumulated }
              ]);
            }
          },
          chatController.signal
        );
        setRequestCount((count) => count + 1);
      } catch (error) {
        // AbortError 는 사용자가 의도적으로 중지 or unmount 한 케이스 — 별도 메시지.
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        const errMsg = isAbort
          ? "사용자가 중지했습니다."
          : error instanceof Error ? error.message : "AI 호출에 실패했습니다.";
        safeSetMessages([
          ...baseMessages,
          { ...assistantBase, content: accumulated ? `${accumulated}\n\n[오류] ${errMsg}` : `[오류] ${errMsg}` }
        ]);
      } finally {
        abortControllerRef.current = null;
        if (mountedRef.current) setStreaming(false);
        // unmount 후엔 loadMessages skip — 이탈한 세션 store 오염 차단.
        if (mountedRef.current) {
          // chat 모드도 SSE chunk 가 백엔드 저장본과 미세하게 다를 수 있고, 멀티턴 멤버십을 보장하기 위해
          // 종료 후 백엔드 messages 로 최종 동기화. 실패해도 다음 진입 시 자동 hydrate 되니 silent.
          try { await loadMessages(); } catch { /* noop */ }
        }
      }
      return;
    }

    // === mock 세션 (기존 흐름) ===
    const { assistantMessage, requestCount: nextCount } = await mockApi.requestAiChat(
      sessionId,
      backendContent,
      currentFile
    );
    setRequestCount(nextCount);

    const placeholder: AiMessage = { ...assistantMessage, content: "" };
    appendMessages([placeholder]);

    let cursor = 0;
    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        // unmount 되었거나 외부에서 clear 됐으면 즉시 종료 (store 갱신 leak 차단).
        if (!mountedRef.current) {
          window.clearInterval(timer);
          mockStreamTimerRef.current = null;
          resolve();
          return;
        }
        cursor += 6;
        const nextContent = assistantMessage.content.slice(0, cursor);
        setMessages([...baseMessages, { ...assistantMessage, content: nextContent }]);

        if (cursor >= assistantMessage.content.length) {
          window.clearInterval(timer);
          mockStreamTimerRef.current = null;
          setMessages([...baseMessages, assistantMessage]);
          setStreaming(false);
          resolve();
        }
      }, 28);
      mockStreamTimerRef.current = timer;
    });
  }, [appendMessages, loadMessages, messages, queryClient, sessionId, setMessages]);

  // 현재 진행 중인 SSE 를 사용자가 중지하도록. 진행 카드에 "⏹️ 사용자가 중지했습니다" 가 push 되고
  // streaming 상태도 풀려서 composer 가 다시 활성화됨.
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages,
    streaming,
    requestCount,
    loadMessages,
    send,
    abort
  };
}

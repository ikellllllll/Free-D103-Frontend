"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AgentProgressEvent, AiMessage } from "@/lib/types/ai";
import { capAgentEvents, useIdeStore } from "@/store/ideStore";
import { useApiKeys, type ApiKeyProvider } from "@/hooks/useApiKeys";

export function useAiChat(sessionId: string) {
  const messages = useIdeStore((state) => state.messages);
  const setMessages = useIdeStore((state) => state.setMessages);
  const appendMessages = useIdeStore((state) => state.appendMessages);
  const updateMessageById = useIdeStore((state) => state.updateMessageById);
  const queryClient = useQueryClient();
  const { hasKey } = useApiKeys();
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
  // agent 가 VFS_FILE_WRITTEN/PATCHED/DELETED 이벤트 보낼 때마다 workspace invalidate 를 debounce 로 호출.
  // 매 이벤트마다 즉시 invalidate 하면 한 run 안에 파일 10~20개를 만드는 경우 GET /workspace 가 그만큼
  // 폭주 — 600ms 동안 추가 이벤트 없으면 1회만 호출.
  const workspaceRefreshTimerRef = useRef<number | null>(null);
  // sessionId 별로 buildHarness 보장 호출 했는지 — agent 모드 첫 호출 전 1회만.
  // 백엔드가 startSession 후 비동기로 build 트리거하지만 사용자가 build 완료 전 채팅 보내면
  // "session_harness.runtime_config_json is required" 에러 발생하던 race 차단.
  const harnessBuildEnsuredRef = useRef<Set<string>>(new Set());
  // build promise 추적 — 동일 세션에서 첫 send 가 진행 중일 때 두번째 send 가 동시에 build 시도하는 케이스 차단.
  const harnessBuildInFlightRef = useRef<Map<string, Promise<unknown>>>(new Map());

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
      if (workspaceRefreshTimerRef.current != null) {
        window.clearTimeout(workspaceRefreshTimerRef.current);
        workspaceRefreshTimerRef.current = null;
      }
    };
  }, []);

  // sessionId 변경 시 진행 중인 스트림 abort. 이전엔 useAiChat 의 ref 들이 hook 수명 내내 유지돼
  // sessionId 가 바뀌어도 이전 SSE 가 계속 돌며 새 세션 store 를 오염시킬 수 있었음. abort 누르면
  // streamChat/streamAgentChat 의 fetch 가 AbortError 로 빠져나가 finally cleanup 까지 정상 진행.
  useEffect(() => {
    return () => {
      try { abortControllerRef.current?.abort(); } catch { /* noop */ }
      abortControllerRef.current = null;
      if (tracePollIntervalRef.current != null) {
        window.clearInterval(tracePollIntervalRef.current);
        tracePollIntervalRef.current = null;
      }
      if (mockStreamTimerRef.current != null) {
        window.clearInterval(mockStreamTimerRef.current);
        mockStreamTimerRef.current = null;
      }
      if (workspaceRefreshTimerRef.current != null) {
        window.clearTimeout(workspaceRefreshTimerRef.current);
        workspaceRefreshTimerRef.current = null;
      }
      // harness ensure flag 는 sessionId 별이라 sessionId 변경 시 cleanup 시점에 따로 제거 안 해도
      // 다음 세션은 set 에 없어 다시 호출. 다만 메모리 누수 방지 위해 in-flight 만 제거.
      harnessBuildInFlightRef.current.delete(sessionId);
    };
  }, [sessionId]);

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

    // optimistic + assistant 메시지를 모두 append. 이후 SSE 콜백은 assistantId 로 patch 하므로
    // baseMessages 스냅샷에 의존하지 않는다 (#FE-H3 fix: 두 send 가 겹치거나 storage event 가
    // 사이에 끼어 messages 가 바뀌어도 다른 메시지는 영향 없음).
    appendMessages([optimistic]);
    setStreaming(true);

    // unmount 후엔 store 갱신 안 하도록 guard.
    const safePatchAssistant = (id: string, patch: Partial<AiMessage>) => {
      if (!mountedRef.current) return;
      updateMessageById(id, patch);
    };

    // 백엔드 세션이면 SSE streaming 으로 실 AI 응답을 받는다.
    // mock 세션이면 기존 페이크 streaming (28ms per 6 chars) 유지.
    if (isBackendSessionId(sessionId)) {
      // assistantId: 두 send 가 동시에 진행 중일 때 patch 충돌 안 나도록 고유. Date.now() 만으로는
      // 같은 ms 안에 두 번 호출하면 충돌 가능 — Math.random 일부 섞어 충돌 방지.
      const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        // ⚠️ Race 가드: 백엔드 SessionServiceImpl.scheduleInitialHarnessBuild 가 afterCommit 안에서
        //   비동기로 buildAgentAI 트리거 → startSession 응답 받은 시점엔 build 미완료 가능.
        //   사용자가 build 끝나기 전에 agent 모드 채팅 보내면 AI 서버가
        //   "session_harness.runtime_config_json is required for runtime loading." 으로 reject.
        //
        //   해결: sessionId 별로 첫 agent send 직전에 buildHarness 1회 보장 호출. idempotent —
        //   이미 build 된 세션이면 AI 가 재컴파일만 함. 동시 send 가 일어나면 in-flight promise 공유.
        if (isBackendSessionId(sessionId) && !harnessBuildEnsuredRef.current.has(sessionId)) {
          let inflight = harnessBuildInFlightRef.current.get(sessionId);
          if (!inflight) {
            inflight = sessionApi.buildHarness(sessionId, modelName ?? "GPT_5_MINI").catch((err) => {
              // 실패해도 통과 — 사용자에겐 그 다음 SSE 응답에서 실제 에러로 표시되므로 silent.
              // (재시도는 다음 send 가 set 에 없으니 자동 발생.)
              console.warn("[harness ensure build] failed", err);
              harnessBuildEnsuredRef.current.delete(sessionId);
            });
            harnessBuildInFlightRef.current.set(sessionId, inflight);
          }
          await inflight;
          harnessBuildInFlightRef.current.delete(sessionId);
          harnessBuildEnsuredRef.current.add(sessionId);
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;
        // Trace 목록 실시간 폴링 — agent_runs_traces 에 row 가 insert 되기까지 시간 차이가 있고,
        // 첫 trace 가 list 에 보이기 전엔 TraceWorkbench 의 useQuery 가 폴링 안 함 (hasActive 가 false).
        // streaming 중 강제로 2.5s 마다 invalidate → trace 가 db 에 들어오자마자 list 반영.
        const tracePollInterval = window.setInterval(() => {
          if (!mountedRef.current) return;
          // TraceWorkbench 는 page 까지 포함한 key (["agentTraces", sessionId, page]) 를 쓰고
          // IdeShell/TracePanel 은 page 없는 key 를 쓴다. exact:false 로 prefix match 해서 둘 다
          // 무효화 — 안 그러면 workbench 가 자체 5s 폴링 도달할 때까지 새 trace 안 보이는 차이.
          queryClient.invalidateQueries({ queryKey: ["agentTraces", sessionId], exact: false });
        }, 2500);
        tracePollIntervalRef.current = tracePollInterval;
        // chat 모드와 동일 — 스트림 에러 시 loadMessages skip 해서 patch 한 에러 표시가
        // 백엔드 빈 응답으로 덮이지 않게 한다.
        let agentErrored = false;
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

                // VFS / PATCH 이벤트 — 파일 트리에 즉시 반영하기 위해 workspace 를 debounced invalidate.
                // 이전엔 SSE finally 의 invalidate 1회만 있어서 agent 진행 중 새 파일이 트리에 안 보임 → 사용자가
                // "agent 가 뭘 만들었는지 모름". 600ms 동안 추가 file event 없으면 1회 fetch — 묶음 변경에 효율.
                if (
                  type === "VFS_FILE_WRITTEN" ||
                  type === "VFS_FILE_PATCHED" ||
                  type === "VFS_FILE_DELETED" ||
                  type === "PATCH_APPLIED"
                ) {
                  if (workspaceRefreshTimerRef.current != null) {
                    window.clearTimeout(workspaceRefreshTimerRef.current);
                  }
                  workspaceRefreshTimerRef.current = window.setTimeout(() => {
                    workspaceRefreshTimerRef.current = null;
                    if (!mountedRef.current) return;
                    void queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
                  }, 600);
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
                // capAgentEvents: 한 run 안에서 수백 이벤트가 쌓이는 걸 head-trim.
                const cappedEvents = capAgentEvents(events);
                safePatchAssistant(assistantId, { agentEvents: cappedEvents, traceId });
              },
              onError: (_code, msg) => {
                agentErrored = true;
                events.push({ prefix: "❌", type: "ERROR", message: msg });
                safePatchAssistant(assistantId, { agentEvents: capAgentEvents(events), traceId });
                accumulated = "❌ " + msg;
              }
            },
            controller.signal
          );
          setRequestCount((count) => count + 1);
        } catch (error) {
          agentErrored = true;
          // AbortError 는 사용자가 의도적으로 중지한 케이스 — 별도 메시지 표시.
          const isAbort = error instanceof DOMException && error.name === "AbortError";
          const errMsg = isAbort
            ? "사용자가 중지했습니다."
            : error instanceof Error ? error.message : "Agent 실행에 실패했습니다.";
          events.push({ prefix: isAbort ? "⏹️" : "❌", type: isAbort ? "ABORTED" : "EXCEPTION", message: errMsg });
          safePatchAssistant(assistantId, { agentEvents: capAgentEvents(events) });
          accumulated = (isAbort ? "⏹️ " : "❌ ") + errMsg;
        } finally {
          window.clearInterval(tracePollInterval);
          tracePollIntervalRef.current = null;
          abortControllerRef.current = null;
          // pending workspace refresh 가 있으면 즉시 flush — finally 의 invalidate 가 어차피 1회 호출되므로
          // 별도 timer 는 정리만 하고 invalidate 중복 호출 피한다.
          if (workspaceRefreshTimerRef.current != null) {
            window.clearTimeout(workspaceRefreshTimerRef.current);
            workspaceRefreshTimerRef.current = null;
          }
          if (mountedRef.current) setStreaming(false);
          // unmount / 에러 시 loadMessages skip.
          // - unmount: 이탈한 세션 store 오염 차단.
          // - error: 위에 patch 한 에러 이벤트가 backend stored version 으로 덮이지 않도록.
          //   workspace/session/agentTraces invalidate 는 실패 시에도 유의미 (agent 가 worktree
          //   를 부분적으로 만들었을 수 있음) 이므로 그대로 실행.
          if (mountedRef.current) {
            // Agent 가 worktree 에 새 파일을 만들고 끝났는데 workspace query 가 stale 상태로 남으면
            // 파일 트리에 .worktree (ai) 자식이 안 보임. invalidate 로 강제 refetch 해서 즉시 hydrate.
            await queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
            await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
            // exact:false: TraceWorkbench 의 page 포함 키도 함께 invalidate.
            await queryClient.invalidateQueries({ queryKey: ["agentTraces", sessionId], exact: false });
            if (!agentErrored) {
              // SSE 누적은 "🚀 작업 시작 / 📖 파일 읽음 / ..." 진행 로그라, 정상 종료 시엔 백엔드가
              // 저장한 최종 assistant 메시지(변경 요약 등) 로 덮어써야 새로고침 없이 깔끔한 결과.
              try { await loadMessages(); } catch { /* noop — 다음 진입 시 재시도 */ }
            }
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
      // 스트림 실패 여부 — 실패 시 finally 의 loadMessages 를 skip 해서 방금 patch 한 에러 메시지가
      // 백엔드 GET /messages 응답으로 덮어써지지 않게 한다. (백엔드는 stream 실패 케이스에서 user
      // message / assistant placeholder 를 보통 저장 안 함 → 무조건 loadMessages 하면 사용자
      // 입장에선 "메시지 비워지고 아무 일도 안 일어난 것처럼" 보임.)
      let chatErrored = false;
      try {
        const chatHandlers = {
          onChunk: (content: string) => {
            accumulated += content;
            safePatchAssistant(assistantId, { content: accumulated });
          },
          onError: (_code: string, msg: string) => {
            chatErrored = true;
            accumulated = accumulated
              ? `${accumulated}\n\n[오류] ${msg}`
              : `[오류] ${msg}`;
            safePatchAssistant(assistantId, { content: accumulated });
          }
        };
        const byokProvider: ApiKeyProvider = modelName?.startsWith("GPT_") ? "openai" : "anthropic";
        if (hasKey(byokProvider)) {
          await sessionApi.streamAIChat(
            sessionId,
            { vendor: byokProvider === "openai" ? "OPENAI" : "ANTHROPIC", chat: backendContent, modelName: modelName ?? null },
            chatHandlers,
            chatController.signal
          );
        } else {
          await sessionApi.streamChat(
            sessionId,
            { chat: backendContent, modelName: modelName ?? null },
            chatHandlers,
            chatController.signal
          );
        }
        setRequestCount((count) => count + 1);
      } catch (error) {
        chatErrored = true;
        // AbortError 는 사용자가 의도적으로 중지 or unmount 한 케이스 — 별도 메시지.
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        const errMsg = isAbort
          ? "사용자가 중지했습니다."
          : error instanceof Error ? error.message : "AI 호출에 실패했습니다.";
        safePatchAssistant(assistantId, {
          content: accumulated ? `${accumulated}\n\n[오류] ${errMsg}` : `[오류] ${errMsg}`
        });
      } finally {
        abortControllerRef.current = null;
        if (mountedRef.current) setStreaming(false);
        // unmount 또는 에러 시 loadMessages skip.
        // - unmount: 이탈한 세션 store 오염 차단.
        // - error: 위에 patch 한 [오류] 메시지가 backend stored version (empty) 으로 덮이지 않도록.
        if (mountedRef.current && !chatErrored) {
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
        updateMessageById(assistantMessage.id, { content: nextContent });

        if (cursor >= assistantMessage.content.length) {
          window.clearInterval(timer);
          mockStreamTimerRef.current = null;
          updateMessageById(assistantMessage.id, { content: assistantMessage.content });
          setStreaming(false);
          resolve();
        }
      }, 28);
      mockStreamTimerRef.current = timer;
    });
  }, [appendMessages, hasKey, loadMessages, queryClient, sessionId, updateMessageById]);

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

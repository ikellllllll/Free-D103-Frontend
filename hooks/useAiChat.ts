"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AiMessage } from "@/lib/types/ai";
import { useIdeStore } from "@/store/ideStore";

export function useAiChat(sessionId: string) {
  const messages = useIdeStore((state) => state.messages);
  const setMessages = useIdeStore((state) => state.setMessages);
  const appendMessages = useIdeStore((state) => state.appendMessages);
  const queryClient = useQueryClient();
  const [streaming, setStreaming] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

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
      createdAt: new Date().toISOString()
    };

    const baseMessages = [...messages, optimistic];
    setMessages(baseMessages);
    setStreaming(true);

    // 백엔드 세션이면 SSE streaming 으로 실 AI 응답을 받는다.
    // mock 세션이면 기존 페이크 streaming (28ms per 6 chars) 유지.
    if (isBackendSessionId(sessionId)) {
      const assistantId = `assistant-${Date.now()}`;
      const assistantBase: AiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString()
      };
      appendMessages([assistantBase]);

      let accumulated = "";

      // === Agent 모드 — DeepAgent SSE (RUN_STARTED, TOOL_*, VFS_*, RUN_COMPLETED/FAILED 등). ===
      if (mode === "agent") {
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

                // RUN_FAILED 는 payload.error_message 가 더 정확.
                const errorMessage =
                  type === "RUN_FAILED" && typeof payload?.error_message === "string"
                    ? `${message}\n\n> ${payload.error_message}`
                    : message;

                // tool / vfs 이벤트는 payload 안에 path/tool_name 같은 키 추가 노출.
                const extras: string[] = [];
                if (typeof payload?.tool_name === "string") extras.push(`\`${payload.tool_name}\``);
                if (typeof payload?.path === "string") extras.push(`\`${payload.path}\``);
                const tail = extras.length ? ` — ${extras.join(" ")}` : "";

                const line = `${prefix} ${errorMessage}${tail}`.trim();
                if (!line) return;

                accumulated = accumulated ? `${accumulated}\n\n${line}` : line;
                setMessages([
                  ...baseMessages,
                  { ...assistantBase, content: accumulated }
                ]);
              },
              onError: (_code, msg) => {
                accumulated = accumulated
                  ? `${accumulated}\n\n❌ ${msg}`
                  : `❌ ${msg}`;
                setMessages([
                  ...baseMessages,
                  { ...assistantBase, content: accumulated }
                ]);
              }
            }
          );
          setRequestCount((count) => count + 1);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Agent 실행에 실패했습니다.";
          setMessages([
            ...baseMessages,
            { ...assistantBase, content: accumulated ? `${accumulated}\n\n❌ ${errMsg}` : `❌ ${errMsg}` }
          ]);
        } finally {
          setStreaming(false);
          // Agent 가 worktree 에 새 파일을 만들고 끝났는데 workspace query 가 stale 상태로 남으면
          // 파일 트리에 .worktree (ai) 자식이 안 보임. invalidate 로 강제 refetch 해서 즉시 hydrate.
          // session(트레이스 카운트 갱신용) / agentTraces (Trace 탭) 도 같이 무효화.
          await queryClient.invalidateQueries({ queryKey: ["workspace", sessionId] });
          await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
          await queryClient.invalidateQueries({ queryKey: ["agentTraces", sessionId] });
        }
        return;
      }

      // === Chat 모드 (기본) — text-only LLM chunks. ===
      try {
        await sessionApi.streamChat(
          sessionId,
          { chat: backendContent, modelName: modelName ?? null },
          {
            onChunk: (content) => {
              accumulated += content;
              setMessages([
                ...baseMessages,
                { ...assistantBase, content: accumulated }
              ]);
            },
            onError: (_code, msg) => {
              accumulated = accumulated
                ? `${accumulated}\n\n[오류] ${msg}`
                : `[오류] ${msg}`;
              setMessages([
                ...baseMessages,
                { ...assistantBase, content: accumulated }
              ]);
            }
          }
        );
        setRequestCount((count) => count + 1);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "AI 호출에 실패했습니다.";
        setMessages([
          ...baseMessages,
          { ...assistantBase, content: accumulated ? `${accumulated}\n\n[오류] ${errMsg}` : `[오류] ${errMsg}` }
        ]);
      } finally {
        setStreaming(false);
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
        cursor += 6;
        const nextContent = assistantMessage.content.slice(0, cursor);
        setMessages([...baseMessages, { ...assistantMessage, content: nextContent }]);

        if (cursor >= assistantMessage.content.length) {
          window.clearInterval(timer);
          setMessages([...baseMessages, assistantMessage]);
          setStreaming(false);
          resolve();
        }
      }, 28);
    });
  }, [appendMessages, messages, queryClient, sessionId, setMessages]);

  return {
    messages,
    streaming,
    requestCount,
    loadMessages,
    send
  };
}

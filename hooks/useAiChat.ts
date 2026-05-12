"use client";

import { useCallback, useState } from "react";

import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AiMessage } from "@/lib/types/ai";
import { useIdeStore } from "@/store/ideStore";

export function useAiChat(sessionId: string) {
  const messages = useIdeStore((state) => state.messages);
  const setMessages = useIdeStore((state) => state.setMessages);
  const appendMessages = useIdeStore((state) => state.appendMessages);
  const [streaming, setStreaming] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  const loadMessages = useCallback(async () => {
    const data = isBackendSessionId(sessionId)
      ? await sessionApi.getChatMessages(sessionId)
      : await mockApi.getChatMessages(sessionId);
    setMessages(data);
    return data;
  }, [sessionId, setMessages]);

  const send = useCallback(async (
    question: string,
    currentFile?: string,
    modelName?: string | null,
    attachedCode?: AiMessage["attachedCode"]
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
  }, [appendMessages, messages, sessionId, setMessages]);

  return {
    messages,
    streaming,
    requestCount,
    loadMessages,
    send
  };
}

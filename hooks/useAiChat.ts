"use client";

import { useCallback, useState } from "react";

import { agentRunApi, type AgentRunStreamEvent } from "@/lib/api/agentRunApi";
import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AiMessage } from "@/lib/types/ai";
import { useAuthStore } from "@/store/authStore";
import { useIdeStore } from "@/store/ideStore";

export function useAiChat(sessionId: string) {
  const user = useAuthStore((state) => state.user);
  const messages = useIdeStore((state) => state.messages);
  const setMessages = useIdeStore((state) => state.setMessages);
  const [streaming, setStreaming] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  const loadMessages = useCallback(async () => {
    const data = isBackendSessionId(sessionId)
      ? await sessionApi.getChatMessages(sessionId)
      : await mockApi.getChatMessages(sessionId);
    setMessages(data);
    return data;
  }, [sessionId, setMessages]);

  const streamMockResponse = useCallback(async (
    baseMessages: AiMessage[],
    message: string,
    currentFile?: string
  ) => {
    const { assistantMessage, requestCount: nextCount } = await mockApi.requestAiChat(
      sessionId,
      message,
      currentFile
    );
    setRequestCount(nextCount);

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
  }, [sessionId, setMessages]);

  const send = useCallback(async (message: string, currentFile?: string) => {
    const optimistic: AiMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString()
    };

    const baseMessages = [...messages, optimistic];
    setMessages(baseMessages);
    setStreaming(true);

    const shouldUseAgentRun =
      agentRunApi.isEnabled() &&
      isBackendSessionId(sessionId) &&
      Boolean(user?.id);

    if (!shouldUseAgentRun) {
      await streamMockResponse(baseMessages, message, currentFile);
      return;
    }

    const assistantMessage: AiMessage = {
      id: `agent-run-${Date.now()}`,
      role: "assistant",
      content: "AI 실행을 준비하는 중입니다.",
      createdAt: new Date().toISOString()
    };
    const progressMessages: string[] = [];

    const setAssistantContent = (content: string) => {
      setMessages([...baseMessages, { ...assistantMessage, content }]);
    };

    const handleStreamEvent = (event: AgentRunStreamEvent) => {
      if (event.type === "RUN_COMPLETED") {
        const output = event.payload?.output;
        setAssistantContent(
          typeof output === "string"
            ? output
            : output == null
              ? event.message
              : JSON.stringify(output, null, 2)
        );
        return;
      }

      if (event.type === "RUN_FAILED") {
        const errorMessage = event.payload?.errorMessage;
        setAssistantContent(
          typeof errorMessage === "string" ? errorMessage : event.message
        );
        return;
      }

      progressMessages.push(event.message || event.type);
      setAssistantContent(progressMessages.slice(-6).map((item) => `- ${item}`).join("\n"));
    };

    try {
      await agentRunApi.streamRun({
        sessionId,
        userId: user!.id,
        message,
        onEvent: handleStreamEvent
      });
      setRequestCount((count) => count + 1);
      setStreaming(false);
    } catch {
      setMessages(baseMessages);
      await streamMockResponse(baseMessages, message, currentFile);
    }
  }, [messages, sessionId, setMessages, streamMockResponse, user]);

  return {
    messages,
    streaming,
    requestCount,
    loadMessages,
    send
  };
}

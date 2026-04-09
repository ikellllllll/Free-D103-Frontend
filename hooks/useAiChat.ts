"use client";

import { useState } from "react";

import { mockApi } from "@/lib/api/mockApi";
import type { AiMessage } from "@/lib/types/ai";
import { useIdeStore } from "@/store/ideStore";

export function useAiChat(sessionId: string) {
  const messages = useIdeStore((state) => state.messages);
  const setMessages = useIdeStore((state) => state.setMessages);
  const appendMessages = useIdeStore((state) => state.appendMessages);
  const [streaming, setStreaming] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  const loadMessages = async () => {
    const data = await mockApi.getChatMessages(sessionId);
    setMessages(data);
    return data;
  };

  const send = async (message: string, currentFile?: string) => {
    const optimistic: AiMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString()
    };

    const baseMessages = [...messages, optimistic];
    setMessages(baseMessages);
    setStreaming(true);

    const { assistantMessage, requestCount: nextCount } = await mockApi.requestAiChat(
      sessionId,
      message,
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
  };

  return {
    messages,
    streaming,
    requestCount,
    loadMessages,
    send
  };
}

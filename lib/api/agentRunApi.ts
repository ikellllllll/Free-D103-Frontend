export interface AgentRunStreamEvent {
  type: string;
  message: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
}

interface StreamRunOptions {
  sessionId: string;
  userId: string;
  message: string;
  onEvent: (event: AgentRunStreamEvent) => void;
}

const AGENT_RUN_ENABLED = process.env.NEXT_PUBLIC_AIG_AGENT_RUN_ENABLED === "true";

const parseNdjsonChunk = (
  chunk: string,
  onEvent: (event: AgentRunStreamEvent) => void
) => {
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    onEvent(JSON.parse(trimmed) as AgentRunStreamEvent);
  }
};

export const agentRunApi = {
  isEnabled() {
    return AGENT_RUN_ENABLED;
  },

  async streamRun({ sessionId, userId, message, onEvent }: StreamRunOptions) {
    const res = await fetch(
      `/api/ai-agent/sessions/${encodeURIComponent(sessionId)}/runs/stream`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ userId, message })
      }
    );

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(detail || "AI agent run request failed.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      parseNdjsonChunk(lines.join("\n"), onEvent);
    }

    buffer += decoder.decode();
    parseNdjsonChunk(buffer, onEvent);
  }
};

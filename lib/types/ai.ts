export type TraceType = "AI 요청" | "AI 응답" | "코드 수정" | "실행" | "테스트" | "제출";

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AiEditSuggestion {
  original: string;
  replacement: string;
  summary: string;
}

export interface TraceEvent {
  id: string;
  time: string;
  type: TraceType;
  summary: string;
  detail?: string;
}

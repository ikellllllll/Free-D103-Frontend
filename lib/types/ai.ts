export type TraceType = "AI 요청" | "AI 응답" | "코드 수정" | "실행" | "테스트" | "제출";

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** 어느 모드에서 만들어진 메시지인지 (백엔드 chat_session_messages / agent_session_messages union).
   *  AI Pair 패널이 Chat/Agent 토글에 맞춰 필터링하는 데 사용.
   *  optimistic 메시지(보내자마자 표시) 는 현재 aiMode 에 따라 채워넣고, 백엔드 hydrate 후엔 실제 값으로 교체. */
  origin?: "CHAT" | "AGENT";
  /** user 메시지에 첨부된 코드 스니펫 (에디터 선택 → chat 전송 시).
   *  렌더 시 collapsible chip 으로 표시. 백엔드 전송 content 에는 fenced block 으로 포함됨 (LLM 응답 정확성 위해).
   *  in-memory only — 페이지 새로고침 시 백엔드 history GET 에서는 chip 없이 통째 메시지로 보임. */
  attachedCode?: {
    path: string;
    code: string;
    lineRange?: string;  // "L8-L11" 같은 표시용
  };
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

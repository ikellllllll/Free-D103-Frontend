export type TraceType = "AI 요청" | "AI 응답" | "코드 수정" | "실행" | "테스트" | "제출";

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
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

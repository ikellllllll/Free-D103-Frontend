import type { AiMessage, TraceEvent } from "./ai";

/**
 * 세션 상태. 백엔드 `ProblemSessionStatus` 와 프론트 전용 상태가 섞여있다.
 *  - CREATING: 프론트 startSession 직후 IDE 진입 전 단계 (백엔드는 모르는 값).
 *  - IN_PROGRESS / ENDED / EXPIRED: 백엔드 `ProblemSessionStatus` enum 그대로.
 *  - SUBMITTED: 프론트가 제출 완료를 표시할 때 쓰는 보조 상태 (백엔드의 ENDED 가 보통 매칭).
 */
export type SessionStatus = "CREATING" | "IN_PROGRESS" | "ENDED" | "EXPIRED" | "SUBMITTED";

export interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
}

export type ProblemLanguage = "java" | "python";

export interface SolveSession {
  id: string;
  workspaceId: string;
  problemId: string;
  userId: string;
  language: ProblemLanguage;
  status: SessionStatus;
  aiRequestCount: number;
  lastSavedAt: string;
  createdAt: string;
  readyAt: number;
  files: WorkspaceFile[];
  messages: AiMessage[];
  traces: TraceEvent[];
  aiModel: string;    // "CLAUDE_4_5_SONNET", "GPT_5_2", "aig-default" 등
  aiProvider: string; // "anthropic" | "openai" | "default"
}

export interface RunResult {
  status: "COMPLETED" | "ERROR";
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface TestCaseResult {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  time: string;
  detail?: string;
}

export interface TestRunResult {
  total: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
  /** 빌드/컴파일 실패: 백엔드가 status=COMPLETED 인데 0/0/0 + stderr 가 있으면 컴파일 실패로 분류해서 노출. */
  buildFailed?: boolean;
  /** 빌드/컴파일 stderr — buildFailed 일 때 사용자에게 보여줄 에러 본문. */
  buildStderr?: string | null;
  /**
   * 일반 테스트 실패에서도 노출할 stderr — 일부 케이스만 실패해도 백엔드가 stderr 를 같이 주는 경우가 있어
   * 사용자에게 원인을 보여주기 위함. buildFailed 와 무관하게 stderr 가 있으면 항상 채움.
   */
  stderr?: string | null;
  /** 백엔드 raw status — bottom panel 에서 ERROR 처리에 사용. */
  rawStatus?: string | null;
}

export interface Submission {
  id: string;
  sessionId: string;
  status: "PROCESSING" | "COMPLETED";
  submittedAt: string;
  readyAt: number;
}

/**
 * IDE 안에서 보여줄 제출 채점 결과 스냅샷.
 * - rawStatus 는 백엔드 실제 상태 (RUNNING/COMPLETED/FAILED) 를 그대로 보존.
 * - startedAt / endedAt 은 elapsed 계산용 (백엔드는 진행률을 안 줘서 프론트가 측정).
 * - publicPassed / hiddenPassed 등은 백엔드가 분리 카운트를 줄 때만 채워짐. 합산값은 항상 derive.
 */
export interface SubmissionResult {
  executionId: string;
  rawStatus: "RUNNING" | "COMPLETED" | "FAILED";
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  publicPassed?: number;
  publicTotal?: number;
  hiddenPassed?: number;
  hiddenTotal?: number;
  startedAt: number;
  endedAt: number | null;
  /** 빌드/컴파일 실패 — total=0 + stderr 가 있으면 frontend 측에서 분류. */
  buildFailed?: boolean;
  /** 빌드 stderr — buildFailed 일 때 표시용. 비공개 테스트 보호를 위해 백엔드가 일부만 줄 수도. */
  buildStderr?: string | null;
}

export interface SessionListItem {
  sessionId: string;
  problemId: string;
  problemTitle: string;
  problemLevel: 1 | 2 | 3;
  problemCategory: string;
  difficulty: string;
  language: ProblemLanguage;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  aiRequestCount: number;
  submissionId: string | null;
  passRate: string | null;
  score: number | null;
}

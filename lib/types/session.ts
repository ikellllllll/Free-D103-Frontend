import type { AiMessage, TraceEvent } from "./ai";

export type SessionStatus = "CREATING" | "IN_PROGRESS" | "SUBMITTED";

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
}

export interface Submission {
  id: string;
  sessionId: string;
  status: "PROCESSING" | "COMPLETED";
  submittedAt: string;
  readyAt: number;
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

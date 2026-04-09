import type { AiMessage, TraceEvent } from "./ai";

export type SessionStatus = "CREATING" | "IN_PROGRESS" | "SUBMITTED";

export interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
}

export interface SolveSession {
  id: string;
  workspaceId: string;
  problemId: string;
  userId: string;
  status: SessionStatus;
  aiRequestCount: number;
  lastSavedAt: string;
  createdAt: string;
  readyAt: number;
  files: WorkspaceFile[];
  messages: AiMessage[];
  traces: TraceEvent[];
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

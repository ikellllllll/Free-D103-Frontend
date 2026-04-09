export type AiEditStatus = "idle" | "running" | "done" | "failed";

export interface AiEditState {
  configured: boolean;
  status: AiEditStatus;
  jobId: string | null;
  pid: number | null;
  prompt: string;
  targetPath: string;
  currentStep: string | null;
  thinking: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface AiEditStartInput {
  prompt: string;
  targetPath?: string;
}

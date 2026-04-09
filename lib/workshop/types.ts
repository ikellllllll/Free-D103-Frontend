export type WorkshopVariantId = "a" | "b";
export type WorkshopVariantStatus = "idle" | "queued" | "running" | "ready" | "failed";
export type WorkshopJobStatus = "idle" | "running" | "ready" | "failed" | "promoting";

export interface WorkshopVariantState {
  id: WorkshopVariantId;
  title: string;
  direction: string;
  url: string;
  status: WorkshopVariantStatus;
  summary: string | null;
  error: string | null;
  updatedAt: string | null;
}

export interface WorkshopState {
  configured: boolean;
  status: WorkshopJobStatus;
  currentJobId: string | null;
  currentPid: number | null;
  targetPath: string;
  prompt: string;
  runningStep: string | null;
  heartbeatAt: string | null;
  heartbeatLabel: string | null;
  error: string | null;
  selectedVariant: WorkshopVariantId | null;
  startedAt: string | null;
  updatedAt: string;
  lastPromotionAt: string | null;
  variants: WorkshopVariantState[];
}

export interface WorkshopGenerateInput {
  targetPath: string;
  prompt: string;
}

export interface WorkshopPromoteInput {
  variant: WorkshopVariantId;
}

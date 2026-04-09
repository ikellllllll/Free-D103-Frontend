import type { TraceEvent } from "./ai";

export type ScoreTone = "good" | "mid" | "warn";

export interface ScoreItem {
  label: string;
  score: number;
  tone: ScoreTone;
  note: string;
}

export interface FeedbackReport {
  id: string;
  submissionId: string;
  status: "GENERATING" | "COMPLETED";
  generatedAt: string | null;
  testPassRate: number;
  testSummary: string;
  scores: ScoreItem[];
  strengths: string[];
  improvements: string[];
  summary: string;
  timeline: TraceEvent[];
}

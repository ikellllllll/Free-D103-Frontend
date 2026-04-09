export type ProblemLevel = 1 | 2 | 3;
export type ProblemCategory = "API 구현" | "버그 수정";
export type ProblemStatus = "완료" | "진행 중" | "미시작" | "잠김";

export interface PublicTestCase {
  id: string;
  name: string;
  detail: string;
  result: string;
}

export interface ProblemSummary {
  id: string;
  order: string;
  title: string;
  level: ProblemLevel;
  category: ProblemCategory;
  passRate: number;
  status: ProblemStatus;
  summary: string;
  estimate: string;
}

export interface ProblemDetail extends ProblemSummary {
  description: string;
  requirements: string[];
  endpoints: string[];
  publicCases: PublicTestCase[];
  criteria: string[];
  aiGuide: string;
}

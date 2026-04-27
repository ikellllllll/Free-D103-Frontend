import { authClient } from "@/lib/api/authApi";
import type { ProblemDetail, ProblemLevel, ProblemStatus, ProblemCategory, ProblemSummary } from "@/lib/types/problem";

interface ApiResponse<T> {
  httpStatusCode: number;
  responseMessage: string;
  data: T;
}

interface ProblemListItem {
  problemId: number;
  title: string;
  summary: string;
  difficulty: string;
  passRate: number;
  status: string;
}

interface ProblemDetailResponse {
  problemId: number;
  title?: string;
  summary: string;
  difficulty: string;
  description: string;
  timeLimit: number;
  passRate: number;
  category: string;
  status?: string;
}

function mapLevel(difficulty: string): ProblemLevel {
  if (difficulty === "level1") return 1;
  if (difficulty === "level2") return 2;
  if (difficulty === "level3") return 3;
  return 1;
}

function mapStatus(status: string): ProblemStatus {
  if (status === "IN_PROGRESS") return "진행 중";
  if (status === "SOLVED") return "완료";
  return "미시작";
}

function mapCategory(category: string): ProblemCategory {
  if (category === "BUG") return "버그 수정";
  return "API 구현";
}

function formatEstimate(timeLimitMinutes: number): string {
  if (timeLimitMinutes < 60) return `${timeLimitMinutes}m`;
  const h = timeLimitMinutes / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

function toOrder(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export const problemApi = {
  async getProblems(): Promise<ProblemSummary[]> {
    const res = await authClient.get("api/v1/problems")
      .json<ApiResponse<ProblemListItem[]>>();

    return res.data.map((item, index) => ({
      id: String(item.problemId),
      order: toOrder(index),
      title: item.title,
      summary: item.summary,
      level: mapLevel(item.difficulty),
      category: "API 구현" as ProblemCategory, // 목록 API에 category 없음
      passRate: Math.round(item.passRate),
      status: mapStatus(item.status),
      estimate: "2h" // 목록 API에 timeLimit 없음
    }));
  },

  async getProblemDetail(problemId: string): Promise<ProblemDetail> {
    const res = await authClient.get(`api/v1/problems/${problemId}`)
      .json<ApiResponse<ProblemDetailResponse>>();

    const item = res.data;
    return {
      id: String(item.problemId),
      order: problemId.padStart(2, "0"),
      title: item.title ?? "",
      summary: item.summary,
      level: mapLevel(item.difficulty),
      category: mapCategory(item.category),
      passRate: Math.round(item.passRate),
      status: mapStatus(item.status ?? "NOT_STARTED"),
      estimate: formatEstimate(item.timeLimit),
      description: item.description,
      // 백엔드 미구현 필드 — 추후 API 연동 시 교체
      requirements: [],
      endpoints: [],
      publicCases: [],
      criteria: [],
      aiGuide: ""
    };
  }
};

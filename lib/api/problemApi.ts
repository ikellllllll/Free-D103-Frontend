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
  category?: string;
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

type ProblemListDetail = Pick<ProblemDetailResponse, "problemId" | "category" | "timeLimit">;

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

function inferCategoryFromTitle(title: string): ProblemCategory {
  const normalized = title.trim();
  if (normalized.endsWith("버그 수정")) return "버그 수정";
  return "API 구현";
}

function toApiCategory(category: ProblemCategory | "ALL" | undefined): "API" | "BUG" | undefined {
  if (!category || category === "ALL") return undefined;
  return category === "버그 수정" ? "BUG" : "API";
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
  async getProblems(filters?: { category?: ProblemCategory | "ALL" }): Promise<ProblemSummary[]> {
    const apiCategory = toApiCategory(filters?.category);
    const res = await authClient.get("api/v1/problems", {
      searchParams: apiCategory ? { category: apiCategory } : undefined
    })
      .json<ApiResponse<ProblemListItem[]>>();

    const detailsById = new Map<number, ProblemListDetail>();
    const detailResults = await Promise.allSettled(
      res.data.map((item) =>
        authClient.get(`api/v1/problems/${item.problemId}`)
          .json<ApiResponse<ProblemDetailResponse>>()
      )
    );

    detailResults.forEach((result) => {
      if (result.status !== "fulfilled") return;
      const detail = result.value.data;
      detailsById.set(detail.problemId, {
        problemId: detail.problemId,
        category: detail.category,
        timeLimit: detail.timeLimit
      });
    });

    return res.data.map((item, index) => {
      const detail = detailsById.get(item.problemId);

      return {
        id: String(item.problemId),
        order: toOrder(index),
        title: item.title,
        summary: item.summary,
        level: mapLevel(item.difficulty),
        category: detail
          ? mapCategory(detail.category)
          : item.category
            ? mapCategory(item.category)
            : apiCategory
              ? mapCategory(apiCategory)
              : inferCategoryFromTitle(item.title),
        passRate: Math.round(item.passRate),
        status: mapStatus(item.status),
        estimate: detail ? formatEstimate(detail.timeLimit) : "2h"
      };
    });
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
      // 백엔드 미구현 필드 - 추후 API 연동 시 교체
      requirements: [],
      endpoints: [],
      publicCases: [],
      criteria: [],
      aiGuide: ""
    };
  }
};

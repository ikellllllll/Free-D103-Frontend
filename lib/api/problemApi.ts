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

interface AnnotatedProblemListItem {
  item: ProblemListItem;
  category?: "API" | "BUG" | string;
}

function mapLevel(difficulty: string): ProblemLevel {
  if (difficulty === "level1") return 1;
  if (difficulty === "level2") return 2;
  if (difficulty === "level3") return 3;
  return 1;
}

function mapStatus(status: string): ProblemStatus {
  // 백엔드 IN_PROGRESS = "한 번이라도 시도 (ATTEMPTED 의미)" → ENDED/EXPIRED 세션도 IN_PROGRESS 로 전송됨.
  // frontend 라벨은 "시도한 문제" — 마이페이지 "이어가기" (실제 IN_PROGRESS 세션 카운트) 와 의미 구분.
  if (status === "IN_PROGRESS") return "시도한 문제";
  if (status === "SOLVED") return "풀이한 문제";
  return "미시작";
}

function mapCategory(category: string): ProblemCategory {
  if (category === "BUG") return "버그 수정";
  return "API 구현";
}

function inferCategoryFromTitle(title: string, summary = ""): ProblemCategory {
  const normalized = `${title} ${summary}`.trim().toLowerCase();
  if (normalized.includes("버그") || normalized.includes("bug")) return "버그 수정";
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

function estimateFromLevel(level: ProblemLevel): string {
  if (level === 1) return "1h";
  if (level === 2) return "2h";
  return "3h";
}

function toOrder(index: number): string {
  return String(index + 1).padStart(2, "0");
}

async function fetchProblemList(apiCategory?: "API" | "BUG"): Promise<AnnotatedProblemListItem[]> {
  const res = await authClient.get("api/v1/problems", {
    searchParams: apiCategory ? { category: apiCategory } : undefined
  })
    .json<ApiResponse<ProblemListItem[]>>();

  return res.data.map((item) => ({
    item,
    category: apiCategory ?? item.category
  }));
}

export const problemApi = {
  async getProblems(filters?: { category?: ProblemCategory | "ALL" }): Promise<ProblemSummary[]> {
    const apiCategory = toApiCategory(filters?.category);
    const annotatedItems = apiCategory
      ? await fetchProblemList(apiCategory)
      : (await Promise.all([fetchProblemList("API"), fetchProblemList("BUG")]))
        .flat()
        .sort((a, b) => a.item.problemId - b.item.problemId);

    const uniqueItems = Array.from(
      annotatedItems
        .reduce((acc, annotated) => acc.set(annotated.item.problemId, annotated), new Map<number, AnnotatedProblemListItem>())
        .values()
    );

    return uniqueItems.map(({ item, category }, index) => {
      const level = mapLevel(item.difficulty);

      return {
        id: String(item.problemId),
        order: toOrder(index),
        title: item.title,
        summary: item.summary,
        level,
        category: category
          ? mapCategory(category)
          : item.category
            ? mapCategory(item.category)
            : apiCategory
              ? mapCategory(apiCategory)
              : inferCategoryFromTitle(item.title, item.summary),
        passRate: Math.round(item.passRate),
        status: mapStatus(item.status),
        estimate: estimateFromLevel(level)
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

import { authClient } from "@/lib/api/authApi";
import { mockApi } from "@/lib/api/mockApi";
import type { FeedbackReport, ScoreItem, ScoreTone } from "@/lib/types/report";
import type { TraceEvent } from "@/lib/types/ai";

interface ApiResponse<T> {
  httpStatusCode: number;
  responseMessage: string;
  data: T;
}

interface BackendFeedbackReportResponse {
  report: {
    feedbackReportId: number;
    reportTitle?: string | null;
    sessionHarnessVersionId?: number | null;
    problemSessionId?: number | null;
    agentTraceId?: number | null;
    overallScore?: number | string | null;
    scoreGrade?: string | null;
    diagnosisLevel?: string | null;
    harnessQualityScore?: number | string | null;
    executionQualityScore?: number | string | null;
    traceUtilizationScore?: number | string | null;
    summary?: string | null;
    createdAt?: string | null;
  };
  evaluationBasis?: {
    problemTitle?: string | null;
    harnessVersionNo?: number | null;
    runStatus?: string | null;
    executionStatus?: string | null;
    usedHarnessFiles?: string[] | null;
    usedRunTrace?: {
      traceId?: number | null;
      spanCount?: number | null;
      toolCallCount?: number | null;
      llmCallCount?: number | null;
      patchCount?: number | null;
    } | null;
    usedExecutionResults?: Array<{
      totalTestCount?: number | null;
      passedTestCount?: number | null;
      passRate?: number | null;
      buildSucceeded?: boolean | null;
    }> | null;
    usedFileChangeReviews?: {
      changeRequestCount?: number | null;
      approvedCount?: number | null;
      rejectedCount?: number | null;
      appliedCount?: number | null;
    } | null;
  } | null;
  dimensionScores?: Array<{
    feedbackDimensionScoreId: number;
    evalTarget?: Record<string, unknown> | null;
    score?: number | string | null;
    maxScore?: number | string | null;
    rationale?: string | null;
    metric?: Record<string, unknown> | null;
    strengthSummary?: string | null;
    improvementSummary?: string | null;
    recommendedActions?: string[] | null;
  }> | null;
  findings?: Array<{
    feedbackFindingId: number;
    category: "STRENGTH" | "IMPROVEMENT" | string;
    severity: number;
    title: string;
    description?: string | null;
    recommendation?: string | null;
  }> | null;
  actionGuides?: Array<{
    priority: number;
    title: string;
    description?: string | null;
    expectedImpact?: string | null;
  }> | null;
}

export const isBackendFeedbackReportId = (id: string) => /^\d+$/.test(id);

const toNumber = (value: number | string | null | undefined, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const clampScore = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

const scoreTone = (score: number): ScoreTone => {
  if (score >= 80) return "good";
  if (score >= 60) return "mid";
  return "warn";
};

const scaleScore = (score: number, maxScore = 100): number => {
  if (maxScore <= 0) return clampScore(score);
  if (maxScore === 100) return clampScore(score);
  return clampScore((score / maxScore) * 100);
};

const textFromTarget = (value?: Record<string, unknown> | null): string | null => {
  if (!value) return null;
  const candidates = ["label", "name", "dimension", "category", "type", "target"];
  for (const key of candidates) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
};

const metricScore = (label: string, scoreValue: number | string | null | undefined, note: string): ScoreItem => {
  const score = clampScore(toNumber(scoreValue));
  return {
    label,
    score,
    tone: scoreTone(score),
    note
  };
};

const formatFinding = (finding: NonNullable<BackendFeedbackReportResponse["findings"]>[number]) => {
  const description = finding.description?.trim();
  const recommendation = finding.recommendation?.trim();
  if (description && recommendation) return `${finding.title} - ${description} ${recommendation}`;
  if (description) return `${finding.title} - ${description}`;
  if (recommendation) return `${finding.title} - ${recommendation}`;
  return finding.title;
};

const latestExecution = (payload: BackendFeedbackReportResponse) => {
  const results = payload.evaluationBasis?.usedExecutionResults ?? [];
  return results.at(-1) ?? null;
};

const passRatePercent = (rate: number | null | undefined): number => {
  const value = toNumber(rate);
  if (value <= 1) return clampScore(value * 100);
  return clampScore(value);
};

const toTimeline = (payload: BackendFeedbackReportResponse): TraceEvent[] => {
  const basis = payload.evaluationBasis;
  const trace = basis?.usedRunTrace;
  const execution = latestExecution(payload);
  const createdAt = payload.report.createdAt ? new Date(payload.report.createdAt) : new Date();
  const time = createdAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const rows: TraceEvent[] = [];

  if (basis?.harnessVersionNo) {
    rows.push({
      id: "harness",
      time,
      type: "코드 수정",
      summary: `하네스 v${basis.harnessVersionNo} 기준 평가`,
      detail: basis.executionStatus ? `컴파일 상태: ${basis.executionStatus}` : undefined
    });
  }

  if (execution) {
    rows.push({
      id: "execution",
      time,
      type: "테스트",
      summary: `${execution.passedTestCount ?? 0}/${execution.totalTestCount ?? 0} 테스트 통과`,
      detail: execution.buildSucceeded === false ? "빌드 실패 포함" : `${passRatePercent(execution.passRate)}% 통과`
    });
  }

  if (trace) {
    rows.push({
      id: "trace",
      time,
      type: "AI 응답",
      summary: `Trace ${trace.traceId ?? "-"} 분석`,
      detail: `span ${trace.spanCount ?? 0}, tool ${trace.toolCallCount ?? 0}, LLM ${trace.llmCallCount ?? 0}, patch ${trace.patchCount ?? 0}`
    });
  }

  return rows;
};

function toFeedbackReport(payload: BackendFeedbackReportResponse): FeedbackReport {
  const execution = latestExecution(payload);
  const dimensionScores = payload.dimensionScores ?? [];
  const findings = payload.findings ?? [];
  const actionGuides = payload.actionGuides ?? [];
  const scores = [
    metricScore("하네스 품질", payload.report.harnessQualityScore, "테스트 하네스 구성과 검증 가능성을 평가했습니다."),
    metricScore("실행 품질", payload.report.executionQualityScore, "빌드와 테스트 실행 결과를 종합했습니다."),
    metricScore("Trace 활용", payload.report.traceUtilizationScore, "AI 실행 Trace와 변경 흐름을 평가했습니다.")
  ];

  const extraScores = dimensionScores
    .map((item, index): ScoreItem | null => {
      const label = textFromTarget(item.evalTarget) ?? textFromTarget(item.metric) ?? `평가 항목 ${index + 1}`;
      const score = scaleScore(toNumber(item.score), toNumber(item.maxScore, 100));
      if (!Number.isFinite(score)) return null;
      return {
        label,
        score,
        tone: scoreTone(score),
        note: item.rationale?.trim() || "세부 평가 항목입니다."
      };
    })
    .filter((item): item is ScoreItem => item !== null);

  const strengths = findings
    .filter((finding) => finding.category === "STRENGTH")
    .map(formatFinding);

  const improvements = [
    ...findings
      .filter((finding) => finding.category !== "STRENGTH")
      .sort((a, b) => b.severity - a.severity)
      .map(formatFinding),
    ...dimensionScores.flatMap((item) => [
      ...(item.improvementSummary ? [item.improvementSummary] : []),
      ...(item.recommendedActions ?? [])
    ]),
    ...actionGuides.map((guide) =>
      guide.description?.trim()
        ? `${guide.title} - ${guide.description}`
        : guide.title
    )
  ];

  const total = execution?.totalTestCount ?? 0;
  const passed = execution?.passedTestCount ?? 0;
  const testPassRate = passRatePercent(execution?.passRate);

  return {
    id: String(payload.report.feedbackReportId),
    feedbackReportId: String(payload.report.feedbackReportId),
    submissionId: String(payload.report.feedbackReportId),
    problemSessionId: payload.report.problemSessionId == null ? undefined : String(payload.report.problemSessionId),
    agentTraceId: payload.report.agentTraceId == null ? undefined : String(payload.report.agentTraceId),
    problemTitle: payload.evaluationBasis?.problemTitle ?? undefined,
    status: "COMPLETED",
    generatedAt: payload.report.createdAt ?? null,
    testPassRate,
    testSummary: total > 0 ? `${passed}/${total} 통과` : "실행 결과 없음",
    scores: [...scores, ...extraScores],
    strengths: strengths.length > 0 ? strengths : ["평가 리포트가 정상 생성되었습니다."],
    improvements: improvements.length > 0 ? improvements : ["추가 개선 포인트가 없습니다."],
    summary: payload.report.summary?.trim() || "하네스, 실행 결과, Trace를 종합해 생성된 피드백입니다.",
    timeline: toTimeline(payload)
  };
}

export const feedbackApi = {
  async getFeedbackReport(feedbackReportId: string): Promise<FeedbackReport> {
    if (!isBackendFeedbackReportId(feedbackReportId)) {
      return mockApi.getReport(feedbackReportId);
    }

    const res = await authClient
      .get(`api/v1/feedback/${feedbackReportId}`)
      .json<ApiResponse<BackendFeedbackReportResponse>>();

    return toFeedbackReport(res.data);
  }
};

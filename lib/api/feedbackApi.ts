import { authClient } from "@/lib/api/authApi";
import { mockApi } from "@/lib/api/mockApi";
import type {
  ActionGuideItem,
  DimensionCriterion,
  DimensionScoreItem,
  EvaluationBasis,
  FeedbackReport,
  FindingCategory,
  FindingItem,
  ScoreItem,
  ScoreTone
} from "@/lib/types/report";
import type { TraceEvent } from "@/lib/types/ai";

interface ApiResponse<T> {
  httpStatusCode: number;
  responseMessage: string;
  data: T;
}

/** 백엔드 FeedbackReportResponse (2026-05-12~ feedback_report 5축 점수 컬럼 직접 노출). */
interface BackendFeedbackReportResponse {
  report: {
    feedbackReportId: number;
    reportTitle?: string | null;
    problemSessionId?: number | null;
    agentTraceId?: number | null;
    overallScore?: number | string | null;
    scoreGrade?: string | null;
    diagnosisLevel?: string | null;
    /** 5축 점수 — 0~100 정수 (백엔드 NOT NULL DEFAULT 0) */
    harnessGoalClarityScore?: number | null;
    harnessWorkflowDesignScore?: number | null;
    harnessContextQualityScore?: number | null;
    harnessSkillModularityScore?: number | null;
    harnessVerificationLoopScore?: number | null;
    summary?: string | null;
    createdAt?: string | null;
  };
  evaluationBasis?: {
    problemTitle?: string | null;
    runStatus?: string | null;
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
    category: FindingCategory | string;
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

/** 점수 → 등급 ("A+" / "A" / "B+" / "B" / "C+" / "C" / "D" / "F"). 백엔드가 scoreGrade 안 줄 때만 사용. */
const deriveScoreGrade = (score: number): string => {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 75) return "B";
  if (score >= 65) return "C+";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
};

/** 점수 → 진단. 백엔드 diagnosisLevel 없을 때 폴백. */
const deriveDiagnosisLevel = (score: number): string => {
  if (score >= 80) return "우수";
  if (score >= 60) return "양호";
  if (score >= 40) return "보완 필요";
  return "심각";
};

const passRatePercent = (rate: number | null | undefined): number => {
  const value = toNumber(rate);
  if (value <= 1) return clampScore(value * 100);
  return clampScore(value);
};

const latestExecution = (payload: BackendFeedbackReportResponse) => {
  const results = payload.evaluationBasis?.usedExecutionResults ?? [];
  return results.at(-1) ?? null;
};

/** 5축 메트릭 정의 — code → 한글 라벨 + 한 줄 보조 설명 (rationale 없을 때 폴백). */
const DIMENSION_AXES: Array<{
  code: string;
  label: string;
  /** 백엔드 응답 키 — report 객체에서 점수 추출 */
  reportKey: keyof BackendFeedbackReportResponse["report"];
  fallbackNote: string;
}> = [
  { code: "HARNESS_GOAL_CLARITY",      label: "목표 명확도",      reportKey: "harnessGoalClarityScore",      fallbackNote: "에이전트에게 전달된 목표·제약·완료 조건의 명확도" },
  { code: "HARNESS_WORKFLOW_DESIGN",   label: "작업 흐름 설계도", reportKey: "harnessWorkflowDesignScore",   fallbackNote: "단계 구성, 분기·복귀, 도구 호출 순서의 설계 품질" },
  { code: "HARNESS_CONTEXT_QUALITY",   label: "정보 제공 적절도", reportKey: "harnessContextQualityScore",   fallbackNote: "컨텍스트·예시·참조 자료가 시점에 맞게 전달되었는지" },
  { code: "HARNESS_SKILL_MODULARITY",  label: "스킬 구성도",      reportKey: "harnessSkillModularityScore",  fallbackNote: "스킬·서브에이전트의 책임 분리와 재사용성" },
  { code: "HARNESS_VERIFICATION_LOOP", label: "검증 루프 설계도", reportKey: "harnessVerificationLoopScore", fallbackNote: "테스트·재실행·자체 검증 루프의 견고함" }
];

/** dimensionScores 응답의 evalTarget Map 안에서 code 식별자를 추출. */
const extractDimensionCode = (evalTarget?: Record<string, unknown> | null): string | null => {
  if (!evalTarget) return null;
  const candidates = ["id", "code", "axis", "target", "evalTarget"];
  for (const key of candidates) {
    const candidate = evalTarget[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().toUpperCase();
  }
  return null;
};

/** 백엔드가 다른 이름으로 보낼 수 있는 코드 alias 매핑. */
const CODE_ALIASES: Record<string, string> = {
  HARNESS_GOAL_CONTRACT: "HARNESS_GOAL_CLARITY",
  HARNESS_VERIFICATION_LOOP_DESIGN: "HARNESS_VERIFICATION_LOOP"
};

/** metric.criteria 배열을 DimensionCriterion[] 으로 변환. */
const parseCriteria = (metric: Record<string, unknown> | null | undefined): DimensionCriterion[] => {
  if (!metric) return [];
  const raw = metric["criteria"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      name: String(c.name ?? ""),
      score: toNumber(c.score as number | string | null),
      finding: typeof c.finding === "string" ? c.finding.trim() || undefined : undefined,
      evidence: typeof c.evidence === "string" ? c.evidence.trim() || undefined : undefined,
      suggestion: typeof c.suggestion === "string" ? c.suggestion.trim() || undefined : undefined,
      evidenceFile: typeof c.evidence_file === "string" ? c.evidence_file.trim() || undefined : undefined
    }))
    .filter((c) => c.name);
};

const toDimensions = (payload: BackendFeedbackReportResponse): DimensionScoreItem[] => {
  // dimensionScores 배열의 항목들을 code 기준으로 인덱싱 (alias 처리 포함).
  const dimensionByCode = new Map<string, NonNullable<BackendFeedbackReportResponse["dimensionScores"]>[number]>();
  for (const item of payload.dimensionScores ?? []) {
    const rawCode = extractDimensionCode(item.evalTarget);
    if (!rawCode) continue;
    const code = CODE_ALIASES[rawCode] ?? rawCode;
    dimensionByCode.set(code, item);
  }

  // 5축 고정 순서로 출력.
  //
  // 점수 source 우선순위 (백엔드 실제 응답을 본 결과):
  //  1. dimensionScores[].score (0~maxScore) — 항상 들어와 있는 가장 신뢰 가능한 source.
  //     백엔드 응답 예시: { evalTarget: { id: "HARNESS_GOAL_CONTRACT" }, score: 100, maxScore: 100 }.
  //  2. payload.report.harnessXxxScore — 백엔드 record 에 컬럼은 있지만 GET /feedback/{id} 응답 DTO
  //     에 빠져 있는 경우가 있어 폴백.
  //
  // 이전 버그: source 1을 detail 로만 쓰고 점수 본체로 안 써서 응답에서 report 컬럼이 빠지면 전부 0 으로
  // 떨어지던 케이스가 있었음 (feedback_report 1번 → 모든 축 0 표시).
  return DIMENSION_AXES.map((axis): DimensionScoreItem => {
    const detail = dimensionByCode.get(axis.code);

    // dimensionScores 의 score 는 maxScore 기준이라 100점 만점으로 normalize.
    let detailScore: number | null = null;
    if (detail) {
      const raw = toNumber(detail.score, NaN);
      const max = toNumber(detail.maxScore, 100);
      if (Number.isFinite(raw)) {
        detailScore = max > 0 && max !== 100 ? (raw / max) * 100 : raw;
      }
    }

    const reportRaw = payload.report[axis.reportKey];
    const reportScore = toNumber(reportRaw, NaN);

    const chosen = detailScore != null
      ? detailScore
      : Number.isFinite(reportScore) ? reportScore : 0;
    const score = clampScore(chosen);

    return {
      code: axis.code,
      label: axis.label,
      score,
      tone: scoreTone(score),
      rationale: detail?.rationale?.trim() || axis.fallbackNote,
      strengthSummary: detail?.strengthSummary?.trim() || undefined,
      improvementSummary: detail?.improvementSummary?.trim() || undefined,
      recommendedActions: (detail?.recommendedActions ?? []).filter((a) => a?.trim()).map((a) => a.trim()),
      criteria: parseCriteria(detail?.metric)
    };
  });
};

const toFindings = (payload: BackendFeedbackReportResponse): FindingItem[] =>
  (payload.findings ?? []).map((finding) => ({
    id: String(finding.feedbackFindingId),
    category: (finding.category === "STRENGTH" ? "STRENGTH" : "IMPROVEMENT") as FindingCategory,
    severity: finding.severity,
    title: finding.title,
    description: finding.description?.trim() || undefined,
    recommendation: finding.recommendation?.trim() || undefined
  }));

const toActionGuides = (payload: BackendFeedbackReportResponse): ActionGuideItem[] =>
  (payload.actionGuides ?? [])
    .map((guide) => ({
      priority: guide.priority,
      title: guide.title,
      description: guide.description?.trim() || undefined,
      expectedImpact: guide.expectedImpact?.trim() || undefined
    }))
    .sort((a, b) => a.priority - b.priority);

const toBasis = (payload: BackendFeedbackReportResponse): EvaluationBasis | undefined => {
  const b = payload.evaluationBasis;
  if (!b) return undefined;
  return {
    problemTitle: b.problemTitle ?? undefined,
    runStatus: b.runStatus ?? undefined,
    usedHarnessFiles: b.usedHarnessFiles ?? undefined,
    usedRunTrace: b.usedRunTrace
      ? {
          traceId: b.usedRunTrace.traceId ?? undefined,
          spanCount: b.usedRunTrace.spanCount ?? undefined,
          toolCallCount: b.usedRunTrace.toolCallCount ?? undefined,
          llmCallCount: b.usedRunTrace.llmCallCount ?? undefined,
          patchCount: b.usedRunTrace.patchCount ?? undefined
        }
      : undefined,
    usedExecutionResults: (b.usedExecutionResults ?? []).map((r) => ({
      totalTestCount: r.totalTestCount ?? undefined,
      passedTestCount: r.passedTestCount ?? undefined,
      passRate: r.passRate ?? undefined,
      buildSucceeded: r.buildSucceeded ?? undefined
    })),
    usedFileChangeReviews: b.usedFileChangeReviews
      ? {
          changeRequestCount: b.usedFileChangeReviews.changeRequestCount ?? undefined,
          approvedCount: b.usedFileChangeReviews.approvedCount ?? undefined,
          rejectedCount: b.usedFileChangeReviews.rejectedCount ?? undefined,
          appliedCount: b.usedFileChangeReviews.appliedCount ?? undefined
        }
      : undefined
  };
};

const toTimeline = (payload: BackendFeedbackReportResponse): TraceEvent[] => {
  const basis = payload.evaluationBasis;
  const trace = basis?.usedRunTrace;
  const execution = latestExecution(payload);
  const createdAt = payload.report.createdAt ? new Date(payload.report.createdAt) : new Date();
  const time = createdAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const rows: TraceEvent[] = [];

  if (basis?.usedHarnessFiles && basis.usedHarnessFiles.length > 0) {
    rows.push({
      id: "harness",
      time,
      type: "코드 수정",
      summary: `하네스 파일 ${basis.usedHarnessFiles.length}개 기반 평가`,
      detail: basis.usedHarnessFiles.slice(0, 3).join(", ") + (basis.usedHarnessFiles.length > 3 ? " 외" : "")
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
  const dimensions = toDimensions(payload);
  const findings = toFindings(payload);
  const actionGuides = toActionGuides(payload);
  const basis = toBasis(payload);

  // 종합 점수 — 백엔드가 주면 그대로, 없으면 5축 평균.
  const overallScoreRaw = toNumber(payload.report.overallScore, NaN);
  const overallScore = Number.isFinite(overallScoreRaw) && overallScoreRaw > 0
    ? clampScore(overallScoreRaw)
    : clampScore(dimensions.reduce((sum, d) => sum + d.score, 0) / Math.max(dimensions.length, 1));

  const scoreGrade = payload.report.scoreGrade?.trim() || deriveScoreGrade(overallScore);
  const diagnosisLevel = payload.report.diagnosisLevel?.trim() || deriveDiagnosisLevel(overallScore);

  // legacy scores 배열 — 기존 화면에서 grid로 보여주던 score bar 들. 5축으로 옮겨감.
  const legacyScores: ScoreItem[] = dimensions.map((d) => ({
    label: d.label,
    score: d.score,
    tone: d.tone,
    note: d.rationale ?? ""
  }));

  const total = execution?.totalTestCount ?? 0;
  const passed = execution?.passedTestCount ?? 0;
  const testPassRate = passRatePercent(execution?.passRate);

  // legacy strengths/improvements — findings 에서 derive. 새 화면은 findings 원본을 직접 쓰지만 하위 호환용.
  const strengths = findings
    .filter((f) => f.category === "STRENGTH")
    .map((f) => f.description ? `${f.title} — ${f.description}` : f.title);
  const improvements = findings
    .filter((f) => f.category !== "STRENGTH")
    .sort((a, b) => b.severity - a.severity)
    .map((f) => f.description ? `${f.title} — ${f.description}` : f.title);

  return {
    id: String(payload.report.feedbackReportId),
    feedbackReportId: String(payload.report.feedbackReportId),
    submissionId: String(payload.report.feedbackReportId),
    problemSessionId: payload.report.problemSessionId == null ? undefined : String(payload.report.problemSessionId),
    agentTraceId: payload.report.agentTraceId == null ? undefined : String(payload.report.agentTraceId),
    problemTitle: payload.evaluationBasis?.problemTitle ?? payload.report.reportTitle ?? undefined,
    status: "COMPLETED",
    generatedAt: payload.report.createdAt ?? null,
    overallScore,
    scoreGrade,
    diagnosisLevel,
    testPassRate,
    testSummary: total > 0 ? `${passed}/${total} 통과` : "실행 결과 없음",
    buildSucceeded: execution?.buildSucceeded ?? undefined,
    dimensions,
    scores: legacyScores,
    findings,
    actionGuides,
    basis,
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

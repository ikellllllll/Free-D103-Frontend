import type { TraceEvent } from "./ai";

export type ScoreTone = "good" | "mid" | "warn";

export interface ScoreItem {
  label: string;
  score: number;
  tone: ScoreTone;
  note: string;
}

/** 세부 평가 기준 항목 (metric.criteria 배열 원소). score 는 0~1 정규화. */
export interface DimensionCriterion {
  name: string;
  score: number;
  finding?: string;
  evidence?: string;
  suggestion?: string;
  evidenceFile?: string;
}

/** 5축 평가 (HARNESS_GOAL_CLARITY / WORKFLOW_DESIGN / CONTEXT_QUALITY / SKILL_MODULARITY / VERIFICATION_LOOP).
 *  백엔드 feedback_report.harness_*_score 직매핑. */
export interface DimensionScoreItem {
  /** 백엔드 code (HARNESS_GOAL_CLARITY 등) — 안정적인 식별자 */
  code: string;
  /** 화면 라벨 (예: "목표 명확도") */
  label: string;
  /** 0~100 */
  score: number;
  tone: ScoreTone;
  /** 이 축에 대한 한 단락 설명 (rationale) */
  rationale?: string;
  /** 잘한 점 요약 */
  strengthSummary?: string;
  /** 부족한 점 요약 */
  improvementSummary?: string;
  /** 구체 추천 행동 */
  recommendedActions?: string[];
  /** 세부 평가 기준 목록 */
  criteria?: DimensionCriterion[];
}

export type FindingCategory = "STRENGTH" | "IMPROVEMENT";

/** feedback_finding row 1개. severity 0~3 정도 정수. */
export interface FindingItem {
  id: string;
  category: FindingCategory;
  severity: number;
  title: string;
  description?: string;
  recommendation?: string;
}

/** feedback action_guide row 1개. priority 낮을수록 우선순위 높음. */
export interface ActionGuideItem {
  priority: number;
  title: string;
  description?: string;
  expectedImpact?: string;
}

/** 평가에 사용된 자료 요약 — 평가 근거를 사용자에게 노출.
 *
 * 백엔드 응답 키 변경 이력:
 *  - 이전: problemTitle / runStatus / usedHarnessFiles / usedRunTrace / usedExecutionResults / usedFileChangeReviews
 *  - 현재: problemTitle / problemCategory / language / runStatus / traceCount
 *  - 새 키들은 problemSession 기준 메타 + trace 횟수만 노출. 상세 카운트(span/tool/LLM 등)는 제거됨.
 *
 * 호환을 위해 양쪽 키를 모두 optional 로 유지. used* 가 다시 부활하면 자동 반영.
 */
export interface EvaluationBasis {
  problemTitle?: string;
  problemCategory?: string;
  language?: string;
  runStatus?: string;
  traceCount?: number;
  usedHarnessFiles?: string[];
  usedRunTrace?: {
    traceId?: number;
    spanCount?: number;
    toolCallCount?: number;
    llmCallCount?: number;
    patchCount?: number;
  };
  usedExecutionResults?: Array<{
    totalTestCount?: number;
    passedTestCount?: number;
    passRate?: number;
    buildSucceeded?: boolean;
  }>;
  usedFileChangeReviews?: {
    changeRequestCount?: number;
    approvedCount?: number;
    rejectedCount?: number;
    appliedCount?: number;
  };
}

export interface FeedbackReport {
  id: string;
  submissionId: string;
  problemTitle?: string;
  feedbackReportId?: string;
  problemSessionId?: string;
  agentTraceId?: string;
  status: "PROCEEDING" | "COMPLETED";
  generatedAt: string | null;

  /** 종합 점수 (overall_score). 5축 평균 또는 evaluator 자체 합산. */
  overallScore: number;
  /** 점수 등급 (예: "A", "B+") — 백엔드가 주는 그대로. 없으면 클라이언트가 점수에서 유도. */
  scoreGrade?: string;
  /** 진단 등급 텍스트 ("심각", "양호" 등). */
  diagnosisLevel?: string;

  testPassRate: number;
  testSummary: string;
  buildSucceeded?: boolean;

  /** 5축 점수 + 축별 강점/약점/추천행동 */
  dimensions: DimensionScoreItem[];

  /** legacy — 마이그레이션 호환 용도로 유지. dimensions에서 자동 변환. */
  scores: ScoreItem[];

  /** findings 원본 — strengths/improvements는 derive */
  findings: FindingItem[];
  /** 액션 가이드 — priority 정렬 */
  actionGuides: ActionGuideItem[];

  /** 평가 근거 자료 */
  basis?: EvaluationBasis;

  /** legacy — 강점 / 개선 문자열 배열 (호환용). findings 에서 derive. */
  strengths: string[];
  improvements: string[];

  summary: string;
  timeline: TraceEvent[];
}

"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  AlertTriangle,
  GitBranch,
  Lightbulb,
  FileText,
  ChevronDown
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { useCelebrate } from "@/hooks/useCelebrate";
import { feedbackApi } from "@/lib/api/feedbackApi";
import { useAuthStore } from "@/store/authStore";
import type {
  ActionGuideItem,
  DimensionCriterion,
  DimensionScoreItem,
  FeedbackReport,
  FindingItem
} from "@/lib/types/report";

/* ─── Axis visual config ─── */
type AxisVisual = { abbr: string; color: string; barColor: string };

const AXIS_VISUAL: Record<string, AxisVisual> = {
  HARNESS_GOAL_CLARITY:      { abbr: "GOAL",  color: "#4F46E5", barColor: "#6366F1" },
  HARNESS_WORKFLOW_DESIGN:   { abbr: "FLOW",  color: "#0D9488", barColor: "#14B8A6" },
  HARNESS_CONTEXT_QUALITY:   { abbr: "INFO",  color: "#7C3AED", barColor: "#A855F7" },
  HARNESS_SKILL_MODULARITY:  { abbr: "SKILL", color: "#DB2777", barColor: "#EC4899" },
  HARNESS_VERIFICATION_LOOP: { abbr: "LOOP",  color: "#F59E0B", barColor: "#F97316" }
};
const FALLBACK_VISUAL: AxisVisual = AXIS_VISUAL.HARNESS_GOAL_CLARITY;

/* ─── Criterion label map ─── */
const CRITERION_LABELS: Record<string, string> = {
  goal_definition: "목표 정의", done_criteria: "완료 조건", success_criteria: "성공 기준",
  artifact_criteria: "산출물 기준", failure_criteria: "실패 기준",
  step_separation: "단계 분리", role_separation: "역할 분리", execution_order: "실행 순서",
  iteration_structure: "반복 구조", responsibility_boundaries: "책임 경계",
  problem_context: "문제 컨텍스트", file_context: "파일 컨텍스트", constraint_context: "제약 조건",
  information_density: "정보 밀도", conflict_priority: "충돌 우선순위",
  functional_separation: "기능 분리", trigger_clarity: "트리거 명확도", scope_non_overlap: "범위 비중복",
  reusability: "재사용성", composability: "조합성",
  test_execution: "테스트 실행", failure_log_analysis: "실패 로그 분석", cause_classification: "원인 분류",
  reverify_after_fix: "수정 후 재검증", final_reporting: "최종 보고"
};

const criterionLabel = (name: string) =>
  CRITERION_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ─── Severity → badge (API uses 0~10 scale) ─── */
const severityMeta = (severity: number) => {
  if (severity >= 8) return { tone: "rose",  label: "치명" } as const;
  if (severity >= 6) return { tone: "amber", label: "중요" } as const;
  if (severity >= 3) return { tone: "indigo", label: "보통" } as const;
  return { tone: "gray", label: "참고" } as const;
};

const toneClass = {
  amber: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400",
  rose:  "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400",
  indigo:"bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400",
  gray:  "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
} as const;

/* ─── Page ─── */
export default function FeedbackReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: submissionId } = use(params);
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ["report", submissionId],
    queryFn: () => feedbackApi.getFeedbackReport(submissionId),
    // COMPLETED 또는 errorCount >= 3 이면 stop (리포트 404 / id mismatch 무한 폴링 차단)
    refetchInterval: (q) => {
      if (q.state.data?.status === "COMPLETED") return false;
      if (q.state.errorUpdateCount >= 3) return false;
      return 1500;
    }
  });

  const problemTitle = useMemo(() => report?.problemTitle ?? "풀이 과제", [report?.problemTitle]);

  const { fire: fireConfetti } = useCelebrate();
  useEffect(() => {
    if (report?.status === "COMPLETED" && (report.overallScore ?? 0) >= 90) {
      void fireConfetti(`report-${submissionId}`);
    }
  }, [report?.status, report?.overallScore, submissionId, fireConfetti]);

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <AlertTriangle size={28} className="mx-auto text-amber-500 mb-3" />
        <p className="font-semibold text-gray-800 mb-2">리포트를 찾을 수 없습니다.</p>
        <p className="text-sm text-gray-500 mb-5">제출 처리 화면에서 상태를 다시 확인해 주세요.</p>
        <Link href={withPrefix(`/submissions/${submissionId}`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors">
          <span>제출 상태 보기</span><ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>
    );
  }

  if (isLoading || !report || report.status !== "COMPLETED") {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-gray-500">
          <Sparkles size={18} className="animate-pulse" />
          <span>리포트를 생성하는 중…</span>
        </div>
        <div className="mt-5">
          <Link href={withPrefix(`/submissions/${submissionId}`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors">
            <span>처리 단계 보기</span><ArrowRight size={14} strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    );
  }

  const shortId = submissionId.replace(/^submission-/, "").slice(0, 6);
  const firstName = user?.name?.split(/\s/)[0] ?? "개발자";
  const strengthFindings = report.findings.filter((f) => f.category === "STRENGTH");
  const improvementFindings = report.findings
    .filter((f) => f.category !== "STRENGTH")
    .sort((a, b) => b.severity - a.severity);
  const traceCount = report.basis?.traceCount ?? report.timeline.length;
  const hasTraceTimeline = Boolean(report.agentTraceId || report.timeline.length > 0 || traceCount > 0);
  const traceLabel = report.agentTraceId ? "상세 Trace" : hasTraceTimeline ? "요약 Trace" : "Trace 없음";
  const traceDescription = report.agentTraceId
    ? "LLM 호출, Tool 실행, 재시도 단계를 span 단위로 확인할 수 있어요."
    : hasTraceTimeline
      ? `Agent Trace ${traceCount}회가 평가에 반영됐어요. 상세 span이 없으면 요약 타임라인으로 표시됩니다.`
      : "Agent 실행 없이 제출됐거나 서버 응답에 Trace 식별자가 없어 표시할 타임라인이 없습니다.";

  return (
    <div className="relative min-h-screen bg-[#EEF2FF]">
      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16 space-y-6">

        {/* ── HERO ── */}
        <section
          className="relative rounded-3xl overflow-hidden text-white animate-slide-up"
          style={{ backgroundImage: "linear-gradient(135deg, #3B3A9E 0%, #4F46E5 30%, #7C3AED 70%, #6D28D9 100%)" }}
        >
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-8 md:p-12">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold mb-6">
                <Sparkles size={12} strokeWidth={2.4} />
                <span>Report · Submission #{shortId}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight leading-[1.1] mb-3">
                {firstName}님, 잘 해냈어요.
              </h1>
              <p className="text-[15px] md:text-base text-white/80 max-w-xl leading-relaxed">
                {problemTitle} 과제를 풀었어요. AIG가 분석한 결과를 한눈에 확인해 보세요.
              </p>
            </div>
            <div className="shrink-0 md:text-right">
              <div className="flex items-end justify-start md:justify-end gap-1.5">
                <span className="text-6xl md:text-7xl font-display font-bold leading-none tracking-tight">
                  {report.overallScore}
                </span>
                <span className="text-2xl font-display font-semibold text-white/70 mb-1.5">/ 100</span>
              </div>
              <div className="mt-2 flex items-center justify-start md:justify-end gap-2">
                {report.scoreGrade && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold tracking-wide">
                    {report.scoreGrade}
                  </span>
                )}
                {report.diagnosisLevel && (
                  <span className="text-white/85 text-sm font-medium">{report.diagnosisLevel}</span>
                )}
              </div>
              <p className="text-sm text-white/80 font-semibold mt-1 tracking-wide">Overall AIG Score</p>
            </div>
          </div>
        </section>

        {/* ── SCORE OVERVIEW: Radar + Bars ── */}
        <ScoreOverviewSection dimensions={report.dimensions} />

        {/* ── DIMENSION DETAILS (accordion) ── */}
        <DimensionDetailsSection dimensions={report.dimensions} />

        {/* ── ACTION GUIDES ── */}
        {report.actionGuides.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 animate-slide-up">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600">
                <Lightbulb size={15} strokeWidth={2.2} />
              </span>
              <h2 className="font-display font-bold text-gray-900 text-[17px]">다음 액션 가이드</h2>
              <span className="text-xs text-gray-500">priority 순</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.actionGuides.map((g) => (
                <ActionGuideCard key={`${g.priority}-${g.title}`} guide={g} />
              ))}
            </div>
          </section>
        )}

        {/* ── STRENGTHS (compact) ── */}
        {strengthFindings.length > 0 && (
          <StrengthsCompactCard findings={strengthFindings} />
        )}

        {/* ── IMPROVEMENTS (accordion) ── */}
        {improvementFindings.length > 0 && (
          <ImprovementsAccordion findings={improvementFindings} />
        )}

        {/* ── SUMMARY ── */}
        {report.summary && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-7 animate-slide-up">
            <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-lg mb-3">최종 요약</h2>
            {/* report.summary 는 evaluator 가 markdown 으로 작성 (**굵게**, - 불릿, 코드 등) — 평문 렌더 시
                작성 의도와 다르게 보였음. remarkGfm 으로 GFM 확장까지 지원. */}
            <div className="report-summary-md text-[15px] text-gray-700 dark:text-slate-300 leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm]}>{report.summary}</Markdown>
            </div>
          </section>
        )}

        {/* ── EVALUATION BASIS ── */}
        {report.basis && <BasisSection report={report} />}

        {/* ── TRACE CTA ── */}
        <section className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-4 min-w-0">
            <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600">
              <GitBranch size={20} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-display font-bold text-gray-900 text-[17px]">Trace 타임라인</div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold">
                  {traceLabel}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-0.5">{traceDescription}</div>
            </div>
          </div>
          {hasTraceTimeline ? (
            <Link href={withPrefix(`/submissions/${submissionId}/timeline`)}
              className="shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 font-semibold text-sm transition-colors">
              <span>타임라인 보기</span><ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-400 bg-gray-50 font-semibold text-sm">
              <span>기록 없음</span>
            </span>
          )}
        </section>

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4">
          <Link href={withPrefix("/reports")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors">
            <ArrowLeft size={14} strokeWidth={2.4} /><span>리포트 목록으로</span>
          </Link>
          <Link href={withPrefix("/problems")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm">
            <span>과제 목록으로</span><ArrowRight size={14} strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Score Overview (Radar + Bars) ─── */

function ScoreOverviewSection({ dimensions }: { dimensions: DimensionScoreItem[] }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 md:p-8 animate-slide-up">
      <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-lg mb-1">Harness 영역별 점수</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">AGENTS / HARNESS 평가 기준에 따른 다섯 가지 영역의 점수입니다.</p>
      <div className="flex flex-col md:flex-row md:items-center gap-8">
        <div className="shrink-0 mx-auto md:mx-0">
          <ReportRadarChart dimensions={dimensions} />
        </div>
        <div className="flex-1 min-w-0 space-y-3.5">
          {dimensions.map((dim) => {
            const visual = AXIS_VISUAL[dim.code] ?? FALLBACK_VISUAL;
            const isLow = dim.score < 70;
            return (
              <div key={dim.code} className="flex items-center gap-3">
                <span className="w-[108px] shrink-0 text-sm font-semibold text-gray-700 dark:text-slate-300 truncate">{dim.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${dim.score}%`, backgroundColor: visual.barColor }}
                  />
                </div>
                {/* 점수 색상: 70 미만이면 빨강, 그 외엔 일반 — 이전엔 inline style 로 라이트 hex 만 박혀 있어
                    다크모드에서 검은 글씨로 보이지 않던 버그. dark variant 적용 가능한 className 으로 전환. */}
                <span
                  className={`w-[72px] shrink-0 text-right text-sm font-bold tabular-nums ${
                    isLow ? "text-rose-500" : "text-gray-900 dark:text-slate-100"
                  }`}
                >
                  {dim.score} <span className="text-gray-400 dark:text-slate-500 font-normal text-xs">/ 100</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Radar Chart SVG ─── */

function ReportRadarChart({ dimensions }: { dimensions: DimensionScoreItem[] }) {
  const SIZE = 220;
  const CENTER = SIZE / 2;
  const MAX_R = 80;
  const N = dimensions.length;
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pointFor = (i: number, r: number) => ({
    x: CENTER + r * Math.cos(angleFor(i)),
    y: CENTER + r * Math.sin(angleFor(i))
  });

  const rings = [25, 50, 75, 100];
  const scorePoints = dimensions.map((d, i) => {
    const p = pointFor(i, (d.score / 100) * MAX_R);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible">
      <defs>
        <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Grid rings */}
      {rings.map((ring) => {
        const pts = dimensions.map((_, i) => {
          const p = pointFor(i, (ring / 100) * MAX_R);
          return `${p.x},${p.y}`;
        }).join(" ");
        return (
          <polygon
            key={ring}
            points={pts}
            fill={ring === 100 ? "#F8FAFC" : "none"}
            stroke="#E5E7EB"
            strokeWidth={1}
          />
        );
      })}

      {/* Axis lines */}
      {dimensions.map((_, i) => {
        const end = pointFor(i, MAX_R);
        return <line key={i} x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} stroke="#E5E7EB" strokeWidth={1} />;
      })}

      {/* Score polygon */}
      <polygon
        points={scorePoints}
        fill="url(#radarFill)"
        stroke="#4F46E5"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Score dots */}
      {dimensions.map((d, i) => {
        const p = pointFor(i, (d.score / 100) * MAX_R);
        return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#4F46E5" />;
      })}

      {/* Axis labels */}
      {dimensions.map((d, i) => {
        const p = pointFor(i, MAX_R + 20);
        const label = d.label.split(" ")[0];
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={600}
            fill="#6B7280"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/* ─── Dimension Details Accordion ─── */

function DimensionDetailsSection({ dimensions }: { dimensions: DimensionScoreItem[] }) {
  const [openCode, setOpenCode] = useState<string | null>(null);

  return (
    <section className="space-y-2 animate-slide-up">
      <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-lg px-1 mb-3">영역별 세부 평가</h2>
      {dimensions.map((dim) => {
        const visual = AXIS_VISUAL[dim.code] ?? FALLBACK_VISUAL;
        const isOpen = openCode === dim.code;
        const hasCriteria = (dim.criteria?.length ?? 0) > 0;
        return (
          <div key={dim.code} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header row */}
            <button
              type="button"
              onClick={() => setOpenCode(isOpen ? null : dim.code)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <span
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl text-white shadow-sm font-bold text-[10px] tracking-wide"
                style={{ backgroundColor: visual.color }}
              >
                {visual.abbr}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 dark:text-slate-100 text-[15px]">{dim.label}</span>
                  {dim.tone === "warn" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                      개선 필요
                    </span>
                  )}
                </div>
                {!isOpen && dim.rationale && (
                  <PreviewMarkdown text={dim.rationale} className="text-[12.5px] text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-1" />
                )}
              </div>

              <div className="shrink-0 flex items-center gap-3">
                {/* Mini bar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${dim.score}%`, backgroundColor: visual.barColor }}
                    />
                  </div>
                </div>
                {/* 점수 색상: 70 미만 빨강, 외엔 일반 — inline hex 대신 className 으로 dark variant 적용. */}
                <span
                  className={`text-xl font-display font-bold tabular-nums leading-none ${
                    dim.score < 70 ? "text-rose-500" : "text-gray-900 dark:text-slate-100"
                  }`}
                >
                  {dim.score}
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-500">/ 100</span>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-slate-800 px-5 py-5 space-y-5">
                {/* Rationale */}
                {dim.rationale && (
                  <DimMarkdown text={dim.rationale} className="text-sm text-gray-700 dark:text-slate-300" />
                )}

                {/* Strength / Improvement summaries */}
                {(dim.strengthSummary || dim.improvementSummary) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {dim.strengthSummary && (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400 mb-1">강점</div>
                        <DimMarkdown text={dim.strengthSummary} className="text-[13px] text-emerald-800 dark:text-emerald-200" />
                      </div>
                    )}
                    {dim.improvementSummary && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400 mb-1">개선</div>
                        <DimMarkdown text={dim.improvementSummary} className="text-[13px] text-amber-800 dark:text-amber-200" />
                      </div>
                    )}
                  </div>
                )}

                {/* Criteria table */}
                {hasCriteria && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-slate-400 mb-2">세부 기준</div>
                    <div className="space-y-2">
                      {dim.criteria!.map((c) => (
                        <CriterionRow key={c.name} criterion={c} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/* ─── PreviewMarkdown: 1줄 preview용 인라인 마크다운 렌더러 ─── */
// heading/table/list 줄은 건너뛰고 첫 실제 내용 줄을 찾아 **bold** · *italic* · `code` 인라인만 렌더링.
// line-clamp-1은 block 자식이 있으면 깨지므로 react-markdown 대신 직접 파싱.
function PreviewMarkdown({ text, className }: { text: string; className?: string }) {
  const firstLine =
    text
      .split("\n")
      .map((l) => l.trim())
      .find(
        (l) =>
          l.length > 5 &&
          !l.startsWith("#") &&
          !l.startsWith("|") &&
          !l.match(/^[-*+]\s/) &&
          !l.match(/^\d+\.\s/) &&
          !l.match(/^[=\-]{3,}$/)
      ) ?? text.split("\n")[0].trim();

  const parts = firstLine.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  const nodes = parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="px-1 rounded bg-gray-100 dark:bg-slate-800 font-mono text-[10.5px]">{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });

  return <p className={className}>{nodes}</p>;
}

/* ─── DimMarkdown: dimension rationale/summary 마크다운 렌더러 ─── */
// '## Section' 패턴은 react-markdown이 인식 못하므로 백틱 코드로 전처리.
function preprocessMd(text: string): string {
  return text.replace(/'(#{1,2} ?[^'\n]+)'/g, "`$1`");
}

function DimMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`report-dim-md ${className ?? ""}`}>
      <Markdown remarkPlugins={[remarkGfm]}>{preprocessMd(text)}</Markdown>
    </div>
  );
}


/* ─── Criterion Row ─── */

function CriterionRow({ criterion }: { criterion: DimensionCriterion }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(criterion.score * 100);
  const scoreColor = pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
  const scoreBg = pct >= 80 ? "#ECFDF5" : pct >= 50 ? "#FFFBEB" : "#FEF2F2";

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
      >
        <span
          className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
          style={{ backgroundColor: scoreBg, color: scoreColor }}
        >
          {pct}%
        </span>
        <span className="flex-1 text-[13px] font-semibold text-gray-800">{criterionLabel(criterion.name)}</span>
        {(criterion.finding || criterion.suggestion) && (
          <ChevronDown
            size={14}
            className={`shrink-0 text-gray-400 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {criterion.finding && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-1">분석</div>
              <div className="report-summary-md text-[13px] text-gray-700 leading-relaxed">
                <Markdown remarkPlugins={[remarkGfm]}>{criterion.finding}</Markdown>
              </div>
            </div>
          )}
          {criterion.evidence && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-1">근거</div>
              <div className="report-summary-md text-[12px] font-mono text-gray-600 bg-white rounded-lg border border-gray-100 px-3 py-2 leading-relaxed">
                <Markdown remarkPlugins={[remarkGfm]}>{criterion.evidence}</Markdown>
              </div>
              {criterion.evidenceFile && (
                <span className="mt-1 inline-block text-[11px] text-gray-400 font-mono">
                  📄 {criterion.evidenceFile}
                </span>
              )}
            </div>
          )}
          {criterion.suggestion && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-600 dark:text-indigo-400 mb-1">개선 제안</div>
              <DimMarkdown text={criterion.suggestion} className="text-[13px] text-indigo-900 dark:text-indigo-100 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-100 dark:border-indigo-800/60 px-3 py-2 leading-relaxed" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── ActionGuideCard ─── */

function ActionGuideCard({ guide }: { guide: ActionGuideItem }) {
  return (
    <div className="relative pl-14 pr-4 py-4 rounded-xl border border-gray-100 bg-gradient-to-br from-indigo-50/40 to-white">
      <span
        className="absolute left-4 top-4 inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-xs"
        style={{ backgroundImage: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}
      >
        {guide.priority}
      </span>
      <div className="font-display font-bold text-gray-900 text-[15px] mb-1">{guide.title}</div>
      {guide.description && <p className="text-sm text-gray-600 leading-relaxed">{guide.description}</p>}
      {guide.expectedImpact && (
        <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-semibold">
          기대 효과 · {guide.expectedImpact}
        </div>
      )}
    </div>
  );
}

/* ─── StrengthsCompactCard ─── */

function StrengthsCompactCard({ findings }: { findings: FindingItem[] }) {
  return (
    <section className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 md:px-6 md:py-5 animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shrink-0">
          <Check size={11} strokeWidth={3} />
        </span>
        <h2 className="font-display font-bold text-emerald-900 text-[15px]">잘한 점</h2>
        <span className="ml-auto text-xs text-emerald-600 font-semibold">{findings.length}개</span>
      </div>
      <ul className="space-y-2">
        {findings.map((f) => (
          <li key={f.id} className="flex items-start gap-2.5">
            <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <div className="min-w-0">
              <span className="text-[13.5px] font-semibold text-emerald-900">{f.title}</span>
              {f.description && (
                <span className="text-[12.5px] text-emerald-700"> — {f.description}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── ImprovementsAccordion ─── */

function ImprovementsAccordion({ findings }: { findings: FindingItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 md:p-6 animate-slide-up">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white shadow-sm shrink-0">
          <AlertTriangle size={13} strokeWidth={2.4} />
        </span>
        <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-[17px]">개선 포인트</h2>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
          {findings.length}개
        </span>
      </div>
      <div className="space-y-1.5">
        {findings.map((f) => {
          const sev = severityMeta(f.severity);
          const isOpen = openId === f.id;
          const hasDetail = !!(f.description || f.recommendation);
          return (
            <div key={f.id} className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => hasDetail && setOpenId(isOpen ? null : f.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${hasDetail ? "hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer" : "cursor-default"}`}
              >
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${toneClass[sev.tone]}`}>
                  {sev.label}
                </span>
                <span className="flex-1 text-[13.5px] font-semibold text-gray-800 dark:text-slate-200 leading-snug">{f.title}</span>
                {hasDetail && (
                  <ChevronDown
                    size={15}
                    className={`shrink-0 text-gray-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              {isOpen && hasDetail && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-slate-700 space-y-2.5">
                  {f.description && (
                    <DimMarkdown text={f.description} className="text-[13px] text-gray-600 dark:text-slate-300 leading-relaxed" />
                  )}
                  {f.recommendation && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 px-3 py-2.5">
                      <Lightbulb size={13} className="shrink-0 mt-1 text-amber-500" />
                      <DimMarkdown text={f.recommendation} className="text-[12.5px] text-amber-800 dark:text-amber-100 leading-relaxed" />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── BasisSection ─── */

function BasisSection({ report }: { report: FeedbackReport }) {
  const basis = report.basis;
  if (!basis) return null;

  // 신규 응답 키 (problemCategory / language / traceCount) + 구 응답 키 (used*) 둘 다 받음.
  // 구 키들은 백엔드 현재 응답에서 빠져 있어 안 보이고, 부활하면 자동 노출.
  const trace = basis.usedRunTrace;
  const reviews = basis.usedFileChangeReviews;
  const exec = basis.usedExecutionResults?.at(-1);
  const harnessFiles = basis.usedHarnessFiles ?? [];

  // 신규 응답 키 기반 메타 chip 들.
  type MetaChip = { label: string; value: string };
  const metaChips: MetaChip[] = [];
  if (basis.problemCategory) {
    metaChips.push({ label: "분야", value: basis.problemCategory === "BUG" ? "버그 수정" : basis.problemCategory === "API" ? "API 구현" : basis.problemCategory });
  }
  if (basis.language) {
    metaChips.push({ label: "언어", value: basis.language });
  }
  if (basis.runStatus) {
    metaChips.push({ label: "실행 상태", value: basis.runStatus });
  }
  if (typeof basis.traceCount === "number") {
    metaChips.push({ label: "Trace", value: `${basis.traceCount}회` });
  }

  const hasOldDetail = !!trace || !!exec || !!reviews || harnessFiles.length > 0;

  // 메타 chip 도, 구버전 카드도 둘 다 없으면 섹션 자체 숨김.
  if (metaChips.length === 0 && !hasOldDetail) return null;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-7 animate-slide-up">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
          <FileText size={14} strokeWidth={2.2} />
        </span>
        <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-[17px]">평가 근거</h2>
        <span className="text-xs text-gray-500 dark:text-slate-400">이 리포트가 본 자료들</span>
      </div>

      {/* 신규 메타 chips */}
      {metaChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {metaChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-slate-400">{chip.label}</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-slate-100">{chip.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* 구 응답 키 (used*) 가 살아있으면 BasisStat 카드 — 백엔드가 다시 채워주면 자동 노출 */}
      {hasOldDetail && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {trace && (
            <BasisStat label="Trace" items={[
              { k: "Span", v: trace.spanCount ?? 0 },
              { k: "Tool", v: trace.toolCallCount ?? 0 },
              { k: "LLM",  v: trace.llmCallCount ?? 0 },
              { k: "Patch", v: trace.patchCount ?? 0 }
            ]} />
          )}
          {exec && (
            <BasisStat label="실행 결과" items={[
              { k: "통과", v: exec.passedTestCount ?? 0 },
              { k: "총",   v: exec.totalTestCount ?? 0 },
              { k: "빌드", v: exec.buildSucceeded === false ? "실패" : "성공" }
            ]} />
          )}
          {reviews && (
            <BasisStat label="파일 변경 검토" items={[
              { k: "요청", v: reviews.changeRequestCount ?? 0 },
              { k: "승인", v: reviews.approvedCount ?? 0 },
              { k: "거절", v: reviews.rejectedCount ?? 0 },
              { k: "적용", v: reviews.appliedCount ?? 0 }
            ]} />
          )}
        </div>
      )}

      {harnessFiles.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400 mb-2">사용된 하네스 파일</div>
          <div className="flex flex-wrap gap-1.5">
            {harnessFiles.map((p) => (
              <span key={p} className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono text-[11.5px] text-gray-700 dark:text-slate-300">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BasisStat({ label, items }: { label: string; items: { k: string; v: number | string }[] }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-600 dark:text-slate-400 mb-2.5">{label}</div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => (
          <div key={it.k} className="text-center">
            <div className="text-[10px] uppercase tracking-[0.1em] text-gray-500 dark:text-slate-400 mb-0.5 font-semibold">{it.k}</div>
            <div className="font-display font-bold text-gray-900 dark:text-slate-100 text-lg tabular-nums leading-none">{it.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


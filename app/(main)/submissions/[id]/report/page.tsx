"use client";

import Link from "next/link";
import { use, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Shield,
  Code2,
  Share2,
  Layers,
  RefreshCcw,
  Check,
  AlertTriangle,
  GitBranch,
  Lightbulb,
  FileText,
  type LucideIcon
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { useCelebrate } from "@/hooks/useCelebrate";
import { feedbackApi } from "@/lib/api/feedbackApi";
import { useAuthStore } from "@/store/authStore";
import type {
  ActionGuideItem,
  DimensionScoreItem,
  FeedbackReport,
  FindingItem
} from "@/lib/types/report";

/** 5축 시각 설정 — code 기반 매핑. */
type AxisVisual = {
  icon: LucideIcon;
  iconBg: string;
  barFill: string;
};
const AXIS_VISUAL: Record<string, AxisVisual> = {
  HARNESS_GOAL_CLARITY: {
    icon: Shield,
    iconBg: "linear-gradient(135deg, #4F46E5, #6366F1)",
    barFill: "linear-gradient(90deg, #4F46E5, #6366F1)"
  },
  HARNESS_WORKFLOW_DESIGN: {
    icon: Code2,
    iconBg: "linear-gradient(135deg, #0D9488, #14B8A6)",
    barFill: "linear-gradient(90deg, #0D9488, #14B8A6)"
  },
  HARNESS_CONTEXT_QUALITY: {
    icon: Share2,
    iconBg: "linear-gradient(135deg, #7C3AED, #A855F7)",
    barFill: "linear-gradient(90deg, #7C3AED, #A855F7)"
  },
  HARNESS_SKILL_MODULARITY: {
    icon: Layers,
    iconBg: "linear-gradient(135deg, #DB2777, #EC4899)",
    barFill: "linear-gradient(90deg, #DB2777, #EC4899)"
  },
  HARNESS_VERIFICATION_LOOP: {
    icon: RefreshCcw,
    iconBg: "linear-gradient(135deg, #F59E0B, #F97316)",
    barFill: "linear-gradient(90deg, #F59E0B, #F97316)"
  }
};
const FALLBACK_VISUAL: AxisVisual = AXIS_VISUAL.HARNESS_GOAL_CLARITY;

/** severity → tone + label */
const severityMeta = (severity: number) => {
  if (severity >= 3) return { tone: "amber", label: "치명" } as const;
  if (severity >= 2) return { tone: "rose", label: "중요" } as const;
  if (severity >= 1) return { tone: "indigo", label: "보통" } as const;
  return { tone: "gray", label: "참고" } as const;
};

const toneClass = {
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  gray: "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
} as const;

export default function FeedbackReportPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: submissionId } = use(params);
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ["report", submissionId],
    queryFn: () => feedbackApi.getFeedbackReport(submissionId),
    refetchInterval: (q) => (q.state.data?.status === "COMPLETED" ? false : 1500)
  });

  const problemTitle = useMemo(() => report?.problemTitle ?? "풀이 과제", [report?.problemTitle]);

  // 🎉 리포트 로딩 끝났고 점수 90 이상이면 폭죽. 같은 submissionId 로는 한 번만 (useCelebrate 내부 dedupe).
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
        <p className="text-gray-800 dark:text-slate-100 font-semibold mb-2">리포트를 찾을 수 없습니다.</p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">제출 처리 화면에서 상태를 다시 확인해 주세요.</p>
        <Link
          href={withPrefix(`/submissions/${submissionId}`)}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
        >
          <span>제출 상태 보기</span>
          <ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>
    );
  }

  if (isLoading || !report || report.status !== "COMPLETED") {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center space-x-2 text-gray-500 dark:text-slate-400">
          <Sparkles size={18} className="animate-pulse" />
          <span>리포트를 생성하는 중…</span>
        </div>
        <div className="mt-5">
          <Link
            href={withPrefix(`/submissions/${submissionId}`)}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-semibold text-sm transition-colors"
          >
            <span>처리 단계 보기</span>
            <ArrowRight size={14} strokeWidth={2.4} />
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

  return (
    <div className="relative min-h-screen">
      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16 space-y-6">
        {/* ── HERO ── */}
        <section
          className="relative rounded-3xl overflow-hidden text-white animate-slide-up"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #3B3A9E 0%, #4F46E5 30%, #7C3AED 70%, #6D28D9 100%)"
          }}
        >
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-8 md:p-12">
            {/* Left */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold mb-6">
                <Sparkles size={12} strokeWidth={2.4} />
                <span>Report · Submission #{shortId}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight leading-[1.1] mb-3">
                {firstName}님, 잘 해냈어요.
              </h1>
              <p className="text-[15px] md:text-base text-white/80 max-w-xl leading-relaxed">
                {problemTitle} 과제를 풀었어요 — AIG가 분석한 결과를 한눈에 확인해 보세요.
              </p>
            </div>

            {/* Right — score + grade + diagnosis */}
            <div className="shrink-0 md:text-right">
              <div className="flex items-end justify-start md:justify-end gap-1.5">
                <span className="text-6xl md:text-7xl font-display font-bold leading-none tracking-tight">
                  {report.overallScore}
                </span>
                <span className="text-2xl md:text-3xl font-display font-semibold text-white/70 mb-1.5">
                  / 100
                </span>
              </div>
              <div className="mt-2 flex items-center justify-start md:justify-end gap-2">
                {report.scoreGrade ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold tracking-wide">
                    {report.scoreGrade}
                  </span>
                ) : null}
                {report.diagnosisLevel ? (
                  <span className="text-white/85 text-sm font-medium">
                    {report.diagnosisLevel}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-white/80 font-semibold mt-1 tracking-wide">
                Overall AIG Score
              </p>
            </div>
          </div>
        </section>

        {/* ── 5축 METRICS — 모바일 1열 / md 2열 / xl 5열 ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          {report.dimensions.map((dimension, i) => (
            <DimensionCard
              key={dimension.code}
              dimension={dimension}
              visual={AXIS_VISUAL[dimension.code] ?? FALLBACK_VISUAL}
              delay={i * 50}
            />
          ))}
        </section>

        {/* ── ACTION GUIDES (priority) ── */}
        {report.actionGuides.length > 0 ? (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-7 animate-slide-up">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                <Lightbulb size={15} strokeWidth={2.2} />
              </span>
              <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-[17px]">
                다음 액션 가이드
              </h2>
              <span className="text-xs text-gray-500 dark:text-slate-400">priority 순</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.actionGuides.map((g) => (
                <ActionGuideCard key={`${g.priority}-${g.title}`} guide={g} />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── STRENGTHS + IMPROVEMENTS (findings 우선, fallback legacy) ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {strengthFindings.length > 0 ? (
            <FindingsCard title="강점" tone="good" findings={strengthFindings} />
          ) : (
            <LegacyFeedbackCard title="강점" tone="good" items={report.strengths} />
          )}
          {improvementFindings.length > 0 ? (
            <FindingsCard title="개선 포인트" tone="warn" findings={improvementFindings} />
          ) : (
            <LegacyFeedbackCard title="개선 포인트" tone="warn" items={report.improvements} />
          )}
        </section>

        {/* ── SUMMARY (one-liner) ── */}
        {report.summary && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-7 flex items-start gap-4 animate-slide-up">
            <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <Sparkles size={16} strokeWidth={2.2} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400 mb-1">
                한 줄 요약
              </div>
              <p className="text-[15px] md:text-base text-gray-800 dark:text-slate-200 font-medium leading-relaxed">
                {report.summary}
              </p>
            </div>
          </section>
        )}

        {/* ── EVALUATION BASIS — 평가 근거 ── */}
        {report.basis ? <BasisSection report={report} /> : null}

        {/* ── TRACE TIMELINE CTA ── */}
        <section
          className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/40 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up"
        >
          <div className="flex items-center gap-4 min-w-0">
            <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <GitBranch size={20} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="font-display font-bold text-gray-900 dark:text-slate-100 text-[17px]">
                Trace 타임라인
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                모든 LLM 호출, Tool 실행, 재시도 단계를 한 번에 확인할 수 있어요.
              </div>
            </div>
          </div>
          <Link
            href={withPrefix(`/submissions/${submissionId}/timeline`)}
            className="shrink-0 inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl border-2 border-indigo-500 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 font-semibold text-sm transition-colors"
          >
            <span>타임라인 보기</span>
            <ArrowRight size={14} strokeWidth={2.4} />
          </Link>
        </section>

        {/* ── FOOTER ACTION ROW ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4">
          <Link
            href={withPrefix("/problems")}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-semibold text-sm transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={2.4} />
            <span>과제 목록으로</span>
          </Link>
          <Link
            href={withPrefix("/problems")}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <span>다음 과제 풀기</span>
            <ArrowRight size={14} strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── DimensionCard — 5축 한 칸 ─── */

function DimensionCard({
  dimension,
  visual,
  delay
}: {
  dimension: DimensionScoreItem;
  visual: AxisVisual;
  delay: number;
}) {
  const Icon = visual.icon;
  const hasDetail =
    !!dimension.strengthSummary ||
    !!dimension.improvementSummary ||
    (dimension.recommendedActions?.length ?? 0) > 0;

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 animate-slide-up flex flex-col"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-white shadow-sm shrink-0"
          style={{ backgroundImage: visual.iconBg }}
        >
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-slate-400 leading-tight">
          {dimension.label}
        </span>
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-4xl font-display font-bold text-gray-900 dark:text-slate-100 leading-none tracking-tight tabular-nums">
          {dimension.score}
        </span>
        <span className="text-base font-display font-semibold text-gray-400 dark:text-slate-500">/ 100</span>
      </div>

      <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, dimension.score))}%`,
            backgroundImage: visual.barFill
          }}
        />
      </div>

      {dimension.rationale ? (
        <p className="text-[12.5px] text-gray-600 dark:text-slate-400 leading-relaxed">{dimension.rationale}</p>
      ) : null}

      {hasDetail ? (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors select-none list-none flex items-center gap-1">
            <span className="group-open:hidden">자세히 보기 ▾</span>
            <span className="hidden group-open:inline">접기 ▴</span>
          </summary>
          <div className="mt-2.5 space-y-2.5 text-[12.5px] leading-relaxed">
            {dimension.strengthSummary ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400 mb-0.5">
                  강점
                </div>
                <p className="text-gray-700 dark:text-slate-300">{dimension.strengthSummary}</p>
              </div>
            ) : null}
            {dimension.improvementSummary ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400 mb-0.5">
                  개선
                </div>
                <p className="text-gray-700 dark:text-slate-300">{dimension.improvementSummary}</p>
              </div>
            ) : null}
            {dimension.recommendedActions && dimension.recommendedActions.length > 0 ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-slate-400 mb-1">
                  추천 행동
                </div>
                <ul className="space-y-1">
                  {dimension.recommendedActions.map((a) => (
                    <li key={a} className="flex items-start gap-1.5 text-gray-700 dark:text-slate-300">
                      <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">·</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/* ─── ActionGuideCard ─── */

function ActionGuideCard({ guide }: { guide: ActionGuideItem }) {
  return (
    <div className="relative pl-14 pr-4 py-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gradient-to-br from-indigo-50/40 to-white dark:from-indigo-500/10 dark:to-slate-900">
      <span className="absolute left-4 top-4 inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-xs"
        style={{ backgroundImage: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}
      >
        {guide.priority}
      </span>
      <div className="font-display font-bold text-gray-900 dark:text-slate-100 text-[15px] mb-1">{guide.title}</div>
      {guide.description ? (
        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{guide.description}</p>
      ) : null}
      {guide.expectedImpact ? (
        <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold">
          기대 효과 · {guide.expectedImpact}
        </div>
      ) : null}
    </div>
  );
}

/* ─── FindingsCard — severity 보존된 풍부한 강점/개선 카드 ─── */

function FindingsCard({
  title,
  tone,
  findings
}: {
  title: string;
  tone: "good" | "warn";
  findings: FindingItem[];
}) {
  const isGood = tone === "good";
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-7 animate-slide-up">
      <div className="flex items-center gap-2.5 mb-5">
        {isGood ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white shadow-sm">
            <Check size={14} strokeWidth={3} />
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white shadow-sm">
            <AlertTriangle size={13} strokeWidth={2.4} />
          </span>
        )}
        <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-[17px]">{title}</h2>
      </div>

      <ul className="space-y-4">
        {findings.map((f) => {
          const sev = severityMeta(f.severity);
          return (
            <li key={f.id} className="border-l-2 pl-3.5"
              style={{ borderColor: isGood ? "#10B981" : "#F59E0B" }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-semibold text-gray-900 dark:text-slate-100 text-[14px] leading-snug">
                  {f.title}
                </div>
                {!isGood ? (
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${toneClass[sev.tone]}`}>
                    {sev.label}
                  </span>
                ) : null}
              </div>
              {f.description ? (
                <p className="text-[13px] text-gray-600 dark:text-slate-400 leading-relaxed">{f.description}</p>
              ) : null}
              {f.recommendation ? (
                <p className="mt-1.5 text-[12.5px] text-gray-700 dark:text-slate-300 leading-relaxed flex items-start gap-1.5">
                  <Lightbulb size={12} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
                  <span>{f.recommendation}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── LegacyFeedbackCard — findings 가 없는 경우 폴백 (strengths/improvements string[]) ─── */

function LegacyFeedbackCard({
  title,
  tone,
  items
}: {
  title: string;
  tone: "good" | "warn";
  items: string[];
}) {
  const isGood = tone === "good";
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-7 animate-slide-up">
      <div className="flex items-center gap-2.5 mb-5">
        {isGood ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white shadow-sm">
            <Check size={14} strokeWidth={3} />
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white shadow-sm">
            <AlertTriangle size={13} strokeWidth={2.4} />
          </span>
        )}
        <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-[17px]">{title}</h2>
      </div>

      <ul className="space-y-3.5">
        {items.map((item, i) => {
          const { head, tail } = splitHead(item);
          return (
            <li key={`${title}-${i}`} className="flex items-start gap-3">
              <span
                className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isGood
                    ? "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300"
                    : "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                }`}
              >
                {isGood ? (
                  <Check size={11} strokeWidth={3} />
                ) : (
                  <AlertTriangle size={10} strokeWidth={2.6} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{head}</div>
                {tail && (
                  <div className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mt-0.5">{tail}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── BasisSection — 평가에 사용된 자료 요약 ─── */

function BasisSection({ report }: { report: FeedbackReport }) {
  const basis = report.basis;
  if (!basis) return null;
  const trace = basis.usedRunTrace;
  const reviews = basis.usedFileChangeReviews;
  const exec = basis.usedExecutionResults?.at(-1);
  const harnessFiles = basis.usedHarnessFiles ?? [];

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-7 animate-slide-up">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
          <FileText size={14} strokeWidth={2.2} />
        </span>
        <h2 className="font-display font-bold text-gray-900 dark:text-slate-100 text-[17px]">평가 근거</h2>
        <span className="text-xs text-gray-500 dark:text-slate-400">이 리포트가 본 자료들</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {trace ? (
          <BasisStat
            label="Trace"
            items={[
              { k: "Span", v: trace.spanCount ?? 0 },
              { k: "Tool", v: trace.toolCallCount ?? 0 },
              { k: "LLM", v: trace.llmCallCount ?? 0 },
              { k: "Patch", v: trace.patchCount ?? 0 }
            ]}
          />
        ) : null}
        {exec ? (
          <BasisStat
            label="실행 결과"
            items={[
              { k: "통과", v: exec.passedTestCount ?? 0 },
              { k: "총", v: exec.totalTestCount ?? 0 },
              { k: "빌드", v: exec.buildSucceeded === false ? "실패" : "성공" }
            ]}
          />
        ) : null}
        {reviews ? (
          <BasisStat
            label="파일 변경 검토"
            items={[
              { k: "요청", v: reviews.changeRequestCount ?? 0 },
              { k: "승인", v: reviews.approvedCount ?? 0 },
              { k: "거절", v: reviews.rejectedCount ?? 0 },
              { k: "적용", v: reviews.appliedCount ?? 0 }
            ]}
          />
        ) : null}
      </div>

      {harnessFiles.length > 0 ? (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400 mb-2">
            사용된 하네스 파일
          </div>
          <div className="flex flex-wrap gap-1.5">
            {harnessFiles.map((p) => (
              <span
                key={p}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono text-[11.5px] text-gray-700 dark:text-slate-300"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BasisStat({
  label,
  items
}: {
  label: string;
  items: { k: string; v: number | string }[];
}) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-600 dark:text-slate-300 mb-2.5">
        {label}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => (
          <div key={it.k} className="text-center">
            <div className="text-[10px] uppercase tracking-[0.1em] text-gray-500 dark:text-slate-400 mb-0.5 font-semibold">
              {it.k}
            </div>
            <div className="font-display font-bold text-gray-900 dark:text-slate-100 text-lg tabular-nums leading-none">
              {it.v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Split a Korean sentence into a short "head" (title-like) and the rest as detail.
 * Heuristics:
 *   1. If the string contains "—" or " — ", split on it.
 *   2. Otherwise, take content up to the first comma / first period as head.
 *   3. Fallback: whole string as head, no tail.
 */
function splitHead(s: string): { head: string; tail: string } {
  const emdashMatch = s.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  if (emdashMatch) return { head: emdashMatch[1].trim(), tail: emdashMatch[2].trim() };

  const commaIdx = s.indexOf(",");
  if (commaIdx > 0 && commaIdx <= 26) {
    return { head: s.slice(0, commaIdx).trim(), tail: s.slice(commaIdx + 1).trim() };
  }

  const endingMatch = s.match(/^(.{6,40}?[다요])\.\s*(.+)$/);
  if (endingMatch) return { head: endingMatch[1].trim(), tail: endingMatch[2].trim() };

  return { head: s, tail: "" };
}

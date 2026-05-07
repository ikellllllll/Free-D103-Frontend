"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Shield,
  Code2,
  Share2,
  Check,
  AlertTriangle,
  GitBranch,
  type LucideIcon
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { feedbackApi } from "@/lib/api/feedbackApi";
import { useAuthStore } from "@/store/authStore";
import type { ScoreItem } from "@/lib/types/report";

/** Metric card visual config — maps report.scores[i] by index */
const METRIC_CONFIG: {
  key: "harness" | "execution" | "trace";
  icon: LucideIcon;
  /** Solid background for the icon chip */
  iconBg: string;
  /** Progress bar fill */
  barFill: string;
}[] = [
  {
    key: "harness",
    icon: Shield,
    iconBg: "linear-gradient(135deg, #4F46E5, #6366F1)",
    barFill: "linear-gradient(90deg, #4F46E5, #6366F1)"
  },
  {
    key: "execution",
    icon: Code2,
    iconBg: "linear-gradient(135deg, #0D9488, #14B8A6)",
    barFill: "linear-gradient(90deg, #0D9488, #14B8A6)"
  },
  {
    key: "trace",
    icon: Share2,
    iconBg: "linear-gradient(135deg, #7C3AED, #A855F7)",
    barFill: "linear-gradient(90deg, #7C3AED, #A855F7)"
  }
];

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

  const problemTitle = useMemo(() => {
    return report?.problemTitle ?? "풀이 과제";
  }, [report?.problemTitle]);

  const overallScore = useMemo(() => {
    if (!report?.scores?.length) return null;
    const sum = report.scores.reduce((acc, s) => acc + s.score, 0);
    return Math.round(sum / report.scores.length);
  }, [report]);

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <AlertTriangle size={28} className="mx-auto text-amber-500 mb-3" />
        <p className="text-gray-800 font-semibold mb-2">리포트를 찾을 수 없습니다.</p>
        <p className="text-sm text-gray-500 mb-5">제출 처리 화면에서 상태를 다시 확인해 주세요.</p>
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
        <div className="inline-flex items-center space-x-2 text-gray-500">
          <Sparkles size={18} className="animate-pulse" />
          <span>리포트를 생성하는 중…</span>
        </div>
        <div className="mt-5">
          <Link
            href={withPrefix(`/submissions/${submissionId}`)}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
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

  return (
    <div className="relative bg-gradient-to-b from-indigo-50/20 via-white to-white min-h-screen overflow-hidden">
      {/* Background grid */}
      <div className="absolute top-0 left-0 right-0 h-[900px] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-25" />
      </div>

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

            {/* Right — score */}
            <div className="shrink-0 md:text-right">
              <div className="flex items-end justify-start md:justify-end gap-1.5">
                <span className="text-6xl md:text-7xl font-display font-bold leading-none tracking-tight">
                  {overallScore ?? "—"}
                </span>
                <span className="text-2xl md:text-3xl font-display font-semibold text-white/70 mb-1.5">
                  / 100
                </span>
              </div>
              <p className="text-sm text-white/80 font-semibold mt-2 tracking-wide">
                Overall AIG Score
              </p>
            </div>
          </div>
        </section>

        {/* ── THREE METRICS ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {report.scores.slice(0, 3).map((score, i) => (
            <MetricCard
              key={score.label}
              score={score}
              config={METRIC_CONFIG[i] ?? METRIC_CONFIG[0]}
              delay={i * 50}
            />
          ))}
        </section>

        {/* ── STRENGTHS + IMPROVEMENTS ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FeedbackCard
            title="강점"
            tone="good"
            items={report.strengths}
          />
          <FeedbackCard
            title="개선 포인트"
            tone="warn"
            items={report.improvements}
          />
        </section>

        {/* ── SUMMARY (one-liner) ── */}
        {report.summary && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 flex items-start gap-4 animate-slide-up">
            <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles size={16} strokeWidth={2.2} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 mb-1">
                한 줄 요약
              </div>
              <p className="text-[15px] md:text-base text-gray-800 font-medium leading-relaxed">
                {report.summary}
              </p>
            </div>
          </section>
        )}

        {/* ── TRACE TIMELINE CTA ── */}
        <section
          className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up"
        >
          <div className="flex items-center gap-4 min-w-0">
            <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600">
              <GitBranch size={20} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="font-display font-bold text-gray-900 text-[17px]">
                Trace 타임라인
              </div>
              <div className="text-sm text-gray-500 mt-0.5">
                모든 LLM 호출, Tool 실행, 재시도 단계를 한 번에 확인할 수 있어요.
              </div>
            </div>
          </div>
          <Link
            href={withPrefix(`/submissions/${submissionId}/timeline`)}
            className="shrink-0 inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 font-semibold text-sm transition-colors"
          >
            <span>타임라인 보기</span>
            <ArrowRight size={14} strokeWidth={2.4} />
          </Link>
        </section>

        {/* ── FOOTER ACTION ROW ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4">
          <Link
            href={withPrefix("/problems")}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
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

/* ─── MetricCard ─── */

function MetricCard({
  score,
  config,
  delay
}: {
  score: ScoreItem;
  config: (typeof METRIC_CONFIG)[number];
  delay: number;
}) {
  const Icon = config.icon;
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {/* Top row: icon + label */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-white shadow-sm"
          style={{ backgroundImage: config.iconBg }}
        >
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
          {score.label}
        </span>
      </div>

      {/* Score */}
      <div className="flex items-baseline gap-1.5 mb-4">
        <span className="text-5xl font-display font-bold text-gray-900 leading-none tracking-tight tabular-nums">
          {score.score}
        </span>
        <span className="text-xl font-display font-semibold text-gray-400">/ 100</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, score.score))}%`,
            backgroundImage: config.barFill
          }}
        />
      </div>

      {/* Insight */}
      <p className="text-sm text-gray-600 leading-relaxed">{score.note}</p>
    </div>
  );
}

/* ─── FeedbackCard (Strengths / Improvements) ─── */

function FeedbackCard({
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 animate-slide-up">
      {/* Header */}
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
        <h2 className="font-display font-bold text-gray-900 text-[17px]">{title}</h2>
      </div>

      {/* Items */}
      <ul className="space-y-3.5">
        {items.map((item, i) => {
          const { head, tail } = splitHead(item);
          return (
            <li key={`${title}-${i}`} className="flex items-start gap-3">
              <span
                className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isGood
                    ? "bg-green-100 text-green-600"
                    : "bg-amber-100 text-amber-600"
                }`}
              >
                {isGood ? (
                  <Check size={11} strokeWidth={3} />
                ) : (
                  <AlertTriangle size={10} strokeWidth={2.6} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 leading-snug">
                  {head}
                </div>
                {tail && (
                  <div className="text-sm text-gray-500 leading-relaxed mt-0.5">
                    {tail}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
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

  // Split on first comma (limited to ~24 chars for a clean head)
  const commaIdx = s.indexOf(",");
  if (commaIdx > 0 && commaIdx <= 26) {
    return { head: s.slice(0, commaIdx).trim(), tail: s.slice(commaIdx + 1).trim() };
  }

  // Split on first sentence ending ". " or "다. "
  const endingMatch = s.match(/^(.{6,40}?[다요])\.\s*(.+)$/);
  if (endingMatch) return { head: endingMatch[1].trim(), tail: endingMatch[2].trim() };

  return { head: s, tail: "" };
}

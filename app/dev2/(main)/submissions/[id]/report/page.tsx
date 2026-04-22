"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Sparkles,
  TrendingUp
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";

const TONE_COLORS = {
  good: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", bar: "bg-green-500" },
  mid: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", bar: "bg-indigo-500" },
  warn: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", bar: "bg-amber-500" }
} as const;

export default function Dev2FeedbackReportPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: submissionId } = use(params);
  const { withPrefix } = useRouteScope();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", submissionId],
    queryFn: () => mockApi.getReport(submissionId),
    refetchInterval: (q) => (q.state.data?.status === "COMPLETED" ? false : 1500)
  });

  if (isLoading || !report || report.status !== "COMPLETED") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center space-x-2 text-gray-500">
          <Sparkles size={18} className="animate-pulse" />
          <span>리포트를 생성하는 중…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 bg-gradient-animate rounded-3xl p-8 md:p-10 text-white relative overflow-hidden animate-slide-up">
          <div className="absolute inset-0 bg-gradient-radial from-white/20 to-transparent opacity-30" />
          <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-white/10 blur-3xl animate-blob-1" />
          <div className="absolute bottom-10 left-20 w-48 h-48 rounded-full bg-purple-300/20 blur-3xl animate-blob-2" />
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold mb-3">
                <Sparkles size={12} strokeWidth={2.4} />
                <span>제출 #{submissionId}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-2">
                피드백 리포트
              </h1>
              <p className="text-indigo-100 max-w-xl">
                테스트 결과와 AI 활용 흐름을 함께 정리했습니다. 무엇을 잘했고 무엇을 보완할지 한눈에 확인하세요.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={withPrefix(`/submissions/${submissionId}/timeline`)}
                className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-sm hover:bg-white/25 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Clock size={14} />
                <span>타임라인</span>
              </Link>
              <Link
                href={withPrefix("/problems")}
                className="inline-flex items-center space-x-2 bg-white text-indigo-700 hover:bg-indigo-50 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <BookOpen size={14} />
                <span>과제 목록</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Test + AI scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-slide-up" style={{ animationFillMode: "both" }}>
            <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-3">
              <CheckCircle2 size={14} />
              <span>테스트 결과</span>
            </div>
            <strong className="block text-2xl font-display font-bold text-gray-900 mb-4">
              {report.testSummary}
            </strong>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                style={{ width: `${report.testPassRate}%` }}
              />
            </div>
            <small className="text-sm text-gray-500">
              {report.testPassRate}% · 공개/숨김 테스트 종합
            </small>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-slide-up" style={{ animationFillMode: "both" }}>
            <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-3">
              <TrendingUp size={14} />
              <span>AI 활용 분석</span>
            </div>
            <div className="space-y-4">
              {report.scores.map((score) => {
                const tone = TONE_COLORS[score.tone];
                return (
                  <div key={score.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{score.label}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tone.bg} ${tone.text} ${tone.border}`}
                      >
                        {score.score}점
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full ${tone.bar}`}
                        style={{ width: `${score.score}%` }}
                      />
                    </div>
                    <small className="text-xs text-gray-500">{score.note}</small>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Strengths + Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-slide-up" style={{ animationFillMode: "both" }}>
            <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-green-600 mb-3">
              <CheckCircle2 size={14} />
              <span>강점</span>
            </div>
            <h2 className="text-lg font-display font-bold text-gray-900 mb-4">잘한 점</h2>
            <ul className="space-y-3">
              {report.strengths.map((item) => (
                <li key={item} className="flex items-start space-x-2 text-sm text-gray-700 leading-relaxed">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-green-500 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-slide-up" style={{ animationFillMode: "both" }}>
            <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-amber-600 mb-3">
              <AlertCircle size={14} />
              <span>보완 포인트</span>
            </div>
            <h2 className="text-lg font-display font-bold text-gray-900 mb-4">개선 포인트</h2>
            <ul className="space-y-3">
              {report.improvements.map((item) => (
                <li key={item} className="flex items-start space-x-2 text-sm text-gray-700 leading-relaxed">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 bg-gradient-animate rounded-2xl border border-indigo-100 p-6 md:p-8 animate-slide-up" style={{ animationFillMode: "both" }}>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-700 mb-2">
            <FileText size={14} />
            <span>한 줄 요약</span>
          </div>
          <p className="text-base md:text-lg text-gray-900 font-medium leading-relaxed">
            {report.summary}
          </p>
        </div>

        {/* Timeline preview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
                <Clock size={14} />
                <span>타임라인 미리보기</span>
              </div>
              <h2 className="text-lg font-display font-bold text-gray-900">최근 풀이 흐름</h2>
            </div>
            <Link
              href={withPrefix(`/submissions/${submissionId}/timeline`)}
              className="inline-flex items-center space-x-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <span>전체 보기</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {report.timeline.map((event) => (
              <div
                key={event.id}
                className="flex items-start space-x-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <span className="shrink-0 text-xs font-mono text-indigo-600 font-semibold min-w-[50px]">
                  {event.time}
                </span>
                <div className="flex-1 min-w-0">
                  <strong className="block text-sm text-gray-900 mb-0.5">{event.type}</strong>
                  <span className="block text-sm text-gray-600 mb-1">{event.summary}</span>
                  <small className="block text-xs text-gray-400">{event.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { use, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Sparkles, FileText, BookOpen } from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";

type StepState = "done" | "current" | "pending";

export default function Dev2SubmissionProgressPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: submissionId } = use(params);
  const router = useRouter();
  const { withPrefix } = useRouteScope();

  const { data: submission, isLoading, isError } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => mockApi.getSubmission(submissionId),
    refetchInterval: (q) => (q.state.data?.status === "COMPLETED" ? false : 1200)
  });
  const { data: report } = useQuery({
    queryKey: ["report", submissionId],
    queryFn: () => mockApi.getReport(submissionId),
    refetchInterval: (q) => (q.state.data?.status === "COMPLETED" ? false : 1200)
  });

  const steps = useMemo(() => {
    const completed = submission?.status === "COMPLETED";
    const reportCompleted = report?.status === "COMPLETED";
    return [
      {
        label: "코드 채점 중",
        description: "테스트 케이스를 실행하고 제출물을 검증하고 있습니다.",
        state: (completed || reportCompleted ? "done" : "current") as StepState
      },
      {
        label: "코드 리뷰 분석 중",
        description: "설계 일관성, 예외 처리, 구현 완성도를 점검하고 있습니다.",
        state: (reportCompleted ? "done" : completed ? "current" : "pending") as StepState
      },
      {
        label: "AI 활용 분석 중",
        description: "Trace를 바탕으로 프롬프트 명확성과 자기 주도성을 종합하고 있습니다.",
        state: (reportCompleted ? "done" : completed ? "current" : "pending") as StepState
      }
    ];
  }, [report?.status, submission?.status]);

  const overallDone = report?.status === "COMPLETED";
  const doneCount = steps.filter((s) => s.state === "done").length;

  useEffect(() => {
    if (!overallDone) return;
    const timer = window.setTimeout(() => {
      router.replace(withPrefix(`/submissions/${submissionId}/report`));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [overallDone, router, submissionId, withPrefix]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center space-x-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          <span>제출 상태를 확인하는 중…</span>
        </div>
      </div>
    );
  }

  if (isError || !submission) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-700 font-semibold mb-3">제출 정보를 불러올 수 없습니다.</p>
        <Link href={withPrefix("/problems")} className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
          <BookOpen size={14} />
          <span>과제 목록</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[500px] pointer-events-none overflow-hidden">
        <div className="orbit-blob w-96 h-96 bg-indigo-300/30 top-[-60px] left-[20%] animate-blob-1" />
        <div className="orbit-blob w-72 h-72 bg-purple-300/30 top-[-40px] right-[15%] animate-blob-2" />
      </div>
      <div className="relative max-w-2xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-10 animate-scale-in">
          <div className="mb-8">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
              <Sparkles size={12} strokeWidth={2.4} />
              <span>제출 진행 · #{submission.id}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
              제출물을 분석하고 있습니다
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              테스트 채점, 코드 리뷰, AI 활용 분석 단계를 순차적으로 처리하고 있습니다.
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">
                {overallDone ? "분석 완료" : "분석 진행 중"}
              </span>
              <span className="text-sm font-bold text-indigo-600">
                {doneCount} / {steps.length} 단계
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-5 mb-8">
            {steps.map((step, i) => (
              <div key={step.label} className="flex space-x-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                      step.state === "done"
                        ? "bg-indigo-600 text-white"
                        : step.state === "current"
                          ? "bg-indigo-100 text-indigo-700 ring-4 ring-indigo-50"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {step.state === "done" ? (
                      <Check size={14} strokeWidth={3} />
                    ) : step.state === "current" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-0.5 h-10 mt-1 ${
                        step.state === "done" ? "bg-indigo-200" : "bg-gray-100"
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <strong
                    className={`block text-sm mb-1 ${
                      step.state === "pending" ? "text-gray-400" : "text-gray-900"
                    }`}
                  >
                    {step.label}
                  </strong>
                  <p
                    className={`text-xs leading-relaxed ${
                      step.state === "pending" ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-0.5">제출 상태</div>
              <div className="text-sm font-semibold text-gray-900">
                {submission.status === "COMPLETED" ? "완료" : "처리 중"}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-0.5">제출 시간</div>
              <div className="text-sm font-semibold text-gray-900">
                {new Date(submission.submittedAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-0.5">리포트</div>
              <div className="text-sm font-semibold text-gray-900">
                {report?.status === "COMPLETED" ? "완료" : "생성 중"}
              </div>
            </div>
          </div>

          {overallDone && (
            <p className="text-center text-xs text-gray-400 mb-4">
              분석이 완료되었습니다. 잠시 후 리포트 페이지로 이동합니다…
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={withPrefix("/problems")}
              className="flex-1 inline-flex items-center justify-center space-x-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              <BookOpen size={14} />
              <span>과제 목록</span>
            </Link>
            <Link
              href={withPrefix(`/submissions/${submissionId}/report`)}
              className="flex-1 inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              <FileText size={14} />
              <span>리포트 보기</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

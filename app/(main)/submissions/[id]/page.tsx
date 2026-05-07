"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Sparkles,
  BookOpen,
  FileSearch,
  Zap,
  FileText,
  Upload
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { feedbackApi } from "@/lib/api/feedbackApi";
import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";

type StepState = "done" | "running" | "pending";

type Step = {
  key: string;
  icon: typeof Check;
  title: string;
  description: string;
  state: StepState;
  /** human-readable elapsed/status suffix on the right */
  suffix: string;
  /** optional live sub-log shown under the row when running */
  subLog?: string;
};

export default function SubmissionProgressPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: submissionId } = use(params);
  const router = useRouter();
  const { withPrefix } = useRouteScope();

  // backend executionId (numeric) 면 신규 endpoint 폴링, 아니면 mock fallback
  const isBackendExecution = isBackendSessionId(submissionId);
  const { data: submission, isLoading, isError } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () =>
      isBackendExecution
        ? sessionApi.getSubmissionResult(submissionId)
        : mockApi.getSubmission(submissionId),
    refetchInterval: (q) => (q.state.data?.status === "COMPLETED" ? false : 1000)
  });
  const { data: report } = useQuery({
    queryKey: ["report", submissionId],
    queryFn: () => feedbackApi.getFeedbackReport(submissionId),
    refetchInterval: (q) => (q.state.data?.status === "COMPLETED" ? false : 1000)
  });

  const submittedAtMs = submission
    ? new Date(submission.submittedAt).getTime()
    : Date.now();
  const submissionCompleted = submission?.status === "COMPLETED";
  const reportCompleted = report?.status === "COMPLETED";
  const overallDone = reportCompleted;

  // Live clock for running-stage elapsed display
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (overallDone) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [overallDone]);

  // Fake cycling sub-log for "Test harness execution"
  const subLogs = useMemo(
    () => [
      "→ GET /api/me · 200 OK · 42ms",
      "→ POST /api/auth/login · 200 OK · 78ms",
      "→ POST /api/auth/refresh · 200 OK · 56ms",
      "→ GET /api/todos · 200 OK · 31ms",
      "→ PATCH /api/todos/3 · 200 OK · 44ms"
    ],
    []
  );
  const subLogIndex = Math.floor(now / 1400) % subLogs.length;

  const steps: Step[] = useMemo(() => {
    // Overall elapsed in seconds since submission arrived
    const elapsedMs = Math.max(0, now - submittedAtMs);
    // Fake: stage 1 finishes at ~0.3s, stage 2 at ~2.1s total.
    const stage3RunningMs = Math.max(0, elapsedMs - 2100);
    const stage3RunningSec = (stage3RunningMs / 1000).toFixed(1);

    const states: [StepState, StepState, StepState, StepState] = reportCompleted
      ? ["done", "done", "done", "done"]
      : submissionCompleted
        ? ["done", "done", "done", "running"]
        : elapsedMs < 300
          ? ["running", "pending", "pending", "pending"]
          : elapsedMs < 2100
            ? ["done", "running", "pending", "pending"]
            : ["done", "done", "running", "pending"];

    return [
      {
        key: "upload",
        icon: Upload,
        title: "코드 업로드",
        description: "소스 파일과 메타데이터를 성공적으로 받았습니다.",
        state: states[0],
        suffix: states[0] === "done" ? "완료 · 0.3초" : "대기 중"
      },
      {
        key: "static",
        icon: FileSearch,
        title: "정적 분석",
        description: "Lint · 구조 검사 · 품질 시그널을 수집했습니다.",
        state: states[1],
        suffix:
          states[1] === "done"
            ? "완료 · 1.8초"
            : states[1] === "running"
              ? "진행 중"
              : "대기"
      },
      {
        key: "harness",
        icon: Zap,
        title: "테스트 하네스 실행",
        description: "샌드박스에서 공개·비공개 테스트 시나리오를 실행합니다.",
        state: states[2],
        suffix:
          states[2] === "done"
            ? `완료 · ${stage3RunningSec.replace(/\.0$/, "")}초`
            : states[2] === "running"
              ? `진행 중 · ${stage3RunningSec}초 경과`
              : "대기",
        subLog: states[2] === "running" ? subLogs[subLogIndex] : undefined
      },
      {
        key: "report",
        icon: FileText,
        title: "리포트 생성",
        description: "테스트·Trace 인사이트를 모아 피드백 리포트를 구성합니다.",
        state: states[3],
        suffix:
          states[3] === "done"
            ? "완료"
            : states[3] === "running"
              ? "진행 중"
              : "대기"
      }
    ];
  }, [reportCompleted, submissionCompleted, submittedAtMs, now, subLogs, subLogIndex]);

  // Auto-redirect to report when everything is done
  useEffect(() => {
    if (!overallDone) return;
    const timer = window.setTimeout(() => {
      router.replace(withPrefix(`/submissions/${submissionId}/report`));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [overallDone, router, submissionId, withPrefix]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center space-x-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          <span>제출 상태를 확인하는 중…</span>
        </div>
      </div>
    );
  }

  if (isError || !submission) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <p className="text-gray-700 font-semibold mb-3">제출 정보를 불러올 수 없습니다.</p>
        <Link
          href={withPrefix("/problems")}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          <BookOpen size={14} />
          <span>과제 목록</span>
        </Link>
      </div>
    );
  }

  const shortId = submission.id.replace(/^submission-/, "").slice(0, 6);

  return (
    <div className="relative bg-gradient-to-b from-indigo-50/40 via-white to-white min-h-screen overflow-hidden">
      {/* Background grid */}
      <div className="absolute top-0 left-0 right-0 h-[700px] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-20">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 md:p-12 animate-scale-in">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-5">
              <Sparkles size={12} strokeWidth={2.4} />
              <span>
                제출 #{shortId} ·{" "}
                <span className="text-indigo-600">
                  {overallDone ? "완료" : "분석 중"}
                </span>
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 tracking-tight mb-3 leading-[1.15]">
              {overallDone ? "리포트가 준비됐어요" : "제출물을 분석 중입니다"}
            </h1>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-xl mx-auto">
              AIG 에이전트가 <strong className="text-gray-700 font-semibold">코드 품질</strong>,{" "}
              <strong className="text-gray-700 font-semibold">테스트 통과율</strong>,{" "}
              <strong className="text-gray-700 font-semibold">Trace 활용도</strong>를 평가 중이에요.
              <br />
              보통 30–60초 정도 걸려요.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {steps.map((step, i) => {
              const isLast = i === steps.length - 1;
              const nextState = steps[i + 1]?.state;
              return (
                <StepRow
                  key={step.key}
                  step={step}
                  nextState={nextState}
                  isLast={isLast}
                />
              );
            })}
          </div>

          {/* Bottom hint */}
          <p className="text-center text-xs italic text-gray-400 mt-8">
            {overallDone
              ? "잠시 후 리포트 페이지로 이동합니다…"
              : "이 탭을 닫아도 괜찮아요. 완료되면 알려드릴게요."}
          </p>

          {/* Actions (always visible, subtle) */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-100">
            <Link
              href={withPrefix("/problems")}
              className="flex-1 inline-flex items-center justify-center space-x-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              <BookOpen size={14} />
              <span>과제 목록으로</span>
            </Link>
            {overallDone ? (
              <Link
                href={withPrefix(`/submissions/${submissionId}/report`)}
                className="flex-1 inline-flex items-center justify-center space-x-2 text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
                style={{
                  backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                  boxShadow: "0 10px 24px -12px rgba(99, 102, 241, 0.5)"
                }}
              >
                <FileText size={14} strokeWidth={2.4} />
                <span>리포트 보기</span>
              </Link>
            ) : (
              <div className="flex-1 inline-flex items-center justify-center space-x-2 bg-gray-50 text-gray-400 font-medium py-2.5 rounded-xl text-sm cursor-not-allowed">
                <Loader2 size={14} className="animate-spin" />
                <span>리포트 준비 중…</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Subcomponents ─── */

function StepRow({
  step,
  nextState,
  isLast
}: {
  step: Step;
  nextState?: StepState;
  isLast: boolean;
}) {
  return (
    <div className={`relative ${!isLast ? "pb-6" : ""}`}>
      {/* Connecting vertical line from this row's circle to next row's circle */}
      {!isLast && (
        <span
          className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${connectorColor(step.state, nextState)}`}
          aria-hidden
        />
      )}

      <div className="flex items-start gap-4">
        {/* Status circle */}
        <StatusCircle state={step.state} />

        {/* Content */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div
                className={`font-display font-bold text-[16px] ${
                  step.state === "pending" ? "text-gray-400" : "text-gray-900"
                }`}
              >
                {step.title}
              </div>
              <div
                className={`text-sm mt-0.5 leading-relaxed ${
                  step.state === "pending" ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {step.description}
              </div>
            </div>
            <div
              className={`shrink-0 text-sm font-semibold tabular-nums ${statusTextColor(step.state)}`}
            >
              {step.suffix}
            </div>
          </div>

          {/* Sub-log for running stage */}
          {step.subLog && (
            <div className="mt-3 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono text-gray-600 truncate">
              {step.subLog}
            </div>
          )}
        </div>
      </div>

      {/* Divider under row (except last) */}
      {!isLast && (
        <div className="absolute left-12 right-0 bottom-0 h-px bg-gray-100" aria-hidden />
      )}
    </div>
  );
}

function StatusCircle({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="shrink-0 w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm">
        <Check size={18} strokeWidth={3} />
      </span>
    );
  }
  if (state === "running") {
    return (
      <span className="shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-500/30 ring-4 ring-indigo-100">
        <Loader2 size={18} className="animate-spin" strokeWidth={2.4} />
      </span>
    );
  }
  return (
    <span className="shrink-0 w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
      <span className="w-2 h-2 rounded-full bg-gray-200" />
    </span>
  );
}

function connectorColor(state: StepState, next?: StepState): string {
  // Done → anything: green
  if (state === "done") return "bg-green-500/70";
  // Running: indigo fade to gray (use indigo for top half, but we only have one line; use indigo)
  if (state === "running") return "bg-indigo-300";
  return "bg-gray-200";
}

function statusTextColor(state: StepState): string {
  if (state === "done") return "text-green-600";
  if (state === "running") return "text-indigo-600";
  return "text-gray-400";
}

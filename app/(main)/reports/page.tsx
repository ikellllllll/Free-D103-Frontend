"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Sparkles, AlertTriangle, RefreshCcw, CheckCircle2, Loader2 } from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { authApi } from "@/lib/api/authApi";
import { sessionApi } from "@/lib/api/sessionApi";
import {
  loadPendingMarkers,
  savePendingMarkers,
  type PendingReportMarker
} from "@/lib/reports/pendingMarkers";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

/**
 * 리포트 페이지 — 마이페이지에서 분리한 별도 페이지.
 *
 * 표시 흐름:
 *  1. GET /users/me/reports — 완료된 리포트 (GENERATED) 목록
 *  2. localStorage 의 pending-reports — endSession 직후 박아두는 임시 마커
 *     (백엔드가 PENDING/PROCEEDING/FAILED 리포트도 같이 응답할 때까지의 우회)
 *  3. 두 list 를 union 해서 표시:
 *     · GENERATED: 점수/통과 + "상세 보기"
 *     · PENDING/PROCEEDING: 스피너 + "생성 중..."
 *     · FAILED: 경고 + "재시도" 버튼 (백엔드 retry endpoint 도착 시 활성)
 *
 * 폴링: localStorage 에 PENDING/PROCEEDING 마커 있으면 3초 polling — 새 리포트가 reports 응답에 들어오는지.
 */

export default function ReportsPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [pendingMarkers, setPendingMarkers] = useState<PendingReportMarker[]>([]);

  // 마운트 시 localStorage 의 pending 마커 hydrate.
  useEffect(() => {
    setPendingMarkers(loadPendingMarkers());
  }, []);

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ["userReports", user?.id, page],
    queryFn: async () => {
      try {
        return await authApi.getUserReports(page, PAGE_SIZE);
      } catch {
        return null;
      }
    },
    enabled: !!user,
    // pending 마커가 있으면 3초 폴링 — 백엔드가 GENERATED 로 전이하면 list 에 나타남.
    refetchInterval: () => (pendingMarkers.length > 0 ? 3000 : false)
  });

  // 백엔드 reports 응답에 들어온 problemSessionId 는 pending 마커에서 제거 (이미 GENERATED 됨).
  // UserReportItem 에 problemSessionId 가 없어서 — feedbackReportId 로 매핑하는 건 불가.
  // 대신 createdAt 시점 기반으로 추정: pending 마커보다 createdAt 이 늦은 리포트가 있으면 그 마커 제거.
  useEffect(() => {
    if (!reportsData || pendingMarkers.length === 0) return;
    const latestReportTime = reportsData.reports[0]
      ? new Date(reportsData.reports[0].createdAt).getTime()
      : 0;
    const remaining = pendingMarkers.filter((m) => {
      const startedTime = new Date(m.startedAt).getTime();
      // 5분 넘게 PENDING/PROCEEDING 이면 FAILED 로 자동 전환 (백엔드 evaluator timeout 보다 길게)
      if (m.status !== "FAILED" && Date.now() - startedTime > 5 * 60_000) {
        return { ...m, status: "FAILED" as const };
      }
      // 새 리포트가 마커 이후 시간에 생긴 거면 그 마커는 GENERATED 됐다고 판단 → 제거
      return latestReportTime <= startedTime;
    });
    if (remaining.length !== pendingMarkers.length) {
      setPendingMarkers(remaining);
      savePendingMarkers(remaining);
    }
  }, [reportsData, pendingMarkers]);

  const handleRetry = async (marker: PendingReportMarker) => {
    // 백엔드 retry endpoint 가 아직 없어 임시로 endSession 다시 호출 (POST /sessions/{id}/end).
    // 백엔드가 reportStatus FAILED 면 endSession 이 evaluator 재트리거하는지 정책 확인 필요.
    try {
      await sessionApi.endSession(String(marker.problemSessionId));
      addToast("리포트 생성을 다시 요청했어요.", "success");
      const next = pendingMarkers.map((m) =>
        m.problemSessionId === marker.problemSessionId
          ? { ...m, status: "PENDING" as const, startedAt: new Date().toISOString() }
          : m
      );
      setPendingMarkers(next);
      savePendingMarkers(next);
      queryClient.invalidateQueries({ queryKey: ["userReports", user?.id] });
    } catch (e) {
      addToast(e instanceof Error ? e.message : "재시도 실패", "error");
    }
  };

  const completed = reportsData?.reports ?? [];
  const hasAny = pendingMarkers.length > 0 || completed.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-6 pt-28 pb-20">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <FileText size={20} strokeWidth={2.2} />
          </span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">리포트</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          내가 푼 문제의 AI 분석 리포트를 한곳에서 확인하세요.
        </p>
      </header>

      {/* Pending 섹션 */}
      {pendingMarkers.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
            생성 중인 리포트 ({pendingMarkers.length})
          </h2>
          <ul className="space-y-2">
            {pendingMarkers.map((m) => (
              <li
                key={m.problemSessionId}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {m.problemTitle ? (
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200 truncate">
                        {m.problemTitle}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-slate-400">풀이</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                    {new Date(m.startedAt).toLocaleString("ko-KR")}
                  </div>
                </div>
                {m.status === "FAILED" ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400">
                      <AlertTriangle size={11} strokeWidth={2.4} />
                      <span>생성 실패</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRetry(m)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                    >
                      <RefreshCcw size={11} strokeWidth={2.4} />
                      <span>재시도</span>
                    </button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400">
                    <Loader2 size={11} strokeWidth={2.4} className="animate-spin" />
                    <span>생성 중…</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Completed 섹션 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
          내 리포트 ({reportsData?.totalCount ?? 0})
        </h2>
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-10 text-center">
            <div className="text-sm text-gray-400 dark:text-slate-500">불러오는 중...</div>
          </div>
        ) : completed.length === 0 && pendingMarkers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 shadow-sm p-10 text-center">
            <Sparkles size={28} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-slate-400">아직 제출 후 생성된 리포트가 없어요.</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">문제를 풀고 세션을 종료하면 여기에 누적돼요.</p>
          </div>
        ) : completed.length === 0 ? null : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {completed.map((report) => {
                const passRate = report.totalCount > 0
                  ? Math.round((report.passedCount / report.totalCount) * 100)
                  : 0;
                const scoreColor =
                  passRate >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                  passRate >= 60 ? "text-indigo-600 dark:text-indigo-400" :
                  "text-rose-600 dark:text-rose-400";
                const overall = typeof report.overallScore === "string"
                  ? parseFloat(report.overallScore)
                  : report.overallScore;
                return (
                  <li key={report.feedbackReportId}>
                    <Link
                      href={withPrefix(`/submissions/${report.feedbackReportId}/report`)}
                      className="group block px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" strokeWidth={2.2} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400 dark:text-slate-500 shrink-0">
                              #{report.problemId}
                            </span>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {report.problemTitle}
                            </h4>
                          </div>
                          <div className="text-xs text-gray-400 dark:text-slate-500">
                            {new Date(report.createdAt).toLocaleString("ko-KR")}
                            <span className="mx-2">·</span>
                            <span className={scoreColor}>{report.passedCount}/{report.totalCount} 통과 ({passRate}%)</span>
                          </div>
                        </div>
                        <div className={`text-right shrink-0 ${scoreColor}`}>
                          <div className="text-xl font-bold tabular-nums">
                            {overall != null && Number.isFinite(overall) ? overall.toFixed(1) : "-"}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">score</div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {(reportsData?.totalPages ?? 1) > 1 ? (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  이전
                </button>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {page} / {reportsData?.totalPages ?? 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(reportsData?.totalPages ?? 1, p + 1))}
                  disabled={!reportsData?.hasNext}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  다음
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {!hasAny ? null : (
        <p className="mt-6 text-[11px] text-gray-400 dark:text-slate-500 text-center">
          생성이 완료되면 자동으로 완료된 리포트 목록에 표시됩니다.
        </p>
      )}
    </div>
  );
}

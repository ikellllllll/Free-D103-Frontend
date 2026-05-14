"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Sparkles, AlertTriangle, RefreshCcw, Loader2, ChevronRight } from "lucide-react";

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
 *  3. 두 list 를 union 해서 표시:
 *     · GENERATED: 점수/통과 + "상세 보기"
 *     · PENDING/PROCEEDING: 스피너 + "생성 중..."
 *     · FAILED: 경고 + "재시도" 버튼
 *
 * 폴링:
 *  - reports list: pending 마커가 살아있는 동안만 3초 간격 refetch.
 *  - 각 pending 마커별로 GET /api/v1/sessions/{id}/report-status 도 함께 호출해서
 *    실제 백엔드 상태를 즉시 반영 — GENERATED 면 마커 제거, FAILED 면 즉시 표기.
 *    엔드포인트 호출 실패 시에만 5분 클라이언트 timeout 으로 FAILED 추정 (fallback).
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
    // PENDING/PROCEEDING 마커만 폴링. FAILED 는 사용자가 [재시도] 누를 때까지 idle.
    // 이전엔 `pendingMarkers.length > 0` 라 FAILED 도 영원히 3초 폴링 돌리던 버그가 있었음.
    refetchInterval: () => (pendingMarkers.some((m) => m.status !== "FAILED") ? 3000 : false)
  });

  // 매 폴링 tick (reportsData 갱신 시) 마다 각 pending 마커의 실제 백엔드 상태를 조회해 반영.
  //
  // 우선순위:
  //   (1) report-status 응답이 GENERATED → 마커 제거 + userReports 즉시 invalidate
  //       (백엔드 list 응답에 새 리포트가 아직 안 들어왔어도 다음 refetch 에서 잡힘).
  //   (2) 응답이 FAILED → 마커 status=FAILED 로 갱신 (5분 timeout 안 기다리고 바로).
  //   (3) 응답이 PENDING/PROCEEDING → 그대로 둠 (status 만 갱신).
  //   (4) 응답이 null/throw (네트워크/권한 등) → 기존 fallback 작동: 5분 timeout → FAILED.
  //
  // 동시성: pendingMarkers 가 효과 도중 다른 origin (handleRetry / 마운트 hydrate) 으로
  // 바뀌면 setPendingMarkers 호출이 stale 한 변경을 덮어쓸 수 있으므로 cancelled 가드.
  useEffect(() => {
    if (pendingMarkers.length === 0) return;
    let cancelled = false;
    void (async () => {
      const statuses = await Promise.all(
        pendingMarkers.map(async (m) => {
          try {
            const status = await sessionApi.getReportStatus(m.problemSessionId);
            return { id: m.problemSessionId, status };
          } catch {
            return { id: m.problemSessionId, status: null as null };
          }
        })
      );
      if (cancelled) return;

      const statusMap = new Map(statuses.map((s) => [s.id, s.status]));
      let generatedFound = false;
      const next: PendingReportMarker[] = [];
      for (const m of pendingMarkers) {
        const fetched = statusMap.get(m.problemSessionId);
        if (fetched === "GENERATED") {
          generatedFound = true;
          continue; // 마커 제거.
        }
        if (fetched === "FAILED") {
          next.push({ ...m, status: "FAILED" });
          continue;
        }
        if (fetched === "PENDING" || fetched === "PROCEEDING") {
          next.push({ ...m, status: fetched });
          continue;
        }
        // fetched === null (endpoint 호출 실패) → 5분 timeout fallback.
        const startedTime = new Date(m.startedAt).getTime();
        if (m.status !== "FAILED" && Date.now() - startedTime > 5 * 60_000) {
          next.push({ ...m, status: "FAILED" });
        } else {
          next.push(m);
        }
      }
      const changed =
        next.length !== pendingMarkers.length ||
        next.some((m, idx) => m.status !== pendingMarkers[idx]?.status);
      if (changed) {
        setPendingMarkers(next);
        savePendingMarkers(next);
      }
      if (generatedFound) {
        queryClient.invalidateQueries({ queryKey: ["userReports", user?.id] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportsData, pendingMarkers, queryClient, user?.id]);

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
    <div className="min-h-screen bg-[#EEF2FF]">
    <div className="max-w-5xl mx-auto px-6 pt-28 pb-20">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <FileText size={20} strokeWidth={2.2} />
          </span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">리포트</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 ml-[52px]">
          내가 푼 문제의 AI 분석 리포트를 한곳에서 확인하세요.
        </p>
      </header>

      {/* Pending 섹션 */}
      {pendingMarkers.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-3 uppercase tracking-[0.14em]">
            생성 중 · {pendingMarkers.length}
          </h2>
          <ul className="list-none space-y-2">
            {pendingMarkers.map((m) => (
              <li
                key={m.problemSessionId}
                className="bg-white dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-700/70 shadow-sm px-5 py-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                    {m.problemTitle ?? "풀이"}
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
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                    >
                      <RefreshCcw size={11} strokeWidth={2.4} />
                      <span>재시도</span>
                    </button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400">
                    <Loader2 size={11} strokeWidth={2.4} className="animate-spin" />
                    <span>생성 중</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Completed 섹션 */}
      <section>
        <h2 className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-3 uppercase tracking-[0.14em]">
          내 리포트 · {reportsData?.totalCount ?? 0}
        </h2>
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-700/70 shadow-sm p-10 text-center">
            <div className="text-sm text-gray-400 dark:text-slate-500">불러오는 중...</div>
          </div>
        ) : completed.length === 0 && pendingMarkers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-dashed border-gray-200 dark:border-slate-700/70 shadow-sm p-12 text-center">
            <Sparkles size={28} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">아직 제출한 리포트가 없어요</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">문제를 풀고 세션을 종료하면 여기에 쌓입니다.</p>
          </div>
        ) : completed.length === 0 ? null : (
          <ul className="list-none space-y-2.5">
            {completed.map((report) => {
              const passRate = report.totalCount > 0
                ? Math.round((report.passedCount / report.totalCount) * 100)
                : 0;
              const overall = typeof report.overallScore === "string"
                ? parseFloat(report.overallScore)
                : report.overallScore;
              const tone =
                passRate >= 80 ? {
                  stripe: "bg-emerald-500",
                  score: "text-emerald-600 dark:text-emerald-400",
                  chip: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60"
                } :
                passRate >= 60 ? {
                  stripe: "bg-indigo-500",
                  score: "text-indigo-600 dark:text-indigo-400",
                  chip: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800/60"
                } :
                {
                  stripe: "bg-rose-500",
                  score: "text-rose-600 dark:text-rose-400",
                  chip: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60"
                };
              return (
                <li key={report.feedbackReportId}>
                  <Link
                    href={withPrefix(`/submissions/${report.feedbackReportId}/report`)}
                    className="group relative flex items-stretch overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 transition-all hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-[0_4px_18px_-6px_rgba(99,102,241,0.25)] dark:hover:shadow-[0_4px_18px_-6px_rgba(99,102,241,0.4)]"
                  >
                    {/* 점수 컬러 좌측 스트라이프 */}
                    <span className={`${tone.stripe} w-1 shrink-0`} aria-hidden="true" />

                    {/* 점수 박스 */}
                    <div className="flex items-center justify-center px-5 py-4 shrink-0 min-w-[88px] border-r border-gray-100 dark:border-slate-800">
                      <div className="text-center">
                        <div className={`font-display font-black text-[26px] leading-none tabular-nums ${tone.score}`}>
                          {overall != null && Number.isFinite(overall) ? overall.toFixed(1) : "-"}
                        </div>
                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">score</div>
                      </div>
                    </div>

                    {/* 본문 */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 shrink-0">#{report.problemId}</span>
                          <h4 className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                            {report.problemTitle}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tone.chip}`}>
                            {report.passedCount}/{report.totalCount} 통과 · {passRate}%
                          </span>
                          <span className="text-xs text-gray-400 dark:text-slate-500">
                            {new Date(report.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        size={18}
                        className="shrink-0 text-gray-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"
                        strokeWidth={2.2}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {(reportsData?.totalPages ?? 1) > 1 && completed.length > 0 ? (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              이전
            </button>
            <span className="text-xs text-gray-500 dark:text-slate-400 tabular-nums">
              {page} / {reportsData?.totalPages ?? 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(reportsData?.totalPages ?? 1, p + 1))}
              disabled={!reportsData?.hasNext}
              className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              다음
            </button>
          </div>
        ) : null}
      </section>

      {!hasAny ? null : (
        <p className="mt-6 text-[11px] text-gray-400 dark:text-slate-500 text-center">
          생성이 완료되면 자동으로 완료된 리포트 목록에 표시됩니다.
        </p>
      )}
    </div>
    </div>
  );
}

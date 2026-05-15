"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown
} from "lucide-react";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { authApi, type ActiveSession, type SessionHistoryItem } from "@/lib/api/authApi";
import type { ProblemLanguage, SessionListItem } from "@/lib/types/session";
import { useAuthStore } from "@/store/authStore";

type Filter = "all" | "done" | "in_progress" | "failed";

const PAGE_SIZE = 6;
const PASS_THRESHOLD = 60;

const FILTER_LABELS: Record<Filter, string> = {
  all: "전체",
  done: "완료",
  in_progress: "진행 중",
  failed: "실패"
};

const LEVEL_STYLES: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  2: "bg-amber-50 text-amber-700 ring-amber-100",
  3: "bg-rose-50 text-rose-700 ring-rose-100"
};

/* ─── Helpers ─── */

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

function hashInt(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

type ComputedState = "done" | "in_progress" | "failed" | "abandoned";

function computeState(s: SessionListItem): ComputedState {
  if (s.status === "SUBMITTED") {
    if (s.score != null && s.score < PASS_THRESHOLD) return "failed";
    return "done";
  }
  if (s.status === "IN_PROGRESS") {
    const started = new Date(s.startedAt).getTime();
    const ageDays = (Date.now() - started) / (1000 * 60 * 60 * 24);
    if (ageDays > 30) return "abandoned";
    return "in_progress";
  }
  return "in_progress";
}

/** Synthetic progress percentage for in-progress sessions */
function progressFor(s: SessionListItem): number {
  const h = hashInt(s.sessionId);
  const base = 20 + Math.min(65, s.aiRequestCount * 8);
  const jitter = h % 20;
  return Math.max(15, Math.min(90, base + jitter - 10));
}

/* ─── Page ─── */

export default function SessionsPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const initialFilter = (searchParams?.get("filter") as Filter | null) ?? "all";
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"recent" | "score" | "level">("recent");

  // URL ?filter=in_progress 변경 시 동기화 (마이페이지에서 "이어가기" 클릭으로 진입한 케이스)
  useEffect(() => {
    const next = searchParams?.get("filter") as Filter | null;
    if (next && next !== filter) setFilter(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 백엔드 활성 세션 (IN_PROGRESS) — /api/v1/users/me/sessions/active
  // 진행 중 세션만 빠르게 가져오는 가벼운 endpoint. /history 가 IN_PROGRESS 도 포함하지만
  // 폴링 주기/실시간성 면에서 active 전용 API 쪽이 더 자주 갱신되도록 유지.
  const { data: activeSessions = [] } = useQuery<ActiveSession[]>({
    queryKey: ["activeSessions", user?.id],
    queryFn: async () => {
      try { return await authApi.getActiveSessions(); }
      catch { return []; }
    },
    enabled: !!user
  });

  // 풀이 세션 이력 (전체) — /api/v1/users/me/sessions/history?status=ALL&size=100&sort=LATEST
  // 백엔드 SessionHistoryItem 가 passRate / solveStatus / endedAt 까지 줘서 mock 시드 완전 대체 가능.
  const { data: historyResponse, isLoading } = useQuery({
    queryKey: ["sessionHistory", user?.id],
    queryFn: () => authApi.getSessionHistory({ status: "ALL", sort: "LATEST", page: 0, size: 100 }),
    enabled: !!user
  });
  const historyItems = useMemo<SessionHistoryItem[]>(() => historyResponse?.content ?? [], [historyResponse]);

  // 백엔드 활성 세션 → SessionListItem 호환 형태로 매핑
  const activeAsList = useMemo<SessionListItem[]>(
    () => activeSessions.map((s) => ({
      sessionId: String(s.problemSessionId),
      problemId: String(s.problemId),
      problemTitle: s.problemTitle,
      problemLevel: (s.problemDifficulty === "level1" ? 1 : s.problemDifficulty === "level2" ? 2 : 3) as 1 | 2 | 3,
      problemCategory: s.problemCategory,
      difficulty: s.problemDifficulty,
      language: s.language.toLowerCase() as ProblemLanguage,
      status: "IN_PROGRESS",
      startedAt: s.startedAt,
      endedAt: null,
      aiRequestCount: 0,
      submissionId: null,
      score: null
    } as SessionListItem)),
    [activeSessions]
  );

  // 풀이 이력 → SessionListItem 호환 매핑. solveStatus 기반으로 status/score 결정.
  // - COMPLETED: status SUBMITTED + score = passRate
  // - FAILED:    status SUBMITTED + score = passRate (PASS_THRESHOLD 미만 → failed 표시)
  // - IN_PROGRESS: status IN_PROGRESS (active 와 union 시 dedupe)
  const historyAsList = useMemo<SessionListItem[]>(
    () => historyItems.map((h) => {
      const level = h.problemDifficulty === "level1" ? 1
        : h.problemDifficulty === "level2" ? 2
        : 3;
      const sessionStatus = h.solveStatus === "IN_PROGRESS" ? "IN_PROGRESS" : "SUBMITTED";
      return {
        sessionId: String(h.problemSessionId),
        problemId: String(h.problemId),
        problemTitle: h.problemTitle,
        problemLevel: level as 1 | 2 | 3,
        problemCategory: h.problemCategory,
        difficulty: h.problemDifficulty,
        language: h.language.toLowerCase() as ProblemLanguage,
        status: sessionStatus,
        startedAt: h.startedAt,
        endedAt: h.endedAt,
        aiRequestCount: 0,
        submissionId: null,
        score: h.solveStatus === "IN_PROGRESS" ? null : Math.round(h.passRate)
      } as SessionListItem;
    }),
    [historyItems]
  );

  // active + history union — sessionId 중복 시 active 우선 (실시간성).
  const sessions = useMemo<SessionListItem[]>(() => {
    const activeIds = new Set(activeAsList.map((s) => s.sessionId));
    const histFiltered = historyAsList.filter((s) => !activeIds.has(s.sessionId));
    return [...activeAsList, ...histFiltered];
  }, [activeAsList, historyAsList]);

  /* Stats */
  const stats = useMemo(() => {
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const isThisWeek = (iso: string | null) =>
      iso && now - new Date(iso).getTime() < WEEK;

    const done = sessions.filter((s) => computeState(s) === "done");
    const inProg = sessions.filter((s) => computeState(s) === "in_progress");
    const withScore = sessions.filter((s) => s.score != null);
    const avgScore =
      withScore.length === 0
        ? 0
        : Math.round(
            withScore.reduce((a, s) => a + (s.score ?? 0), 0) / withScore.length
          );

    // 학습 시간 = 활성 세션(IN_PROGRESS) 만 startedAt → now 누적.
    // 완료된 mock 시드 세션은 endedAt 까지 누적. 백엔드 데이터 없는 추정 제거.
    const totalMinutes = sessions.reduce((acc, s) => {
      if (!s.startedAt) return acc;
      const start = new Date(s.startedAt).getTime();
      const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
      const diffMin = Math.max(0, Math.floor((end - start) / 60000));
      // 비정상적으로 큰 값(세션 며칠씩 켜둠) 은 6시간으로 cap — UI 왜곡 방지
      return acc + Math.min(diffMin, 360);
    }, 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    const completedThisWeek = done.filter((s) => isThisWeek(s.endedAt)).length;
    const inProgThisWeek = inProg.filter((s) => isThisWeek(s.startedAt)).length;

    return {
      completed: done.length,
      inProgress: inProg.length,
      avgScore,
      totalTime: `${hours}h ${mins}m`,
      completedDelta: completedThisWeek,
      inProgDelta: inProgThisWeek,
      avgDelta: 5,
      timeDelta: "1h 12m"
    };
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sessions.filter((s) => {
      const state = computeState(s);
      if (filter !== "all" && state !== filter) return false;
      if (!q) return true;
      return (
        s.problemTitle.toLowerCase().includes(q) ||
        s.problemCategory.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    if (sortMode === "recent") {
      sorted.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    } else if (sortMode === "score") {
      sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    } else if (sortMode === "level") {
      sorted.sort((a, b) => b.problemLevel - a.problemLevel);
    }
    return sorted;
  }, [sessions, filter, query, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#EEF2FF]">
      {/* ── Aurora / Mesh gradient background ── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.18]" />
        {/* Soft fade to page background so content sits on a calm surface */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-slate-50" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-16 space-y-6 sm:space-y-7">
        {/* ── HEADER ── */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-[1.1] mb-3 text-balance">
              내 세션 기록
            </h1>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-xl">
              모든 풀이 기록을 한 곳에. 완료된 건 다시 복기하고, 진행 중인 건 이어서 풀어보세요.
            </p>
          </div>

          {/* Search */}
          <div className="md:w-[360px] shrink-0">
            <div className="relative group">
              <Search
                size={16}
                strokeWidth={2}
                className="absolute left-4 inset-y-0 my-auto text-gray-400 pointer-events-none transition-colors group-focus-within:text-indigo-500"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="세션 · 문제 · 언어 검색"
                className="w-full pl-11 pr-4 py-3 rounded-full border border-transparent bg-white/70 backdrop-blur-md text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_8px_20px_-14px_rgba(79,70,229,0.2)]"
              />
            </div>
          </div>
        </section>

        {/* ── STATS STRIP ── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatTile
              label="완료"
              value={String(stats.completed)}
            />
            <StatTile
              label="진행 중"
              value={String(stats.inProgress)}
            />
            <StatTile
              label="평균 점수"
              value={stats.avgScore ? String(stats.avgScore) : "-"}
            />
            <StatTile
              label="총 학습 시간"
              value={stats.totalTime}
            />
          </div>
        </section>

        {/* ── FILTER BAR ── */}
        <section className="relative rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/70 dark:border-slate-700/60 ring-1 ring-inset ring-white/60 dark:ring-slate-700/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_10px_24px_-18px_rgba(79,70,229,0.25)] px-4 sm:px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-300 mr-1">
              상태
            </span>
            <div className="relative inline-flex p-1 rounded-full bg-slate-100/80 dark:bg-slate-900/60 ring-1 ring-inset ring-slate-200/60 dark:ring-slate-700/60">
              {(["all", "done", "in_progress", "failed"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  className={`relative px-3.5 sm:px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    filter === f
                      ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-200 shadow-[0_1px_2px_rgba(17,24,39,0.06),0_6px_16px_-8px_rgba(79,70,229,0.35)]"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition-all duration-200 hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.97]"
            >
              <span>
                {sortMode === "recent"
                  ? "최신순"
                  : sortMode === "score"
                    ? "점수순"
                    : "난이도순"}
              </span>
              <ChevronDown
                size={14}
                strokeWidth={2}
                className={`transition-transform duration-300 ${sortOpen ? "rotate-180" : ""}`}
              />
            </button>
            {sortOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setSortOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-2 w-40 rounded-xl bg-white/90 backdrop-blur-md border border-gray-200 shadow-[0_10px_30px_-10px_rgba(17,24,39,0.25)] py-1.5 z-30 origin-top-right animate-slide-up">
                  {(["recent", "score", "level"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSortMode(m);
                        setSortOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                        sortMode === m
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {m === "recent" ? "최신순" : m === "score" ? "점수순" : "난이도순"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── LIST ── */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/70 bg-white/60 backdrop-blur-md h-[96px] skeleton-shimmer"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState query={query} filter={filter} />
        ) : (
          <section className="space-y-3">
            {pageItems.map((s, i) => (
              <SessionRow
                key={s.sessionId}
                session={s}
                index={(currentPage - 1) * PAGE_SIZE + i + 1}
                withPrefix={withPrefix}
                order={i}
              />
            ))}
          </section>
        )}

        {/* ── PAGINATION ── */}
        {filtered.length > 0 && totalPages > 1 && (
          <section className="flex items-center justify-center gap-2 pt-2">
            <PageButton
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
              <span>이전</span>
            </PageButton>

            {paginationRange(currentPage, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-2 text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`min-w-[40px] h-10 px-3 rounded-full text-sm font-semibold transition-all duration-200 active:scale-[0.96] ${
                    p === currentPage
                      ? "bg-indigo-600 text-white shadow-[0_4px_14px_-4px_rgba(79,70,229,0.55)]"
                      : "text-gray-600 border border-gray-200 bg-white hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <PageButton
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>다음</span>
              <ChevronRight size={14} />
            </PageButton>
          </section>
        )}
      </div>
    </div>
  );
}

/* ─── StatTile (refined glassmorphism) ─── */

function StatTile({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="stat-inner-bg relative overflow-hidden rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
      {/* Top accent wash */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/80"
        aria-hidden="true"
      />
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
        {label}
      </span>
      <div className="mt-2 text-3xl sm:text-[2.35rem] font-display font-bold leading-none tracking-tight text-gray-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

/* ─── ScoreRing (spatial gauge) ─── */

function ScoreRing({
  value,
  tone
}: {
  value: number;
  tone: "done" | "failed";
}) {
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const offset = circ * (1 - pct);
  const track = "stroke-slate-100";
  const fill = tone === "done" ? "stroke-violet-600" : "stroke-rose-500";
  const text = tone === "done" ? "text-violet-700" : "text-rose-600";
  return (
    <div className="relative inline-flex items-center justify-center w-12 h-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} fill="none" strokeWidth="4" className={track} />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={fill}
          style={{
            strokeDasharray: circ,
            strokeDashoffset: offset,
            transform: "rotate(-90deg)",
            transformOrigin: "24px 24px",
            transition:
              "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)"
          }}
        />
      </svg>
      <span className={`absolute text-[13px] font-bold tabular-nums ${text}`}>
        {value}
      </span>
    </div>
  );
}

/* ─── SessionRow ─── */

function SessionRow({
  session,
  index,
  withPrefix,
  order
}: {
  session: SessionListItem;
  index: number;
  withPrefix: (path: string) => string;
  order: number;
}) {
  const state = computeState(session);
  const isDone = state === "done";
  const isFailed = state === "failed";
  const isInProgress = state === "in_progress";
  const isAbandoned = state === "abandoned";

  // 백엔드 SessionHistoryItem 에 submissionId/feedbackReportId 가 없어서 (2026-05-15 기준) 종료 세션 카드의
  // submissionId 는 항상 null. 기존 href="#" 로 떨어져 클릭해도 아무 일 안 일어남.
  // 임시 대응: submissionId 없으면 /reports 목록 페이지로 라우팅해서 사용자가 거기서 매칭되는 리포트 진입.
  // 백엔드 팀에 SessionHistoryItem.feedbackReportId 추가 요청 — 추가되면 직접 라우팅으로 복귀.
  const href =
    isDone || isFailed
      ? session.submissionId
        ? withPrefix(`/submissions/${session.submissionId}/report`)
        : withPrefix(`/reports`)
      : withPrefix(`/ide/${session.sessionId}`);

  const accent = isDone
    ? "bg-violet-600"
    : isFailed
      ? "bg-rose-500"
      : isAbandoned
        ? "bg-slate-300"
        : "bg-indigo-500";

  const statusPill = isDone
    ? {
        text: "완료",
        cls: "bg-violet-600 text-white ring-violet-700/40 shadow-sm shadow-violet-600/30"
      }
    : isFailed
      ? { text: "실패", cls: "bg-rose-50 text-rose-700 ring-rose-100" }
      : isAbandoned
        ? { text: "중단됨", cls: "bg-slate-100 text-slate-600 ring-slate-200" }
        : { text: "진행 중", cls: "bg-indigo-50 text-indigo-700 ring-indigo-100" };

  const langTint = "bg-gray-100";

  const progress = isInProgress ? progressFor(session) : 0;

  return (
    <article
      className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_10px_24px_-18px_rgba(79,70,229,0.22)] transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-indigo-200/80 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_1px_2px_rgba(17,24,39,0.04),0_18px_36px_-18px_rgba(79,70,229,0.35)] animate-slide-up"
      style={{ animationDelay: `${order * 55}ms`, animationFillMode: "both" }}
    >


      <div className="flex items-center gap-3 sm:gap-4 pl-5 pr-4 sm:pr-5 py-4">
        {/* Index + lang icon */}
        <div className="shrink-0 flex items-center gap-2.5">
          <span className="hidden sm:inline-flex font-mono font-bold text-gray-400 text-sm tabular-nums min-w-[28px]">
            #{String(index).padStart(2, "0")}
          </span>
          <span
            className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${langTint} ring-1 ring-inset ring-black/5`}
          >
            <LangIcon language={session.language} size={22} />
          </span>
        </div>

        {/* Middle: title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-bold text-gray-900 truncate">
              {session.problemTitle}
            </h3>
            <span
              className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ${LEVEL_STYLES[session.problemLevel]}`}
            >
              Lv {session.problemLevel}
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-gray-500">
            {/* 카테고리 색 분기 — BUG 은 rose, API 는 sky (시각 강조) */}
            <span
              className={
                session.problemCategory === "BUG"
                  ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold ring-1 ring-inset ring-rose-200 text-[11px] tracking-wide"
                  : session.problemCategory === "API"
                    ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-bold ring-1 ring-inset ring-sky-200 text-[11px] tracking-wide"
                    : "inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 font-semibold ring-1 ring-inset ring-indigo-100 text-[11px]"
              }
            >
              {session.problemCategory}
            </span>
            <span className="tabular-nums">{formatDate(session.startedAt)}</span>
            <span className="text-gray-300 hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              {session.language === "java" ? "Java" : "Python"}
            </span>
          </div>
        </div>

        {/* Right cluster */}
        <div className="shrink-0 flex items-center gap-3 sm:gap-5">
          {/* Progress or Score */}
          {isInProgress ? (
            // 백엔드가 진행률 데이터를 주지 않아 막대를 "경과 시간" 으로 의미 전환.
            // 가짜 progress% 표시는 데모 정직성 측면에서 제거.
            <div className="hidden md:flex flex-col items-end gap-1 w-36 text-xs">
              <span className="font-semibold text-gray-600 tabular-nums">
                {(() => {
                  if (!session.startedAt) return "방금 시작";
                  const diffMin = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000);
                  if (diffMin < 1) return "방금 시작";
                  if (diffMin < 60) return `${diffMin}분 진행`;
                  const h = Math.floor(diffMin / 60);
                  const m = diffMin % 60;
                  return m === 0 ? `${h}시간 진행` : `${h}시간 ${m}분 진행`;
                })()}
              </span>
            </div>
          ) : (isDone || isFailed) && session.score != null ? (
            <ScoreRing value={session.score} tone={isDone ? "done" : "failed"} />
          ) : null}

          {/* Status pill */}
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ring-1 ${statusPill.cls}`}
          >
            {isInProgress && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-dot-pulse" />
            )}
            <span>{statusPill.text}</span>
          </span>

          {/* Action */}
          {isAbandoned || (isFailed && !session.submissionId) ? (
            <span className="hidden md:inline-flex items-center gap-1 text-sm text-gray-400 font-semibold">
              <span>종료됨</span>
            </span>
          ) : (
            <Link
              href={href}
              className="group/cta hidden sm:inline-flex items-center gap-1 text-sm text-gray-700 hover:text-indigo-700 font-semibold transition-colors"
            >
              <span>{isDone || isFailed ? "리포트 보기" : "이어서 풀기"}</span>
              <ChevronRight
                size={14}
                strokeWidth={2.4}
                className="transition-transform duration-300 group-hover/cta:translate-x-0.5"
              />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── Empty state & pagination helpers ─── */

function EmptyState({ query, filter }: { query: string; filter: Filter }) {
  const { withPrefix } = useRouteScope();
  const desc = query
    ? `"${query}"에 해당하는 세션이 없어요.`
    : filter === "in_progress"
      ? "진행 중인 과제가 없어요. 새 과제를 시작해 보세요."
      : filter === "done"
        ? "완료한 과제가 없어요. 첫 과제를 시도해 보세요."
        : filter === "failed"
          ? "실패 기록이 없어요."
          : "아직 풀이 기록이 없어요.";

  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-center py-16 rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 ring-1 ring-inset ring-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(79,70,229,0.25)]">
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-indigo-400/20 blur-[90px]"
        aria-hidden="true"
      />
      <p className="relative text-sm text-gray-600 mb-5">{desc}</p>
      <Link
        href={withPrefix("/problems")}
        className="relative inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.97] shadow-[0_1px_2px_rgba(17,24,39,0.1),0_10px_24px_-10px_rgba(79,70,229,0.6)]"
      >
        <span>과제 목록 보기</span>
        <ChevronRight size={14} strokeWidth={2.4} />
      </Link>
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  children
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold transition-all duration-200 active:scale-[0.96] ${
        disabled
          ? "text-gray-300 border border-gray-100 bg-white cursor-not-allowed"
          : "text-gray-600 border border-gray-200 bg-white hover:border-indigo-300 hover:text-indigo-600"
      }`}
    >
      {children}
    </button>
  );
}

function paginationRange(current: number, total: number): Array<number | "…"> {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "…", total];
  if (current >= total - 2) return [1, "…", total - 2, total - 1, total];
  return [1, "…", current, "…", total];
}

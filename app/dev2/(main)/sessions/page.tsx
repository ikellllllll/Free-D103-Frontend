"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  TrendingUp,
  Loader2,
  Star,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BookOpen
} from "lucide-react";

import { LangIcon } from "@/components/common/LangIcon";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type { SessionListItem } from "@/lib/types/session";
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
  1: "bg-green-100 text-green-700",
  2: "bg-amber-100 text-amber-700",
  3: "bg-rose-100 text-rose-700"
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
    // "Abandoned" = started > 30 days ago, still in progress
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
  // 20..85 range, anchored by ai request count
  const base = 20 + Math.min(65, s.aiRequestCount * 8);
  const jitter = h % 20;
  return Math.max(15, Math.min(90, base + jitter - 10));
}

function modelLabel(s: SessionListItem): string {
  // We don't have model directly on list item; use category-ish derived label fallback.
  // Real data would expose a 'modelLabel'; here we infer "AIG Default Model".
  return "AIG Default Model";
}

/* ─── Page ─── */

export default function Dev2SessionsPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"recent" | "score" | "level">("recent");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: () => mockApi.getSessions(user!.id),
    enabled: !!user
  });

  /* Stats */
  const stats = useMemo(() => {
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const isThisWeek = (iso: string | null) => iso && now - new Date(iso).getTime() < WEEK;

    const done = sessions.filter((s) => computeState(s) === "done");
    const inProg = sessions.filter((s) => computeState(s) === "in_progress");
    const withScore = sessions.filter((s) => s.score != null);
    const avgScore =
      withScore.length === 0
        ? 0
        : Math.round(
            withScore.reduce((a, s) => a + (s.score ?? 0), 0) / withScore.length
          );

    // Synthesize total time from aiRequestCount + session count
    const totalMinutes = sessions.reduce(
      (a, s) => a + 18 + s.aiRequestCount * 6,
      0
    );
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
    <div className="relative bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-0 left-0 right-0 h-[700px] pointer-events-none overflow-hidden">
        <div className="absolute -top-10 -left-40 w-[460px] h-[460px] rounded-full bg-indigo-400/25 blur-3xl animate-blob-1" />
        <div className="absolute top-[10%] -right-40 w-[460px] h-[460px] rounded-full bg-purple-400/25 blur-3xl animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-25" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-16 space-y-6">
        {/* ── HEADER ── */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white border border-indigo-100 text-indigo-700 text-xs font-semibold mb-5 shadow-sm">
              <span>📚</span>
              <span>
                {sessions.length} sessions · {stats.completed} completed
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight leading-[1.1] mb-3">
              Your Sessions
            </h1>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-xl">
              모든 풀이 기록을 한 번에 — 완료된 건 다시 복기하고, 진행 중인 건 이어서
              풀어요.
            </p>
          </div>

          {/* Search */}
          <div className="md:w-[360px] shrink-0">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={2}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search sessions, problems, or tags..."
                className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </section>

        {/* ── STATS STRIP ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="COMPLETED"
            value={String(stats.completed)}
            delta={`+${stats.completedDelta} this week`}
            valueColor="text-green-600"
            icon={TrendingUp}
            iconBg="bg-green-100 text-green-600"
          />
          <StatCard
            label="IN PROGRESS"
            value={String(stats.inProgress)}
            delta={`+${stats.inProgDelta} this week`}
            valueColor="text-indigo-600"
            icon={Loader2}
            iconBg="bg-indigo-100 text-indigo-600"
          />
          <StatCard
            label="AVG SCORE"
            value={String(stats.avgScore || "—")}
            delta={`+${stats.avgDelta} vs last week`}
            valueColor="text-violet-600"
            icon={Star}
            iconBg="bg-violet-100 text-violet-600"
          />
          <StatCard
            label="TOTAL TIME"
            value={stats.totalTime}
            delta={`+${stats.timeDelta} vs last week`}
            valueColor="text-teal-600"
            icon={Clock}
            iconBg="bg-teal-100 text-teal-600"
          />
        </section>

        {/* ── FILTER BAR ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-700 mr-1">상태</span>
            {(["all", "done", "in_progress", "failed"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setPage(1);
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  filter === f
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 border border-gray-200 bg-white hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-indigo-300"
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
                className={`transition-transform ${sortOpen ? "rotate-180" : ""}`}
              />
            </button>
            {sortOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setSortOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-30">
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
                className="rounded-2xl border border-gray-100 h-[88px] skeleton-shimmer"
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
                  className={`min-w-[40px] h-10 px-3 rounded-full text-sm font-semibold transition-colors ${
                    p === currentPage
                      ? "bg-indigo-600 text-white shadow-sm"
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

/* ─── StatCard ─── */

function StatCard({
  label,
  value,
  delta,
  valueColor,
  icon: Icon,
  iconBg
}: {
  label: string;
  value: string;
  delta: string;
  valueColor: string;
  icon: typeof Star;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
          {label}
        </span>
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${iconBg}`}
        >
          <Icon size={16} strokeWidth={2.2} />
        </span>
      </div>
      <div
        className={`text-4xl font-display font-bold tracking-tight leading-none mb-3 ${valueColor}`}
      >
        {value}
      </div>
      <div className="text-xs text-green-600 font-semibold inline-flex items-center gap-1">
        <TrendingUp size={11} strokeWidth={2.4} />
        <span>{delta}</span>
      </div>
    </div>
  );
}

/* ─── SessionRow ─── */

function SessionRow({
  session,
  index,
  withPrefix
}: {
  session: SessionListItem;
  index: number;
  withPrefix: (path: string) => string;
}) {
  const state = computeState(session);
  const isDone = state === "done";
  const isFailed = state === "failed";
  const isInProgress = state === "in_progress";
  const isAbandoned = state === "abandoned";

  const href = isDone || isFailed
    ? session.submissionId
      ? withPrefix(`/submissions/${session.submissionId}/report`)
      : "#"
    : withPrefix(`/ide/${session.sessionId}`);

  const accentColor = isDone
    ? "bg-green-500"
    : isFailed
      ? "bg-rose-500"
      : isAbandoned
        ? "bg-gray-300"
        : "bg-indigo-500";

  const statusPill = isDone
    ? { text: "완료", cls: "bg-green-100 text-green-700" }
    : isFailed
      ? { text: "실패", cls: "bg-rose-100 text-rose-700" }
      : isAbandoned
        ? { text: "중단됨", cls: "bg-gray-100 text-gray-600" }
        : { text: "진행 중", cls: "bg-indigo-100 text-indigo-700" };

  const langTint =
    session.language === "java" ? "bg-orange-50" : "bg-yellow-50";

  const progress = isInProgress ? progressFor(session) : 0;

  return (
    <article
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden animate-slide-up"
      style={{ animationFillMode: "both" }}
    >
      {/* Left accent bar */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

      <div className="flex items-center gap-4 pl-5 pr-5 py-4">
        {/* Index + lang icon */}
        <div className="shrink-0 flex items-center gap-2.5">
          <span className="font-mono font-bold text-gray-400 text-sm tabular-nums min-w-[32px]">
            #{String(index).padStart(2, "0")}
          </span>
          <span
            className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${langTint}`}
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
              className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${LEVEL_STYLES[session.problemLevel]}`}
            >
              Lv {session.problemLevel}
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-gray-500">
            <span className="font-medium">{modelLabel(session)}</span>
            <span className="text-gray-300">·</span>
            <span className="tabular-nums">{formatDate(session.startedAt)}</span>
            <span className="text-gray-300">·</span>
            <span>{session.language === "java" ? "Java" : "Python"}</span>
          </div>
        </div>

        {/* Right cluster */}
        <div className="shrink-0 flex items-center gap-5">
          {/* Progress (in-progress) OR Score (submitted) */}
          {isInProgress ? (
            <div className="hidden md:flex flex-col items-end gap-1.5 w-36">
              <span className="text-xs font-bold text-gray-700 tabular-nums">
                {progress}%
              </span>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED)"
                  }}
                />
              </div>
            </div>
          ) : (isDone || isFailed) && session.score != null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-display font-bold text-gray-900 tabular-nums">
                {session.score}
              </span>
              <span className="text-sm text-gray-400 font-semibold">/100</span>
            </div>
          ) : null}

          {/* Status pill */}
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${statusPill.cls}`}
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
              className="inline-flex items-center gap-1 text-sm text-gray-700 hover:text-indigo-600 font-semibold transition-colors"
            >
              <span>
                {isDone || isFailed ? "리포트 보기" : "이어서 풀기"}
              </span>
              <ChevronRight size={14} strokeWidth={2.4} />
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
    <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
      <span className="text-4xl mb-3">📭</span>
      <p className="text-sm text-gray-500 mb-5">{desc}</p>
      <Link
        href={withPrefix("/problems")}
        className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
      >
        <BookOpen size={14} />
        <span>과제 목록 보기</span>
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
      className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold transition-colors ${
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

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Lock,
  CheckCircle2,
  Clock,
  Circle,
  Search,
  X,
  ArrowRight,
  Target,
  SlidersHorizontal
} from "lucide-react";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type {
  ProblemCategory,
  ProblemLevel,
  ProblemStatus,
  ProblemSummary
} from "@/lib/types/problem";

const LEVEL_OPTIONS = [1, 2, 3] as const;
const CATEGORY_OPTIONS = ["API 구현", "버그 수정"] as const;
const STATUS_OPTIONS = ["미시작", "진행 중", "완료"] as const;
const SORT_OPTIONS = [
  { id: "default", label: "기본 순서" },
  { id: "pass-desc", label: "통과율 높은 순" },
  { id: "pass-asc", label: "통과율 낮은 순" },
  { id: "level-asc", label: "난이도 낮은 순" },
  { id: "level-desc", label: "난이도 높은 순" }
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["id"];

const LEVEL_META: Record<
  ProblemLevel,
  {
    label: string;
    chipBg: string;
    chipText: string;
    ringTrack: string;
    ringFill: string;
    barFill: string;
  }
> = {
  1: {
    label: "입문",
    chipBg: "bg-indigo-50",
    chipText: "text-indigo-400",
    ringTrack: "stroke-indigo-100",
    ringFill: "stroke-indigo-400",
    barFill: "bg-indigo-400"
  },
  2: {
    label: "중급",
    chipBg: "bg-violet-50",
    chipText: "text-violet-500",
    ringTrack: "stroke-violet-100",
    ringFill: "stroke-violet-500",
    barFill: "bg-violet-500"
  },
  3: {
    label: "고급",
    chipBg: "bg-fuchsia-50",
    chipText: "text-fuchsia-600",
    ringTrack: "stroke-fuchsia-100",
    ringFill: "stroke-fuchsia-600",
    barFill: "bg-fuchsia-600"
  }
};

// ────────────────────────────────────────────────
// Small UI atoms
// ────────────────────────────────────────────────
function FilterChip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
          : "text-gray-600 border border-gray-200 bg-white hover:border-indigo-300 hover:text-indigo-600"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="bg-gray-100 border border-gray-300 rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-wider mr-0.5 font-sans whitespace-nowrap text-gray-900">
        {label}
      </span>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: ProblemStatus }) {
  const base =
    "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full";
  if (status === "완료") {
    return (
      <span className={`${base} bg-violet-600 text-white ring-1 ring-violet-700/50 shadow-sm shadow-violet-600/30`}>
        <CheckCircle2 size={12} strokeWidth={2.8} />
        <span>완료</span>
      </span>
    );
  }
  if (status === "진행 중") {
    return (
      <span className={`${base} bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100`}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
        </span>
        <span>진행 중</span>
      </span>
    );
  }
  if (status === "잠김") {
    return (
      <span className={`${base} bg-gray-100 text-gray-500 ring-1 ring-gray-200`}>
        <Lock size={12} strokeWidth={2.4} />
        <span>잠김</span>
      </span>
    );
  }
  return (
    <span className={`${base} border border-gray-200 text-gray-500 bg-white`}>
      <Circle size={12} strokeWidth={2} />
      <span>미시작</span>
    </span>
  );
}

function LevelRing({ level }: { level: ProblemLevel }) {
  const meta = LEVEL_META[level];
  const radius = 14;
  const circ = 2 * Math.PI * radius;
  const pct = level / 3;
  const offset = circ * (1 - pct);
  return (
    <span className="relative inline-flex items-center justify-center w-9 h-9 shrink-0">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          className={meta.ringTrack}
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={meta.ringFill}
          style={{
            strokeDasharray: circ,
            strokeDashoffset: offset,
            transform: "rotate(-90deg)",
            transformOrigin: "18px 18px",
            transition: "stroke-dashoffset 500ms ease"
          }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${meta.chipText}`}
      >
        {level}
      </span>
    </span>
  );
}

// ────────────────────────────────────────────────
// Stat card (glassmorphism, 2026 trend)
// ────────────────────────────────────────────────
function StatCard({
  label,
  value,
  suffix
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200/80 p-4 sm:p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_8px_20px_-14px_rgba(79,70,229,0.18)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_10px_20px_-12px_rgba(79,70,229,0.25),0_20px_40px_-20px_rgba(17,24,39,0.15)]">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-gray-500 truncate">{label}</div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">
            {value}
          </span>
          {suffix && <span className="text-sm font-semibold text-gray-400">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Problem card (the star of the redesign)
// ────────────────────────────────────────────────
function ProblemCard({
  problem,
  href
}: {
  problem: ProblemSummary;
  href?: string;
}) {
  const meta = LEVEL_META[problem.level];
  const locked = problem.status === "잠김";

  const inner = (
    <>
      <div className="relative flex flex-col flex-1 p-5 sm:p-6">
        {/* Header: Ring + order + status */}
        <div className="flex items-center gap-3 mb-4">
          <LevelRing level={problem.level} />
          <div className="flex items-baseline gap-2 min-w-0 flex-1">
            <span className="text-sm font-mono font-bold text-gray-900 tabular-nums">
              #{problem.order.toString().padStart(2, "0")}
            </span>
            <span className={`text-[11px] font-semibold ${meta.chipText} uppercase tracking-wide`}>
              {meta.label}
            </span>
          </div>
          <StatusBadge status={problem.status} />
        </div>

        {/* Title + description */}
        <h3 className="text-base sm:text-lg font-display font-bold text-gray-900 leading-snug mb-1.5 line-clamp-2 text-balance">
          {problem.title}
        </h3>
        <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2 min-h-[2.6rem] mb-4">
          {problem.summary}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-xs mb-5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold ring-1 ring-indigo-100">
            {problem.category}
          </span>
          {problem.estimate ? (
            <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
              <Clock size={11} strokeWidth={2.4} />
              {problem.estimate}
            </span>
          ) : null}
        </div>

        {/* Spacer pushes footer to bottom for equal-height cards */}
        <div className="mt-auto pt-4 border-t border-gray-100">
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  통과율
                </span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                  {problem.passRate}%
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${meta.barFill} transition-[width] duration-700 ease-out`}
                  style={{ width: `${problem.passRate}%` }}
                />
              </div>
            </div>
            <span
              className={`inline-flex w-9 h-9 shrink-0 items-center justify-center rounded-xl text-indigo-600 bg-indigo-50 ring-1 ring-indigo-100 transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:ring-indigo-600 group-hover:translate-x-0.5 group-hover:shadow-md group-hover:shadow-indigo-600/30 ${
                locked ? "opacity-40" : ""
              }`}
              aria-hidden="true"
            >
              <ArrowRight size={16} strokeWidth={2.4} />
            </span>
          </div>
        </div>
      </div>
    </>
  );

  const shell =
    "group relative flex flex-col h-full overflow-hidden rounded-2xl bg-white border border-gray-200/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_2px_6px_-2px_rgba(17,24,39,0.05),0_12px_28px_-16px_rgba(79,70,229,0.18)] transition-[transform,box-shadow,border-color] duration-300 ease-out will-change-transform";

  if (locked || !href) {
    return (
      <div
        className={`${shell} ${
          locked ? "opacity-60 cursor-not-allowed" : ""
        }`}
        aria-disabled={locked || undefined}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${shell} hover:-translate-y-1 hover:border-indigo-300 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_2px_4px_rgba(17,24,39,0.04),0_12px_24px_-12px_rgba(79,70,229,0.25),0_24px_44px_-20px_rgba(79,70,229,0.3)] active:-translate-y-0.5 active:duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
    >
      {inner}
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_12px_28px_-16px_rgba(79,70,229,0.18)]">
      <div className="h-1 bg-gray-200" />
      <div className="p-5 sm:p-6 skeleton-shimmer h-[220px]" />
    </div>
  );
}

// ────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────
export default function Dev2ProblemsPage() {
  const { withPrefix } = useRouteScope();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<ProblemLevel | "ALL">("ALL");
  const [category, setCategory] = useState<ProblemCategory | "ALL">("ALL");
  const [status, setStatus] = useState<ProblemStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortId>("default");

  const { data, isLoading } = useQuery({
    queryKey: ["problems"],
    queryFn: () => mockApi.getProblems()
  });

  const all = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = all.filter(
      (p) =>
        (level === "ALL" || p.level === level) &&
        (category === "ALL" || p.category === category) &&
        (status === "ALL" || p.status === status) &&
        (q === "" ||
          p.title.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q))
    );
    const sorted = [...base];
    switch (sort) {
      case "pass-desc":
        sorted.sort((a, b) => b.passRate - a.passRate);
        break;
      case "pass-asc":
        sorted.sort((a, b) => a.passRate - b.passRate);
        break;
      case "level-asc":
        sorted.sort((a, b) => a.level - b.level);
        break;
      case "level-desc":
        sorted.sort((a, b) => b.level - a.level);
        break;
    }
    return sorted;
  }, [all, search, level, category, status, sort]);

  const stats = useMemo(() => {
    const total = all.length;
    const done = all.filter((p) => p.status === "완료").length;
    const inProgress = all.filter((p) => p.status === "진행 중").length;
    const avgPass = total
      ? Math.round(all.reduce((s, p) => s + p.passRate, 0) / total)
      : 0;
    return { total, done, inProgress, avgPass };
  }, [all]);

  const filtersActive =
    search !== "" || level !== "ALL" || category !== "ALL" || status !== "ALL";

  const resetFilters = () => {
    setSearch("");
    setLevel("ALL");
    setCategory("ALL");
    setStatus("ALL");
    setSort("default");
  };

  return (
    <div className="relative bg-[#EEF2FF] min-h-screen overflow-hidden">
      {/* Floating blobs & grid */}
      <div className="absolute top-0 left-0 right-0 h-[800px] pointer-events-none overflow-hidden">
        <div className="absolute -top-10 -left-32 w-[420px] h-[420px] rounded-full bg-indigo-400/30 blur-3xl animate-blob-1" />
        <div className="absolute top-[10%] -right-32 w-[420px] h-[420px] rounded-full bg-purple-400/30 blur-3xl animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16">
        {/* Hero */}
        <div className="text-center mb-8 sm:mb-10 animate-slide-up">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-bold text-gray-900 tracking-tight mb-3 sm:mb-4 leading-[1.1] text-balance">
            실무 백엔드 과제를
            <br />
            <span
              className="bg-gradient-animate"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #4F46E5, #7C3AED, #4F46E5)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent"
              }}
            >
              AI 에이전트와 함께
            </span>
          </h1>
          <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed text-pretty px-2">
            Spring Boot · FastAPI 기반 엄선된 시나리오, 난이도별로 정리했습니다.
          </p>
        </div>

        {/* Stats */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 animate-slide-up"
          style={{ animationDelay: "0.05s", animationFillMode: "both" }}
        >
          <StatCard label="전체 과제" value={stats.total} suffix="개" />
          <StatCard label="완료" value={stats.done} suffix="개" />
          <StatCard label="진행 중" value={stats.inProgress} suffix="개" />
          <StatCard label="평균 통과율" value={stats.avgPass} suffix="%" />
        </div>

        {/* Search + sort */}
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 animate-slide-up"
          style={{ animationDelay: "0.1s", animationFillMode: "both" }}
        >
          <div className="relative flex-1">
            <Search
              size={16}
              strokeWidth={2.2}
              className="absolute left-4 inset-y-0 my-auto text-gray-400 pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목, 설명, 유형으로 검색..."
              className="w-full bg-white/80 backdrop-blur border border-transparent rounded-2xl pl-11 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="검색어 지우기"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <label
              htmlFor="dev2-sort"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 whitespace-nowrap"
            >
              <SlidersHorizontal size={14} strokeWidth={2.2} className="text-gray-400" />
              정렬
            </label>
            <select
              id="dev2-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              className="flex-1 sm:flex-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 font-medium shadow-sm focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 transition-all cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter bar */}
        <div
          className="flex items-center gap-x-2 mb-6 sm:mb-8 animate-slide-up overflow-x-auto"
          style={{ animationDelay: "0.15s", animationFillMode: "both" }}
        >
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_4px_12px_-6px_rgba(79,70,229,0.12)]">
            <FilterGroup label="난이도">
              <FilterChip active={level === "ALL"} onClick={() => setLevel("ALL")}>전체</FilterChip>
              {LEVEL_OPTIONS.map((v) => (
                <FilterChip key={v} active={level === v} onClick={() => setLevel(v)}>
                  Lv {v}
                  <span className="ml-1 text-[10px] opacity-70">{LEVEL_META[v].label}</span>
                </FilterChip>
              ))}
            </FilterGroup>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_4px_12px_-6px_rgba(79,70,229,0.12)]">
            <FilterGroup label="유형">
              <FilterChip active={category === "ALL"} onClick={() => setCategory("ALL")}>전체</FilterChip>
              {CATEGORY_OPTIONS.map((c) => (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</FilterChip>
              ))}
            </FilterGroup>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.04),0_4px_12px_-6px_rgba(79,70,229,0.12)]">
            <FilterGroup label="상태">
              <FilterChip active={status === "ALL"} onClick={() => setStatus("ALL")}>전체</FilterChip>
              {STATUS_OPTIONS.map((s) => (
                <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>{s}</FilterChip>
              ))}
            </FilterGroup>
          </div>
        </div>

        {/* Result count */}
        <div
          className="flex items-center justify-between mb-4 sm:mb-5 animate-fade-in"
          style={{ animationDelay: "0.2s", animationFillMode: "both" }}
        >
          <div className="flex items-center gap-2 text-sm">
            <Target size={14} strokeWidth={2.2} className="text-indigo-500" />
            <span className="font-semibold text-gray-900">
              {filtered.length}
            </span>
            <span className="text-gray-400">/ {all.length}</span>
            <span className="text-gray-500 font-medium">개 과제</span>
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <X size={13} strokeWidth={2.4} />
              필터 초기화
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 stagger-children">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-fade-in">
                <SkeletonCard />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center text-center py-16 sm:py-20 px-6 border border-dashed border-gray-200 rounded-2xl bg-white/60 backdrop-blur animate-fade-in">
              <div className="relative w-16 h-16 mb-5">
                <div className="absolute inset-0 rounded-full bg-indigo-100/70 animate-pulse" />
                <div className="absolute inset-2 rounded-full bg-white ring-1 ring-indigo-100 flex items-center justify-center">
                  <Search size={20} strokeWidth={2} className="text-indigo-500" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                조건에 맞는 과제가 없어요
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                필터를 조정하거나 검색어를 지워보세요.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-600/30 hover:bg-indigo-700 transition-colors"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="animate-slide-up"
                style={{ animationFillMode: "both" }}
              >
                <ProblemCard
                  problem={p}
                  href={
                    p.status === "잠김"
                      ? undefined
                      : withPrefix(`/problems/${p.id}`)
                  }
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

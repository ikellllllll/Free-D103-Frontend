"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, CheckCircle2, Clock, Circle } from "lucide-react";

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

const LEVEL_STYLES: Record<ProblemLevel, { bg: string; text: string }> = {
  1: { bg: "bg-green-100", text: "text-green-700" },
  2: { bg: "bg-amber-100", text: "text-amber-700" },
  3: { bg: "bg-rose-100", text: "text-rose-700" }
};

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
      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-gray-600 border border-gray-200 bg-white hover:border-indigo-300 hover:text-indigo-600"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: ProblemStatus }) {
  const base =
    "inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full";
  if (status === "완료") {
    return (
      <span className={`${base} bg-green-100 text-green-700`}>
        <CheckCircle2 size={13} strokeWidth={2.4} />
        <span>완료</span>
      </span>
    );
  }
  if (status === "진행 중") {
    return (
      <span className={`${base} bg-blue-100 text-blue-700`}>
        <Clock size={13} strokeWidth={2.4} />
        <span>진행 중</span>
      </span>
    );
  }
  if (status === "잠김") {
    return (
      <span className={`${base} bg-gray-100 text-gray-500`}>
        <Lock size={13} strokeWidth={2.4} />
        <span>잠김</span>
      </span>
    );
  }
  return (
    <span className={`${base} border border-gray-200 text-gray-500 bg-white`}>
      <Circle size={13} strokeWidth={2} />
      <span>미시작</span>
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-7 skeleton-shimmer h-[220px]" />
  );
}

function ProblemCard({
  problem,
  href
}: {
  problem: ProblemSummary;
  href?: string;
}) {
  const levelStyle = LEVEL_STYLES[problem.level];
  const locked = problem.status === "잠김";

  const inner = (
    <>
      {/* Top row */}
      <div className="flex items-start justify-between mb-5">
        <span className="text-sm font-mono font-bold text-indigo-600">
          #{problem.order.toString().padStart(2, "0")}
        </span>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-md ${levelStyle.bg} ${levelStyle.text}`}
        >
          Lv {problem.level}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-xl font-display font-bold text-gray-900 mb-2.5 leading-tight">
        {problem.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 leading-relaxed mb-5 line-clamp-2 min-h-[2.75rem]">
        {problem.summary}
      </p>

      {/* Divider */}
      <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-3 text-sm">
          <span className="text-indigo-600 font-semibold">{problem.category}</span>
          <span className="text-gray-500">통과율 {problem.passRate}%</span>
        </div>
        <StatusBadge status={problem.status} />
      </div>
    </>
  );

  if (locked || !href) {
    return (
      <div
        className={`bg-white rounded-2xl border border-gray-100 p-7 shadow-sm ${
          locked ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group block bg-white rounded-2xl border border-gray-100 p-7 shadow-sm hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1 transition-all"
    >
      {inner}
    </Link>
  );
}

export default function Dev2ProblemsPage() {
  const { withPrefix } = useRouteScope();
  const [level, setLevel] = useState<ProblemLevel | "ALL">("ALL");
  const [category, setCategory] = useState<ProblemCategory | "ALL">("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["problems"],
    queryFn: () => mockApi.getProblems()
  });

  const filtered = useMemo(() => {
    const base = data ?? [];
    return base.filter(
      (p) =>
        (level === "ALL" || p.level === level) &&
        (category === "ALL" || p.category === category)
    );
  }, [data, level, category]);

  return (
    <div className="relative bg-gradient-to-b from-indigo-50/40 via-white to-white min-h-screen overflow-hidden">
      {/* Floating blobs */}
      <div className="absolute top-0 left-0 right-0 h-[800px] pointer-events-none overflow-hidden">
        <div className="absolute -top-10 -left-32 w-[420px] h-[420px] rounded-full bg-indigo-400/30 blur-3xl animate-blob-1" />
        <div className="absolute top-[10%] -right-32 w-[420px] h-[420px] rounded-full bg-purple-400/30 blur-3xl animate-blob-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-10 animate-slide-up">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white border border-indigo-100 text-indigo-700 text-sm font-semibold mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-dot-pulse" />
            <span>{filtered.length}개 과제 · 실무 시나리오</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold text-gray-900 tracking-tight mb-4 leading-[1.1]">
            실무 백엔드 과제를
            <br />
            <span
              className="bg-gradient-animate"
              style={{
                backgroundImage: "linear-gradient(90deg, #4F46E5, #7C3AED, #4F46E5)",
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
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Spring Boot · FastAPI 기반 엄선된 시나리오, 난이도별로 정리했습니다.
          </p>
        </div>

        {/* Filter bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 mb-10 px-6 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm animate-slide-up"
          style={{ animationDelay: "0.1s", animationFillMode: "both" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 mr-2">난이도</span>
            <FilterChip active={level === "ALL"} onClick={() => setLevel("ALL")}>
              전체
            </FilterChip>
            {LEVEL_OPTIONS.map((v) => (
              <FilterChip key={v} active={level === v} onClick={() => setLevel(v)}>
                Lv {v}
              </FilterChip>
            ))}
          </div>
          <div className="hidden md:block w-px h-8 bg-gray-200" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 mr-2">유형</span>
            <FilterChip active={category === "ALL"} onClick={() => setCategory("ALL")}>
              전체
            </FilterChip>
            {CATEGORY_OPTIONS.map((c) => (
              <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-fade-in">
                <SkeletonCard />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-20 text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-white/50 animate-fade-in">
              조건에 맞는 과제가 없습니다.
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
                  href={p.status === "잠김" ? undefined : withPrefix(`/problems/${p.id}`)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

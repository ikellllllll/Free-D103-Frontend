"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, CheckCircle2, Clock, Sparkles } from "lucide-react";

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

const LEVEL_COLORS: Record<ProblemLevel, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  2: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  3: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" }
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
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-16 bg-gray-100 rounded" />
        <div className="h-6 w-12 bg-gray-100 rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-gray-100 rounded mb-3" />
      <div className="h-4 w-full bg-gray-100 rounded mb-2" />
      <div className="h-4 w-2/3 bg-gray-100 rounded mb-6" />
      <div className="h-10 bg-gray-50 rounded-lg" />
    </div>
  );
}

function StatusBadge({ status }: { status: ProblemStatus }) {
  if (status === "완료") {
    return (
      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={12} strokeWidth={2.4} />
        <span>완료</span>
      </span>
    );
  }
  if (status === "진행 중") {
    return (
      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
        <Clock size={12} strokeWidth={2.4} />
        <span>진행 중</span>
      </span>
    );
  }
  if (status === "잠김") {
    return (
      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
        <Lock size={12} strokeWidth={2.4} />
        <span>잠김</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
      미시작
    </span>
  );
}

function ProblemCard({
  problem,
  href
}: {
  problem: ProblemSummary;
  href?: string;
}) {
  const levelColor = LEVEL_COLORS[problem.level];
  const locked = problem.status === "잠김";

  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-indigo-600 font-semibold">
          #{problem.order}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${levelColor.bg} ${levelColor.text} ${levelColor.border}`}
        >
          Lv {problem.level}
        </span>
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2 leading-tight">
        {problem.title}
      </h3>
      <p className="text-sm text-gray-600 leading-relaxed mb-5 line-clamp-2">
        {problem.summary}
      </p>
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-indigo-600 font-medium">{problem.category}</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">통과율 {problem.passRate}%</span>
        </div>
        <StatusBadge status={problem.status} />
      </div>
    </>
  );

  if (locked || !href) {
    return (
      <div
        className={`bg-white rounded-2xl border border-gray-100 p-6 ${
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
      className="group block bg-white rounded-2xl border border-gray-100 p-6 hover:border-indigo-300 hover:shadow-lg transition-all"
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
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
            <Sparkles size={12} strokeWidth={2.4} />
            <span>{filtered.length}개 과제</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gray-900 tracking-tight mb-4">
            AI와 함께 푸는
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-gradient">
              실무 백엔드 과제
            </span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Spring Boot 기반 API 구현부터 버그 수정까지, 난이도별 엄선된 실무 시나리오.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mr-2">
              난이도
            </span>
            <FilterChip active={level === "ALL"} onClick={() => setLevel("ALL")}>
              전체
            </FilterChip>
            {LEVEL_OPTIONS.map((v) => (
              <FilterChip key={v} active={level === v} onClick={() => setLevel(v)}>
                Lv {v}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mr-2">
              유형
            </span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-20 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
              조건에 맞는 과제가 없습니다.
            </div>
          ) : (
            filtered.map((p) => (
              <ProblemCard
                key={p.id}
                problem={p}
                href={p.status === "잠김" ? undefined : withPrefix(`/problems/${p.id}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

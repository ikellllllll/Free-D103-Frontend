"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { problemApi } from "@/lib/api/problemApi";
import type {
  ProblemCategory,
  ProblemLevel,
  ProblemStatus,
  ProblemSummary
} from "@/lib/types/problem";

const LEVEL_OPTIONS = [1, 2, 3] as const;
const CATEGORY_OPTIONS = ["API 구현", "버그 수정"] as const;

function SkeletonCard() {
  return (
    <div className="v3-plist-card v3-plist-card--skeleton" aria-busy="true">
      <div className="v3-plist-card__skeleton-line" style={{ width: "60%" }} />
      <div className="v3-plist-card__skeleton-line" style={{ width: "90%" }} />
      <div className="v3-plist-card__skeleton-line" style={{ width: "40%" }} />
    </div>
  );
}

function statusBadge(status: ProblemStatus) {
  if (status === "풀이한 문제") {
    return <span className="v3-plist-card__status v3-plist-card__status--done">✓ 풀이한 문제</span>;
  }
  if (status === "시도한 문제") {
    return <span className="v3-plist-card__status v3-plist-card__status--active">시도한 문제</span>;
  }
  if (status === "잠김") {
    return <span className="v3-plist-card__status v3-plist-card__status--locked">🔒 잠김</span>;
  }
  return <span className="v3-plist-card__status">미시작</span>;
}

function CardBody({ problem }: { problem: ProblemSummary }) {
  return (
    <>
      <div className="v3-plist-card__head">
        <span className="v3-plist-card__order">#{problem.order}</span>
        <span className={`v3-plist-card__level v3-plist-card__level--${problem.level}`}>
          Lv {problem.level}
        </span>
      </div>
      <h3 className="v3-plist-card__title">{problem.title}</h3>
      <p className="v3-plist-card__summary">{problem.summary}</p>
      <div className="v3-plist-card__foot">
        <span className="v3-plist-card__cat">{problem.category}</span>
        <span className="v3-plist-card__pass">{problem.passRate}% 통과율</span>
        {statusBadge(problem.status)}
      </div>
    </>
  );
}

export function ProblemListV3() {
  const { withPrefix } = useRouteScope();
  const [level, setLevel] = useState<ProblemLevel | "ALL">("ALL");
  const [category, setCategory] = useState<ProblemCategory | "ALL">("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["problems"],
    queryFn: () => problemApi.getProblems().catch(() => mockApi.getProblems())
  });

  const filtered = useMemo(() => {
    const base = data ?? [];
    return base.filter(
      (p) =>
        (level === "ALL" || p.level === level) &&
        (category === "ALL" || p.category === category)
    );
  }, [category, data, level]);

  return (
    <div className="v3-plist-page">
      {/* Hero */}
      <section className="v3-plist-hero">
        <span className="v3-plist-hero__badge">
          <span className="v3-plist-hero__badge-dot" />
          실무 과제 · {filtered.length}개
        </span>
        <h1 className="v3-plist-hero__title">
          AI와 함께 푸는
          <br />
          <span className="v3-plist-hero__accent">백엔드 실무 과제</span>
        </h1>
        <p className="v3-plist-hero__sub">
          API 구현부터 버그 수정까지, 난이도별로 엄선된 실무 시나리오입니다.
        </p>
      </section>

      {/* Filters */}
      <div className="v3-plist-filters">
        <div className="v3-plist-filter-group">
          <span className="v3-plist-filter-label">난이도</span>
          <div className="v3-plist-chips">
            <button
              type="button"
              className={`v3-plist-chip${level === "ALL" ? " v3-plist-chip--active" : ""}`}
              onClick={() => setLevel("ALL")}
            >
              전체
            </button>
            {LEVEL_OPTIONS.map((v) => (
              <button
                key={v}
                type="button"
                className={`v3-plist-chip${level === v ? " v3-plist-chip--active" : ""}`}
                onClick={() => setLevel(v)}
              >
                Lv {v}
              </button>
            ))}
          </div>
        </div>
        <div className="v3-plist-filter-group">
          <span className="v3-plist-filter-label">유형</span>
          <div className="v3-plist-chips">
            <button
              type="button"
              className={`v3-plist-chip${category === "ALL" ? " v3-plist-chip--active" : ""}`}
              onClick={() => setCategory("ALL")}
            >
              전체
            </button>
            {CATEGORY_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={`v3-plist-chip${category === item ? " v3-plist-chip--active" : ""}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="v3-plist-grid">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="v3-plist-empty">조건에 맞는 과제가 없습니다.</div>
        ) : (
          filtered.map((problem: ProblemSummary) =>
            problem.status === "잠김" ? (
              <div key={problem.id} className="v3-plist-card v3-plist-card--locked" aria-disabled>
                <CardBody problem={problem} />
              </div>
            ) : (
              <Link
                key={problem.id}
                href={withPrefix(`/problems/${problem.id}`)}
                className="v3-plist-card"
              >
                <CardBody problem={problem} />
              </Link>
            )
          )
        )}
      </div>
    </div>
  );
}

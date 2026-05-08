"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/common/Badge";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type { ProblemCategory, ProblemLevel, ProblemStatus, ProblemSummary } from "@/lib/types/problem";

const levelTone = { 1: "level1", 2: "level2", 3: "level3" } as const;
const levelAccent = { 1: "var(--level1)", 2: "var(--level2)", 3: "var(--level3)" } as const;

const statusTone: Record<ProblemStatus, "green" | "amber" | "neutral" | "red"> = {
  "풀이한 문제": "green",
  "시도한 문제": "amber",
  미시작: "neutral",
  잠김: "red"
};

function SkeletonRow() {
  return (
    <div className="plist-row" style={{ pointerEvents: "none", opacity: 0.4 }}>
      <span className="plist-row__order">—</span>
      <div className="plist-row__body">
        <div style={{ background: "var(--subtle-bg-2)", borderRadius: 4, height: "1em", width: "40%" }} />
        <div style={{ background: "var(--subtle-bg-2)", borderRadius: 4, height: "0.8em", width: "60%", marginTop: 6 }} />
      </div>
    </div>
  );
}

export function ProblemList() {
  const { withPrefix } = useRouteScope();
  const [level, setLevel] = useState<ProblemLevel | "ALL">("ALL");
  const [category, setCategory] = useState<ProblemCategory | "ALL">("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["problems"],
    queryFn: () => mockApi.getProblems()
  });

  const filtered = useMemo(() => {
    const base = data ?? [];
    return base.filter((p) => {
      return (level === "ALL" || p.level === level) && (category === "ALL" || p.category === category);
    });
  }, [category, data, level]);

  const rowContent = (problem: ProblemSummary) => (
    <>
      <span className="plist-row__order">{problem.order}</span>
      <div className="plist-row__body">
        <span className="plist-row__title">{problem.title}</span>
        <span className="plist-row__summary">{problem.summary}</span>
      </div>
      <div className="plist-row__meta">
        <Badge tone="neutral">{problem.category}</Badge>
        <Badge tone={levelTone[problem.level]}>Lv {problem.level}</Badge>
        {problem.status !== "잠김" && (
          <Badge tone={statusTone[problem.status]}>{problem.status}</Badge>
        )}
      </div>
      <span className="plist-row__pass">{problem.passRate}%</span>
      {problem.status !== "잠김" && <span className="plist-row__cta">→</span>}
    </>
  );

  return (
    <div className="stack-24">
      {/* ── Page header ── */}
      <div className="page-header">
        <p className="page-header__eyebrow">AIG · 과제 목록</p>
        <h1>실무 과제를 풀고<br />AI 활용 피드백을 받으세요.</h1>
        <p>API 구현부터 버그 수정까지, 난이도별로 고른 실무 시나리오입니다.</p>
      </div>

      {/* ── Filter row ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="filter-row">
          <button className={level === "ALL" ? "chip chip--active" : "chip"} onClick={() => setLevel("ALL")}>전체</button>
          {([1, 2, 3] as const).map((v) => (
            <button key={v} className={level === v ? "chip chip--active" : "chip"} onClick={() => setLevel(v)}>
              Lv {v}
            </button>
          ))}
          <span style={{ width: 1, height: 16, background: "var(--line)", margin: "0 2px" }} />
          <button className={category === "ALL" ? "chip chip--active" : "chip"} onClick={() => setCategory("ALL")}>전체 유형</button>
          {(["API 구현", "버그 수정"] as const).map((item) => (
            <button key={item} className={category === item ? "chip chip--active" : "chip"} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
        <span className="muted-copy" style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
          {filtered.length}개 과제
        </span>
      </div>

      {/* ── Row list ── */}
      <div className="plist-rows">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
          : filtered.map((problem: ProblemSummary) =>
              problem.status === "잠김" ? (
                <div
                  key={problem.id}
                  className="plist-row plist-row--locked"
                  style={{ "--plist-accent": levelAccent[problem.level] } as React.CSSProperties}
                >
                  {rowContent(problem)}
                </div>
              ) : (
                <Link
                  key={problem.id}
                  href={withPrefix(`/problems/${problem.id}`)}
                  className="plist-row"
                  style={{ "--plist-accent": levelAccent[problem.level] } as React.CSSProperties}
                >
                  {rowContent(problem)}
                </Link>
              )
            )}
      </div>
    </div>
  );
}

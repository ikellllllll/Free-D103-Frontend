"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import type { ProblemCategory, ProblemLevel, ProblemStatus, ProblemSummary } from "@/lib/types/problem";

const levelTone = {
  1: "level1",
  2: "level2",
  3: "level3"
} as const;

const statusTone: Record<ProblemStatus, "green" | "amber" | "neutral" | "red"> = {
  완료: "green",
  "진행 중": "amber",
  미시작: "neutral",
  잠김: "red"
};

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
    return base.filter((problem) => {
      const levelMatch = level === "ALL" || problem.level === level;
      const categoryMatch = category === "ALL" || problem.category === category;
      return levelMatch && categoryMatch;
    });
  }, [category, data, level]);

  return (
    <div className="stack-24">
      {/* ── Page header ── */}
      <div className="section-head">
        <div>
          <span className="eyebrow">AIG</span>
          <h1 style={{ margin: "8px 0 4px", fontSize: "1.25rem", fontWeight: 700 }}>과제 목록</h1>
          <p className="muted-copy">AI와 함께 실무 API 과제를 풀고 활용 피드백을 받으세요.</p>
        </div>
      </div>

      {/* ── Problem table ── */}
      <Card>
        {/* Filter row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap"
          }}
        >
          <div className="filter-row">
            <button className={level === "ALL" ? "chip chip--active" : "chip"} onClick={() => setLevel("ALL")}>
              전체
            </button>
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                className={level === value ? "chip chip--active" : "chip"}
                onClick={() => setLevel(value as ProblemLevel)}
              >
                Lv {value}
              </button>
            ))}
            <span style={{ width: 1, height: 16, background: "var(--line)", margin: "0 2px" }} />
            <button
              className={category === "ALL" ? "chip chip--active" : "chip"}
              onClick={() => setCategory("ALL")}
            >
              전체 유형
            </button>
            {(["API 구현", "버그 수정"] as const).map((item) => (
              <button
                key={item}
                className={category === item ? "chip chip--active" : "chip"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <span className="muted-copy" style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
            {filtered.length}개 과제
          </span>
        </div>

        {/* Table */}
        <div className="problem-table">
          <div className="problem-table__head">
            <span>#</span>
            <span>과제명</span>
            <span>레벨</span>
            <span>통과율</span>
            <span>상태</span>
            <span></span>
          </div>

          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="problem-row problem-row--skeleton">
                  <span>—</span>
                  <span>불러오는 중…</span>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ))
            : filtered.map((problem: ProblemSummary) => (
                <Link key={problem.id} href={withPrefix(`/problems/${problem.id}`)} className="problem-row">
                  <span className="problem-row__order">{problem.order}</span>
                  <span>
                    <strong>{problem.title}</strong>
                    <small>{problem.summary}</small>
                  </span>
                  <span>
                    <Badge tone={levelTone[problem.level]}>Lv {problem.level}</Badge>
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem" }}>
                    {problem.passRate}%
                  </span>
                  <span>
                    <Badge tone={statusTone[problem.status]}>{problem.status}</Badge>
                  </span>
                  <span className="problem-row__cta">
                    {problem.status === "잠김" ? "잠김" : "열어보기 →"}
                  </span>
                </Link>
              ))}
        </div>
      </Card>
    </div>
  );
}

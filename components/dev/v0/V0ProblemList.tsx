"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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

const LEVEL_LABEL: Record<number, string> = { 1: "입문", 2: "중급", 3: "고급" };

type SortId = (typeof SORT_OPTIONS)[number]["id"];

// Circular progress ring (SVG)
function LevelRing({ level }: { level: number }) {
  const radius = 14;
  const circ = 2 * Math.PI * radius;
  const pct = level / 3;
  const offset = circ * (1 - pct);
  return (
    <span className={`pvx-ring pvx-ring--lv${level}`} aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={radius} className="pvx-ring__track" />
        <circle
          cx="16"
          cy="16"
          r={radius}
          className="pvx-ring__fill"
          style={{ strokeDasharray: circ, strokeDashoffset: offset }}
        />
      </svg>
      <span className="pvx-ring__num">{level}</span>
    </span>
  );
}

function StatusPill({ status }: { status: ProblemStatus }) {
  if (status === "완료") {
    return (
      <span className="pvx-status pvx-status--done">
        <span className="pvx-status__dot" />
        완료
      </span>
    );
  }
  if (status === "진행 중") {
    return (
      <span className="pvx-status pvx-status--active">
        <span className="pvx-status__dot pvx-status__dot--pulse" />
        진행 중
      </span>
    );
  }
  if (status === "잠김") {
    return (
      <span className="pvx-status pvx-status--locked">
        <span className="pvx-status__dot" />
        잠김
      </span>
    );
  }
  return (
    <span className="pvx-status">
      <span className="pvx-status__dot" />
      미시작
    </span>
  );
}

// Glass card skeleton
function CardSkeleton({ i }: { i: number }) {
  return (
    <div
      className="pvx-card pvx-card--skeleton"
      style={{ ["--i" as string]: i }}
      aria-busy="true"
    >
      <div className="pvx-card__head">
        <div className="pvx-skel pvx-skel--ring" />
        <div className="pvx-skel pvx-skel--chip" />
      </div>
      <div className="pvx-skel pvx-skel--title" />
      <div className="pvx-skel pvx-skel--line" />
      <div className="pvx-skel pvx-skel--line pvx-skel--short" />
      <div className="pvx-card__foot">
        <div className="pvx-skel pvx-skel--bar" />
      </div>
    </div>
  );
}

export function ProblemListV3() {
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
    const s = search.trim().toLowerCase();
    const base = all.filter(
      (p) =>
        (level === "ALL" || p.level === level) &&
        (category === "ALL" || p.category === category) &&
        (status === "ALL" || p.status === status) &&
        (s === "" ||
          p.title.toLowerCase().includes(s) ||
          p.summary.toLowerCase().includes(s))
    );
    const sorted = [...base];
    switch (sort) {
      case "pass-desc": sorted.sort((a, b) => b.passRate - a.passRate); break;
      case "pass-asc":  sorted.sort((a, b) => a.passRate - b.passRate); break;
      case "level-asc": sorted.sort((a, b) => a.level - b.level); break;
      case "level-desc":sorted.sort((a, b) => b.level - a.level); break;
    }
    return sorted;
  }, [all, search, level, category, status, sort]);

  // Stats
  const stats = useMemo(() => {
    const total = all.length;
    const done = all.filter((p) => p.status === "완료").length;
    const inProgress = all.filter((p) => p.status === "진행 중").length;
    const avgPass = total
      ? Math.round(all.reduce((sum, p) => sum + p.passRate, 0) / total)
      : 0;
    return { total, done, inProgress, avgPass };
  }, [all]);

  return (
    <div className="pvx-shell pvx-shell--nested">
      <div className="pvx-container">
        {/* HERO */}
        <header className="pvx-hero">
          <div className="pvx-hero__top">
            <div className="pvx-hero__eyebrow">
              <span className="pvx-hero__eyebrow-dot" />
              PROBLEMS · BACKEND
            </div>
            <h1 className="pvx-hero__title">
              실무 과제로 <span className="pvx-hero__title-accent">다음 레벨</span>로.
            </h1>
            <p className="pvx-hero__desc">
              AI와 함께 API 구현부터 버그 수정까지. 실제 백엔드 환경에서 벌어지는 문제들을 하나씩 풀어내세요.
            </p>
          </div>

          {/* Stat row — glassmorphism */}
          <div className="pvx-stats">
            <StatCard label="전체 과제"   value={stats.total}      suffix="개" i={0} />
            <StatCard label="완료"        value={stats.done}       suffix="개" accent="good" i={1} />
            <StatCard label="진행 중"     value={stats.inProgress} suffix="개" accent="active" i={2} />
            <StatCard label="평균 통과율" value={stats.avgPass}    suffix="%" accent="info" i={3} />
          </div>
        </header>

        {/* CONTROLS */}
        <section className="pvx-controls" aria-label="검색 및 필터">
          <div className="pvx-searchbar">
            <svg className="pvx-searchbar__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              className="pvx-searchbar__input"
              placeholder="제목이나 설명으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="pvx-searchbar__clear" onClick={() => setSearch("")} aria-label="검색어 지우기">
                ×
              </button>
            )}
            <kbd className="pvx-searchbar__kbd">⌘K</kbd>
          </div>

          <div className="pvx-sort">
            <label htmlFor="pvx-sort" className="pvx-sort__label">정렬</label>
            <select
              id="pvx-sort"
              className="pvx-sort__select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </section>

        {/* FILTERS */}
        <section className="pvx-filters" aria-label="필터">
          <FilterGroup label="난이도">
            <FilterChip active={level === "ALL"} onClick={() => setLevel("ALL")}>전체</FilterChip>
            {LEVEL_OPTIONS.map((v) => (
              <FilterChip key={v} active={level === v} onClick={() => setLevel(v)}>
                Lv {v} <span className="pvx-chip__sub">{LEVEL_LABEL[v]}</span>
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="유형">
            <FilterChip active={category === "ALL"} onClick={() => setCategory("ALL")}>전체</FilterChip>
            {CATEGORY_OPTIONS.map((item) => (
              <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>{item}</FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="상태">
            <FilterChip active={status === "ALL"} onClick={() => setStatus("ALL")}>전체</FilterChip>
            {STATUS_OPTIONS.map((item) => (
              <FilterChip key={item} active={status === item} onClick={() => setStatus(item)}>{item}</FilterChip>
            ))}
          </FilterGroup>

          <div className="pvx-filters__count">
            <strong>{filtered.length}</strong>
            <span>/ {all.length}</span>
          </div>
        </section>

        {/* GRID */}
        <section className="pvx-grid-wrap" aria-label="과제 목록">
          {isLoading ? (
            <div className="pvx-grid">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} i={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="pvx-empty">
              <div className="pvx-empty__illus" aria-hidden="true">
                <div className="pvx-empty__circle" />
                <div className="pvx-empty__circle pvx-empty__circle--2" />
              </div>
              <h3 className="pvx-empty__title">조건에 맞는 과제가 없어요</h3>
              <p className="pvx-empty__desc">필터를 조정하거나 검색어를 지워보세요.</p>
              <button
                type="button"
                className="pvx-empty__cta"
                onClick={() => {
                  setSearch(""); setLevel("ALL"); setCategory("ALL"); setStatus("ALL");
                }}
              >
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="pvx-grid">
              {filtered.map((problem: ProblemSummary, i) => (
                <ProblemCard key={problem.id} problem={problem} href={withPrefix(`/problems/${problem.id}`)} i={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label, value, suffix, accent, i
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: "good" | "active" | "info";
  i: number;
}) {
  return (
    <div
      className={"pvx-stat" + (accent ? ` pvx-stat--${accent}` : "")}
      style={{ ["--i" as string]: i }}
    >
      <span className="pvx-stat__label">{label}</span>
      <span className="pvx-stat__val">
        <span className="pvx-stat__num">{value}</span>
        {suffix && <span className="pvx-stat__suf">{suffix}</span>}
      </span>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pvx-fg">
      <span className="pvx-fg__label">{label}</span>
      <div className="pvx-fg__chips">{children}</div>
    </div>
  );
}

function FilterChip({
  active, onClick, children
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={"pvx-chip" + (active ? " pvx-chip--on" : "")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ProblemCard({
  problem, href, i
}: {
  problem: ProblemSummary;
  href: string;
  i: number;
}) {
  const locked = problem.status === "잠김";
  const inner = (
    <>
      <div className="pvx-card__sheen" aria-hidden="true" />
      <div className="pvx-card__head">
        <LevelRing level={problem.level} />
        <span className="pvx-card__order">#{problem.order}</span>
        <StatusPill status={problem.status} />
      </div>

      <div className="pvx-card__body">
        <h3 className="pvx-card__title">{problem.title}</h3>
        <p className="pvx-card__desc">{problem.summary}</p>
      </div>

      <div className="pvx-card__meta">
        <span className="pvx-card__cat">{problem.category}</span>
        <span className="pvx-card__dot" aria-hidden="true">·</span>
        <span className="pvx-card__est">{problem.estimate}</span>
      </div>

      <div className="pvx-card__foot">
        <div className="pvx-card__bar">
          <div className="pvx-card__bar-label">
            <span>통과율</span>
            <strong>{problem.passRate}%</strong>
          </div>
          <div className="pvx-card__bar-track">
            <div
              className={"pvx-card__bar-fill " +
                (problem.passRate >= 70 ? "pvx-card__bar-fill--hi" :
                 problem.passRate >= 40 ? "pvx-card__bar-fill--mid" :
                 "pvx-card__bar-fill--lo")}
              style={{ width: `${problem.passRate}%` }}
            />
          </div>
        </div>

        <span className="pvx-card__arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
    </>
  );

  if (locked) {
    return (
      <div
        className="pvx-card pvx-card--locked"
        style={{ ["--i" as string]: i }}
        aria-disabled="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="pvx-card"
      style={{ ["--i" as string]: i }}
    >
      {inner}
    </Link>
  );
}

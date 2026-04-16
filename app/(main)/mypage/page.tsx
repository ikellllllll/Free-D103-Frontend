"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";

interface HistoryItem {
  id: string;
  title: string;
  date: string;
  passRate: string;
  aiUsage: string;
  href: string;
}

interface ResumableSession {
  sessionId: string;
  title: string;
  level: 1 | 2 | 3;
  category: string;
  aiRequestCount: number;
  lastSavedAt: string;
  href: string;
}

interface AvgScore {
  label: string;
  score: number;
  tone: "good" | "mid" | "warn";
}

interface LevelBreakdown {
  level: 1 | 2 | 3;
  total: number;
  completed: number;
}

const TONE_CLASS: Record<"good" | "mid" | "warn", string> = {
  good: "progress-bar__fill--good",
  mid: "progress-bar__fill--mid",
  warn: "progress-bar__fill--warn"
};

const LEVEL_LABEL: Record<1 | 2 | 3, string> = { 1: "Lv 1", 2: "Lv 2", 3: "Lv 3" };

export default function MyPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const { data } = useQuery({
    queryKey: ["mypage", user?.id],
    queryFn: () => mockApi.getMyDashboard(user!.id),
    enabled: !!user
  });

  const resumableSessions = (data?.resumableSessions ?? []) as ResumableSession[];
  const avgScores = (data?.avgScores ?? []) as AvgScore[];
  const levelBreakdown = (data?.levelBreakdown ?? []) as LevelBreakdown[];
  const history = (data?.history ?? []) as HistoryItem[];

  return (
    <div className="stack-24">
      {/* 프로필 + 통계 */}
      <Card className="profile-card">
        <div className="profile-card__main">
          <span className="profile-avatar profile-avatar--lg">{data?.user.name.slice(0, 1) ?? "H"}</span>
          <div className="profile-card__info">
            <span className="eyebrow">마이페이지</span>
            <h1>{data?.user.name ?? "홍길동"}</h1>
            <p className="muted-copy">{data?.user.email ?? "user@email.com"} · AIG 실습 계정</p>
          </div>
        </div>

        <div className="stats-grid">
          {(data?.stats ?? []).map((stat) => (
            <Card key={stat.label} className="stat-card">
              <span className="stat-card__label">{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </Card>
          ))}
        </div>

        {/* 난이도별 진행 현황 */}
        {levelBreakdown.length > 0 && (
          <div className="level-breakdown">
            {levelBreakdown.map(({ level, total, completed }) => (
              <div key={level} className="level-breakdown__row">
                <span className="level-breakdown__label">{LEVEL_LABEL[level]}</span>
                <div className="progress-bar progress-bar--soft level-breakdown__bar">
                  <span style={{ width: total > 0 ? `${(completed / total) * 100}%` : "0%" }} />
                </div>
                <span className="level-breakdown__count">{completed} / {total}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 진행 중 세션 — 이어하기 */}
      {resumableSessions.length > 0 && (
        <Card>
          <div className="section-head">
            <div>
              <span className="eyebrow">진행 중</span>
              <h2>이어서 풀기</h2>
            </div>
          </div>

          <div className="resume-list">
            {resumableSessions.map((item) => (
              <div key={item.sessionId} className="resume-row">
                <div className="resume-row__info">
                  <strong>{item.title}</strong>
                  <small>Lv {item.level} · {item.category} · AI {item.aiRequestCount}회</small>
                </div>
                <Link href={withPrefix(item.href)} className="chip chip--accent">
                  이어하기
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 역량 점수 — 완료된 리포트가 있을 때만 */}
      {avgScores.length > 0 && (
        <Card>
          <div className="section-head">
            <div>
              <span className="eyebrow">역량</span>
              <h2>AI 활용 점수</h2>
            </div>
            <small className="muted-copy">{data?.history?.length ?? 0}회 제출 평균</small>
          </div>

          <div className="score-summary">
            {avgScores.map((item) => (
              <div key={item.label} className="score-row">
                <div className="score-row__head">
                  <span>{item.label}</span>
                  <strong>{item.score}</strong>
                </div>
                <div className="progress-bar">
                  <span
                    className={TONE_CLASS[item.tone]}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 제출 이력 */}
      <Card>
        <div className="section-head">
          <div>
            <span className="eyebrow">이력</span>
            <h2>제출 이력</h2>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="muted-copy" style={{ padding: "16px 0" }}>아직 제출한 과제가 없어요.</p>
        ) : (
          <div className="history-table">
            <div className="history-row history-row--head">
              <span>과제</span>
              <span>제출일</span>
              <span>통과율</span>
              <span>AI 활용</span>
              <span>열기</span>
            </div>

            {history.map((item) => (
              <div key={`${item.title}-${item.date}`} className="history-row">
                <span>{item.title}</span>
                <span>{item.date}</span>
                <span>{item.passRate}</span>
                <span>{item.aiUsage}</span>
                <Link href={withPrefix(item.href)} className="text-link">
                  열기
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

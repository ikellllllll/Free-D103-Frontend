"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";

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

const BYOK_PROVIDERS = [
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "google", label: "Google AI", placeholder: "AIza..." },
  { id: "mistral", label: "Mistral", placeholder: "..." }
] as const;

type ProviderId = (typeof BYOK_PROVIDERS)[number]["id"];

const BYOK_STORAGE_KEY = "aig-byok-keys-v1";

function loadByokKeys(): Partial<Record<ProviderId, string>> {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveByokKeys(keys: Partial<Record<ProviderId, string>>) {
  localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(keys));
}

function ByokSection() {
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>(() => loadByokKeys());
  const [saved, setSaved] = useState(false);

  const handleChange = (id: ProviderId, value: string) => {
    setKeys((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveByokKeys(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <div className="section-head">
        <div>
          <span className="eyebrow">API 키</span>
          <h2>BYOK — AI 제공자 키</h2>
          <p className="muted-copy" style={{ marginTop: 4 }}>
            직접 보유한 API 키를 등록하면 해당 AI 모델을 사용할 수 있습니다.
            키는 브라우저 로컬 스토리지에만 저장되며 서버로 전송되지 않습니다.
          </p>
        </div>
      </div>

      <div className="byok-grid">
        {BYOK_PROVIDERS.map(({ id, label, placeholder }) => (
          <div key={id} className="byok-row">
            <label className="byok-row__label" htmlFor={`byok-${id}`}>{label}</label>
            <input
              id={`byok-${id}`}
              type="password"
              className="byok-row__input"
              placeholder={placeholder}
              value={keys[id] ?? ""}
              onChange={(e) => handleChange(id, e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}
      </div>

      <div className="byok-actions">
        <button type="button" className="button button--primary" onClick={handleSave}>
          {saved ? "저장됨 ✓" : "저장"}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            const empty: Partial<Record<ProviderId, string>> = {};
            setKeys(empty);
            saveByokKeys(empty);
          }}
        >
          전체 삭제
        </button>
      </div>
    </Card>
  );
}

export default function MyPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const { data } = useQuery({
    queryKey: ["mypage", user?.id],
    queryFn: () => mockApi.getMyDashboard(user!.id),
    enabled: !!user
  });

  const avgScores = (data?.avgScores ?? []) as AvgScore[];
  const levelBreakdown = (data?.levelBreakdown ?? []) as LevelBreakdown[];

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

      {/* 풀이 기록 바로가기 */}
      <Card>
        <div className="section-head">
          <div>
            <span className="eyebrow">풀이</span>
            <h2>풀이 기록</h2>
            <p className="muted-copy" style={{ marginTop: 4 }}>
              진행 중이거나 완료한 과제 풀이 목록을 확인할 수 있습니다.
            </p>
          </div>
          <Link href={withPrefix("/sessions")} className="button button--primary">
            풀이 기록 보기
          </Link>
        </div>
      </Card>

      {/* BYOK */}
      <ByokSection />
    </div>
  );
}

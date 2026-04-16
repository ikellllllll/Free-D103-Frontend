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
    <Card className="mp-card">
      <div className="mp-card__head">
        <span className="eyebrow">API 키</span>
        <h2 className="mp-card__title">BYOK</h2>
      </div>
      <div className="byok-compact-grid">
        {BYOK_PROVIDERS.map(({ id, label, placeholder }) => (
          <div key={id} className="byok-compact-row">
            <label className="byok-compact-label" htmlFor={`byok-${id}`}>{label}</label>
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
      <div className="mp-card__foot">
        <button type="button" className="button button--primary button--sm" onClick={handleSave}>
          {saved ? "저장됨 ✓" : "저장"}
        </button>
        <button
          type="button"
          className="button button--sm"
          onClick={() => { const e: Partial<Record<ProviderId, string>> = {}; setKeys(e); saveByokKeys(e); }}
        >
          초기화
        </button>
        <span className="mp-byok-note">키는 브라우저에만 저장됩니다.</span>
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
    <div className="stack-16">
      {/* ── 프로필 카드 ── */}
      <Card className="mp-profile">
        <div className="mp-profile__left">
          <span className="profile-avatar">{data?.user.name.slice(0, 1) ?? "H"}</span>
          <div className="mp-profile__info">
            <span className="eyebrow">마이페이지</span>
            <h1 className="mp-profile__name">{data?.user.name ?? "홍길동"}</h1>
            <p className="muted-copy mp-profile__sub">{data?.user.email ?? "user@email.com"} · AIG 실습 계정</p>
          </div>
        </div>

        <div className="mp-profile__right">
          {/* 인라인 통계 */}
          <div className="mp-stats">
            {(data?.stats ?? []).map((stat) => (
              <div key={stat.label} className="mp-stat">
                <strong className="mp-stat__val">{stat.value}</strong>
                <span className="mp-stat__label">{stat.label}</span>
                <span className="mp-stat__note">{stat.note}</span>
              </div>
            ))}
          </div>

          {/* 레벨별 */}
          {levelBreakdown.length > 0 && (
            <div className="mp-levels">
              {levelBreakdown.map(({ level, total, completed }) => (
                <div key={level} className="mp-level-row">
                  <span className="mp-level-row__lv">Lv {level}</span>
                  <div className="progress-bar progress-bar--soft mp-level-row__bar">
                    <span style={{ width: total > 0 ? `${(completed / total) * 100}%` : "0%" }} />
                  </div>
                  <span className="mp-level-row__cnt">{completed}/{total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ── 하단 2열 ── */}
      <div className="mp-bottom">
        {/* AI 활용 점수 */}
        {avgScores.length > 0 && (
          <Card className="mp-card">
            <div className="mp-card__head">
              <span className="eyebrow">역량</span>
              <h2 className="mp-card__title">AI 활용 점수</h2>
              <span className="muted-copy mp-card__sub">{data?.history?.length ?? 0}회 제출 평균</span>
            </div>
            <div className="mp-scores">
              {avgScores.map((item) => (
                <div key={item.label} className="mp-score-row">
                  <div className="mp-score-row__head">
                    <span>{item.label}</span>
                    <strong>{item.score}</strong>
                  </div>
                  <div className="progress-bar progress-bar--soft">
                    <span className={TONE_CLASS[item.tone]} style={{ width: `${item.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 풀이 기록 바로가기 */}
        <Card className="mp-card mp-sessions-card">
          <div className="mp-card__head">
            <span className="eyebrow">풀이</span>
            <h2 className="mp-card__title">풀이 기록</h2>
            <span className="muted-copy mp-card__sub">진행 중·완료 과제 목록</span>
          </div>
          <Link href={withPrefix("/sessions")} className="button button--primary mp-sessions-btn">
            풀이 기록 보기 →
          </Link>
        </Card>

        {/* BYOK */}
        <ByokSection />
      </div>
    </div>
  );
}

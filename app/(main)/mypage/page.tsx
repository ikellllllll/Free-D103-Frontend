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

// 점수별 툴팁 설명
const SCORE_TIPS: Record<string, string> = {
  "하네스 품질 점수": "HARNESS.md에 작성된 에이전트 지시 품질과 문제 문맥 명확성을 평가합니다.",
  "실행 품질 점수": "AI 제안 코드를 실행·테스트로 검증하고 결과를 코드에 반영한 정도를 측정합니다.",
  "트레이스 활용 점수": "에이전트 실행 트레이스를 얼마나 활용하고 디버깅에 적용했는지 평가합니다."
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

function ScoreTooltip({ label }: { label: string }) {
  const tip = SCORE_TIPS[label];
  if (!tip) return null;
  return (
    <span className="mp-tooltip-wrap" aria-label={tip}>
      <span className="mp-tooltip-icon">?</span>
      <span className="mp-tooltip-bubble">{tip}</span>
    </span>
  );
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
        <p className="muted-copy mp-card__sub">키는 브라우저 로컬 스토리지에만 저장됩니다.</p>
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
          onClick={() => {
            const e: Partial<Record<ProviderId, string>> = {};
            setKeys(e);
            saveByokKeys(e);
          }}
        >
          초기화
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
    <div className="stack-16">
      {/* ── 프로필 카드 ── */}
      <Card className="mp-profile">
        {/* 좌: 아바타 + 이름 */}
        <div className="mp-profile__left">
          <span className="profile-avatar">{data?.user.name.slice(0, 1) ?? "H"}</span>
          <div className="mp-profile__info">
            <span className="eyebrow">마이페이지</span>
            <h1 className="mp-profile__name">{data?.user.name ?? "홍길동"}</h1>
            <p className="muted-copy mp-profile__sub">{data?.user.email ?? "user@email.com"} · AIG 실습 계정</p>
          </div>
        </div>

        {/* 우: 통계 */}
        <div className="mp-stats">
          {(data?.stats ?? []).map((stat) => (
            <div key={stat.label} className="mp-stat">
              <strong className="mp-stat__val">{stat.value}</strong>
              <span className="mp-stat__label">{stat.label}</span>
              <span className="mp-stat__note">{stat.note}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── 하단 2열 ── */}
      <div className="mp-bottom">
        {/* AI 활용 점수 */}
        <Card className="mp-card">
          <div className="mp-card__head">
            <span className="eyebrow">역량</span>
            <h2 className="mp-card__title">AI 활용 점수</h2>
            <span className="muted-copy mp-card__sub">{data?.history?.length ?? 0}회 제출 평균</span>
          </div>
          {avgScores.length === 0 ? (
            <p className="muted-copy" style={{ fontSize: "0.82rem" }}>제출 완료 후 점수가 집계됩니다.</p>
          ) : (
            <div className="mp-scores">
              {avgScores.map((item) => (
                <div key={item.label} className="mp-score-row">
                  <div className="mp-score-row__head">
                    <span className="mp-score-row__name">
                      {item.label}
                      <ScoreTooltip label={item.label} />
                    </span>
                    <strong>{item.score}</strong>
                  </div>
                  <div className="progress-bar progress-bar--soft">
                    <span className={TONE_CLASS[item.tone]} style={{ width: `${item.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 풀이 기록 + 레벨별 현황 */}
        <Card className="mp-card">
          <div className="mp-card__head">
            <span className="eyebrow">풀이</span>
            <h2 className="mp-card__title">풀이 기록</h2>
            <span className="muted-copy mp-card__sub">진행 중·완료 과제 목록</span>
          </div>

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

          <Link href={withPrefix("/sessions")} className="button button--primary button--sm mp-sessions-btn">
            풀이 기록 보기 →
          </Link>
        </Card>
      </div>

      {/* ── BYOK ── */}
      <ByokSection />
    </div>
  );
}

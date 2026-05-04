"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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

const BYOK_PROVIDERS = [
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." }
] as const;

type ProviderId = (typeof BYOK_PROVIDERS)[number]["id"];
const BYOK_STORAGE_KEY = "aig-byok-keys-v1";

function loadByokKeys(): Partial<Record<ProviderId, string>> {
  try { const raw = localStorage.getItem(BYOK_STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function saveByokKeys(keys: Partial<Record<ProviderId, string>>) {
  localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(keys));
}

const SCORE_TIPS: Record<string, string> = {
  "하네스 품질 점수": "HARNESS.md에 작성된 에이전트 지시 품질과 문제 문맥 명확성을 평가합니다.",
  "실행 품질 점수": "AI 제안 코드를 실행·테스트로 검증하고 결과를 코드에 반영한 정도를 측정합니다.",
  "트레이스 활용 점수": "에이전트 실행 트레이스를 얼마나 활용하고 디버깅에 적용했는지 평가합니다."
};

function ByokSection() {
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>(() => loadByokKeys());
  const [saved, setSaved] = useState(false);

  const handleChange = (id: ProviderId, value: string) => { setKeys((prev) => ({ ...prev, [id]: value })); setSaved(false); };
  const handleSave = () => { saveByokKeys(keys); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <section className="mp3-section">
      <div className="mp3-section__head">
        <p className="mp3-section__eyebrow">API 키</p>
        <h2 className="mp3-section__title">BYOK</h2>
        <p className="mp3-section__desc">키는 브라우저 로컬 스토리지에만 저장됩니다.</p>
      </div>
      <div className="mp3-byok-grid">
        {BYOK_PROVIDERS.map(({ id, label, placeholder }) => (
          <div key={id} className="mp3-byok-row">
            <label className="mp3-byok-label" htmlFor={`byok-${id}`}>{label}</label>
            <input
              id={`byok-${id}`}
              type="password"
              className="mp3-byok-input"
              placeholder={placeholder}
              value={keys[id] ?? ""}
              onChange={(e) => handleChange(id, e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}
      </div>
      <div className="mp3-byok-foot">
        <button type="button" className="mp3-btn mp3-btn--primary" onClick={handleSave}>
          {saved ? "저장됨" : "저장"}
        </button>
        <button type="button" className="mp3-btn" onClick={() => { const e: Partial<Record<ProviderId, string>> = {}; setKeys(e); saveByokKeys(e); }}>
          초기화
        </button>
      </div>
    </section>
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
    <div className="mp3-page">
      {/* 헤더 */}
      <header className="mp3-page-header">
        <p className="mp3-page-header__eyebrow">마이페이지</p>
        <h1 className="mp3-page-header__title">내 프로필</h1>
      </header>

      {/* 프로필 카드 */}
      <section className="mp3-profile">
        <div className="mp3-profile__left">
          <span className="mp3-avatar">{data?.user.name.slice(0, 1) ?? "H"}</span>
          <div>
            <p className="mp3-profile__name">{data?.user.name ?? "홍길동"}</p>
            <p className="mp3-profile__email">{data?.user.email ?? "user@email.com"} · AIG 실습 계정</p>
          </div>
        </div>
        <div className="mp3-stats">
          {(data?.stats ?? []).map((stat) => (
            <div key={stat.label} className="mp3-stat">
              <strong className="mp3-stat__val">{stat.value}</strong>
              <span className="mp3-stat__label">{stat.label}</span>
              {stat.note ? <span className="mp3-stat__note">{stat.note}</span> : null}
            </div>
          ))}
        </div>
      </section>

      {/* 하단 2열 */}
      <div className="mp3-grid">
        {/* AI 활용 점수 */}
        <section className="mp3-section">
          <div className="mp3-section__head">
            <p className="mp3-section__eyebrow">역량</p>
            <h2 className="mp3-section__title">AI 활용 점수</h2>
            <p className="mp3-section__desc">{data?.history?.length ?? 0}회 제출 평균</p>
          </div>
          {avgScores.length === 0 ? (
            <p className="mp3-empty-text">제출 완료 후 점수가 집계됩니다.</p>
          ) : (
            <div className="mp3-scores">
              {avgScores.map((item) => (
                <div key={item.label} className="mp3-score-row">
                  <div className="mp3-score-row__head">
                    <span className="mp3-score-row__name" title={SCORE_TIPS[item.label] ?? ""}>{item.label}</span>
                    <strong className="mp3-score-row__val">{item.score}</strong>
                  </div>
                  <div className="mp3-bar">
                    <div className={"mp3-bar__fill mp3-bar__fill--" + item.tone} style={{ width: `${item.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 풀이 현황 */}
        <section className="mp3-section">
          <div className="mp3-section__head">
            <p className="mp3-section__eyebrow">풀이</p>
            <h2 className="mp3-section__title">풀이 현황</h2>
            <p className="mp3-section__desc">레벨별 완료 비율</p>
          </div>
          {levelBreakdown.length > 0 ? (
            <div className="mp3-levels">
              {levelBreakdown.map(({ level, total, completed }) => (
                <div key={level} className="mp3-level-row">
                  <span className="mp3-level-row__lv">Lv {level}</span>
                  <div className="mp3-bar mp3-level-row__bar">
                    <div className="mp3-bar__fill" style={{ width: total > 0 ? `${(completed / total) * 100}%` : "0%" }} />
                  </div>
                  <span className="mp3-level-row__cnt">{completed}<span className="mp3-level-row__total">/{total}</span></span>
                </div>
              ))}
            </div>
          ) : null}
          <Link href={withPrefix("/sessions")} className="mp3-btn mp3-btn--primary mp3-sessions-link">
            풀이 기록 보기 →
          </Link>
        </section>
      </div>

      {/* BYOK */}
      <ByokSection />
    </div>
  );
}

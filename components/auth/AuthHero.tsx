import { type ReactNode } from "react";

interface AuthHeroProps {
  title: ReactNode;
  description: string;
}

const specs = [
  {
    label: "실습 범위",
    value: "백엔드 과제 5종",
    note: "API 구현부터 버그 수정까지"
  },
  {
    label: "기록 단위",
    value: "세션 / Trace",
    note: "질문, 수정, 실행 내역 축적"
  },
  {
    label: "결과물",
    value: "피드백 리포트",
    note: "제출 결과와 풀이 흐름 분석"
  }
];

function AuthThemeLogo() {
  return (
    <svg
      className="auth-theme-logo"
      width="320"
      height="92"
      viewBox="110 65 960 275"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AIGround"
      role="img"
    >
      <text
        x="130"
        y="218"
        fill="var(--v3-teal, var(--accent))"
        fontSize="188"
        fontWeight="800"
        fontFamily="'Segoe UI', Arial, sans-serif"
        letterSpacing="-6"
      >
        AIG
      </text>
      <text
        x="470"
        y="218"
        fill="var(--v3-sage, var(--accent-strong))"
        fontSize="128"
        fontWeight="600"
        fontFamily="'Segoe UI', Arial, sans-serif"
        letterSpacing="-3"
      >
        round
      </text>
      <rect x="132" y="250" width="925" height="5" rx="2.5" fill="var(--v3-mint, var(--text))" />
      <text
        x="132"
        y="314"
        fill="var(--v3-mint-dim, var(--muted))"
        fontSize="46"
        fontWeight="500"
        fontFamily="'Segoe UI', Arial, sans-serif"
        letterSpacing="8"
      >
        AI-BASED INTEGRATED GROUND
      </text>
    </svg>
  );
}

export function AuthHero({ title, description }: AuthHeroProps) {
  return (
    <aside className="auth-hero">
      <div className="auth-hero__top">
        <AuthThemeLogo />
      </div>

      <div className="auth-hero__body">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="auth-spec-list">
        {specs.map((spec) => (
          <div key={spec.label} className="auth-spec">
            <span>{spec.label}</span>
            <strong>{spec.value}</strong>
            <small>{spec.note}</small>
          </div>
        ))}
      </div>

      <p className="auth-hero__foot">SSAFY 14기 자율 프로젝트</p>
    </aside>
  );
}

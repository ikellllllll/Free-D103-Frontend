interface AuthHeroProps {
  title: string;
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

export function AuthHero({ title, description }: AuthHeroProps) {
  return (
    <aside className="auth-hero">
      <div className="auth-hero__top">
        <span className="auth-hero__eyebrow">AIG</span>
        <p>AI 기반 코딩 과제 워크스페이스</p>
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

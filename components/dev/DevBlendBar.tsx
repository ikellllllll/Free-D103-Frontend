const referenceItems = [
  {
    label: "Cursor",
    note: "워크벤치, 사이드바, 에디터 밀도"
  },
  {
    label: "Linear",
    note: "절제된 타이포와 정돈된 리스트"
  },
  {
    label: "Sentry",
    note: "리포트, 타임라인, 데이터 패널"
  }
];

export function DevBlendBar({ mode = "main" }: { mode?: "main" | "auth" }) {
  return (
    <section className={`dev-blend-bar dev-blend-bar--${mode}`}>
      <div className="dev-blend-bar__lead">
        <span className="dev-blend-bar__label">AIG / Dev Blend</span>
        <strong>Cursor + Linear + Sentry</strong>
        <p>업무용 워크벤치의 밀도, 차분한 생산성 툴 톤, 분석 패널의 정보량을 병합한 실험 버전입니다.</p>
      </div>

      <div className="dev-reference-strip" aria-label="레퍼런스 조합">
        {referenceItems.map((item) => (
          <div key={item.label} className="dev-reference-chip">
            <span>{item.label}</span>
            <small>{item.note}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

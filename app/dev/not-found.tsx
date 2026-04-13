import Link from "next/link";

export default function DevNotFound() {
  return (
    <main className="center-screen design-dev">
      <div className="empty-state empty-state--dev">
        <span className="eyebrow">DEV 404</span>
        <h1>실험 버전에서 찾을 수 없는 화면입니다.</h1>
        <p className="muted-copy">`/dev` 아래 경로를 다시 확인하거나, 기존 라우트에서 시작하세요.</p>
        <Link href="/dev/problems" className="button button--primary">
          dev 과제 목록으로 이동
        </Link>
      </div>
    </main>
  );
}

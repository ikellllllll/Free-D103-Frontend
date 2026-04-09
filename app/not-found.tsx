import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-screen">
      <div className="empty-state">
        <span className="eyebrow">404</span>
        <h1>찾을 수 없는 화면입니다.</h1>
        <p className="muted-copy">과제 ID 또는 세션 경로가 올바르지 않거나 더 이상 존재하지 않습니다.</p>
        <Link href="/problems" className="button button--primary">
          과제 목록으로 이동
        </Link>
      </div>
    </main>
  );
}

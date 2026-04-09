"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="center-screen">
      <div className="empty-state">
        <span className="eyebrow">오류</span>
        <h1>예상하지 못한 문제가 발생했습니다.</h1>
        <p className="muted-copy">{error.message}</p>
        <button className="button button--primary" onClick={reset}>
          다시 시도
        </button>
      </div>
    </main>
  );
}

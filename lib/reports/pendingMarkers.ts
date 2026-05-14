/**
 * /reports 페이지에서 사용하는 "진행 중/실패" 리포트 마커 — localStorage 기반.
 *
 * 역할: endSession 시점에 사용자가 곧장 /reports 로 이동해도 "생성 중" 카드가 보이도록
 * 클라이언트 측에서 임시 마커를 박아둠. 실제 상태는 백엔드 endpoint 로 확인.
 *
 * 상태 전이 (2026-05-14~):
 *  - GET /api/v1/sessions/{id}/report-status 응답으로 GENERATED → 마커 제거 (리포트 리스트에 노출).
 *  - 같은 endpoint 응답으로 FAILED → 마커 status=FAILED 로 갱신 (재시도 버튼 노출).
 *  - 5 분 클라이언트 timeout 은 endpoint 가 답을 못 줄 때만 동작하는 안전 fallback.
 *
 * 이 marker 자체는 폴링 중 상태를 UI 에 매끄럽게 잇기 위한 보조 캐시 — 백엔드가 PENDING/
 * PROCEEDING/FAILED 도 GET /users/me/reports 응답에 포함하기 시작하면 점진 제거 가능.
 */

export interface PendingReportMarker {
  problemSessionId: number;
  problemTitle?: string;
  problemId?: number;
  status: "PENDING" | "PROCEEDING" | "FAILED";
  startedAt: string;
}

const STORAGE_KEY = "aig-pending-reports-v1";

export function loadPendingMarkers(): PendingReportMarker[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePendingMarkers(markers: PendingReportMarker[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
  } catch {
    /* quota / security 예외 흡수 — marker 저장 실패해도 세션 종료 흐름은 계속 */
  }
}

export function addPendingReportMarker(input: {
  problemSessionId: number;
  problemTitle?: string;
  problemId?: number;
}) {
  if (typeof window === "undefined") return;
  const current = loadPendingMarkers();
  // 같은 session 이 이미 있으면 그대로 (재진입 안전).
  if (current.find((m) => m.problemSessionId === input.problemSessionId)) return;
  const next: PendingReportMarker[] = [
    {
      problemSessionId: input.problemSessionId,
      problemTitle: input.problemTitle,
      problemId: input.problemId,
      status: "PENDING",
      startedAt: new Date().toISOString()
    },
    ...current
  ];
  // 누적 방지 — 최대 20 개.
  savePendingMarkers(next.slice(0, 20));
}

export function removePendingMarker(problemSessionId: number) {
  if (typeof window === "undefined") return;
  const next = loadPendingMarkers().filter((m) => m.problemSessionId !== problemSessionId);
  savePendingMarkers(next);
}

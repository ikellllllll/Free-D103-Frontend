/**
 * /reports 페이지에서 사용하는 "진행 중/실패" 리포트 마커 — localStorage 기반.
 *
 * 이유: 백엔드의 GET /users/me/reports 는 GENERATED 된 리포트만 응답.
 * PENDING/PROCEEDING/FAILED 단계는 별도 endpoint 없어서 frontend 가 endSession 직후
 * marker 를 박아두고 polling 으로 GENERATED 전이를 감지한다.
 *
 * 백엔드가 응답에 PENDING/PROCEEDING/FAILED 도 포함하기 시작하면 이 marker 는 점진 제거.
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
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

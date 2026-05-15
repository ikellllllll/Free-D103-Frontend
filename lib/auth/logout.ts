"use client";

import type { QueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useIdeStore } from "@/store/ideStore";

/**
 * 로그아웃 일괄 처리 헬퍼.
 *
 * 이전 동작: AppShell/AppHeader/AppSidebar/mypage 등 4 곳이 각각
 * `authApi.logout` + `signOut` 만 호출 → Tanstack Query 캐시, IDE store (messages/files/traces),
 * sessionStorage 잔여 모두 그대로 남음. 공용 브라우저에서 로그아웃 후 다음 사용자가 로그인하면
 * 이전 사용자의 AI 채팅, 파일 내용, trace 가 보이는 leak 가 있었다.
 *
 * 이제 모든 logout 콜러는 이 함수만 호출. 새 cleanup 항목 추가 시 한 곳만 고치면 된다.
 */
export async function performLogout(queryClient: QueryClient): Promise<void> {
  const tokens = useAuthStore.getState().tokens;

  if (tokens?.refreshToken) {
    try {
      await authApi.logout(tokens.refreshToken);
    } catch {
      // 서버 오류여도 로컬 로그아웃은 계속 진행 — refresh token 이 무효라도 사용자 의도는 분명.
    }
  }

  // 1) authStore: user/tokens null + localStorage 제거.
  useAuthStore.getState().signOut();

  // 2) Tanstack Query 캐시 전체 비우기 — 이전 사용자의 reports/sessions/problem 등이 다음 로그인에 노출되지 않도록.
  queryClient.clear();

  // 3) IDE store reset — messages/files/traces/submissionResult 등 메모리 잔여 제거.
  useIdeStore.getState().resetSession();

  // 4) sessionStorage 의 앱 키 — 현재는 GitHub OAuth state 하나 뿐. 다른 앱 키 추가 시 여기 같이 정리.
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem("aig-github-oauth-state");
    } catch {
      /* security / quota */
    }

    // 5a) 옛 pending reports 마커 (2026-05-15 이전) — 백엔드 reportStatus 응답 도입으로 더 이상 사용 안 함.
    //     남아 있으면 다음 사용자에게 이전 사용자 진행 상태가 노출될 수 있어 정리.
    try {
      window.localStorage.removeItem("aig-pending-reports-v1");
      window.localStorage.removeItem("aig-pending-reports");
    } catch {
      /* security / quota */
    }

    // 5b) 세션별 에디터 레이아웃 스냅샷 (`aig:ide-editor-layout:<sessionId>`)
    //    — IdeShell 이 sessionId 별로 split/그룹/탭 구성을 localStorage 에 저장한다 (EDITOR_LAYOUT_STORAGE_PREFIX).
    //    정상 종료 경로(EndSession)에서는 IdeShell 이 cleanup 하지만, 탭 강제 종료/브라우저 크래시 시
    //    잔존 → 다음 사용자에게 키 패턴으로 이전 사용자 sessionId 가 노출됨. logout 에서 일괄 정리.
    try {
      const removeKeys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (key.startsWith("aig:ide-editor-layout:")) removeKeys.push(key);
      }
      removeKeys.forEach((key) => {
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* per-key quota — 무시 */
        }
      });
    } catch {
      /* localStorage 접근 불가 (security mode) — 무시 */
    }
  }
}

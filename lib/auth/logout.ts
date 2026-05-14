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
  }
}

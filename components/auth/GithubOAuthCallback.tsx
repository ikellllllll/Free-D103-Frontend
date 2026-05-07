"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { authApi, buildUserFromToken } from "@/lib/api/authApi";
import { consumeGithubOAuthState } from "@/lib/auth/githubOAuth";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export function GithubOAuthCallbackStatus() {
  return (
    <div className="auth-gate" role="status" aria-live="polite">
      <div className="auth-gate__panel">
        <div className="auth-gate__brand">
          <span className="auth-gate__mark">A</span>
          <span>AIG</span>
        </div>
        <div className="auth-gate__copy">
          <span>GitHub 로그인 처리 중</span>
          <strong>인증 결과를 확인하고 있습니다.</strong>
        </div>
        <div className="auth-gate__bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}

export function GithubOAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signIn = useAuthStore((state) => state.signIn);
  const addToast = useUiStore((state) => state.addToast);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");

    if (oauthError) {
      addToast(oauthErrorDescription || "GitHub 로그인이 취소되었습니다.", "error");
      router.replace("/login");
      return;
    }

    if (!code || !consumeGithubOAuthState(state)) {
      addToast("GitHub 로그인 요청이 만료되었습니다. 다시 시도해주세요.", "error");
      router.replace("/login");
      return;
    }

    const completeLogin = async () => {
      try {
        const response = await authApi.githubOAuthLogin(code);
        const user = buildUserFromToken(response.accessToken, {
          name: response.nickname ?? "GitHub 사용자",
          email: response.email ?? "",
          provider: "GITHUB"
        });
        signIn(user, {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken
        });
        addToast(response.isNewUser ? "GitHub 계정으로 가입되었습니다." : "GitHub 계정으로 로그인되었습니다.", "success");
        router.replace("/problems");
      } catch (error) {
        addToast(error instanceof Error ? error.message : "GitHub 로그인에 실패했습니다.", "error");
        router.replace("/login");
      }
    };

    void completeLogin();
  }, [addToast, router, searchParams, signIn]);

  return <GithubOAuthCallbackStatus />;
}

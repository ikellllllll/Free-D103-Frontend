"use client";

import { useCallback, useState } from "react";

import { createGithubOAuthAuthorizeUrl } from "@/lib/auth/githubOAuth";
import { useUiStore } from "@/store/uiStore";

export function useGithubOAuthLogin() {
  const addToast = useUiStore((state) => state.addToast);
  const [githubOAuthLoading, setGithubOAuthLoading] = useState(false);

  const startGithubOAuth = useCallback(() => {
    setGithubOAuthLoading(true);

    void createGithubOAuthAuthorizeUrl()
      .then((authorizeUrl) => {
        window.location.assign(authorizeUrl);
      })
      .catch((error) => {
        setGithubOAuthLoading(false);
        addToast(error instanceof Error ? error.message : "GitHub 로그인을 시작할 수 없습니다.", "error");
      });
  }, [addToast]);

  return { githubOAuthLoading, startGithubOAuth };
}

"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { authApi, type APIKeyItem, type ApiKeyVendor } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";

export type ApiKeyProvider = "anthropic" | "openai";

export const PROVIDER_TO_VENDOR: Record<ApiKeyProvider, ApiKeyVendor> = {
  anthropic: "ANTHROPIC",
  openai: "OPENAI"
};

export const VENDOR_TO_PROVIDER: Record<ApiKeyVendor, ApiKeyProvider> = {
  ANTHROPIC: "anthropic",
  OPENAI: "openai"
};

/**
 * BYOK 키 조회 훅 — 백엔드 GET /api/v1/api-keys 에서 사용자가 등록한 키 목록을 받아오고,
 * provider("anthropic"/"openai") 기준으로 매핑한다.
 *
 * 평문 키는 응답에 포함되지 않으며 (AES-256-GCM 저장), 컴포넌트는 등록 여부와 등록일만 사용한다.
 * 마이페이지 BYOK 탭 / 과제 상세 / 하네스 편집기 등에서 공통으로 쓰인다.
 */
export function useApiKeys() {
  const user = useAuthStore((s) => s.user);
  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["apiKeys", user?.id],
    queryFn: async (): Promise<APIKeyItem[]> => {
      try { return await authApi.getApiKeys(); }
      catch { return []; }
    },
    enabled: !!user
  });

  const keysByProvider = useMemo<Partial<Record<ApiKeyProvider, APIKeyItem>>>(() => {
    const map: Partial<Record<ApiKeyProvider, APIKeyItem>> = {};
    apiKeys.forEach((item) => {
      const pid = VENDOR_TO_PROVIDER[item.vendor];
      if (pid) map[pid] = item;
    });
    return map;
  }, [apiKeys]);

  return {
    apiKeys,
    keysByProvider,
    hasKey: (id: ApiKeyProvider) => !!keysByProvider[id],
    isLoading
  };
}

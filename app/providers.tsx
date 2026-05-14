"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ToastViewport } from "@/components/system/ToastViewport";
import { authApi } from "@/lib/api/authApi";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            // IDE 세션이 길어지면 모든 useQuery 응답이 메모리에 쌓여 OOM 위험이 있어 명시적 cap.
            // 5분 (default) 보다 짧게 설정해서 백그라운드 query 가 idle 상태로 오래 머물지 않게 한다.
            // staleTime=30s 이라 사용자가 다시 화면 들어오면 어차피 refetch 되니 체감 차이 없음.
            gcTime: 2 * 60_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const authHydrated = useAuthStore((state) => state.hydrated);
  const tokens = useAuthStore((state) => state.tokens);
  const setUser = useAuthStore((state) => state.setUser);
  const hydrateTheme = useThemeStore((state) => state.hydrate);

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
  }, [hydrateAuth, hydrateTheme]);

  useEffect(() => {
    if (!authHydrated || !tokens?.accessToken) return;

    let active = true;
    void authApi.getMe()
      .then((profile) => {
        if (!active) return;
        setUser({
          id: String(profile.userId),
          name: profile.nickname,
          email: profile.email,
          provider: profile.provider,
          createdAt: profile.createdAt
        });
      })
      .catch(() => {
        // authClient handles refresh/sign-out. This sync is best-effort so route guards stay calm.
      });

    return () => {
      active = false;
    };
  }, [authHydrated, setUser, tokens?.accessToken]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastViewport />
    </QueryClientProvider>
  );
}

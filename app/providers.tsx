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

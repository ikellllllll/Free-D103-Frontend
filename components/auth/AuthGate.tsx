"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { useAuthStore } from "@/store/authStore";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const router = useRouter();
  const pathname = usePathname();
  const { currentPath, withPrefix } = useRouteScope();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!user && currentPath !== "/login" && currentPath !== "/signup") {
      router.replace(withPrefix("/login"));
    }
  }, [currentPath, hydrated, pathname, router, user, withPrefix]);

  if (!hydrated || !user) {
    return (
      <div className="center-shell">
        <div className="loader-card">
          <span className="eyebrow">Authorizing</span>
          <strong>세션을 확인하고 있습니다</strong>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

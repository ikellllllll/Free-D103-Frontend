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
      <div className="auth-gate" role="status" aria-live="polite">
        <div className="auth-gate__panel">
          <div className="auth-gate__brand">
            <span className="auth-gate__mark">A</span>
            <span>AIG</span>
          </div>
          <div className="auth-gate__copy">
            <span>세션 확인 중</span>
            <strong>작업 공간을 준비하고 있습니다.</strong>
          </div>
          <div className="auth-gate__bar" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/store/authStore";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!user && pathname !== "/login" && pathname !== "/signup") {
      router.replace("/login");
    }
  }, [hydrated, pathname, router, user]);

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

"use client";

import { ThemeToggle } from "@/components/system/ThemeToggle";
import { AuthLayoutShell } from "@/components/auth/AuthLayoutShell";
import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";

export default function DevAuthLayout({ children }: { children: React.ReactNode }) {
  const { themeTone } = useDevTheme();
  const { currentPath } = useRouteScope();

  if (isV0ThemeTone(themeTone) && currentPath.includes("/login")) {
    return <>{children}</>;
  }

  return (
    <main className="auth-page auth-page--dev" data-v3-theme={themeTone}>
      <div className="auth-page__tools auth-page__tools--dev">
        <ThemeToggle />
      </div>
      <div className="auth-page__stack">
        <div className="auth-layout auth-layout--dev">
          <AuthLayoutShell>{children}</AuthLayoutShell>
        </div>
      </div>
    </main>
  );
}

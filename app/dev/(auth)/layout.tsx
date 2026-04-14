"use client";

import { ThemeToggle } from "@/components/system/ThemeToggle";
import { AuthLayoutShell } from "@/components/auth/AuthLayoutShell";

export default function DevAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page auth-page--dev">
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

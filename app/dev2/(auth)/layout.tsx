"use client";

import { ThemeToggle } from "@/components/system/ThemeToggle";
import { AuthLayoutShell } from "@/components/auth/AuthLayoutShell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-page__tools">
        <ThemeToggle />
      </div>
      <div className="auth-layout">
        <AuthLayoutShell>{children}</AuthLayoutShell>
      </div>
    </main>
  );
}

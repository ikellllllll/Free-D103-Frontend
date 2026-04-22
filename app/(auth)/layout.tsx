"use client";

import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/system/ThemeToggle";
import { AuthLayoutShell } from "@/components/auth/AuthLayoutShell";
import {
  V3_THEME_STORAGE_KEY,
  isV3ThemeTone,
  type V3ThemeTone
} from "@/components/dev/DevThemeContext";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [themeTone, setThemeTone] = useState<V3ThemeTone>("mint");

  useEffect(() => {
    const saved = window.localStorage.getItem(V3_THEME_STORAGE_KEY);
    if (isV3ThemeTone(saved)) setThemeTone(saved);
  }, []);

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

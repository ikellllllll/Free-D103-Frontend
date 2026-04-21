"use client";

import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/system/ThemeToggle";
import { AuthLayoutShell } from "@/components/auth/AuthLayoutShell";

const V3_THEME_STORAGE_KEY = "aig:v3-theme";
const V3_THEME_TONES = ["mint", "mint-purple", "purple", "vacance", "orange", "nordic", "moderate", "cool-tone", "wood-tone", "sports-tone", "tennis-tone"] as const;

type V3ThemeTone = (typeof V3_THEME_TONES)[number];

function isV3ThemeTone(value: string | null): value is V3ThemeTone {
  return V3_THEME_TONES.some((tone) => tone === value);
}

export default function DevAuthLayout({ children }: { children: React.ReactNode }) {
  const [themeTone, setThemeTone] = useState<V3ThemeTone>("mint");

  useEffect(() => {
    const savedThemeTone = window.localStorage.getItem(V3_THEME_STORAGE_KEY);
    if (isV3ThemeTone(savedThemeTone)) {
      setThemeTone(savedThemeTone);
    }
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

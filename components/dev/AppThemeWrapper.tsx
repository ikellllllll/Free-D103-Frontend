"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  DevThemeContext,
  V3_THEME_STORAGE_KEY,
  isV3ThemeTone,
  type V3ThemeTone
} from "@/components/dev/DevThemeContext";

export function AppThemeWrapper({ children }: { children: ReactNode }) {
  const [themeTone, setThemeToneState] = useState<V3ThemeTone>("mint");

  useEffect(() => {
    const saved = window.localStorage.getItem(V3_THEME_STORAGE_KEY);
    if (isV3ThemeTone(saved)) setThemeToneState(saved);
  }, []);

  const setThemeTone = useCallback((tone: V3ThemeTone) => {
    setThemeToneState(tone);
    window.localStorage.setItem(V3_THEME_STORAGE_KEY, tone);
  }, []);

  return (
    <DevThemeContext.Provider value={{ themeTone, setThemeTone }}>
      <div className="design-dev" data-v3-theme={themeTone}>{children}</div>
    </DevThemeContext.Provider>
  );
}

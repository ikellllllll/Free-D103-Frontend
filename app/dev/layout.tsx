"use client";

import { useCallback, useEffect, useState } from "react";

import { DevThemeContext, isV3ThemeTone, V3ThemeTone, V3_THEME_STORAGE_KEY } from "@/components/dev/DevThemeContext";
import { RouteScopeProvider } from "@/components/routing/RouteScopeProvider";

export default function DevLayout({ children }: { children: React.ReactNode }) {
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
    <RouteScopeProvider prefix="/dev">
      <DevThemeContext.Provider value={{ themeTone, setThemeTone }}>
        <div className="design-dev" data-v3-theme={themeTone}>{children}</div>
      </DevThemeContext.Provider>
    </RouteScopeProvider>
  );
}

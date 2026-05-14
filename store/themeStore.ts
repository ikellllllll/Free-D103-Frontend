"use client";

import { create } from "zustand";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "aig-theme-mode";
const LEGACY_STORAGE_KEY = "ait-theme-mode";

interface ThemeState {
  theme: ThemeMode;
  hydrated: boolean;
  hydrate: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const applyTheme = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
};

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";

  // 우선순위: inline boot script 가 이미 박아 둔 document.documentElement.dataset.theme.
  // app/layout.tsx 의 inline script 가 React 보다 먼저 실행돼서 dataset.theme 을 설정 + CSS
  // 즉시 반영. localStorage 만 다시 읽으면 inline script 결과와 분기 가능성이 있어 dataset 우선.
  if (typeof document !== "undefined") {
    const datasetTheme = document.documentElement.dataset.theme;
    if (datasetTheme === "light" || datasetTheme === "dark") return datasetTheme;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  if (stored) {
    window.localStorage.setItem(STORAGE_KEY, "light");
  }

  return "light";
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  hydrated: false,
  hydrate: () => {
    const theme = resolveInitialTheme();
    applyTheme(theme);
    set({ theme, hydrated: true });
  },
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  }
}));

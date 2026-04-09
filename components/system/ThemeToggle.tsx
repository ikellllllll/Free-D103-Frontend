"use client";

import { Sun, Moon } from "lucide-react";

import { useThemeStore } from "@/store/themeStore";

export function ThemeToggle({ inline = false }: { inline?: boolean }) {
  const theme = useThemeStore((state) => state.theme);
  const hydrated = useThemeStore((state) => state.hydrated);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  if (!hydrated) {
    return null;
  }

  return (
    <button
      type="button"
      className={inline ? "theme-toggle theme-toggle--inline" : "theme-toggle theme-toggle--floating"}
      onClick={toggleTheme}
      aria-label={`${theme === "dark" ? "라이트 모드" : "다크 모드"}로 전환`}
    >
      <span className="theme-toggle__icon">
        {theme === "dark" ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
      </span>
      <span className="theme-toggle__label">{theme === "dark" ? "라이트" : "다크"}</span>
    </button>
  );
}

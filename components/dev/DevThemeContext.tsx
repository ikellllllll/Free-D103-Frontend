"use client";

import { createContext, useContext } from "react";

export const THEME_OPTIONS = [
  { id: "tennis-tone", label: "테니스톤" },
  { id: "sports-tone", label: "스포츠톤" },
  { id: "wood-tone",   label: "나무톤" },
  { id: "cool-tone",   label: "시원한톤" },
  { id: "mint",        label: "민트톤" },
  { id: "mint-purple", label: "민트 & 보라" },
  { id: "purple",      label: "보라톤" },
  { id: "vacance",     label: "바캉스" },
  { id: "orange",      label: "오렌지 & 딥퍼플" },
  { id: "nordic",      label: "북유럽" },
  { id: "moderate",    label: "무난한" },
] as const;

export type V3ThemeTone = (typeof THEME_OPTIONS)[number]["id"];

export function isV3ThemeTone(value: string | null): value is V3ThemeTone {
  return THEME_OPTIONS.some((option) => option.id === value);
}

export const V3_THEME_STORAGE_KEY = "aig:v3-theme";

interface DevThemeContextValue {
  themeTone: V3ThemeTone;
  setThemeTone: (tone: V3ThemeTone) => void;
}

export const DevThemeContext = createContext<DevThemeContextValue>({
  themeTone: "mint",
  setThemeTone: () => {},
});

export function useDevTheme() {
  return useContext(DevThemeContext);
}

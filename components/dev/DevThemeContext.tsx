"use client";

import { createContext, useContext } from "react";

export const THEME_OPTIONS = [
  { id: "v0-tone",     label: "v0 (검정)" },
  { id: "v0-white",    label: "v0 (화이트)" },
  { id: "tennis-tone", label: "테니스톤" },
  { id: "sports-tone", label: "스포츠톤" },
  { id: "wood-tone",   label: "나무톤" },
  { id: "cool-tone",   label: "시원한톤" },
  { id: "mint",        label: "민트톤" },
  { id: "mint-purple", label: "민트 & 보라" },
  { id: "purple",      label: "보라톤" },
  { id: "moderate",    label: "무난한" },
] as const;

export type V3ThemeTone = (typeof THEME_OPTIONS)[number]["id"];

export const V0_THEME_TONES = ["v0-tone", "v0-white"] as const;
export type V0ThemeTone = (typeof V0_THEME_TONES)[number];

export function isV3ThemeTone(value: string | null): value is V3ThemeTone {
  return THEME_OPTIONS.some((option) => option.id === value);
}

export function isV0ThemeTone(value: string | null): value is V0ThemeTone {
  return V0_THEME_TONES.some((tone) => tone === value);
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

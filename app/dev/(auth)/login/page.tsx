"use client";

import LoginPage from "@/app/(auth)/login/page";
import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import V0DevLoginPage from "@/components/dev/v0/V0DevLoginPage";

export default function DevLoginPage() {
  const { themeTone } = useDevTheme();

  return isV0ThemeTone(themeTone) ? <V0DevLoginPage /> : <LoginPage />;
}

"use client";

import { SessionList } from "@/components/sessions/SessionList";
import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import { SessionList as V0SessionList } from "@/components/dev/v0/V0SessionList";

export default function DevSessionsPage() {
  const { themeTone } = useDevTheme();

  return isV0ThemeTone(themeTone) ? <V0SessionList /> : <SessionList />;
}

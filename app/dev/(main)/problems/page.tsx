"use client";

import { ProblemListV3 } from "@/components/problems/ProblemListV3";
import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import { ProblemListV3 as V0ProblemList } from "@/components/dev/v0/V0ProblemList";

export default function DevProblemsPage() {
  const { themeTone } = useDevTheme();

  return isV0ThemeTone(themeTone) ? <V0ProblemList /> : <ProblemListV3 />;
}

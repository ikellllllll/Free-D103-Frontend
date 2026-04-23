"use client";

import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import { ProblemDetailPvx } from "@/components/dev/v0/V0ProblemDetailPvx";
import { ProblemDetail } from "@/components/problems/ProblemDetail";

export function DevProblemDetailSwitch({ problemId }: { problemId: string }) {
  const { themeTone } = useDevTheme();

  return isV0ThemeTone(themeTone) ? (
    <ProblemDetailPvx problemId={problemId} />
  ) : (
    <ProblemDetail problemId={problemId} />
  );
}

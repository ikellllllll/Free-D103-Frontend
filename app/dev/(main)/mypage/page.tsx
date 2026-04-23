"use client";

import MyPage from "@/app/(main)/mypage/page";
import { isV0ThemeTone, useDevTheme } from "@/components/dev/DevThemeContext";
import V0MyPage from "@/components/dev/v0/V0MyPage";

export default function DevMyPage() {
  const { themeTone } = useDevTheme();

  return isV0ThemeTone(themeTone) ? <V0MyPage /> : <MyPage />;
}

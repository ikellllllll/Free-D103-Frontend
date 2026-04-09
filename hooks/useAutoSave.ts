"use client";

import { useEffect } from "react";

import { mockApi } from "@/lib/api/mockApi";
import { useIdeStore } from "@/store/ideStore";
import { useUiStore } from "@/store/uiStore";

export function useAutoSave(sessionId: string | null, interval = 30_000) {
  const files = useIdeStore((state) => state.files);
  const unsavedPaths = useIdeStore((state) => state.unsavedPaths);
  const markSaved = useIdeStore((state) => state.markSaved);
  const addToast = useUiStore((state) => state.addToast);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const timer = window.setInterval(async () => {
      const targets = files.filter((file) => unsavedPaths.includes(file.path));

      if (!targets.length) {
        return;
      }

      try {
        await Promise.all(targets.map((file) => mockApi.saveFile(sessionId, file.path, file.content)));
        markSaved(undefined, new Date().toISOString());
        addToast("자동 저장 완료", "success");
      } catch (error) {
        addToast(error instanceof Error ? error.message : "자동 저장에 실패했습니다.", "error");
      }
    }, interval);

    return () => window.clearInterval(timer);
  }, [addToast, files, interval, markSaved, sessionId, unsavedPaths]);
}

"use client";

import { useEffect } from "react";

import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import { useIdeStore } from "@/store/ideStore";
import { useUiStore } from "@/store/uiStore";

/**
 * 주기 자동저장 훅. (현재 IdeShell 내부에 자체 autosave 가 있어 미사용 — keep for future external callers)
 * 백엔드 세션이면 sessionApi.saveFile, mock 세션이면 mockApi.saveFile 로 분기 (#4 fix).
 */
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
        const isBackend = isBackendSessionId(sessionId);
        await Promise.all(
          targets.map((file) =>
            isBackend
              ? sessionApi.saveFile(sessionId, { path: file.path, content: file.content, language: file.language })
              : mockApi.saveFile(sessionId, file.path, file.content)
          )
        );
        markSaved(undefined, new Date().toISOString());
        addToast("자동 저장 완료", "success");
      } catch (error) {
        addToast(error instanceof Error ? error.message : "자동 저장에 실패했습니다.", "error");
      }
    }, interval);

    return () => window.clearInterval(timer);
  }, [addToast, files, interval, markSaved, sessionId, unsavedPaths]);
}

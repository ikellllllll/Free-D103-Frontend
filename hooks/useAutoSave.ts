"use client";

import { useEffect, useRef } from "react";

import { mockApi } from "@/lib/api/mockApi";
import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import { useIdeStore } from "@/store/ideStore";
import { useUiStore } from "@/store/uiStore";

/**
 * 주기 자동저장 훅. (현재 IdeShell 내부에 자체 autosave 가 있어 미사용 — keep for future external callers)
 * 백엔드 세션이면 sessionApi.saveFile, mock 세션이면 mockApi.saveFile 로 분기 (#4 fix).
 *
 * race 가드:
 *  - inFlightRef: save 가 interval(30s) 보다 오래 걸릴 때 중복 발사 차단.
 *  - mountedRef: unmount 후 완료된 promise 가 toast/markSaved 호출하던 케이스 차단.
 */
export function useAutoSave(sessionId: string | null, interval = 30_000) {
  const files = useIdeStore((state) => state.files);
  const unsavedPaths = useIdeStore((state) => state.unsavedPaths);
  const markSaved = useIdeStore((state) => state.markSaved);
  const addToast = useUiStore((state) => state.addToast);
  const inFlightRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!sessionId) {
      return () => {
        mountedRef.current = false;
      };
    }

    const timer = window.setInterval(async () => {
      if (inFlightRef.current) return; // 이전 save 가 아직 안 끝났으면 skip
      const targets = files.filter((file) => unsavedPaths.includes(file.path));

      if (!targets.length) {
        return;
      }

      inFlightRef.current = true;
      try {
        const isBackend = isBackendSessionId(sessionId);
        await Promise.all(
          targets.map((file) =>
            isBackend
              ? sessionApi.saveFile(sessionId, { path: file.path, content: file.content, language: file.language })
              : mockApi.saveFile(sessionId, file.path, file.content)
          )
        );
        if (!mountedRef.current) return;
        markSaved(undefined, new Date().toISOString());
        addToast("자동 저장 완료", "success");
      } catch (error) {
        if (!mountedRef.current) return;
        addToast(error instanceof Error ? error.message : "자동 저장에 실패했습니다.", "error");
      } finally {
        inFlightRef.current = false;
      }
    }, interval);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, [addToast, files, interval, markSaved, sessionId, unsavedPaths]);
}

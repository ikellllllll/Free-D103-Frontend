"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 정답/모든 테스트 통과 시 폭죽 + 색종이 효과.
 *
 * - canvas-confetti 를 dynamic import (SSR 회피).
 * - 같은 key (예: executionId) 로는 한 번만 발사 — 중복 트리거 방지.
 * - 한 번 발사 시: 좌/우 양쪽에서 3초 동안 색종이 + 중앙 폭죽 burst 3회.
 *
 * cleanup: 컴포넌트 unmount 시 진행 중인 setTimeout/requestAnimationFrame 모두 정리해서
 * 페이지 이탈 후 3초 동안 confetti 작업이 계속되는 leak 차단.
 */
export function useCelebrate() {
  // 같은 key 는 한 번만 — refire 방지.
  const firedKeysRef = useRef<Set<string>>(new Set());
  const timeoutIdsRef = useRef<Set<number>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const cancelledRef = useRef<boolean>(false);

  useEffect(() => {
    cancelledRef.current = false;
    const timeouts = timeoutIdsRef.current;
    return () => {
      cancelledRef.current = true;
      timeouts.forEach((id) => window.clearTimeout(id));
      timeouts.clear();
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const fire = useCallback(async (key: string = "default") => {
    if (firedKeysRef.current.has(key)) return;
    firedKeysRef.current.add(key);

    if (typeof window === "undefined") return;
    const mod = await import("canvas-confetti").catch(() => null);
    if (!mod || cancelledRef.current) return;
    const confetti = mod.default;

    // 중앙 폭죽 burst — 3번 약간 시간차로 (id 보관 후 cleanup 시 clear)
    const center = (delay: number) => {
      const id = window.setTimeout(() => {
        timeoutIdsRef.current.delete(id);
        if (cancelledRef.current) return;
        confetti({
          particleCount: 120,
          spread: 75,
          startVelocity: 50,
          origin: { x: 0.5, y: 0.55 },
          scalar: 1.1,
          zIndex: 9999
        });
      }, delay);
      timeoutIdsRef.current.add(id);
    };
    center(0);
    center(220);
    center(440);

    // 좌·우 사이드 흩뿌리기 (3초). cancelled 면 즉시 종료, 안 그러면 raf 로 계속.
    const end = Date.now() + 3000;
    const sides = () => {
      if (cancelledRef.current) {
        rafIdRef.current = null;
        return;
      }
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        zIndex: 9999
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        zIndex: 9999
      });
      if (Date.now() < end) {
        rafIdRef.current = window.requestAnimationFrame(sides);
      } else {
        rafIdRef.current = null;
      }
    };
    sides();
  }, []);

  return { fire };
}

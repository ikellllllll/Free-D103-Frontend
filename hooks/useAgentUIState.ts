"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AgentUIState } from "@/lib/types/trace";

/**
 * Agent run 의 UI 상태 (focus 파일/줄 + 변경 파일 list + reviewStatus 등) 폴링.
 *
 * - traceId 가 null 이면 비활성 (idle).
 * - status === "RUNNING" 이면 1500ms 폴링 → focus 변화 / changed_files 실시간 갱신.
 * - status === "COMPLETED" | "FAILED" | "CANCELLED" 이면 폴링 중단 — 한 번 받은 데이터 그대로 유지.
 * - null 응답이 5회 연속이면 데이터가 없는 trace 로 간주하고 폴링 중단 — 콘솔 404 스팸 차단.
 *
 * 같은 traceId 가 처음엔 RUNNING → COMPLETED 로 가는 lifecycle:
 *  진입 → 1.5s 폴링 → status 가 COMPLETED 되면 refetchInterval false 반환 → 폴링 stop.
 */
export function useAgentUIState(sessionId: string, traceId: string | number | null) {
  // 같은 traceId 에 대한 null 카운트 — sessionId+traceId 키로 reset.
  const nullCountRef = useRef<{ key: string; count: number }>({ key: "", count: 0 });
  const currentKey = `${sessionId}:${traceId ?? ""}`;
  useEffect(() => {
    if (nullCountRef.current.key !== currentKey) {
      nullCountRef.current = { key: currentKey, count: 0 };
    }
  }, [currentKey]);

  return useQuery<AgentUIState | null>({
    queryKey: ["agentUIState", sessionId, traceId],
    enabled: !!traceId && isBackendSessionId(sessionId),
    queryFn: async () => {
      if (!traceId) return null;
      const result = await sessionApi.getAgentUIState(sessionId, traceId);
      if (result == null) {
        nullCountRef.current.count += 1;
      } else {
        nullCountRef.current.count = 0;
      }
      return result;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const terminal: string[] = ["COMPLETED", "FAILED", "CANCELLED"];
      // null 5회 연속이면 더 안 부름 — AI 서버에 ui-state 데이터 없는 trace 로 판단.
      if (nullCountRef.current.count >= 5) return false;
      if (!status) return 1500;
      return terminal.includes(status) ? false : 1500;
    },
    staleTime: 1000
  });
}

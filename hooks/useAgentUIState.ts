"use client";

import { useQuery } from "@tanstack/react-query";

import { isBackendSessionId, sessionApi } from "@/lib/api/sessionApi";
import type { AgentUIState } from "@/lib/types/trace";

/**
 * Agent run 의 UI 상태 (focus 파일/줄 + 변경 파일 list + reviewStatus 등) 폴링.
 *
 * - traceId 가 null 이면 비활성 (idle).
 * - status === "RUNNING" 이면 1500ms 폴링 → focus 변화 / changed_files 실시간 갱신.
 * - status === "COMPLETED" | "FAILED" | "CANCELLED" 이면 폴링 중단 — 한 번 받은 데이터 그대로 유지.
 *
 * 같은 traceId 가 처음엔 RUNNING → COMPLETED 로 가는 lifecycle:
 *  진입 → 1.5s 폴링 → status 가 COMPLETED 되면 refetchInterval false 반환 → 폴링 stop.
 */
export function useAgentUIState(sessionId: string, traceId: string | number | null) {
  return useQuery<AgentUIState | null>({
    queryKey: ["agentUIState", sessionId, traceId],
    enabled: !!traceId && isBackendSessionId(sessionId),
    queryFn: async () => {
      if (!traceId) return null;
      return sessionApi.getAgentUIState(sessionId, traceId);
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const terminal: string[] = ["COMPLETED", "FAILED", "CANCELLED"];
      if (!status) return 1500;
      return terminal.includes(status) ? false : 1500;
    },
    staleTime: 1000
  });
}

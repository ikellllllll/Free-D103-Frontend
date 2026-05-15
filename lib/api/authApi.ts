import ky, { isHTTPError, type KyInstance } from "ky";

import type { AuthUser } from "@/lib/types/auth";
import { useAuthStore } from "@/store/authStore";

export const BASE_URL = "https://k14d103.p.ssafy.io";

interface ApiResponse<T> {
  httpStatusCode: number;
  responseMessage: string;
  data: T;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

/** 백엔드 LoginResponse — 토큰 + 사용자 정보(2026-05-06~ 추가) */
export interface LoginResponse extends TokenResponse {
  nickname?: string;
  email?: string;
}

interface OAuthLoginResponse extends TokenResponse {
  isNewUser: boolean;
  nickname?: string;
  email?: string;
}

interface SignupResponse {
  userId: number;
  email: string;
  nickname: string;
}

/** GET /api/v1/users 응답 (백엔드 UserInfoResponse) */
export interface UserInfoResponse {
  userId: number;
  email: string;
  nickname: string;
  provider: "LOCAL" | "GITHUB";
  createdAt: string;
}

/** PATCH /api/v1/users 응답 (백엔드 UpdateNicknameResponse) */
export interface UpdateNicknameResponse {
  nickname: string;
}

/** GET /api/v1/users/me/profile 응답 (백엔드 UserProfileResponse) */
export interface UserProfileResponse {
  /** 총 제출 횟수 (executions WHERE run_type=SUBMISSION) */
  totalSubmissionCount: number;
  /** 평균 점수 (feedback_report.overall_score 평균, 정수 반올림). 리포트 없으면 0. */
  averageScore: number;
  /** 진행 중 세션 수 (problem_sessions WHERE status=IN_PROGRESS) */
  inProgressCount: number;
}

/** GET /api/v1/users/me/stats 응답 (백엔드 UserStatsResponse, 2026-05-12~).
 *  feedback_report 최근 N개 평균 기반 5축 역량 지표.
 *  - 리포트 한 번도 없으면 sampleCount=0, dimensions[].score 모두 0.
 *  - code: HARNESS_GOAL_CLARITY / HARNESS_WORKFLOW_DESIGN / HARNESS_CONTEXT_QUALITY
 *          / HARNESS_SKILL_MODULARITY / HARNESS_VERIFICATION_LOOP
 */
export interface UserStatsDimension {
  code: string;
  label: string;
  score: number;
}
export interface UserStatsResponse {
  sampleCount: number;
  averageScore: number;
  dimensions: UserStatsDimension[];
}

/** GET /api/v1/users/me/reports 응답 (백엔드 UserReportListResponse, 2026-05-08~).
 * 2026-05-15 발견: 백엔드는 problemSessionId / reportStatus 도 응답에 포함하는데
 * 프론트가 기존엔 사용하지 않아 풀이기록→리포트 직접 라우팅과 reportStatus 분기를 못 했음.
 */
export interface UserReportItem {
  feedbackReportId: number;
  /** 백엔드 ProblemSession.id — sessions/history 의 problemSessionId 와 매칭 */
  problemSessionId: number;
  /** 리포트 생성 상태 — PENDING / PROCEEDING / COMPLETED / FAILED (백엔드 ReportStatus enum) */
  reportStatus?: "PENDING" | "PROCEEDING" | "COMPLETED" | "FAILED" | "GENERATED";
  problemId: number;
  problemTitle: string;
  /** BigDecimal — 백엔드 직렬화는 number */
  overallScore: number | string | null;
  passedCount: number;
  failedCount: number;
  totalCount: number;
  passRate?: number;
  /** 백엔드 응답 키는 reportCreatedAt — 호환 위해 둘 다 지원 */
  createdAt: string;
  reportCreatedAt?: string;
}
export interface UserReportListResponse {
  totalCount: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  reports: UserReportItem[];
}

/** GET /api/v1/users/me/sessions 응답 (백엔드 GetActiveSessionResponse, 2026-05-09~) */
export interface ActiveSession {
  problemSessionId: number;
  problemId: number;
  problemTitle: string;
  problemDifficulty: string;          // "level1" | "level2" | "level3"
  problemCategory: "API" | "BUG";
  language: "JAVA" | "PYTHON";
  status: "IN_PROGRESS";              // 엔드포인트가 IN_PROGRESS 만 반환
  startedAt: string;                  // LocalDateTime ISO
}

/** GET /api/v1/users/me/sessions/history 응답 item (백엔드 SessionHistoryItem, 2026-05-14~) */
export interface SessionHistoryItem {
  problemSessionId: number;
  problemId: number;
  problemTitle: string;
  problemDifficulty: string;
  problemCategory: "API" | "BUG";
  language: "JAVA" | "PYTHON";
  sessionStatus: "IN_PROGRESS" | "ENDED" | string;
  solveStatus: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  startedAt: string;
  endedAt: string | null;
  passRate: number;                   // 0.0 ~ 100.0
}

/** GET /api/v1/users/me/sessions/history 응답 (백엔드 GetSessionHistoryResponse, 2026-05-14~) */
export interface SessionHistoryResponse {
  content: SessionHistoryItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
}

/** 세션 이력 조회 status 필터 — 백엔드 SessionHistoryStatusFilter enum */
export type SessionHistoryStatusFilter = "ALL" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
/** 세션 이력 조회 정렬 옵션 — 백엔드 SessionHistorySortType enum */
export type SessionHistorySortType = "LATEST" | "PASS_RATE" | "DIFFICULTY";

/** 비밀번호 변경 요청 (PATCH /api/v1/auth/password, 2026-05-09~) */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** 회원 탈퇴 요청 (DELETE /api/v1/users, 2026-05-09~) */
export interface WithdrawRequest {
  password?: string;  // LOCAL provider 만 필요
}

/** BYOK — 사용자가 본인 LLM API 키를 등록/관리 (POST/GET/DELETE /api/v1/api-keys, 2026-05-12~).
 *  보안: 백엔드는 AES-256-GCM 으로 암호화 저장. 평문은 응답에 절대 X.
 *  마스킹된 prefix/suffix 도 응답 X — 사용자는 vendor + 등록일 만으로 식별. */
export type ApiKeyVendor = "OPENAI" | "ANTHROPIC";

export interface CreateAPIKeyRequest {
  vendor: ApiKeyVendor;
  apiKey: string;
}

export interface APIKeyItem {
  apiKeyId: number;
  vendor: ApiKeyVendor;
  createdAt: string;  // LocalDateTime ISO
}

interface JwtPayload {
  sub?: string;
  email?: string;
  nickname?: string;
  userId?: number;
  provider?: "LOCAL" | "GITHUB";
  iat?: number;
  exp?: number;
}

let refreshPromise: Promise<TokenResponse> | null = null;

/**
 * Access token 갱신 헬퍼 — SSE / 직접 fetch 코드에서도 401 시 재시도 가능하도록 export.
 * 성공: 새 토큰을 store 에 저장 + 반환. 실패: signOut + null 반환 (호출자가 throw 결정).
 * 동시 호출 시 in-flight refreshPromise 를 공유해서 race 없음.
 */
export async function tryRefreshAccessToken(): Promise<TokenResponse | null> {
  const { tokens, setTokens, signOut } = useAuthStore.getState();
  if (!tokens?.refreshToken) {
    signOut();
    return null;
  }
  try {
    refreshPromise ??= ky.post(`${BASE_URL}/api/v1/auth/refresh`, {
      json: { refreshToken: tokens.refreshToken },
      retry: 0
    })
      .json<ApiResponse<TokenResponse>>()
      .then((refreshRes) => refreshRes.data)
      .finally(() => {
        refreshPromise = null;
      });
    const nextTokens = await refreshPromise;
    setTokens(nextTokens);
    return nextTokens;
  } catch {
    signOut();
    return null;
  }
}

// 인증 불필요 요청용 기본 클라이언트
const api = ky.create({
  prefixUrl: BASE_URL,
  retry: 0,
  hooks: {
    beforeError: [
      async (error) => {
        if (isHTTPError(error)) {
          try {
            const body = await error.response.clone().json() as { errorMessage?: string };
            if (body.errorMessage) error.message = body.errorMessage;
          } catch { /* JSON 파싱 실패 시 원본 메시지 유지 */ }
        }
        return error;
      }
    ]
  }
});

// 인증 필요 요청용 클라이언트 — 401 시 자동 토큰 갱신 후 재시도
export function createAuthClient(): KyInstance {
  return ky.create({
    prefixUrl: BASE_URL,
    retry: 0,
    hooks: {
      beforeRequest: [
        (request) => {
          const { tokens } = useAuthStore.getState();
          if (tokens?.accessToken) {
            request.headers.set("Authorization", `Bearer ${tokens.accessToken}`);
          }
        }
      ],
      afterResponse: [
        async (request, options, response) => {
          if (response.status !== 401 || request.headers.get("X-Auth-Retry")) return response;

          const { tokens, setTokens, signOut } = useAuthStore.getState();
          if (!tokens?.refreshToken) {
            signOut();
            throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
          }

          try {
            refreshPromise ??= ky.post(`${BASE_URL}/api/v1/auth/refresh`, {
                json: { refreshToken: tokens.refreshToken },
                retry: 0
              })
              .json<ApiResponse<TokenResponse>>()
              .then((refreshRes) => refreshRes.data)
              .finally(() => {
                refreshPromise = null;
              });

            const nextTokens = await refreshPromise;
            setTokens(nextTokens);

            const newHeaders = new Headers(request.headers);
            newHeaders.set("Authorization", `Bearer ${nextTokens.accessToken}`);
            newHeaders.set("X-Auth-Retry", "1");
            return ky(new Request(request, { headers: newHeaders }), options);
          } catch {
            signOut();
            throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
          }
        }
      ],
      beforeError: [
        async (error) => {
          if (isHTTPError(error)) {
            try {
              const body = await error.response.clone().json() as { errorMessage?: string };
              if (body.errorMessage) error.message = body.errorMessage;
            } catch { /* JSON 파싱 실패 시 원본 메시지 유지 */ }
          }
          return error;
        }
      ]
    }
  });
}

export const authClient = createAuthClient();

function decodeJwtPayload(token: string): JwtPayload {
  try {
    const payloadBase64 = token.split(".")[1];
    const padded = payloadBase64 + "=".repeat((4 - (payloadBase64.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return {};
  }
}

export function buildUserFromToken(accessToken: string, fallback?: Partial<AuthUser>): AuthUser {
  const payload = decodeJwtPayload(accessToken);

  return {
    id: String(payload.userId ?? payload.sub ?? ""),
    name: payload.nickname ?? fallback?.name ?? "",
    email: payload.email ?? fallback?.email ?? (payload.sub?.includes("@") ? payload.sub : ""),
    provider: payload.provider ?? fallback?.provider ?? "LOCAL",
    createdAt: fallback?.createdAt ?? new Date().toISOString()
  };
}

export const authApi = {
  async checkEmailAvailability(email: string): Promise<boolean> {
    const res = await api.get("api/v1/users/email-availability", { searchParams: { email } })
      .json<ApiResponse<{ email: string; isAvailable: boolean }>>();
    return res.data.isAvailable;
  },

  async signup(email: string, password: string, nickname: string): Promise<SignupResponse> {
    const res = await api.post("api/v1/users", { json: { email, password, nickname } })
      .json<ApiResponse<SignupResponse>>();
    return res.data;
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await api.post("api/v1/auth/login", { json: { email, password } })
      .json<ApiResponse<LoginResponse>>();
    return res.data;
  },

  /** 회원 정보 조회 — GET /api/v1/users */
  async getMe(): Promise<UserInfoResponse> {
    const res = await authClient.get("api/v1/users")
      .json<ApiResponse<UserInfoResponse>>();
    return res.data;
  },

  /** 닉네임 수정 — PATCH /api/v1/users */
  async updateNickname(nickname: string): Promise<UpdateNicknameResponse> {
    const res = await authClient.patch("api/v1/users", { json: { nickname } })
      .json<ApiResponse<UpdateNicknameResponse>>();
    return res.data;
  },

  /** 프로필 활동 요약 조회 — GET /api/v1/users/me/profile (2026-05-08~) */
  async getUserProfile(): Promise<UserProfileResponse> {
    const res = await authClient.get("api/v1/users/me/profile")
      .json<ApiResponse<UserProfileResponse>>();
    return res.data;
  },

  /** 리포트 목록 조회 — GET /api/v1/users/me/reports (2026-05-08~).
   * 백엔드는 page 1-indexed (page<1 이면 400). resolvedPage-1 로 내부 변환.
   */
  async getUserReports(page = 1, size = 20): Promise<UserReportListResponse> {
    const res = await authClient
      .get("api/v1/users/me/reports", { searchParams: { page, size } })
      .json<ApiResponse<UserReportListResponse>>();
    // 백엔드 record 의 키는 `reportCreatedAt` 이지만 기존 프론트가 `createdAt` 로 참조해서 Invalid Date 가
    // 나오던 케이스 발견 (2026-05-15). 매퍼에서 alias 보정.
    const raw = res.data;
    return {
      ...raw,
      reports: raw.reports.map((r) => ({
        ...r,
        createdAt: r.createdAt ?? r.reportCreatedAt ?? "",
      })),
    };
  },

  /** AI 역량 지표 5축 조회 — GET /api/v1/users/me/stats (2026-05-12~).
   *  feedback_report 최근 10개 기준 평균. 리포트 0개면 sampleCount=0, 점수 0.
   */
  async getUserStats(): Promise<UserStatsResponse> {
    const res = await authClient.get("api/v1/users/me/stats")
      .json<ApiResponse<UserStatsResponse>>();
    return res.data;
  },

  /** 진행 중 세션 목록 조회 — GET /api/v1/users/me/sessions/active (2026-05-14~ 경로 변경) */
  async getActiveSessions(): Promise<ActiveSession[]> {
    const res = await authClient.get("api/v1/users/me/sessions/active")
      .json<ApiResponse<ActiveSession[]>>();
    return res.data;
  },

  /** 내 풀이 세션 이력 조회 — GET /api/v1/users/me/sessions/history (2026-05-14~).
   * status / sort / page(0-based) / size 쿼리 파라미터.
   * solveStatus 가 IN_PROGRESS/COMPLETED/FAILED 로 결정됨 (passRate >= 100 → COMPLETED).
   */
  async getSessionHistory(params: {
    status?: SessionHistoryStatusFilter;
    sort?: SessionHistorySortType;
    page?: number;
    size?: number;
  } = {}): Promise<SessionHistoryResponse> {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.sort) search.set("sort", params.sort);
    if (typeof params.page === "number") search.set("page", String(params.page));
    if (typeof params.size === "number") search.set("size", String(params.size));
    const qs = search.toString();
    const res = await authClient
      .get(`api/v1/users/me/sessions/history${qs ? `?${qs}` : ""}`)
      .json<ApiResponse<SessionHistoryResponse>>();
    return res.data;
  },

  /** 비밀번호 변경 — PATCH /api/v1/auth/password (2026-05-09~) */
  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await authClient.patch("api/v1/auth/password", { json: request });
  },

  /** 회원 탈퇴 — DELETE /api/v1/users (2026-05-09~).
   * LOCAL provider: password 필수. GITHUB: 생략 가능.
   */
  async withdraw(request: WithdrawRequest = {}): Promise<void> {
    await authClient.delete("api/v1/users", { json: request });
  },

  /** BYOK 목록 조회 — GET /api/v1/api-keys (2026-05-12~).
   *  평문 키는 응답에 X — vendor + 등록일만 표시용. */
  async getApiKeys(): Promise<APIKeyItem[]> {
    const res = await authClient.get("api/v1/api-keys")
      .json<ApiResponse<APIKeyItem[]>>();
    return res.data;
  },

  /** BYOK 등록 — POST /api/v1/api-keys. 동일 vendor 면 덮어쓰기 (백엔드 UNIQUE 제약). */
  async createApiKey(request: CreateAPIKeyRequest): Promise<APIKeyItem> {
    const res = await authClient.post("api/v1/api-keys", { json: request })
      .json<ApiResponse<APIKeyItem>>();
    return res.data;
  },

  /** BYOK 삭제 — DELETE /api/v1/api-keys/{apiKeyId}. */
  async deleteApiKey(apiKeyId: number): Promise<void> {
    await authClient.delete(`api/v1/api-keys/${apiKeyId}`);
  },

  async githubOAuthLogin(code: string): Promise<OAuthLoginResponse> {
    const res = await api.post("api/v1/auth/oauth/github", { json: { code } })
      .json<ApiResponse<OAuthLoginResponse>>();
    return res.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post("api/v1/auth/logout", { json: { refreshToken } });
  },

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const res = await api.post("api/v1/auth/refresh", { json: { refreshToken } })
      .json<ApiResponse<TokenResponse>>();
    return res.data;
  }
};

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

/** GET /api/v1/users/me/reports 응답 (백엔드 UserReportListResponse, 2026-05-08~) */
export interface UserReportItem {
  feedbackReportId: number;
  problemId: number;
  problemTitle: string;
  /** BigDecimal — 백엔드 직렬화는 number */
  overallScore: number | string | null;
  passedCount: number;
  failedCount: number;
  totalCount: number;
  createdAt: string; // LocalDateTime ISO
}
export interface UserReportListResponse {
  totalCount: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  reports: UserReportItem[];
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
            const refreshRes = await ky.post(`${BASE_URL}/api/v1/auth/refresh`, {
              json: { refreshToken: tokens.refreshToken },
              retry: 0
            }).json<ApiResponse<TokenResponse>>();

            setTokens(refreshRes.data);

            const newHeaders = new Headers(request.headers);
            newHeaders.set("Authorization", `Bearer ${refreshRes.data.accessToken}`);
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

  /** 리포트 목록 조회 — GET /api/v1/users/me/reports (2026-05-08~) */
  async getUserReports(page = 0, size = 20): Promise<UserReportListResponse> {
    const res = await authClient
      .get("api/v1/users/me/reports", { searchParams: { page, size } })
      .json<ApiResponse<UserReportListResponse>>();
    return res.data;
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

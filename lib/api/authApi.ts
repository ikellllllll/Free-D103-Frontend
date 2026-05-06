import ky, { isHTTPError, type KyInstance } from "ky";

import type { AuthUser } from "@/lib/types/auth";
import { useAuthStore } from "@/store/authStore";

const BASE_URL = "https://k14d103.p.ssafy.io";

interface ApiResponse<T> {
  httpStatusCode: number;
  responseMessage: string;
  data: T;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface OAuthLoginResponse extends TokenResponse {
  isNewUser: boolean;
}

interface SignupResponse {
  userId: number;
  email: string;
  nickname: string;
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

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await api.post("api/v1/auth/login", { json: { email, password } })
      .json<ApiResponse<TokenResponse>>();
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

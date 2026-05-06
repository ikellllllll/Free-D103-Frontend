import { NextRequest, NextResponse } from "next/server";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const DEFAULT_SCOPE = "read:user user:email";
const CALLBACK_PATH = "/oauth/github/callback";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.json({ errorMessage: "GitHub 로그인 요청이 올바르지 않습니다." }, { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ errorMessage: "GitHub 로그인 설정이 아직 없습니다." }, { status: 500 });
  }

  const redirectUri =
    process.env.GITHUB_REDIRECT_URI ||
    process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI ||
    `${request.nextUrl.origin}${CALLBACK_PATH}`;

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", DEFAULT_SCOPE);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("allow_signup", "true");

  return NextResponse.json(
    { authorizeUrl: authorizeUrl.toString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

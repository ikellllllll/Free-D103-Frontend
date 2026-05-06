const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_STATE_KEY = "aig-github-oauth-state";
const DEFAULT_SCOPE = "read:user user:email";
const CALLBACK_PATH = "/oauth/github/callback";

function createRandomState() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getRedirectUri() {
  const configured = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI;
  if (configured) {
    return configured;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}${CALLBACK_PATH}`;
}

export function createGithubOAuthAuthorizeUrl() {
  if (typeof window === "undefined") {
    throw new Error("브라우저에서만 GitHub 로그인을 시작할 수 있습니다.");
  }

  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GitHub 로그인 설정이 아직 없습니다.");
  }

  const redirectUri = getRedirectUri();
  if (!redirectUri) {
    throw new Error("GitHub callback URL을 확인할 수 없습니다.");
  }

  const state = createRandomState();
  window.sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, state);

  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", DEFAULT_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");

  return url.toString();
}

export function consumeGithubOAuthState(receivedState: string | null) {
  if (typeof window === "undefined" || !receivedState) {
    return false;
  }

  const storedState = window.sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);
  window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);

  return Boolean(storedState && storedState === receivedState);
}

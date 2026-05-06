const GITHUB_OAUTH_STATE_KEY = "aig-github-oauth-state";

function createRandomState() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function createGithubOAuthAuthorizeUrl() {
  if (typeof window === "undefined") {
    throw new Error("브라우저에서만 GitHub 로그인을 시작할 수 있습니다.");
  }

  const state = createRandomState();
  window.sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, state);

  const response = await fetch(`/oauth/github/start?state=${encodeURIComponent(state)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
    try {
      const body = await response.json() as { errorMessage?: string };
      throw new Error(body.errorMessage || "GitHub 로그인을 시작할 수 없습니다.");
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("GitHub 로그인을 시작할 수 없습니다.");
    }
  }

  const body = await response.json() as { authorizeUrl?: string };
  if (!body.authorizeUrl) {
    window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
    throw new Error("GitHub 로그인을 시작할 수 없습니다.");
  }

  return body.authorizeUrl;
}

export function consumeGithubOAuthState(receivedState: string | null) {
  if (typeof window === "undefined" || !receivedState) {
    return false;
  }

  const storedState = window.sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);
  window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);

  return Boolean(storedState && storedState === receivedState);
}

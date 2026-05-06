import { Suspense } from "react";

import { GithubOAuthCallback, GithubOAuthCallbackStatus } from "@/components/auth/GithubOAuthCallback";

export default function GithubOAuthCallbackPage() {
  return (
    <Suspense fallback={<GithubOAuthCallbackStatus />}>
      <GithubOAuthCallback />
    </Suspense>
  );
}

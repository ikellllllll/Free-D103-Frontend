"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, type MouseEvent, type ReactNode } from "react";

import { AuthHero } from "@/components/auth/AuthHero";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";

type AuthMode = "login" | "signup";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => void;
};

interface AuthShellProps {
  mode: AuthMode;
  heroTitle: string;
  heroDescription: string;
  sectionLabel: string;
  heading: string;
  description: string;
  footerText: string;
  footerHref: string;
  footerAction: string;
  children: ReactNode;
}

function getModeFromPath(pathname: string) {
  return pathname === "/signup" ? "signup" : "login";
}

export function AuthShell({
  mode,
  heroTitle,
  heroDescription,
  sectionLabel,
  heading,
  description,
  footerText,
  footerHref,
  footerAction,
  children
}: AuthShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentPath, withPrefix } = useRouteScope();
  const activeMode = getModeFromPath(currentPath);

  const navigateWithTransition = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    const nextHref = withPrefix(href);

    if (pathname === nextHref) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    const navigate = () => {
      startTransition(() => {
        router.push(nextHref);
      });
    };

    const transitionDocument = document as ViewTransitionDocument;
    if (typeof transitionDocument.startViewTransition === "function") {
      transitionDocument.startViewTransition(navigate);
      return;
    }

    navigate();
  };

  return (
    <>
      <AuthHero title={heroTitle} description={heroDescription} />

      <section className="auth-form-panel" data-auth-mode={mode}>
        <div className="auth-form-panel__tabs" data-auth-mode={activeMode}>
          <span className="auth-form-panel__tab-indicator" aria-hidden />
          <Link
            href={withPrefix("/login")}
            className={`auth-form-panel__tab${activeMode === "login" ? " auth-form-panel__tab--active" : ""}`}
            onClick={navigateWithTransition("/login")}
          >
            로그인
          </Link>
          <Link
            href={withPrefix("/signup")}
            className={`auth-form-panel__tab${activeMode === "signup" ? " auth-form-panel__tab--active" : ""}`}
            onClick={navigateWithTransition("/signup")}
          >
            회원가입
          </Link>
        </div>

        <div key={mode} className="auth-form-panel__content" data-auth-mode={mode}>
          <div className="stack-24">
            <div className="auth-form-panel__intro">
              <span className="eyebrow">{sectionLabel}</span>
              <h1>{heading}</h1>
              <p className="muted-copy">{description}</p>
            </div>
            {children}
          </div>
        </div>

        <p className="auth-form-panel__foot">
          {footerText}{" "}
          <Link href={withPrefix(footerHref)} onClick={navigateWithTransition(footerHref)}>
            {footerAction}
          </Link>
        </p>
      </section>
    </>
  );
}

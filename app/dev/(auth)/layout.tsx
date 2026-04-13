import { ThemeToggle } from "@/components/system/ThemeToggle";

export default function DevAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page auth-page--dev">
      <div className="auth-page__tools auth-page__tools--dev">
        <ThemeToggle />
      </div>
      <div className="auth-page__stack">
        <div className="auth-layout auth-layout--dev">{children}</div>
      </div>
    </main>
  );
}

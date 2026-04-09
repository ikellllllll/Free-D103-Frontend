import { ThemeToggle } from "@/components/system/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-page__tools">
        <ThemeToggle />
      </div>
      <div className="auth-layout">{children}</div>
    </main>
  );
}

import { AuthGate } from "@/components/auth/AuthGate";
import { AppHeader } from "@/components/layout/AppHeader";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="app-shell">
        <AppHeader />
        <main className="page-shell">{children}</main>
      </div>
    </AuthGate>
  );
}

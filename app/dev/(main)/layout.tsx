import { AuthGate } from "@/components/auth/AuthGate";
import { DevBlendBar } from "@/components/dev/DevBlendBar";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default function DevMainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="app-shell app-shell--dev">
        <AppSidebar />
        <main className="page-shell page-shell--dev">
          <DevBlendBar />
          {children}
        </main>
      </div>
    </AuthGate>
  );
}

import { AuthGate } from "@/components/auth/AuthGate";
import { AppThemeWrapper } from "@/components/dev/AppThemeWrapper";
import { DevShell } from "@/components/dev/DevShell";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppThemeWrapper>
        <DevShell>{children}</DevShell>
      </AppThemeWrapper>
    </AuthGate>
  );
}

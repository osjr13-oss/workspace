import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { HealthProvider } from "@/components/health-provider";
import { WelcomeEmailTrigger } from "@/components/welcome-email-trigger";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <WelcomeEmailTrigger />
      <HealthProvider>
        <AppShell>{children}</AppShell>
      </HealthProvider>
    </AuthGate>
  );
}

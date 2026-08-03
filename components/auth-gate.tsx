"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  WorkspaceSessionProvider,
  displayNameFromUser,
  type WorkspaceSession
} from "@/components/workspace-session";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<WorkspaceSession | null | undefined>(undefined);
  const [envError, setEnvError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function hydrateUser(user: User) {
      const supabase = createSupabaseBrowserClient();
      // Show metadata-backed name immediately, then refine from profiles.
      const initial = displayNameFromUser(user);
      if (!cancelled) {
        setSession({ user, ...initial });
      }

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      setSession({ user, ...displayNameFromUser(user, profile?.full_name) });
    }

    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) {
          const next = `${window.location.pathname}${window.location.search}`;
          router.replace(`/signin?next=${encodeURIComponent(next)}`);
          return;
        }
        void hydrateUser(data.user);
      });

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!nextSession?.user) {
          const next = `${window.location.pathname}${window.location.search}`;
          router.replace(`/signin?next=${encodeURIComponent(next)}`);
          return;
        }
        void hydrateUser(nextSession.user);
      });

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    } catch (error) {
      setEnvError(error instanceof Error ? error.message : "Configuration is missing.");
    }
  }, [router]);

  if (envError) {
    return (
      <main className="mx-auto grid min-h-screen max-w-3xl place-items-center px-5">
        <section className="panel p-7">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Configuration needed</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">{envError}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">
            Add the Supabase values from `.env.example`, then restart the app.
          </p>
        </section>
      </main>
    );
  }

  if (session === undefined || session === null) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="status-pill">Loading workspace</div>
      </main>
    );
  }

  return <WorkspaceSessionProvider value={session}>{children}</WorkspaceSessionProvider>;
}

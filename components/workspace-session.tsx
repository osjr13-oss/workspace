"use client";

import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export type WorkspaceSession = {
  user: User;
  email: string;
  fullName: string;
  firstName: string;
};

const WorkspaceSessionContext = createContext<WorkspaceSession | null>(null);

export function WorkspaceSessionProvider({
  value,
  children
}: {
  value: WorkspaceSession;
  children: React.ReactNode;
}) {
  return <WorkspaceSessionContext.Provider value={value}>{children}</WorkspaceSessionContext.Provider>;
}

export function useWorkspaceSession() {
  const session = useContext(WorkspaceSessionContext);
  if (!session) {
    throw new Error("useWorkspaceSession must be used within the authenticated workspace.");
  }
  return session;
}

export function displayNameFromUser(user: User, profileFullName?: string | null) {
  const fullName = (profileFullName || user.user_metadata?.full_name || "").trim();
  const fallback = user.email?.split("@")[0] || "there";
  const resolvedFullName = fullName || fallback;
  const firstName = resolvedFullName.split(/\s+/)[0] || fallback;
  return {
    email: user.email || "",
    fullName: resolvedFullName,
    firstName
  };
}

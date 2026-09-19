"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/types";

const AppSessionContext = createContext<SessionUser | null>(null);

export function AppSessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <AppSessionContext.Provider value={user}>
      {children}
    </AppSessionContext.Provider>
  );
}

/** Client components under (app) — session from layout, no extra fetch. */
export function useAppSession(): SessionUser {
  const user = useContext(AppSessionContext);
  if (!user) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }
  return user;
}

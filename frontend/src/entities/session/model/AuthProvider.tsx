"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearToken, getToken, setToken } from "@/shared/lib/session";
import { fetchMe, login as apiLogin } from "../api";
import type { CurrentUser, RoleName } from "./types";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from a previously stored token on first mount. All
  // setState calls live in promise callbacks (never synchronously in the effect
  // body) so they run after the current render commits.
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    const init = token ? fetchMe() : Promise.resolve(null);
    init
      .then((me) => {
        if (!cancelled && me) setUser(me);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const token = await apiLogin(email, password);
    setToken(token.access_token);
    const me = await fetchMe();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function isAdmin(user: CurrentUser | null): boolean {
  return !!user && user.roles.includes("admin");
}

export function hasRole(user: CurrentUser | null, ...roles: RoleName[]): boolean {
  return !!user && roles.some((r) => user.roles.includes(r));
}

/**
 * Landing route after login, by role. Admin → security contour; teacher → staff
 * teaching portal; child/parent → student/parent portal. Admin is checked first
 * because it is the most privileged combination.
 */
export function homePathFor(user: CurrentUser | null): string {
  if (!user) return "/login";
  if (user.roles.includes("admin")) return "/admin";
  if (user.roles.includes("teacher")) return "/teacher";
  if (user.roles.includes("child") || user.roles.includes("parent")) return "/dashboard";
  return "/login";
}

import { apiFetch } from "@/shared/api";
import type { AuthToken, CurrentUser } from "../model/types";

/**
 * Exchange email + password for a bearer token. The backend uses the OAuth2
 * password flow, so credentials go as form-urlencoded ``username``/``password``.
 */
export async function login(email: string, password: string): Promise<AuthToken> {
  const body = new URLSearchParams({ username: email, password });
  return apiFetch<AuthToken>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function fetchMe(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/api/v1/auth/me");
}

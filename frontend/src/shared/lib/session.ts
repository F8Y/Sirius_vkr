/**
 * JWT bearer-token storage for the SPA.
 *
 * The token is kept in localStorage and attached to every API request by
 * `apiFetch` (see shared/api). Pure browser concern — guarded for SSR.
 */
const TOKEN_KEY = "sirius_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

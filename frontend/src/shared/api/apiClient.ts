import { clearToken, getToken } from "@/shared/lib/session";

export interface HealthResponse {
  status: string;
  services: {
    postgres?: string;
    redis?: string;
  };
}

/** Error carrying the HTTP status so callers can react to 401/403 specifically. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function extractDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
    }
  } catch {
    /* non-JSON body */
  }
  return response.statusText || `Ошибка ${response.status}`;
}

/**
 * Fetch wrapper that attaches the bearer token to every request and normalizes
 * errors. On 401 it clears the stored token so the guard redirects to /login.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    throw new ApiError(401, "Сессия истекла. Войдите снова.");
  }
  if (!response.ok) {
    throw new ApiError(response.status, await extractDetail(response));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

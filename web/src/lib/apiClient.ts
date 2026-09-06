import { tokenStore } from "./tokenStore";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const auth = tokenStore.get();
  if (!auth?.refreshToken) throw new ApiError(401, "NO_REFRESH_TOKEN", "Not authenticated.");

  const res = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });
  const body = (await res.json()) as { success: boolean; data?: { accessToken: string; refreshToken: string }; error?: { code: string; message: string } };

  if (!res.ok || !body.success || !body.data) {
    tokenStore.set(null);
    throw new ApiError(res.status, body.error?.code ?? "REFRESH_FAILED", body.error?.message ?? "Session expired.");
  }
  tokenStore.set({ ...auth, accessToken: body.data.accessToken, refreshToken: body.data.refreshToken });
}

/** Every non-2xx / {success:false} response becomes an ApiError; a 401 triggers exactly one
 * silent refresh-and-retry (§33's access+refresh token pattern) before giving up. */
export async function apiFetch<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
  const auth = tokenStore.get();
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth?.accessToken) headers.set("Authorization", `Bearer ${auth.accessToken}`);

  const res = await fetch(`/api/v1${path}`, { ...options, headers });

  if (res.status === 401 && allowRetry && auth?.refreshToken) {
    refreshPromise ??= doRefresh().finally(() => {
      refreshPromise = null;
    });
    try {
      await refreshPromise;
    } catch (err) {
      throw err instanceof ApiError ? err : new ApiError(401, "SESSION_EXPIRED", "Your session has expired.");
    }
    return apiFetch<T>(path, options, false);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await res.json()) as { success: boolean; data?: T } | ErrorEnvelope;
    if (!res.ok || body.success === false) {
      const err = body as ErrorEnvelope;
      throw new ApiError(res.status, err.error?.code ?? "REQUEST_FAILED", err.error?.message ?? res.statusText);
    }
    return (body as { data: T }).data;
  }

  if (!res.ok) {
    throw new ApiError(res.status, "REQUEST_FAILED", res.statusText);
  }
  return (await res.blob()) as unknown as T; // report export downloads etc.
}

function body(data?: unknown): string | undefined {
  return data !== undefined ? JSON.stringify(data) : undefined;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, data?: unknown) => apiFetch<T>(path, { method: "POST", body: body(data) }),
  put: <T>(path: string, data?: unknown) => apiFetch<T>(path, { method: "PUT", body: body(data) }),
  patch: <T>(path: string, data?: unknown) => apiFetch<T>(path, { method: "PATCH", body: body(data) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, formData: FormData) => apiFetch<T>(path, { method: "POST", body: formData }),
};

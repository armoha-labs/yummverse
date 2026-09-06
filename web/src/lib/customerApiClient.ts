import { ApiError } from "./apiClient";
import { customerAuthStore } from "./customerAuth";

interface CustomerSessionResponse {
  sessionToken: string;
  expiresAt: string;
  tenantId: string;
  branchId: string;
  tableId: string;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** Public lookups (§21/§22) — no session required. */
export async function fetchPublic<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1${path}`);
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok || !body.success || body.data === undefined) {
    throw new ApiError(res.status, body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? res.statusText);
  }
  return body.data;
}

/** Raw fetch, never routed through customerApiFetch — avoids the 401-retry loop calling itself. */
export async function requestCustomerSession(qrToken: string): Promise<CustomerSessionResponse> {
  const res = await fetch("/api/v1/customer/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qrToken }),
  });
  const body = (await res.json()) as Envelope<CustomerSessionResponse>;
  if (!res.ok || !body.success || !body.data) {
    throw new ApiError(res.status, body.error?.code ?? "SESSION_FAILED", body.error?.message ?? "Unable to start your session.");
  }
  return body.data;
}

/** Same §70 envelope + single-retry pattern as the staff apiClient, but keyed on the opaque
 * customer session token (§56) rather than a JWT — expiry is handled by silently re-minting
 * a session from the QR token still on hand, not by refresh-token rotation. */
export async function customerApiFetch<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
  const auth = customerAuthStore.get();
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth?.sessionToken) headers.set("Authorization", `Bearer ${auth.sessionToken}`);

  const res = await fetch(`/api/v1${path}`, { ...options, headers });

  if (res.status === 401 && allowRetry && auth?.qrToken) {
    try {
      const session = await requestCustomerSession(auth.qrToken);
      customerAuthStore.set({ ...auth, sessionToken: session.sessionToken, expiresAt: session.expiresAt });
    } catch {
      customerAuthStore.set(null);
      throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please scan the table QR code again.");
    }
    return customerApiFetch<T>(path, options, false);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await res.json()) as Envelope<T>;
    if (!res.ok || body.success === false) {
      throw new ApiError(res.status, body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? res.statusText);
    }
    return body.data as T;
  }

  if (!res.ok) throw new ApiError(res.status, "REQUEST_FAILED", res.statusText);
  return undefined as T;
}

export const customerApi = {
  get: <T>(path: string) => customerApiFetch<T>(path),
  post: <T>(path: string, data?: unknown) =>
    customerApiFetch<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
};

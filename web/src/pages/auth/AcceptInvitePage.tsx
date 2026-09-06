import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { CafeBackdrop } from "@/components/CafeBackdrop";

interface TenantBranding {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
}

/** Completes a tenant-admin or staff invite (§8A.2) — set at the link a Tenant Admin gets
 * by email when SMTP is configured (§54), or from the backend log otherwise. Same endpoint
 * for either kind of invite; the token alone determines which account it sets a password on. */
export default function AcceptInvitePage() {
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data: branding } = useQuery({
    queryKey: ["public-branding", tenantSlug],
    queryFn: () => api.get<TenantBranding>(`/public/tenant/branding?tenantSlug=${encodeURIComponent(tenantSlug)}`),
    enabled: Boolean(tenantSlug),
    retry: false,
  });

  const accent = branding?.primaryColor || "oklch(58% 0.15 40)";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/accept-invite", { tenantSlug, email, inviteToken: token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This invite link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenantSlug || !email || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-center">
        <div className="max-w-sm text-sm text-text-muted">
          This invite link looks incomplete. Please use the full link you were given, or ask your café admin for a
          new one.
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{ background: `linear-gradient(160deg, ${accent} 0%, oklch(30% 0.06 40) 100%)` }}
    >
      <CafeBackdrop accent={accent} />
      <div className="relative flex w-full max-w-sm flex-col gap-5 rounded-card bg-surface p-9 shadow-md2">
        <div className="flex flex-col items-center gap-3">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl font-display text-xl font-extrabold text-white"
              style={{ background: accent }}
            >
              {tenantSlug.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="text-center">
            <div className="font-display text-lg font-extrabold">{branding?.name || tenantSlug}</div>
            <div className="mt-1 text-xs text-text-muted">Set your password to activate {email}</div>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="rounded-control bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
              Password set. You can now sign in.
            </div>
            <Button type="button" size="lg" style={{ background: accent }} onClick={() => navigate(`/${tenantSlug}/admin/login`, { replace: true })}>
              Go to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input value={email} disabled />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">New Password</Label>
                <PasswordInput
                  id="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <div className="rounded-control bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}

            <Button type="submit" size="lg" disabled={submitting} style={{ background: accent }}>
              {submitting ? "Setting password…" : "Set Password & Continue"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

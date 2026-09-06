import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/apiClient";
import { loginStaff } from "@/lib/auth";
import { lastTenantSlug } from "@/lib/lastTenantSlug";
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

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  waiter: "Waiter",
  kitchen: "Kitchen",
};

const ROLE_HOME: Record<string, string> = {
  admin: "/admin/dashboard",
  waiter: "/waiter",
  kitchen: "/kitchen",
};

export default function StaffLoginPage({ role }: { role: "admin" | "waiter" | "kitchen" }) {
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tenantSlug) lastTenantSlug.set(tenantSlug);
  }, [tenantSlug]);

  // Public lookup — name/logo/colors only, no auth data (§32).
  const { data: branding } = useQuery({
    queryKey: ["public-branding", tenantSlug],
    queryFn: () => api.get<TenantBranding>(`/public/tenant/branding?tenantSlug=${encodeURIComponent(tenantSlug)}`),
    enabled: Boolean(tenantSlug),
    retry: false,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginStaff(tenantSlug, email, password);
      navigate(ROLE_HOME[role]!, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const accent = branding?.primaryColor || "oklch(58% 0.15 40)";

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{ background: `linear-gradient(160deg, ${accent} 0%, oklch(30% 0.06 40) 100%)` }}
    >
      <CafeBackdrop accent={accent} />
      <form
        onSubmit={onSubmit}
        className="relative flex w-full max-w-sm flex-col gap-5 rounded-card bg-surface p-9 shadow-md2"
      >
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
            <div className="font-display text-lg font-extrabold">{branding?.name || tenantSlug || "Your café"}</div>
            <div className="mt-1 text-xs text-text-muted">{ROLE_LABEL[role]} sign in</div>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@cafe.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>

        {error && <div className="rounded-control bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}

        <Button type="submit" size="lg" disabled={submitting} style={{ background: accent }}>
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </div>
  );
}

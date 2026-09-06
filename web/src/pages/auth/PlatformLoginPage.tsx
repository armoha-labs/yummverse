import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/lib/apiClient";
import { loginPlatformAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { CafeBackdrop } from "@/components/CafeBackdrop";

export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginPlatformAdmin(email, password);
      navigate("/platform/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="platform-theme relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{ background: "linear-gradient(160deg, oklch(55% 0.17 260) 0%, oklch(24% 0.03 265) 100%)" }}
    >
      <CafeBackdrop accent="oklch(55% 0.17 260)" />
      <form onSubmit={onSubmit} className="relative flex w-full max-w-sm flex-col gap-5 rounded-card bg-surface p-9 shadow-md2">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent font-display text-xl font-extrabold text-white">
            Y
          </div>
          <div className="text-center">
            <div className="font-display text-lg font-extrabold">Yummverse</div>
            <div className="mt-1 text-xs text-text-muted">Platform Admin sign in</div>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yummverse.dev" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>

        {error && <div className="rounded-control bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </div>
  );
}

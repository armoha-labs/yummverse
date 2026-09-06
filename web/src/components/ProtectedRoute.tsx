import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { lastTenantSlug } from "@/lib/lastTenantSlug";
import type { StaffRole } from "@/lib/tokenStore";

function loginPathFor(role: StaffRole): string {
  if (role === "PLATFORM_ADMIN") return "/platform/login";
  const slug = lastTenantSlug.get();
  return slug ? `/${slug}/${role.toLowerCase()}/login` : "";
}

export function ProtectedRoute({ role, children }: { role: StaffRole; children: ReactNode }) {
  const auth = useAuth();

  if (!auth || auth.role !== role) {
    const path = loginPathFor(role);
    if (path) {
      window.location.assign(path);
      return null;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-center">
        <div className="max-w-sm text-sm text-text-muted">
          You need to sign in. Please use your café's own sign-in link
          (yourcafe.example.com/your-slug/{role.toLowerCase()}/login).
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

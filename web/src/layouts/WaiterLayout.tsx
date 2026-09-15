import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Armchair, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, logout } from "@/lib/auth";
import { useStaffBranding } from "@/lib/useTenantBranding";
import { api } from "@/lib/apiClient";
import { registerForPushNotifications } from "@/lib/pushNotifications";

export default function WaiterLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const branding = useStaffBranding();

  useEffect(() => {
    void registerForPushNotifications(api.post);
  }, []);

  async function onLogout() {
    await logout();
    navigate(`/${auth?.tenantSlug ?? ""}/waiter/login`, { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg font-body text-text">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
        <div>
          <div className="font-display text-base font-extrabold">{branding.data?.name ?? "Tables"}</div>
          <div className="mt-0.5 text-xs text-text-muted">{auth?.name}</div>
        </div>
        <button
          onClick={onLogout}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-display text-xs font-extrabold text-white"
        >
          {(auth?.name ?? "W")
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 border-t border-border bg-surface px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
        <NavLink
          to="tables"
          className={({ isActive }) =>
            cn("flex flex-1 flex-col items-center gap-1 text-text-muted", isActive && "text-accent")
          }
        >
          <Armchair size={20} strokeWidth={1.75} />
          <span className="text-[10px] font-semibold">Tables</span>
        </NavLink>
        <NavLink
          to="orders"
          className={({ isActive }) =>
            cn("flex flex-1 flex-col items-center gap-1 text-text-muted", isActive && "text-accent")
          }
        >
          <Receipt size={20} strokeWidth={1.75} />
          <span className="text-[10px] font-semibold">Orders</span>
        </NavLink>
      </nav>
    </div>
  );
}

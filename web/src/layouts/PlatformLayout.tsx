import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, logout } from "@/lib/auth";
import { PlatformSidebarArt } from "@/components/PlatformSidebarArt";

const NAV = [
  { to: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/platform/tenants", label: "Tenants", icon: Building2 },
];

export default function PlatformLayout() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/platform/login", { replace: true });
  }

  return (
    <div className="platform-theme flex min-h-screen bg-bg font-body text-text">
      <aside className="relative flex w-60 flex-none flex-col gap-1 overflow-hidden bg-sidebar-bg px-4 py-5 text-sidebar-muted">
        <PlatformSidebarArt />

        <div className="relative flex items-center gap-2.5 px-2 pb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent font-display text-[13px] font-extrabold text-white">
            Y
          </div>
          <div className="font-display text-sm font-bold text-white">Yummverse</div>
        </div>

        <nav className="relative flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium text-sidebar-muted",
                  isActive && "bg-white/10 font-semibold text-white",
                )
              }
            >
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="relative mt-auto flex items-center gap-2.5 px-2 pt-3">
          <div className="h-[30px] w-[30px] flex-none rounded-full bg-secondary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-white">{auth?.name ?? "Platform Admin"}</div>
            <div className="text-[11px] text-sidebar-muted">Platform Admin</div>
          </div>
          <button onClick={onLogout} className="text-[11px] font-semibold text-sidebar-muted hover:text-white">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-7">
        <Outlet />
      </main>
    </div>
  );
}

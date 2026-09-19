import { Suspense, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, logout } from "@/lib/auth";
import { PlatformSidebarArt } from "@/components/PlatformSidebarArt";
import { PageLoading } from "@/components/PageLoading";

const NAV = [
  { to: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/platform/tenants", label: "Tenants", icon: Building2 },
];

export default function PlatformLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  async function onLogout() {
    await logout();
    navigate("/platform/login", { replace: true });
  }

  return (
    // h-screen (not min-h-screen) — see AdminLayout.tsx for why: only a min-height lets main
    // grow to fit its content instead of being a real bounded scroll container.
    <div className="platform-theme flex h-screen flex-col bg-bg font-body text-text lg:flex-row">
      <header className="flex items-center justify-between border-b border-border bg-sidebar-bg px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent font-display text-[12px] font-extrabold text-white">
            Y
          </div>
          <div className="font-display text-sm font-bold text-white">Yummverse</div>
        </div>
        <button onClick={() => setNavOpen(true)} className="text-sidebar-muted hover:text-white" aria-label="Open menu">
          <Menu size={22} />
        </button>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-none -translate-x-full flex-col gap-1 overflow-hidden bg-sidebar-bg px-4 py-5 text-sidebar-muted transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:translate-x-0",
          navOpen && "translate-x-0",
        )}
      >
        <PlatformSidebarArt />

        <div className="relative flex items-center gap-2.5 px-2 pb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent font-display text-[13px] font-extrabold text-white">
            Y
          </div>
          <div className="font-display text-sm font-bold text-white">Yummverse</div>
          <button
            onClick={() => setNavOpen(false)}
            className="relative ml-auto text-sidebar-muted hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="relative flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setNavOpen(false)}
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

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-7">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

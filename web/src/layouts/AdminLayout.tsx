import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  ChefHat,
  UtensilsCrossed,
  Armchair,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Plug,
  ShoppingCart,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useTenantBranding } from "@/lib/useTenantBranding";
import { logout } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { registerForPushNotifications } from "@/lib/pushNotifications";
import { PageLoading } from "@/components/PageLoading";

// Relative to the current match (/:tenantSlug/admin) so the café slug in the URL is
// preserved when navigating between sections instead of being dropped.
const NAV = [
  { to: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "orders", label: "Orders", icon: Receipt },
  { to: "pos", label: "New Order", icon: ShoppingCart },
  { to: "kitchen", label: "Kitchen", icon: ChefHat },
  { to: "menu", label: "Menu", icon: UtensilsCrossed },
  { to: "tables", label: "Tables", icon: Armchair },
  { to: "branches", label: "Branches", icon: Building2 },
  { to: "staff", label: "Staff", icon: Users },
  { to: "payment-settings", label: "Payments", icon: CreditCard },
  { to: "integrations", label: "Integrations", icon: Plug },
  { to: "reports", label: "Reports", icon: BarChart3 },
  { to: "settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const branding = useTenantBranding();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    void registerForPushNotifications(api.post);
  }, []);

  async function onLogout() {
    await logout();
    navigate(`/${auth?.tenantSlug ?? ""}/admin/login`, { replace: true });
  }

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-5">
        {branding.data?.branding?.logoUrl ? (
          <img src={branding.data.branding.logoUrl} alt="" className="h-8 w-8 rounded-[9px] object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent font-display text-[13px] font-extrabold text-white">
            {(branding.data?.name ?? auth?.tenantSlug ?? "CF").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="truncate font-display text-sm font-bold text-white">
          {branding.data?.name ?? auth?.tenantSlug}
        </div>
        <button
          onClick={() => setNavOpen(false)}
          className="ml-auto text-sidebar-muted hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 overflow-y-auto">
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

      <div className="mt-auto flex items-center gap-2.5 px-2 pt-3">
        <div className="h-[30px] w-[30px] flex-none rounded-full bg-secondary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold text-white">{auth?.name ?? "Admin"}</div>
          <div className="text-[11px] text-sidebar-muted">Tenant Admin</div>
        </div>
        <button onClick={onLogout} className="text-[11px] font-semibold text-sidebar-muted hover:text-white">
          Sign out
        </button>
      </div>
    </>
  );

  return (
    // h-screen (not min-h-screen) so <main>'s overflow-y-auto is an actual bounded scroll
    // container — with only a min-height, main just grew to fit its content and the whole
    // document scrolled instead, which meant nothing nested inside main (a sticky cart
    // summary, for instance) had a real scrollport to stick against.
    <div className="flex h-screen flex-col bg-bg font-body text-text lg:flex-row">
      <header className="flex items-center justify-between border-b border-border bg-sidebar-bg px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          {branding.data?.branding?.logoUrl ? (
            <img src={branding.data.branding.logoUrl} alt="" className="h-7 w-7 rounded-[8px] object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent font-display text-[12px] font-extrabold text-white">
              {(branding.data?.name ?? auth?.tenantSlug ?? "CF").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="truncate font-display text-sm font-bold text-white">
            {branding.data?.name ?? auth?.tenantSlug}
          </div>
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
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-none -translate-x-full flex-col gap-1 bg-sidebar-bg px-4 py-5 text-sidebar-muted transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:translate-x-0",
          navOpen && "translate-x-0",
        )}
      >
        {sidebarContent}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-7">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

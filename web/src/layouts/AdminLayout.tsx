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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useTenantBranding } from "@/lib/useTenantBranding";
import { logout } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Orders", icon: Receipt },
  { to: "/admin/kitchen", label: "Kitchen", icon: ChefHat },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/admin/tables", label: "Tables", icon: Armchair },
  { to: "/admin/branches", label: "Branches", icon: Building2 },
  { to: "/admin/staff", label: "Staff", icon: Users },
  { to: "/admin/payment-settings", label: "Payments", icon: CreditCard },
  { to: "/admin/integrations", label: "Integrations", icon: Plug },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const branding = useTenantBranding();

  async function onLogout() {
    await logout();
    navigate(`/${auth?.tenantSlug ?? ""}/admin/login`, { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-bg font-body text-text">
      <aside className="flex w-60 flex-none flex-col gap-1 bg-sidebar-bg px-4 py-5 text-sidebar-muted">
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
        </div>

        <nav className="flex flex-col gap-0.5">
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
      </aside>

      <main className="flex-1 overflow-y-auto p-7">
        <Outlet />
      </main>
    </div>
  );
}

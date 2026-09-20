import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageLoading } from "@/components/PageLoading";

// Every route below is its own chunk, fetched on demand — a customer scanning a table's QR
// code has no reason to download the admin/platform/waiter bundles (and vice versa), and
// within a section, only the page actually being viewed loads. Layouts are lazy too, since a
// section's first visit needs the layout chunk regardless; each layout wraps its own <Outlet />
// in a nested Suspense (see AdminLayout.tsx etc.) so navigating between pages within an
// already-mounted section only suspends the content area, not the whole shell.
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const StaffLoginPage = lazy(() => import("@/pages/auth/StaffLoginPage"));
const PlatformLoginPage = lazy(() => import("@/pages/auth/PlatformLoginPage"));
const AcceptInvitePage = lazy(() => import("@/pages/auth/AcceptInvitePage"));
const DashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));
const OrdersPage = lazy(() => import("@/pages/admin/OrdersPage"));
const PosOrderPage = lazy(() => import("@/pages/admin/PosOrderPage"));
const KitchenMonitorPage = lazy(() => import("@/pages/admin/KitchenMonitorPage"));
const MenuManagementPage = lazy(() => import("@/pages/admin/MenuManagementPage"));
const TablesPage = lazy(() => import("@/pages/admin/TablesPage"));
const PaymentSettingsPage = lazy(() => import("@/pages/admin/PaymentSettingsPage"));
const IntegrationSettingsPage = lazy(() => import("@/pages/admin/IntegrationSettingsPage"));
const ReportsPage = lazy(() => import("@/pages/admin/ReportsPage"));
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage"));
const PlatformLayout = lazy(() => import("@/layouts/PlatformLayout"));
const PlatformDashboardPage = lazy(() => import("@/pages/platform/PlatformDashboardPage"));
const PlatformTenantsPage = lazy(() => import("@/pages/platform/PlatformTenantsPage"));
const PlatformTenantDetailPage = lazy(() => import("@/pages/platform/PlatformTenantDetailPage"));
const WaiterLayout = lazy(() => import("@/layouts/WaiterLayout"));
const WaiterTablesPage = lazy(() => import("@/pages/waiter/WaiterTablesPage"));
const WaiterOrdersPage = lazy(() => import("@/pages/waiter/WaiterOrdersPage"));
const KitchenDisplayPage = lazy(() => import("@/pages/kitchen/KitchenDisplayPage"));
const CustomerLayout = lazy(() => import("@/layouts/CustomerLayout"));
const QRLandingPage = lazy(() => import("@/pages/customer/QRLandingPage"));
const MenuBrowsingPage = lazy(() => import("@/pages/customer/MenuBrowsingPage"));
const CartPage = lazy(() => import("@/pages/customer/CartPage"));
const CheckoutPage = lazy(() => import("@/pages/customer/CheckoutPage"));
const OrderTrackingPage = lazy(() => import("@/pages/customer/OrderTrackingPage"));

export default function App() {
  return (
    <Suspense fallback={<PageLoading fullScreen />}>
      <Routes>
        <Route path="/" element={<Navigate to="/platform/login" replace />} />

        {/* Staff login — tenant resolved from the URL slug (§32) */}
        <Route path="/:tenantSlug/admin/login" element={<StaffLoginPage role="admin" />} />
        <Route path="/:tenantSlug/waiter/login" element={<StaffLoginPage role="waiter" />} />
        <Route path="/:tenantSlug/kitchen/login" element={<StaffLoginPage role="kitchen" />} />
        <Route path="/:tenantSlug/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/platform/login" element={<PlatformLoginPage />} />

        {/* Bare tenant slug (e.g. shared as a plain café link) — send to the admin login */}
        <Route path="/:tenantSlug" element={<Navigate to="admin/login" replace />} />
        <Route path="/:tenantSlug/" element={<Navigate to="admin/login" replace />} />

        {/* Tenant Admin console — the café slug stays in the URL for every authenticated
            screen (§32) so it's bookmarkable per café and two cafés open in different tabs
            never collide (auth lives in localStorage, shared across tabs). */}
        <Route
          path="/:tenantSlug/admin"
          element={
            <ProtectedRoute role="TENANT_ADMIN">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="pos" element={<PosOrderPage />} />
          <Route path="kitchen" element={<KitchenMonitorPage />} />
          <Route path="menu" element={<MenuManagementPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="payment-settings" element={<PaymentSettingsPage />} />
          <Route path="integrations" element={<IntegrationSettingsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Platform Admin console */}
        <Route
          path="/platform"
          element={
            <ProtectedRoute role="PLATFORM_ADMIN">
              <PlatformLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PlatformDashboardPage />} />
          <Route path="tenants" element={<PlatformTenantsPage />} />
          <Route path="tenants/:id" element={<PlatformTenantDetailPage />} />
        </Route>

        {/* Waiter app — mobile, branch-scoped (§6A.5) */}
        <Route
          path="/:tenantSlug/waiter"
          element={
            <ProtectedRoute role="WAITER">
              <WaiterLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="tables" replace />} />
          <Route path="tables" element={<WaiterTablesPage />} />
          <Route path="orders" element={<WaiterOrdersPage />} />
        </Route>

        <Route
          path="/:tenantSlug/kitchen"
          element={
            <ProtectedRoute role="KITCHEN">
              <KitchenDisplayPage />
            </ProtectedRoute>
          }
        />

        {/* Customer ordering PWA — reached by scanning a table's QR code (§21/§22), never signed in */}
        <Route path="/t/:qrToken" element={<QRLandingPage />} />
        <Route path="/t/:qrToken" element={<CustomerLayout />}>
          <Route path="menu" element={<MenuBrowsingPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders/:orderId" element={<OrderTrackingPage />} />
        </Route>

        <Route path="*" element={<div className="p-10 text-center text-text-muted">Not found.</div>} />
      </Routes>
    </Suspense>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AdminLayout from "@/layouts/AdminLayout";
import StaffLoginPage from "@/pages/auth/StaffLoginPage";
import PlatformLoginPage from "@/pages/auth/PlatformLoginPage";
import AcceptInvitePage from "@/pages/auth/AcceptInvitePage";
import DashboardPage from "@/pages/admin/DashboardPage";
import OrdersPage from "@/pages/admin/OrdersPage";
import PosOrderPage from "@/pages/admin/PosOrderPage";
import KitchenMonitorPage from "@/pages/admin/KitchenMonitorPage";
import MenuManagementPage from "@/pages/admin/MenuManagementPage";
import TablesPage from "@/pages/admin/TablesPage";
import BranchesPage from "@/pages/admin/BranchesPage";
import StaffPage from "@/pages/admin/StaffPage";
import PaymentSettingsPage from "@/pages/admin/PaymentSettingsPage";
import IntegrationSettingsPage from "@/pages/admin/IntegrationSettingsPage";
import ReportsPage from "@/pages/admin/ReportsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import PlatformLayout from "@/layouts/PlatformLayout";
import PlatformDashboardPage from "@/pages/platform/PlatformDashboardPage";
import PlatformTenantsPage from "@/pages/platform/PlatformTenantsPage";
import PlatformTenantDetailPage from "@/pages/platform/PlatformTenantDetailPage";
import WaiterLayout from "@/layouts/WaiterLayout";
import WaiterTablesPage from "@/pages/waiter/WaiterTablesPage";
import WaiterOrdersPage from "@/pages/waiter/WaiterOrdersPage";
import KitchenDisplayPage from "@/pages/kitchen/KitchenDisplayPage";
import CustomerLayout from "@/layouts/CustomerLayout";
import QRLandingPage from "@/pages/customer/QRLandingPage";
import MenuBrowsingPage from "@/pages/customer/MenuBrowsingPage";
import CartPage from "@/pages/customer/CartPage";
import CheckoutPage from "@/pages/customer/CheckoutPage";
import OrderTrackingPage from "@/pages/customer/OrderTrackingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/platform/login" replace />} />

      {/* Staff login — tenant resolved from the URL slug (§32) */}
      <Route path="/:tenantSlug/admin/login" element={<StaffLoginPage role="admin" />} />
      <Route path="/:tenantSlug/waiter/login" element={<StaffLoginPage role="waiter" />} />
      <Route path="/:tenantSlug/kitchen/login" element={<StaffLoginPage role="kitchen" />} />
      <Route path="/:tenantSlug/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/platform/login" element={<PlatformLoginPage />} />

      {/* Tenant Admin console — slug-free once signed in (§32) */}
      <Route
        path="/admin"
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
        <Route path="branches" element={<BranchesPage />} />
        <Route path="staff" element={<StaffPage />} />
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
        path="/waiter"
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
        path="/kitchen"
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
  );
}

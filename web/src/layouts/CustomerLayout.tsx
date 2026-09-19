import { Suspense, useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { useCustomerAuth } from "@/lib/customerAuth";
import { PageLoading } from "@/components/PageLoading";

function applyThemeVars(primaryColor?: string, secondaryColor?: string): () => void {
  const root = document.documentElement;
  if (primaryColor) root.style.setProperty("--accent", primaryColor);
  if (secondaryColor) root.style.setProperty("--secondary", secondaryColor);
  return () => {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--secondary");
  };
}

/** Guards every /t/:qrToken/* page below the landing screen — a session must already exist
 * for THIS qrToken (§56). If it doesn't (first visit, expired and un-recoverable, or a
 * different table's QR), bounce back to the landing screen to (re)create it. */
export default function CustomerLayout() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const auth = useCustomerAuth();

  useEffect(() => applyThemeVars(auth?.primaryColor, auth?.secondaryColor), [auth?.primaryColor, auth?.secondaryColor]);

  if (!auth || auth.qrToken !== qrToken) {
    return <Navigate to={`/t/${qrToken}`} replace />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-bg font-body text-text">
      <Suspense fallback={<PageLoading />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AlertCircle, Check } from "lucide-react";
import { fetchPublic, requestCustomerSession } from "@/lib/customerApiClient";
import { customerAuthStore } from "@/lib/customerAuth";
import { cartStore } from "@/lib/cartStore";
import { ApiError } from "@/lib/apiClient";

interface TableContext {
  table: { tableNumber: string; status: string };
  branch: { id: string; name: string; allowPayLater: boolean; kitchenEnabled: boolean };
  tenant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    branding?: { logoUrl?: string; primaryColor?: string; secondaryColor?: string };
  };
}

type Phase = "loading" | "confirmed" | "error";

/** §21/§22's QR entry point: resolve the table, mint a customer session, then move on to
 * the menu. Nothing here is user-interactive — it's a brief branded loading screen. A short
 * confirmed pause before navigating (rather than an instant redirect) gives the "we found
 * your table" moment a chance to register, instead of flashing past unnoticed. */
export default function QRLandingPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [context, setContext] = useState<TableContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [navigateNow, setNavigateNow] = useState(false);

  useEffect(() => {
    if (!qrToken) return;
    let cancelled = false;

    async function run() {
      try {
        const ctx = await fetchPublic<TableContext>(`/public/tables/${qrToken}`);
        if (cancelled) return;
        setContext(ctx);

        const session = await requestCustomerSession(qrToken!);
        if (cancelled) return;

        cartStore.ensureFor(session.tenantId, session.tableId);
        customerAuthStore.set({
          sessionToken: session.sessionToken,
          qrToken: qrToken!,
          expiresAt: session.expiresAt,
          tenantId: session.tenantId,
          branchId: session.branchId,
          tableId: session.tableId,
          tenantName: ctx.tenant.name,
          tenantSlug: ctx.tenant.slug,
          currency: ctx.tenant.currency,
          tableNumber: ctx.table.tableNumber,
          allowPayLater: ctx.branch.allowPayLater,
          kitchenEnabled: ctx.branch.kitchenEnabled,
          primaryColor: ctx.tenant.branding?.primaryColor,
          secondaryColor: ctx.tenant.branding?.secondaryColor,
          logoUrl: ctx.tenant.branding?.logoUrl,
        });

        setPhase("confirmed");
        setTimeout(() => {
          if (!cancelled) setNavigateNow(true);
        }, 500);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try scanning again.");
        setPhase("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [qrToken]);

  if (navigateNow) return <Navigate to={`/t/${qrToken}/menu`} replace />;

  const accent = context?.tenant.branding?.primaryColor ?? "oklch(58% 0.15 40)";
  const initials = (context?.tenant.name ?? "Café").slice(0, 2).toUpperCase();

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-8 text-center font-body text-text">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertCircle size={28} strokeWidth={1.75} />
        </div>
        <div>
          <div className="font-display text-lg font-extrabold">Can&rsquo;t open this menu</div>
          <div className="mx-auto mt-1.5 max-w-xs text-sm text-text-muted">{error}</div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-md2"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-7 overflow-hidden font-body text-text"
      style={{ background: `radial-gradient(circle at 50% 28%, ${accent} 0%, var(--bg) 62%)` }}
    >
      <div className="relative flex h-[104px] w-[104px] items-center justify-center">
        {phase === "loading" && (
          <div
            className="absolute inset-0 rounded-[30px] bg-white"
            style={{ animation: "breathe 1.8s ease-in-out infinite" }}
          />
        )}
        <div className="relative flex h-[92px] w-[92px] items-center justify-center rounded-[26px] bg-white shadow-[0_16px_40px_oklch(20%_0_0_/_0.18)]">
          {phase === "confirmed" ? (
            <div
              className="flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-success text-white"
              style={{ animation: "popIn 0.35s ease-out" }}
            >
              <Check size={30} strokeWidth={3} />
            </div>
          ) : (
            <div
              className="flex h-[60px] w-[60px] items-center justify-center rounded-2xl font-display text-[22px] font-extrabold text-white"
              style={{ background: accent }}
            >
              {initials}
            </div>
          )}
        </div>
      </div>

      <div
        className="text-center text-white [text-shadow:0_2px_12px_oklch(20%_0_0_/_0.2)]"
        style={{ animation: "fadeInUp 0.5s ease-out" }}
      >
        <div className="font-display text-xl font-extrabold">{context?.tenant.name ?? "Finding your table…"}</div>
        {context && (
          <div className="mt-1.5 text-[13.5px] opacity-90">
            Table {context.table.tableNumber} &middot; {context.branch.name}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 rounded-full bg-white px-[18px] py-[10px] shadow-[0_4px_14px_oklch(20%_0_0_/_0.08)]">
        {phase === "confirmed" ? (
          <span className="text-[13px] font-semibold text-success">Table found — enjoy!</span>
        ) : (
          <>
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-[6px] w-[6px] rounded-full bg-accent"
                  style={{ animation: "bounceDot 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            <span className="text-[13px] text-text-muted">Setting up your table&hellip;</span>
          </>
        )}
      </div>
    </div>
  );
}

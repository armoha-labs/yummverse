export const PLAN_IDS = ["FREE", "STARTER", "PRO", "ENTERPRISE"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

// Monthly subscription price, in the platform's own billing currency (INR) — what
// Yummverse charges the café for the plan itself, distinct from the café's own customer
// payment gateway (§15/§37). Used to price generated subscription invoices (§47A).
export const PLAN_PRICING: Record<PlanId, number> = {
  FREE: 0,
  STARTER: 999,
  PRO: 2999,
  ENTERPRISE: 9999,
};

// A large finite sentinel, not Infinity — JSON.stringify(Infinity) serializes to `null`,
// which would silently break every client that reads this value over the API.
export const UNLIMITED = 1_000_000_000;

export interface PlanLimits {
  maxTables: number;
  maxStaffUsers: number;
  maxOrdersPerMonth: number;
  advancedReports: boolean;
  customBranding: boolean;
  allowedPaymentProviders: string[];
  paymentGatewayEnabled: boolean;
  thermalPrintingEnabled: boolean;
  eInvoiceWhatsappEnabled: boolean;
  firebasePushEnabled: boolean;
  swiggyIntegrationEnabled: boolean;
  zomatoIntegrationEnabled: boolean;
}

// §47's per-plan defaults — Platform Admin can override any of these per tenant (§7A)
// without changing the tenant's plan.
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: {
    maxTables: 10,
    maxStaffUsers: 5,
    maxOrdersPerMonth: 500,
    advancedReports: false,
    customBranding: false,
    allowedPaymentProviders: ["RAZORPAY"],
    paymentGatewayEnabled: true,
    thermalPrintingEnabled: false,
    eInvoiceWhatsappEnabled: false,
    firebasePushEnabled: true,
    swiggyIntegrationEnabled: false,
    zomatoIntegrationEnabled: false,
  },
  STARTER: {
    maxTables: 25,
    maxStaffUsers: 15,
    maxOrdersPerMonth: 2000,
    advancedReports: false,
    customBranding: true,
    allowedPaymentProviders: ["RAZORPAY"],
    paymentGatewayEnabled: true,
    thermalPrintingEnabled: false,
    eInvoiceWhatsappEnabled: false,
    firebasePushEnabled: true,
    swiggyIntegrationEnabled: false,
    zomatoIntegrationEnabled: false,
  },
  PRO: {
    maxTables: 100,
    maxStaffUsers: 50,
    maxOrdersPerMonth: 20000,
    advancedReports: true,
    customBranding: true,
    allowedPaymentProviders: ["RAZORPAY", "STRIPE"],
    paymentGatewayEnabled: true,
    thermalPrintingEnabled: true,
    eInvoiceWhatsappEnabled: true,
    firebasePushEnabled: true,
    swiggyIntegrationEnabled: true,
    zomatoIntegrationEnabled: true,
  },
  ENTERPRISE: {
    maxTables: UNLIMITED,
    maxStaffUsers: UNLIMITED,
    maxOrdersPerMonth: UNLIMITED,
    advancedReports: true,
    customBranding: true,
    allowedPaymentProviders: ["RAZORPAY", "STRIPE", "PAYPAL", "OTHER"],
    paymentGatewayEnabled: true,
    thermalPrintingEnabled: true,
    eInvoiceWhatsappEnabled: true,
    firebasePushEnabled: true,
    swiggyIntegrationEnabled: true,
    zomatoIntegrationEnabled: true,
  },
};

// Platform-wide hard default — the last-resort safety ceiling in §7A.2's resolution chain,
// used only for a plan/field this map doesn't otherwise bound.
export const HARD_CEILING: PlanLimits = {
  maxTables: 200,
  maxStaffUsers: 100,
  maxOrdersPerMonth: 100000,
  advancedReports: false,
  customBranding: false,
  allowedPaymentProviders: ["RAZORPAY"],
  paymentGatewayEnabled: true,
  thermalPrintingEnabled: false,
  eInvoiceWhatsappEnabled: false,
  firebasePushEnabled: true,
  swiggyIntegrationEnabled: false,
  zomatoIntegrationEnabled: false,
};

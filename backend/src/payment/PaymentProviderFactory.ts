import type { PaymentProviderName } from "../models/TenantPaymentSettings.js";
import type { PaymentProvider } from "./PaymentProvider.js";
import { RazorpayProvider } from "./RazorpayProvider.js";
import { ApiError } from "../utils/ApiError.js";

const razorpay = new RazorpayProvider();

/** MVP enables only Razorpay (§14) — other providers are modeled but not wired up yet. */
export const PaymentProviderFactory = {
  getProvider(providerName: PaymentProviderName): PaymentProvider {
    if (providerName === "RAZORPAY") return razorpay;
    throw ApiError.badRequest(
      "PROVIDER_NOT_SUPPORTED",
      `Payment provider "${providerName}" is not yet supported.`,
    );
  },
};

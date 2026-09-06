export interface ProviderCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export interface CreateOrderInput {
  credentials: ProviderCredentials;
  amount: number; // smallest currency unit (e.g. paise)
  currency: string;
  receipt: string;
  testMode: boolean;
}

export interface PaymentOrder {
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface VerifyPaymentInput {
  credentials: ProviderCredentials;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface PaymentVerification {
  verified: boolean;
  method?: string;
}

export interface WebhookInput {
  credentials: ProviderCredentials;
  rawBody: string;
  signatureHeader: string;
}

export interface WebhookResult {
  verified: boolean;
  eventType?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerEventId?: string;
}

export interface RefundInput {
  credentials: ProviderCredentials;
  providerPaymentId: string;
  amount: number;
}

export interface RefundResult {
  providerRefundId: string;
  status: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

/** The business layer depends on this, never on a concrete gateway SDK directly (§13). */
export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<PaymentOrder>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerification>;
  processWebhook(input: WebhookInput): Promise<WebhookResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** Backs the Payment Settings screen's "Test Connection" action (§16, §17). */
  testConnection(credentials: ProviderCredentials): Promise<TestConnectionResult>;
}

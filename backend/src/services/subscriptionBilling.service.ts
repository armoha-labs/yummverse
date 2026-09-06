import { subscriptionInvoiceRepository } from "../repositories/subscriptionInvoice.repository.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { nextSequence } from "../models/Counter.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { emailService } from "./email.service.js";
import { generateSubscriptionInvoicePdf } from "../utils/invoicePdf.js";
import { ApiError } from "../utils/ApiError.js";
import { PLAN_PRICING, type PlanId } from "../config/plans.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RENEWAL_WARNING_DAYS = 7;

function toClientShape(doc: NonNullable<Awaited<ReturnType<typeof subscriptionInvoiceRepository.findById>>>) {
  return {
    id: doc._id,
    invoiceNumber: doc.invoiceNumber,
    planId: doc.planId,
    amount: doc.amount,
    currency: doc.currency,
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    status: doc.status,
    sentAt: doc.sentAt ?? null,
    paidAt: doc.paidAt ?? null,
    createdAt: doc.createdAt,
  };
}

export const subscriptionBillingService = {
  /** Renewal status computed straight from Tenant.subscription — no separate storage, so
   * it's always in sync with whatever Platform Admin last set on the Subscription panel. */
  renewalStatusFor(subscription: { status?: string; endDate?: Date | null } | undefined) {
    if (!subscription?.endDate) return { state: "none" as const, daysRemaining: null };
    const daysRemaining = Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysRemaining < 0) return { state: "overdue" as const, daysRemaining };
    if (daysRemaining <= RENEWAL_WARNING_DAYS) return { state: "due_soon" as const, daysRemaining };
    return { state: "ok" as const, daysRemaining };
  },

  async countRenewalsDueSoon(): Promise<number> {
    const cutoff = new Date(Date.now() + RENEWAL_WARNING_DAYS * 24 * 60 * 60 * 1000);
    return tenantRepository.countActiveWithEndDateBefore(cutoff);
  },

  async listInvoices(tenantId: string) {
    const docs = await subscriptionInvoiceRepository.listForTenant(tenantId);
    return docs.map(toClientShape);
  },

  async generateInvoice(tenantId: string, actor: Actor & { platformAdminId: string }) {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    const planId = (tenant.subscription?.planId ?? "FREE") as PlanId;
    const amount = PLAN_PRICING[planId] ?? 0;
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + THIRTY_DAYS_MS);
    const seq = await nextSequence("subscription-invoice");
    const invoiceNumber = `INV-${String(seq).padStart(6, "0")}`;

    const doc = await subscriptionInvoiceRepository.create({
      tenantId,
      invoiceNumber,
      planId,
      amount,
      currency: "INR",
      periodStart,
      periodEnd,
      generatedByPlatformAdminId: actor.platformAdminId,
    });

    await auditService.record({
      tenantId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.actorId,
      action: "SUBSCRIPTION_INVOICE_GENERATED",
      entityType: "SubscriptionInvoice",
      entityId: doc._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return toClientShape(doc);
  },

  async sendInvoice(tenantId: string, invoiceId: string, actor: Actor & { platformAdminId: string }) {
    const [tenant, invoice, admin] = await Promise.all([
      tenantRepository.findById(tenantId),
      subscriptionInvoiceRepository.findById(tenantId, invoiceId),
      userRepository.findTenantAdmin(tenantId),
    ]);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");
    if (!invoice) throw ApiError.notFound("INVOICE_NOT_FOUND", "Invoice not found.");
    if (!admin) throw ApiError.notFound("TENANT_ADMIN_NOT_FOUND", "This tenant has no admin user to send the invoice to.");

    const pdf = await generateSubscriptionInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      tenantName: tenant.name,
      planId: invoice.planId,
      amount: invoice.amount,
      currency: invoice.currency,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      issuedAt: invoice.createdAt,
    });

    await emailService.send({
      to: admin.email,
      subject: `Yummverse subscription invoice ${invoice.invoiceNumber}`,
      text: `Your ${invoice.planId} plan subscription invoice (${invoice.invoiceNumber}) for ${invoice.currency} ${invoice.amount} is attached.`,
      html: `<p>Your <strong>${invoice.planId}</strong> plan subscription invoice (${invoice.invoiceNumber}) for ${invoice.currency} ${invoice.amount} is attached.</p>`,
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdf, contentType: "application/pdf" }],
    });

    invoice.status = invoice.status === "PAID" ? "PAID" : "SENT";
    invoice.sentAt = new Date();
    await invoice.save();

    await auditService.record({
      tenantId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.actorId,
      action: "SUBSCRIPTION_INVOICE_SENT",
      entityType: "SubscriptionInvoice",
      entityId: invoice._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return toClientShape(invoice);
  },

  async markPaid(tenantId: string, invoiceId: string, actor: Actor & { platformAdminId: string }) {
    const invoice = await subscriptionInvoiceRepository.findById(tenantId, invoiceId);
    if (!invoice) throw ApiError.notFound("INVOICE_NOT_FOUND", "Invoice not found.");

    invoice.status = "PAID";
    invoice.paidAt = new Date();
    await invoice.save();

    await auditService.record({
      tenantId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.actorId,
      action: "SUBSCRIPTION_INVOICE_MARKED_PAID",
      entityType: "SubscriptionInvoice",
      entityId: invoice._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return toClientShape(invoice);
  },

  async getPdf(tenantId: string, invoiceId: string) {
    const [tenant, invoice] = await Promise.all([
      tenantRepository.findById(tenantId),
      subscriptionInvoiceRepository.findById(tenantId, invoiceId),
    ]);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");
    if (!invoice) throw ApiError.notFound("INVOICE_NOT_FOUND", "Invoice not found.");

    return generateSubscriptionInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      tenantName: tenant.name,
      planId: invoice.planId,
      amount: invoice.amount,
      currency: invoice.currency,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      issuedAt: invoice.createdAt,
    });
  },
};

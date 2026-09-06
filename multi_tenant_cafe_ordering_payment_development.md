# Yummverse
## Multi-Tenant Café Ordering & Payment SaaS — Detailed Development Specification

**Version:** 2.0 (Frozen)  
**Date:** 2026-08-28  
**Document Type:** Technical Development Specification  
**Application Type:** Multi-tenant QR-based Café Ordering, Kitchen and Payment SaaS (Web + Mobile + POS)

> **Freeze Notice.** v2.0 is the current frozen baseline of the Yummverse specification — the scope and rules on which development proceeds. It supersedes v1.0 and folds in amendments v1.1–v1.3 (audit log completeness, payment-audit no-value-snapshot rule, tenant-URL-resolved staff sign-in — see History below). Changes from here on are amendments against v2.0 (v2.1, v2.2, ...), not edits to it; a change that alters an established rule (tenant/branch isolation, payment ownership, role permissions, etc.) is called out explicitly as a deviation from v2.0 rather than silently rewritten in place.

## History

- **v1.0 (Frozen)** — original baseline.
- **v1.1** — Audit log completeness fix: added `TENANT_PROFILE_UPDATED`, `TENANT_SETTINGS_UPDATED`, `TENANT_BRANDING_UPDATED`, `TENANT_ACTIVATED`, `TENANT_CANCELLED` (§53).
- **v1.2** — Clarified that `PAYMENT_SETTINGS_UPDATED`/`PAYMENT_PROVIDER_CHANGED` never carry a `before`/`after` value snapshot, not even non-secret fields (§53).
- **v1.3** — Staff sign-in moved to tenant-URL-resolved routes (`/{tenantSlug}/admin|waiter|kitchen/login`, §32), removing the ambiguity of an email-only lookup across tenants (`User.email` is unique only within a tenant, §55) while introducing no new cross-tenant access path.
- **v2.0 (Frozen)** — re-freeze: v1.1–v1.3 folded into the baseline; all rule guarantees they introduced (audit completeness, payment-audit redaction, sign-in tenant resolution with no isolation weakening) are now part of v2.0 itself, not amendments to track separately.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Business Model](#2-business-model)
- [3. Roles and Scope](#3-roles-and-scope)
- [4. Multi-Tenant Architecture](#4-multi-tenant-architecture)
- [5. Tenant Isolation](#5-tenant-isolation)
- [6. Tenant Model](#6-tenant-model)
- [6A. Multi-Branch Architecture](#6a-multi-branch-architecture)
- [7. Platform Admin](#7-platform-admin)
- [7A. Tenant Limits & Feature Overrides — Platform Admin](#7a-tenant-limits--feature-overrides--platform-admin)
- [8. Tenant Admin](#8-tenant-admin)
- [8A. Staff Management (Waiters & Kitchen) — Admin](#8a-staff-management-waiters--kitchen--admin)
- [9. Waiter](#9-waiter)
- [10. Kitchen](#10-kitchen)
- [11. Customer](#11-customer)
- [12. Tenant-Specific Payment Configuration](#12-tenant-specific-payment-configuration)
- [13. Payment Provider Abstraction](#13-payment-provider-abstraction)
- [14. Tenant Payment Settings Model](#14-tenant-payment-settings-model)
- [15. Payment Credential Security](#15-payment-credential-security)
- [16. Tenant Payment Settings UI](#16-tenant-payment-settings-ui)
- [17. Payment Configuration Permissions](#17-payment-configuration-permissions)
- [18. Tenant Payment Flow](#18-tenant-payment-flow)
- [19. Payment Security Rules](#19-payment-security-rules)
- [20. Payment Database Model](#20-payment-database-model)
- [21. Customer QR Architecture](#21-customer-qr-architecture)
- [22. QR Validation](#22-qr-validation)
- [22A. Table Management — Admin](#22a-table-management--admin)
- [22B. Menu Browsing & Category Filtering](#22b-menu-browsing--category-filtering)
- [23. Customer Ordering](#23-customer-ordering)
- [23A. POS / Counter Ordering](#23a-pos--counter-ordering)
- [24. Order Model](#24-order-model)
- [25. Order Lifecycle](#25-order-lifecycle)
- [26. Multi-Tenant Database Collections](#26-multi-tenant-database-collections)
- [27. User Model](#27-user-model)
- [28. Category Model](#28-category-model)
- [29. Menu Item Model](#29-menu-item-model)
- [29A. Menu Management — Admin](#29a-menu-management--admin)
- [30. Tenant Settings](#30-tenant-settings)
- [31. Tenant Branding](#31-tenant-branding)
- [31A. Tenant Logo Configuration](#31a-tenant-logo-configuration)
- [32. Tenant Routing](#32-tenant-routing)
- [33. Authentication Context](#33-authentication-context)
- [34. Tenant Middleware](#34-tenant-middleware)
- [35. Tenant-Aware Repository](#35-tenant-aware-repository)
- [36. API Design](#36-api-design)
- [37. Payment Webhook Architecture](#37-payment-webhook-architecture)
- [38. Webhook Idempotency](#38-webhook-idempotency)
- [39. Real-Time Communication](#39-real-time-communication)
- [40. Real-Time Events](#40-real-time-events)
- [40A. Push Notifications (Firebase Cloud Messaging)](#40a-push-notifications-firebase-cloud-messaging)
- [41. Web Frontend Architecture](#41-web-frontend-architecture)
- [41A. Mobile App Architecture (Flutter)](#41a-mobile-app-architecture-flutter)
- [41B. UI/UX Design Guidelines](#41b-uiux-design-guidelines)
- [42. Backend Architecture](#42-backend-architecture)
- [43. Payment Service Design](#43-payment-service-design)
- [44. Frontend Payment Flow](#44-frontend-payment-flow)
- [45. Menu and Order Tenant Isolation](#45-menu-and-order-tenant-isolation)
- [46. Tenant-Specific Reports](#46-tenant-specific-reports)
- [47. Tenant Subscription](#47-tenant-subscription)
- [48. Tenant Onboarding](#48-tenant-onboarding)
- [49. Tenant Activation](#49-tenant-activation)
- [50. Tenant Deletion](#50-tenant-deletion)
- [51. Security Requirements](#51-security-requirements)
- [52. Sensitive Data Rules](#52-sensitive-data-rules)
- [53. Audit Logging](#53-audit-logging)
- [54. Environment Variables](#54-environment-variables)
- [55. Database Indexes](#55-database-indexes)
- [56. Customer Session Model](#56-customer-session-model)
- [57. Multiple Customers at One Table](#57-multiple-customers-at-one-table)
- [58. Table Session Handling](#58-table-session-handling)
- [59. Customer Order Tracking](#59-customer-order-tracking)
- [60. Development Phases](#60-development-phases)
- [61. Testing Strategy](#61-testing-strategy)
- [62. End-to-End Test](#62-end-to-end-test)
- [63. Deployment Architecture](#63-deployment-architecture)
- [64. Production Scaling](#64-production-scaling)
- [65. Caching](#65-caching)
- [66. File Storage](#66-file-storage)
- [67. Observability](#67-observability)
- [68. Backup and Recovery](#68-backup-and-recovery)
- [69. Data Retention](#69-data-retention)
- [70. API Response Format](#70-api-response-format)
- [71. Recommended Frontend Routes](#71-recommended-frontend-routes)
- [72. MVP Acceptance Criteria](#72-mvp-acceptance-criteria)
- [73. Recommended Technology Stack](#73-recommended-technology-stack)
- [74. Final Architecture](#74-final-architecture)
- [75. Core Architectural Principles](#75-core-architectural-principles)
- [76. Final MVP User Journey](#76-final-mvp-user-journey)

---

# 1. Project Overview

**Yummverse** is a **multi-tenant café ordering and payment platform**. "Yummverse" is the SaaS product itself — the platform Platform Admin operates; each individual café (like the "Green Leaf Café" example used throughout this document) is a tenant running on Yummverse, never the other way around.

Each café is represented as an independent tenant. A tenant has its own:

- Café profile.
- Branding.
- Admin users.
- Waiters.
- Kitchen users.
- Tables.
- QR codes.
- Menu categories.
- Menu items.
- Orders.
- Customers/sessions.
- Payment configuration.
- Payment transactions.
- Reports.
- Business settings.

Customers scan a QR code assigned to a café table, browse the tenant's menu, create an order, and pay using the payment gateway configured by that tenant.

Customers can complete this entire flow — browsing, ordering, and payment — from either:

- The **responsive web app** (React / Vite PWA), or
- The **native mobile app** (Flutter, iOS + Android).

Both clients are thin presentation layers over the same backend REST/Socket.IO APIs, so tenant isolation, pricing, tax calculation, and payment verification are enforced identically regardless of which client the customer uses. Neither client is authoritative for price, tax, tenant identity, or payment status — the backend is.

The application has the following roles:

1. **Platform Admin** — manages the SaaS platform and tenants.
2. **Tenant Admin** — manages one café.
3. **Waiter** — monitors tables and serves ready orders.
4. **Kitchen** — prepares orders.
5. **Customer** — creates orders through the public QR ordering flow.

The critical architectural requirement is:

> **Every tenant must be completely isolated from every other tenant.**

A tenant must never be able to access another tenant's:

- Users.
- Menu.
- Tables.
- Orders.
- Customers.
- Payments.
- Payment credentials.
- Reports.
- Settings.

---

# 2. Business Model

The platform operates as a SaaS product.

```text
                         PLATFORM
                            |
                  Platform Administration
                            |
        +-------------------+-------------------+
        |                   |                   |
      Tenant A            Tenant B            Tenant C
        |                   |                   |
      Café A              Café B              Café C
        |                   |                   |
   +----+----+         +----+----+         +----+----+
   |    |    |         |    |    |         |    |    |
 Admin Waiter Kitchen Admin Waiter Kitchen Admin Waiter Kitchen
```

Each tenant operates independently while using the same platform infrastructure.

---

# 3. Roles and Scope

| Role | Scope | Main Responsibility |
|---|---|---|
| Platform Admin | All tenants | SaaS/platform management |
| Tenant Admin | One tenant | Café management |
| Waiter | One tenant | Table/order monitoring and serving |
| Kitchen | One tenant | Food preparation |
| Customer | One table/session | Ordering and payment |

---

# 4. Multi-Tenant Architecture

The recommended model is a **shared application + shared MongoDB cluster + logical tenant isolation**.

```text
                             Internet
                                |
                  +-------------+-------------+
                  |                           |
                  v                           v
           React / Vite PWA           Flutter Mobile App
                  |                           |
                  +-------------+-------------+
                                |
                                v
                       Node.js API Server
                                |
                  +-------------+-------------+
                  |                           |
                  v                           v
             Tenant Context              Authentication
                  |                           |
                  +-------------+-------------+
                                |
                                v
                            MongoDB
                                |
             +------------------+------------------+
             |                  |                  |
          Tenant A           Tenant B           Tenant C
```

Both clients call the identical `/api/v1` REST endpoints and connect to the same Socket.IO namespace/rooms for real-time order status updates. No business logic, pricing, or tenant-scoping logic is duplicated per-client — it lives once, in the backend.

Every tenant-owned collection must contain:

```text
tenantId
```

Example:

```javascript
{
  _id: "...",
  tenantId: "...",
  name: "Cappuccino",
  price: 150
}
```

---

# 5. Tenant Isolation

Tenant isolation is one of the highest-priority security requirements.

## 5.1 Backend Rule

Never trust a tenant ID supplied by a normal client.

Do not implement:

```text
GET /orders?tenantId=TENANT_A
```

as the security mechanism.

Instead:

```text
Authenticated Request
        |
        v
Authentication Middleware
        |
        v
User
        |
        v
user.tenantId
        |
        v
Tenant Context
        |
        v
Database Query
```

For example:

```javascript
Order.find({
  tenantId: request.tenantId
});
```

## 5.2 Platform Admin

Platform Admin may explicitly select a tenant for management operations.

This must be authorized separately.

## 5.3 Customer

Customer tenant context is derived from the validated QR/table token.

```text
QR Token
   |
   v
Validate Token
   |
   v
Resolve Table
   |
   v
Resolve Tenant
   |
   v
Customer Session
```

The customer cannot change the tenant ID manually.

---

# 6. Tenant Model

```javascript
Tenant {
  _id,
  name,
  slug,

  branding: {
    logoUrl,
    logoAssetId,
    primaryColor,
    secondaryColor,
    faviconUrl
  },

  contact: {
    phone,
    email
  },

  address: {
    line1,
    line2,
    city,
    state,
    country,
    postalCode
  },

  currency: "INR",
  timezone: "Asia/Kolkata",

  status: "ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED",

  subscription: {
    planId,
    status,
    startDate,
    endDate
  },

  createdAt,
  updatedAt
}
```

---

# 6A. Multi-Branch Architecture

A tenant (the café business/brand) may operate **more than one physical location**. Each location is a **Branch**.

```text
Tenant — "Green Leaf Café"
   |
   +-- Branch: Koramangala
   |      Tables, QR codes, Orders, Waiters, Kitchen staff
   |
   +-- Branch: Indiranagar
   |      Tables, QR codes, Orders, Waiters, Kitchen staff
   |
   +-- Shared across all branches:
          Branding (logo, colors), Menu & Categories, Tenant Admin users,
          Subscription/plan
```

## 6A.1 What is shared vs. per-branch

| Resource | Scope | Notes |
|---|---|---|
| Branding (logo, colors) | Tenant-wide | One brand identity across locations |
| Menu & Categories | Tenant-wide (shared master menu) | A branch may mark specific items unavailable locally (§6A.4) |
| Tenant Admin users | Tenant-wide | Sees and manages every branch |
| Subscription / plan | Tenant-wide | Branch count is plan-gated (§47) |
| Tables & QR codes | Per-branch | A table belongs to exactly one branch |
| Orders & Customer Sessions | Per-branch | An order is placed at, and scoped to, one branch |
| Waiters & Kitchen staff | Per-branch | Staff work at one physical location |
| Tax / service charge settings | Per-branch, tenant default as fallback | Locations can be in different tax jurisdictions |
| Payment configuration | Tenant-wide by default; **optionally** overridden per branch | See §6A.3 |
| Reports | Per-branch, with a tenant-wide aggregate for Tenant Admin | See §46 |

Every tenant has at least one branch — created automatically during tenant onboarding (§48) — so single-location tenants are simply tenants with exactly one branch and never need to think about the concept.

## 6A.2 Branch Model

```javascript
Branch {
  _id,
  tenantId,

  name,
  slug,
  isDefault,

  address: {
    line1,
    line2,
    city,
    state,
    country,
    postalCode
  },

  contact: {
    phone,
    email
  },

  timezone,

  settings: {
    tax: { enabled, percentage },
    serviceCharge: { enabled, percentage }
  },

  status: "ACTIVE" | "INACTIVE",

  createdAt,
  updatedAt
}
```

`settings` overrides the tenant-level defaults in `TenantSettings` (§30) for that branch only; a branch with no override inherits the tenant default.

## 6A.3 Branch-Level Payment Configuration

Payment settings are **branch-aware by design**: different branches of the same tenant can run on entirely different providers, credentials, or currencies — e.g. Branch A on Razorpay with one merchant account, Branch B on a different Razorpay account, or even a different provider entirely. `TenantPaymentSettings` carries an optional `branchId`:

```javascript
TenantPaymentSettings {
  _id,
  tenantId,
  branchId,   // optional — omitted means "tenant-wide default"
  provider,
  credentials: { ... },
  ...
}
```

Resolution order when creating a payment for an order:

```text
Order (tenantId, branchId)
       |
       v
Look up TenantPaymentSettings where tenantId matches AND branchId matches
       |
   found? ──yes──> use branch-specific settings
       |
       no
       |
       v
Look up TenantPaymentSettings where tenantId matches AND branchId is unset
       |
       v
Use tenant-wide default settings
```

This keeps the common case (one merchant account for the whole business) simple while allowing a franchise-style tenant to run separate payment accounts per location. Same encryption, same "never expose to frontend" rules as §15 apply per branch-specific settings exactly as they do for tenant-wide ones.

## 6A.4 Per-Branch Menu Availability

The menu itself (`Category`, `MenuItem`) stays tenant-wide — one master menu, edited once in Admin → Menu (§29A). A branch can locally mark an item unavailable (e.g., out of stock at that location only) without touching the shared menu:

```javascript
BranchMenuOverride {
  _id,
  tenantId,
  branchId,
  menuItemId,
  isAvailable
}
```

When resolving the menu for a customer at a given branch, the backend applies any `BranchMenuOverride` on top of the tenant's master `MenuItem.isAvailable`. No override row for an item means "use the tenant-wide value."

## 6A.5 Branch Isolation

Branch isolation is enforced with the same discipline as tenant isolation (§5) — it is a second, narrower scope nested inside the first, never a replacement for it.

```text
Authenticated Request
        |
        v
Authentication Middleware
        |
        v
User → user.tenantId, user.branchId (if branch-scoped role)
        |
        v
Tenant Context + Branch Context
        |
        v
Database Query: { tenantId, branchId }
```

- **Never trust a `branchId` supplied by a normal client** — the same rule as §5.1 for `tenantId`.
- **Waiter and Kitchen** tokens carry a fixed `branchId`; every query they make is scoped to `{ tenantId, branchId }` and neither role can act on another branch, even within the same tenant.
- **Tenant Admin** is not branch-locked — their queries are scoped to `{ tenantId }` and, when a branch filter is explicitly selected in the UI, additionally to `{ branchId }`. Selecting a branch is a UI convenience, never a security boundary the way a Waiter/Kitchen token's `branchId` is.
- **Customer** branch context is derived the same way tenant context is: from the validated QR/table token, since a table belongs to exactly one branch (§21).

## 6A.6 Branch Management — Admin

```text
Branches

[ + Add Branch ]

Name            City          Status     Tables   Actions
-------------------------------------------------------------
Koramangala     Bengaluru     Active     12       [Edit] [Deactivate]
Indiranagar     Bengaluru     Active     8        [Edit] [Deactivate]
```

A branch switcher near the sidebar logo lets a Tenant Admin filter the whole console (Dashboard, Orders, Tables, Staff, Kitchen monitor, Reports) down to one branch, or view "All Branches" aggregated:

```text
[ Green Leaf Café ▾ ]
    All Branches
    Koramangala
    Indiranagar
```

API:

```text
GET    /admin/branches
POST   /admin/branches
GET    /admin/branches/:id
PUT    /admin/branches/:id
POST   /admin/branches/:id/deactivate

GET    /admin/menu-items/:id/branch-overrides
PUT    /admin/menu-items/:id/branch-overrides/:branchId
```

Every other admin endpoint introduced elsewhere in this document (menu, tables, staff, payment settings, reports) accepts an optional `branchId` query/body parameter for Tenant Admin requests; Waiter and Kitchen requests never need to pass one since it comes from their token.

Deleting/deactivating a branch does not delete its historical orders or payments — same archival principle as tenant deletion (§50).

---

# 7. Platform Admin

Platform Admin is outside the tenant-specific role hierarchy.

## Permissions

Platform Admin can:

- Create tenants.
- Activate tenants.
- Suspend tenants.
- Cancel tenants.
- View tenant list.
- View tenant status.
- Manage SaaS plans.
- Configure per-tenant limits and feature overrides (branch count, tables, staff, advanced features — §7A), independent of or overriding what the tenant's plan would otherwise allow.
- View platform-level metrics.
- Manage platform settings.
- Support tenant administrators.
- View aggregated operational information.

Platform Admin should **not normally view tenant payment secrets**.

Payment credentials should remain encrypted and inaccessible through normal UI.

---

# 7A. Tenant Limits & Feature Overrides — Platform Admin

Every plan (§47) ships with default limits. Platform Admin can additionally set **per-tenant overrides** — to grant an exception (a Free-plan tenant piloting 3 branches) or to restrict a tenant below its plan's normal allowance (a support/compliance action) — without changing the tenant's plan itself.

## 7A.1 Model

```javascript
TenantFeatureLimits {
  tenantId,

  overrides: {
    maxBranches,
    maxTables,
    maxStaffUsers,
    maxOrdersPerMonth,
    advancedReports,
    customBranding,
    allowedPaymentProviders
  },

  updatedByPlatformAdminId,
  updatedAt
}
```

Any field left unset in `overrides` falls through to the plan default — Platform Admin only needs to set the fields they're deliberately overriding, not the whole set.

## 7A.2 Resolution Order

Every limit-checked action (creating a branch, adding a table, inviting staff, etc.) resolves the **effective limit** in this order:

```text
Tenant-specific override (TenantFeatureLimits.overrides)
       |
   set? ──yes──> use it
       |
       no
       |
       v
Plan default (PLAN_LIMITS[tenant.subscription.planId])
       |
       v
Platform-wide hard default (last-resort safety ceiling)
```

This is the same fallback pattern already used for branch-level payment settings (§6A.3) — a specific override wins, otherwise fall back to the broader default.

## 7A.3 UI

Platform Admin → Tenants → (a tenant) → Limits & Features:

```text
Limits & Features — Green Leaf Café

Plan: PRO (5 branches, standard limits)

                        Plan Default      Override
Max Branches            5                [ 8            ]
Max Tables               —               [              ]
Max Staff Users          —               [              ]
Advanced Reports        No               [ Enabled ▼    ]
Custom Branding         Yes              [              ]

[Save Overrides]
```

Blank override fields mean "use the plan default," shown for reference alongside each row.

## 7A.4 API

```text
GET /platform/tenants/:id/limits
PUT /platform/tenants/:id/limits
```

Changing a tenant's effective limits is audited as `TENANT_LIMITS_UPDATED` (§53), recording which fields changed and by which Platform Admin.

---

# 8. Tenant Admin

Tenant Admin has complete control over their own café.

## Permissions

Tenant Admin can:

- Update café profile.
- Configure branding, including uploading/replacing the café logo.
- Manage menu.
- Manage categories.
- Manage tables.
- Generate QR codes.
- Manage waiters.
- Manage kitchen users.
- Configure payment gateway.
- View orders.
- Create walk-in/counter orders via POS (§23A).
- Cancel orders according to policy.
- Process refunds according to permissions.
- View reports.
- Configure tax.
- Configure service charges.
- Configure café settings.

Tenant Admin cannot access another tenant.

---

# 8A. Staff Management (Waiters & Kitchen) — Admin

Tenant Admin maintains the list of Waiter and Kitchen accounts for their café.

## 8A.1 UI

```text
Staff

[ + Add Staff ]                    Filter: [ All ▼ ]  ( All | Waiter | Kitchen )

Name           Role       Email                 Status     Actions
--------------------------------------------------------------------------
Ravi Kumar     Waiter     ravi@cafe.com         Active     [Edit] [Deactivate]
Anita Rao      Kitchen    anita@cafe.com        Active     [Edit] [Deactivate]
Suresh Iyer    Waiter     suresh@cafe.com       Inactive   [Edit] [Activate]
```

Add/Edit Staff:

```text
Add Staff

Name      [ ... ]
Email     [ ... ]
Phone     [ ... ]
Role      [ Waiter ▼ ]   (Waiter | Kitchen)

[Send Invite]
```

## 8A.2 Flow

```text
Tenant Admin creates staff record
       |
       v
System sends invite email (set-password link)
       |
       v
Staff sets password + logs in
       |
       v
Account active, tenant-scoped
```

Deactivating a staff member sets `active: false` — it does not delete the record, since past orders/audit entries reference that user. A deactivated user cannot log in but their history is preserved.

## 8A.3 API

```text
GET    /admin/users?role=WAITER|KITCHEN
POST   /admin/users
GET    /admin/users/:id
PUT    /admin/users/:id
POST   /admin/users/:id/deactivate
POST   /admin/users/:id/activate
POST   /admin/users/:id/reset-password
```

The `role` accepted by `POST /admin/users` is restricted server-side to `WAITER` or `KITCHEN` — a Tenant Admin cannot use this endpoint to create another `TENANT_ADMIN` or a `PLATFORM_ADMIN`.

---

# 9. Waiter

Waiter belongs to exactly one branch of one tenant (§6A.5).

Waiter can:

- View tenant tables.
- View active orders.
- View order details.
- Receive ready notifications (real-time via Socket.IO when the app is open, push via FCM when it isn't — §40A).
- Mark orders served.
- Create walk-in/counter orders via POS (§23A) — the one exception to "waiter does not create customer orders" (Principle 5), since a POS order has no customer QR session to begin with.

Waiter cannot:

- Create or modify an order for a customer who already has their own QR/table session (only POS walk-in orders, §23A, are staff-created).
- Modify prices.
- Configure payment.
- Manage users.
- Manage menu.
- View another tenant's data.

---

# 10. Kitchen

Kitchen users belong to exactly one branch of one tenant (§6A.5).

Kitchen can:

- View new orders (real-time via Socket.IO when the app is open, push via FCM when it isn't — §40A).
- Accept orders.
- Start preparation.
- Mark orders ready.
- View table number.
- View item notes.

Kitchen cannot:

- View payment credentials.
- Manage users.
- Manage menu.
- View financial reports.
- Access another tenant.

---

# 11. Customer

Customers do not require a permanent account — not for the MVP, and not as a design intent to revisit later (Principle 5A). There is no login screen, no password, no "create account" prompt anywhere in the customer flow.

Customer session is created from the table QR, kiosk-style: scan → browse → order → pay, with nothing to authenticate.

Customer can:

- View menu.
- Search products.
- Filter categories.
- Add products.
- Change quantity.
- Add notes.
- Checkout.
- Pay.
- View current order.
- Track order status.

---

# 12. Tenant-Specific Payment Configuration

Payment configuration is **tenant-specific**, and for a multi-branch tenant, optionally **branch-specific** on top of that (§6A.3) — a tenant configures one payment gateway by default, and any branch may independently override it.

Each tenant can configure its own payment gateway.

> **Payment configuration is performed exclusively by that tenant's own Tenant Admin.** Platform Admin does not configure, and cannot configure, payment settings on behalf of a tenant — that responsibility belongs solely to the respective tenant's admin. Platform Admin's role with respect to payments is limited to restricted, separately-authorized support/recovery scenarios (see [Payment Configuration Permissions](#17-payment-configuration-permissions)), never routine configuration.

Example:

```text
Tenant A
  └── Razorpay Account A

Tenant B
  └── Razorpay Account B

Tenant C
  └── Stripe Account C
```

The customer ordering experience remains the same regardless of the tenant's payment provider.

---

# 13. Payment Provider Abstraction

The backend should use a provider abstraction.

```text
PaymentService
      |
      +-- RazorpayProvider
      |
      +-- StripeProvider
      |
      +-- FutureProvider
```

Example interface:

```typescript
interface PaymentProvider {
  createOrder(input): Promise<PaymentOrder>;
  verifyPayment(input): Promise<PaymentVerification>;
  processWebhook(input): Promise<WebhookResult>;
  refund(input): Promise<RefundResult>;
}
```

The business logic should depend on `PaymentProvider`, not directly on Razorpay.

---

# 14. Tenant Payment Settings Model

Payment settings should be stored separately from the main Tenant document.

```javascript
TenantPaymentSettings {
  _id,

  tenantId,
  branchId,   // optional — omitted means "tenant-wide default" (§6A.3)

  provider: "RAZORPAY",

  credentials: {
    keyId,
    keySecretEncrypted,
    webhookSecretEncrypted
  },

  currency: "INR",

  enabled: true,

  testMode: false,

  createdAt,
  updatedAt
}
```

## Future providers

The model should support:

```text
RAZORPAY
STRIPE
PAYPAL
OTHER
```

The MVP may enable only Razorpay.

---

# 15. Payment Credential Security

Sensitive payment credentials must never be stored as plain text.

Encrypt:

```text
keySecret
webhookSecret
```

Recommended architecture:

```text
Tenant Admin
     |
     v
Encrypted credentials
     |
     v
Application encryption layer
     |
     v
MongoDB
```

Encryption keys must be stored separately from MongoDB.

Recommended options:

- Cloud secret manager.
- AWS Secrets Manager.
- GCP Secret Manager.
- Azure Key Vault.
- Render/Vercel encrypted environment variables for initial deployment.

Never expose payment secrets to:

- React frontend.
- Browser.
- Customer.
- Waiter.
- Kitchen.

---

# 16. Tenant Payment Settings UI

Payment settings default to one tenant-wide configuration, but any branch can independently override it (§6A.3) — different branches can use entirely different providers, credentials, or currencies when the tenant actually needs that. For a multi-branch tenant, the Payment Settings screen shows which branch it's configuring:

```text
Payment Settings

Configuring for: [ Koramangala ▾ ]      [ Use tenant-wide default instead ]

Provider
[ Razorpay ▼ ]

Razorpay Key ID
[ rzp_live_xxxxxxxxx ]

Razorpay Key Secret
[ *************** ]

Webhook Secret
[ *************** ]

Currency
[ INR ▼ ]

Payment Gateway
[ Enabled ]

[Test Connection]

[Save Settings]

[ Copy settings from another branch ▾ ]
```

- The **branch selector** at the top switches which branch's settings the form is editing/showing — this is the same pattern as the branch switcher elsewhere in Admin (§6A.6).
- **"Use tenant-wide default instead"** clears this branch's override and falls back to `TenantPaymentSettings` with no `branchId` (§6A.3) — for the common case of one merchant account shared across all locations, an admin never needs to touch this screen more than once.
- **"Copy settings from another branch"** pre-fills the form from an existing branch's configuration as a starting point (still requires re-entering/replacing the secret — copied credentials are never silently reused across branches without an explicit save).
- A single-branch tenant sees no branch selector at all — the screen behaves exactly as a simple, tenant-wide settings form, since there's nothing to switch between.

The UI should never display the complete stored secret after saving.

Use:

```text
••••••••••••••••
```

and provide a controlled "Replace Secret" action.

---

# 17. Payment Configuration Permissions

| Action | Platform Admin | Tenant Admin | Waiter | Kitchen | Customer |
|---|:---:|:---:|:---:|:---:|:---:|
| View payment settings | Restricted | Yes | No | No | No |
| Configure provider | Restricted | Yes | No | No | No |
| Update credentials | Restricted | Yes | No | No | No |
| Test connection | Restricted | Yes | No | No | No |
| View transactions | Yes/Support | Yes | No | No | No |
| Refund | Restricted | Yes | No | No | No |
| Make payment | No | No | No | No | Yes |

"Restricted" for Platform Admin above means **no routine configuration access at all** — Platform Admin cannot set up, edit, or view a tenant's live payment credentials in the normal course of operations. Any exception (e.g. an emergency recovery flow) must be a separately authorized, explicitly logged action, never a standing permission. Configuring the payment gateway is, and remains, the responsibility of that tenant's own Tenant Admin.

---

# 18. Tenant Payment Flow

```text
Customer
   |
   | Scan QR
   v
Table QR Token
   |
   v
Resolve Tenant
   |
   v
Create Customer Session
   |
   v
Create Internal Order
   |
   v
Load TenantPaymentSettings
   |
   v
Resolve PaymentProvider
   |
   v
Create Gateway Order
   |
   v
Customer Pays
   |
   v
Gateway Callback
   |
   v
Backend Verification
   |
   v
Payment = PAID
   |
   v
Order = NEW
   |
   v
Kitchen
```

---

# 19. Payment Security Rules

The backend must:

1. Resolve tenant from trusted context.
2. Load that tenant's payment settings.
3. Validate provider is enabled.
4. Calculate the order total.
5. Create payment order using tenant credentials.
6. Store payment-provider order ID.
7. Verify payment response.
8. Verify webhook.
9. Validate amount.
10. Validate currency.
11. Validate tenant/order association.
12. Make payment processing idempotent.
13. Update order only after successful verification.

Never trust:

```text
amount from browser
tenantId from browser
price from browser
payment success from browser
```

---

# 20. Payment Database Model

```javascript
Payment {
  _id,

  tenantId,
  branchId,
  orderId,

  provider: "RAZORPAY",

  providerOrderId,
  providerPaymentId,

  amount,
  currency,

  status:
    "CREATED"
    | "PENDING"
    | "PAID"
    | "FAILED"
    | "REFUND_PENDING"
    | "REFUNDED",

  method,   // gateway-reported method (UPI/Card/Wallet/...), or "CASH" for a POS cash order (§23A.3)

  metadata,

  createdAt,
  updatedAt
}
```

Recommended indexes:

```text
{ tenantId: 1, createdAt: -1 }
{ tenantId: 1, orderId: 1 }
{ providerOrderId: 1 }
{ providerPaymentId: 1 }
```

Provider IDs should have unique constraints where appropriate.

---

# 21. Customer QR Architecture

Each table has a tenant-specific QR token.

```javascript
Table {
  _id,
  tenantId,
  branchId,
  tableNumber,
  qrToken,
  active,
  status,
  currentOrderId,
  createdAt,
  updatedAt
}
```

QR URL:

```text
https://app.example.com/t/{qrToken}
```

Do not expose MongoDB IDs in the QR code.

---

# 22. QR Validation

```text
QR Request
    |
    v
Validate Token
    |
    v
Find Active Table
    |
    v
Get tenantId
    |
    v
Validate Tenant ACTIVE
    |
    v
Create Customer Session
    |
    v
Open Menu
```

If tenant is suspended:

```text
Café temporarily unavailable.
```

---

# 22A. Table Management — Admin

Tenant Admin creates and manages tables and their QR codes.

## 22A.1 UI

```text
Tables

[ + Add Table ]                              [ Download All QR Codes (PDF) ]

Table     Status         Current Order    QR Code
----------------------------------------------------------------
Table 1   Available       —               [View QR] [Regenerate] [Edit] [Delete]
Table 2   Occupied        #1042           [View QR] [Regenerate] [Edit] [Delete]
Table 3   Available       —               [View QR] [Regenerate] [Edit] [Delete]
```

QR detail view: printable QR code, table number, and tenant logo/branding (§31A), sized for table-tent/sticker printing.

## 22A.2 QR Regeneration

Regenerating a table's QR invalidates the old `qrToken` immediately — any previously printed/scanned QR for that table stops resolving. This is the recovery path if a QR is lost, damaged, or suspected compromised.

```text
Regenerate QR
       |
       v
Issue new qrToken
       |
       v
Old qrToken rejected by /public/tables/:qrToken
       |
       v
Audit: TABLE_QR_REGENERATED
```

## 22A.3 API

```text
GET    /admin/tables
POST   /admin/tables
GET    /admin/tables/:id
PUT    /admin/tables/:id
DELETE /admin/tables/:id
POST   /admin/tables/:id/qr/regenerate
GET    /admin/tables/:id/qr             (printable image/PDF)
GET    /admin/tables/qr/export          (bulk PDF, all tables)
```

A table with an active order (`currentOrderId` set) should not be deletable — it must be blocked or require the order to be resolved first, to avoid orphaning an in-progress order.

---

# 22B. Menu Browsing & Category Filtering

After the QR/table token resolves the tenant and branch (§22), the customer's client fetches the full menu once:

```text
GET /public/categories
GET /public/menu
```

Category chips (§41B.4) and the search box both filter this already-loaded menu **client-side** — selecting "Coffee" or typing into search does not trigger a new request. This keeps browsing instant (no network round trip per tap) and is why the payload from `GET /public/menu` includes each item's `categoryId` (§29): the client groups/filters by it locally.

```text
Tap "Coffee" chip
       |
       v
Filter in-memory menu: item.categoryId === coffeeCategory.id
       |
       v
Re-render item grid (no request)
```

- **"All"** is the default/cleared filter state.
- Search and category filter compose — typing "latte" while "Coffee" is selected narrows within that category.
- The item grid reflects `isAvailable` (including any `BranchMenuOverride`, §6A.4) that was already applied **server-side** when the menu was fetched — the client filters what it was given, it never re-derives availability itself.
- A "Recommended for you" or similar curated strip (§41B.4) is independent of the category filter — it doesn't get hidden when a category is selected.

---

# 23. Customer Ordering

Customer sends only:

```json
{
  "customerName": "Priya",
  "customerPhone": "+91 98765 43210",
  "items": [
    {
      "menuItemId": "...",
      "quantity": 2,
      "note": "Less sugar"
    }
  ]
}
```

`customerName` is **required** — the backend rejects order creation with a validation error if it's missing or blank; there is no tenant setting that can turn this off. `customerPhone` is **always optional**, regardless of tenant settings — a tenant may choose to hide the phone field entirely (§30) but can never make it mandatory. Both are plain fields on the order, not an account: this doesn't create a customer login (Principle 5A) or a `CustomerSession` beyond the one already established from the QR/table token.

Backend resolves:

```text
tenantId
menu item
price
tax
availability
```

Backend calculates:

```text
subtotal
tax
service charge
total
```

---

# 23A. POS / Counter Ordering

Alongside self-service QR ordering (§21–§23), Yummverse supports a **POS (point-of-sale) device** at the counter for walk-in customers who never scan a QR — placing a phone order, paying cash, or simply preferring a human. This is a second **order channel**, not a replacement for QR self-service, and not the waiter placing an order "for" a seated customer (Principle 5).

```text
                    Order Channels
                          |
            +-------------+-------------+
            |                           |
      QR Self-Service              Counter / POS
      (customer's own device)      (staff-operated device)
            |                           |
            v                           v
       Table-scoped                Table-scoped OR takeaway
       tenantId, branchId,         tenantId, branchId,
       tableId from QR token       tableId optional, staff-entered
            |                           |
            +-------------+-------------+
                          |
                          v
                  Same Order pipeline
              (kitchen queue, reports, etc.
               never branch on channel)
```

## 23A.1 Order Model Changes

```javascript
Order {
  ...
  channel: "QR" | "POS",
  tableId,   // required for QR; optional for POS (null = takeaway)
  ...
}
```

Kitchen, Waiter, and reporting never need to special-case `channel` — a POS order is just an `Order` with `channel: "POS"` and possibly no `tableId`. The kitchen queue (§40, KDS mockups) shows POS/takeaway orders the same way, typically labeled "Takeaway" instead of a table number.

## 23A.2 Who Operates the POS

The POS interface is available to **Waiter** and **Tenant Admin**, scoped to their branch (§6A.5) exactly like every other branch-scoped action — no new role is introduced. A POS device is registered to one branch; whoever is signed in on it (a waiter or the admin) creates orders under their own `userId` for accountability, same as any other staff action.

## 23A.3 Payment on POS

Three ways to settle a POS order, chosen per-order by staff:

```text
Cash            Staff marks the order paid; no gateway call. Amount and change
                 are handled physically; the system just records status = PAID,
                 method = "CASH".

Card (present)   Routed through the same PaymentProvider abstraction (§13) via a
                 card-present/POS integration (e.g. Razorpay POS, Pine Labs) —
                 same encrypted branch payment settings (§6A.3), same
                 backend-verified PAID transition (§19) as an online payment.
                 Never trust a "paid" signal from the terminal alone without the
                 provider's server-side confirmation.

Payment link/QR  Staff generates a one-off payment link or QR for this specific
                 order; the customer pays from their own phone (same checkout
                 flow as QR self-service, §44) — useful for phone/counter orders
                 where the customer still wants to pay via UPI without a physical
                 card reader.
```

`Payment.method` (§20) gains `"CASH"` alongside the existing gateway-reported methods. Cash orders skip `PaymentProvider` entirely; card-present and payment-link orders go through it exactly like a QR order's payment does.

## 23A.4 POS UI

```text
POS — New Order                              Branch: Koramangala

[ Search / browse menu — same catalog as customer view ]

Cart                                    Table: [ Table 6 ▼ ]  or  [ Takeaway ]
  Cappuccino ×2              ₹300
  Croissant ×1                ₹90
  ------------------------------
  Total                      ₹428

Payment method:  [ Cash ]  [ Card (POS terminal) ]  [ Send Payment Link ]

[ Complete Order ]
```

Staff browse the same tenant-wide menu (with the same branch availability overrides, §6A.4) used by the customer flow — there is no separate POS-only menu to maintain.

## 23A.5 Hardware Integration

```text
Receipt printer   Browser print API for a basic setup, or a lightweight companion
                   agent on the POS device for ESC/POS thermal printers where
                   browser printing isn't sufficient.
Cash drawer        Triggered by the same companion agent (browsers cannot drive a
                   USB/serial cash drawer directly) — kicked on a "Cash" order
                   completion.
Card reader         Vendor SDK/integration behind the PaymentProvider abstraction
                   (§13), so swapping POS hardware vendors doesn't touch order or
                   kitchen logic.
```

Hardware integration is intentionally kept behind these abstractions — the order pipeline, kitchen display, and reports have zero awareness of which printer or card reader model a branch uses.

## 23A.6 API

```text
POST /pos/orders            { items, tableId?, channel: "POS" }
POST /pos/orders/:id/pay    { method: "CASH" | "POS_CARD" | "PAYMENT_LINK" }
GET  /pos/menu               (same payload as /public/menu, auth'd + branch-scoped)
```

`POST /pos/orders` resolves `tenantId`/`branchId` from the authenticated staff user's token (§33) exactly like every other admin/waiter endpoint — never from the client body.

---

# 24. Order Model

```javascript
Order {
  _id,

  tenantId,
  branchId,

  channel: "QR" | "POS",   // §23A
  tableId,                  // required for QR; optional for POS (null = takeaway)

  orderNumber,

  customer: {
    sessionId,   // QR orders only
    name,        // required (§23)
    phone        // optional, always
  },

  createdByUserId,   // POS orders only — the staff user who keyed it in (§23A.2)

  items: [
    {
      menuItemId,
      name,
      quantity,
      unitPrice,
      taxPercentage,
      total,
      note
    }
  ],

  subtotal,
  taxAmount,
  serviceCharge,
  totalAmount,

  paymentStatus,
  paymentMethod,

  orderStatus,

  paymentId,

  acceptedAt,
  preparingAt,
  readyAt,
  servedAt,
  completedAt,
  cancelledAt,

  createdAt,
  updatedAt
}
```

Menu name and price must be copied into the order item as a historical snapshot.

---

# 25. Order Lifecycle

```text
PENDING_PAYMENT
       |
       v
PAID / NEW
       |
       v
ACCEPTED
       |
       v
PREPARING
       |
       v
READY
       |
       v
SERVED
       |
       v
COMPLETED
```

Failure paths:

```text
PENDING_PAYMENT
       |
       v
PAYMENT_FAILED
```

Cancellation:

```text
NEW / ACCEPTED / PREPARING
       |
       v
CANCELLED
       |
       v
REFUND_PENDING
       |
       v
REFUNDED
```

Refund availability should depend on business rules and payment provider capabilities.

---

# 26. Multi-Tenant Database Collections

Recommended collections:

```text
tenants
branches
users
tenantPaymentSettings
categories
menuItems
branchMenuOverrides
tables
orders
payments
customerSessions
deviceTokens
auditLogs
subscriptions
platformSettings
```

All tenant-owned collections must contain:

```text
tenantId
```

except platform-global collections such as:

```text
platformSettings
```

Branch-owned collections (`tables`, `orders`, `payments`, `customerSessions`, `deviceTokens`, `branchMenuOverrides`, and `users` with role `WAITER`/`KITCHEN`) additionally contain `branchId` (§6A.5).

---

# 27. User Model

```javascript
User {
  _id,

  tenantId,
  branchId,   // required for WAITER/KITCHEN; null for TENANT_ADMIN (spans all branches)

  name,
  email,
  phone,

  passwordHash,

  role:
    "TENANT_ADMIN"
    | "WAITER"
    | "KITCHEN",

  active,

  lastLoginAt,

  createdAt,
  updatedAt
}
```

Platform Admin can use a separate role or separate platform-admin collection.

---

# 28. Category Model

```javascript
Category {
  _id,
  tenantId,

  name,
  description,
  imageUrl,

  displayOrder,
  active,

  createdAt,
  updatedAt
}
```

---

# 29. Menu Item Model

```javascript
MenuItem {
  _id,
  tenantId,
  categoryId,

  name,
  description,
  imageUrl,

  price,
  taxPercentage,

  isAvailable,
  active,

  displayOrder,

  createdAt,
  updatedAt
}
```

---

# 29A. Menu Management — Admin

Tenant Admin manages categories and items from a single Menu Management screen.

## 29A.1 UI

```text
Menu Management

[ Categories ]   [ Items ]

--- Categories tab ---
[ + Add Category ]

≡  Coffee            12 items   Active     [Edit] [Delete]
≡  Breakfast          8 items   Active     [Edit] [Delete]
≡  Desserts           5 items   Inactive   [Edit] [Delete]

(≡ = drag handle, reordering updates displayOrder)

--- Items tab ---
[ + Add Item ]     Category: [ All ▼ ]     Search: [ ... ]

Image    Name          Category    Price   Available   Actions
------------------------------------------------------------------
[img]    Cappuccino    Coffee      ₹150    [x]         [Edit] [Delete]
[img]    Croissant     Breakfast   ₹90     [ ]         [Edit] [Delete]
```

Add/Edit Item form:

```text
Name              [ ... ]
Description       [ ... ]
Category          [ Coffee ▼ ]
Price             [ ... ]
Tax %             [ ... ]
Image             [ Upload ]
Available         [x]

[Save]
```

The **Available** toggle in the list view is a one-click action (not a full edit), so staff can "86" an item instantly during service without opening the edit form.

## 29A.2 API

```text
GET    /admin/categories
POST   /admin/categories
PUT    /admin/categories/:id
DELETE /admin/categories/:id
PUT    /admin/categories/reorder          { orderedIds: [...] }

GET    /admin/menu-items
POST   /admin/menu-items
PUT    /admin/menu-items/:id
DELETE /admin/menu-items/:id
PATCH  /admin/menu-items/:id/availability { isAvailable }
PUT    /admin/menu-items/reorder          { orderedIds: [...] }
```

Image uploads follow the same pattern as branding (§31A): uploaded to `tenants/{tenantId}/menu/{imageId}` and served through a CDN URL.

Deleting a category with active items should either be blocked or cascade-deactivate its items — the implementation must choose one explicit, non-silent behavior rather than leaving orphaned `categoryId` references.

---

# 30. Tenant Settings

```javascript
TenantSettings {
  _id,
  tenantId,

  currency,
  timezone,

  tax: {
    enabled,
    percentage
  },

  serviceCharge: {
    enabled,
    percentage
  },

  ordering: {
    enabled,
    allowMultipleOrdersPerTable,
    collectCustomerPhone   // whether the (always-optional) phone field is shown at checkout; customer name is always required and always collected — not a tenant-configurable option (§23)
  },

  notifications: {
    soundEnabled,
    browserPushEnabled
  },

  createdAt,
  updatedAt
}
```

---

# 31. Tenant Branding

Each tenant should be able to configure:

- Café logo.
- Café name.
- Primary color.
- Secondary color.
- Favicon.
- Menu header.
- Customer-facing branding.

Customer menu should dynamically load tenant branding.

Example:

```text
QR → Tenant → Branding + Menu
```

---

# 31A. Tenant Logo Configuration

The café logo is configured by the Tenant Admin from the admin app and is consumed by both customer clients (web and mobile).

## 31A.1 Admin UI

Tenant Admin → Settings → Branding:

```text
Branding

Café Logo
[  logo preview 200x200  ]
[ Upload New Logo ]  [ Remove Logo ]
Recommended: square PNG/SVG, max 2MB

Primary Color
[ #4B2E2B ]

Secondary Color
[ #E8C39E ]

Favicon
[  favicon preview  ]
[ Upload Favicon ]

[Save Branding]
```

## 31A.2 Upload Flow

```text
Tenant Admin selects logo file
       |
       v
Validate file (type, size, dimensions)
       |
       v
Upload to Cloudinary/S3 under
tenants/{tenantId}/branding/{imageId}
       |
       v
Store logoUrl + logoAssetId on Tenant.branding
       |
       v
Delete previous logo asset (if replaced)
       |
       v
Broadcast branding update (cache invalidation)
```

Validation:

- Allowed types: PNG, JPG, SVG, WEBP.
- Max file size enforced server-side, not just client-side.
- Image is served through a CDN-backed URL, never as a raw upload path.

## 31A.3 Consumption

```text
Tenant → GET /public/tenant/branding → { logoUrl, primaryColor, secondaryColor, faviconUrl }
```

- **Web app**: fetched on QR landing and rendered in the header/splash.
- **Mobile app**: fetched on app launch (after tenant/table resolution) and cached locally via `cached_network_image` so the logo persists offline between visits.

Logo changes should invalidate the tenant branding cache key (see [Caching](#65-caching)) so both clients pick up the new logo without a forced update.

---

# 32. Tenant Routing

Possible public URL models:

## Option A — Tenant slug

```text
https://app.example.com/cafe/green-leaf
```

## Option B — QR token

```text
https://app.example.com/t/7Hk82L...
```

Recommended:

- Use QR token for table ordering.
- Use tenant slug for public tenant landing pages/admin context.

## Staff Sign-In URLs

Every tenant gets its own sign-in URL, keyed by slug — staff never see a generic login page and never have to identify their café themselves:

```text
https://app.example.com/{tenantSlug}/admin/login
https://app.example.com/{tenantSlug}/waiter/login
https://app.example.com/{tenantSlug}/kitchen/login
```

```text
Staff opens /{tenantSlug}/admin/login
       |
       v
Resolve tenant from slug (public lookup — name/logo/colors only, no auth data)
       |
       v
Render login page branded for that tenant (logo, name, colors — §31A)
       |
       v
Staff enters only email + password
       |
       v
Backend authenticates { tenantId (from resolved slug), email, password }
```

The tenant is resolved from the URL, never typed or selected by the user — no "which café do you work at?" field anywhere in the login form. This also fixes a real ambiguity in the data model: `User.email` is only unique **within** a tenant (§55's index is `{tenantId, email}`, not `email` alone), so the same email could exist at two different tenants — an email-only login lookup with no tenant context would be unable to tell them apart. Resolving the tenant from the slug first removes that ambiguity before a single credential is checked.

Platform Admin's `/platform/login` is the one login route that is intentionally **not** tenant-scoped — it's platform-branded (§7A/§75 Principle 9) and Platform Admin isn't a member of any tenant.

Sending an authenticated staff member's browser to the wrong tenant's slug must fail the same way any other cross-tenant access attempt does (§5) — the backend re-validates the resolved `tenantId` against the user's own `tenantId` on every request, the URL slug is never trusted as the source of truth for an already-authenticated session.

---

# 33. Authentication Context

Staff JWT should contain minimal identity data:

```json
{
  "sub": "USER_ID",
  "tenantId": "TENANT_ID",
  "role": "TENANT_ADMIN"
}
```

Waiter and Kitchen tokens additionally carry a fixed `branchId`, since those roles are branch-scoped (§6A.5):

```json
{
  "sub": "USER_ID",
  "tenantId": "TENANT_ID",
  "branchId": "BRANCH_ID",
  "role": "WAITER"
}
```

Tenant Admin tokens omit `branchId` — they are not branch-locked; any branch filtering happens per-request (§6A.6), not via the token.

Platform Admin:

```json
{
  "sub": "PLATFORM_ADMIN_ID",
  "role": "PLATFORM_ADMIN"
}
```

Do not place sensitive payment information in JWT.

---

# 34. Tenant Middleware

Recommended request pipeline:

```text
HTTP Request
     |
     v
Authentication
     |
     v
Resolve User
     |
     v
Resolve Tenant Context
     |
     v
Authorization
     |
     v
Controller
     |
     v
Service
     |
     v
Repository
     |
     v
MongoDB
```

Tenant context should be attached to the request:

```typescript
request.tenantId
request.user
request.role
```

---

# 35. Tenant-Aware Repository

Repositories should require tenant context.

Example:

```typescript
orderRepository.findById({
  tenantId,
  orderId
});
```

Avoid unrestricted methods such as:

```typescript
orderRepository.findById(orderId);
```

for tenant-owned resources.

This reduces the chance of accidental cross-tenant data access.

---

# 36. API Design

Base URL:

```text
/api/v1
```

## Platform APIs

```text
POST /platform/tenants
GET  /platform/tenants
GET  /platform/tenants/:id
PUT  /platform/tenants/:id
POST /platform/tenants/:id/suspend
POST /platform/tenants/:id/activate

GET  /platform/tenants/:id/limits
PUT  /platform/tenants/:id/limits
```

## Tenant APIs

```text
GET /tenant/profile
PUT /tenant/profile

GET /tenant/settings
PUT /tenant/settings

GET  /tenant/payment-settings?branchId=<id>        (omit branchId for the tenant-wide default)
PUT  /tenant/payment-settings?branchId=<id>
POST /tenant/payment-settings/test?branchId=<id>
DELETE /tenant/payment-settings?branchId=<id>       (clear this branch's override → falls back to tenant-wide default)
POST /tenant/payment-settings/copy                   { fromBranchId, toBranchId }  (pre-fills form fields only — the secret must still be re-entered and saved, never silently reused)

GET  /tenant/branding
PUT  /tenant/branding
POST /tenant/branding/logo
DELETE /tenant/branding/logo
```

## Tenant Admin — Menu (see §29A)

```text
GET/POST       /admin/categories
PUT/DELETE     /admin/categories/:id
PUT            /admin/categories/reorder

GET/POST       /admin/menu-items
PUT/DELETE     /admin/menu-items/:id
PATCH          /admin/menu-items/:id/availability
PUT            /admin/menu-items/reorder
```

## Tenant Admin — Tables (see §22A)

```text
GET/POST       /admin/tables
GET/PUT/DELETE /admin/tables/:id
POST           /admin/tables/:id/qr/regenerate
GET            /admin/tables/:id/qr
GET            /admin/tables/qr/export
```

## Tenant Admin — Staff (see §8A)

```text
GET            /admin/users?role=WAITER|KITCHEN
POST           /admin/users
GET/PUT        /admin/users/:id
POST           /admin/users/:id/deactivate
POST           /admin/users/:id/activate
POST           /admin/users/:id/reset-password
```

## Authentication

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

## Customer APIs

```text
GET  /public/tables/:qrToken
GET  /public/menu
GET  /public/categories
GET  /public/tenant/branding

POST /customer/session
POST /customer/orders
GET  /customer/orders/:id
GET  /customer/orders/:id/status
```

## Payment APIs

```text
POST /payments/create
POST /payments/verify
POST /payments/webhook
POST /payments/:id/refund
```

## Kitchen APIs

```text
GET  /kitchen/orders
POST /kitchen/orders/:id/accept
POST /kitchen/orders/:id/preparing
POST /kitchen/orders/:id/ready
```

Tenant Admin reads the same queue read-only (and may take the same actions, per Principle 8) via `GET /admin/kitchen/orders?branchId=<id>`, which returns orders for the selected branch, or every branch if `branchId` is omitted — the Kitchen role's `GET /kitchen/orders` stays implicitly scoped to its own token `branchId` and never accepts a `branchId` parameter.

## Waiter APIs

```text
GET  /waiter/tables
GET  /waiter/orders
GET  /waiter/orders/:id
POST /waiter/orders/:id/served
```

---

# 37. Payment Webhook Architecture

Webhook processing is tenant-sensitive.

Preferred approach:

```text
Payment Provider
       |
       v
Webhook Endpoint
       |
       v
Identify Provider Order ID
       |
       v
Find Payment
       |
       v
Resolve tenantId from Payment
       |
       v
Load Tenant Payment Settings
       |
       v
Verify webhook
       |
       v
Process event
```

Never identify the tenant from an arbitrary request body field.

The stored provider order/payment relationship should be the source of truth.

---

# 38. Webhook Idempotency

Payment providers may send duplicate events.

Use:

```text
providerEventId
```

or equivalent provider transaction identifiers.

Store processed webhook events:

```javascript
WebhookEvent {
  _id,
  tenantId,
  provider,
  providerEventId,
  eventType,
  processedAt
}
```

Create a unique index on:

```text
provider + providerEventId
```

---

# 39. Real-Time Communication

Use Socket.IO.

Tenant-specific rooms are mandatory.

Example:

```text
tenant:{tenantId}:branch:{branchId}:kitchen
tenant:{tenantId}:branch:{branchId}:waiters
tenant:{tenantId}:admin
customer:{sessionId}
```

Kitchen and Waiter rooms are branch-scoped, not just tenant-scoped: a Kitchen user at Branch A must never receive events from Branch B, even within the same tenant. The `tenant:{tenantId}:admin` room stays tenant-wide since Tenant Admin is not branch-locked (§6A.5) — the admin UI applies any branch filter client-side against that tenant-wide stream.

Example:

```text
Branch A Order Created
       |
       +--> tenant:X:branch:A:kitchen
       +--> tenant:X:admin
```

Not:

```text
all kitchens
```

---

# 40. Real-Time Events

```text
order.created
order.accepted
order.preparing
order.ready
order.served
order.completed

payment.created
payment.paid
payment.failed

table.statusChanged
menu.availabilityChanged
```

Each event should contain the relevant tenant and branch context internally.

---

# 40A. Push Notifications (Firebase Cloud Messaging)

Socket.IO (§39–40) covers real-time updates while a client has the app open and connected. **Push notifications cover the rest** — a customer who backgrounds the app while waiting, a waiter whose phone is in their pocket, a kitchen tablet with the screen locked. The backend sends both in parallel for the same event; it never relies on push as the sole delivery mechanism, since push delivery is best-effort and can be delayed or dropped by the OS/network.

## 40A.1 Notification Events

| Event | Recipient | Example copy |
|---|---|---|
| New order placed | Kitchen staff (that branch) | "New order #1042 — Table 12" |
| Order received (payment confirmed) | Customer | "Your order has been received!" |
| Kitchen accepted | Customer | "Green Leaf Café is preparing your order" |
| Order ready | Customer | "Your order is ready!" |
| Order ready | Waiter (that branch) | "Order #1042 ready — Table 12" |
| Payment failed | Customer | "Payment failed — please try again" |

Every row corresponds 1:1 to an event already defined in §40 (`order.created`, `order.accepted`, `order.ready`, `payment.failed`, ...) — push notifications are an additional delivery channel for the same domain events, not a separate event system.

## 40A.2 Device Token Model

```javascript
DeviceToken {
  _id,

  tenantId,
  branchId,        // required for WAITER/KITCHEN; derived from the table for a customer session; null for TENANT_ADMIN

  ownerType: "USER" | "CUSTOMER_SESSION",
  ownerId,          // userId or customerSessionId

  platform: "ANDROID" | "IOS" | "WEB",
  fcmToken,

  createdAt,
  updatedAt
}
```

`DeviceToken` is a branch-owned collection like the others in §26 — every lookup used to target a push is scoped by `{ tenantId, branchId }` for staff, exactly like every other query in this system (§6A.5). **Never** send to a raw list of tokens without that scoping — an unscoped "notify all kitchen tokens" query would cross tenant/branch boundaries and is exactly the kind of bug §5 and §6A.5 exist to prevent.

## 40A.3 Registration

```text
POST   /notifications/register-token   { platform, fcmToken }
DELETE /notifications/register-token   { fcmToken }
```

- **Mobile app (customer)**: registers a token on launch, associated with the current `CustomerSession` — the same session that already carries `tenantId`/`branchId` (§56).
- **Staff (Waiter/Kitchen)**: registers a token on login, associated with the authenticated `User` — `tenantId`/`branchId` come from the JWT (§33), never the client.
- A token is deregistered on logout and removed automatically if FCM reports it as invalid/unregistered on send (§40A.5).

## 40A.4 Send Flow

```text
Domain event occurs (e.g. order.ready)
       |
       v
NotificationService resolves recipients
  (tenantId + branchId scoped query on DeviceToken)
       |
       v
Build FCM payload (notification + data)
       |
       v
Firebase Admin SDK → FCM
       |
       +--> Delivered to backgrounded/closed app (system notification)
       |
       v
(in parallel) Socket.IO emits the same event
       |
       v
Delivered instantly to any foreground/connected client
```

```typescript
class NotificationService {
  notifyKitchenNewOrder(order: Order): Promise<void>;
  notifyCustomerOrderReceived(order: Order): Promise<void>;
  notifyCustomerOrderReady(order: Order): Promise<void>;
  notifyWaiterOrderReady(order: Order): Promise<void>;
  notifyCustomerPaymentFailed(order: Order): Promise<void>;
}
```

## 40A.5 Payload & Failure Handling

```json
{
  "notification": { "title": "Your order is ready!", "body": "Order #1042 — Table 12" },
  "data": { "type": "order.ready", "orderId": "...", "tenantId": "...", "branchId": "..." }
}
```

The `data` payload deep-links the tap into the right screen (order tracking for a customer, the kitchen queue for staff) — the app resolves this client-side, the server never assumes a specific screen/route.

On a `messaging/registration-token-not-registered` (or equivalent) error from FCM, delete that `DeviceToken` — stale tokens accumulate as users uninstall the app or clear notification permissions, and letting them pile up wastes sends and pollutes delivery metrics.

## 40A.6 Topics vs. Tokens

Use **direct token targeting**, not FCM topics, for anything tenant/branch-scoped. A topic like `kitchen-orders` shared across tenants would be a tenant-isolation bug by construction — anyone subscribed would receive every tenant's kitchen alerts. If topics are used at all (e.g., a platform-wide announcement channel for Platform Admin), the topic name must be namespaced per tenant+branch (`tenant-{tenantId}-branch-{branchId}-kitchen`) and still audited the same way as any other tenant-scoped resource.

---

# 41. Web Frontend Architecture

Recommended:

```text
React
Vite
TypeScript
Tailwind CSS
React Router
TanStack Query
Socket.IO Client
React Hook Form
Zod
```

Structure:

```text
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── config/
│
├── features/
│   ├── platform/
│   ├── tenant/
│   ├── auth/
│   ├── customer/
│   ├── admin/
│   ├── waiter/
│   ├── kitchen/
│   ├── menu/
│   ├── tables/
│   ├── orders/
│   └── payments/
│
├── components/
├── pages/
├── services/
├── hooks/
├── types/
└── utils/
```

---

# 41A. Mobile App Architecture (Flutter)

The customer ordering experience is also delivered as a native mobile app built with **Flutter**, targeting iOS and Android from a single codebase. It talks to the same `/api/v1` backend as the web app — no separate mobile API.

## 41A.1 Recommended Stack

```text
Flutter (stable channel)
Dart
Riverpod (state management)
Dio (HTTP client)
go_router (navigation)
socket_io_client (Dart) — real-time order status
flutter_secure_storage — session token storage
cached_network_image — menu/branding images
firebase_messaging — push notifications (§40A)
mobile_scanner — QR scanning (in-app, as an alternative entry to scanning with the phone camera)
```

## 41A.2 Project Structure

```text
mobile/
├── lib/
│   ├── app/
│   │   ├── router/
│   │   ├── providers/
│   │   └── config/
│   │
│   ├── features/
│   │   ├── tenant/
│   │   ├── menu/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── payment/
│   │   ├── orders/
│   │   └── branding/
│   │
│   ├── core/
│   │   ├── network/
│   │   ├── socket/
│   │   └── storage/
│   │
│   ├── widgets/
│   └── main.dart
│
├── test/
├── android/
└── ios/
```

## 41A.3 Scope

The mobile app implements the **customer ordering journey** end-to-end:

```text
Scan/Open QR link or QR-in-app scanner
       |
       v
Resolve Tenant + Table
       |
       v
Load Tenant Branding (logo, colors)
       |
       v
Browse Menu
       |
       v
Cart → Checkout
       |
       v
Payment (provider SDK or hosted checkout WebView)
       |
       v
Order Tracking (Socket.IO)
```

Staff-facing roles (Waiter, Kitchen, Tenant Admin) remain web-only for the MVP. The same Flutter shell can be reused later for a Kitchen/Waiter tablet app if needed, since it consumes the same role-based APIs and Socket.IO rooms described in [Real-Time Communication](#39-real-time-communication) — that is a post-MVP extension, not required for launch.

## 41A.4 Payment on Mobile

Two supported approaches, provider-dependent:

- **Hosted checkout WebView**: open the payment provider's hosted checkout page inside an in-app WebView, then verify server-side exactly like the web flow. Fastest to ship, works for any provider abstracted behind `PaymentProvider`.
- **Native provider SDK** (e.g. Razorpay's Flutter SDK): better UX, requires a native integration per provider.

Either way, the mobile app never sets `paymentStatus`. It calls `/payments/create`, drives the provider's checkout, and then relies on backend verification exactly like the web client (see [Frontend Payment Flow](#44-frontend-payment-flow)).

## 41A.5 Distribution

```text
Google Play Store (Android)
Apple App Store (iOS)
```

App identity (name, icon, splash) is generic platform branding, not per-tenant — a single app serves all tenants and resolves tenant/branding at runtime from the scanned QR/table token, the same way the web PWA does.

---

# 41B. UI/UX Design Guidelines

The product must feel **modern, trendy, and effortless to use** — for a customer ordering on their phone at a table, and for staff working quickly during a service rush. This applies equally to the web app, the Flutter mobile app, and the admin dashboard; all three should feel like one product family, themed per-tenant.

## 41B.1 Design Principles

1. **Minimal friction** — customer ordering is a zero-account, zero-download flow: scan → browse → order → pay in as few taps as possible.
2. **Clarity over density** — generous whitespace, one primary action per screen, no crowded forms.
3. **Familiar patterns** — bottom sheets, sticky cart bars, card grids, chip filters: patterns customers already know from modern food-delivery apps, not novel UI to learn.
4. **Fast-perceived performance** — skeleton loaders instead of spinners, optimistic UI for cart actions, instant local feedback before network confirmation.
5. **Consistent cross-platform, tenant-themed** — layout and interaction patterns match between web and mobile; color/logo are the only things that change per tenant.
6. **Accessible by default** — WCAG 2.1 AA contrast, minimum 44×44pt tap targets, legible type scale, screen-reader labels.

## 41B.2 Visual Design System

```text
Typography     Inter (web) / Inter or Manrope (Flutter) — variable weight
Base scale     4px spacing grid (4, 8, 12, 16, 24, 32, 48, 64)
Corner radius  12–16px cards, 24px+ sheets/buttons ("soft" rounded, not sharp)
Elevation      Soft, low-opacity shadows; avoid heavy skeuomorphism
Motion         150–250ms ease-out transitions; spring animation for cart/sheet
Theming        Light + dark mode, tenant primaryColor/secondaryColor as accent only
                (never overrides semantic colors like error/success)
```

Design tokens (color, spacing, radius, type scale) should be defined once and shared conceptually across:

```text
Web      → Tailwind config (theme tokens)
Mobile   → Flutter ThemeData / a tokens.dart file
Admin    → same Tailwind config as the web customer app
```

Tenant branding (§31A) plugs into these tokens at runtime as CSS variables (web) / a `ThemeData.copyWith` (Flutter) — the rest of the design system stays constant, only the accent color and logo shift per café.

## 41B.3 Recommended UI Toolkits

```text
Web (customer + admin)   Tailwind CSS + shadcn/ui (Radix primitives) + Lucide icons
Mobile (Flutter)         Material 3 (Material You) widgets, customized via ThemeData,
                          not default Material look
```

Using shadcn/ui and Material 3 as a base (rather than building components from scratch) gets modern, accessible, well-tested interaction patterns for free, while still allowing full visual customization via tokens.

## 41B.4 Key Screen Patterns

**Menu browsing**

```text
[ Tenant Logo ]  [ Search icon ]
Category chips:  [ All ] [ Coffee ] [ Breakfast ] [ Desserts ] →  (horizontal scroll)

Grid of item cards:
+-----------------+  +-----------------+
| image            |  | image            |
| Cappuccino       |  | Croissant        |
| ₹150      [ + ]  |  | ₹90       [ + ]  |
+-----------------+  +-----------------+
```

- Sticky category chips while scrolling.
- Tapping `+` adds to cart with a subtle bounce/toast — no page navigation.

**Cart**

```text
Sticky bottom bar (visible whenever cart is non-empty):

[ 3 items · ₹420 ]                [ View Cart → ]
```

- Cart opens as a bottom sheet (mobile) / slide-over panel (web), not a full page reload.

**Checkout**

```text
Order Summary
Cappuccino x2          ₹300
Croissant x1            ₹90
-----------------------------
Subtotal                ₹390
Tax                      ₹20
Service Charge            ₹10
-----------------------------
Total                   ₹420

Name *          [ ................... ]
Phone (optional) [ .................. ]

[  Pay ₹420  ]  ← single, unmissable primary CTA
```

**Order tracking**

```text
Order #1042                         ● Live

✓ Payment Confirmed
✓ Order Received
✓ Kitchen Accepted
●  Preparing            ← animated active step
○  Ready
○  Served
```

- Horizontal or vertical stepper with the current stage animated/pulsing.
- Real-time updates via Socket.IO (§39); no manual refresh needed.

**Admin dashboard**

```text
Sidebar: Dashboard · Orders · Menu · Tables · Payments · Reports · Settings

Dashboard cards: Today's Orders | Today's Revenue | Active Tables | Avg. Prep Time
Orders table: live-updating rows, status pill badges, quick actions
```

- Data-dense but not cluttered: use status pill/badge colors, sortable tables, and charts (e.g. Recharts) with the same design tokens as the customer app.

## 41B.5 States Every Screen Must Handle

```text
Loading    → skeleton placeholders, not blank screens or spinners-only
Empty      → friendly empty state with an action ("No items in this category yet")
Error      → human-readable message + retry action, never a raw stack trace
Offline    → mobile app shows a persistent banner; cached menu/branding still visible
```

## 41B.6 Accessibility & Responsiveness

- Web: mobile-first responsive layout (customers are on phones), tested down to 320px width.
- Mobile: support both light and dark system themes, dynamic text scaling, and VoiceOver/TalkBack labels on all interactive elements.
- Color is never the only signal for status (pair with icon/label, e.g. order status).

---

# 42. Backend Architecture

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── validators/
│   ├── sockets/
│   ├── payment/
│   │   ├── PaymentProvider.ts
│   │   ├── RazorpayProvider.ts
│   │   └── PaymentService.ts
│   ├── notifications/
│   │   └── NotificationService.ts
│   ├── tenant/
│   └── utils/
│
├── tests/
└── server.ts
```

---

# 43. Payment Service Design

Business service:

```typescript
class PaymentService {
  createPayment(orderId, tenantId)
  verifyPayment(paymentData)
  processWebhook(payload)
  refundPayment(paymentId)
}
```

Provider factory:

```typescript
PaymentProviderFactory.getProvider(
  tenantPaymentSettings.provider
);
```

Example:

```text
Tenant A
   |
   v
RazorpayProvider

Tenant B
   |
   v
StripeProvider
```

---

# 44. Frontend Payment Flow

Customer:

```text
Cart
 |
 v
Checkout
 |
 v
Create Internal Order
 |
 v
Create Payment
 |
 v
Open Gateway
 |
 v
Payment Result
 |
 v
Backend Verification
 |
 v
Order Confirmation
```

The frontend must never decide:

```text
paymentStatus = PAID
```

The backend is the source of truth.

---

# 45. Menu and Order Tenant Isolation

Example:

```text
Tenant A
  Menu A
  Tables A
  Orders A

Tenant B
  Menu B
  Tables B
  Orders B
```

A request from Tenant A:

```text
GET /admin/menu
```

must execute effectively as:

```javascript
MenuItem.find({
  tenantId: authenticatedUser.tenantId
});
```

Never:

```javascript
MenuItem.find({});
```

for tenant-facing APIs.

---

# 46. Tenant-Specific Reports

Tenant Admin sees only:

```text
Tenant A Revenue
Tenant A Orders
Tenant A Payments
Tenant A Item Performance
Tenant A Tax
```

Platform Admin may see:

```text
All Tenants
   |
   +-- Tenant A
   +-- Tenant B
   +-- Tenant C
```

Reports should always include tenant filtering.

## 46.1 Report Types

```text
Revenue Report         (by day/week/month)
Orders Report          (list + status breakdown)
Payments Report        (transactions, refunds)
Item Performance Report (best/slow sellers)
Tax Report
```

All report queries take a `dateRange` (and optional filters like `status`, `categoryId`) and are always scoped by `tenantId` under the hood — never client-supplied. For a multi-branch tenant, an optional `branchId` filter narrows a report to one location; omitting it aggregates across every branch the Tenant Admin has access to (§6A.6). Every metric below is computed from `orders` and `payments` — there is no separately-persisted "report" record; reports are query results, generated on demand (and cached briefly for expensive aggregates, e.g. a 5-minute cache on the dashboard's revenue trend).

### 46.1.1 Revenue Report

Metrics:

```text
Gross Revenue              sum of order totals in range
Net Revenue                Gross Revenue − Refunds
Average Order Value (AOV)  Net Revenue ÷ Order Count
Order Count
Revenue Trend              time series, by day/week/month
Revenue by Payment Method  UPI / Card / Wallet / Cash, etc.
Revenue by Branch          multi-branch tenants only (§6A)
```

```text
Revenue

Date Range: [ Last 30 days ▼ ]     Branch: [ All Branches ▼ ]

Gross Revenue      Net Revenue        Orders        AOV
₹4,21,800  ↑12%    ₹4,08,300  ↑9%     1,284  ↑6%    ₹328

[ ── Revenue trend chart (line, daily) ──────────────── ]

By Payment Method            By Branch
UPI          62%  ₹2,53,000  Koramangala   58%  ₹2,37,000
Card         28%  ₹1,14,300  Indiranagar   42%  ₹1,71,300
Wallet       10%  ₹  41,000
```

The ↑ deltas compare against the immediately preceding period of the same length (last 30 days vs. the 30 days before that), the same convention used on the Dashboard stat cards (§41B.4).

### 46.1.2 Tax Report

Metrics:

```text
Total Tax Collected
Tax by Rate            e.g. 5% / 12% / 18% slabs, since taxPercentage is stored per menu item (§29)
Taxable Order Amount   (subtotal the tax was calculated on)
Tax by Branch           multi-branch tenants only
```

```text
Tax Report

Date Range: [ This month ▼ ]     Branch: [ All Branches ▼ ]

Total Tax Collected: ₹21,090

Rate     Taxable Amount    Tax Collected    Orders
5%       ₹3,10,000         ₹15,500          890
12%      ₹  46,600         ₹ 5,590          210

[Export for filing →]
```

This report exists specifically to support statutory tax filing (e.g. GST in India, given the platform's default `currency: "INR"`, §6) — the rate-wise breakdown mirrors how such filings are typically structured, without the platform attempting to be a filing tool itself. The underlying `taxPercentage` snapshot on each order item (§24) is what makes this report accurate even after a menu item's tax rate changes later.

### 46.1.3 Item Performance Report

Metrics:

```text
Top Items by Quantity Sold
Top Items by Revenue
Category Contribution      % of total revenue per category
Slow-Moving Items          bottom N by quantity sold in range — candidates to review/remove
Trend vs. Previous Period  per item, e.g. "+18% this week"
```

```text
Item Performance

Date Range: [ Last 7 days ▼ ]     Sort: [ Best-selling ▼ ]

Item              Category    Qty Sold   Revenue    % of Revenue   Trend
Cappuccino        Coffee      412        ₹61,800    14.7%          ↑18%
Croissant         Breakfast   380        ₹34,200    8.1%           ↑4%
Iced Latte        Coffee      290        ₹52,200    12.4%          ↓3%
...

Slow-Moving (bottom 5)
Choco Muffin      Desserts    6          ₹720       0.2%           ↓40%
```

Item Performance is the report answering "what's most sold" directly — it's also the natural source for the Menu Management screen's item ordering and for flagging items worth discontinuing.

## 46.2 Export

Every report screen offers an **Export** action, in addition to the on-screen view.

Supported formats:

```text
CSV
Excel (.xlsx)
PDF
```

```text
Reports

Report: [ Revenue ▼ ]   Date Range: [ Last 30 days ▼ ]

[ View ]           Export: [ CSV ]  [ Excel ]  [ PDF ]

Recent Exports
  revenue_2026-07-28_2026-08-27.csv           Ready   [Download]
  item-performance_2026-08.pdf                Ready   [Download]
```

## 46.3 Export Flow

Small/date-bounded exports are generated synchronously; large exports are generated as a background job so the request never blocks or times out:

```text
Tenant Admin selects report + format
       |
       v
POST /tenant/reports/export
       |
       v
Estimate size
       |
   +---+---+
   |       |
 Small   Large
   |       |
   v       v
Generate   Enqueue background job
inline         |
   |           v
   |      Generate file (streamed)
   |           |
   |           v
   |      Store in temporary storage
   |           |
   |           v
   |      Notify (Socket.IO / email)
   |           |
   +-----+-----+
         |
         v
Signed, expiring download URL
```

- Export files are generated server-side from the same tenant-scoped queries as the on-screen report — never from client-held data.
- Download links are short-lived (e.g. 24h) and tenant-scoped; a Tenant A signed URL must never resolve to Tenant B data.
- Every export is recorded as an audit event (`REPORT_EXPORTED`) with report type, format, date range, and requesting user (see [Audit Logging](#53-audit-logging)).

## 46.4 Report & Export APIs

```text
GET  /tenant/reports/revenue
GET  /tenant/reports/orders
GET  /tenant/reports/payments
GET  /tenant/reports/item-performance
GET  /tenant/reports/tax

POST /tenant/reports/export              { reportType, format, dateRange, filters }
GET  /tenant/reports/exports             (export job history)
GET  /tenant/reports/exports/:jobId
GET  /tenant/reports/exports/:jobId/download
```

Platform Admin gets an equivalent cross-tenant/aggregated variant:

```text
GET  /platform/reports/summary
POST /platform/reports/export
```

## 46.5 Implementation Notes

```text
CSV      fast-csv / csv-write-stream (streamed, low memory)
Excel    ExcelJS
PDF      PDFKit, or a headless-Chromium renderer (Puppeteer) for
         richly styled/branded PDF reports
Queue    Background job (e.g. BullMQ + Redis) for large/async exports
```

- Stream large datasets to the file rather than loading the full result set into memory.
- PDF exports may include the tenant's logo/branding (§31A) as a report header.

---

# 47. Tenant Subscription

Since this is a SaaS platform, subscription readiness should be included.

Tenant:

```javascript
subscription: {
  planId,
  status,
  startDate,
  endDate,
  trialEndsAt
}
```

Possible plans:

```text
FREE
STARTER
PRO
ENTERPRISE
```

Future restrictions can include:

```text
Maximum tables
Maximum staff users
Maximum orders
Advanced reports
Maximum branches
Custom branding
Payment providers
```

Branch count (§6A) is the concrete example of a plan-gated limit:

```text
FREE / STARTER   -> 1 branch (plan default)
PRO              -> up to 5 branches (plan default)
ENTERPRISE       -> unlimited branches (plan default)
```

These are **plan defaults**, not hard limits — Platform Admin can override any of them per tenant (§7A). `POST /admin/branches` checks the tenant's current branch count against its *effective* branch limit — the Platform Admin override if one is set, otherwise the plan default (§7A.2) — before creating a new branch.

---

# 48. Tenant Onboarding

Platform Admin creates tenant:

```text
Create Tenant
    |
    v
Café Name
Slug
Contact
Address
Plan
Status
    |
    v
Create Tenant
    |
    v
Create Default Branch
    |
    v
Create Tenant Admin
    |
    v
Tenant Admin Login
    |
    v
Configure Café
    |
    v
Configure Payment
    |
    v
Create Tables (under default Branch)
    |
    v
Create Menu
    |
    v
(Optional) Add More Branches
```

Every tenant is created with exactly one branch (`isDefault: true`) so single-location cafés never have to interact with branch concepts. Tenant Admin should not need Platform Admin access, including to add further branches (subject to the tenant's effective branch limit — plan default or Platform Admin override, §7A).

---

# 49. Tenant Activation

Tenant status:

```text
TRIAL
ACTIVE
SUSPENDED
CANCELLED
```

Business access rules:

```text
ACTIVE
  -> Full access

TRIAL
  -> Full access within trial limits

SUSPENDED
  -> Customer ordering disabled
  -> Staff read-only or restricted

CANCELLED
  -> Access disabled
```

---

# 50. Tenant Deletion

Do not immediately hard-delete tenant data.

Use:

```text
status = CANCELLED
```

and an archival process.

If permanent deletion is implemented:

1. Confirm request.
2. Export required data.
3. Remove customer data according to retention policy.
4. Remove tenant data.
5. Remove payment configuration.
6. Remove images.
7. Record deletion audit event.

---

# 51. Security Requirements

Mandatory:

- HTTPS.
- Strong password hashing.
- Access token security.
- Refresh token rotation.
- Role-based access control.
- Tenant isolation.
- Input validation.
- Rate limiting.
- CORS.
- Security headers.
- MongoDB query protection.
- Payment signature verification.
- Webhook verification.
- Idempotency.
- Secure QR tokens.
- Encrypted payment credentials.
- Audit logs.

---

# 52. Sensitive Data Rules

Never expose:

```text
Razorpay secret
Webhook secret
Database URI
JWT secret
Refresh tokens
Password hashes
```

to frontend clients.

Do not log:

```text
Payment credentials
Card information
Passwords
Access tokens
Refresh tokens
FCM device tokens
```

---

# 53. Audit Logging

Every important tenant action should be auditable.

```javascript
AuditLog {
  _id,

  tenantId,

  actorType,
  actorId,

  action,
  entityType,
  entityId,

  before,
  after,

  ipAddress,
  userAgent,

  createdAt
}
```

Examples:

```text
TENANT_CREATED
TENANT_ACTIVATED
TENANT_SUSPENDED
TENANT_CANCELLED
TENANT_PROFILE_UPDATED
TENANT_SETTINGS_UPDATED
TENANT_BRANDING_UPDATED
TENANT_LIMITS_UPDATED
BRANCH_CREATED
BRANCH_UPDATED
BRANCH_DEACTIVATED
USER_CREATED
USER_UPDATED
USER_DISABLED
USER_ACTIVATED
USER_PASSWORD_RESET
CATEGORY_CREATED
CATEGORY_UPDATED
CATEGORY_DELETED
MENU_ITEM_CREATED
MENU_ITEM_UPDATED
MENU_ITEM_AVAILABILITY_CHANGED
PRICE_CHANGED
TABLE_CREATED
TABLE_UPDATED
TABLE_DELETED
PAYMENT_SETTINGS_UPDATED
PAYMENT_PROVIDER_CHANGED
ORDER_CANCELLED
REFUND_CREATED
TABLE_QR_REGENERATED
REPORT_EXPORTED
```

`TENANT_PROFILE_UPDATED`, `TENANT_SETTINGS_UPDATED`, and `TENANT_BRANDING_UPDATED` cover Tenant Admin's own edits to their café's profile (§6), settings (§30), and branding/logo (§31A) respectively — every write a Tenant Admin makes to their tenant is audited, not just the actions covered by more specific events elsewhere (menu, tables, staff, payment settings). `TENANT_ACTIVATED` and `TENANT_CANCELLED` complete the tenant lifecycle alongside `TENANT_CREATED`/`TENANT_SUSPENDED` (§49) on the Platform Admin side.

Do not store secrets inside audit snapshots. For `PAYMENT_SETTINGS_UPDATED` and `PAYMENT_PROVIDER_CHANGED` specifically, `before`/`after` are left empty entirely — the log records that the tenant's (or branch's, §6A.3) payment configuration was changed, by whom, when, and for which entity, but never a value diff of what changed. This isn't just "redact the secret fields and keep the rest" — even non-secret fields like `provider` or `currency` are skipped, so there's no partial-diff path that could someday leak a credential by mistake. The event's existence is the audit trail; reconstructing exactly what changed means going to the tenant's current settings and provider dashboard, not the log.

---

# 54. Environment Variables

Backend:

```text
NODE_ENV=
PORT=

MONGODB_URI=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

ENCRYPTION_KEY=

RAZORPAY_PLATFORM_CONFIG_IF_REQUIRED=

FRONTEND_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=
```

`FIREBASE_*` values are used server-side to send push notifications (e.g. order ready) to the Flutter mobile app via Firebase Cloud Messaging.

Tenant payment credentials should **not** be stored as global environment variables.

They are tenant configuration data and must be encrypted in the database.

Global encryption secrets remain in environment/secret management.

---

# 55. Database Indexes

## Tenants

```text
{ slug: 1 } UNIQUE
{ status: 1 }
```

## Branches

```text
{ tenantId: 1, slug: 1 } UNIQUE
{ tenantId: 1, status: 1 }
```

## Users

```text
{ tenantId: 1, email: 1 } UNIQUE
{ tenantId: 1, role: 1 }
{ tenantId: 1, branchId: 1, role: 1 }
```

## Categories

```text
{ tenantId: 1, displayOrder: 1 }
{ tenantId: 1, active: 1 }
```

## Menu Items

```text
{ tenantId: 1, categoryId: 1 }
{ tenantId: 1, active: 1 }
{ tenantId: 1, isAvailable: 1 }
```

## Tables

```text
{ tenantId: 1, branchId: 1, tableNumber: 1 } UNIQUE
{ qrToken: 1 } UNIQUE
```

## Orders

```text
{ tenantId: 1, branchId: 1, createdAt: -1 }
{ tenantId: 1, branchId: 1, orderStatus: 1, createdAt: -1 }
{ tenantId: 1, tableId: 1, createdAt: -1 }
{ tenantId: 1, branchId: 1, orderNumber: 1 } UNIQUE
```

## Payments

```text
{ tenantId: 1, createdAt: -1 }
{ tenantId: 1, branchId: 1, createdAt: -1 }
{ tenantId: 1, orderId: 1 }
{ providerOrderId: 1 } UNIQUE
{ providerPaymentId: 1 } UNIQUE
```

---

# 56. Customer Session Model

```javascript
CustomerSession {
  _id,

  tenantId,
  branchId,
  tableId,

  sessionTokenHash,

  active,

  createdAt,
  expiresAt
}
```

Session is tied to:

```text
tenantId
branchId
tableId
```

A customer session cannot access another tenant.

---

# 57. Multiple Customers at One Table

The system should support multiple customers ordering independently.

Example:

```text
Tenant A
  |
  Table 12
      |
      +-- Customer Session A
      |      Order #1001
      |
      +-- Customer Session B
             Order #1002
```

Both orders belong to:

```text
tenantId = Tenant A
tableId = Table 12
```

This is important for real café usage.

---

# 58. Table Session Handling

Table can have:

```text
AVAILABLE
OCCUPIED
```

An occupied table can contain multiple active customer sessions.

The table becomes available after all active orders are completed or the waiter/admin explicitly closes the table session.

---

# 59. Customer Order Tracking

Customer sees:

```text
Order #1042

✓ Payment Confirmed
✓ Order Received
✓ Kitchen Accepted
● Preparing
○ Ready
○ Served
```

Socket.IO updates the status in real time.

Fallback polling should be implemented for connection failures.

---

# 60. Development Phases

## Phase 1 — Architecture & Repository

- Create monorepo or separate frontend/backend repositories.
- TypeScript.
- ESLint.
- Prettier.
- Environment management.
- CI.
- Docker development environment.
- MongoDB connection.
- Base API.

Deliverable:

```text
Working multi-tenant backend foundation.
```

---

## Phase 2 — Tenant Management

Implement:

- Tenant model.
- Branch model, with a default branch created alongside every tenant (§6A).
- Platform Admin.
- Tenant creation.
- Tenant activation.
- Tenant suspension.
- Tenant Admin creation.
- Tenant + branch context middleware.

Deliverable:

```text
Platform can create isolated cafés, each with at least one branch.
```

---

## Phase 3 — Authentication & RBAC

Implement:

- Platform Admin login.
- Tenant Admin login.
- Waiter login.
- Kitchen login.
- Access tokens.
- Refresh tokens.
- Role middleware.
- Tenant middleware.

Deliverable:

```text
Secure role + tenant isolation.
```

---

## Phase 4 — Tenant Settings

Implement:

- Café profile.
- Branding.
- Currency.
- Timezone.
- Tax.
- Service charge.
- Ordering settings.

Deliverable:

```text
Each café has independent configuration.
```

---

## Phase 5 — Tenant Payment Configuration

Implement:

- Payment settings UI.
- Razorpay provider.
- Encrypted credentials.
- Provider abstraction.
- Test connection.
- Payment enable/disable.
- Webhook configuration.
- Credential replacement.

Deliverable:

```text
Each tenant can configure its own payment gateway.
```

---

## Phase 6 — Tables & QR

Implement:

- Table CRUD, scoped to a branch.
- QR token.
- QR generation.
- QR regeneration.
- Table status.
- Customer session, scoped to a branch.
- Additional branch creation and switching in Admin (§6A.6), for tenants whose plan allows it.

Deliverable:

```text
Each branch can generate QR codes for its own tables.
```

---

## Phase 7 — Menu

Implement:

- Categories.
- Menu items.
- Images.
- Prices.
- Availability.
- Sorting.
- Tenant isolation.

Deliverable:

```text
Each tenant has an independent menu.
```

---

## Phase 8 — Customer Ordering (Web)

Implement:

- QR landing.
- Tenant resolution.
- Customer session.
- Menu.
- Cart.
- Checkout.
- Order calculation.
- Order creation.

Deliverable:

```text
Customer can create an order from the web app.
```

---

## Phase 8A — Customer Ordering (Mobile, Flutter)

Implement:

- Flutter project scaffolding (iOS + Android).
- QR scan / deep-link entry.
- Tenant + table resolution against the same backend APIs.
- Tenant branding (logo, colors) rendering.
- Menu, cart, checkout — parity with the web flow.
- Order calculation reuse (backend is shared, no client-side duplication).
- Order creation and Socket.IO order tracking.
- FCM push registration and handling (§40A) for order-status updates when the app is backgrounded.

Deliverable:

```text
Customer can create an order from the mobile app, with full parity to the web app.
```

---

## Phase 9 — Payment

Implement:

- Payment creation.
- Razorpay checkout.
- Signature verification.
- Webhook.
- Payment state.
- Retry.
- Refund.
- Idempotency.

Deliverable:

```text
Customer can pay securely through the tenant's configured gateway.
```

---

## Phase 10 — Kitchen

Implement:

- Kitchen dashboard.
- New order queue.
- Accept.
- Preparing.
- Ready.
- Real-time events.
- Sound notification.
- FCM push for new orders when the display is backgrounded/locked (§40A).

Deliverable:

```text
Kitchen receives branch-specific orders in real time, in the foreground or backgrounded.
```

---

## Phase 11 — Waiter

Implement:

- Table dashboard.
- Active orders.
- Ready notifications.
- Serve action.
- Order completion.

Deliverable:

```text
Waiter can manage service without creating orders for seated QR customers.
```

---

## Phase 11A — POS / Counter Ordering

Implement:

- POS order creation UI (§23A.4), available to Waiter and Tenant Admin.
- `channel: "POS"` orders, table-optional (takeaway).
- Cash payment recording (no gateway call).
- Card-present payment via the `PaymentProvider` abstraction (§23A.3).
- Payment-link/QR generation for a POS order.
- Receipt printing; cash drawer trigger where hardware supports it (§23A.5).

Deliverable:

```text
A branch can take walk-in/counter orders on a POS device, alongside QR self-service.
```

---

## Phase 12 — Admin

Implement:

- Dashboard.
- Orders.
- Menu.
- Tables.
- Users.
- Payment settings.
- Reports.
- Report export (CSV/Excel/PDF).
- Tenant settings.

Deliverable:

```text
Tenant Admin has complete café management.
```

---

## Phase 13 — Platform Administration

Implement:

- Tenant list.
- Tenant creation.
- Tenant activation.
- Tenant suspension.
- Tenant subscription.
- Platform metrics.

Deliverable:

```text
Complete SaaS administration.
```

---

# 61. Testing Strategy

## Unit Tests

Test:

- Tenant resolution.
- Tenant isolation.
- Permission checks.
- Price calculations.
- Tax.
- Payment calculation.
- Order transitions.
- QR validation.
- Payment signature.
- Credential encryption/decryption.

## Mobile Tests (Flutter)

- Widget tests for cart, checkout, order tracking screens.
- Tenant/branding resolution from a scanned QR/table token.
- Integration test: full order + payment flow against a staging backend, verifying parity with the web flow for the same tenant.

## Security Tests

Attempt:

```text
Tenant A → Tenant B order
Tenant A → Tenant B menu
Tenant A → Tenant B payment
Tenant A → Tenant B users
Customer A → Tenant B order
Waiter → Admin API
Kitchen → Payment settings

Branch A → Branch B orders (same tenant)
Branch A → Branch B tables (same tenant)
Waiter (Branch A) → Branch B kitchen queue
Kitchen (Branch A) → Branch B order actions
```

Every attempt must fail.

## Integration Test

```text
Create Tenant A
Create Tenant B
Create menus for both
Create tables for both
Configure payment for both

Order from Tenant A

Verify:
- Tenant A receives order.
- Tenant B does not receive order.
- Tenant A payment configuration is used.
- Tenant B credentials are never accessed.
```

---

# 62. End-to-End Test

Test the complete workflow:

```text
Platform Admin
      |
      v
Create Tenant A
      |
      v
Create Tenant Admin
      |
      v
Tenant Admin Login
      |
      v
Configure Razorpay
      |
      v
Create Table 1
      |
      v
Generate QR
      |
      v
Customer scans QR
      |
      v
Customer orders
      |
      v
Payment
      |
      v
Razorpay verification
      |
      v
Kitchen receives order
      |
      v
Kitchen prepares
      |
      v
Kitchen marks READY
      |
      v
Waiter receives notification
      |
      v
Waiter serves
      |
      v
Admin sees completed order
```

---

# 63. Deployment Architecture

Recommended initial infrastructure:

```text
                         Cloudflare
                             |
                    +--------+--------+
                    |                 |
                    v                 v
                 Vercel             Render
               Web Frontend         Backend
                    |                 |
                    |             Socket.IO
                    |                 |
                    +--------+--------+
                             |
                             v
                       MongoDB Atlas
                             |
                    +--------+--------+
                    |                 |
                    v                 v
                Razorpay           Cloudinary

  App Store / Play Store
         |
         v
  Flutter Mobile App  ------------------>  (same Backend + Socket.IO above)
```

All tenants share application infrastructure while remaining logically isolated. The mobile app is distributed independently through the app stores but calls the same backend as the web frontend — there is no separate mobile backend.

---

# 64. Production Scaling

Initial:

```text
1 Frontend
1 Backend
1 MongoDB cluster
```

Later:

```text
Load Balancer
      |
 +----+----+
 |         |
API 1    API 2
 |         |
 +----+----+
      |
 Redis / Socket Adapter
      |
 MongoDB Cluster
```

Socket.IO should use a shared adapter such as Redis when multiple backend instances are deployed.

---

# 65. Caching

Potential caching:

```text
Tenant branding
Tenant public settings
Menu
Categories
```

Use tenant-aware cache keys:

```text
tenant:{tenantId}:menu
tenant:{tenantId}:branding
```

Never use:

```text
menu
```

as a shared cache key.

Otherwise one tenant's menu could accidentally be served to another tenant.

---

# 66. File Storage

Images should be tenant-aware.

Storage path:

```text
tenants/{tenantId}/menu/{imageId}
tenants/{tenantId}/branding/{imageId}
tenants/{tenantId}/branches/{branchId}/qr/{tableId}
```

Menu and branding images stay tenant-level (shared across branches, §6A.1); QR/table images are branch-level since tables belong to one branch.

This provides organizational and security boundaries.

---

# 67. Observability

Production monitoring should track:

- API errors.
- Payment failures.
- Payment webhook failures.
- Order creation failures.
- Socket connection failures.
- Tenant isolation errors.
- Database latency.
- API latency.
- Authentication failures.

Alerts:

```text
Payment failure rate high
Webhook processing failure
MongoDB unavailable
API error rate high
Socket connection failure
```

---

# 68. Backup and Recovery

MongoDB backups should be enabled.

Recovery planning should include:

- Database backups.
- Payment transaction records.
- Tenant configuration.
- Menu.
- Orders.
- Audit logs.

Payment credentials should be recoverable only through secure encrypted storage or reconfiguration.

---

# 69. Data Retention

Define retention policies for:

- Orders.
- Payments.
- Customer sessions.
- Audit logs.
- Webhook events.
- Cancelled tenants.

Customer sessions should have a short lifetime.

Payment and order records should follow applicable business/legal retention requirements.

---

# 70. API Response Format

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_VERIFICATION_FAILED",
    "message": "Payment verification failed."
  }
}
```

Do not expose internal stack traces to clients.

---

# 71. Recommended Frontend Routes

## Platform

```text
/platform/login
/platform/dashboard
/platform/tenants
/platform/tenants/:id
/platform/subscriptions
```

## Tenant Admin

```text
/{tenantSlug}/admin/login   (§32 — tenant resolved from slug, branded automatically)
/admin/dashboard
/admin/orders
/admin/kitchen
/admin/pos
/admin/menu
/admin/categories
/admin/tables
/admin/users
/admin/branches
/admin/payment-settings
/admin/reports
/admin/settings
```

For multi-branch tenants, a branch switcher (§6A.6) filters `/admin/dashboard`, `/admin/orders`, `/admin/kitchen`, `/admin/tables`, `/admin/users`, and `/admin/reports` down to one branch, via a query param or client-side state rather than a distinct route per branch (e.g. `/admin/orders?branch=<branchId>`, `branch` omitted or `all` for the aggregate view).

## Waiter

```text
/{tenantSlug}/waiter/login   (§32)
/waiter
/waiter/tables
/waiter/orders
/waiter/pos          (also reachable from /admin/pos for Tenant Admin, §23A)
```

## Kitchen

```text
/{tenantSlug}/kitchen/login   (§32)
/kitchen
```

`/admin/dashboard`, `/waiter`, `/kitchen`, and everything below them stay slug-free once signed in — tenant context comes from the authenticated session/JWT (§33) at that point, never re-parsed from the URL, so it isn't repeated on every route.

## Customer (Web)

```text
/t/:qrToken
/t/:qrToken/menu
/t/:qrToken/cart
/t/:qrToken/checkout
/order/:orderId
```

## Customer (Mobile — Flutter, `go_router` equivalents)

```text
/scan
/tenant/:qrToken
/tenant/:qrToken/menu
/tenant/:qrToken/cart
/tenant/:qrToken/checkout
/order/:orderId
```

The mobile app mirrors the same screen graph as the web app's customer routes, backed by the same APIs.

---

# 72. MVP Acceptance Criteria

The MVP is successful when:

1. Platform Admin can create Tenant A.
2. Platform Admin can create Tenant B.
3. Each tenant has its own Tenant Admin.
4. Tenant A cannot access Tenant B data.
5. Tenant Admin can create waiters.
6. Tenant Admin can create kitchen users.
7. Tenant Admin can configure menu.
8. Tenant Admin can configure tables.
9. Tenant Admin can generate QR codes.
10. Tenant Admin can configure its own payment gateway.
11. Tenant A and Tenant B can use different payment accounts.
12. Payment credentials are encrypted.
13. Customers can scan tenant-specific QR codes.
14. Customers can create orders.
15. Customers can pay using the tenant's configured provider.
16. Backend verifies payments.
17. Kitchen receives only its tenant's orders.
18. Kitchen can update order status.
19. Waiter receives ready notifications only for their tenant.
20. Waiter can mark orders served.
21. Tenant Admin can see only their tenant's reports.
22. Platform Admin can manage all tenants.
23. Payment credentials are never exposed to customers or staff.
24. Duplicate payment callbacks do not duplicate orders or payments.
25. Customers can create and pay for an order equally from the web app or the Flutter mobile app, against the same tenant menu, pricing, and backend.
26. Tenant Admin can upload, replace, and remove their café logo, and the updated logo is reflected on both the web app and the mobile app.
27. Tenant Admin can export their reports (Revenue, Orders, Payments, Item Performance, Tax) as CSV, Excel, or PDF, scoped strictly to their own tenant's data.
28. Every tenant is created with a default branch; a single-location café can use the product without ever creating a second branch.
29. Tenant Admin on a plan that allows it can create an additional branch, with its own tables, QR codes, and staff.
30. A Waiter or Kitchen user at Branch A cannot view or act on Branch B's tables, orders, or kitchen queue, even though both branches belong to the same tenant.
31. Platform Admin can override a tenant's branch limit (and other feature limits) above or below its plan default, and that tenant's `POST /admin/branches` enforces the override rather than the plan default.
32. A customer receives a push notification when their order is received and when it's ready, even if they've backgrounded the mobile app.
33. Kitchen staff receive a push notification for a new order, and Waiter staff for an order going ready, scoped strictly to their own branch.
34. A Waiter or Tenant Admin can create a walk-in order on a POS device (table or takeaway), take payment by cash, POS card, or a payment link, and that order flows into the same kitchen queue as a QR order with no special-casing.
35. A customer cannot complete checkout without entering their name; checkout succeeds with the phone field left blank, and no tenant setting can flip either requirement.

---

# 73. Recommended Technology Stack

| Layer | Technology |
|---|---|
| Web Frontend | React |
| Build | Vite |
| Web Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Icons | Lucide |
| Mobile UI | Material 3, custom-themed |
| State/API | TanStack Query |
| Forms | React Hook Form + Zod |
| Mobile App | Flutter (iOS + Android) |
| Mobile Language | Dart |
| Mobile State | Riverpod |
| Mobile HTTP | Dio |
| Mobile Real-time | socket_io_client (Dart) |
| Mobile Push | Firebase Cloud Messaging |
| Backend Push | firebase-admin (Node.js SDK) |
| Backend | Node.js |
| API | Express |
| Database | MongoDB |
| ODM | Mongoose |
| Real-time | Socket.IO |
| Authentication | JWT + Refresh Token |
| Password Hashing | Argon2id |
| Payment | Provider abstraction + Razorpay |
| POS / Card-Present | Razorpay POS or Pine Labs, behind the same PaymentProvider abstraction (§23A.3) |
| Encryption | AES-256-GCM or equivalent |
| Image Storage | Cloudinary/S3 |
| Report Export | fast-csv, ExcelJS, PDFKit/Puppeteer |
| Background Jobs | BullMQ + Redis |
| Testing | Vitest + Playwright |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Database | MongoDB Atlas |
| Cache/Scaling | Redis later |
| DNS/CDN | Cloudflare |

---

# 74. Final Architecture

```text
                         PLATFORM
                            |
                     Platform Admin
                            |
                            v
                     Tenant Management
                            |
       +--------------------+--------------------+
       |                    |                    |
       v                    v                    v
    Tenant A             Tenant B             Tenant C
       |                    |                    |
   +---+---+            +---+---+            +---+---+
   |   |   |            |   |   |            |   |   |
 Admin Waiter Kitchen  Admin Waiter Kitchen  Admin Waiter Kitchen
   |   |   |            |   |   |            |   |   |
   +---+---+            +---+---+            +---+---+
       |                    |                    |
       v                    v                    v
 Payment A              Payment B              Payment C
 Razorpay A             Razorpay B             Stripe C
       |                    |                    |
       +--------------------+--------------------+
                            |
                       Shared Backend
                            |
                    +-------+-------+
                    |               |
                 MongoDB         Socket.IO
                    |
             Tenant-Isolated Data
```

---

# 75. Core Architectural Principles

The development team must follow these principles:

## Principle 1 — Tenant isolation first

Every tenant-owned database query must be tenant-scoped.

## Principle 2 — Payment configuration belongs to the tenant

Each tenant controls its own payment provider and credentials. Configuration is performed by that tenant's own Tenant Admin only — never by Platform Admin, and never by another tenant's admin.

## Principle 3 — Payment credentials are secrets

Encrypt them at rest and never expose them to frontend or normal staff users.

## Principle 4 — Backend is the source of truth

The browser cannot determine:

- Price.
- Tax.
- Tenant.
- Payment success.
- Order ownership.

## Principle 5 — Customer creates the order

The waiter does not create orders on behalf of a customer who has their own QR/table session — that flow is always self-service, end to end. Counter/POS orders (§23A) are a distinct channel for walk-in customers who never scanned a QR in the first place; a staff member keying in a walk-in order there is not "creating a customer's order" in the sense this principle prohibits.

## Principle 5A — Customer never logs in

The customer flow has no login screen, no password, and no account creation — it behaves like a self-service kiosk: scan the table QR, browse, order, pay, done. Everything a customer's session needs (`tenantId`, `branchId`, `tableId`) is derived from the validated QR/table token (§22, §56), never from credentials. This isn't just an MVP shortcut to revisit later — asking a walk-up customer to sign in is exactly the friction §41B's design principles exist to eliminate. If a future feature (order history, saved favorites) needs a persistent identity, it must be optional and layered on top (e.g. phone-number OTP) — never a gate in front of ordering.

## Principle 6 — Kitchen prepares

Kitchen controls:

```text
NEW → ACCEPTED → PREPARING → READY
```

## Principle 7 — Waiter serves

Waiter controls:

```text
READY → SERVED
```

## Principle 8 — Admin manages the café

Tenant Admin controls:

- Menu.
- Tables.
- Users.
- Payment settings.
- Orders.
- Reports.
- Café settings.

## Principle 9 — Platform Admin manages tenants

Platform Admin controls:

- Tenant lifecycle.
- SaaS plans.
- Platform operations.

## Principle 10 — Payment provider abstraction

Do not tightly couple the entire application to Razorpay. Razorpay should be one implementation of a generic payment provider interface.

## Principle 11 — Branch isolation nests inside tenant isolation

A branch-scoped role (Waiter, Kitchen) is scoped to `{ tenantId, branchId }`, never to `{ tenantId }` alone. Branch isolation (§6A.5) is enforced with the same discipline as tenant isolation (§5) — it narrows the boundary further, it never substitutes for it.

---

# 76. Final MVP User Journey

```text
                    PLATFORM ADMIN
                          |
                     Create Tenant
                          |
                          v
                    TENANT ADMIN
                          |
             +------------+------------+
             |            |            |
          Menu         Tables       Payment
             |            |         Settings
             |            |            |
             +------------+------------+
                          |
                     Generate QR
                          |
                          v
                       CUSTOMER
                          |
                     Scan QR Code
                          |
                          v
                    Tenant Menu
                          |
                          v
                        Cart
                          |
                          v
                       Checkout
                          |
                          v
                 Tenant Payment Gateway
                          |
                          v
                 Payment Verification
                          |
                          v
                       NEW ORDER
                          |
                    +-----+-----+
                    |           |
                    v           v
                 KITCHEN      ADMIN
                    |
                 ACCEPTED
                    |
                 PREPARING
                    |
                   READY
                    |
                    v
                  WAITER
                    |
                  SERVED
                    |
                    v
                COMPLETED
                    |
                    v
             TENANT REPORTS
```

The resulting system is a **true multi-tenant café SaaS**, where each café operates independently, configures its own branding (including logo) and payment gateway, and lets its customers order and pay from either the web app or the Flutter mobile app — all while sharing the same scalable application infrastructure.

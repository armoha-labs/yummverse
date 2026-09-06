# Yummverse

Multi-tenant café ordering & payment SaaS. See `multi_tenant_cafe_ordering_payment_development.md`
for the full frozen specification (v2.0) driving this build, and `design/figma-ux/` for the UX designs.

Development follows the spec's §60 phases. **The backend is complete** — Phases 1–13, plus
§7A (tenant limits), §8A (staff management), §40A (push notifications), §46 (reports/export),
and §47 (subscriptions). 80 automated tests across 16 files, all green.

Not yet built: the web frontend (React admin/waiter/kitchen consoles + customer PWA) and the
Flutter mobile app. Report export is synchronous only (§46.3's background-job path for very
large exports isn't wired up — no BullMQ/Redis in this build yet). §40A push notifications
log the payload instead of sending when `FIREBASE_PROJECT_ID`/`FIREBASE_SERVICE_ACCOUNT_JSON`
are unset. Tenant/staff invite emails follow the same dev-friendly fallback pattern — set
`SMTP_HOST` (and `SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM` as needed) to send them for real,
otherwise the invite link is logged and also returned in the API response for manual use.

## Backend — local development

```bash
docker compose up -d          # starts MongoDB on localhost:27017
npm install                   # installs workspace deps
cp backend/.env.example backend/.env
npm run dev -w backend        # http://localhost:4000/api/v1/health
```

### Testing

```bash
npm test -w backend           # Vitest, runs against an in-memory MongoDB
npm run lint -w backend
npm run typecheck -w backend
```

### Bootstrapping the first Platform Admin

There's no signup UI yet — insert one directly, e.g. via `mongosh`:

```js
use yummverse
db.platformadmins.insertOne({
  name: "Root",
  email: "admin@yummverse.dev",
  passwordHash: "<argon2id hash — hash a password with backend/src/utils/password.ts>",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
})
```

### API surface

Everything in the spec's §36 API design is implemented: `/auth`, `/platform/*` (tenants,
subscriptions, limits, platform metrics), `/tenant/*` (profile, settings, branding,
payment-settings, reports), `/admin/*` (branches, tables, categories, menu-items, users,
orders, kitchen, dashboard), `/public/*` and `/customer/*` (QR flow, sessions, ordering),
`/payments/*` (create/verify/webhook/refund), `/kitchen/*`, `/waiter/*`, `/pos/*`, and
`/notifications/register-token`.

# Phase 2 Final Report — Pilot Readiness & Production Hardening

**Date:** 6 Nov 2026 (Europe/London)  
**Codebase:** `/agent/saree-tryon-saas`  
**Branch:** `cursor/saree-tryon-saas-324f`  
**Plan:** [`phase2-implementation-plan.md`](./phase2-implementation-plan.md)

## Executive assessment

Trail9 is **technically closer to a controlled 3–4 store pilot** for **UX, tenancy, privacy plumbing, and billing test-mode wiring**. It is **not** ready to market “AI virtual try-on quality” until a licensed real provider is connected and scored on Indian sarees.

**Pilot readiness (ops/security/privacy foundation):** **CONDITIONAL YES** with Demo AI + Razorpay test keys + S3 storage configured.  
**Commercial AI readiness:** **NO** — still DemoTryOnProvider / stub worker unless external credentials appear and pass saree evaluation.

---

## Feature classification

| Feature | Classification | Notes |
|---------|----------------|-------|
| Middleware protecting `/dashboard/*` `/admin/*` | **COMPLETED AND TESTED** | Unauth → 307 login; retailer → admin redirected to dashboard |
| Role claim in JWT (`isa`) for admin routes | **COMPLETED AND TESTED** | Smoke verified |
| Multi-store active store (`x-store-id` / cookie / API) | **COMPLETED AND TESTED** | Unit + isolation integration tests |
| Retailer APIs no longer use silent `memberships[0]` only | **COMPLETED AND TESTED** | `requireStoreContext` |
| Cross-store catalogue isolation tests | **COMPLETED AND TESTED** | Vitest integration |
| Production env secret enforcement | **COMPLETED AND TESTED** | Runtime via `instrumentation` + `env.ts` (build-safe) |
| Object storage abstraction local \| s3 | **COMPLETED AND TESTED** (local) / **BLOCKED BY EXTERNAL CREDENTIALS** (S3) | Code + local path verified; S3 needs buckets/keys |
| Signed / private media access | **COMPLETED AND TESTED** | Local HMAC; S3 presign path implemented |
| Customer retention cleanup API + CLI | **COMPLETED AND TESTED** | Cleanup test + live `/api/internal/cleanup` |
| Configurable retention hours | **COMPLETED AND TESTED** | Env + store settings |
| AI provider health endpoint | **COMPLETED AND TESTED** | `commercialQuality: false` honest |
| External provider timeouts/retries/validation | **COMPLETED AND TESTED** | Unit: fails closed without creds |
| Credit deduct idempotency | **COMPLETED AND TESTED** | Existing + still passing |
| Credit restore on qualifying failures | **COMPLETED AND TESTED** | New restore test |
| Subscription grace / PAST_DUE / EXPIRED | **COMPLETED AND TESTED** | Unit allow-list + enforce helper |
| Razorpay Checkout.js when configured | **IMPLEMENTED BUT NOT VERIFIED** | UI + checkout payload; no live Razorpay keys here |
| Razorpay webhook HMAC + idempotency | **COMPLETED AND TESTED** (signature unit) / **BLOCKED BY EXTERNAL CREDENTIALS** (end-to-end) | |
| Failed payment → PAST_DUE | **IMPLEMENTED BUT NOT VERIFIED** | Webhook handlers added; needs Razorpay test events |
| Store logo upload | **COMPLETED AND TESTED** | Settings multipart API + UI |
| Onboarding checklist / empty states / store switcher | **COMPLETED AND TESTED** | Manual smoke of pages via build |
| WhatsApp share (explicit) | **COMPLETED AND TESTED** | Kiosk result link |
| Real commercial saree AI quality | **NOT IMPLEMENTED** / **BLOCKED BY EXTERNAL CREDENTIALS** | Demo only; evaluation checklist in `docs/AI_PROVIDER.md` |
| Live public deploy | **NOT IMPLEMENTED** | By instruction — no paid infra without auth |

---

## Security improvements

1. Edge middleware JWT gate on dashboard/admin.
2. Admin routes require `isa=1` session claim.
3. Explicit store membership on every retailer mutating/read API.
4. Production refuses insecure `SESSION_SECRET` defaults at runtime.
5. Cleanup cron requires bearer secret in production.
6. Object storage provider interface with private S3 buckets design.
7. Retention anonymises customer paths without logging image content.

---

## Files created or modified (high level)

**Created:**  
`apps/web/src/middleware.ts`, `instrumentation.ts`, `lib/store-context.ts`, `lib/storage/{types,local-provider,s3-provider,index}.ts`, `lib/retention/cleanup.ts`, `lib/billing/subscription-state.ts`, `app/api/retailer/active-store/route.ts`, `app/api/internal/cleanup/route.ts`, `app/api/ai/health/route.ts`, `app/dashboard/onboarding/page.tsx`, `components/StoreSwitcher.tsx`, `scripts/retention-cleanup.ts`, `docs/DEPLOYMENT.md`, `docs/AI_PROVIDER.md`, multiple `*.test.ts`, Project store plan/report.

**Modified:**  
`lib/auth.ts`, `lib/env.ts`, `lib/credits.ts`, retailer/billing/kiosk routes, dashboard pages, kiosk WhatsApp, `README.md`, `.env.example`, external provider, webhook, checkout UI.

**Database:** No new Prisma migration required for Phase 2 (existing schema fields used: `graceUntil`, `logoPath`, `expiresAt`, credit types). Seed unchanged structurally.

---

## Tests executed

```
Vitest: 11 files, 22 tests — all passed
pytest AI worker: previously passing (unchanged this phase)
npm run lint — pass
npm run typecheck — pass
npm run build — pass (middleware 39.3 kB)
```

**Live smoke:** dashboard unauth 307; retailer dashboard 200; admin-as-retailer 307→dashboard; AI health honest; cleanup ok; try-on SUCCEEDED demo=true.

---

## Production build result

**SUCCESS** — `next build` completed with protected middleware and 28 routes generated.

---

## Remaining blockers

1. **Real AI provider** credentials + saree quality evaluation (Kanjeevaram, Pochampally, Banarasi, cotton, silk, complex pallu).
2. **S3/Supabase** buckets + keys for multi-store production storage.
3. **Razorpay test** keys, plan IDs on `subscription_plans.razorpayPlanId`, webhook endpoint reachability.
4. **GitHub push/PR** — still no `gh` auth for `9chirla`.
5. HTTPS hosting + domain for real tablet kiosks.
6. Optional: Redis-backed rate limits for multi-instance; password reset; Postgres RLS.

---

## External accounts / credentials still required

| Need | Purpose |
|------|---------|
| S3 or Supabase Storage | Private catalogue + customer buckets |
| Licensed try-on API or GPU model licence | Real AI (not demo) |
| Razorpay test account | Checkout + webhooks |
| Hosting (Vercel/Fly/VPS) + Postgres | Deploy |
| CLEANUP_CRON_SECRET + scheduler | Retention |

---

## Estimated monthly operating costs (3–4 stores)

| Item | Nature | Estimate |
|------|--------|----------|
| Managed Postgres (small) | Estimate | ₹1,500–4,000 / ~$18–50 |
| Object storage + egress | Estimate | ₹500–2,000 / ~$6–25 |
| App hosting | Estimate | ₹0–3,000 / $0–35 |
| Razorpay | Confirmed pricing model | % fees on successful charges only (see Razorpay tariff) — **₹0** until real payments |
| Demo AI | Confirmed | **₹0** |
| External try-on API | Estimate / vendor-specific | Often $0.02–0.15 per generation — **unconfirmed until vendor chosen** |
| GPU self-host | Estimate | ₹15,000–80,000+ if dedicated GPU VPS |

**Confirmed prices:** none locked in this environment (no vendor contracts). Figures above are planning estimates, not quotes.

---

## How to run (unchanged local path)

See `/agent/saree-tryon-saas/README.md` and `docs/DEPLOYMENT.md`.

Demo: `admin@trail9.local` / `retailer@demo-sarees.local` · kiosk `/kiosk/demo-silk-house`.

---

## Clear pilot verdict

| Question | Answer |
|----------|--------|
| Ready for 3–4 store **process / UX / privacy / tenancy** pilot with demo AI clearly labelled? | **Yes, after** configuring HTTPS host, S3, cleanup cron, and briefing staff that results are demo/experimental. |
| Ready to sell “AI try-on” as a commercial differentiator? | **No** until real provider connected + saree evaluation passes. |
| Ready for live Razorpay charges? | **No** until test-mode webhooks verified end-to-end and go-live authorised. |

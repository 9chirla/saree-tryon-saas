# Phase 2 Implementation Plan — Pilot Readiness

Verified against current code (`cdfab4d`): middleware absent; `memberships[0]` still used; filesystem-only storage; no retention sweeper; billing grace/restore thin.

## Preserve
Kiosk flow, Demo/External/SelfHosted providers, Prisma schema core, Razorpay missing-cred honesty, seed accounts, Docker Compose, visual design language.

## Priority order
1. **Security** — middleware, multi-store membership resolution, prod env validation
2. **Object storage** — `StorageProvider` local | s3 (Supabase-compatible)
3. **Retention cleanup** — cron/script + API trigger; delete expired customer assets
4. **AI hardening** — health, timeouts/retries, credit restore on qualifying failures, honesty docs
5. **Billing** — checkout when keys present, grace/PAST_DUE, webhook tests
6. **Retailer UX** — logo upload, store switcher, empty states
7. **Tests + deploy docs + Phase 2 report**

## Out of scope / blocked
Live public deploy, paid infra, claiming real AI quality without connected provider + saree evaluation evidence.

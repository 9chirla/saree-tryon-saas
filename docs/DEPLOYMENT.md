# Trail9 Production Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- (Recommended) S3-compatible private object storage
- (Optional) Redis
- Domain with HTTPS for kiosk camera (`getUserMedia`)

## 1. Environment

Copy `.env.example` → `.env` and set:

| Variable | Production requirement |
|----------|------------------------|
| `NODE_ENV` | `production` |
| `APP_URL` | Public HTTPS origin (not localhost) |
| `SESSION_SECRET` | ≥32 char unique secret |
| `DATABASE_URL` | Managed Postgres URL |
| `STORAGE_PROVIDER` | `s3` for multi-store pilot |
| `S3_*` | Private buckets + keys |
| `CLEANUP_CRON_SECRET` | Bearer token for cleanup cron |
| `TRYON_PROVIDER` | `demo` until real provider evaluated |
| `RAZORPAY_*` | Test keys first; `RAZORPAY_MODE=test` |
| `BILLING_GRACE_DAYS` | Default 3 |

Production startup refuses insecure `SESSION_SECRET` defaults (`src/instrumentation.ts`).

## 2. Database migrations

```bash
cd apps/web
npx prisma migrate deploy
UPLOAD_DIR=/var/trail9/uploads npm run db:seed   # optional demo data — skip for real stores
```

## 3. Object storage (S3 / Supabase)

1. Create two **private** buckets: catalogue + customer (or one bucket with kind prefixes).
2. Enable S3 API credentials (Supabase: Project Settings → Storage → S3).
3. Set `STORAGE_PROVIDER=s3` and endpoint/keys.
4. Never mark buckets public. Access is via short-lived signed URLs only.

Local dev can keep `STORAGE_PROVIDER=local`.

## 4. Retention cleanup

Hourly cron example:

```bash
0 * * * * curl -X POST -H "Authorization: Bearer $CLEANUP_CRON_SECRET" https://YOUR_APP/api/internal/cleanup
```

Or: `npx tsx scripts/retention-cleanup.ts`

Default retention: `DEFAULT_RETENTION_HOURS=24` (overridable per store in settings).

## 5. AI provider

- **demo** — labelled composites; OK for UX pilot, **not** commercial try-on quality.
- **external** — set URL + API key; health at `/api/ai/health`.
- **selfhosted** — run `apps/ai-worker`; stub until licensed GPU model is installed and **evaluated on real Indian sarees**.

Do not claim quality passes until colour, border, pallu, drape, face preservation are assessed on Kanjeevaram, Pochampally, Banarasi, cotton, silk samples.

## 6. Razorpay test mode

1. Create test plans in Razorpay; set `subscription_plans.razorpayPlanId`.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
3. Webhook URL: `https://YOUR_APP/api/billing/webhook/razorpay`
4. Keep `RAZORPAY_MODE=test` until explicitly authorised for live.

## 7. Build & run

```bash
cd apps/web
npm ci --legacy-peer-deps
npx prisma generate
npm run build
npm run start
```

Docker Compose remains the local stack (`docker compose up`).

## 8. Backup & recovery

- **Postgres:** nightly `pg_dump` (or provider snapshots); retain ≥7 days.
- **Object storage:** enable versioning on catalogue bucket; customer bucket can be short retention.
- **Secrets:** store in a vault / host secret manager — never in git.
- Restore: provision DB → `migrate deploy` → restore dump → verify `/api/ai/health` and login.

## 9. Logging & monitoring

- App logs: structured `console.error` without photos/tokens/payment secrets.
- Watch: 5xx rate, try-on FAILED rate, cleanup failureCount, webhook 401s, disk/S3 errors.
- Alert on cleanup job failures and subscription PAST_DUE spikes.

## 10. Smoke checklist (per store)

1. HTTPS kiosk loads; camera permission works.
2. Consent → capture → saree → labelled or real result.
3. Retailer login; catalogue isolated to their store.
4. Credits decrement once on success.
5. Cleanup cron returns `ok: true`.

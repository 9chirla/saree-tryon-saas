# Trail9 Production Deployment Guide

**Target hosting:** single long-lived VPS in India (Mumbai / `ap-south-1` or equivalent India-region provider), Docker Compose, Node (`web`) + FastAPI (`ai-worker`) + Postgres co-located, **Caddy for TLS**. Do **not** deploy to Vercel/serverless.

## Prerequisites

- VPS in Mumbai (or chosen India region) with Docker + Compose
- Domain DNS A/AAAA pointed at the VPS (required for HTTPS + kiosk camera)
- PostgreSQL 16 (Compose service below)
- S3-compatible private object storage (see checklist)
- (Optional) Redis — reserved for multi-instance rate limits; not required on a single VPS

## Rate limiting (single VPS)

In-memory limiter is correct for a single long-lived Node process. It does not aggregate across instances. Move to Redis (Upstash) before running more than one app instance.

Implementation: `apps/web/src/lib/rate-limit.ts` (process-local `Map`). Applied today on login, register, and kiosk consent / upload / try-on create. Do not scale `web` replicas horizontally until this is moved to a shared store.

## 1. Environment

Copy `.env.example` → `.env` (or host secrets) and set:

| Variable | Production requirement |
|----------|------------------------|
| `NODE_ENV` | `production` |
| `APP_URL` | Public HTTPS origin (not localhost), e.g. `https://tryon.example.com` |
| `SESSION_SECRET` | ≥32 char unique secret |
| `DATABASE_URL` | Compose Postgres URL (or managed) |
| `STORAGE_PROVIDER` | `s3` for multi-store pilot |
| `S3_*` | See S3 provisioning checklist below |
| `SIGNED_URL_TTL_SECONDS` | Signed GET TTL (default `900`) |
| `CLEANUP_CRON_SECRET` | Bearer token for cleanup cron |
| `TRYON_PROVIDER` | `demo` until real provider evaluated |
| `RAZORPAY_*` | Test keys first; `RAZORPAY_MODE=test` |
| `BILLING_GRACE_DAYS` | Default 3 |
| `DOMAIN` | Hostname for Caddy (e.g. `tryon.example.com`) |

Production startup refuses insecure `SESSION_SECRET` defaults (`src/instrumentation.ts`).

## 2. S3 provisioning checklist

Do **not** mark buckets public. The app uses short-lived signed URLs only.

1. **Create two private buckets**
   - Catalogue (saree images / branding): e.g. `trail9-catalogue`
   - Customer (session captures / try-on results): e.g. `trail9-customer`
2. **Region:** `ap-south-1` (Mumbai) on AWS, or the equivalent India-region endpoint on MinIO / Supabase / R2-compatible providers.
3. **Block public access** on both buckets (AWS: Block Public Access ON; no public ACLs/policies).
4. **Minimum IAM actions** on both bucket ARNs / object prefixes the app uses:
   - `s3:PutObject` — upload
   - `s3:GetObject` — signed-URL reads
   - `s3:HeadObject` — existence checks
   - `s3:DeleteObject` — retention cleanup of customer session assets
5. **Env var names (exact):**

| Variable | Example / notes |
|----------|-----------------|
| `STORAGE_PROVIDER` | `s3` |
| `S3_ENDPOINT` | Provider S3 API endpoint |
| `S3_REGION` | `ap-south-1` (or provider region; `auto` only if the vendor documents it) |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key |
| `S3_BUCKET_CATALOGUE` | e.g. `trail9-catalogue` |
| `S3_BUCKET_CUSTOMER` | e.g. `trail9-customer` |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO / many S3-compatible APIs; follow AWS docs for AWS S3 |
| `SIGNED_URL_TTL_SECONDS` | e.g. `900` |

6. Local / single-box smoke can keep `STORAGE_PROVIDER=local` until buckets and credentials exist. A Vitest case for S3 delete is skipped unless `S3_ENDPOINT` + credentials are set.

## 3. Database migrations

```bash
cd apps/web
npx prisma migrate deploy
# optional demo data — skip for real stores
UPLOAD_DIR=/var/trail9/uploads npm run db:seed
```

Under Compose prod, run migrate against the `web` / one-off container after Postgres is healthy.

## 4. Retention cleanup

Hourly cron example (host or sidecar):

```bash
0 * * * * curl -X POST -H "Authorization: Bearer $CLEANUP_CRON_SECRET" https://YOUR_APP/api/internal/cleanup
```

Or: `npx tsx scripts/retention-cleanup.ts`

Default retention: `DEFAULT_RETENTION_HOURS=24` (overridable per store in settings).

## 5. AI provider

- **demo** — labelled composites; OK for UX pilot, **not** commercial try-on quality.
- **external** — set URL + API key; health at `/api/ai/health`.
- **selfhosted** — Compose `ai-worker` (FastAPI); stub until licensed GPU model is installed and **evaluated on real Indian sarees**.

Do not claim quality passes until colour, border, pallu, drape, face preservation are assessed on Kanjeevaram, Pochampally, Banarasi, cotton, silk samples.

## 6. Razorpay test mode

1. Create test plans in Razorpay; set `subscription_plans.razorpayPlanId`.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
3. Webhook URL: `https://YOUR_APP/api/billing/webhook/razorpay`
4. Keep `RAZORPAY_MODE=test` until explicitly authorised for live.

## 7. Build & run (Compose + Caddy)

**Local / dev stack:** `docker compose up` (`docker-compose.yml`).

**Production (single VPS):**

```bash
# On the VPS, with DNS already pointing DOMAIN → this host
cp .env.example .env   # then fill production secrets
docker compose -f docker-compose.prod.yml up -d --build
```

- `docker-compose.prod.yml` — Postgres + FastAPI worker + Next.js web + Caddy
- `Caddyfile` — automatic HTTPS for `$DOMAIN`, reverse-proxy to `web:3000`

Do not expose Postgres or the AI worker on the public internet; only Caddy binds `:80` / `:443`.

## 8. Backup & recovery

### Required: nightly Postgres dump to the customer bucket

**Founder / ops must schedule this** (not wired as Compose cron yet):

1. Run `pg_dump` against production Postgres (e.g. from the host or a one-off container on the Compose network).
2. Upload the dump object to the **private customer bucket** (e.g. `s3://trail9-customer/backups/postgres/YYYY-MM-DD.sql.gz`) with the same credentials / IAM as above (`s3:PutObject`).
3. Retain ≥7 days of dumps; test restore before go-live.

Example sketch (customise; do not commit secrets):

```bash
# REQUIRED nightly step — schedule via host cron or systemd timer (not implemented in Compose yet)
DATE=$(date -u +%F)
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "/tmp/trail9-$DATE.sql.gz"
# Upload /tmp/trail9-$DATE.sql.gz to S3_BUCKET_CUSTOMER prefix backups/postgres/
# using AWS CLI / rclone / mc with the provisioned keys
```

Also:

- **Object storage:** enable versioning on the catalogue bucket; customer bucket may use short object retention aligned with try-on retention policy.
- **Secrets:** vault / host secret manager — never in git.
- **Restore:** provision DB → `migrate deploy` → restore dump → verify `/api/ai/health` and login.

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

## Founder actions still required

- Create the two private buckets and IAM user/policy in `ap-south-1` (or chosen India provider).
- Place real `S3_*` / `SESSION_SECRET` / Razorpay / `CLEANUP_CRON_SECRET` values on the VPS (never in git).
- Point DNS `DOMAIN` at the VPS so Caddy can issue certificates.
- Schedule the nightly `pg_dump` → customer-bucket upload (documented above; not automated in Compose yet).

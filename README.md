# trAIl9 — AI Virtual Saree Try-On SaaS

Multi-tenant commercial platform for Indian saree/textile retailers:

- **Kiosk** — consent → camera → saree select → real try-on job → labelled demo result
- **Retailer dashboard** — catalogue, usage, branding, subscription
- **Super-admin** — retailers, plans, AI providers, metrics

Local demo runs with **DemoTryOnProvider** (no paid API keys). Results are clearly labelled `DEMO — not real AI try-on`.

## Stack

- Next.js 15 (App Router) + Prisma + PostgreSQL
- FastAPI AI worker (`SelfHostedTryOnProvider` contract)
- Docker Compose for Postgres / Redis / services
- Razorpay Subscriptions (test) behind a payment abstraction

## Quick start (local)

```bash
# 1. Copy env
cp .env.example .env

# 2. Start Postgres (Docker) — or use a local Postgres matching DATABASE_URL
docker compose up -d postgres redis

# 3. Install & migrate
cd apps/web
npm install
npx prisma migrate deploy
UPLOAD_DIR=../../uploads npm run db:seed

# 4. Run web + AI worker
npm run dev          # http://localhost:3000
# from repo root:
npm run ai:dev       # http://localhost:8000
```

From repo root with workspaces:

```bash
npm install --workspace=apps/web
npm run db:migrate
npm run db:seed
npm run dev
npm run ai:dev
```

### Demo accounts (seeded)

| Role | Email | Password |
|------|-------|----------|
| Super-admin | `admin@trail9.local` | `Admin123!` |
| Retailer | `retailer@demo-sarees.local` | `Retailer123!` |

Kiosk: [http://localhost:3000/kiosk/demo-silk-house](http://localhost:3000/kiosk/demo-silk-house)

## Environment

See `.env.example`. Important:

- `TRYON_PROVIDER=demo|external|selfhosted`
- Leave `RAZORPAY_*` empty for explicit **missing_credentials** billing mode (never fakes payment success)
- Never put secrets in `NEXT_PUBLIC_*`

## Docker (full stack)

```bash
cp .env.example .env
docker compose up --build
```

## Tests

```bash
npm run test --workspace=apps/web
npm run ai:test
npm run lint --workspace=apps/web
npm run typecheck --workspace=apps/web
```

## AI providers

| Provider | Env | Behaviour |
|----------|-----|-----------|
| `demo` | none | Local labelled collage via Sharp |
| `external` | `EXTERNAL_TRYON_URL`, `EXTERNAL_TRYON_API_KEY` | Async HTTP API; fails closed if unset |
| `selfhosted` | `AI_WORKER_URL` | FastAPI stub (GPU model not included) |

## Project path

This workspace lives at `/agent/saree-tryon-saas` when built by the cloud agent. Architecture plan and implementation report are in the Project store under `docs/`.

# AI Provider Integration — Honest Status

## Abstraction

`VirtualTryOnProvider` (`apps/web/src/lib/tryon/`) with:

- `DemoTryOnProvider` — no credentials; labelled collage; **not real AI**
- `ExternalApiTryOnProvider` — env URL + API key; timeouts + retries on 5xx/network
- `SelfHostedTryOnProvider` — FastAPI worker at `AI_WORKER_URL`

Select with `TRYON_PROVIDER=demo|external|selfhosted`.

Health: `GET /api/ai/health` — always reports `commercialQuality: false` until you change that after real evaluation (do not flip blindly).

## What is NOT claimed

- Commercial-quality saree try-on
- Correct Kanjeevaram border / Banarasi zari / pallu placement
- Face preservation or photoreal drape

Demo and self-hosted stub outputs are watermarks as non-commercial samples.

## Connecting a real provider

1. Obtain a **commercially licensed** try-on API or self-hosted model (do not deploy unlicensed weights).
2. Set `EXTERNAL_TRYON_URL`, `EXTERNAL_TRYON_API_KEY` (or extend FastAPI worker).
3. Contract expected by ExternalApiTryOnProvider:
   - `POST /tryon` → `{ providerJobId, status }`
   - `GET /tryon/:id` → `{ status, error?, progress? }`
   - `GET /tryon/:id/result` → `{ resultPath|URL fields, isDemo, … }`
   - `POST /tryon/:id/cancel`
4. Run saree evaluation suite (below) before pilot marketing claims.

## Saree evaluation checklist (manual)

Photograph / use real stock for each and score 1–5:

| Sample | Colour | Border | Pallu | Drape | Pose | Face | Overall |
|--------|--------|--------|-------|-------|------|------|---------|
| Kanjeevaram temple border | | | | | | | |
| Pochampally ikat | | | | | | | |
| Banarasi gold zari | | | | | | | |
| Cotton daily wear | | | | | | | |
| Silk festive | | | | | | | |
| Complex pallu + border | | | | | | | |

**Pass criteria for pilot AI claims:** mean overall ≥4 and no catastrophic face/identity failures on ≥5 of 6 categories.

Until then: keep `TRYON_PROVIDER=demo` or show “preview / experimental” labelling in kiosk UI for non-demo providers that have not been scored.

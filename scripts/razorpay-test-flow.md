# Razorpay test-mode dry-run (manual checklist)

For a non-technical founder verifying Trail9 billing **in Razorpay test mode**.

**Do not use live keys.** Keep `RAZORPAY_MODE=test`.  
Someone technical must already have set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` on the server, and pointed the Razorpay webhook URL to:

`https://YOUR_DOMAIN/api/billing/webhook/razorpay`

You will need:

- Access to the [Razorpay Dashboard](https://dashboard.razorpay.com/) → **Test Mode** (toggle)
- A retailer login for your Trail9 app (`/dashboard/billing`)
- Optional helper: a technical person who can run one SQL / Prisma query to count `BillingEvent` rows

---

## Step 1: create a test subscription in the Razorpay dashboard

1. Open Razorpay Dashboard → ensure **Test Mode** is ON.
2. Create (or open) a **test Plan** that matches a Trail9 plan (Basic / Professional / Enterprise) if not already mapped.
3. From your Trail9 retailer account, open **Dashboard → Billing** and start checkout for a plan **or** create a **test Subscription** in Razorpay linked to that plan and your organisation (your technical contact can paste the Razorpay subscription id into Trail9 if needed).

**Expected result**

- You see a Razorpay **test** subscription id (starts like `sub_…`).
- Trail9 Billing page still shows your store’s current status (often `DEMO` until webhooks fire).

**If it does not match**

- Confirm Test Mode toggle is on (not Live).
- Confirm plan ids in Razorpay match what your engineer stored on `subscription_plans.razorpayPlanId`.
- Do not continue until a `sub_…` test subscription exists.

---

## Step 2: trigger a test webhook to `/api/billing/webhook/razorpay` and confirm HTTP 200 and one BillingEvent row

1. In Razorpay → **Accounts & Settings → Webhooks** (Test Mode), open the endpoint for your app.
2. Send / replay a test event such as **`subscription.activated`** or **`subscription.charged`** for the subscription from Step 1  
   (Razorpay “Send test webhook” / event replay — or ask your engineer to POST a signed test payload).
3. Ask your engineer to confirm the HTTP response is **200**.
4. Ask them to count rows:  
   `BillingEvent` where `provider = 'razorpay'` and `providerEventId = <that event’s id>` → **exactly 1**.

**Expected result**

- HTTP **200** with a JSON body like `{ "ok": true }` (first delivery is not a duplicate).
- **One** new `BillingEvent` row for that Razorpay event id.

**If it does not match**

- **401** → webhook secret mismatch (`RAZORPAY_WEBHOOK_SECRET`) or missing `X-Razorpay-Signature`.
- **400** “Missing Razorpay event id” → payload has no `id`; use a real Razorpay event shape.
- **200 but no BillingEvent** → wrong database / wrong environment.
- No HTTP hit at all → DNS, HTTPS, or webhook URL typo.

---

## Step 3: trigger the same webhook twice and confirm the second returns 200 but no new BillingEvent row (idempotency)

1. Replay **the exact same** webhook event (same Razorpay `event.id`) a second time.
2. Confirm HTTP **200** again.
3. Confirm `BillingEvent` count for that `providerEventId` is still **1** (not 2).
4. Optional: response may include `"duplicate": true`.

**Expected result**

- Second call: **200**.
- Still **one** `BillingEvent` row for that event id.
- Credits / period should not double-grant for the same event.

**If it does not match**

- Second call creates a second row → idempotency broken; stop and call your engineer (should not happen after the `event.id` fix).
- Second call **500** → server error; capture logs; do not retry endlessly.

---

## Step 4: check the subscription status in your retailer dashboard and confirm it flipped to ACTIVE

1. Sign in as the retailer.
2. Open **Dashboard → Billing**.
3. Read the line that shows current plan · **status** · credits.

**Expected result**

- Status shows **`ACTIVE`** (after a successful `subscription.activated` / `subscription.charged` test event for a subscription Trail9 already knows).
- Credits remaining look like a full monthly allotment for that plan (not zero, unless you already used them).

**If it does not match**

- Still `DEMO` / unchanged → the webhook’s `payload.subscription.entity.id` does not match `razorpaySubscriptionId` stored for your org. Re-check Step 1 linkage.
- Status wrong but BillingEvent exists → event type was not activated/charged; resend the correct event type.

---

## Step 5: trigger a `payment.failed` test event and confirm the subscription moves to PAST_DUE, not cancelled

1. From Razorpay test tools, send a **`payment.failed`** webhook (or `subscription.pending` / `subscription.halted`) for the **same** test subscription.
2. Refresh **Dashboard → Billing**.

**Expected result**

- Status becomes **`PAST_DUE`** (not `CANCELLED`, not `EXPIRED`).
- You may see a grace-until timestamp.
- Kiosk try-on may still work during grace (by design).

**If it does not match**

- Shows **`CANCELLED`** → wrong event type (`subscription.cancelled`) was sent; use `payment.failed` / pending / halted for this step.
- Status unchanged → subscription id in the payload did not match; fix linkage and resend.
- Jumps straight to **`EXPIRED`** → unusual for a single failed payment webhook; check system clock / period end with your engineer.

---

## After you finish

- Leave Razorpay in **Test Mode**.
- Do not switch `RAZORPAY_MODE=live` until you explicitly approve go-live.
- Keep a screenshot of Billing showing `ACTIVE` then `PAST_DUE` for your records.

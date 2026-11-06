import { createHmac, timingSafeEqual } from "crypto";
import { env, razorpayConfigured } from "../env";

export type CheckoutResult =
  | {
      mode: "razorpay";
      keyId: string;
      subscriptionId: string;
      planCode: string;
    }
  | {
      mode: "missing_credentials";
      message: string;
      planCode: string;
    };

export async function startSubscriptionCheckout(params: {
  planCode: string;
  razorpayPlanId: string | null;
  organisationId: string;
  customerEmail: string;
}): Promise<CheckoutResult> {
  if (!razorpayConfigured()) {
    return {
      mode: "missing_credentials",
      message:
        "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for test-mode checkout. No payment was created.",
      planCode: params.planCode,
    };
  }

  // Server-side only — create Razorpay subscription via REST.
  const auth = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
  if (!params.razorpayPlanId) {
    return {
      mode: "missing_credentials",
      message: `Plan ${params.planCode} has no razorpayPlanId mapped. Create plans in Razorpay dashboard and update subscription_plans.`,
      planCode: params.planCode,
    };
  }

  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      plan_id: params.razorpayPlanId,
      total_count: 12,
      customer_notify: 1,
      notes: {
        organisationId: params.organisationId,
        planCode: params.planCode,
        email: params.customerEmail,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay subscription create failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return {
    mode: "razorpay",
    keyId: env.razorpayKeyId,
    subscriptionId: data.id,
    planCode: params.planCode,
  };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.razorpayWebhookSecret) return false;
  if (!signature) return false;
  const expected = createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!razorpayConfigured()) return false;
  const payload = `${params.orderId}|${params.paymentId}`;
  const expected = createHmac("sha256", env.razorpayKeySecret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
  } catch {
    return false;
  }
}

import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { startSubscriptionCheckout } from "@/lib/billing/razorpay";
import { env, razorpayConfigured } from "@/lib/env";
import { requireStoreContext } from "@/lib/store-context";
import { enforceSubscriptionAccess } from "@/lib/billing/subscription-state";

const schema = z.object({
  planCode: z.enum(["BASIC", "PROFESSIONAL", "ENTERPRISE"]),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user, membership } = await requireStoreContext(req, [
      Role.ORG_OWNER,
      Role.STORE_MANAGER,
    ]);
    if (membership.organisationId === "*") {
      return jsonError("Specify a retailer store for checkout", 400);
    }

    const body = schema.parse(await req.json());
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: body.planCode } });
    if (!plan || !plan.isActive) return jsonError("Plan not found", 404);

    const result = await startSubscriptionCheckout({
      planCode: plan.code,
      razorpayPlanId: plan.razorpayPlanId,
      organisationId: membership.organisationId,
      customerEmail: user.email,
    });

    if (result.mode === "razorpay") {
      await prisma.subscription.update({
        where: { organisationId: membership.organisationId },
        data: {
          planId: plan.id,
          razorpaySubscriptionId: result.subscriptionId,
        },
      });
    }

    return jsonOk({
      ...result,
      configured: razorpayConfigured(),
      razorpayMode: env.razorpayMode,
      checkout: result.mode === "razorpay"
        ? {
            key: result.keyId,
            subscription_id: result.subscriptionId,
            name: "trAIl9 Saree Try-On",
            description: `${plan.name} plan`,
            prefill: { email: user.email, name: user.name },
            theme: { color: "#6B1E2E" },
          }
        : null,
      plan: {
        code: plan.code,
        name: plan.name,
        priceInrPaise: plan.priceInrPaise,
        monthlyCredits: plan.monthlyCredits,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(req: Request) {
  try {
    const { membership } = await requireStoreContext(req);
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceInrPaise: "asc" },
    });
    let subscription =
      membership.organisationId !== "*"
        ? await prisma.subscription.findUnique({
            where: { organisationId: membership.organisationId },
            include: { plan: true },
          })
        : null;
    if (subscription) {
      subscription = await enforceSubscriptionAccess(subscription.id);
    }
    return jsonOk({
      configured: razorpayConfigured(),
      billingMode: razorpayConfigured()
        ? env.razorpayMode === "live"
          ? "razorpay_live"
          : "razorpay_test"
        : "missing_credentials",
      razorpayMode: env.razorpayMode,
      plans,
      subscription,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { startSubscriptionCheckout } from "@/lib/billing/razorpay";
import { razorpayConfigured } from "@/lib/env";

const schema = z.object({
  planCode: z.enum(["BASIC", "PROFESSIONAL", "ENTERPRISE"]),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    const membership = user.memberships[0];
    if (!membership && !user.isSuperAdmin) return jsonError("Forbidden", 403);
    if (!membership) return jsonError("No organisation membership", 400);

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

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    const membership = user.memberships[0];
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceInrPaise: "asc" },
    });
    const subscription = membership
      ? await prisma.subscription.findUnique({
          where: { organisationId: membership.organisationId },
          include: { plan: true },
        })
      : null;
    return jsonOk({
      configured: razorpayConfigured(),
      billingMode: razorpayConfigured() ? "razorpay_test" : "missing_credentials",
      plans,
      subscription,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

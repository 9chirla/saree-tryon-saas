import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    if (!verifyWebhookSignature(rawBody, signature)) {
      return jsonError("Invalid webhook signature", 401);
    }

    const event = JSON.parse(rawBody) as {
      id?: string;
      event: string;
      payload: {
        subscription?: { entity: { id: string; notes?: { organisationId?: string; planCode?: string } } };
        payment?: { entity: { id: string; amount: number; status: string } };
      };
    };

    const providerEventId = event.id ?? `${event.event}:${Date.now()}`;
    const existing = await prisma.billingEvent.findUnique({
      where: { provider_providerEventId: { provider: "razorpay", providerEventId } },
    });
    if (existing) {
      return jsonOk({ ok: true, duplicate: true });
    }

    await prisma.billingEvent.create({
      data: {
        provider: "razorpay",
        providerEventId,
        eventType: event.event,
        payload: event as object,
      },
    });

    if (
      event.event === "subscription.activated" ||
      event.event === "subscription.charged"
    ) {
      const subEntity = event.payload.subscription?.entity;
      if (subEntity?.id) {
        const sub = await prisma.subscription.findFirst({
          where: { razorpaySubscriptionId: subEntity.id },
          include: { plan: true, organisation: { include: { stores: { take: 1 } } } },
        });
        if (sub) {
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
              creditsRemaining: sub.plan.monthlyCredits,
              creditsPeriodTotal: sub.plan.monthlyCredits,
            },
          });
          const store = sub.organisation.stores[0];
          if (store) {
            await prisma.creditTransaction.create({
              data: {
                storeId: store.id,
                organisationId: sub.organisationId,
                type: "GRANT",
                amount: sub.plan.monthlyCredits,
                balanceAfter: sub.plan.monthlyCredits,
                reason: `razorpay:${event.event}`,
              },
            });
          }
          if (event.payload.payment?.entity) {
            await prisma.payment.create({
              data: {
                subscriptionId: sub.id,
                amountPaise: event.payload.payment.entity.amount,
                status: "SUCCEEDED",
                providerPaymentId: event.payload.payment.entity.id,
              },
            });
          }
        }
      }
    }

    if (event.event === "subscription.cancelled") {
      const subEntity = event.payload.subscription?.entity;
      if (subEntity?.id) {
        await prisma.subscription.updateMany({
          where: { razorpaySubscriptionId: subEntity.id },
          data: { status: SubscriptionStatus.CANCELLED },
        });
      }
    }

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

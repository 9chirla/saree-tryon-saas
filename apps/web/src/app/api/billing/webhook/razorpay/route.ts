import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { env } from "@/lib/env";

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
        subscription?: {
          entity: { id: string; notes?: { organisationId?: string; planCode?: string } };
        };
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
              graceUntil: null,
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
          if (event.payload.payment?.entity?.status === "captured" || event.payload.payment?.entity) {
            // Only record SUCCEEDED when provider entity indicates success — never fabricate.
            const payStatus = event.payload.payment.entity.status;
            if (!payStatus || payStatus === "captured" || payStatus === "authorized") {
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
    }

    if (
      event.event === "subscription.pending" ||
      event.event === "subscription.halted" ||
      event.event === "payment.failed"
    ) {
      const subEntity = event.payload.subscription?.entity;
      if (subEntity?.id) {
        const sub = await prisma.subscription.findFirst({
          where: { razorpaySubscriptionId: subEntity.id },
        });
        if (sub) {
          const graceUntil = new Date(
            Date.now() + env.billingGraceDays * 86400_000,
          );
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: SubscriptionStatus.PAST_DUE,
              graceUntil: sub.graceUntil ?? graceUntil,
            },
          });
        }
      }
      if (event.payload.payment?.entity) {
        const sub = await prisma.subscription.findFirst({
          where: {
            razorpaySubscriptionId: event.payload.subscription?.entity?.id ?? "",
          },
        });
        if (sub) {
          await prisma.payment.create({
            data: {
              subscriptionId: sub.id,
              amountPaise: event.payload.payment.entity.amount,
              status: "FAILED",
              providerPaymentId: event.payload.payment.entity.id,
            },
          });
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

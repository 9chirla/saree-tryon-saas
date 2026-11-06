import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";

/**
 * Enforce grace period and PAST_DUE / EXPIRED transitions.
 * Returns the (possibly updated) subscription row.
 */
export async function enforceSubscriptionAccess(subscriptionId: string) {
  let sub = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  const now = new Date();

  if (
    sub.status === SubscriptionStatus.CANCELLED ||
    sub.status === SubscriptionStatus.EXPIRED
  ) {
    return sub;
  }

  // Period ended → enter or continue grace, then expire
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
    if (sub.status === SubscriptionStatus.PAST_DUE) {
      if (sub.graceUntil && sub.graceUntil < now) {
        sub = await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.EXPIRED },
          include: { plan: true },
        });
      }
      return sub;
    }

    if (
      sub.status === SubscriptionStatus.ACTIVE ||
      sub.status === SubscriptionStatus.DEMO ||
      sub.status === SubscriptionStatus.TRIALING
    ) {
      const graceUntil =
        sub.graceUntil ??
        new Date(sub.currentPeriodEnd.getTime() + env.billingGraceDays * 86400_000);
      sub = await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.PAST_DUE, graceUntil },
        include: { plan: true },
      });
      if (graceUntil < now) {
        sub = await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.EXPIRED },
          include: { plan: true },
        });
      }
    }
  }

  return sub;
}

export function subscriptionAllowsTryOn(status: SubscriptionStatus): boolean {
  return (
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.DEMO ||
    status === SubscriptionStatus.TRIALING ||
    status === SubscriptionStatus.PAST_DUE
  );
}

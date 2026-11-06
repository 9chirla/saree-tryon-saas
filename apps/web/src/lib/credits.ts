import { CreditTxnType, Prisma } from "@prisma/client";
import { prisma } from "./db";

/** Deduct one credit only on successful try-on; unique on tryonJobId prevents duplicates. */
export async function deductCreditForSuccess(params: {
  organisationId: string;
  storeId: string;
  tryonJobId: string;
  amount?: number;
}) {
  const amount = params.amount ?? 1;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({
      where: { tryonJobId: params.tryonJobId },
    });
    if (existing) {
      return { alreadyDeducted: true, balance: existing.balanceAfter, restored: false };
    }

    const sub = await tx.subscription.findUnique({
      where: { organisationId: params.organisationId },
    });
    if (!sub) {
      throw new Error("No subscription for organisation");
    }
    if (sub.creditsRemaining < amount) {
      throw new Error("Insufficient credits");
    }

    const updated = await tx.subscription.update({
      where: { id: sub.id },
      data: { creditsRemaining: { decrement: amount } },
    });

    await tx.creditTransaction.create({
      data: {
        storeId: params.storeId,
        organisationId: params.organisationId,
        type: CreditTxnType.DEDUCT,
        amount: -amount,
        balanceAfter: updated.creditsRemaining,
        reason: "tryon_success",
        tryonJobId: params.tryonJobId,
      },
    });

    await tx.tryOnJob.update({
      where: { id: params.tryonJobId },
      data: { creditsCharged: amount },
    });

    return { alreadyDeducted: false, balance: updated.creditsRemaining, restored: false };
  });
}

/**
 * Restore credits after a qualifying failure when a deduction already occurred
 * (e.g. provider reported success then result fetch permanently failed).
 * Idempotent via reason+tryonJobId unique check on RESTORE rows.
 */
export async function restoreCreditForQualifyingFailure(params: {
  organisationId: string;
  storeId: string;
  tryonJobId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const deduct = await tx.creditTransaction.findFirst({
      where: { tryonJobId: params.tryonJobId, type: CreditTxnType.DEDUCT },
    });
    if (!deduct) {
      return { restored: false, reason: "no_prior_deduction" as const };
    }

    const restoreReasonPrefix = `restore:${params.tryonJobId}:`;
    const already = await tx.creditTransaction.findFirst({
      where: {
        type: CreditTxnType.RESTORE,
        reason: { startsWith: restoreReasonPrefix },
      },
    });
    if (already) {
      return { restored: false, reason: "already_restored" as const, balance: already.balanceAfter };
    }

    const amount = Math.abs(deduct.amount);
    const updated = await tx.subscription.update({
      where: { organisationId: params.organisationId },
      data: { creditsRemaining: { increment: amount } },
    });

    // tryonJobId is @unique and already used by DEDUCT — restore links via reason string.
    await tx.creditTransaction.create({
      data: {
        storeId: params.storeId,
        organisationId: params.organisationId,
        type: CreditTxnType.RESTORE,
        amount,
        balanceAfter: updated.creditsRemaining,
        reason: `${restoreReasonPrefix}${params.reason}`,
      },
    });

    await tx.tryOnJob.update({
      where: { id: params.tryonJobId },
      data: { creditsCharged: 0 },
    });

    return { restored: true, balance: updated.creditsRemaining };
  });
}

export async function grantCredits(params: {
  organisationId: string;
  storeId: string;
  amount: number;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.update({
      where: { organisationId: params.organisationId },
      data: {
        creditsRemaining: { increment: params.amount },
        creditsPeriodTotal: { increment: params.amount },
      },
    });
    await tx.creditTransaction.create({
      data: {
        storeId: params.storeId,
        organisationId: params.organisationId,
        type: CreditTxnType.GRANT,
        amount: params.amount,
        balanceAfter: sub.creditsRemaining,
        reason: params.reason,
      },
    });
    return sub.creditsRemaining;
  });
}

export type TxClient = Prisma.TransactionClient;

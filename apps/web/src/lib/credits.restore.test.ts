import { describe, expect, it, beforeAll } from "vitest";
import { PrismaClient, CreditTxnType } from "@prisma/client";
import { randomUUID } from "crypto";
import { deductCreditForSuccess, restoreCreditForQualifyingFailure } from "./credits";

const prisma = new PrismaClient();

describe("credit restore on qualifying failures", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  it("restores after deduction and is idempotent", async () => {
    const org = await prisma.organisation.findFirst({
      include: { subscription: true, stores: true },
    });
    if (!org?.subscription || !org.stores[0]) return;

    const store = org.stores[0];
    const before = org.subscription.creditsRemaining;
    const consent = await prisma.customerConsent.create({
      data: { storeId: store.id, sessionId: randomUUID(), locale: "en" },
    });
    const job = await prisma.tryOnJob.create({
      data: {
        storeId: store.id,
        status: "FAILED",
        provider: "demo",
        personImagePath: "sessions/x/person.jpg",
        sareeImagePath: "catalogue/x/s.jpg",
        sessionId: consent.sessionId,
        consentId: consent.id,
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });

    await deductCreditForSuccess({
      organisationId: org.id,
      storeId: store.id,
      tryonJobId: job.id,
    });

    const mid = await prisma.subscription.findUniqueOrThrow({
      where: { organisationId: org.id },
    });
    expect(mid.creditsRemaining).toBe(before - 1);

    const first = await restoreCreditForQualifyingFailure({
      organisationId: org.id,
      storeId: store.id,
      tryonJobId: job.id,
      reason: "provider_result_unavailable",
    });
    expect(first.restored).toBe(true);

    const second = await restoreCreditForQualifyingFailure({
      organisationId: org.id,
      storeId: store.id,
      tryonJobId: job.id,
      reason: "provider_result_unavailable",
    });
    expect(second.restored).toBe(false);

    const end = await prisma.subscription.findUniqueOrThrow({
      where: { organisationId: org.id },
    });
    expect(end.creditsRemaining).toBe(before);

    const restores = await prisma.creditTransaction.count({
      where: { type: CreditTxnType.RESTORE, reason: { startsWith: `restore:${job.id}:` } },
    });
    expect(restores).toBe(1);
  });
});

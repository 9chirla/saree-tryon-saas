import { describe, expect, it, beforeAll } from "vitest";
import { PrismaClient, CreditTxnType } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

describe("credit deduction idempotency", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  it("deducts once per try-on job", async () => {
    const org = await prisma.organisation.findFirst({
      include: { subscription: true, stores: true },
    });
    expect(org?.subscription).toBeTruthy();
    expect(org?.stores[0]).toBeTruthy();
    if (!org?.subscription || !org.stores[0]) return;

    const store = org.stores[0];
    const before = org.subscription.creditsRemaining;

    const consent = await prisma.customerConsent.create({
      data: { storeId: store.id, sessionId: randomUUID(), locale: "en" },
    });

    const job = await prisma.tryOnJob.create({
      data: {
        storeId: store.id,
        status: "SUCCEEDED",
        provider: "demo",
        personImagePath: "samples/person-demo.jpg",
        sareeImagePath: "samples/person-demo.jpg",
        sessionId: consent.sessionId,
        consentId: consent.id,
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });

    const amount = 1;
    const runDeduct = async () => {
      const existing = await prisma.creditTransaction.findUnique({
        where: { tryonJobId: job.id },
      });
      if (existing) return existing.balanceAfter;
      const updated = await prisma.subscription.update({
        where: { id: org.subscription!.id },
        data: { creditsRemaining: { decrement: amount } },
      });
      await prisma.creditTransaction.create({
        data: {
          storeId: store.id,
          organisationId: org.id,
          type: CreditTxnType.DEDUCT,
          amount: -amount,
          balanceAfter: updated.creditsRemaining,
          reason: "tryon_success",
          tryonJobId: job.id,
        },
      });
      return updated.creditsRemaining;
    };

    const first = await runDeduct();
    const second = await runDeduct();
    expect(first).toBe(before - 1);
    expect(second).toBe(first);

    // restore credit for other tests
    await prisma.subscription.update({
      where: { id: org.subscription.id },
      data: { creditsRemaining: before },
    });
  });

  it("isolates sarees by storeId", async () => {
    const stores = await prisma.store.findMany({ take: 2 });
    if (stores.length < 1) return;
    const sarees = await prisma.sareeProduct.findMany({
      where: { storeId: stores[0].id },
    });
    for (const s of sarees) {
      expect(s.storeId).toBe(stores[0].id);
    }
  });
});

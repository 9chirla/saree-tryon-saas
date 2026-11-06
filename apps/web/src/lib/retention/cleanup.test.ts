import { describe, expect, it, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { runRetentionCleanup } from "./cleanup";
import { env } from "../env";

const prisma = new PrismaClient();

describe("retention cleanup", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  it("anonymises expired session images", async () => {
    const store = await prisma.store.findFirst();
    if (!store) return;

    const sessionId = randomUUID();
    const rel = `sessions/${store.id}/${sessionId}/person/expired-test.jpg`;
    const abs = path.join(env.uploadDir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    const consent = await prisma.customerConsent.create({
      data: { storeId: store.id, sessionId, locale: "en" },
    });

    const job = await prisma.tryOnJob.create({
      data: {
        storeId: store.id,
        status: "SUCCEEDED",
        provider: "demo",
        personImagePath: rel,
        sareeImagePath: `catalogue/${store.id}/keep.jpg`,
        sessionId,
        consentId: consent.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const result = await runRetentionCleanup({ now: new Date(), batchSize: 50 });
    expect(result.jobsScanned).toBeGreaterThanOrEqual(1);

    const updated = await prisma.tryOnJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.personImagePath).toBe("deleted");
    // Catalogue path must not be wiped
    expect(updated.sareeImagePath).toContain("catalogue/");
  });
});

import { describe, expect, it, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { runRetentionCleanup } from "./cleanup";
import { env, s3Configured } from "../env";
import { S3StorageProvider } from "../storage/s3-provider";

const prisma = new PrismaClient();

/** Ready when founder has provisioned S3_* credentials (see docs/DEPLOYMENT.md). */
const s3DeleteTestEnabled = s3Configured();

const S3_SKIP_MESSAGE =
  "SKIPPED: S3 retention delete test — S3_* env vars not set.\n" +
  "Set S3_ENDPOINT, S3_BUCKET_CUSTOMER, S3_ACCESS_KEY_ID,\n" +
  "S3_SECRET_ACCESS_KEY to enable.";

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

  it("deletes customer session object via S3 DeleteObject (retention path)", async ({ skip }) => {
    if (!s3DeleteTestEnabled) {
      // Loud skip — must appear in default (non-verbose) Vitest output.
      console.warn(S3_SKIP_MESSAGE);
      skip();
      return;
    }

    // Exercises S3StorageProvider.delete — the same deleteUpload path retention uses.
    const storage = new S3StorageProvider();
    const prefix = `sessions/retention-s3-test/${randomUUID()}`;
    const stored = await storage.put(
      "customer",
      prefix,
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      "image/jpeg",
    );
    expect(stored.key.startsWith("s3:")).toBe(true);
    expect(await storage.exists(stored.key)).toBe(true);
    await storage.delete(stored.key);
    expect(await storage.exists(stored.key)).toBe(false);
  });
});


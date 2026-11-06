import { z } from "zod";
import { TryOnStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertSameOrigin, clientIp, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { existsUpload } from "@/lib/storage";
import { getTryOnProvider } from "@/lib/tryon";

const schema = z.object({
  sessionId: z.string().uuid(),
  consentId: z.string().uuid(),
  personImagePath: z.string().min(3),
  sareeImagePath: z.string().min(3).optional(),
  sareeId: z.string().uuid().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ storeSlug: string }> },
) {
  try {
    assertSameOrigin(req);
    const { storeSlug } = await ctx.params;
    if (!rateLimit(`kiosk-tryon:${storeSlug}:${clientIp(req)}`, env.kioskRateLimitPerMin)) {
      return jsonError("Too many requests", 429);
    }
    const body = schema.parse(await req.json());

    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      include: { organisation: { include: { subscription: true } }, settings: true },
    });
    if (!store || !store.isActive) return jsonError("Store not found", 404);

    const consent = await prisma.customerConsent.findFirst({
      where: { id: body.consentId, storeId: store.id, sessionId: body.sessionId },
    });
    if (!consent) return jsonError("Consent required", 403);

    const sub = store.organisation.subscription;
    if (!sub || sub.creditsRemaining < 1) {
      return jsonError("Store has no remaining try-on credits", 402);
    }

    let sareeImagePath = body.sareeImagePath;
    const sareeId = body.sareeId ?? null;
    if (sareeId) {
      const saree = await prisma.sareeProduct.findFirst({
        where: { id: sareeId, storeId: store.id, isActive: true },
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      });
      if (!saree || !saree.images[0]) return jsonError("Saree not found", 404);
      sareeImagePath = saree.images[0].path;
    }
    if (!sareeImagePath) return jsonError("sareeId or sareeImagePath required");

    if (!(await existsUpload(body.personImagePath))) {
      return jsonError("Person image missing", 400);
    }
    if (!(await existsUpload(sareeImagePath))) {
      return jsonError("Saree image missing", 400);
    }

    // Tenant path check — uploads must belong to this store session prefix or catalogue.
    const personOk =
      body.personImagePath.startsWith(`sessions/${store.id}/`) ||
      body.personImagePath.startsWith("samples/");
    const sareeOk =
      sareeImagePath.startsWith(`sessions/${store.id}/`) ||
      sareeImagePath.startsWith(`catalogue/${store.id}/`);
    if (!personOk || !sareeOk) return jsonError("Invalid image path for store", 403);

    const retentionHours = store.settings?.retentionHours ?? env.defaultRetentionHours;
    const expiresAt = new Date(Date.now() + retentionHours * 3600_000);

    const job = await prisma.tryOnJob.create({
      data: {
        storeId: store.id,
        sareeId,
        status: TryOnStatus.QUEUED,
        provider: env.tryonProvider,
        personImagePath: body.personImagePath,
        sareeImagePath,
        consentId: consent.id,
        sessionId: body.sessionId,
        expiresAt,
      },
    });

    const provider = getTryOnProvider();
    try {
      const ref = await provider.generateTryOn({
        jobId: job.id,
        personImagePath: body.personImagePath,
        sareeImagePath,
        storeId: store.id,
      });
      await prisma.tryOnJob.update({
        where: { id: job.id },
        data: {
          providerJobId: ref.providerJobId,
          status: ref.status as TryOnStatus,
        },
      });
      return jsonOk({
        jobId: job.id,
        status: ref.status,
        provider: provider.name,
      }, 201);
    } catch (err) {
      await prisma.tryOnJob.update({
        where: { id: job.id },
        data: {
          status: TryOnStatus.FAILED,
          errorMessage: err instanceof Error ? err.message : "Provider error",
          completedAt: new Date(),
        },
      });
      return jsonError(err instanceof Error ? err.message : "Try-on failed to start", 502, {
        jobId: job.id,
      });
    }
  } catch (err) {
    return handleRouteError(err);
  }
}

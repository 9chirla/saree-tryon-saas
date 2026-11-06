import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, clientIp, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const schema = z.object({
  locale: z.enum(["en", "te", "hi"]).default("en"),
  sessionId: z.string().uuid().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ storeSlug: string }> },
) {
  try {
    assertSameOrigin(req);
    const { storeSlug } = await ctx.params;
    const ip = clientIp(req);
    if (!rateLimit(`kiosk:${storeSlug}:${ip}`, env.kioskRateLimitPerMin)) {
      return jsonError("Too many requests", 429);
    }
    const body = schema.parse(await req.json());
    const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store || !store.isActive) return jsonError("Store not found", 404);

    const sessionId = body.sessionId ?? randomUUID();
    const consent = await prisma.customerConsent.create({
      data: {
        storeId: store.id,
        sessionId,
        locale: body.locale,
        ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 16),
        userAgent: req.headers.get("user-agent")?.slice(0, 240) ?? null,
      },
    });

    return jsonOk({ consentId: consent.id, sessionId, acceptedAt: consent.acceptedAt });
  } catch (err) {
    return handleRouteError(err);
  }
}

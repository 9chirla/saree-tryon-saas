import { prisma } from "@/lib/db";
import { assertSameOrigin, clientIp, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { detectImageMime, extForMime, saveUpload, signPath } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ storeSlug: string }> },
) {
  try {
    assertSameOrigin(req);
    const { storeSlug } = await ctx.params;
    const ip = clientIp(req);
    if (!rateLimit(`kiosk-upload:${storeSlug}:${ip}`, env.kioskRateLimitPerMin)) {
      return jsonError("Too many requests", 429);
    }

    const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store || !store.isActive) return jsonError("Store not found", 404);

    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "person");
    const sessionId = String(form.get("sessionId") ?? "");
    if (!(file instanceof File)) return jsonError("file required");
    if (!sessionId) return jsonError("sessionId required");
    if (!["person", "saree"].includes(kind)) return jsonError("kind must be person|saree");
    if (file.size > MAX_BYTES) return jsonError("Image too large (max 8MB)", 413);

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = detectImageMime(buf);
    if (!mime) return jsonError("Invalid image (JPEG/PNG/WebP only)", 415);

    const relative = await saveUpload(
      `sessions/${store.id}/${sessionId}/${kind}`,
      buf,
      extForMime(mime),
    );
    const signed = signPath(relative);

    return jsonOk({
      path: relative,
      url: `/api/media?path=${encodeURIComponent(signed.path)}&exp=${signed.exp}&sig=${signed.sig}`,
      kind,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

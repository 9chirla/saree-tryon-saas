import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { detectImageMime, extForMime, saveUpload, signedMediaUrl, signPath } from "@/lib/storage";
import { requireStoreContext } from "@/lib/store-context";

async function mediaUrl(key: string) {
  if (key.startsWith("s3:")) return signedMediaUrl(key);
  const signed = signPath(key);
  return `/api/media?path=${encodeURIComponent(signed.path)}&exp=${signed.exp}&sig=${signed.sig}`;
}

export async function GET(req: Request) {
  try {
    const { membership } = await requireStoreContext(req);
    const sarees = await prisma.sareeProduct.findMany({
      where: { storeId: membership.storeId },
      include: { images: { orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    return jsonOk({
      storeId: membership.storeId,
      sarees: await Promise.all(
        sarees.map(async (s) => ({
          ...s,
          images: await Promise.all(
            s.images.map(async (img) => ({
              ...img,
              url: await mediaUrl(img.path),
            })),
          ),
        })),
      ),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(160),
  sku: z.string().max(64).optional(),
  description: z.string().max(2000).optional(),
  fabric: z.string().max(80).optional(),
  color: z.string().max(80).optional(),
  occasion: z.string().max(80).optional(),
  priceInr: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { membership } = await requireStoreContext(req, [
      Role.ORG_OWNER,
      Role.STORE_MANAGER,
    ]);

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const parsed = createSchema.parse({
        name: form.get("name"),
        sku: form.get("sku") || undefined,
        description: form.get("description") || undefined,
        fabric: form.get("fabric") || undefined,
        color: form.get("color") || undefined,
        occasion: form.get("occasion") || undefined,
        priceInr: form.get("priceInr") ? Number(form.get("priceInr")) : undefined,
      });
      const file = form.get("image");
      let imagePath: string | undefined;
      if (file instanceof File && file.size > 0) {
        if (file.size > 8 * 1024 * 1024) return jsonError("Image too large (max 8MB)", 413);
        const buf = Buffer.from(await file.arrayBuffer());
        const mime = detectImageMime(buf);
        if (!mime) return jsonError("Invalid image", 415);
        imagePath = await saveUpload(
          `catalogue/${membership.storeId}`,
          buf,
          extForMime(mime),
          "catalogue",
        );
      }
      const saree = await prisma.sareeProduct.create({
        data: {
          storeId: membership.storeId,
          ...parsed,
          images: imagePath ? { create: [{ path: imagePath }] } : undefined,
        },
        include: { images: true },
      });
      return jsonOk({ saree }, 201);
    }

    const body = createSchema.parse(await req.json());
    const saree = await prisma.sareeProduct.create({
      data: { storeId: membership.storeId, ...body },
    });
    return jsonOk({ saree }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

import { z } from "zod";
import { Role } from "@prisma/client";
import { assertStoreAccess, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { detectImageMime, extForMime, saveUpload, signPath } from "@/lib/storage";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    const membership = user.memberships[0];
    if (!membership && !user.isSuperAdmin) return jsonError("Forbidden", 403);
    const storeId = membership?.storeId;
    if (!storeId) return jsonError("No store", 400);

    const sarees = await prisma.sareeProduct.findMany({
      where: { storeId },
      include: { images: { orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    return jsonOk({
      sarees: sarees.map((s) => ({
        ...s,
        images: s.images.map((img) => {
          const signed = signPath(img.path);
          return {
            ...img,
            url: `/api/media?path=${encodeURIComponent(signed.path)}&exp=${signed.exp}&sig=${signed.sig}`,
          };
        }),
      })),
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
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    const membership = user.memberships[0];
    if (!membership) return jsonError("Forbidden", 403);
    assertStoreAccess(user, membership.storeId, [Role.ORG_OWNER, Role.STORE_MANAGER]);

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
        const buf = Buffer.from(await file.arrayBuffer());
        const mime = detectImageMime(buf);
        if (!mime) return jsonError("Invalid image", 415);
        imagePath = await saveUpload(
          `catalogue/${membership.storeId}`,
          buf,
          extForMime(mime),
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

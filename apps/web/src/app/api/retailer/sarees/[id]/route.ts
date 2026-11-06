import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { requireStoreContext } from "@/lib/store-context";

const updateSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  sku: z.string().max(64).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  fabric: z.string().max(80).nullable().optional(),
  color: z.string().max(80).nullable().optional(),
  occasion: z.string().max(80).nullable().optional(),
  priceInr: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(req);
    const { membership } = await requireStoreContext(req, [
      Role.ORG_OWNER,
      Role.STORE_MANAGER,
    ]);
    const { id } = await ctx.params;
    const existing = await prisma.sareeProduct.findFirst({
      where: { id, storeId: membership.storeId },
    });
    if (!existing) return jsonError("Not found", 404);
    const body = updateSchema.parse(await req.json());
    const saree = await prisma.sareeProduct.update({ where: { id }, data: body });
    return jsonOk({ saree });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(req);
    const { membership } = await requireStoreContext(req, [
      Role.ORG_OWNER,
      Role.STORE_MANAGER,
    ]);
    const { id } = await ctx.params;
    const existing = await prisma.sareeProduct.findFirst({
      where: { id, storeId: membership.storeId },
    });
    if (!existing) return jsonError("Not found", 404);
    await prisma.sareeProduct.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

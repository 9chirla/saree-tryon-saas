import { z } from "zod";
import { Role } from "@prisma/client";
import { assertStoreAccess, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    const membership = user.memberships[0];
    if (!membership) return jsonError("Forbidden", 403);
    const settings = await prisma.storeSettings.findUnique({
      where: { storeId: membership.storeId },
    });
    return jsonOk({ settings });
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({
  primaryColor: z.string().max(20).optional(),
  accentColor: z.string().max(20).optional(),
  defaultLocale: z.enum(["en", "te", "hi"]).optional(),
  retentionHours: z.number().int().min(1).max(168).optional(),
  welcomeMessage: z.string().max(500).nullable().optional(),
  privacyNotice: z.string().max(1000).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    const membership = user.memberships[0];
    if (!membership) return jsonError("Forbidden", 403);
    assertStoreAccess(user, membership.storeId, [Role.ORG_OWNER, Role.STORE_MANAGER]);
    const body = schema.parse(await req.json());
    const settings = await prisma.storeSettings.upsert({
      where: { storeId: membership.storeId },
      create: { storeId: membership.storeId, ...body },
      update: body,
    });
    return jsonOk({ settings });
  } catch (err) {
    return handleRouteError(err);
  }
}

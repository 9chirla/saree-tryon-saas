import { z } from "zod";
import { cookies } from "next/headers";
import {
  ACTIVE_STORE_COOKIE,
  assertStoreAccess,
  getSessionUser,
  setActiveStoreCookie,
} from "@/lib/auth";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    const jar = await cookies();
    const cookieStore = jar.get(ACTIVE_STORE_COOKIE)?.value;
    const activeStoreId =
      (cookieStore && user.memberships.some((m) => m.storeId === cookieStore)
        ? cookieStore
        : user.memberships[0]?.storeId) ?? null;
    return jsonOk({
      stores: user.memberships.map((m) => ({
        id: m.storeId,
        name: m.storeName,
        slug: m.storeSlug,
        role: m.role,
        organisationId: m.organisationId,
      })),
      activeStoreId,
      isSuperAdmin: user.isSuperAdmin,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({ storeId: z.string().uuid() });

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    const body = schema.parse(await req.json());
    assertStoreAccess(user, body.storeId);
    await setActiveStoreCookie(body.storeId);
    return jsonOk({ ok: true, storeId: body.storeId });
  } catch (err) {
    return handleRouteError(err);
  }
}

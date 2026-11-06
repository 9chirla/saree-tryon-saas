import { Role } from "@prisma/client";
import {
  AuthError,
  getSessionUser,
  resolveActiveStore,
  type SessionUser,
  type StoreMembership,
} from "./auth";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Unauthorized", 401);
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isSuperAdmin) throw new AuthError("Forbidden", 403);
  return user;
}

export async function requireStoreContext(
  req: Request,
  roles?: Role[],
): Promise<{ user: SessionUser; membership: StoreMembership }> {
  const user = await requireUser();
  const url = new URL(req.url);
  const storeId =
    req.headers.get("x-store-id") ||
    url.searchParams.get("storeId") ||
    undefined;
  const membership = await resolveActiveStore(user, { storeId });
  if (roles && !user.isSuperAdmin && !roles.includes(membership.role)) {
    throw new AuthError("Forbidden: insufficient role", 403);
  }
  return { user, membership };
}

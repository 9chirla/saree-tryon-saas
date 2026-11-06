import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";

export const SESSION_COOKIE = "trail9_session";
export const ACTIVE_STORE_COOKIE = "trail9_active_store";

const key = () => new TextEncoder().encode(env.sessionSecret);

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  memberships: {
    storeId: string;
    organisationId: string;
    role: Role;
    storeSlug: string;
    storeName: string;
  }[];
};

export type StoreMembership = SessionUser["memberships"][number];

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, isSuperAdmin = false) {
  const token = await new SignJWT({ sub: userId, isa: isSuperAdmin ? 1 : 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(ACTIVE_STORE_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const userId = payload.sub;
    if (!userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            store: { select: { id: true, slug: true, organisationId: true, name: true } },
          },
        },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      memberships: user.memberships.map((m) => ({
        storeId: m.storeId,
        organisationId: m.store.organisationId,
        role: m.role,
        storeSlug: m.store.slug,
        storeName: m.store.name,
      })),
    };
  } catch {
    return null;
  }
}

export function assertStoreAccess(
  user: SessionUser,
  storeId: string,
  roles?: Role[],
): StoreMembership {
  if (user.isSuperAdmin) {
    return {
      storeId,
      organisationId: "*",
      role: Role.SUPER_ADMIN,
      storeSlug: "",
      storeName: "",
    };
  }
  const membership = user.memberships.find((m) => m.storeId === storeId);
  if (!membership) {
    throw new AuthError("Forbidden: no store access", 403);
  }
  if (roles && !roles.includes(membership.role)) {
    throw new AuthError("Forbidden: insufficient role", 403);
  }
  return membership;
}

/**
 * Resolve active store from explicit header/query/cookie — never silently use memberships[0]
 * without allowing the client to select among memberships.
 */
export async function resolveActiveStore(
  user: SessionUser,
  opts?: { storeId?: string | null; preferCookie?: boolean },
): Promise<StoreMembership> {
  const jar = await cookies();
  const requested =
    opts?.storeId ||
    (opts?.preferCookie !== false ? jar.get(ACTIVE_STORE_COOKIE)?.value : undefined);

  if (requested) {
    return assertStoreAccess(user, requested);
  }

  if (user.memberships.length === 1) {
    return user.memberships[0];
  }

  if (user.memberships.length === 0) {
    if (user.isSuperAdmin) {
      throw new AuthError("Super-admin must specify storeId for store-scoped actions", 400);
    }
    throw new AuthError("No store membership", 403);
  }

  throw new AuthError(
    "Multiple stores available; pass x-store-id header or set active store",
    400,
  );
}

export async function setActiveStoreCookie(storeId: string) {
  const jar = await cookies();
  jar.set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";

const COOKIE = "trail9_session";
const key = () => new TextEncoder().encode(env.sessionSecret);

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  memberships: { storeId: string; organisationId: string; role: Role; storeSlug: string }[];
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const userId = payload.sub;
    if (!userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { store: { select: { id: true, slug: true, organisationId: true } } },
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
): { storeId: string; organisationId: string; role: Role } {
  if (user.isSuperAdmin) {
    return { storeId, organisationId: "*", role: Role.SUPER_ADMIN };
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

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

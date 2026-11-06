import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "trail9_session";

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Middleware cannot import env.ts (edge); require SESSION_SECRET in all envs for protected routes.
    return null;
  }
  return new TextEncoder().encode(secret);
}

async function verifySession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const key = sessionKey();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as { sub?: string; isa?: number };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");
  const isAdmin = pathname.startsWith("/admin");
  if (!isDashboard && !isAdmin) {
    return NextResponse.next();
  }

  const session = await verifySession(req);
  if (!session?.sub) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isAdmin && session.isa !== 1) {
    // Non-admin session hitting /admin — send to retailer dashboard
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};

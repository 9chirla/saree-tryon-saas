import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.message, err.status);
  }
  if (err instanceof ZodError) {
    return jsonError("Validation failed", 400, { issues: err.issues });
  }
  console.error("[api]", err instanceof Error ? err.message : err);
  return jsonError(err instanceof Error ? err.message : "Internal error", 500);
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const app = process.env.APP_URL ?? "http://localhost:3000";
  const allowed = new URL(app).origin;
  if (origin !== allowed && !origin.startsWith("http://localhost:")) {
    throw new AuthError("CSRF: origin mismatch", 403);
  }
}

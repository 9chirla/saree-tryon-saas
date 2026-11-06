import { NextResponse } from "next/server";
import { detectImageMime, getStorage, readUpload, verifySignedPath } from "@/lib/storage";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  const exp = Number(url.searchParams.get("exp") ?? "0");
  const sig = url.searchParams.get("sig") ?? "";
  if (!path) {
    return NextResponse.json({ error: "Invalid signed URL" }, { status: 400 });
  }

  // S3 keys: redirect to short-lived provider URL (never permanent public)
  if (path.startsWith("s3:")) {
    try {
      const signed = await getStorage().getSignedUrl(path, env.signedUrlTtlSeconds);
      return NextResponse.redirect(signed, 302);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (!sig || !exp || !verifySignedPath(path, exp, sig)) {
    return NextResponse.json({ error: "Expired or invalid signature" }, { status: 403 });
  }
  try {
    const buf = await readUpload(path);
    const mime = detectImageMime(buf) ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": mime,
        "cache-control": "private, max-age=60",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

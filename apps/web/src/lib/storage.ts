import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { mkdir, writeFile, readFile, unlink, access } from "fs/promises";
import path from "path";
import { env } from "./env";

const IMAGE_MAGIC: { mime: string; bytes: number[] }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

export function detectImageMime(buf: Buffer): string | null {
  for (const m of IMAGE_MAGIC) {
    if (m.bytes.every((b, i) => buf[i] === b)) {
      if (m.mime === "image/webp" && buf.toString("ascii", 8, 12) !== "WEBP") continue;
      return m.mime;
    }
  }
  return null;
}

export async function ensureUploadRoot() {
  await mkdir(env.uploadDir, { recursive: true });
}

export async function saveUpload(
  relativeDir: string,
  data: Buffer,
  ext: string,
): Promise<string> {
  await ensureUploadRoot();
  const dir = path.join(env.uploadDir, relativeDir);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  const full = path.join(dir, filename);
  await writeFile(full, data);
  return path.join(relativeDir, filename).replace(/\\/g, "/");
}

export function absolutePath(relative: string) {
  const resolved = path.resolve(env.uploadDir, relative);
  if (!resolved.startsWith(path.resolve(env.uploadDir))) {
    throw new Error("Invalid path");
  }
  return resolved;
}

export async function readUpload(relative: string) {
  return readFile(absolutePath(relative));
}

export async function deleteUpload(relative: string) {
  try {
    await unlink(absolutePath(relative));
  } catch {
    /* ignore */
  }
}

export async function existsUpload(relative: string) {
  try {
    await access(absolutePath(relative));
    return true;
  } catch {
    return false;
  }
}

export function signPath(relative: string, ttlSeconds = env.signedUrlTtlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${relative}:${exp}`;
  const sig = createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
  return { path: relative, exp, sig };
}

export function verifySignedPath(relative: string, exp: number, sig: string) {
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${relative}:${exp}`;
  const expected = createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export function extForMime(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

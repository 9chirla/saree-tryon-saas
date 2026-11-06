import { createHmac } from "crypto";
import path from "path";
import { mkdir } from "fs/promises";
import { env, s3Configured } from "../env";
import { LocalStorageProvider, verifyLocalSignedPath } from "./local-provider";
import { S3StorageProvider } from "./s3-provider";
import type { ObjectStorageProvider, StorageKind } from "./types";

export type { ObjectStorageProvider, StorageKind, StoredObject } from "./types";

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

export function extForMime(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

let cached: ObjectStorageProvider | null = null;

export function getStorage(): ObjectStorageProvider {
  if (cached) return cached;
  if (env.storageProvider === "s3") {
    if (!s3Configured()) {
      throw new Error("STORAGE_PROVIDER=s3 but S3 credentials are missing");
    }
    cached = new S3StorageProvider();
  } else {
    cached = new LocalStorageProvider();
  }
  return cached;
}

/** Back-compat helpers used across routes */
export async function saveUpload(
  relativeDir: string,
  data: Buffer,
  ext: string,
  kind: StorageKind = relativeDir.startsWith("catalogue")
    ? "catalogue"
    : relativeDir.startsWith("sessions") || relativeDir.startsWith("samples")
      ? "customer"
      : relativeDir.startsWith("results")
        ? "result"
        : relativeDir.startsWith("branding")
          ? "branding"
          : "demo",
): Promise<string> {
  const mime =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const stored = await getStorage().put(kind, relativeDir, data, mime);
  return stored.key;
}

export async function readUpload(key: string) {
  return getStorage().get(key);
}

export async function deleteUpload(key: string) {
  return getStorage().delete(key);
}

export async function existsUpload(key: string) {
  return getStorage().exists(key);
}

export async function signedMediaUrl(key: string, ttl = env.signedUrlTtlSeconds) {
  return getStorage().getSignedUrl(key, ttl);
}

export function signPath(relative: string, ttlSeconds = env.signedUrlTtlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", env.sessionSecret)
    .update(`${relative}:${exp}`)
    .digest("hex");
  return { path: relative, exp, sig };
}

export function verifySignedPath(relative: string, exp: number, sig: string) {
  if (relative.startsWith("s3:")) return false;
  return verifyLocalSignedPath(relative, exp, sig);
}

export function absolutePath(relative: string) {
  if (relative.startsWith("s3:")) {
    throw new Error("absolutePath is only valid for local storage keys");
  }
  const resolved = path.resolve(env.uploadDir, relative);
  if (!resolved.startsWith(path.resolve(env.uploadDir))) {
    throw new Error("Invalid path");
  }
  return resolved;
}

export async function ensureUploadRoot() {
  await mkdir(env.uploadDir, { recursive: true });
}

export { verifyLocalSignedPath };

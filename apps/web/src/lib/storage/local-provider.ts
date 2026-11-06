import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { mkdir, writeFile, readFile, unlink, access } from "fs/promises";
import path from "path";
import { env } from "../env";
import type { ObjectStorageProvider, StorageKind, StoredObject } from "./types";

export class LocalStorageProvider implements ObjectStorageProvider {
  readonly name = "local";

  private root() {
    return path.resolve(env.uploadDir);
  }

  private absolute(key: string) {
    const resolved = path.resolve(this.root(), key);
    if (!resolved.startsWith(this.root())) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  async put(
    kind: StorageKind,
    keyPrefix: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    const ext =
      contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
    const key = path.join(keyPrefix, `${randomUUID()}${ext}`).replace(/\\/g, "/");
    const full = this.absolute(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return { key, kind, contentType, size: data.length };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.absolute(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.absolute(key));
    } catch {
      /* missing ok */
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.absolute(key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = createHmac("sha256", env.sessionSecret)
      .update(`${key}:${exp}`)
      .digest("hex");
    return `/api/media?path=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
  }
}

export function verifyLocalSignedPath(key: string, exp: number, sig: string) {
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", env.sessionSecret)
    .update(`${key}:${exp}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

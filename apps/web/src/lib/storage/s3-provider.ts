import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { env, s3Configured } from "../env";
import type { ObjectStorageProvider, StorageKind, StoredObject } from "./types";

function bucketFor(kind: StorageKind): string {
  if (kind === "catalogue" || kind === "branding") return env.s3BucketCatalogue;
  return env.s3BucketCustomer;
}

/**
 * S3-compatible provider (AWS S3, Supabase Storage S3 API, MinIO, R2).
 * Buckets must be private. Access only via short-lived signed URLs.
 */
export class S3StorageProvider implements ObjectStorageProvider {
  readonly name = "s3";
  private client: S3Client;

  constructor() {
    if (!s3Configured()) {
      throw new Error(
        "S3 storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.",
      );
    }
    this.client = new S3Client({
      region: env.s3Region,
      endpoint: env.s3Endpoint,
      forcePathStyle: env.s3ForcePathStyle,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    });
  }

  private encodeKey(kind: StorageKind, objectKey: string) {
    // Prefix with kind so customer and catalogue never share prefixes accidentally.
    return `${kind}/${objectKey}`.replace(/\\/g, "/");
  }

  /** Stored key format: s3:{bucket}:{fullKey} */
  static parseKey(stored: string): { bucket: string; fullKey: string } | null {
    if (!stored.startsWith("s3:")) return null;
    const parts = stored.split(":");
    if (parts.length < 3) return null;
    return { bucket: parts[1], fullKey: parts.slice(2).join(":") };
  }

  async put(
    kind: StorageKind,
    keyPrefix: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    const ext =
      contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
    const objectKey = `${keyPrefix.replace(/\/$/, "")}/${randomUUID()}${ext}`.replace(/\\/g, "/");
    const fullKey = this.encodeKey(kind, objectKey);
    const bucket = bucketFor(kind);
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fullKey,
        Body: data,
        ContentType: contentType,
        ACL: undefined, // private by default
      }),
    );
    const key = `s3:${bucket}:${fullKey}`;
    return { key, kind, contentType, size: data.length };
  }

  private resolve(key: string) {
    const parsed = S3StorageProvider.parseKey(key);
    if (!parsed) throw new Error("Not an S3 storage key");
    return parsed;
  }

  async get(key: string): Promise<Buffer> {
    const { bucket, fullKey } = this.resolve(key);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: fullKey }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty S3 object");
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    const { bucket, fullKey } = this.resolve(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fullKey }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      const { bucket, fullKey } = this.resolve(key);
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: fullKey }));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const { bucket, fullKey } = this.resolve(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: fullKey }),
      { expiresIn: ttlSeconds },
    );
  }
}

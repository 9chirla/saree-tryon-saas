export type StorageKind = "catalogue" | "customer" | "result" | "branding" | "demo";

export type StoredObject = {
  /** Provider-relative key, e.g. catalogue/{storeId}/uuid.jpg or local relative path */
  key: string;
  kind: StorageKind;
  contentType: string;
  size: number;
};

export interface ObjectStorageProvider {
  readonly name: string;
  put(kind: StorageKind, keyPrefix: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Short-lived URL for browser access — never a permanent public URL */
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
}

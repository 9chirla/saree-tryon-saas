const isProd = process.env.NODE_ENV === "production";
/** Next.js sets this during `next build` — do not treat build as live production runtime. */
const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
const enforceProdSecrets = isProd && !isNextBuild;

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function prodForbiddenFallback(name: string, fallback: string): string {
  if (enforceProdSecrets && !process.env[name]) {
    throw new Error(
      `Production requires ${name} to be set explicitly. Insecure defaults are disabled.`,
    );
  }
  if (enforceProdSecrets && process.env[name] === fallback) {
    throw new Error(`Production refuses insecure default for ${name}.`);
  }
  return process.env[name] ?? fallback;
}

const DEV_SESSION_FALLBACK = "dev-session-secret-change-in-production-32chars";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd,
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  sessionSecret: prodForbiddenFallback("SESSION_SECRET", DEV_SESSION_FALLBACK),
  databaseUrl: required(
    "DATABASE_URL",
    isProd ? undefined : "postgresql://saree:saree_dev@localhost:5432/saree_tryon?schema=public",
  ),
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  storageProvider: (process.env.STORAGE_PROVIDER ?? "local") as "local" | "s3",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "auto",
  s3BucketCatalogue: process.env.S3_BUCKET_CATALOGUE ?? "trail9-catalogue",
  s3BucketCustomer: process.env.S3_BUCKET_CUSTOMER ?? "trail9-customer",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  signedUrlTtlSeconds: Number(process.env.SIGNED_URL_TTL_SECONDS ?? "900"),
  defaultRetentionHours: Number(process.env.DEFAULT_RETENTION_HOURS ?? "24"),
  cleanupBatchSize: Number(process.env.CLEANUP_BATCH_SIZE ?? "100"),
  tryonProvider: (process.env.TRYON_PROVIDER ?? "demo") as "demo" | "external" | "selfhosted",
  aiWorkerUrl: process.env.AI_WORKER_URL ?? "http://localhost:8000",
  externalTryonUrl: process.env.EXTERNAL_TRYON_URL ?? "",
  externalTryonApiKey: process.env.EXTERNAL_TRYON_API_KEY ?? "",
  externalTryonTimeoutMs: Number(process.env.EXTERNAL_TRYON_TIMEOUT_MS ?? "20000"),
  externalTryonMaxRetries: Number(process.env.EXTERNAL_TRYON_MAX_RETRIES ?? "2"),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  razorpayMode: (process.env.RAZORPAY_MODE ?? "test") as "test" | "live",
  billingGraceDays: Number(process.env.BILLING_GRACE_DAYS ?? "3"),
  kioskRateLimitPerMin: Number(process.env.KIOSK_RATE_LIMIT_PER_MIN ?? "30"),
  authRateLimitPerMin: Number(process.env.AUTH_RATE_LIMIT_PER_MIN ?? "20"),
  cleanupSecret: process.env.CLEANUP_CRON_SECRET ?? "",
};

export function razorpayConfigured(): boolean {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

export function s3Configured(): boolean {
  return Boolean(env.s3Endpoint && env.s3AccessKeyId && env.s3SecretAccessKey);
}

/** Call once at production boot (instrumentation / scripts). */
export function assertProductionEnv() {
  if (!isProd) return;
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEV_SESSION_FALLBACK) {
    throw new Error("SESSION_SECRET must be a strong unique value in production");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL required in production");
  }
  if (!process.env.APP_URL || process.env.APP_URL.includes("localhost")) {
    throw new Error("APP_URL must be the public HTTPS origin in production");
  }
  if (env.storageProvider === "s3" && !s3Configured()) {
    throw new Error("STORAGE_PROVIDER=s3 requires S3_ENDPOINT and credentials");
  }
  if (env.razorpayMode === "live" && !razorpayConfigured()) {
    throw new Error("RAZORPAY_MODE=live requires Razorpay credentials");
  }
  if (env.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
}

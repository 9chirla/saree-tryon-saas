function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  sessionSecret: required("SESSION_SECRET", "dev-session-secret-change-in-production-32chars"),
  databaseUrl: required("DATABASE_URL", "postgresql://saree:saree_dev@localhost:5432/saree_tryon?schema=public"),
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  signedUrlTtlSeconds: Number(process.env.SIGNED_URL_TTL_SECONDS ?? "900"),
  defaultRetentionHours: Number(process.env.DEFAULT_RETENTION_HOURS ?? "24"),
  tryonProvider: (process.env.TRYON_PROVIDER ?? "demo") as "demo" | "external" | "selfhosted",
  aiWorkerUrl: process.env.AI_WORKER_URL ?? "http://localhost:8000",
  externalTryonUrl: process.env.EXTERNAL_TRYON_URL ?? "",
  externalTryonApiKey: process.env.EXTERNAL_TRYON_API_KEY ?? "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  kioskRateLimitPerMin: Number(process.env.KIOSK_RATE_LIMIT_PER_MIN ?? "30"),
  authRateLimitPerMin: Number(process.env.AUTH_RATE_LIMIT_PER_MIN ?? "20"),
};

export function razorpayConfigured(): boolean {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

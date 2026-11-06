import { jsonOk } from "@/lib/api";
import { env, razorpayConfigured, s3Configured } from "@/lib/env";
import { getTryOnProvider } from "@/lib/tryon";

/**
 * Honest provider health — never claims commercial AI quality.
 */
export async function GET() {
  const provider = getTryOnProvider();
  let workerOk: boolean | null = null;
  let workerDetail: string | undefined;

  if (env.tryonProvider === "selfhosted") {
    try {
      const res = await fetch(`${env.aiWorkerUrl.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      workerOk = res.ok;
      const body = (await res.json()) as { gpu?: boolean; mode?: string };
      workerDetail = `mode=${body.mode ?? "unknown"}; gpu=${Boolean(body.gpu)}`;
    } catch {
      workerOk = false;
      workerDetail = "unreachable";
    }
  }

  const externalConfigured = Boolean(env.externalTryonUrl && env.externalTryonApiKey);

  return jsonOk({
    provider: provider.name,
    configured:
      env.tryonProvider === "demo" ||
      (env.tryonProvider === "external" && externalConfigured) ||
      (env.tryonProvider === "selfhosted" && workerOk !== false),
    commercialQuality: false,
    disclaimer:
      env.tryonProvider === "demo"
        ? "DemoTryOnProvider returns labelled sample composites — not real saree AI try-on."
        : env.tryonProvider === "selfhosted"
          ? "Self-hosted worker is a stub unless a licensed GPU model is configured and evaluated on real sarees."
          : externalConfigured
            ? "External provider credentials present — commercial quality requires separate saree evaluation; not claimed by this health check."
            : "External provider credentials missing.",
    workerOk,
    workerDetail,
    storage: {
      provider: env.storageProvider,
      s3Configured: s3Configured(),
    },
    billing: {
      razorpayConfigured: razorpayConfigured(),
      mode: env.razorpayMode,
    },
  });
}

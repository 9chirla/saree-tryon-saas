import { env } from "../env";
import type {
  TryOnInput,
  TryOnJobRef,
  TryOnResult,
  TryOnStatus,
  VirtualTryOnProvider,
} from "./types";

/**
 * ExternalApiTryOnProvider — requires EXTERNAL_TRYON_URL + API key.
 * Fails closed when credentials are missing; never fabricates success.
 */
export class ExternalApiTryOnProvider implements VirtualTryOnProvider {
  readonly name = "external";

  private assertConfigured() {
    if (!env.externalTryonUrl || !env.externalTryonApiKey) {
      throw new Error(
        "External try-on provider is not configured. Set EXTERNAL_TRYON_URL and EXTERNAL_TRYON_API_KEY.",
      );
    }
  }

  async generateTryOn(input: TryOnInput): Promise<TryOnJobRef> {
    this.assertConfigured();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${env.externalTryonUrl.replace(/\/$/, "")}/tryon`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.externalTryonApiKey}`,
        },
        body: JSON.stringify({
          jobId: input.jobId,
          personImagePath: input.personImagePath,
          sareeImagePath: input.sareeImagePath,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`External try-on rejected request (${res.status})`);
      }
      const data = (await res.json()) as { providerJobId: string; status: TryOnJobRef["status"] };
      return { providerJobId: data.providerJobId, status: data.status ?? "QUEUED" };
    } finally {
      clearTimeout(timer);
    }
  }

  async getJobStatus(providerJobId: string): Promise<TryOnStatus> {
    this.assertConfigured();
    const res = await fetch(
      `${env.externalTryonUrl.replace(/\/$/, "")}/tryon/${encodeURIComponent(providerJobId)}`,
      { headers: { authorization: `Bearer ${env.externalTryonApiKey}` } },
    );
    if (!res.ok) {
      return { providerJobId, status: "FAILED", error: `Status HTTP ${res.status}` };
    }
    return (await res.json()) as TryOnStatus;
  }

  async getResult(providerJobId: string): Promise<TryOnResult | null> {
    this.assertConfigured();
    const res = await fetch(
      `${env.externalTryonUrl.replace(/\/$/, "")}/tryon/${encodeURIComponent(providerJobId)}/result`,
      { headers: { authorization: `Bearer ${env.externalTryonApiKey}` } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Result HTTP ${res.status}`);
    return (await res.json()) as TryOnResult;
  }

  async cancelJob(providerJobId: string): Promise<void> {
    this.assertConfigured();
    await fetch(
      `${env.externalTryonUrl.replace(/\/$/, "")}/tryon/${encodeURIComponent(providerJobId)}/cancel`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${env.externalTryonApiKey}` },
      },
    );
  }
}

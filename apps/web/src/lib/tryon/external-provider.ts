import { env } from "../env";
import type {
  TryOnInput,
  TryOnJobRef,
  TryOnResult,
  TryOnStatus,
  VirtualTryOnProvider,
} from "./types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * ExternalApiTryOnProvider — requires EXTERNAL_TRYON_URL + API key.
 * Fails closed when credentials are missing; never fabricates success.
 * Retries transient network/5xx failures only.
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

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = env.externalTryonMaxRetries,
  ): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.externalTryonTimeoutMs);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        if (res.status >= 500 && attempt < retries) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        return res;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await sleep(300 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("External try-on request failed");
  }

  async generateTryOn(input: TryOnInput): Promise<TryOnJobRef> {
    this.assertConfigured();
    const res = await this.fetchWithRetry(`${env.externalTryonUrl.replace(/\/$/, "")}/tryon`, {
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
    });
    if (!res.ok) {
      throw new Error(`External try-on rejected request (${res.status})`);
    }
    const data = (await res.json()) as { providerJobId?: string; status?: string };
    if (!data.providerJobId) {
      throw new Error("External try-on response missing providerJobId");
    }
    const status = (data.status?.toUpperCase() as TryOnJobRef["status"]) || "QUEUED";
    if (!["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"].includes(status)) {
      throw new Error("External try-on returned invalid status");
    }
    return { providerJobId: data.providerJobId, status };
  }

  async getJobStatus(providerJobId: string): Promise<TryOnStatus> {
    this.assertConfigured();
    const res = await this.fetchWithRetry(
      `${env.externalTryonUrl.replace(/\/$/, "")}/tryon/${encodeURIComponent(providerJobId)}`,
      { headers: { authorization: `Bearer ${env.externalTryonApiKey}` } },
    );
    if (!res.ok) {
      return { providerJobId, status: "FAILED", error: `Status HTTP ${res.status}` };
    }
    const data = (await res.json()) as TryOnStatus;
    if (!data.status) {
      return { providerJobId, status: "FAILED", error: "Invalid status payload" };
    }
    return data;
  }

  async getResult(providerJobId: string): Promise<TryOnResult | null> {
    this.assertConfigured();
    const res = await this.fetchWithRetry(
      `${env.externalTryonUrl.replace(/\/$/, "")}/tryon/${encodeURIComponent(providerJobId)}/result`,
      { headers: { authorization: `Bearer ${env.externalTryonApiKey}` } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Result HTTP ${res.status}`);
    const data = (await res.json()) as TryOnResult;
    if (!data.resultPath) throw new Error("External result missing resultPath");
    return { ...data, provider: this.name, isDemo: data.isDemo ?? false };
  }

  async cancelJob(providerJobId: string): Promise<void> {
    this.assertConfigured();
    await this.fetchWithRetry(
      `${env.externalTryonUrl.replace(/\/$/, "")}/tryon/${encodeURIComponent(providerJobId)}/cancel`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${env.externalTryonApiKey}` },
      },
      0,
    );
  }
}

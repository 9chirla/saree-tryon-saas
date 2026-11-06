import { env } from "../env";
import type {
  TryOnInput,
  TryOnJobRef,
  TryOnResult,
  TryOnStatus,
  VirtualTryOnProvider,
} from "./types";

/**
 * SelfHostedTryOnProvider — calls the FastAPI AI worker.
 * Worker returns labelled stub results unless a GPU model is configured there.
 */
export class SelfHostedTryOnProvider implements VirtualTryOnProvider {
  readonly name = "selfhosted";

  async generateTryOn(input: TryOnInput): Promise<TryOnJobRef> {
    const res = await fetch(`${env.aiWorkerUrl.replace(/\/$/, "")}/v1/tryon`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        job_id: input.jobId,
        person_image_path: input.personImagePath,
        saree_image_path: input.sareeImagePath,
        store_id: input.storeId,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI worker error (${res.status}): ${text}`);
    }
    const data = (await res.json()) as { job_id: string; status: string };
    return {
      providerJobId: data.job_id,
      status: (data.status?.toUpperCase() as TryOnJobRef["status"]) || "QUEUED",
    };
  }

  async getJobStatus(providerJobId: string): Promise<TryOnStatus> {
    const res = await fetch(
      `${env.aiWorkerUrl.replace(/\/$/, "")}/v1/tryon/${encodeURIComponent(providerJobId)}`,
    );
    if (!res.ok) {
      return { providerJobId, status: "FAILED", error: `Worker status ${res.status}` };
    }
    const data = (await res.json()) as {
      job_id: string;
      status: string;
      error?: string;
      progress?: number;
    };
    return {
      providerJobId: data.job_id,
      status: data.status.toUpperCase() as TryOnStatus["status"],
      error: data.error,
      progress: data.progress,
    };
  }

  async getResult(providerJobId: string): Promise<TryOnResult | null> {
    const status = await this.getJobStatus(providerJobId);
    if (status.status !== "SUCCEEDED") return null;
    const res = await fetch(
      `${env.aiWorkerUrl.replace(/\/$/, "")}/v1/tryon/${encodeURIComponent(providerJobId)}`,
    );
    const data = (await res.json()) as {
      job_id: string;
      result_path?: string;
      is_demo?: boolean;
      label?: string;
      duration_ms?: number;
    };
    if (!data.result_path) return null;
    return {
      providerJobId: data.job_id,
      resultPath: data.result_path,
      isDemo: data.is_demo ?? true,
      label: data.label ?? "Self-hosted stub — not commercial AI",
      durationMs: data.duration_ms,
      provider: this.name,
      creditsUsed: 1,
    };
  }

  async cancelJob(providerJobId: string): Promise<void> {
    await fetch(
      `${env.aiWorkerUrl.replace(/\/$/, "")}/v1/tryon/${encodeURIComponent(providerJobId)}/cancel`,
      { method: "POST" },
    );
  }
}

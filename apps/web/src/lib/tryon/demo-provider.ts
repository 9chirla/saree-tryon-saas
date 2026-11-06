import sharp from "sharp";
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { absolutePath, saveUpload, ensureUploadRoot } from "../storage";
import { env } from "../env";
import type {
  TryOnInput,
  TryOnJobRef,
  TryOnResult,
  TryOnStatus,
  VirtualTryOnProvider,
} from "./types";

type DemoJob = {
  status: TryOnStatus["status"];
  input: TryOnInput;
  result?: TryOnResult;
  error?: string;
  startedAt: number;
};

/**
 * DemoTryOnProvider — no credentials.
 * Produces a clearly labelled collage (person + saree + DEMO watermark).
 * Job state is persisted under UPLOAD_DIR so Next.js route isolates share status.
 * Never claims commercial AI quality.
 */
export class DemoTryOnProvider implements VirtualTryOnProvider {
  readonly name = "demo";

  private jobFile(providerJobId: string) {
    return path.join(env.uploadDir, "demo-jobs", `${providerJobId}.json`);
  }

  private async writeJob(providerJobId: string, job: DemoJob) {
    await ensureUploadRoot();
    const dir = path.join(env.uploadDir, "demo-jobs");
    await mkdir(dir, { recursive: true });
    await writeFile(this.jobFile(providerJobId), JSON.stringify(job));
  }

  private async readJob(providerJobId: string): Promise<DemoJob | null> {
    try {
      const raw = await readFile(this.jobFile(providerJobId), "utf8");
      return JSON.parse(raw) as DemoJob;
    } catch {
      return null;
    }
  }

  async generateTryOn(input: TryOnInput): Promise<TryOnJobRef> {
    const providerJobId = `demo_${randomUUID()}`;
    const startedAt = Date.now();
    await this.writeJob(providerJobId, {
      status: "PROCESSING",
      input,
      startedAt,
    });

    try {
      const personMeta = await sharp(absolutePath(input.personImagePath)).metadata();
      const width = Math.min(personMeta.width ?? 720, 900);
      const height = Math.min(personMeta.height ?? 1280, 1400);

      const personBuf = await sharp(absolutePath(input.personImagePath))
        .resize(width, height, { fit: "cover" })
        .jpeg()
        .toBuffer();

      const sareeBuf = await sharp(absolutePath(input.sareeImagePath))
        .resize(Math.floor(width * 0.45), Math.floor(height * 0.55), {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      const watermarkSvg = Buffer.from(`
        <svg width="${width}" height="${height}">
          <rect x="0" y="0" width="${width}" height="56" fill="rgba(90,45,129,0.88)"/>
          <text x="20" y="36" font-family="Arial, sans-serif" font-size="22" fill="#F0D78C" font-weight="700">
            DEMO — not real AI try-on
          </text>
          <text x="20" y="${height - 24}" font-family="Arial, sans-serif" font-size="16" fill="#5A2D81">
            Trail9 sample composite · Your Saree. Virtually.
          </text>
        </svg>
      `);

      const composed = await sharp(personBuf)
        .composite([
          { input: sareeBuf, gravity: "southeast", blend: "over" },
          { input: watermarkSvg, gravity: "northwest" },
        ])
        .jpeg({ quality: 88 })
        .toBuffer();

      const resultPath = await saveUpload(path.join("results", input.storeId), composed, ".jpg");
      const durationMs = Date.now() - startedAt;
      const result: TryOnResult = {
        providerJobId,
        resultPath,
        isDemo: true,
        label: "DEMO — not real AI try-on",
        durationMs,
        provider: this.name,
        creditsUsed: 1,
        meta: { composite: "person+saree+watermark" },
      };
      await this.writeJob(providerJobId, {
        status: "SUCCEEDED",
        input,
        startedAt,
        result,
      });
      // Return QUEUED first so clients observe a real job lifecycle on the next poll.
      return { providerJobId, status: "QUEUED" };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Demo processing failed";
      await this.writeJob(providerJobId, {
        status: "FAILED",
        input,
        startedAt,
        error,
      });
      throw err;
    }
  }

  async getJobStatus(providerJobId: string): Promise<TryOnStatus> {
    const job = await this.readJob(providerJobId);
    if (!job) {
      return { providerJobId, status: "FAILED", error: "Unknown demo job" };
    }
    return {
      providerJobId,
      status: job.status,
      error: job.error,
      progress: job.status === "SUCCEEDED" ? 100 : 50,
    };
  }

  async getResult(providerJobId: string): Promise<TryOnResult | null> {
    const job = await this.readJob(providerJobId);
    return job?.result ?? null;
  }

  async cancelJob(providerJobId: string): Promise<void> {
    const job = await this.readJob(providerJobId);
    if (job && job.status !== "SUCCEEDED") {
      job.status = "CANCELLED";
      await this.writeJob(providerJobId, job);
    }
  }
}

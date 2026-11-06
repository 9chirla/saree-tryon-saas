import { Prisma, TryOnStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getTryOnProvider } from "@/lib/tryon";
import { deductCreditForSuccess } from "@/lib/credits";
import { signPath } from "@/lib/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ storeSlug: string; jobId: string }> },
) {
  try {
    const { storeSlug, jobId } = await ctx.params;
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      include: { organisation: true },
    });
    if (!store) return jsonError("Store not found", 404);

    let job = await prisma.tryOnJob.findFirst({
      where: { id: jobId, storeId: store.id },
      include: { result: true, saree: true },
    });
    if (!job) return jsonError("Job not found", 404);

    // Poll provider until terminal, syncing real status into DB (never fake animation).
    if (
      job.providerJobId &&
      (job.status === TryOnStatus.QUEUED || job.status === TryOnStatus.PROCESSING)
    ) {
      const provider = getTryOnProvider();
      const status = await provider.getJobStatus(job.providerJobId);

      if (status.status === "SUCCEEDED") {
        const result = await provider.getResult(job.providerJobId);
        if (result) {
          const meta = (result.meta ?? {}) as Prisma.InputJsonValue;
          await prisma.tryOnResult.upsert({
            where: { jobId: job.id },
            create: {
              jobId: job.id,
              resultPath: result.resultPath,
              isDemo: result.isDemo,
              label: result.label,
              providerMeta: meta,
            },
            update: {
              resultPath: result.resultPath,
              isDemo: result.isDemo,
              label: result.label,
              providerMeta: meta,
            },
          });
          await prisma.tryOnJob.update({
            where: { id: job.id },
            data: {
              status: TryOnStatus.SUCCEEDED,
              durationMs: result.durationMs,
              completedAt: new Date(),
            },
          });
          // Deduct only on success; unique tryonJobId prevents duplicates.
          await deductCreditForSuccess({
            organisationId: store.organisationId,
            storeId: store.id,
            tryonJobId: job.id,
          });
        }
      } else if (status.status === "FAILED" || status.status === "CANCELLED") {
        await prisma.tryOnJob.update({
          where: { id: job.id },
          data: {
            status: status.status as TryOnStatus,
            errorMessage: status.error,
            completedAt: new Date(),
          },
        });
      } else if (status.status === "PROCESSING" && job.status === TryOnStatus.QUEUED) {
        await prisma.tryOnJob.update({
          where: { id: job.id },
          data: { status: TryOnStatus.PROCESSING },
        });
      }

      job = await prisma.tryOnJob.findFirstOrThrow({
        where: { id: jobId, storeId: store.id },
        include: { result: true, saree: true },
      });
    }

    const resultSigned = job.result
      ? signPath(job.result.resultPath)
      : null;

    return jsonOk({
      jobId: job.id,
      status: job.status,
      provider: job.provider,
      errorMessage: job.errorMessage,
      durationMs: job.durationMs,
      saree: job.saree
        ? { id: job.saree.id, name: job.saree.name, fabric: job.saree.fabric }
        : null,
      result: job.result
        ? {
            isDemo: job.result.isDemo,
            label: job.result.label,
            url: resultSigned
              ? `/api/media?path=${encodeURIComponent(resultSigned.path)}&exp=${resultSigned.exp}&sig=${resultSigned.sig}`
              : null,
          }
        : null,
      personUrl: (() => {
        const s = signPath(job.personImagePath);
        return `/api/media?path=${encodeURIComponent(s.path)}&exp=${s.exp}&sig=${s.sig}`;
      })(),
      sareeImageUrl: (() => {
        const s = signPath(job.sareeImagePath);
        return `/api/media?path=${encodeURIComponent(s.path)}&exp=${s.exp}&sig=${s.sig}`;
      })(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

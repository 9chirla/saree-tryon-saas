import { prisma } from "../db";
import { deleteUpload } from "../storage";
import { env } from "../env";

export type CleanupResult = {
  jobsScanned: number;
  filesDeleted: number;
  jobsAnonymised: number;
  failures: { jobId: string; error: string }[];
};

/**
 * Delete expired customer session images and result files.
 * Does not log image paths or binary content — only job ids and error codes.
 */
export async function runRetentionCleanup(opts?: {
  now?: Date;
  batchSize?: number;
}): Promise<CleanupResult> {
  const now = opts?.now ?? new Date();
  const batchSize = opts?.batchSize ?? env.cleanupBatchSize;
  const failures: CleanupResult["failures"] = [];
  let filesDeleted = 0;
  let jobsAnonymised = 0;

  const expired = await prisma.tryOnJob.findMany({
    where: {
      expiresAt: { lt: now },
      OR: [
        { personImagePath: { not: "" } },
        { sareeImagePath: { startsWith: "sessions/" } },
      ],
    },
    include: { result: true },
    take: batchSize,
    orderBy: { expiresAt: "asc" },
  });

  for (const job of expired) {
    const keys = new Set<string>();
    if (job.personImagePath.startsWith("sessions/") || job.personImagePath.startsWith("s3:")) {
      // Only delete customer session assets — never catalogue paths
      if (job.personImagePath.includes("/sessions/") || job.personImagePath.startsWith("sessions/")) {
        keys.add(job.personImagePath);
      }
      if (job.personImagePath.includes("customer/")) keys.add(job.personImagePath);
    }
    if (job.sareeImagePath.startsWith("sessions/") || job.sareeImagePath.includes("/sessions/")) {
      keys.add(job.sareeImagePath);
    }
    if (job.result?.resultPath) {
      keys.add(job.result.resultPath);
    }

    for (const key of keys) {
      try {
        await deleteUpload(key);
        filesDeleted += 1;
      } catch {
        failures.push({ jobId: job.id, error: "file_delete_failed" });
      }
    }

    try {
      await prisma.tryOnJob.update({
        where: { id: job.id },
        data: {
          personImagePath: "deleted",
          sareeImagePath: job.sareeImagePath.startsWith("sessions/")
            ? "deleted"
            : job.sareeImagePath,
        },
      });
      if (job.result) {
        await prisma.tryOnResult.update({
          where: { jobId: job.id },
          data: { resultPath: "deleted" },
        });
      }
      jobsAnonymised += 1;
    } catch {
      failures.push({ jobId: job.id, error: "record_update_failed" });
    }
  }

  // Abandoned queued/processing jobs older than retention default
  const abandonedCutoff = new Date(
    now.getTime() - env.defaultRetentionHours * 3600_000,
  );
  const abandoned = await prisma.tryOnJob.findMany({
    where: {
      status: { in: ["QUEUED", "PROCESSING", "FAILED", "CANCELLED"] },
      createdAt: { lt: abandonedCutoff },
      personImagePath: { startsWith: "sessions/" },
    },
    take: batchSize,
  });

  for (const job of abandoned) {
    if (expired.some((e) => e.id === job.id)) continue;
    try {
      if (job.personImagePath.startsWith("sessions/")) {
        await deleteUpload(job.personImagePath);
        filesDeleted += 1;
      }
      if (job.sareeImagePath.startsWith("sessions/")) {
        await deleteUpload(job.sareeImagePath);
        filesDeleted += 1;
      }
      await prisma.tryOnJob.update({
        where: { id: job.id },
        data: {
          personImagePath: "deleted",
          sareeImagePath: job.sareeImagePath.startsWith("sessions/")
            ? "deleted"
            : job.sareeImagePath,
        },
      });
      jobsAnonymised += 1;
    } catch {
      failures.push({ jobId: job.id, error: "abandoned_cleanup_failed" });
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "retention.cleanup",
      entityType: "tryon_jobs",
      meta: {
        jobsScanned: expired.length + abandoned.length,
        filesDeleted,
        jobsAnonymised,
        failureCount: failures.length,
      },
    },
  });

  return {
    jobsScanned: expired.length + abandoned.length,
    filesDeleted,
    jobsAnonymised,
    failures,
  };
}

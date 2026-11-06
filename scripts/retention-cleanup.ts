/**
 * CLI: npx tsx scripts/retention-cleanup.ts
 * Intended for cron: 0 * * * * cd /app && npx tsx scripts/retention-cleanup.ts
 */
import { runRetentionCleanup } from "../apps/web/src/lib/retention/cleanup";

async function main() {
  const result = await runRetentionCleanup();
  console.log(
    JSON.stringify({
      ok: true,
      jobsScanned: result.jobsScanned,
      filesDeleted: result.filesDeleted,
      jobsAnonymised: result.jobsAnonymised,
      failureCount: result.failures.length,
    }),
  );
  process.exit(result.failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "failed" }));
  process.exit(1);
});

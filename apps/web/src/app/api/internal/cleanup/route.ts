import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { env } from "@/lib/env";
import { runRetentionCleanup } from "@/lib/retention/cleanup";

/**
 * Cron endpoint for retention cleanup.
 * Auth: Authorization: Bearer $CLEANUP_CRON_SECRET (required in production).
 */
export async function POST(req: Request) {
  try {
    const secret = env.cleanupSecret;
    if (env.isProd && !secret) {
      return jsonError("CLEANUP_CRON_SECRET not configured", 503);
    }
    if (secret) {
      const auth = req.headers.get("authorization") ?? "";
      if (auth !== `Bearer ${secret}`) {
        return jsonError("Unauthorized", 401);
      }
    } else if (env.nodeEnv !== "development" && env.nodeEnv !== "test") {
      return jsonError("Unauthorized", 401);
    }

    const result = await runRetentionCleanup();
    return jsonOk({ ok: true, ...result });
  } catch (err) {
    return handleRouteError(err);
  }
}

import { destroySession } from "@/lib/auth";
import { assertSameOrigin, handleRouteError, jsonOk } from "@/lib/api";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await destroySession();
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

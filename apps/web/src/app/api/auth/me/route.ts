import { getSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    return jsonOk({ user });
  } catch (err) {
    return handleRouteError(err);
  }
}

import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!rateLimit(`auth:${clientIp(req)}`, env.authRateLimitPerMin)) {
      return jsonError("Too many requests", 429);
    }
    const body = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return jsonError("Invalid email or password", 401);
    }
    await createSession(user.id);
    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

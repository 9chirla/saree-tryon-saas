import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { Role, SubscriptionStatus } from "@prisma/client";

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  organisationName: z.string().min(2).max(120),
  storeName: z.string().min(2).max(120),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!rateLimit(`auth:${clientIp(req)}`, env.authRateLimitPerMin)) {
      return jsonError("Too many requests", 429);
    }
    const body = schema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) return jsonError("Email already registered", 409);

    const orgSlug = slugify(body.organisationName);
    const storeSlug = slugify(body.storeName || body.organisationName);
    if (await prisma.organisation.findUnique({ where: { slug: orgSlug } })) {
      return jsonError("Organisation slug taken", 409);
    }
    if (await prisma.store.findUnique({ where: { slug: storeSlug } })) {
      return jsonError("Store slug taken", 409);
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: "BASIC" } });
    if (!plan) return jsonError("Plans not seeded", 500);

    const passwordHash = await hashPassword(body.password);
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email.toLowerCase(),
          name: body.name,
          passwordHash,
        },
      });
      const org = await tx.organisation.create({
        data: { name: body.organisationName, slug: orgSlug },
      });
      const store = await tx.store.create({
        data: {
          organisationId: org.id,
          name: body.storeName,
          slug: storeSlug,
          settings: {
            create: {
              welcomeMessage: `Welcome to ${body.storeName}`,
              privacyNotice:
                "Photos are captured only after consent and deleted per retention policy (default 24h).",
            },
          },
        },
      });
      await tx.storeMember.create({
        data: { storeId: store.id, userId: user.id, role: Role.ORG_OWNER },
      });
      await tx.subscription.create({
        data: {
          organisationId: org.id,
          planId: plan.id,
          status: SubscriptionStatus.DEMO,
          creditsRemaining: plan.monthlyCredits,
          creditsPeriodTotal: plan.monthlyCredits,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });
      return { user, store, org };
    });

    await createSession(result.user.id, false);
    return jsonOk({
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      store: { id: result.store.id, slug: result.store.slug, name: result.store.name },
      organisation: { id: result.org.id, slug: result.org.slug },
    }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

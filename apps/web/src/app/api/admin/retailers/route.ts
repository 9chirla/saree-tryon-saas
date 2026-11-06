import { z } from "zod";
import { Role, SubscriptionStatus } from "@prisma/client";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";

const schema = z.object({
  organisationName: z.string().min(2),
  storeName: z.string().min(2),
  storeSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  planCode: z.enum(["BASIC", "PROFESSIONAL", "ENTERPRISE"]).default("BASIC"),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user?.isSuperAdmin) return jsonError("Forbidden", 403);
    const body = schema.parse(await req.json());

    if (await prisma.store.findUnique({ where: { slug: body.storeSlug } })) {
      return jsonError("Store slug taken", 409);
    }
    if (await prisma.user.findUnique({ where: { email: body.ownerEmail.toLowerCase() } })) {
      return jsonError("Owner email taken", 409);
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: body.planCode } });
    if (!plan) return jsonError("Plan missing", 500);

    const passwordHash = await hashPassword(body.ownerPassword);
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const created = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          email: body.ownerEmail.toLowerCase(),
          name: body.ownerName,
          passwordHash,
        },
      });
      const org = await tx.organisation.create({
        data: {
          name: body.organisationName,
          slug: body.storeSlug,
        },
      });
      const store = await tx.store.create({
        data: {
          organisationId: org.id,
          name: body.storeName,
          slug: body.storeSlug,
          settings: { create: {} },
        },
      });
      await tx.storeMember.create({
        data: { storeId: store.id, userId: owner.id, role: Role.ORG_OWNER },
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
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "admin.create_retailer",
          entityType: "organisation",
          entityId: org.id,
        },
      });
      return { org, store, owner: { id: owner.id, email: owner.email, name: owner.name } };
    });

    return jsonOk(created, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

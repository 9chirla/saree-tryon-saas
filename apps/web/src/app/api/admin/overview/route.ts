import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { razorpayConfigured } from "@/lib/env";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user?.isSuperAdmin) return jsonError("Forbidden", 403);

    const [orgs, stores, users, jobs, succeeded, plans, providers, revenue] =
      await Promise.all([
        prisma.organisation.count(),
        prisma.store.count(),
        prisma.user.count(),
        prisma.tryOnJob.count(),
        prisma.tryOnJob.count({ where: { status: "SUCCEEDED" } }),
        prisma.subscriptionPlan.findMany({ orderBy: { priceInrPaise: "asc" } }),
        prisma.aiProvider.findMany({ orderBy: { code: "asc" } }),
        prisma.payment.aggregate({
          where: { status: "SUCCEEDED" },
          _sum: { amountPaise: true },
        }),
      ]);

    const retailers = await prisma.organisation.findMany({
      include: {
        stores: true,
        subscription: { include: { plan: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return jsonOk({
      metrics: {
        organisations: orgs,
        stores,
        users,
        jobs,
        succeeded,
        revenuePaise: revenue._sum.amountPaise ?? 0,
      },
      plans,
      providers: providers.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        isEnabled: p.isEnabled,
        configHint: p.configHint,
        // secrets never returned
      })),
      retailers,
      billingConfigured: razorpayConfigured(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

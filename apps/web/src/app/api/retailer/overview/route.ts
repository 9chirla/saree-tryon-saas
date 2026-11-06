import { getSessionUser, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    if (user.isSuperAdmin && user.memberships.length === 0) {
      return jsonOk({ role: "SUPER_ADMIN", message: "Use /admin for platform metrics" });
    }
    const membership = user.memberships[0];
    if (!membership) throw new AuthError("No store membership", 403);

    const store = await prisma.store.findUniqueOrThrow({
      where: { id: membership.storeId },
      include: {
        organisation: { include: { subscription: { include: { plan: true } } } },
        _count: { select: { sarees: true, tryonJobs: true } },
      },
    });

    const succeeded = await prisma.tryOnJob.count({
      where: { storeId: store.id, status: "SUCCEEDED" },
    });
    const recent = await prisma.tryOnJob.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, createdAt: true, provider: true, creditsCharged: true },
    });

    return jsonOk({
      store: { id: store.id, name: store.name, slug: store.slug },
      organisation: { id: store.organisationId, name: store.organisation.name },
      subscription: store.organisation.subscription,
      counts: {
        sarees: store._count.sarees,
        jobs: store._count.tryonJobs,
        succeeded,
      },
      recent,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

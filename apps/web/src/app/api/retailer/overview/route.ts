import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/api";
import { requireStoreContext } from "@/lib/store-context";
import { enforceSubscriptionAccess } from "@/lib/billing/subscription-state";

export async function GET(req: Request) {
  try {
    const { user, membership } = await requireStoreContext(req);
    if (user.isSuperAdmin && user.memberships.length === 0 && !membership.storeId) {
      return jsonOk({ role: "SUPER_ADMIN", message: "Use /admin for platform metrics" });
    }

    const store = await prisma.store.findUniqueOrThrow({
      where: { id: membership.storeId },
      include: {
        organisation: { include: { subscription: { include: { plan: true } } } },
        _count: { select: { sarees: true, tryonJobs: true } },
      },
    });

    const subState = store.organisation.subscription
      ? await enforceSubscriptionAccess(store.organisation.subscription.id)
      : null;

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
      stores: user.memberships.map((m) => ({
        id: m.storeId,
        name: m.storeName,
        slug: m.storeSlug,
        role: m.role,
      })),
      organisation: { id: store.organisationId, name: store.organisation.name },
      subscription: subState ?? store.organisation.subscription,
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

import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { signPath } from "@/lib/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ storeSlug: string }> },
) {
  try {
    const { storeSlug } = await ctx.params;
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      include: {
        settings: true,
        sarees: {
          where: { isActive: true },
          include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
          orderBy: { name: "asc" },
        },
        organisation: {
          include: { subscription: { include: { plan: true } } },
        },
      },
    });
    if (!store || !store.isActive) return jsonError("Store not found", 404);

    return jsonOk({
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        settings: store.settings,
      },
      sarees: store.sarees.map((s) => {
        const img = s.images[0];
        const signed = img ? signPath(img.path) : null;
        return {
          id: s.id,
          name: s.name,
          fabric: s.fabric,
          color: s.color,
          occasion: s.occasion,
          priceInr: s.priceInr,
          imageUrl: signed
            ? `/api/media?path=${encodeURIComponent(signed.path)}&exp=${signed.exp}&sig=${signed.sig}`
            : null,
        };
      }),
      creditsAvailable: store.organisation.subscription?.creditsRemaining ?? 0,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

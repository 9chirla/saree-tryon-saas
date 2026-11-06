import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { detectImageMime, extForMime, saveUpload, signPath, signedMediaUrl } from "@/lib/storage";
import { requireStoreContext } from "@/lib/store-context";

async function logoUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("s3:")) return signedMediaUrl(path);
  const signed = signPath(path);
  return `/api/media?path=${encodeURIComponent(signed.path)}&exp=${signed.exp}&sig=${signed.sig}`;
}

export async function GET(req: Request) {
  try {
    const { membership } = await requireStoreContext(req);
    const settings = await prisma.storeSettings.findUnique({
      where: { storeId: membership.storeId },
    });
    return jsonOk({
      settings: settings
        ? { ...settings, logoUrl: await logoUrl(settings.logoPath) }
        : null,
      storeId: membership.storeId,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({
  primaryColor: z.string().max(20).optional(),
  accentColor: z.string().max(20).optional(),
  defaultLocale: z.enum(["en", "te", "hi"]).optional(),
  retentionHours: z.number().int().min(1).max(168).optional(),
  welcomeMessage: z.string().max(500).nullable().optional(),
  privacyNotice: z.string().max(1000).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const { membership } = await requireStoreContext(req, [
      Role.ORG_OWNER,
      Role.STORE_MANAGER,
    ]);

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("logo");
      let logoPath: string | undefined;
      if (file instanceof File && file.size > 0) {
        if (file.size > 2 * 1024 * 1024) return jsonError("Logo max 2MB", 413);
        const buf = Buffer.from(await file.arrayBuffer());
        const mime = detectImageMime(buf);
        if (!mime) return jsonError("Invalid logo image", 415);
        logoPath = await saveUpload(
          `branding/${membership.storeId}`,
          buf,
          extForMime(mime),
          "branding",
        );
      }
      const patch = schema.parse({
        primaryColor: form.get("primaryColor") || undefined,
        accentColor: form.get("accentColor") || undefined,
        defaultLocale: form.get("defaultLocale") || undefined,
        retentionHours: form.get("retentionHours")
          ? Number(form.get("retentionHours"))
          : undefined,
        welcomeMessage: form.get("welcomeMessage") || undefined,
        privacyNotice: form.get("privacyNotice") || undefined,
      });
      const settings = await prisma.storeSettings.upsert({
        where: { storeId: membership.storeId },
        create: {
          storeId: membership.storeId,
          ...patch,
          ...(logoPath ? { logoPath } : {}),
        },
        update: {
          ...patch,
          ...(logoPath ? { logoPath } : {}),
        },
      });
      return jsonOk({ settings: { ...settings, logoUrl: await logoUrl(settings.logoPath) } });
    }

    const body = schema.parse(await req.json());
    const settings = await prisma.storeSettings.upsert({
      where: { storeId: membership.storeId },
      create: { storeId: membership.storeId, ...body },
      update: body,
    });
    return jsonOk({ settings: { ...settings, logoUrl: await logoUrl(settings.logoPath) } });
  } catch (err) {
    return handleRouteError(err);
  }
}

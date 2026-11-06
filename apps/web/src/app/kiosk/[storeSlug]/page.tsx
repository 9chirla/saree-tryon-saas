import { KioskApp } from "@/components/kiosk/KioskApp";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  return <KioskApp storeSlug={storeSlug} />;
}

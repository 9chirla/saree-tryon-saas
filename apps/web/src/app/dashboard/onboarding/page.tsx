"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";

export default function OnboardingPage() {
  const [checks, setChecks] = useState({
    catalogue: false,
    branding: false,
    kiosk: false,
    subscription: false,
  });
  const [slug, setSlug] = useState("demo-silk-house");

  useEffect(() => {
    Promise.all([
      fetch("/api/retailer/overview").then((r) => r.json()),
      fetch("/api/retailer/sarees").then((r) => r.json()),
      fetch("/api/retailer/settings").then((r) => r.json()),
      fetch("/api/billing/checkout").then((r) => r.json()),
    ]).then(([overview, sarees, settings, billing]) => {
      if (overview.store?.slug) setSlug(overview.store.slug);
      setChecks({
        catalogue: (sarees.sarees?.length ?? 0) > 0,
        branding: Boolean(settings.settings?.logoPath || settings.settings?.welcomeMessage),
        kiosk: Boolean(overview.store?.slug),
        subscription: Boolean(billing.subscription),
      });
    });
  }, []);

  const items = [
    {
      ok: checks.catalogue,
      title: "Add sarees to catalogue",
      href: "/dashboard/catalogue",
      tip: "Upload clear front photos of each saree.",
    },
    {
      ok: checks.branding,
      title: "Set store branding",
      href: "/dashboard/settings",
      tip: "Logo, welcome message, and privacy notice.",
    },
    {
      ok: checks.subscription,
      title: "Confirm subscription / credits",
      href: "/dashboard/billing",
      tip: "Demo mode works without Razorpay; add test keys before charging.",
    },
    {
      ok: checks.kiosk,
      title: "Open kiosk on tablet",
      href: `/kiosk/${slug}`,
      tip: "Use portrait mode; staff only taps Try Your Saree.",
    },
  ];

  return (
    <main className="kiosk-shell min-h-dvh px-4 py-8 md:px-10">
      <div className="mx-auto max-w-3xl">
        <AppNav
          title="Onboarding"
          links={[
            { href: "/dashboard", label: "Overview" },
            { href: "/dashboard/catalogue", label: "Catalogue" },
            { href: "/dashboard/settings", label: "Settings" },
            { href: "/dashboard/billing", label: "Subscription" },
          ]}
        />
        <section className="panel space-y-4">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--burgundy)]">
            Store launch checklist
          </h1>
          <p className="text-[var(--muted)]">
            Complete these steps before putting a kiosk on the shop floor.
          </p>
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.title}
                className="flex flex-col gap-1 rounded-2xl bg-white/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {item.ok ? "✓" : "○"} {item.title}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{item.tip}</p>
                </div>
                <Link href={item.href} className="btn-secondary !py-2 !text-sm">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

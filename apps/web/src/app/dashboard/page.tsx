"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { StoreSwitcher } from "@/components/StoreSwitcher";

type Overview = {
  store: { id: string; name: string; slug: string };
  subscription: {
    creditsRemaining: number;
    creditsPeriodTotal: number;
    status: string;
    plan: { name: string; code: string };
  } | null;
  counts: { sarees: number; jobs: number; succeeded: number };
  recent: { id: string; status: string; createdAt: string; provider: string; creditsCharged: number }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/retailer/overview")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        setData(j);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="kiosk-shell min-h-dvh px-4 py-8 md:px-10">
      <div className="mx-auto max-w-5xl">
        <AppNav
          title="Retailer dashboard"
          links={[
            { href: "/dashboard", label: "Overview" },
            { href: "/dashboard/catalogue", label: "Catalogue" },
            { href: "/dashboard/settings", label: "Settings" },
            { href: "/dashboard/billing", label: "Subscription" },
          ]}
        />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <StoreSwitcher onChanged={load} />
          <Link href="/dashboard/onboarding" className="text-sm text-[var(--burgundy)] underline">
            Onboarding checklist
          </Link>
        </div>
        {error && <p className="text-red-700">{error}</p>}
        {data && (
          <div className="animate-fade-up space-y-6">
            <section className="panel">
              <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--burgundy)]">
                {data.store.name}
              </h1>
              <p className="mt-2 text-[var(--muted)]">
                Kiosk:{" "}
                <Link className="underline" href={`/kiosk/${data.store.slug}`}>
                  /kiosk/{data.store.slug}
                </Link>
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Stat label="Credits remaining" value={String(data.subscription?.creditsRemaining ?? 0)} />
                <Stat
                  label="Plan"
                  value={`${data.subscription?.plan.name ?? "—"} (${data.subscription?.status})`}
                />
                <Stat label="Successful try-ons" value={String(data.counts.succeeded)} />
              </div>
            </section>
            <section className="panel">
              <h2 className="text-lg font-semibold">Recent jobs</h2>
              {data.recent.length === 0 ? (
                <p className="mt-3 text-[var(--muted)]">
                  No try-ons yet. Open the{" "}
                  <Link className="underline" href={`/kiosk/${data.store.slug}`}>
                    kiosk
                  </Link>{" "}
                  to run a demo session.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-[rgba(107,30,46,0.08)]">
                  {data.recent.map((j) => (
                    <li key={j.id} className="flex justify-between py-2 text-sm">
                      <span className="font-mono text-xs">{j.id.slice(0, 8)}</span>
                      <span>{j.status}</span>
                      <span>{j.provider}</span>
                      <span>−{j.creditsCharged}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

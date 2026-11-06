"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";

type AdminData = {
  metrics: {
    organisations: number;
    stores: number;
    users: number;
    jobs: number;
    succeeded: number;
    revenuePaise: number;
  };
  plans: { code: string; name: string; monthlyCredits: number; priceInrPaise: number }[];
  providers: { code: string; name: string; isEnabled: boolean; configHint: string | null }[];
  retailers: {
    id: string;
    name: string;
    slug: string;
    stores: { slug: string; name: string }[];
    subscription: { status: string; creditsRemaining: number; plan: { code: string } } | null;
  }[];
  billingConfigured: boolean;
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    organisationName: "",
    storeName: "",
    storeSlug: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    planCode: "BASIC",
  });
  const [created, setCreated] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/overview");
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Forbidden");
    setData(j);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createRetailer(e: FormEvent) {
    e.preventDefault();
    setCreated(null);
    const res = await fetch("/api/admin/retailers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Create failed");
      return;
    }
    setCreated(`Created ${j.store.slug} — owner ${j.owner.email}`);
    await load();
  }

  return (
    <main className="kiosk-shell min-h-dvh px-4 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <AppNav title="Super-admin" links={[{ href: "/admin", label: "Overview" }]} />
        {error && <p className="mb-4 text-red-700">{error}</p>}
        {data && (
          <div className="space-y-6 animate-fade-up">
            <section className="panel grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Orgs" value={data.metrics.organisations} />
              <Metric label="Stores" value={data.metrics.stores} />
              <Metric label="Users" value={data.metrics.users} />
              <Metric label="Jobs" value={data.metrics.jobs} />
              <Metric label="Succeeded" value={data.metrics.succeeded} />
              <Metric label="Revenue ₹" value={Math.round(data.metrics.revenuePaise / 100)} />
            </section>

            <section className="panel">
              <h2 className="text-lg font-semibold">AI providers</h2>
              <p className="text-sm text-[var(--muted)]">Secrets are never displayed.</p>
              <ul className="mt-3 space-y-2">
                {data.providers.map((p) => (
                  <li key={p.code} className="flex justify-between text-sm">
                    <span>
                      {p.name} ({p.code}) — {p.isEnabled ? "enabled" : "disabled"}
                    </span>
                    <span className="text-[var(--muted)]">{p.configHint}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm">
                Billing configured: {data.billingConfigured ? "yes" : "no (missing Razorpay credentials)"}
              </p>
            </section>

            <section className="panel">
              <h2 className="text-lg font-semibold">Plans</h2>
              <ul className="mt-3 space-y-1 text-sm">
                {data.plans.map((p) => (
                  <li key={p.code}>
                    {p.name}: ₹{(p.priceInrPaise / 100).toLocaleString("en-IN")} / {p.monthlyCredits} credits
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2 className="text-lg font-semibold">Retailers</h2>
              <ul className="mt-3 divide-y divide-[rgba(107,30,46,0.08)]">
                {data.retailers.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <span>{r.name}</span>
                    <span>/kiosk/{r.stores[0]?.slug}</span>
                    <span>
                      {r.subscription?.plan.code} · {r.subscription?.creditsRemaining} credits ·{" "}
                      {r.subscription?.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2 className="mb-4 text-lg font-semibold">Create retailer</h2>
              <form onSubmit={createRetailer} className="grid gap-3 md:grid-cols-2">
                {Object.entries(form).map(([key, value]) =>
                  key === "planCode" ? (
                    <label key={key} className="text-sm">
                      Plan
                      <select
                        className="mt-1 w-full rounded-xl border px-3 py-2"
                        value={value}
                        onChange={(e) => setForm((f) => ({ ...f, planCode: e.target.value }))}
                      >
                        <option value="BASIC">BASIC</option>
                        <option value="PROFESSIONAL">PROFESSIONAL</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </label>
                  ) : (
                    <label key={key} className="text-sm capitalize">
                      {key.replace(/([A-Z])/g, " $1")}
                      <input
                        className="mt-1 w-full rounded-xl border px-3 py-2"
                        type={key.includes("password") ? "password" : key.includes("Email") ? "email" : "text"}
                        required
                        value={value}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </label>
                  ),
                )}
                <button className="btn-primary md:col-span-2" type="submit">
                  Create retailer
                </button>
              </form>
              {created && <p className="mt-3 text-sm text-[var(--burgundy)]">{created}</p>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs uppercase text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

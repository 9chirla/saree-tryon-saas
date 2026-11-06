"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";

type Saree = {
  id: string;
  name: string;
  fabric: string | null;
  occasion: string | null;
  priceInr: number | null;
  isActive: boolean;
  images: { url: string }[];
};

export default function CataloguePage() {
  const [sarees, setSarees] = useState<Saree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fabric, setFabric] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const res = await fetch("/api/retailer/sarees");
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Failed");
    setSarees(j.sarees);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.append("name", name);
    if (fabric) fd.append("fabric", fabric);
    if (file) fd.append("image", file);
    const res = await fetch("/api/retailer/sarees", { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Create failed");
      return;
    }
    setName("");
    setFabric("");
    setFile(null);
    await load();
  }

  return (
    <main className="kiosk-shell min-h-dvh px-4 py-8 md:px-10">
      <div className="mx-auto max-w-5xl">
        <AppNav
          title="Catalogue"
          links={[
            { href: "/dashboard", label: "Overview" },
            { href: "/dashboard/catalogue", label: "Catalogue" },
            { href: "/dashboard/settings", label: "Settings" },
            { href: "/dashboard/billing", label: "Subscription" },
          ]}
        />
        {error && <p className="mb-4 text-red-700">{error}</p>}
        <form onSubmit={onCreate} className="panel mb-6 grid gap-3 md:grid-cols-4">
          <input
            className="rounded-xl border px-3 py-2"
            placeholder="Saree name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="rounded-xl border px-3 py-2"
            placeholder="Fabric"
            value={fabric}
            onChange={(e) => setFabric(e.target.value)}
          />
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="btn-primary" type="submit">
            Add saree
          </button>
        </form>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sarees.map((s) => (
            <article key={s.id} className="panel !p-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.images[0]?.url} alt={s.name} className="aspect-[3/4] w-full object-cover" />
              <div className="p-4">
                <h3 className="font-semibold">{s.name}</h3>
                <p className="text-sm text-[var(--muted)]">
                  {[s.fabric, s.occasion].filter(Boolean).join(" · ")}
                </p>
                <button
                  className="mt-3 text-sm text-red-700 underline"
                  onClick={async () => {
                    await fetch(`/api/retailer/sarees/${s.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

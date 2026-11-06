"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { StoreSwitcher } from "@/components/StoreSwitcher";

export default function SettingsPage() {
  const [form, setForm] = useState({
    welcomeMessage: "",
    privacyNotice: "",
    primaryColor: "#42105C",
    accentColor: "#D99A22",
    defaultLocale: "en",
    retentionHours: 24,
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/retailer/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.settings) {
          setForm({
            welcomeMessage: j.settings.welcomeMessage ?? "",
            privacyNotice: j.settings.privacyNotice ?? "",
            primaryColor: j.settings.primaryColor,
            accentColor: j.settings.accentColor,
            defaultLocale: j.settings.defaultLocale,
            retentionHours: j.settings.retentionHours,
          });
          setLogoUrl(j.settings.logoUrl ?? null);
        }
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
    if (logoFile) fd.append("logo", logoFile);
    const res = await fetch("/api/retailer/settings", { method: "PATCH", body: fd });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Failed to save");
      return;
    }
    setMessage("Saved");
    setLogoFile(null);
    if (j.settings?.logoUrl) setLogoUrl(j.settings.logoUrl);
  }

  return (
    <main className="kiosk-shell min-h-dvh px-4 py-8 md:px-10">
      <div className="mx-auto max-w-3xl">
        <AppNav
          title="Store settings"
          links={[
            { href: "/dashboard", label: "Overview" },
            { href: "/dashboard/catalogue", label: "Catalogue" },
            { href: "/dashboard/settings", label: "Settings" },
            { href: "/dashboard/billing", label: "Subscription" },
          ]}
        />
        <div className="mb-4">
          <StoreSwitcher onChanged={load} />
        </div>
        <form onSubmit={onSave} className="panel space-y-4">
          <label className="block text-sm">
            Store logo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Store logo" className="h-20 w-20 rounded-xl object-cover" />
          )}
          {(
            [
              ["welcomeMessage", "Welcome message"],
              ["privacyNotice", "Privacy notice"],
              ["primaryColor", "Primary color"],
              ["accentColor", "Accent color"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="block text-sm">
            Default locale
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.defaultLocale}
              onChange={(e) => setForm((f) => ({ ...f, defaultLocale: e.target.value }))}
            >
              <option value="en">English</option>
              <option value="te">Telugu</option>
              <option value="hi">Hindi</option>
            </select>
          </label>
          <label className="block text-sm">
            Customer image retention (hours)
            <input
              type="number"
              min={1}
              max={168}
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.retentionHours}
              onChange={(e) => setForm((f) => ({ ...f, retentionHours: Number(e.target.value) }))}
            />
          </label>
          {message && <p className="text-sm text-[var(--burgundy)]">{message}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary" type="submit">
            Save settings
          </button>
        </form>
      </div>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";

export default function SettingsPage() {
  const [form, setForm] = useState({
    welcomeMessage: "",
    privacyNotice: "",
    primaryColor: "#6B1E2E",
    accentColor: "#C4A35A",
    defaultLocale: "en",
    retentionHours: 24,
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
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
        }
      });
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/retailer/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    setMessage(res.ok ? "Saved" : j.error || "Failed");
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
        <form onSubmit={onSave} className="panel space-y-4">
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
            Retention hours
            <input
              type="number"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.retentionHours}
              onChange={(e) => setForm((f) => ({ ...f, retentionHours: Number(e.target.value) }))}
            />
          </label>
          {message && <p className="text-sm text-[var(--burgundy)]">{message}</p>}
          <button className="btn-primary" type="submit">
            Save settings
          </button>
        </form>
      </div>
    </main>
  );
}

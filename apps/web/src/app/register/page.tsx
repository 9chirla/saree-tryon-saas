"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    organisationName: "",
    storeName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="kiosk-shell flex min-h-dvh items-center justify-center px-4 py-10">
      <form onSubmit={onSubmit} className="panel w-full max-w-lg animate-fade-up">
        <Link href="/" className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--burgundy)]">
          trAIl9
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Register your store</h1>
        {(
          [
            ["name", "Your name"],
            ["email", "Email"],
            ["password", "Password"],
            ["organisationName", "Organisation"],
            ["storeName", "Store name"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="mt-4 block text-sm font-medium text-[var(--muted)]">
            {label}
            <input
              className="mt-1 w-full rounded-xl border border-[rgba(107,30,46,0.15)] bg-white/80 px-4 py-3 outline-none focus:border-[var(--burgundy)]"
              type={key === "password" ? "password" : key === "email" ? "email" : "text"}
              required
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button className="btn-primary mt-6 w-full" disabled={loading} type="submit">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </main>
  );
}

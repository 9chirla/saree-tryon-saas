"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("retailer@demo-sarees.local");
  const [password, setPassword] = useState("Retailer123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      if (data.user?.isSuperAdmin) router.push("/admin");
      else router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="kiosk-shell flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={onSubmit} className="panel w-full max-w-md animate-fade-up">
        <BrandLogo size="md" />
        <p className="brand-tagline mt-3">Try · Explore · Choose</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-xl italic text-[var(--brand-purple)]">
          Sign in
        </h1>
        <label className="mt-6 block text-sm font-medium text-[var(--muted)]">
          Email
          <input
            className="mt-1 w-full rounded-xl border border-[rgba(90,45,129,0.2)] bg-white/80 px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--gold)]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-[var(--muted)]">
          Password
          <input
            className="mt-1 w-full rounded-xl border border-[rgba(90,45,129,0.2)] bg-white/80 px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--gold)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button className="btn-primary mt-6 w-full" disabled={loading} type="submit">
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          New retailer?{" "}
          <Link href="/register" className="text-[var(--brand-purple)] underline">
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}

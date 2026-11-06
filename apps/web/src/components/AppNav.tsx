"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppNav({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <Link href="/" className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--burgundy)]">
          trAIl9
        </Link>
        <p className="text-sm text-[var(--muted)]">{title}</p>
      </div>
      <nav className="flex flex-wrap items-center gap-3 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-[var(--burgundy)] hover:bg-white/50">
            {l.label}
          </Link>
        ))}
        <button
          className="rounded-lg px-3 py-2 text-[var(--muted)] hover:bg-white/50"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
          }}
        >
          Log out
        </button>
      </nav>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

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
      <div className="flex items-center gap-4">
        <BrandLogo size="sm" />
        <div>
          <p className="brand-tagline hidden sm:block">Try · Explore · Choose</p>
          <p className="text-sm text-[var(--muted)]">{title}</p>
        </div>
      </div>
      <nav className="flex flex-wrap items-center gap-3 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg px-3 py-2 text-[var(--brand-purple)] hover:bg-[rgba(217,154,34,0.15)]"
          >
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

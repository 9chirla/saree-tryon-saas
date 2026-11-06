import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function HomePage() {
  return (
    <main className="kiosk-shell relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%235A2D81' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />
      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-6 py-16">
        <div className="animate-fade-up max-w-xl">
          <BrandLogo size="hero" priority href={null} />
        </div>
        <p className="brand-tagline animate-fade-up mt-6" style={{ animationDelay: "60ms" }}>
          Try · Explore · Choose
        </p>
        <h1
          className="animate-fade-up mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-medium italic text-[var(--brand-purple)] md:text-4xl"
          style={{ animationDelay: "100ms" }}
        >
          Your Saree. Virtually.
        </h1>
        <p
          className="animate-fade-up mt-4 max-w-xl text-lg text-[var(--muted)]"
          style={{ animationDelay: "140ms" }}
        >
          Virtual saree try-on for modern textile stores — kiosk, retailer dashboard, and subscriptions.
        </p>
        <div className="animate-fade-up mt-10 flex flex-wrap gap-4" style={{ animationDelay: "200ms" }}>
          <Link href="/kiosk/demo-silk-house" className="btn-primary">
            Open demo kiosk
          </Link>
          <Link href="/login" className="btn-secondary">
            Retailer / Admin login
          </Link>
        </div>
        <p className="mt-12 text-sm text-[var(--muted)]">
          Demo retailer: retailer@demo-sarees.local · Admin: admin@trail9.local
        </p>
      </div>
    </main>
  );
}

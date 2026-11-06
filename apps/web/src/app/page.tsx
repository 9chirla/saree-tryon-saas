import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function HomePage() {
  return (
    <main className="kiosk-shell relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%235A2D81' fill-opacity='0.045'%3E%3Cpath d='M0 0h40v40H0V0zm40 40h40v40H40V40z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />
      {/* Gold accent wash */}
      <div className="pointer-events-none absolute -right-24 top-0 h-[70vh] w-[50vw] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.18),transparent_65%)]" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-[50vh] w-[40vw] rounded-full bg-[radial-gradient(circle,rgba(90,45,129,0.12),transparent_70%)]" />

      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-6 py-14 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="animate-fade-up">
          <BrandLogo size="hero" priority href={null} className="drop-shadow-sm" />
          <div className="mt-8 flex items-center gap-3">
            <span className="h-px w-10 bg-[var(--gold)]" />
            <p className="brand-tagline">Try · Explore · Choose</p>
          </div>
          <h1 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-3xl font-medium italic leading-snug text-[var(--brand-purple)] md:text-[2.6rem]">
            Your Saree. Virtually.
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
            Premium virtual try-on for saree boutiques — portrait kiosk for shoppers, dashboard for
            retailers, subscriptions built for India.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/kiosk/demo-silk-house" className="btn-primary min-w-[11rem]">
              Open demo kiosk
            </Link>
            <Link href="/login" className="btn-secondary min-w-[11rem]">
              Retailer login
            </Link>
          </div>
          <p className="mt-10 text-sm text-[var(--muted)]">
            Demo · retailer@demo-sarees.local · admin@trail9.local
          </p>
        </section>

        <aside className="animate-fade-up panel relative hidden overflow-hidden lg:block" style={{ animationDelay: "120ms" }}>
          <div className="viewfinder-frame absolute inset-4 rounded-2xl border border-[rgba(212,175,55,0.35)] bg-gradient-to-br from-[rgba(90,45,129,0.08)] via-transparent to-[rgba(212,175,55,0.12)]" />
          <div className="relative z-10 flex min-h-[420px] flex-col justify-between p-2">
            <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-purple)]">
              In-store kiosk experience
            </p>
            <ul className="mt-6 space-y-4 text-[var(--ink)]">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--gold)]" />
                Consent-first camera capture
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--gold)]" />
                Catalogue or photograph any saree
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--gold)]" />
                English · తెలుగు · हिन्दी
              </li>
            </ul>
            <p className="mt-8 font-[family-name:var(--font-display)] text-lg italic text-[var(--brand-purple)]">
              Built for Andhra Pradesh & Telangana stores first.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

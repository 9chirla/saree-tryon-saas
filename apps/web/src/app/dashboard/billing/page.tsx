"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { AppNav } from "@/components/AppNav";
import { StoreSwitcher } from "@/components/StoreSwitcher";

type Plan = {
  code: string;
  name: string;
  priceInrPaise: number;
  monthlyCredits: number;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingMode, setBillingMode] = useState<string>("");
  const [subscription, setSubscription] = useState<{
    status: string;
    creditsRemaining: number;
    graceUntil?: string | null;
    plan: Plan;
  } | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    fetch("/api/billing/checkout")
      .then((r) => r.json())
      .then((j) => {
        setPlans(j.plans ?? []);
        setBillingMode(j.billingMode);
        setSubscription(j.subscription);
      });
  }, []);

  async function checkout(planCode: string) {
    setCheckoutMsg(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planCode }),
    });
    const j = await res.json();
    if (!res.ok) {
      setCheckoutMsg(j.error || "Checkout failed");
      return;
    }
    if (j.mode === "missing_credentials") {
      setCheckoutMsg(j.message);
      return;
    }
    if (j.mode === "razorpay" && j.checkout && window.Razorpay) {
      const rzp = new window.Razorpay({
        ...j.checkout,
        handler: () => {
          setCheckoutMsg(
            "Checkout completed in Razorpay widget. Subscription activates only after confirmed webhook — refresh shortly.",
          );
        },
      });
      rzp.open();
      return;
    }
    setCheckoutMsg(
      `Razorpay subscription created: ${j.subscriptionId}. Load checkout.js to complete payment in test mode.`,
    );
  }

  return (
    <main className="kiosk-shell min-h-dvh px-4 py-8 md:px-10">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Subscription"
          links={[
            { href: "/dashboard", label: "Overview" },
            { href: "/dashboard/catalogue", label: "Catalogue" },
            { href: "/dashboard/settings", label: "Settings" },
            { href: "/dashboard/billing", label: "Subscription" },
          ]}
        />
        <div className="mb-4">
          <StoreSwitcher />
        </div>
        <section className="panel mb-6">
          <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Billing mode</p>
          <p className="mt-1 text-xl font-semibold">{billingMode}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Checkout script: {scriptReady ? "loaded" : "loading…"} · Live billing never auto-activates.
          </p>
          {subscription && (
            <p className="mt-2 text-[var(--muted)]">
              Current: {subscription.plan.name} · {subscription.status} ·{" "}
              {subscription.creditsRemaining} credits
              {subscription.graceUntil
                ? ` · grace until ${new Date(subscription.graceUntil).toLocaleString("en-GB", { timeZone: "Europe/London" })} Europe/London`
                : ""}
            </p>
          )}
          {billingMode === "missing_credentials" && (
            <p className="mt-3 rounded-xl bg-[rgba(107,30,46,0.08)] px-4 py-3 text-sm">
              Razorpay keys are not configured. Set <code>RAZORPAY_KEY_ID</code> and{" "}
              <code>RAZORPAY_KEY_SECRET</code> for test-mode checkout. No payment is simulated as
              successful.
            </p>
          )}
        </section>
        {checkoutMsg && (
          <p className="mb-4 rounded-xl border border-[rgba(107,30,46,0.2)] bg-white/70 px-4 py-3 text-sm">
            {checkoutMsg}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <article key={p.code} className="panel">
              <h3 className="font-[family-name:var(--font-display)] text-2xl text-[var(--burgundy)]">
                {p.name}
              </h3>
              <p className="mt-2 text-3xl font-semibold">
                ₹{(p.priceInrPaise / 100).toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{p.monthlyCredits} try-ons / month</p>
              <button className="btn-primary mt-6 w-full" onClick={() => void checkout(p.code)}>
                Choose {p.code}
              </button>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

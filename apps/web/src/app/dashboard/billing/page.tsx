"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";

type Plan = {
  code: string;
  name: string;
  priceInrPaise: number;
  monthlyCredits: number;
};

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingMode, setBillingMode] = useState<string>("");
  const [subscription, setSubscription] = useState<{
    status: string;
    creditsRemaining: number;
    plan: Plan;
  } | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);

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
    setCheckoutMsg(`Razorpay subscription created: ${j.subscriptionId}. Complete payment with key ${j.keyId} in test checkout.`);
  }

  return (
    <main className="kiosk-shell min-h-dvh px-4 py-8 md:px-10">
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
        <section className="panel mb-6">
          <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Billing mode</p>
          <p className="mt-1 text-xl font-semibold">{billingMode}</p>
          {subscription && (
            <p className="mt-2 text-[var(--muted)]">
              Current: {subscription.plan.name} · {subscription.status} · {subscription.creditsRemaining} credits
            </p>
          )}
          {billingMode === "missing_credentials" && (
            <p className="mt-3 rounded-xl bg-[rgba(107,30,46,0.08)] px-4 py-3 text-sm">
              Razorpay keys are not configured. Set <code>RAZORPAY_KEY_ID</code> and{" "}
              <code>RAZORPAY_KEY_SECRET</code> for test-mode checkout. No payment is simulated as successful.
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
              <p className="mt-2 text-3xl font-semibold">₹{(p.priceInrPaise / 100).toLocaleString("en-IN")}</p>
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

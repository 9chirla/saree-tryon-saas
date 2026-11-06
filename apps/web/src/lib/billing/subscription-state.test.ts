import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import { subscriptionAllowsTryOn } from "./subscription-state";

describe("subscriptionAllowsTryOn", () => {
  it("allows active demo trialing and past_due grace", () => {
    expect(subscriptionAllowsTryOn(SubscriptionStatus.ACTIVE)).toBe(true);
    expect(subscriptionAllowsTryOn(SubscriptionStatus.DEMO)).toBe(true);
    expect(subscriptionAllowsTryOn(SubscriptionStatus.TRIALING)).toBe(true);
    expect(subscriptionAllowsTryOn(SubscriptionStatus.PAST_DUE)).toBe(true);
  });

  it("blocks cancelled and expired", () => {
    expect(subscriptionAllowsTryOn(SubscriptionStatus.CANCELLED)).toBe(false);
    expect(subscriptionAllowsTryOn(SubscriptionStatus.EXPIRED)).toBe(false);
  });
});

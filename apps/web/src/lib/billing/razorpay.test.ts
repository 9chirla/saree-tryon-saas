import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";

function verify(raw: string, secret: string, signature: string | null) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return expected === signature;
}

describe("razorpay webhook signatures", () => {
  it("accepts valid hmac", () => {
    const body = JSON.stringify({ event: "subscription.activated", id: "evt_1" });
    const secret = "whsec_test";
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verify(body, secret, sig)).toBe(true);
  });

  it("rejects tampered body", () => {
    const secret = "whsec_test";
    const sig = createHmac("sha256", secret).update('{"ok":true}').digest("hex");
    expect(verify('{"ok":false}', secret, sig)).toBe(false);
  });

  it("rejects missing signature", () => {
    expect(verify("{}", "secret", null)).toBe(false);
  });
});

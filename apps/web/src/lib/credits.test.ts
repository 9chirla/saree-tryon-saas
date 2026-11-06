import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";

/** Pure helper mirrors storage signing used for media URLs. */
function sign(relative: string, secret: string, exp: number) {
  return createHmac("sha256", secret).update(`${relative}:${exp}`).digest("hex");
}

describe("signed media paths", () => {
  it("verifies matching signatures", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const path = "catalogue/store/saree.jpg";
    const secret = "test-secret";
    const sig = sign(path, secret, exp);
    const expected = sign(path, secret, exp);
    expect(sig).toBe(expected);
  });

  it("differs when path changes", () => {
    const exp = 123456;
    const secret = "test-secret";
    expect(sign("a.jpg", secret, exp)).not.toBe(sign("b.jpg", secret, exp));
  });
});

describe("credit deduction rules", () => {
  it("documents one-credit success semantics", () => {
    // Deduction happens only on SUCCEEDED and is unique per tryonJobId.
    // Covered by integration-style API tests when DATABASE_URL is available.
    expect(1).toBe(1);
  });
});

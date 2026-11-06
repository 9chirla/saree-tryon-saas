import { describe, expect, it } from "vitest";
import { ExternalApiTryOnProvider } from "./external-provider";

describe("ExternalApiTryOnProvider", () => {
  it("fails closed without credentials", async () => {
    const p = new ExternalApiTryOnProvider();
    await expect(
      p.generateTryOn({
        jobId: "j",
        personImagePath: "a.jpg",
        sareeImagePath: "b.jpg",
        storeId: "s",
      }),
    ).rejects.toThrow(/not configured/i);
  });
});

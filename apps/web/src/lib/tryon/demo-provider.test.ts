import { describe, expect, it } from "vitest";
import { DemoTryOnProvider } from "./demo-provider";

describe("DemoTryOnProvider", () => {
  it("exposes demo name", () => {
    const p = new DemoTryOnProvider();
    expect(p.name).toBe("demo");
  });

  it("returns unknown job as failed status", async () => {
    const p = new DemoTryOnProvider();
    const status = await p.getJobStatus("missing");
    expect(status.status).toBe("FAILED");
  });
});

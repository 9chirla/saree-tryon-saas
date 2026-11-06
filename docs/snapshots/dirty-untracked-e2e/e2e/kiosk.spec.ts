import { test, expect } from "@playwright/test";

/**
 * Minimal kiosk happy-path E2E.
 * Mocks getUserMedia (camera) in-browser; uses demo try-on provider (no external AI).
 */
test.describe("kiosk try-on", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const makeStream = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 1280;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.fillStyle = "#6b3a5c";
        ctx.fillRect(0, 0, 720, 1280);
        ctx.fillStyle = "#e8c36a";
        ctx.fillRect(200, 200, 320, 800);
        // captureStream exists in Chromium
        return (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(
          15,
        );
      };

      const stream = makeStream();
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => stream,
          enumerateDevices: async () => [],
        },
      });

      // Ensure video reports dimensions for canvas capture in KioskApp
      const proto = HTMLVideoElement.prototype;
      Object.defineProperty(proto, "videoWidth", { configurable: true, get: () => 720 });
      Object.defineProperty(proto, "videoHeight", { configurable: true, get: () => 1280 });
    });
  });

  test("loads → consent → capture → try-on → DEMO label", async ({ page }) => {
    await page.goto("/kiosk/demo-silk-house");

    await expect(page.getByRole("button", { name: "Try Your Saree" })).toBeVisible();
    await page.getByRole("button", { name: "Try Your Saree" }).click();

    await expect(page.getByRole("heading", { name: "Camera & privacy consent" })).toBeVisible();
    await expect(
      page.getByText("We need your camera to capture a full-length photo for virtual try-on."),
    ).toBeVisible();
    await page.getByRole("button", { name: "I consent — continue" }).click();

    await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
    await page.getByRole("button", { name: "Start camera" }).click();
    await page.getByRole("button", { name: "Capture" }).click();

    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Select a saree" })).toBeVisible();
    const firstSaree = page.locator("section button").filter({ has: page.locator("img") }).first();
    await expect(firstSaree).toBeVisible();
    await firstSaree.click();
    await page.getByRole("button", { name: "Try selected saree" }).click();

    await expect(page.getByText("Creating your try-on…")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your preview" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("DEMO — not real AI try-on")).toBeVisible();
    await expect(page.getByAltText("Try-on result")).toBeVisible();
  });
});

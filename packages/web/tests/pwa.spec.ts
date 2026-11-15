import { test, expect } from "@playwright/test";

test.describe("PWA requirements", () => {
  test("manifest is present and standalone", async ({ page }) => {
    await page.goto("/");
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveCount(1);

    const manifestHref = await manifestLink.getAttribute("href");
    expect(manifestHref).toBeTruthy();
    const resp = await page.request.get(manifestHref!);
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.display).toBe("standalone");
  });

  test("service worker registers", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const ready = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "no-sw";
      const reg = await navigator.serviceWorker.ready;
      return reg ? "ready" : "not-ready";
    });
    expect(ready).toBe("ready");
  });

  test("wallet shell renders from cache offline after first visit", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.goto("/wallet");
    await page.waitForLoadState("networkidle");
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toContainText(/My Tickets|Sign in to view your tickets|No tickets yet/i);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("required PWA icons are served", async ({ page }) => {
    const paths = [
      "/apple-touch-icon.png",
      "/pwa-192x192.png",
      "/pwa-512x512.png",
      "/maskable-icon-512x512.png",
    ];
    for (const p of paths) {
      const resp = await page.request.get(p);
      expect(resp.status(), `${p} status`).toBe(200);
    }
  });
});

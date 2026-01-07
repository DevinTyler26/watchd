import { test, expect } from "@playwright/test";

test.describe("landing", () => {
  test("shows Watchd hero copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /watch party/i })).toBeVisible({ timeout: 5000 });
  });

  test("shows offline sync banner and clears after reconnect", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      const queued = [
        {
          id: "queued-1",
          url: "/api/watchlist",
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imdbId: "123", type: "movie" }),
          },
          createdAt: Date.now(),
          attempts: 0,
        },
      ];
      window.localStorage.setItem("watchd:offline-queue", JSON.stringify(queued));
    });

    await page.route("**/api/watchlist", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/");

    const queuedBanner = page.getByText(/queued changes/i);
    await expect(queuedBanner).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const offlineBanner = page.getByText(/offline\. changes will sync/i);
    await expect(offlineBanner).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });

    await expect(page.getByText(/syncing changes/i)).toBeVisible();
    await expect(offlineBanner).toBeHidden();
  });
});

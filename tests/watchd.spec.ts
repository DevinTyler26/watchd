import { test, expect } from "@playwright/test";

test.describe("landing", () => {
  test("shows Watchd hero copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /watch party/i })).toBeVisible({ timeout: 5000 });
  });
});

import { test, expect } from "@playwright/test";

const storageState = process.env.E2E_STORAGE_STATE;
const mediaType = process.env.E2E_MEDIA_TYPE ?? "movie";
const hasAuth = process.env.E2E_AUTH === "1";

const missingEnv = !storageState || !hasAuth;

test.describe("authenticated flows", () => {
  test.skip(missingEnv, "Set E2E_STORAGE_STATE, E2E_TMDB_ID, and TMDB_API_KEY to run.");

  test.use({ storageState });

  test("can react, comment, and delete an entry", async ({ page }) => {
    const commentText = `comment-${Date.now()}`;
    const tmdbId = `e2e-${Date.now()}`;
    const response = await page.request.post("/api/test/seed-entry", {
      data: { tmdbId, type: mediaType, title: `E2E ${tmdbId}` },
    });
    const payload = await response.json();
    expect(response.ok()).toBeTruthy();

    const entryId = payload?.entry?.id as string | undefined;
    const entryTitle = payload?.entry?.media?.title as string | undefined;
    expect(entryId).toBeTruthy();
    expect(entryTitle).toBeTruthy();

    await page.goto("/");
    const card = page.locator("article").filter({ hasText: entryTitle! }).first();
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Like" }).first().click();
    await expect(card.getByRole("button", { name: "Like" }).first()).toBeEnabled();

    await card.getByRole("button", { name: "Comments" }).click();
    const textarea = page.getByPlaceholder("Add a comment");
    await textarea.fill(commentText);
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText(commentText, { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByText(commentText, { exact: true }).first()).toBeHidden();

    await page.getByRole("button", { name: "Close" }).click();

    await card.getByRole("button", { name: new RegExp(`^Remove ${entryTitle}$`) }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();
    await expect(card).toBeHidden();
  });
});

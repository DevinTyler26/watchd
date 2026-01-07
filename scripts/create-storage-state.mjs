import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const outputPath =
  process.env.E2E_STORAGE_STATE ??
  path.join(process.cwd(), "tests/.auth/storageState.json");

const dir = path.dirname(outputPath);
fs.mkdirSync(dir, { recursive: true });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`Opening browser at ${baseUrl}`);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

if (process.env.E2E_AUTH === "1") {
  console.log("Using test login endpoint to create session.");
  await page.goto(new URL("/api/test/login", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });
} else {
  console.log("Log in fully, then return here to save storage state.");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await rl.question("Press Enter after you are signed in to save auth state...");
}

await context.storageState({ path: outputPath });
console.log(`Saved storage state to ${outputPath}`);

await browser.close();
rl.close();

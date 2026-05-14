// Authentication E2E checks for login, invalid login, and protected-route redirects.
import { chromium } from "playwright";
import { loginViaApi } from "../helpers/e2e-auth.mjs";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";

async function assertVisible(page, selector, message) {
  const locator = page.locator(selector).first();
  if (!await locator.isVisible()) {
    throw new Error(message);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(`${WEB_BASE}/login`, { waitUntil: "domcontentloaded" });
    await assertVisible(page, 'input[type="email"], input[name="email"]', "Login email input not visible.");
    await assertVisible(page, 'input[type="password"], input[name="password"]', "Login password input not visible.");

    await page.fill('input[type="email"], input[name="email"]', "admin@hopefoundation.org");
    await page.fill('input[type="password"], input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1200);

    const stillOnLogin = page.url().includes("/login");
    if (!stillOnLogin) {
      throw new Error("Invalid login unexpectedly navigated away from /login.");
    }

    // Protected route should force unauthenticated users back to login.
    await page.goto(`${WEB_BASE}/watchdog`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    if (!page.url().includes("/login")) {
      throw new Error("Unauthenticated /watchdog access did not redirect to /login.");
    }

    // API-based login should establish session and allow protected route access.
    await loginViaApi(page, { webBase: WEB_BASE });
    await page.goto(`${WEB_BASE}/watchdog`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    if (page.url().includes("/login")) {
      throw new Error("Authenticated session could not access /watchdog.");
    }

    const bodyText = await page.locator("body").innerText();
    if (/application error|this page could not be found/i.test(bodyText)) {
      throw new Error("Fatal error marker rendered on /watchdog after auth.");
    }

    console.log("Auth E2E checks passed.");
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("Auth E2E failed:", error);
  process.exit(1);
});

/**
 * LiveCom UI e2e smoke script.
 * Validates create -> inbox update -> constituent timeline visibility in the browser.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";

/** Logs in through the real UI and waits until we leave /login. */
async function login(page) {
  await page.goto(`${WEB_BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 45000 });
  await page.fill('input[type="email"], input[name="email"]', "admin@hopefoundation.org");
  await page.fill('input[type="password"], input[name="password"]', "admin123!");
  await page.click('button[type="submit"]');

  // Setup checks and workspace landing-path resolution can delay navigation after submit.
  const timeoutMs = 45000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!page.url().includes("/login")) {
      return;
    }

    const hasError = await page.getByText(/login failed|session expired|invalid/i).count();
    if (hasError > 0) {
      throw new Error("Login failed with visible error message on the form.");
    }

    await page.waitForTimeout(500);
  }

  throw new Error("Login did not leave /login within 45s.");
}

/** Fails fast if the current URL is unexpectedly the login route. */
function assertAuthed(url) {
  if (url.includes("/login")) {
    throw new Error(`Expected authenticated page, but was redirected to login: ${url}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();

    await login(page);

    await page.goto(`${WEB_BASE}/livecom`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    assertAuthed(page.url());

    const heading = page.getByRole("heading", { name: "LiveCom" });
    if (!await heading.isVisible()) {
      throw new Error("LiveCom heading is not visible.");
    }

    const uniqueText = `LiveCom e2e ${Date.now()}`;
    const constituentSelect = page.getByLabel("Constituent");
    const allOptions = await constituentSelect.locator("option").all();

    if (allOptions.length < 2) {
      throw new Error("Constituent selector does not contain selectable options.");
    }

    // Select the first non-placeholder constituent option.
    await constituentSelect.selectOption({ index: 1 });

    await page.getByLabel("Interaction Detail").fill(`Donor follow-up requested. ${uniqueText}`);
    await page.getByRole("button", { name: "Save Interaction" }).click();

    const interactionRow = page.locator("table tbody tr", { hasText: uniqueText }).first();
    await interactionRow.waitFor({ state: "visible", timeout: 15000 });

    const statusSelect = interactionRow.locator("select").first();
    const ownerInput = interactionRow.locator('input[placeholder="Unassigned"]').first();

    await statusSelect.selectOption("IN_PROGRESS");
    await ownerInput.fill("E2E Steward Owner");

    const saveButton = interactionRow.getByRole("button", { name: "Save" });
    await saveButton.click();

    await interactionRow.getByText("In Progress", { exact: false }).first().waitFor({ timeout: 15000 });

    const donorLink = interactionRow.locator('a[href^="/constituents/"]').first();
    await donorLink.click();
    await page.waitForLoadState("domcontentloaded");
    assertAuthed(page.url());

    const timelineTab = page.getByRole("button", { name: /Timeline \(/ });
    await timelineTab.click();

    await page.getByText(uniqueText, { exact: false }).first().waitFor({ timeout: 15000 });
    console.log("LiveCom UI smoke passed.");

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("LiveCom UI smoke failed:", error);
  process.exit(1);
});

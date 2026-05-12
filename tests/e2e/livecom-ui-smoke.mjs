/**
 * LiveCom UI e2e smoke script.
 * Validates create -> inbox update -> constituent timeline visibility in the browser.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3650";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";

/** Attempts to recover the current browser session by rotating refresh cookie once. */
async function recoverSessionViaRefresh(page) {
  try {
    const response = await page.request.post(`${API_BASE}/api/auth/refresh`);
    return response.ok();
  } catch {
    return false;
  }
}

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

    const hasRateLimit = await page.getByText(/too many auth attempts|too many requests|rate limit/i).count();
    if (hasRateLimit > 0) {
      throw new Error("Login is currently rate-limited.");
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

/** Waits for interaction row visibility or throws on visible save failures. */
async function waitForInteractionRow(page, interactionRow, timeoutMs = 36500) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (page.url().includes("/login")) {
      throw new Error("Session dropped to /login while waiting for LiveCom interaction to appear.");
    }

    if (await interactionRow.count()) {
      await interactionRow.first().waitFor({ state: "visible", timeout: 5000 });
      return;
    }

    const saveFailureVisible = await page
      .getByText(/failed to save interaction|select a constituent|interaction detail is required/i)
      .count();
    if (saveFailureVisible > 0) {
      const bodyText = await page.locator("body").innerText();
      throw new Error(`LiveCom save interaction failed: ${bodyText.slice(0, 300)}`);
    }

    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for LiveCom interaction row to appear.");
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();

    await login(page);

    await page.goto(`${WEB_BASE}/livecom`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    if (page.url().includes("/login")) {
      const refreshed = await recoverSessionViaRefresh(page);
      if (refreshed) {
        await page.goto(`${WEB_BASE}/livecom`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
      }
    }

    assertAuthed(page.url());

    const heading = page.getByRole("heading", { name: "LiveCom" });
    if (!await heading.isVisible()) {
      throw new Error("LiveCom heading is not visible.");
    }

    const uniqueText = `LiveCom e2e ${Date.now()}`;
    const constituentSelect = page.getByLabel("Constituent");
    let optionCount = 0;
    const optionsWaitStarted = Date.now();

    while (Date.now() - optionsWaitStarted < 36500) {
      optionCount = await constituentSelect.locator("option").count();
      if (optionCount >= 2) {
        break;
      }
      await page.waitForTimeout(400);
    }

    if (optionCount < 2) {
      throw new Error("Constituent selector does not contain selectable options.");
    }

    // Select the first non-placeholder constituent option.
    await constituentSelect.selectOption({ index: 1 });

    await page.getByLabel("Interaction Detail").fill(`Donor follow-up requested. ${uniqueText}`);
    await page.getByRole("button", { name: "Save Interaction" }).click();

    const interactionRow = page.locator("table tbody tr", { hasText: uniqueText }).first();
    await waitForInteractionRow(page, interactionRow, 36500);

    const statusSelect = interactionRow.locator("select").first();
    const ownerInput = interactionRow.locator('input[placeholder="Unassigned"]').first();

    await statusSelect.selectOption("IN_PROGRESS");
    await ownerInput.fill("E2E Steward Owner");

    const saveButton = interactionRow.getByRole("button", { name: "Save" });
    await saveButton.click();

    await interactionRow.getByText("In Progress", { exact: false }).first().waitFor({ timeout: 36500 });

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

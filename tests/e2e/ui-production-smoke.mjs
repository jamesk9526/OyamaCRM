// Browser-driven production-smoke script for critical cross-module UI workflows.
import { chromium } from "playwright";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";

/** Promise-based delay used by retry flows in this e2e script. */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Safely parses one JSON response body. */
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/** Throws if the API response is not 2xx and returns parsed JSON otherwise. */
async function expectJsonOk(response, step) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok) {
    throw new Error(`${step} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

/** Login via API and return an access token for setup calls. */
async function getAdminToken() {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@hopefoundation.org", password: "admin123!" }),
    });

    const body = await readJson(response);

    if (response.status === 429 && attempt < maxAttempts) {
      const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
      const waitMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : attempt * 1500;
      await delay(waitMs);
      continue;
    }

    if (!response.ok) {
      throw new Error(`API login failed: ${response.status} ${JSON.stringify(body)}`);
    }

    const token = body?.data?.accessToken;
    if (!token) {
      throw new Error("API login succeeded but no access token was returned.");
    }

    return token;
  }

  throw new Error("API login failed after retries.");
}

/** Checks for obvious runtime error surfaces after a route navigation. */
async function assertHealthyRoute(page, route, allowRelogin = true) {
  console.log(`[e2e] checking route ${route}`);
  await goToAuthedRoute(page, route);

  const currentUrl = page.url();
  if (currentUrl.includes("/login")) {
    console.warn(`[e2e] route ${route} redirected to login, attempting session recovery`);
    if (allowRelogin) {
      const refreshed = await recoverSessionViaRefresh(page);
      if (refreshed) {
        await assertHealthyRoute(page, route, false);
        return;
      }

      const apiRelogin = await reloginViaBrowserApi(page);
      if (apiRelogin) {
        await assertHealthyRoute(page, route, false);
        return;
      }

      throw new Error(`Protected route redirected to login and session recovery failed: ${route}`);
    }
    throw new Error(`Protected route redirected to login: ${route}`);
  }

  const bodyText = await page.locator("body").innerText();
  const fatalMarkers = [
    "Application error",
    "This page could not be found",
    "An error occurred",
  ];
  for (const marker of fatalMarkers) {
    if (bodyText.includes(marker)) {
      throw new Error(`Route ${route} rendered fatal marker: ${marker}`);
    }
  }
}

/** Returns true when the current page URL matches the requested route path. */
function pathMatches(page, route) {
  const pathname = new URL(page.url()).pathname;
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Tries in-app client navigation first, then falls back to full route load. */
async function goToAuthedRoute(page, route) {
  if (pathMatches(page, route)) {
    await page.waitForTimeout(500);
    return;
  }

  const link = page.locator(`a[href="${route}"]`).first();
  if (await link.count()) {
    try {
      await link.click();
      await page.waitForTimeout(1200);
      if (pathMatches(page, route)) {
        await page.waitForLoadState("networkidle").catch(() => {});
        return;
      }
    } catch {
      // Fall through to direct navigation when link click is unavailable or blocked.
    }
  }

  await page.goto(`${WEB_BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Attempts to recover the current browser session by rotating the refresh cookie once. */
async function recoverSessionViaRefresh(page) {
  try {
    const response = await page.request.post(`${API_BASE}/api/auth/refresh`);
    if (!response.ok()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Uses API login inside the current browser context to restore session cookies without UI form retries. */
async function reloginViaBrowserApi(page) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await page.request.post(`${API_BASE}/api/auth/login`, {
        data: {
          email: "admin@hopefoundation.org",
          password: "admin123!",
        },
      });

      if (response.status() === 429 && attempt < maxAttempts) {
        const headers = response.headers();
        const retryAfterSeconds = Number(headers["retry-after"] ?? "0");
        const waitMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : attempt * 1500;
        await page.waitForTimeout(waitMs);
        continue;
      }

      if (!response.ok()) {
        return false;
      }

      // Trigger one authenticated app load so AuthProvider can restore via refresh cookie.
      await page.goto(`${WEB_BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      return !page.url().includes("/login");
    } catch {
      if (attempt >= maxAttempts) {
        return false;
      }
      await page.waitForTimeout(attempt * 1000);
    }
  }

  return false;
}

async function runBrowserChecks() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();

    await loginViaUi(page);

    const criticalRoutes = [
      "/",
      "/constituents",
      "/donations",
      "/campaigns",
      "/communications",
      "/events/workspace",
      "/events/reports",
      "/events/page-builder",
      "/events/templates",
      "/settings",
      "/data-tools/import",
    ];

    for (const route of criticalRoutes) {
      await assertHealthyRoute(page, route);
    }

    const state = await context.storageState();
    const mobileContext = await browser.newContext({
      storageState: state,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${WEB_BASE}/events/workspace`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForLoadState("networkidle").catch(() => {});

    if (mobilePage.url().includes("/login")) {
      const refreshed = await recoverSessionViaRefresh(mobilePage);
      if (refreshed) {
        await mobilePage.goto(`${WEB_BASE}/events/workspace`, { waitUntil: "domcontentloaded" });
        await mobilePage.waitForLoadState("networkidle").catch(() => {});
      }
    }

    if (mobilePage.url().includes("/login")) {
      throw new Error("Mobile session unexpectedly redirected to login on events workspace route.");
    }

    const overflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 4;
    });
    if (overflow) {
      throw new Error("Mobile layout has horizontal overflow on /events/workspace.");
    }

    await mobileContext.close();
    await context.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  await runBrowserChecks();
  console.log("E2E production smoke passed.");
}

main().catch((err) => {
  console.error("E2E production smoke failed:", err);
  process.exit(1);
});

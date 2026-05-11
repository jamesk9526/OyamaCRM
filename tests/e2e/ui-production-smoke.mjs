// Browser-driven production-smoke script for critical cross-module UI workflows.
import { chromium } from "playwright";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";

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
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@hopefoundation.org", password: "admin123!" }),
  });
  const body = await expectJsonOk(response, "API login");
  const token = body?.data?.accessToken;
  if (!token) {
    throw new Error("API login succeeded but no access token was returned.");
  }
  return token;
}

/** Ensures public scheduling widget is enabled with predictable smoke-test availability. */
async function configureWidget(token) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(0, 0, 0, 0);
  const widgetToken = `e2e-widget-${Date.now()}`;

  const response = await fetch(`${API_BASE}/api/compassion/appointment-widget`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      enabled: true,
      config: {
        enabled: true,
        token: widgetToken,
        slotIntervalMinutes: 30,
        appointmentDurationMinutes: 30,
        minLeadHours: 0,
        maxAdvanceDays: 120,
        locationOptions: ["Main Office"],
        availabilityBlocks: [
          {
            id: "e2e-public-slot-block",
            dayOfWeek: tomorrow.getDay(),
            startTime: "09:00",
            endTime: "11:00",
            location: "Main Office",
            appointmentType: "ANY",
            capacity: 2,
            isActive: true,
          },
        ],
        blackoutDates: [],
      },
    }),
  });

  await expectJsonOk(response, "Widget setup");
  return widgetToken;
}

/** Checks for obvious runtime error surfaces after a route navigation. */
async function assertHealthyRoute(page, route) {
  await page.goto(`${WEB_BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const currentUrl = page.url();
  if (currentUrl.includes("/login")) {
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

/** Runs desktop + mobile browser smoke checks across key route groups. */
async function runBrowserChecks(widgetToken) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${WEB_BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"], input[name="email"]', "admin@hopefoundation.org");
    await page.fill('input[type="password"]', "admin123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15000 });

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
      "/compassion/dashboard",
      "/compassion/clients",
      "/compassion/settings",
      "/settings",
      "/data-tools/import",
    ];

    for (const route of criticalRoutes) {
      await assertHealthyRoute(page, route);
    }

    await page.goto(`${WEB_BASE}/compassion/public/appointments/${widgetToken}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const submitDisabled = await page.locator('button[type="submit"]').isDisabled();
    if (!submitDisabled) {
      throw new Error("Public appointment submit button should be disabled before required form fields are completed.");
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
  const token = await getAdminToken();
  const widgetToken = await configureWidget(token);
  await runBrowserChecks(widgetToken);
  console.log("E2E production smoke passed.");
}

main().catch((err) => {
  console.error("E2E production smoke failed:", err);
  process.exit(1);
});

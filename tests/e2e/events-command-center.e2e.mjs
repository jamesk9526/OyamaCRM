// Events CRM command-center E2E coverage across scoped routes and compatibility redirects.
import { chromium } from "playwright";
import { loginViaApi } from "../helpers/e2e-auth.mjs";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";

const FATAL_MARKER_REGEX = /application error|this page could not be found|an error occurred/i;

/** Returns true when body text contains a known fatal route marker. */
function hasFatalMarker(text) {
  return FATAL_MARKER_REGEX.test(text);
}

/** Logs in through API and returns a bearer token for setup/discovery calls. */
async function getAdminToken() {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@hopefoundation.org",
      password: "admin123!",
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Failed to login for Events E2E setup: ${response.status} ${JSON.stringify(body)}`);
  }

  const token = body?.data?.accessToken;
  if (!token) {
    throw new Error("Events E2E setup login succeeded but no access token was returned.");
  }

  return String(token);
}

/** Loads one route and validates it stays authenticated and avoids fatal UI markers. */
async function assertHealthyRoute(page, route) {
  const target = `${WEB_BASE}${route}`;
  console.log(`[events-e2e] ${route}`);

  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  if (page.url().includes("/login")) {
    await loginViaApi(page, { webBase: WEB_BASE, apiBase: API_BASE });
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  if (page.url().includes("/login")) {
    throw new Error(`Route redirected to login: ${route}`);
  }

  const bodyText = await page.locator("body").innerText();
  if (hasFatalMarker(bodyText)) {
    throw new Error(`Route rendered a fatal marker: ${route}`);
  }
}

/** Uses API session cookies to pick an existing event, or creates one if none exist. */
async function getOrCreateEventId(page, token) {
  const authHeaders = { Authorization: `Bearer ${token}` };

  const listResponse = await page.request.get(`${API_BASE}/api/events`, {
    headers: authHeaders,
  });
  if (!listResponse.ok()) {
    const body = await listResponse.text();
    throw new Error(`Failed to list events: ${listResponse.status()} ${body}`);
  }

  const payload = await listResponse.json().catch(() => []);
  const events = Array.isArray(payload) ? payload : [];
  const existing = events.find((row) => row?.id && row?.active !== false) || events[0];
  if (existing?.id) {
    return String(existing.id);
  }

  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const createResponse = await page.request.post(`${API_BASE}/api/events`, {
    headers: authHeaders,
    data: {
      name: `E2E Command Center ${Date.now()}`,
      type: "GALA",
      status: "DRAFT",
      startDate,
      location: "E2E Coverage Venue",
      capacity: 120,
      revenueGoal: 25000,
    },
  });

  if (!createResponse.ok()) {
    const body = await createResponse.text();
    throw new Error(`Failed to create event for E2E: ${createResponse.status()} ${body}`);
  }

  const created = await createResponse.json().catch(() => null);
  if (!created?.id) {
    throw new Error("Created event response did not include an event id.");
  }

  return String(created.id);
}

/** Validates legacy global page-builder URL redirects into scoped event route. */
async function assertPageBuilderCompatibilityRedirect(page, eventId) {
  const compatUrl = `${WEB_BASE}/events/page-builder?eventId=${encodeURIComponent(eventId)}`;

  await page.goto(compatUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const pathname = new URL(page.url()).pathname;
  const expected = `/events/${eventId}/event-page`;

  if (pathname !== expected) {
    throw new Error(`Expected compatibility redirect to ${expected}, got ${pathname}`);
  }
}

/** Performs one compact-desktop/mobile overflow check for event overview. */
async function assertMobileNoPageOverflow(browser, storageState, eventId) {
  const mobileContext = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();

  try {
    const route = `/events/${eventId}/overview`;
    await mobilePage.goto(`${WEB_BASE}${route}`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForLoadState("networkidle").catch(() => {});

    if (mobilePage.url().includes("/login")) {
      await loginViaApi(mobilePage, { webBase: WEB_BASE, apiBase: API_BASE });
      await mobilePage.goto(`${WEB_BASE}${route}`, { waitUntil: "domcontentloaded" });
      await mobilePage.waitForLoadState("networkidle").catch(() => {});
    }

    if (mobilePage.url().includes("/login")) {
      throw new Error("Mobile event overview route redirected to login.");
    }

    const overflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 4;
    });

    if (overflow) {
      throw new Error("Mobile event overview has page-level horizontal overflow.");
    }
  } finally {
    await mobilePage.close();
    await mobileContext.close();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  try {
    const token = await getAdminToken();
    await loginViaApi(page, { webBase: WEB_BASE, apiBase: API_BASE });

    const eventId = await getOrCreateEventId(page, token);

    const routes = [
      "/events/workspace",
      "/events/events",
      `/events/${eventId}/overview`,
      `/events/${eventId}/guests`,
      `/events/${eventId}/tickets`,
      `/events/${eventId}/tables`,
      `/events/${eventId}/hosts`,
      `/events/${eventId}/sponsors`,
      `/events/${eventId}/donations`,
      `/events/${eventId}/check-in`,
      `/events/${eventId}/emails`,
      `/events/${eventId}/reports`,
      `/events/${eventId}/follow-up`,
      `/events/${eventId}/settings`,
      `/events/${eventId}/event-page`,
    ];

    for (const route of routes) {
      await assertHealthyRoute(page, route);
    }

    await assertPageBuilderCompatibilityRedirect(page, eventId);

    const state = await context.storageState();
    await assertMobileNoPageOverflow(browser, state, eventId);

    console.log("Events command-center E2E checks passed.");
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("Events command-center E2E failed:", error);
  process.exit(1);
});

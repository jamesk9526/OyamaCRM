// Shared Playwright auth helper with API-first login fallback.

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Logs into OyamaCRM using API auth and returns session status. */
export async function loginViaApi(page, options = {}) {
  const apiBase = options.apiBase || process.env.E2E_API_BASE_URL || "http://localhost:4000";
  const webBase = options.webBase || process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
  const email = options.email || "admin@hopefoundation.org";
  const password = options.password || "admin123!";

  let response = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await page.request.post(`${apiBase}/api/auth/login`, {
      data: { email, password },
    });

    if (response.ok()) break;
    if (response.status() !== 429) {
      const body = await response.text();
      throw new Error(`E2E auth login failed: ${response.status()} ${body}`);
    }

    await delay(400 * (attempt + 1));
  }

  if (!response || !response.ok()) {
    const body = response ? await response.text() : "No response";
    const status = response ? response.status() : "unknown";
    throw new Error(`E2E auth login failed after retries: ${status} ${body}`);
  }

  await page.goto(`${webBase}/`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const me = await page.request.get(`${apiBase}/api/auth/me`);
  if (me.ok()) {
    return;
  }

  if (page.url().includes("/login")) {
    // Fallback to UI login if API cookie handoff did not establish a browser-authenticated session.
    await page.goto(`${webBase}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle").catch(() => {});

    const startedAt = Date.now();
    while (Date.now() - startedAt < 30000) {
      const meAfterFallback = await page.request.get(`${apiBase}/api/auth/me`);
      if (meAfterFallback.ok()) return;
      await delay(300);
    }

    throw new Error("E2E auth login succeeded but browser session stayed unauthenticated.");
  }

  // Non-login route but still unauthenticated means cookie handoff failed.
  throw new Error("E2E auth login did not establish an authenticated browser session.");
}

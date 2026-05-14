// Shared Playwright auth helper with API-first login fallback.

/** Logs into OyamaCRM using API auth and returns session status. */
export async function loginViaApi(page, options = {}) {
  const apiBase = options.apiBase || process.env.E2E_API_BASE_URL || "http://localhost:4000";
  const webBase = options.webBase || process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
  const email = options.email || "admin@hopefoundation.org";
  const password = options.password || "admin123!";

  const response = await page.request.post(`${apiBase}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`E2E auth login failed: ${response.status()} ${body}`);
  }

  await page.goto(`${webBase}/`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  if (page.url().includes("/login")) {
    throw new Error("E2E auth login succeeded but browser session stayed unauthenticated.");
  }
}

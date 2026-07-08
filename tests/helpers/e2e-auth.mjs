// Shared Playwright auth helper with API-first login fallback.

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Logs into OyamaCRM using API auth and returns session status. */
export async function loginViaApi(page, options = {}) {
  const apiBase = options.apiBase || process.env.E2E_API_BASE_URL || "http://localhost:4000";
  const webBase = options.webBase || process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
  const probePath = options.probePath || "/constituents";
  const email = options.email || "admin@hopefoundation.org";
  const password = options.password || "admin123!";
  const maxAttempts = Number(options.maxAttempts ?? 8);
  const loginCandidates = Array.from(
    new Set(
      [
        options.loginUrl,
        `${webBase}/api/auth/login`,
        `${apiBase}/api/auth/login`,
      ].filter(Boolean)
    )
  );

  const isAuthenticatedInBrowser = async () => {
    await page.goto(`${webBase}${probePath}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    return !page.url().includes("/login");
  };

  for (const loginUrl of loginCandidates) {
    let response = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        response = await page.request.post(loginUrl, {
          data: { email, password },
        });
      } catch {
        response = null;
        break;
      }

      if (response.ok()) break;

      if (response.status() === 404 || response.status() === 405) {
        // Some environments expose auth login only on apiBase.
        response = null;
        break;
      }

      if (response.status() !== 429) {
        const body = await response.text();
        throw new Error(`E2E auth login failed: ${response.status()} ${body}`);
      }

      const retryAfterHeader = response.headers()["retry-after"];
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const backoffMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(500, retryAfterSeconds * 1000)
        : Math.min(15000, 750 * 2 ** attempt);
      await delay(backoffMs);
    }

    if (response?.ok()) {
      break;
    }
  }

  if (await isAuthenticatedInBrowser()) {
    return;
  }

  // Fallback to UI login if API cookie handoff did not establish a browser-authenticated session.
  await page.goto(`${webBase}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle").catch(() => {});

  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    if (await isAuthenticatedInBrowser()) return;
    await delay(300);
  }

  throw new Error("E2E auth login succeeded but browser session stayed unauthenticated.");
}

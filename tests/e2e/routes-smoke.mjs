// Route smoke checks across major module surfaces.
import { chromium } from "playwright";
import { loginViaApi } from "../helpers/e2e-auth.mjs";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";

const ROUTES = [
  "/",
  "/constituents",
  "/donations",
  "/campaigns",
  "/communications",
  "/letters-printables",
  "/steward-paths",
  "/steward-paths/builder",
  "/automations",
  "/reports",
  "/data-tools",
  "/settings",
  "/compassion/dashboard",
  "/compassion/clients",
  "/events/workspace",
  "/events/events",
  "/hrm",
  "/watchdog",
  "/watchdog/backups",
  "/watchdog/restore",
  "/watchdog/vault",
  "/watchdog/security",
  "/watchdog/health",
  "/watchdog/audit",
  "/watchdog/runbooks",
  "/watchdog/settings",
  "/webmaster",
  "/apps",
  "/apps/trivia",
];

function hasFatal(text) {
  return /application error|this page could not be found|an error occurred/i.test(text);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  const failures = [];

  try {
    await loginViaApi(page, { webBase: WEB_BASE });

    for (const route of ROUTES) {
      const target = `${WEB_BASE}${route}`;
      console.log(`[routes-smoke] ${route}`);

      await page.goto(target, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});

      if (page.url().includes("/login")) {
        try {
          await loginViaApi(page, { webBase: WEB_BASE });
          await page.goto(target, { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle").catch(() => {});
        } catch {
          failures.push({ route, reason: "redirected to login (session recovery failed)" });
          continue;
        }

        if (page.url().includes("/login")) {
          failures.push({ route, reason: "redirected to login" });
          continue;
        }
      }

      const body = await page.locator("body").innerText();
      if (hasFatal(body)) {
        failures.push({ route, reason: "fatal marker rendered" });
        continue;
      }
    }

    if (failures.length > 0) {
      throw new Error(`Route smoke failures: ${JSON.stringify(failures, null, 2)}`);
    }

    console.log("Route smoke checks passed.");
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("Route smoke failed:", error);
  process.exit(1);
});

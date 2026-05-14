// Watchdog route and safety E2E checks.
import { chromium } from "playwright";
import { loginViaApi } from "../helpers/e2e-auth.mjs";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  try {
    await loginViaApi(page, { webBase: WEB_BASE, apiBase: API_BASE });

    for (const route of [
      "/watchdog",
      "/watchdog/backups",
      "/watchdog/restore",
      "/watchdog/vault",
      "/watchdog/security",
      "/watchdog/health",
      "/watchdog/audit",
      "/watchdog/runbooks",
      "/watchdog/settings",
    ]) {
      await page.goto(`${WEB_BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});

      if (page.url().includes("/login")) {
        throw new Error(`Authenticated watchdog route redirected to login: ${route}`);
      }

      const body = await page.locator("body").innerText();
      if (/application error|this page could not be found/i.test(body)) {
        throw new Error(`Watchdog route rendered fatal marker: ${route}`);
      }
    }

    const restoreExecute = await page.request.post(`${API_BASE}/api/watchdog/ops/restore/execute`, {
      data: {
        backupId: "invalid",
        dryRunId: "invalid",
        confirmationText: "invalid",
        reason: "e2e safety guard",
        execute: false,
      },
    });

    // Execute=false guard should block destructive restore execution requests.
    if (restoreExecute.status() !== 400) {
      throw new Error(`Restore guard expected 400, got ${restoreExecute.status()}`);
    }

    const vaultList = await page.request.get(`${API_BASE}/api/watchdog/vault`);
    if (!vaultList.ok()) {
      throw new Error(`Watchdog vault list failed: ${vaultList.status()}`);
    }

    const payload = await vaultList.json();
    const first = payload?.items?.[0];
    if (first && Object.prototype.hasOwnProperty.call(first, "password")) {
      throw new Error("Vault list exposed raw password field.");
    }

    console.log("Watchdog E2E checks passed.");
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("Watchdog E2E failed:", error);
  process.exit(1);
});

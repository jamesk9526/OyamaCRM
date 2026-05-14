// E2E checks for setup infrastructure fields and Watchdog confirmation-gated database settings.
import { chromium } from "playwright";
import { loginViaApi } from "../helpers/e2e-auth.mjs";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";
const WATCHDOG_CONFIRMATION = "I UNDERSTAND THIS WILL CHANGE DATABASE SETTINGS";

async function runSetupInfrastructureFlow(page) {
  let setupPayload = null;

  await page.route(`${API_BASE}/api/setup/status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { setupCompleted: false },
      }),
    });
  });

  await page.route(`${API_BASE}/api/setup/complete`, async (route) => {
    setupPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          setupCompleted: true,
          organizationId: "org_e2e",
          adminUserId: "user_e2e",
        },
      }),
    });
  });

  await page.goto(`${WEB_BASE}/setup`, { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Organization Name").fill("E2E Steward Foundation");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Configure database and environment values later").uncheck();
  await page.getByLabel("Primary DATABASE_URL").fill("mysql://root:pass@localhost:3306/oyamacrm_test");
  await page.getByLabel("WATCHDOG_DATABASE_URL").fill("mysql://root:pass@localhost:3306/oyama_watchdog_test");
  await page.getByLabel("WATCHDOG_ENCRYPTION_KEY").fill("watchdog-e2e-key-123456789");
  await page.getByLabel("JWT_SECRET").fill("watchdog-e2e-jwt-secret-123");
  await page.getByLabel("NEXT_PUBLIC_API_URL").fill("http://localhost:4999");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("First Name").fill("E2E");
  await page.getByLabel("Last Name").fill("Admin");
  await page.getByLabel("Admin Email").fill("e2e.setup.admin@example.org");
  await page.getByLabel("Admin Password").fill("StrongPass123!");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Complete Setup" }).click();

  if (!setupPayload || typeof setupPayload !== "object") {
    throw new Error("Setup completion payload was not captured.");
  }

  const environment = setupPayload.environment || {};
  if (environment.databaseUrl !== "mysql://root:pass@localhost:3306/oyamacrm_test") {
    throw new Error("Setup payload did not include expected databaseUrl.");
  }
  if (environment.watchdogDatabaseUrl !== "mysql://root:pass@localhost:3306/oyama_watchdog_test") {
    throw new Error("Setup payload did not include expected watchdogDatabaseUrl.");
  }
  if (environment.watchdogEncryptionKey !== "watchdog-e2e-key-123456789") {
    throw new Error("Setup payload did not include expected watchdogEncryptionKey.");
  }
}

async function runWatchdogConfirmationFlow(page) {
  let capturedSavePayload = null;

  await page.route(`${API_BASE}/api/watchdog/ops/database-config`, async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }

    capturedSavePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        updatedKeys: ["NEXT_PUBLIC_API_URL"],
        requiresServiceRestart: true,
        config: {
          databaseUrlConfigured: true,
          watchdogDatabaseUrlMasked: "mysql...1234",
          watchdogDatabaseConfigured: true,
          watchdogEncryptionConfigured: true,
          jwtSecretConfigured: true,
          nextPublicApiUrl: "http://localhost:4000",
        },
        environment: "non-production",
        warnings: {
          environmentMessage: "Non-production mode: settings changes are useful for local/staging validation.",
          permissionMessage: "Current role: admin. This action is restricted to admins with watchdog.settings.manage permission.",
        },
        watchdogHealth: {
          configured: true,
          connected: true,
          encryptionReady: true,
          message: "ok",
        },
        confirmationText: WATCHDOG_CONFIRMATION,
      }),
    });
  });

  await page.goto(`${WEB_BASE}/watchdog/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const invalidUpdate = await page.request.put(`${API_BASE}/api/watchdog/ops/database-config`, {
    data: {
      confirmationText: "invalid",
      nextPublicApiUrl: "http://localhost:4555",
    },
  });

  if (invalidUpdate.status() !== 400) {
    throw new Error(`Expected confirmation guard to return 400, got ${invalidUpdate.status()}`);
  }

  await page.getByLabel("NEXT_PUBLIC_API_URL").fill("http://localhost:4555");
  await page.getByLabel("Confirmation phrase").fill(WATCHDOG_CONFIRMATION);

  await page.getByRole("button", { name: "Save Database Settings" }).click();
  await page.getByRole("heading", { name: "Are you sure?" }).waitFor({ state: "visible" });

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("heading", { name: "Are you sure?" }).waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "Save Database Settings" }).click();
  await page.getByRole("button", { name: "Yes, update settings" }).click();

  if (!capturedSavePayload || capturedSavePayload.confirmationText !== WATCHDOG_CONFIRMATION) {
    throw new Error("Watchdog save payload was not captured with the typed confirmation phrase.");
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });

  const setupPage = await context.newPage();
  try {
    await runSetupInfrastructureFlow(setupPage);
  } finally {
    await setupPage.close();
  }

  const watchdogPage = await context.newPage();
  try {
    await loginViaApi(watchdogPage, { webBase: WEB_BASE, apiBase: API_BASE });
    await runWatchdogConfirmationFlow(watchdogPage);
    console.log("Setup + Watchdog confirmation E2E checks passed.");
  } finally {
    await watchdogPage.close();
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("Setup + Watchdog E2E failed:", error);
  process.exit(1);
});

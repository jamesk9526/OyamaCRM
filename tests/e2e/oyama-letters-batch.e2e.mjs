// OyamaLetters batch generation E2E coverage for the real multi-recipient wizard.
import { chromium } from "playwright";
import { loginViaApi } from "../helpers/e2e-auth.mjs";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";

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

async function getAdminToken() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@hopefoundation.org", password: "admin123!" }),
    });
    if (response.status === 429 && attempt < 6) {
      const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
      const waitMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : attempt * 1500;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }
    const body = await expectJsonOk(response, "Admin login");
    const token = body?.data?.accessToken;
    if (!token) throw new Error("Admin login did not return an access token.");
    return token;
  }
  throw new Error("Admin login failed after retries.");
}

async function seedBatchRun(token) {
  const suffix = Date.now();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  await expectJsonOk(await fetch(`${API_BASE}/api/letters/workflow-settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      autoQueueBatchToPrint: true,
      requirePrintApproval: true,
      defaultPriority: "NORMAL",
      mailingSlaDays: 7,
      allowDirectMailQueue: false,
      enableAddressValidationGate: true,
      pdfFallbackMode: "SERVER_RENDER",
      notes: "E2E batch generation policy",
    }),
  }), "Workflow policy setup");

  const template = await expectJsonOk(await fetch(`${API_BASE}/api/letters/templates`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `E2E Batch Template ${suffix}`,
      category: "THANK_YOU",
      status: "ACTIVE",
      printBody: "Dear {{donor.firstName}}, thank you for supporting {{organization.name}}.",
      emailBody: "Thanks {{donor.firstName}}.",
    }),
  }), "Template setup");

  const constituentIds = [];
  for (let index = 1; index <= 3; index += 1) {
    const row = await expectJsonOk(await fetch(`${API_BASE}/api/constituents`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        firstName: `E2E${index}`,
        lastName: `Batch${suffix}`,
        email: `e2e-batch-${suffix}-${index}@example.org`,
        addressLine1: `${100 + index} Main St`,
        city: "Springfield",
        state: "IL",
        zip: "62701",
        type: "DONOR",
      }),
    }), `Constituent ${index} setup`);
    constituentIds.push(row.id);
  }

  return { suffix, templateId: template.id, constituentIds };
}

async function run() {
  const token = await getAdminToken();
  const seeded = await seedBatchRun(token);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  try {
    await loginViaApi(page, { webBase: WEB_BASE, apiBase: API_BASE });
    await page.goto(`${WEB_BASE}/oyama-letters/generate?templateId=${encodeURIComponent(seeded.templateId)}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    if (page.url().includes("/login")) {
      await loginViaApi(page, { webBase: WEB_BASE, apiBase: API_BASE });
      await page.goto(`${WEB_BASE}/oyama-letters/generate?templateId=${encodeURIComponent(seeded.templateId)}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
    }
    await page.getByText("Select Your Options").waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /next: recipients/i }).first().click();

    await page.getByRole("button", { name: /^Individuals$/i }).click();
    await page.getByPlaceholder("Search recipients...").fill(`Batch${seeded.suffix}`);
    await page.waitForTimeout(500);
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count < 3) throw new Error(`Expected at least 3 selectable recipients, found ${count}.`);
    for (let index = 0; index < 3; index += 1) {
      await checkboxes.nth(index).check();
    }

    await page.getByRole("button", { name: /next: donation context/i }).first().click();
    await page.getByText("No donation information").click();
    await page.getByRole("button", { name: /next: preview/i }).first().click();
    await page.getByRole("heading", { name: "Batch Summary" }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /next: generate/i }).first().click();

    await page.getByRole("button", { name: /^Print Queue$/i }).click();
    const [validateRawResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/letters/generated/batch") && response.request().method() === "POST"),
      page.getByRole("button", { name: /validate batch/i }).first().click(),
    ]);
    const validation = await validateRawResponse.json();
    if ((validation.totalSelected ?? 0) < 3) {
      throw new Error(`Batch validation did not include 3 recipients: ${JSON.stringify(validation)}`);
    }

    await page.getByRole("button", { name: /generate batch/i }).first().waitFor({ timeout: 30000 });
    const [generateRawResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/letters/generated/batch") && response.request().method() === "POST"),
      page.getByRole("button", { name: /generate batch/i }).first().click(),
    ]);
    const generated = await generateRawResponse.json();
    if (!Array.isArray(generated.generatedIds) || generated.generatedIds.length < 3) {
      throw new Error(`Batch generation did not return 3 generated ids: ${JSON.stringify(generated)}`);
    }

    await page.getByText(/Generated/i).first().waitFor({ timeout: 30000 });
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/letters/generated/export-pdf-batch") && response.ok()),
      page.getByRole("button", { name: /view batch pdf/i }).click(),
    ]);
    await page.locator('object[title="Generated PDF"]').waitFor({ timeout: 30000 });
    await page.getByRole("link", { name: /save pdf/i }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /^print$/i }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /^close$/i }).click();

    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/export-pdf") && response.ok()),
      page.getByRole("button", { name: /view individual pdf/i }).click(),
    ]);
    await page.locator('object[title="Generated PDF"]').waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /^close$/i }).click();

    await page.getByRole("link", { name: /open queue/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});
    const queueBody = await page.locator("body").innerText();
    if (!/Needs Review|NEEDS_REVIEW|Print Queue/i.test(queueBody)) {
      throw new Error("Generated letters did not appear to reach the print queue view.");
    }
    await page.getByText(/Queue Controls/i).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /download selected pdfs/i }).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /preview/i }).first().waitFor({ timeout: 30000 });

    console.log("OyamaLetters batch generation E2E checks passed.");
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("OyamaLetters batch generation E2E failed:", error);
  process.exit(1);
});

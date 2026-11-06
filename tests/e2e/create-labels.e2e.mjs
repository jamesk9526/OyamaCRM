/** Synthetic UI checks using the actual Avery PDF renderer. */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import avery from "../../server/src/services/avery-labels.ts";
const evidence = "docs/status/audit-artifacts/2026-11-06-create-labels";
await mkdir(evidence, { recursive: true });
const recipients = ["Jordan", "Alexandra"].map((firstName, i) => ({ id: `test-${i}`, firstName, lastName: "Example", addressLine1: "100 Sample Way", city: "Example City", state: "MO", zip: "65000" }));
const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] });
let renders = 0;
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => console.log("Request failed", request.url(), request.failure()?.errorText));
  let pdf;
  await context.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const json = body => route.fulfill({ json: body });
    if (path === "/api/auth/refresh") return json({ data: { accessToken: "synthetic" } });
    if (path === "/api/auth/me") return json({ data: { id: "test", organizationId: "test-org", firstName: "QA", lastName: "Staff", role: "admin", email: "staff@example.invalid", permissions: ["letters.view", "letters.export_pdf", "view:constituents"] } });
    if (path === "/api/oyama-create/bootstrap") return json({ enabled: true, shellEnabled: true, permissions: ["letters.view", "letters.export_pdf", "view:constituents"], capabilities: [] });
    if (path === "/api/constituents") return json(recipients);
    if (path === "/api/letters/labels/avery-5160.pdf") {
      const input = route.request().postDataJSON();
      pdf = await avery.renderAvery5160Pdf(recipients.filter(row => input.constituentIds.includes(row.id)).map(row => ({ ...row, name: `${row.firstName} ${row.lastName}` })), input);
      renders++;
      return route.fulfill({ contentType: "application/pdf", body: pdf });
    }
    if (path.endsWith("/imports/ensure")) return json({ status: "IDLE" });
    if (path.endsWith("/imports/sources")) return json({ items: [] });
    return json([]);
  });
  await page.goto(`${process.env.CREATE_UI_WEB || "http://localhost:3142"}/oyama-create/labels`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Select all contacts" }).waitFor({ timeout: 90000 }).catch(async error => {
    await page.screenshot({ path: `${evidence}/load-failure.png` });
    console.log(errors, (await page.locator("body").innerText()).slice(0, 1400)); throw error;
  });
  await page.getByRole("button", { name: "Select all contacts" }).click();
  await page.getByLabel("First label position").selectOption("30");
  await page.getByRole("button", { name: "Preview label PDF", exact: true }).click();
  await page.getByText("2 PDF pages · current proof", { exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.letter-pdf-viewer canvas')].some(canvas => canvas.width > 100));
  for (const [width, height] of [[1600,950],[430,790]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${evidence}/labels-${width}.png`, fullPage: true });
  }
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await downloadPromise;
  assert.equal((await readFile(await download.path())).equals(pdf), true);
  assert.equal(renders, 1);
  await page.getByLabel("First label position").selectOption("1");
  assert.equal(await page.getByRole("button", { name: "Print PDF", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Save sheet defaults" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Select all contacts" }).waitFor();
  assert.equal(await page.getByLabel("First label position").inputValue(), "1");
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/labels-start-30.pdf`, pdf);
  await writeFile(`${evidence}/checks.json`, JSON.stringify({ synthetic: true, viewports: [1600,430], renderedSheets: 2, downloadMatchesPreviewBytes: true, stalePrintDisabled: true, renders }, null, 2));
  console.log("Label route, two-sheet PDF rendering, identical download bytes, stale-proof controls and saved settings passed.");
} finally { await browser.close(); }

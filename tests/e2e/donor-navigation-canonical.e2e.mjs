/** Browser-only fixtures; no donor records or configuration are written. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3651";
const evidence = "docs/status/audit-artifacts/2026-10-29-donor-modernization";
const user = { id: "navigation-fixture", firstName: "Taylor", lastName: "Reed", email: "navigation@example.invalid", role: "admin", organizationId: "navigation-fixture", permissions: [] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], checks = [], writes = [];
let fieldsUnavailable = false;
page.on("pageerror", (error) => errors.push(error.message));
await context.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/api/auth/refresh") return route.fulfill({ json: { data: { accessToken: "browser-fixture-only" } } });
  if (path === "/api/auth/me") return route.fulfill({ json: { data: user } });
  if (route.request().method() !== "GET") { writes.push(path); return route.fulfill({ status: 405, json: { error: { message: "Writes disabled" } } }); }
  if (path === "/api/custom-fields") return fieldsUnavailable
    ? route.fulfill({ status: 503, json: { error: { message: "Custom field service unavailable" } } })
    : route.fulfill({ json: { data: [{ id: "fixture-field", entityType: "constituent", name: "Preferred contact window", key: "preferred_contact_window", fieldType: "text", active: true, required: false, sortOrder: 0 }] } });
  if (path === "/api/settings") return route.fulfill({ json: { fiscalYearStart: 7, fiscalYearEnd: 6 } });
  if (path === "/api/notifications/sse") return route.fulfill({ contentType: "text/event-stream", body: "" });
  if (path.includes("notifications")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
  return route.fulfill({ json: {} });
});

try {
  await mkdir(evidence, { recursive: true });
  await page.goto(`${base}/settings/custom-fields`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Custom Fields", exact: true }).waitFor();
  await page.getByRole("cell", { name: /Preferred contact window/ }).waitFor();
  checks.push("Saved custom fields render from the canonical unwrapped API response");
  fieldsUnavailable = true;
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("alert").filter({ hasText: "Custom field service unavailable" }).waitFor();
  assert.equal(await page.getByText("No custom fields yet for this entity type.", { exact: true }).count(), 0);
  fieldsUnavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("cell", { name: /Preferred contact window/ }).waitFor();
  checks.push("Custom field failures show an error and retry restores saved fields");
  const rail = page.getByRole("navigation", { name: "Donor CRM", exact: true });
  assert.equal(await rail.locator('a[href="/settings"]').count(), 1);
  assert.equal(await rail.locator('a[href="/data-tools"]').count(), 1);
  assert.equal(await rail.locator('a[href="/data-tools/import"],a[href="/notifications"],a[href="/custom-fields"]').count(), 0);
  checks.push("Donor rail has canonical Settings and Data Tools entries without duplicated subtools");

  const period = page.getByRole("button", { name: /^Reporting period:/ });
  await period.click();
  await page.getByRole("button", { name: /^Reporting period: FY/ }).waitFor();
  checks.push("Reporting period changes directly in the desktop header");

  const accountButton = page.getByRole("button", { name: "Open profile menu for Taylor Reed" });
  await accountButton.click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  await account.waitFor();
  assert.equal(await account.getByRole("link", { name: "Settings", exact: true }).count(), 1);
  assert.equal(await account.getByRole("link", { name: "Users", exact: true }).count(), 0);
  assert.equal(await account.getByRole("button", { name: /Reporting/ }).count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await account.count(), 0);
  assert.equal(await accountButton.evaluate((element) => document.activeElement === element), true);
  checks.push("Account dialog links to canonical settings and restores keyboard focus on Escape");

  await page.goto(`${base}/custom-fields`, { waitUntil: "networkidle" });
  await page.waitForURL("**/settings/custom-fields");
  await page.getByRole("heading", { name: "Custom Fields", exact: true }).waitFor();
  checks.push("Legacy custom-field bookmarks redirect to the Settings workspace");
  await page.screenshot({ path: `${evidence}/donor-settings-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation menu", exact: true }).click();
  const mobile = page.getByRole("dialog", { name: "Donor CRM navigation", exact: true });
  await mobile.waitFor();
  assert.equal(await mobile.locator('a[href="/settings"]').count(), 1);
  await page.keyboard.press("Escape");
  assert.equal(await mobile.count(), 0);
  const definitions = page.getByRole("region", { name: "Custom field definitions" });
  assert.equal(await definitions.evaluate((element) => element.scrollWidth > element.clientWidth), true);
  await definitions.getByRole("button", { name: "Edit", exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  checks.push("Mobile navigation fits 390px and custom field actions remain reachable in the scrolling table");
  await page.screenshot({ path: `${evidence}/donor-settings-mobile.png`, fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  await writeFile(`${evidence}/navigation-browser-results.json`, JSON.stringify({ checks, errors, writes, fixture: "Synthetic browser responses; no database or provider writes" }, null, 2));
  console.log(JSON.stringify({ checks, errors, writes }, null, 2));
} catch (error) {
  await writeFile(".tmp/donor-navigation-failure.json", JSON.stringify({ url: page.url(), errors, text: await page.locator("body").innerText() }, null, 2));
  throw error;
} finally { await browser.close(); }

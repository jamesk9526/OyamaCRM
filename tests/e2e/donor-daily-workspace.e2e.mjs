/** Read-only QA of the daily Donor workspace against authenticated development data. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { installDonorWorkspaceFixtures } from "./fixtures/donor-daily-workspace.mjs";

const base = process.env.QA_BASE_URL ?? "http://localhost:3000";
const fixtureMode = process.env.QA_FIXTURES === "1";
const interactionsOnly = process.env.QA_INTERACTIONS_ONLY === "1";
const output = path.resolve(`docs/status/audit-artifacts/2026-09-26-donor-daily-workspace${fixtureMode ? "/fixtures" : ""}`);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await context.addInitScript(() => window.addEventListener("error", (event) => console.error("QA runtime error", event.message, event.filename, event.lineno, event.colno)));
const errors = [];
const checks = [];
page.on("pageerror", (error) => { errors.push(`${error.message}\n${error.stack ?? ""}`); console.error(error.message, error.stack); });
page.on("console", (message) => { if (message.text().startsWith("QA runtime error")) console.error(message.text()); });
if (fixtureMode) await installDonorWorkspaceFixtures(page);

async function settled() {
  await page.waitForFunction(() => !/Loading constituents|Loading recent gifts|Loading follow-up|Loading donations/.test(document.querySelector("main")?.innerText ?? ""), undefined, { timeout: 45000 });
}

async function navigate(route) {
  if (new URL(page.url()).pathname === route) return;
  const direct = page.locator(`a[href="${route}"]:visible`).first();
  if (await direct.count()) {
    await direct.click();
  } else if (route.startsWith("/constituents/qa-")) {
    await navigate("/constituents");
    await page.locator(`main a[href="${route}"]:visible`).first().click();
  } else {
    await page.goto(`${base}${route}`, { waitUntil: "load" });
  }
  await page.waitForURL((url) => url.pathname === route);
}

async function capture(id, route, width) {
  console.log(`OPEN ${id} ${width}px`);
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await navigate(route);
  await page.locator("main h1").first().waitFor({ timeout: 45000 });
  await settled();
  const size = await page.evaluate(() => ({
    pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    mainOverflow: document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth,
    headingCount: document.querySelectorAll("main h1").length,
  }));
  assert.equal(size.pageOverflow, false, `${id} at ${width}px overflows the page`);
  assert.equal(size.mainOverflow, false, `${id} at ${width}px overflows the workspace`);
  assert.equal(size.headingCount, 1, `${id} must have one page heading`);
  await page.screenshot({ path: path.join(output, `${id}-${width}.png`) });
  checks.push({ id, width, ...size });
  console.log(`PASS ${id} ${width}px`);
}

try {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(process.env.QA_EMAIL ?? "admin@hopefoundation.org");
  await page.locator('input[type="password"]').fill(process.env.QA_PASSWORD ?? "admin123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 45000 });
  await settled();

  const directoryResponse = page.waitForResponse((response) => response.url().includes("/api/constituents?") && response.status() === 200);
  await page.goto(`${base}/constituents`);
  const payload = await (await directoryResponse).json();
  const rows = payload.data?.items ?? payload.items ?? payload.data ?? payload;
  assert.ok(Array.isArray(rows) && rows.length, "Need constituent records for QA");
  const samples = [
    ["individual", rows.find((row) => row.type !== "HOUSEHOLD" && row.entityKind !== "ORGANIZATION" && !["ORGANIZATION", "FOUNDATION", "SPONSOR"].includes(row.type))],
    ["organization", rows.find((row) => row.entityKind === "ORGANIZATION" || ["ORGANIZATION", "FOUNDATION", "SPONSOR"].includes(row.type))],
    ["household", rows.find((row) => row.type === "HOUSEHOLD")],
  ];
  const routes = [["dashboard", "/"], ["constituents", "/constituents"], ["donations", "/donations"], ...samples.filter(([, row]) => row).map(([kind, row]) => [`profile-${kind}`, `/constituents/${row.id}`])];
  if (!interactionsOnly) {
    for (const width of [390, 768, 1024, 1440]) {
      for (const [id, route] of routes) await capture(id, route, width);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/`);
  await settled();
  await page.getByRole("button", { name: "Find a constituent", exact: true }).click();
  assert.equal(await page.locator('input:focus').count(), 1, "Find constituent must focus global search");
  await page.keyboard.press("Escape");
  await page.getByText("Dashboard options", { exact: true }).click();
  await page.getByRole("button", { name: "Customize dashboard", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  checks.push({ id: "dashboard-search-and-customization", passed: true });

  await page.goto(`${base}/constituents`);
  await settled();
  const main = page.locator("main");
  await main.getByRole("button", { name: "More columns", exact: true }).click();
  await main.getByRole("columnheader", { name: /YTD Giving/ }).waitFor();
  await main.getByRole("button", { name: "Fewer columns", exact: true }).click();
  assert.equal(await main.getByRole("columnheader", { name: /YTD Giving/ }).count(), 0);
  await main.getByRole("button", { name: "Sort this page by Last Gift", exact: true }).click();
  assert.equal(await main.locator('th[aria-sort="ascending"]').count(), 1);
  await main.locator('input[type="checkbox"]:visible').first().check();
  await main.getByText("Selected on this page", { exact: true }).waitFor();
  await main.getByRole("button", { name: "Clear Selection", exact: true }).click();
  await main.getByRole("button", { name: "Lapsed", exact: true }).click();
  await settled();
  await main.getByRole("button", { name: "All", exact: true }).click();
  await settled();
  checks.push({ id: "directory-columns-sorting-selection-quick-views", passed: true });

  for (const [kind, row] of samples.filter(([, row]) => row)) {
    await page.goto(`${base}/constituents/${row.id}`);
    await main.getByRole("button", { name: "Record Gift", exact: true }).first().waitFor();
    for (const panel of ["Timeline", "Files", "Audit"]) {
      await main.locator("summary").filter({ hasText: /^More(?::.*)?$/ }).last().click();
      await main.getByRole("button", { name: panel, exact: true }).click();
      await main.getByText(`More: ${panel}`, { exact: true }).waitFor();
    }
    await main.getByRole("button", { name: "Overview", exact: true }).click();
    await main.getByRole("button", { name: "Record Gift", exact: true }).first().click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    if (kind === "household") assert.ok(await main.getByRole("button", { name: /^Members/ }).isVisible());
    checks.push({ id: `profile-${kind}-secondary-panels-and-gift-entry`, passed: true });
  }

  if (fixtureMode) {
    await page.goto(`${base}/constituents/qa-restricted`);
    await main.getByText("Communication Restricted", { exact: true }).waitFor();
    assert.equal(await main.getByRole("link", { name: "Draft Email", exact: true }).count(), 0);
    assert.ok(await main.getByRole("button", { name: /Email is blocked by this constituent/ }).isDisabled());
    checks.push({ id: "restricted-profile-communication-guard", passed: true });
  }

  await page.goto(`${base}/donations?acknowledgment=pending`);
  await settled();
  await main.getByText("Acknowledgment queue:", { exact: true }).waitFor();
  await main.getByRole("link", { name: "Record Gift", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.ok(page.url().includes("acknowledgment=pending"), "Closing gift modal must retain queue context");
  await page.goto(`${base}/donations/new`);
  await page.getByRole("dialog").waitFor();
  assert.ok(page.url().includes("recordGift=1"), "Legacy gift route must retain redirect");
  await page.keyboard.press("Escape");
  checks.push({ id: "donations-acknowledgment-modal-and-legacy-route", passed: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/constituents`);
  const trigger = page.getByRole("button", { name: "Open navigation menu", exact: true });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Donor CRM navigation" });
  await drawer.waitFor();
  await drawer.getByRole("button", { name: "Close navigation" }).evaluate((node) => new Promise((resolve) => {
    if (node === document.activeElement) return resolve();
    const timer = setInterval(() => { if (node === document.activeElement) { clearInterval(timer); resolve(); } }, 20);
    setTimeout(() => { clearInterval(timer); resolve(); }, 1000);
  }));
  for (let index = 0; index < 25; index++) {
    await page.keyboard.press("Tab");
    const focusState = await drawer.evaluate((node) => ({ inside: node.contains(document.activeElement), active: document.activeElement?.outerHTML.slice(0, 180) }));
    assert.ok(focusState.inside, `Mobile focus must stay in drawer after Tab ${index + 1}: ${focusState.active}`);
  }
  await page.keyboard.press("Escape");
  assert.ok(await trigger.evaluate((node) => node === document.activeElement), "Escape must restore mobile trigger focus");
  await trigger.click();
  await drawer.getByRole("link", { name: "Donations", exact: true }).click();
  await drawer.waitFor({ state: "hidden" });
  checks.push({ id: "mobile-navigation-focus-and-route-dismissal", passed: true });

  // Controlled read-response failures distinguish unavailable data from true empty results.
  await page.route("**/api/constituents?**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "QA temporary outage" } }) }));
  await page.goto(`${base}/constituents`);
  await main.getByRole("button", { name: "Retry", exact: true }).waitFor();
  assert.equal(await main.getByText("No constituents yet", { exact: true }).count(), 0);
  await page.unroute("**/api/constituents?**");
  await main.getByRole("button", { name: "Retry", exact: true }).click();
  await main.getByRole("combobox", { name: "Sort this page" }).waitFor();
  await main.getByLabel("Search constituents", { exact: true }).fill("zz-no-matching-constituent-qa");
  await main.getByText("No matching constituents", { exact: true }).waitFor();
  checks.push({ id: "directory-error-retry-and-empty-search", passed: true });

  if (fixtureMode) {
    const staleRoute = async (route) => {
      const query = new URL(route.request().url()).searchParams.get("search");
      if (query !== "QA Individual" && query !== "QA Foundation") return route.fallback();
      if (query === "QA Individual") await new Promise((resolve) => setTimeout(resolve, 850));
      const items = rows.filter((row) => `${row.firstName} ${row.lastName} ${row.organizationName ?? ""}`.includes(query));
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ items, page: 1, pageSize: 100, total: items.length, totalPages: 1 }) });
    };
    await page.route("**/api/constituents?**", staleRoute);
    const oldRequest = page.waitForRequest((request) => request.url().includes("/api/constituents?") && new URL(request.url()).searchParams.get("search") === "QA Individual");
    await main.getByLabel("Search constituents", { exact: true }).fill("QA Individual");
    await oldRequest;
    const newResponse = page.waitForResponse((response) => response.url().includes("/api/constituents?") && new URL(response.url()).searchParams.get("search") === "QA Foundation");
    await main.getByLabel("Search constituents", { exact: true }).fill("QA Foundation");
    await newResponse;
    await page.waitForTimeout(950);
    assert.ok(await main.getByRole("link", { name: "QA Foundation", exact: true }).isVisible());
    assert.equal(await main.getByRole("link", { name: "QA Individual", exact: true }).count(), 0);
    await page.unroute("**/api/constituents?**", staleRoute);
    checks.push({ id: "directory-stale-search-response-protection", passed: true });
  }

  assert.deepEqual(errors, [], "Browser must not report runtime errors");
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ fixtureMode, checks, errors, missingSamples: samples.filter(([, row]) => !row).map(([kind]) => kind) }, null, 2));
  console.log(`PASS ${checks.length} checks; no runtime errors`);
} catch (error) {
  await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ fixtureMode, checks, errors, failure: error.message }, null, 2));
  throw error;
} finally {
  await browser.close();
}

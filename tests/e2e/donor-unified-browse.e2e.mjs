/** Synthetic browser fixtures verify donor workflows without writing records or sending communications. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { installDonorWorkspaceFixtures } from "./fixtures/donor-daily-workspace.mjs";

const base = process.env.QA_BASE_URL || "http://localhost:4780";
const evidence = "docs/status/audit-artifacts/2026-10-30-donor-unification";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1040 } });
const page = await context.newPage(); const checks = []; const errors = []; const requests = []; const writes = [];
page.on("pageerror", (error) => errors.push(error.message));
await installDonorWorkspaceFixtures(page);
const user = { id: "unified-admin", organizationId: "unified-org", firstName: "Taylor", lastName: "Reed", role: "admin", email: "ui@example.invalid" };
const person = { id: "qa-outside", firstName: "Avery", lastName: "Morgan", email: "avery@example.invalid", phone: "555-0110", type: "DONOR", donorStatus: "ACTIVE", totalLifetimeGiving: "500", totalYtdGiving: "100", lastGiftDate: "2026-10-01", lastGiftAmount: "100", engagementScore: 50, giftCount: 5, tags: [] };
const gift = { id: "unified-gift", amount: "100.01", date: "2026-10-01", status: "COMPLETED", paymentMethod: "CHECK", isRecurring: false, acknowledgmentSentAt: null, constituent: person, designation: { id: "fund-1", name: "General support" } };
let unavailable = false;
await page.route("**/api/**", async (route) => {
  const req = route.request(); const url = new URL(req.url()); requests.push(`${req.method()} ${url.pathname}${url.search}`);
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (url.pathname === "/api/auth/refresh") return json({ data: { accessToken: "synthetic-token" } });
  if (url.pathname === "/api/auth/me") return json({ data: user });
  if (req.method() !== "GET") { writes.push(`${req.method()} ${url.pathname}`); return json({ error: { message: "No business writes in this UI audit" } }, 405); }
  if (url.pathname === "/api/constituents" && url.searchParams.has("page")) return json({ items: [person], total: 151, totalPages: Math.ceil(151 / Number(url.searchParams.get("pageSize") || 50)), summary: { total: 151, active: 100, lapsed: 40, prospects: 11 } });
  if (url.pathname === `/api/constituents/${person.id}`) return json(person);
  if (url.pathname === "/api/donations/stats") return unavailable ? json({ error: { message: "Gift totals unavailable" } }, 503) : json({ totalRaised: 100.01, totalGifts: 3, completed: 3, recurring: 1, averageGift: 33.34, pendingAcknowledgments: 2 });
  if (url.pathname === "/api/donations") return unavailable ? json({ error: { message: "Gifts unavailable" } }, 503) : json({ items: [gift], total: url.searchParams.has("constituentId") ? 1 : 125 });
  if (url.pathname === "/api/reports/summary") return json({ totalConstituents: 151, activeDonors: 100, ytdAmount: 100.01, ytdCount: 3, ytdAverageGift: 33.34, previousPeriodAmount: 80, revenueChangePercent: 25, weekAmount: 100, monthAmount: 100, monthCount: 3, pendingTasks: 5, overdueTasks: 2, newDonorsThisMonth: 1, activeCampaigns: 0, activeGoalTotal: 0, period: { basis: "calendar", year: 2026, label: "2026 YTD", from: "2026-01-01T00:00:00Z", through: "2026-10-30T12:00:00Z" } });
  if (url.pathname === "/api/reports/giving-trend") return json({ points: [{ month: "2026-10", label: "Oct", amount: 100.01, giftCount: 3, previousAmount: 80 }], total: 100.01, giftCount: 3 });
  return route.fallback();
});
async function go(path) { await page.goto(`${base}${path}`, { waitUntil: "networkidle" }); }
async function noOverflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Page overflows viewport"); }
try {
  await go("/constituents?search=Avery&type=DONOR&page=2&pageSize=50");
  await page.getByRole("heading", { name: "Constituents", exact: true }).waitFor();
  await page.getByRole("link", { name: "Avery Morgan", exact: true }).last().waitFor();
  assert.equal(await page.getByRole("searchbox", { name: "Search constituents", exact: true }).inputValue(), "Avery");
  await page.getByText("151", { exact: true }).waitFor();
  assert.ok(requests.some((url) => url.includes("page=2&pageSize=50")));
  await noOverflow(); await page.screenshot({ path: `${evidence}/constituents-1440.png`, fullPage: true });
  checks.push("Constituent search, type, page, and page size survive URL handoff; full filtered summaries display");
  await page.getByRole("button", { name: "Lapsed", exact: true }).click();
  await page.waitForURL(/status=LAPSED/); assert.equal(new URL(page.url()).searchParams.get("search"), "Avery");
  assert.equal(new URL(page.url()).searchParams.has("page"), false);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("button", { name: "Lapsed", exact: true }).getAttribute("aria-pressed"), "true");
  checks.push("Quick views preserve search, reset pagination, and survive reload");
  await page.getByRole("button", { name: "Actions for Avery Morgan", exact: true }).last().click();
  const personActions = page.getByRole("group", { name: "Actions for Avery Morgan", exact: true });
  await personActions.getByRole("link", { name: "Edit constituent", exact: true }).waitFor();
  await personActions.getByRole("link", { name: "View giving history", exact: true }).click();
  await page.waitForURL(/constituentId=qa-outside/);
  await page.getByText("Gift totals and actions below apply to this supporter.").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("allYears"), "1");
  assert.ok(requests.some((url) => url.includes("/api/donations?") && url.includes("constituentId=qa-outside")));
  await page.getByText("$33.34", { exact: true }).waitFor();
  checks.push("Supporter actions open the scoped giving ledger and show the completed-gift average");
  await page.getByRole("link", { name: "Record Gift", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Record Gift", exact: true });
  await dialog.getByLabel("Constituent *", { exact: true }).waitFor();
  assert.equal(await dialog.getByLabel("Constituent *", { exact: true }).inputValue(), "Avery Morgan");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  checks.push("Record gift retains the selected supporter even outside the first 40 form options");
  await Promise.all([page.waitForResponse((response) => response.url().includes("/api/donations/stats?") && response.url().includes("acknowledgment=pending")), page.getByRole("button", { name: "Needs thanks", exact: true }).click()]);
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Refresh donations"]')?.disabled);
  assert.equal(new URL(page.url()).searchParams.get("constituentId"), person.id);
  assert.equal(await page.getByRole("button", { name: "Mark date range thanked", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Actions for gift from Avery Morgan", exact: true }).last().click();
  const actions = page.getByRole("group", { name: "Actions for gift from Avery Morgan", exact: true });
  for (const name of ["Mark thanked", "Create email draft", "Email from template", "Set up follow-up task", "Start stewardship path", "Complete stewardship loop", "Delete gift"]) await actions.getByRole("button", { name, exact: true }).waitFor();
  assert.equal(await actions.getByRole("link", { name: "Edit gift", exact: true }).count(), 1);
  const bounds = await actions.boundingBox(); assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 1440);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Actions for gift from Avery Morgan", exact: true }).last().getAttribute("aria-expanded"), "false");
  checks.push("Gift action menu preserves all advanced features and escapes table clipping; range acknowledgment cannot broaden supporter scope");
  await noOverflow(); await page.screenshot({ path: `${evidence}/donations-1440.png`, fullPage: true });

  await go("/"); await page.getByRole("heading", { name: /Taylor/ }).waitFor();
  await page.getByRole("heading", { name: "Revenue momentum" }).waitFor();
  await page.screenshot({ path: `${evidence}/dashboard-1440.png`, fullPage: true });
  assert.equal(await page.getByRole("heading", { name: "Recent gifts", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Supporter relationships", exact: true }).click();
  await page.getByRole("heading", { name: "Recent gifts", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Donor retention", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Revenue momentum" }).count(), 0);
  await page.getByRole("link", { name: /Completed gifts.*Open matching records/ }).click();
  await page.waitForURL(/status=COMPLETED/); assert.equal(new URL(page.url()).searchParams.get("from"), "2026-01-01"); assert.equal(new URL(page.url()).searchParams.get("to"), "2026-10-30");
  checks.push("Dashboard focus reveals relationships progressively; metric drilldown preserves exact reporting dates");

  unavailable = true; await page.getByRole("button", { name: "Refresh donations", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Could not load donations" }).waitFor();
  assert.equal(await page.getByText("No donations found.", { exact: true }).count(), 0);
  unavailable = false; await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("link", { name: "Avery Morgan", exact: true }).last().waitFor();
  checks.push("Ledger failures are explicit and retry restores matching records");
  await page.getByText("Refine filters", { exact: false }).first().click();
  await page.getByLabel("From date", { exact: true }).fill("2026-12-31");
  await page.getByRole("alert").filter({ hasText: "Start date must be on or before end date" }).first().waitFor();
  checks.push("Invalid date ranges show a recoverable error instead of fetching misleading results");

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, name] of [["/constituents", "constituents"], ["/donations", "donations"], ["/", "dashboard"]]) {
    await go(path); await noOverflow(); await page.screenshot({ path: `${evidence}/${name}-390.png`, fullPage: true });
    if (name === "donations") { await page.getByRole("button", { name: "Actions for gift from Avery Morgan", exact: true }).first().click(); const rect = await page.getByRole("group", { name: "Actions for gift from Avery Morgan" }).boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= 390); await page.keyboard.press("Escape"); }
  }
  checks.push("Dashboard, Constituents, Donations, and record actions fit the 390px viewport");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await writeFile(`${evidence}/browser-results.json`, JSON.stringify({ checks, errors, writes, fixture: "Synthetic browser responses only; no business writes or outbound communications" }, null, 2));
  console.log(JSON.stringify({ checks, errors, writes }, null, 2));
} catch (error) { console.error(JSON.stringify({ url: page.url(), body: (await page.locator("body").innerText()).slice(0, 7000), errors, requests: requests.slice(-15) }, null, 2)); await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true }); throw error; }
finally { await browser.close(); }

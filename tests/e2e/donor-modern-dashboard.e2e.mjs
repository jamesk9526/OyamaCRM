/** Synthetic browser responses prove visual states without accessing or writing donor records. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { installDonorWorkspaceFixtures } from "./fixtures/donor-daily-workspace.mjs";

const base = process.env.QA_BASE_URL || "http://localhost:3652";
const evidence = "docs/status/audit-artifacts/2026-10-29-donor-modernization";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const checks = []; const errors = []; const writes = [];
const user = { id: "qa-modern-donor", firstName: "Taylor", lastName: "Reed", role: "admin", email: "qa@example.invalid", organizationId: "qa-modern-org" };
const summary = { totalConstituents: 1248, activeDonors: 318, ytdAmount: 126400, ytdCount: 640, ytdAverageGift: 197.5, ytdAveragePerDonor: 397.48, previousPeriodAmount: 109400, previousPeriodCount: 600, revenueChangePercent: 15.54, ytdGrantAmount: 0, weekAmount: 3200, weekCount: 18, weekAvg: 177.78, monthAmount: 16400, monthCount: 80, pendingTasks: 12, overdueTasks: 3, newDonorsThisMonth: 8, activeCampaigns: 1, activeGoalTotal: 200000, period: { basis: "calendar", year: 2026, label: "2026 YTD" } };
const trend = { points: [12000, 14000, 16000, 18000, 20000, 24000, 22400].map((amount, i) => ({ label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"][i], month: `2026-${String(i + 1).padStart(2, "0")}`, amount, giftCount: 90, previousAmount: amount * .86, isPartial: i === 6 })), total: 126400, comparisonTotal: 109400, giftCount: 640, trendPercent: 15.54 };
await context.route("**/api/**", (route) => {
  const request = route.request(); const path = new URL(request.url()).pathname;
  if (path === "/api/auth/refresh") return route.fulfill({ json: { data: { accessToken: "synthetic-browser-token" } } });
  if (path === "/api/auth/me") return route.fulfill({ json: { data: user } });
  if (path === "/api/steward-ai/tools/execute" && request.postDataJSON()?.tool === "donor.getRecurringGivingHealth") return route.fulfill({ json: { result: { activeRecurringDonors: 0, recurringRevenueLast30Days: 0, upcomingCount: 0, missedCount: 0 } } });
  if (request.method() !== "GET") { writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 405, json: { error: { message: "Business writes disabled in audit" } } }); }
  if (path === "/api/notifications/sse") return route.fulfill({ contentType: "text/event-stream", body: "" });
  return route.fulfill({ json: { items: [], unreadCount: 0 } });
});
await installDonorWorkspaceFixtures(page);
await page.route("**/api/reports/summary*", (route) => route.fulfill({ json: summary }));
await page.route("**/api/reports/giving-trend*", (route) => route.fulfill({ json: trend }));
await page.route("**/api/reports/donor-retention*", (route) => route.fulfill({ json: { retained: 238, total: 340, rate: 70 } }));
await page.route("**/api/reports/designations-summary*", (route) => route.fulfill({ json: { slices: [52000, 32000, 18000, 12000, 8400, 4000].map((amount, i) => ({ name: ["General support", "Education", "Outreach", "Family support", "Facilities", "Special projects"][i], amount })), total: 126400 } }));
page.on("pageerror", (error) => errors.push(error.message));

async function home() {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Revenue momentum", exact: true }).waitFor();
  await page.getByText("+15.5% vs. same elapsed prior year", { exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Giving performance charts"] [aria-busy="true"]'));
}
try {
  await mkdir(evidence, { recursive: true });
  await home();
  assert.ok((await page.getByText("Average gift", { exact: true }).locator("..").innerText()).includes("$197.50"));
  await page.getByText("Other funds", { exact: true }).waitFor();
  await page.getByText("View monthly values", { exact: true }).click();
  await page.getByRole("columnheader", { name: "Prior year", exact: true }).waitFor();
  assert.equal(await page.getByRole("rowheader").count(), 7);
  checks.push("Primary revenue chart exposes all seven monthly values and matching prior-year comparison; average gift is $197.50");
  await page.getByText("View monthly values", { exact: true }).click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1050 });
    await page.locator("main h1").scrollIntoViewIfNeeded();
    assert.equal(await page.locator("main h1").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}`);
    await page.screenshot({ path: `${evidence}/modern-dashboard-${width}.png`, fullPage: true });
    checks.push(`Donor dashboard renders at ${width}px with one page title and no horizontal overflow`);
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("button", { name: "Customize dashboard", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("checkbox", { name: "Lock layout after applying changes", exact: true }).waitFor();
  await page.getByRole("button", { name: "Restore default widget layout", exact: true }).click();
  await page.getByRole("button", { name: "Apply and arrange on dashboard", exact: true }).click();
  await page.getByText("Drag a widget by its header", { exact: false }).waitFor();
  checks.push("One customization dialog owns layout lock, restore, smart layout and direct widget arrangement");
  await page.getByRole("button", { name: "Hide details", exact: false }).click();
  const outage = (route) => route.fulfill({ status: 503, json: { error: { message: "Synthetic trend outage" } } });
  await page.route("**/api/reports/giving-trend*", outage);
  await home();
  await page.getByText("Giving trend unavailable.", { exact: false }).waitFor();
  await page.getByText("Other funds", { exact: true }).waitFor();
  await page.getByText("QA Individual", { exact: true }).waitFor();
  checks.push("A failed trend stays visibly unavailable while fund chart, recent gifts and action queues remain usable");
  await page.unroute("**/api/reports/giving-trend*", outage);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("View monthly values", { exact: true }).waitFor();
  checks.push("Retry recovers a failed chart without navigating away");
  const signedOut = await browser.newContext();
  await signedOut.route("**/api/**", (route) => new URL(route.request().url()).pathname === "/api/auth/refresh" ? route.fulfill({ status: 204 }) : route.fulfill({ status: 401, json: { error: { message: "Sign in required" } } }));
  const signedOutPage = await signedOut.newPage();
  await signedOutPage.goto(`${base}/notifications`, { waitUntil: "domcontentloaded" });
  await signedOutPage.waitForURL((url) => url.pathname === "/login");
  await signedOut.close();
  checks.push("Signed-out notification navigation remains inside donor authentication, not public-event routing");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await writeFile(`${evidence}/dashboard-browser-results.json`, JSON.stringify({ fixture: "Synthetic browser responses only; no stored donor records or business writes", checks, errors, writes }, null, 2));
  console.log(`Donor modernization: ${checks.length} dashboard browser checks passed.`);
} catch (error) {
  await page.screenshot({ path: `${evidence}/dashboard-failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${evidence}/dashboard-failure.json`, JSON.stringify({ checks, errors, error: error.message }, null, 2));
  throw error;
} finally { await browser.close(); }

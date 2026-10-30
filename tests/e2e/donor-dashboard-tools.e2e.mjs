/** Browser-only synthetic responses verify donor actions without contacting or changing donor records. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { installDonorWorkspaceFixtures } from "./fixtures/donor-daily-workspace.mjs";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3651";
const evidence = process.env.QA_EVIDENCE_DIR || "docs/status/audit-artifacts/2026-10-29-donor-dashboard";
const user = { id: "qa-donor-admin", firstName: "Taylor", lastName: "Reed", email: "qa@example.invalid", role: "admin", organizationId: "qa-donor-org" };
const campaign = { id: "qa-campaign", name: "QA Community Fund", goal: "1000.00", totalRaised: "250.00", active: true, category: "ANNUAL_FUND", startDate: "2026-01-01", donations: [], _count: { donations: 1, pledges: 0 } };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const checks = []; const errors = []; const writes = []; const requests = [];
page.on("pageerror", (error) => errors.push(error.message));
await context.route("**/api/**", async (route) => {
  const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
  requests.push(`${path}${url.search}`);
  if (path === "/api/auth/refresh") return route.fulfill({ json: { data: { accessToken: "synthetic-browser-fixture" } } });
  if (path === "/api/auth/me") return route.fulfill({ json: { data: user } });
  if (request.method() !== "GET") { writes.push({ path, method: request.method() }); return route.fulfill({ status: 405, json: { error: { message: "Writes disabled in this browser audit" } } }); }
  if (path.startsWith("/api/reports/library/")) return route.fulfill({ json: { report: path.split("/").pop(), title: `QA ${path.split("/").pop()}`, description: "Browser fixture", period: null, columns: [{ key: "name", label: "Donor" }], rows: [], summary: [], notices: [], generatedAt: "2026-10-29T12:00:00Z" } });
  if (path === "/api/campaigns/qa-campaign") return route.fulfill({ json: campaign });
  if (path === "/api/tasks") return route.fulfill({ json: { items: [], total: 0 } });
  if (path === "/api/donor-research/providers") return route.fulfill({ json: { providers: [] } });
  if (path === "/api/users") return route.fulfill({ json: [] });
  if (path === "/api/notifications/sse") return route.fulfill({ contentType: "text/event-stream", body: "" });
  return route.fulfill({ json: { items: [], unreadCount: 0 } });
});
await installDonorWorkspaceFixtures(page);
await page.route("**/api/campaigns?**", (route) => route.fulfill({ json: [campaign] }));
await page.route("**/api/reports/summary*", (route) => route.fulfill({ json: { totalConstituents: 4, activeDonors: 3, ytdAmount: 250, monthAmount: 250, overdueTasks: 2, pendingTasks: 2, newDonorsThisMonth: 1, activeCampaigns: 1, activeGoalTotal: 1000, period: { basis: "fiscal", year: 2027, label: "FY2027" } } }));

async function dashboard() {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Make the next connection" }).waitFor();
  await page.getByRole("button", { name: "Supporter relationships", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-labelledby="donor-action-center-title"] [aria-busy="true"]'));
}
try {
  await mkdir(evidence, { recursive: true });
  await dashboard();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.locator("main h1").scrollIntoViewIfNeeded();
    assert.equal(await page.locator("main h1").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `Dashboard overflows at ${width}px`);
    await page.screenshot({ path: `${evidence}/dashboard-${width}.png`, fullPage: true });
    await page.getByRole("heading", { name: "Donor toolkit", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/toolkit-${width}.png`, fullPage: true });
    checks.push(`Dashboard at ${width}px has one heading and no horizontal overflow`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Search CRM", exact: true }).click();
  assert.equal(await page.locator("input:focus").count(), 1); await page.keyboard.press("Escape");
  checks.push("Find constituent focuses working global search");
  await page.locator("main").getByRole("link", { name: "Record gift", exact: true }).click();
  await page.getByRole("dialog").waitFor(); await page.keyboard.press("Escape");
  checks.push("Record gift opens the real gift-entry modal without saving");
  await dashboard();
  await page.getByRole("button", { name: "Customize dashboard", exact: true }).click();
  await page.getByRole("dialog").waitFor(); await page.keyboard.press("Escape");
  checks.push("Dashboard customization remains available");

  await dashboard();
  await page.getByRole("link", { name: /Thank your donors/ }).click();
  await page.getByText("Acknowledgment queue:", { exact: true }).waitFor();
  assert.ok(new URL(page.url()).searchParams.get("acknowledgment") === "pending");
  checks.push("Acknowledgment priority opens pending-gift queue");

  await dashboard(); requests.length = 0;
  await page.getByRole("link", { name: /Welcome first-time donors/ }).click();
  await page.getByRole("heading", { name: "First Time Donors", exact: true }).waitFor();
  await page.waitForURL((url) => url.searchParams.has("from"));
  const welcomeRequest = requests.find((path) => path.startsWith("/api/reports/library/first-time-donors?"));
  assert.ok(welcomeRequest); const welcome = new URL(welcomeRequest, base);
  const now = new Date();
  assert.equal(welcome.searchParams.get("from"), `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  checks.push("Welcome priority runs the first-gift report for the current month");

  await dashboard(); requests.length = 0;
  await page.getByRole("link", { name: /Renew relationships/ }).click();
  await page.getByRole("heading", { name: "Lapsed Donors (SYBUNTY)", exact: true }).waitFor();
  await page.waitForURL((url) => url.searchParams.get("year") === "2027");
  const renewal = requests.find((path) => path.startsWith("/api/reports/library/lapsed-donors?"));
  assert.ok(renewal?.includes("dateBasis=fiscal") && renewal.includes("year=2027"));
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(new URL(page.url()).searchParams.get("year") === "2027");
  checks.push("Renewal report retains fiscal reporting year across reload");

  await dashboard(); requests.length = 0;
  await page.getByRole("link", { name: /Keep follow-ups moving/ }).click();
  await page.getByRole("button", { name: "Clear overdue task filter" }).waitFor();
  assert.ok(requests.some((path) => path.startsWith("/api/tasks?") && path.includes("queue=overdue") && path.includes("scope=all")));
  checks.push("Overdue priority uses the administrator team overdue queue");

  for (const [name, heading] of [["Recurring giving", "Recurring Giving"], ["Annual statements", "Annual Donation Statements"]]) {
    await dashboard(); await page.locator("main").getByRole("link", { name: new RegExp(name) }).click();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    checks.push(`${name} toolkit action opens its reporting tool`);
  }
  for (const [name, heading] of [["Donor research", "OYAMADonorPROFILE"], ["Data quality", "Data Quality"]]) {
    await dashboard(); await page.locator("main").getByRole("link", { name: new RegExp(name) }).click();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    checks.push(`${name} toolkit action opens its workspace`);
  }
  await dashboard();
  await page.getByRole("link", { name: "QA Community Fund", exact: true }).click();
  await page.getByRole("heading", { name: "QA Community Fund", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("scope"), "ALL_YEARS");
  checks.push("Campaign progress opens its campaign workspace");

  await dashboard();
  await page.locator("summary").filter({ hasText: "Steward recommendations" }).click();
  await page.getByRole("region", { name: "Steward recommendations", exact: true }).waitFor();
  await page.getByRole("link", { name: "Open Segment", exact: false }).click();
  await page.getByRole("heading", { name: "First Time Donors", exact: true }).waitFor();
  await page.waitForURL((url) => url.searchParams.has("from"));
  checks.push("Detailed Steward recommendations have working scoped actions");

  const outage = (route) => new URL(route.request().url()).searchParams.get("acknowledgment") === "pending" ? route.fulfill({ status: 503, json: { error: { message: "QA temporary acknowledgment outage" } } }) : route.fallback();
  await page.route("**/api/donations?**", outage);
  await dashboard();
  const acknowledgment = page.getByRole("link", { name: /Thank your donors/ });
  await acknowledgment.getByText("This queue could not be loaded.", { exact: false }).waitFor();
  await page.getByText("QA Individual", { exact: true }).waitFor();
  assert.ok(await page.getByRole("link", { name: /Welcome first-time donors/ }).isVisible());
  await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
  checks.push("Failed acknowledgment data stays unavailable while gifts and other tools remain usable");
  await page.unroute("**/api/donations?**", outage);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-labelledby="donor-action-center-title"] [aria-busy="true"]'));
  assert.equal(await acknowledgment.getByText("This queue could not be loaded.", { exact: false }).count(), 0);
  checks.push("Dashboard retry recovers the failed acknowledgment queue");
  assert.deepEqual(writes, [], "Audit must perform no business writes");
  assert.deepEqual(errors, [], "No browser runtime errors");
  await writeFile(`${evidence}/browser-results.json`, JSON.stringify({ fixture: "Explicit browser-only synthetic API responses; no stored donor data or writes.", checks, runtimeErrors: errors, businessWrites: writes }, null, 2));
  console.log(`Donor dashboard: ${checks.length} browser checks passed.`);
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${evidence}/browser-failure.json`, JSON.stringify({ checks, error: error.message, runtimeErrors: errors }, null, 2));
  throw error;
} finally { await browser.close(); }

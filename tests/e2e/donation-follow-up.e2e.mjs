/** Stateful UI fixtures prove gift success and task retries stay independent. No real writes. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { installDonorWorkspaceFixtures } from "./fixtures/donor-daily-workspace.mjs";
const base = process.env.QA_BASE_URL || "http://localhost:4781";
const evidence = "docs/status/audit-artifacts/2026-10-30-donation-follow-up";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, timezoneId: "America/Chicago" });
const page = await context.newPage(); const checks = []; const errors = []; let gifts = 0; const tasks = [];
page.on("pageerror", (error) => errors.push(error.message));
await installDonorWorkspaceFixtures(page);
const person = { id: "qa-person", firstName: "QA", lastName: "Individual", email: "qa@example.test" };
const savedGift = { id: "new-gift", amount: "125.00", date: "2026-10-30", constituent: person };
await page.route("**/api/**", async (route) => {
  const req = route.request(); const path = new URL(req.url()).pathname;
  const json = (body, status = 200) => route.fulfill({ json: body, status });
  if (path === "/api/auth/refresh") return json({ data: { accessToken: "fixture-token" } });
  if (path === "/api/auth/me") return json({ data: { ...person, id: "operator", role: "admin", organizationId: "fixture-org" } });
  if (path === "/api/tasks/assignees") return json({ items: [{ id: "operator", firstName: "QA", lastName: "Operator" }, { id: "staff-other", firstName: "Morgan", lastName: "Lee" }] });
  if (path === "/api/tasks/templates") return json([]);
  if (path === "/api/donations" && req.method() === "POST") { gifts++; return json(savedGift, 201); }
  if (path === "/api/donations/new-gift") return json(savedGift);
  if (path === "/api/donations/new-gift/follow-up" && req.method() === "POST") {
    tasks.push(req.postDataJSON());
    if (tasks.length === 1) return json({ error: { message: "Task save failed. Your donation is still saved." } }, 503);
    return json({ id: "followup-new", ...req.postDataJSON(), sourceType: "donation-follow-up", sourceId: "new-gift" }, 201);
  }
  if (req.method() !== "GET") return json({ error: { message: "Unexpected write in fixture" } }, 405);
  return route.fallback();
});
try {
  await page.goto(`${base}/donations?recordGift=1&constituentId=qa-person`, { waitUntil: "networkidle" });
  const entry = page.getByRole("dialog", { name: "Record Gift", exact: true });
  await entry.getByLabel("Amount ($) *", { exact: true }).fill("125");
  await entry.getByRole("button", { name: "Record gift", exact: true }).click();
  await page.getByRole("heading", { name: "Gift recorded", exact: true }).waitFor();
  assert.equal(gifts, 1); assert.equal(tasks.length, 0);
  checks.push("Saving a gift shows an optional follow-up step and creates no task automatically");
  await page.getByRole("button", { name: "Set up follow-up task", exact: true }).click();
  const task = page.getByRole("dialog", { name: "Set up donation follow-up", exact: true });
  await task.getByLabel("Task title", { exact: true }).fill("Call about the October gift");
  await task.getByLabel("Assigned to", { exact: true }).selectOption("staff-other");
  await task.getByLabel("Due date", { exact: true }).fill("2026-11-02");
  await task.getByLabel("In-app reminder", { exact: true }).fill("2026-11-02T09:00");
  assert.equal(await task.getByText("This task stays linked to this donor and this specific donation.").count(), 1);
  assert.equal(await task.getByLabel("Linked constituent", { exact: true }).count(), 0);
  await page.screenshot({ path: `${evidence}/follow-up-desktop.png`, fullPage: true });
  await task.getByRole("button", { name: "Create Task", exact: true }).click();
  await task.getByRole("alert").filter({ hasText: "Task save failed" }).waitFor();
  assert.equal(gifts, 1);
  assert.equal(await task.getByLabel("Task title", { exact: true }).inputValue(), "Call about the October gift");
  await task.getByRole("button", { name: "Create Task", exact: true }).click();
  await page.getByRole("heading", { name: "Follow-up task created", exact: true }).waitFor();
  assert.equal(gifts, 1); assert.equal(tasks.length, 2); assert.equal(tasks[0].requestId, tasks[1].requestId);
  assert.equal(tasks[1].constituentId, "qa-person"); assert.equal(tasks[1].assigneeId, "staff-other");
  assert.equal(tasks[1].reminderAt, "2026-11-02T15:00:00.000Z");
  assert.ok((await page.getByRole("link", { name: "Open follow-up task", exact: true }).getAttribute("href")).includes("taskId=followup-new"));
  checks.push("Follow-up title, assignment, local due date, and reminder are submitted against the saved gift");
  checks.push("Failed task save preserves the form and retries the same request ID without creating another donation");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${evidence}/follow-up-success-mobile.png`, fullPage: true });
  checks.push("Success links to the exact task and remains contained at 390px");
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/browser-results.json`, JSON.stringify({ checks, errors, giftRequests: gifts, taskAttempts: tasks.length, fixture: "Synthetic API responses; no database writes or outbound notifications" }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) { console.error((await page.locator("body").innerText()).slice(0, 5000)); throw error; }
finally { await browser.close(); }

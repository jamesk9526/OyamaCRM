/** Stateful browser fixtures: no stored donor data, outbound messages, or real writes. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.QA_BASE_URL || "http://localhost:4780";
const evidence = process.env.QA_EVIDENCE_DIR || "docs/status/audit-artifacts/2026-10-30-task-notifications";
const browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage();
const errors = [], checks = [], mutations = [];
const account = { id: "notice-fixture-user", firstName: "Taylor", lastName: "Reed", email: "qa@example.invalid", role: "admin", organizationId: "notice-fixture-org", permissions: ["view:tasks", "edit:tasks"] };
const now = new Date(); const row = (id, extra = {}) => ({ id, type: "task-assigned", title: `Task ${id}`, message: `Review assigned work ${id}`, href: `/tasks?taskId=${id}`, createdAt: now.toISOString(), priority: "high", status: "unread", module: "donor", actionLabel: "Open task", snoozedUntil: null, expiresAt: null, ...extra });
let rows = [row("linked-task"), row("old-task", { module: "events" }), row("read-task", { status: "read" })];
let failWrite = false; let failRead = false;
const visible = (item) => !item.snoozedUntil || new Date(item.snoozedUntil) <= new Date();
const unread = (workspace = "all") => rows.filter((item) => item.status === "unread" && visible(item) && (workspace === "all" || item.module === workspace)).length;
await context.route("**/api/**", async (route) => {
  const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
  if (path === "/api/auth/refresh") return route.fulfill({ json: { data: { accessToken: "browser-only-notification-fixture" } } });
  if (path === "/api/auth/me") return route.fulfill({ json: { data: account } });
  if (path === "/api/notifications/sse") return route.fulfill({ contentType: "text/event-stream", body: "event: ready\ndata: {}\n\n" });
  if (path === "/api/notifications/unread-count") return route.fulfill({ json: { unreadCount: unread(url.searchParams.get("module") || "all") } });
  if (path === "/api/notifications" && method === "GET") {
    if (failRead) return route.fulfill({ status: 503, json: { error: { message: "Synthetic inbox outage" } } });
    const status = url.searchParams.get("status") || "active"; const workspace = url.searchParams.get("module") || "all";
    const size = +(url.searchParams.get("pageSize") || 40); const current = +(url.searchParams.get("page") || 1);
    const matches = rows.filter((item) => (workspace === "all" || item.module === workspace) && (status === "all" || status === "snoozed" ? status === "all" || !visible(item) : visible(item) && item.status !== "dismissed" && (status !== "unread" || item.status === "unread")));
    return route.fulfill({ json: { items: matches.slice((current - 1) * size, current * size), total: matches.length, page: current, pageSize: size, totalPages: Math.max(1, Math.ceil(matches.length / size)), unreadCount: unread(workspace), modules: [...new Set(rows.map((item) => item.module))] } });
  }
  if (path.startsWith("/api/notifications/") && method !== "GET") {
    if (failWrite) return route.fulfill({ status: 503, json: { error: { message: "Synthetic update outage" } } });
    const body = request.postData() ? JSON.parse(request.postData()) : {}; mutations.push(`${method} ${path}`);
    if (path.endsWith("/mark-all-read")) rows = rows.map((item) => visible(item) && (body.module === "all" || item.module === body.module) && item.status === "unread" ? { ...item, status: "read" } : item);
    else {
      const [, id, action] = path.match(/\/api\/notifications\/([^/]+)\/([^/]+)/) || [];
      rows = rows.map((item) => item.id !== id ? item : { ...item, ...(action === "snooze" ? { snoozedUntil: body.until, status: "unread" } : action === "unsnooze" ? { snoozedUntil: null, status: "unread" } : { status: action === "dismiss" ? "dismissed" : action === "unread" ? "unread" : "read" }) });
    }
    return route.fulfill({ json: { ok: true } });
  }
  if (path === "/api/tasks/linked-task") return route.fulfill({ json: { id: "linked-task", title: "Linked reminder follow-up", status: "PENDING", priority: "HIGH", type: "CALL", description: "Review actual linked task", assigneeId: account.id, createdById: account.id, assignee: account, createdAt: now.toISOString(), dueDate: null } });
  if (path === "/api/tasks") return route.fulfill({ json: { items: [], total: 0, totalPages: 1 } });
  if (path === "/api/tasks/assignees") return route.fulfill({ json: { items: [account] } });
  if (path === "/api/settings") return route.fulfill({ json: { fiscalYearStart: 1 } });
  if (path === "/api/users") return route.fulfill({ json: [] });
  if (method !== "GET") throw new Error(`Unexpected real-write path blocked: ${method} ${path}`);
  return route.fulfill({ json: { items: [], total: 0 } });
});
page.on("pageerror", (error) => errors.push(error.message));
const article = (name) => page.getByRole("listitem").filter({ hasText: name });
try {
  await mkdir(evidence, { recursive: true });
  await page.goto(`${base}/notifications`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor();
  await page.getByText("2 unread", { exact: false }).first().waitFor();
  assert.equal(await page.locator("main main").count(), 0);
  await article("Task linked-task").getByRole("button", { name: "Snooze 1h" }).click();
  await page.getByLabel("Show", { exact: true }).selectOption("snoozed");
  await article("Task linked-task").getByText("Snoozed", { exact: true }).waitFor();
  await article("Task linked-task").getByRole("button", { name: "Unsnooze" }).click();
  await page.getByRole("heading", { name: "No snoozed notifications" }).waitFor();
  checks.push("Snooze hides an active notice; Snoozed inbox exposes it and Unsnooze returns it unread");
  await page.getByLabel("Show", { exact: true }).selectOption("active");
  await page.getByLabel("Workspace", { exact: true }).selectOption("events");
  await article("Task old-task").waitFor();
  assert.equal(await page.getByLabel("Workspace", { exact: true }).getByRole("option", { name: "donor", exact: true }).count(), 1);
  await article("Task old-task").getByRole("button", { name: "Mark read", exact: true }).click();
  await article("Task old-task").getByRole("button", { name: "Mark unread", exact: true }).waitFor();
  await article("Task old-task").getByRole("button", { name: "Mark unread", exact: true }).click();
  await article("Task old-task").getByRole("button", { name: "Mark read", exact: true }).waitFor();
  checks.push("Workspace filters keep every workspace option and read/unread transitions are reversible");
  await page.getByLabel("Workspace", { exact: true }).selectOption("all");
  await page.getByLabel("Workspace", { exact: true }).selectOption("donor");
  await page.getByRole("button", { name: "Mark all read", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("0 unread"));
  assert.equal(rows.find((item) => item.id === "old-task").status, "unread");
  await article("Task linked-task").getByRole("button", { name: "Mark unread", exact: true }).click();
  await page.getByLabel("Workspace", { exact: true }).selectOption("all");
  checks.push("Mark all read is workspace scoped and preserves other-workspace unread notices");
  failWrite = true;
  await article("Task linked-task").getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByRole("alert").getByText("Synthetic update outage").waitFor();
  await article("Task linked-task").waitFor(); failWrite = false;
  await article("Task linked-task").getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByLabel("Show", { exact: true }).selectOption("all");
  await article("Task linked-task").getByText("dismissed", { exact: true }).waitFor();
  checks.push("Failed updates remain explicit and retryable; dismiss retains history without active actions");
  rows.push(row("linked-task-two", { href: "/tasks?taskId=linked-task", title: "Open linked task" }));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await article("Open linked task").getByRole("button", { name: "Open task", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/tasks" && url.searchParams.get("taskId") === "linked-task");
  await page.getByText("Linked reminder follow-up", { exact: true }).filter({ visible: true }).first().waitFor();
  checks.push("Opening a notification records read state and opens the exact task outside the current list");
  await page.goto(`${base}/notifications`, { waitUntil: "networkidle" });
  failRead = true; await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("alert").getByText("Synthetic inbox outage").waitFor();
  failRead = false; await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Notification inbox"][aria-busy="true"]'));
  checks.push("Inbox failures are visible and Retry recovers without a fake empty state");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.getByRole("button", { name: "Notifications", exact: false }).filter({ visible: true }).first().click();
    const panel = page.getByRole("region", { name: "Notification panel" }).filter({ visible: true });
    await panel.getByRole("link", { name: "View all", exact: false }).waitFor();
    await panel.getByRole("button", { name: "Mark all read", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${evidence}/notifications-${width}.png`, fullPage: true }); await page.keyboard.press("Escape");
    checks.push(`Shared notification panel provides View all/Mark all read at ${width}px without horizontal overflow`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/notifications-browser-results.json`, JSON.stringify({ checks, errors, fixtureMutations: mutations, fixture: "Stateful synthetic browser-only responses; no stored data or external messages" }, null, 2));
  console.log(`${checks.length} notification browser checks passed`);
} catch (error) {
  await page.screenshot({ path: `${evidence}/notifications-failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${evidence}/notifications-failure.json`, JSON.stringify({ checks, errors, error: error.message }, null, 2)); throw error;
} finally { await browser.close(); }

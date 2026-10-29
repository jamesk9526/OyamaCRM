/** Isolated UI contract checks. Requests use synthetic fixtures; no care records are written. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.COMPASSION_UI_WEB || "http://localhost:3652";
const evidence = "docs/status/audit-artifacts/2026-10-29-compassion-refresh";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, timezoneId: "America/Chicago" });
const page = await context.newPage();
const checks = []; const errors = []; const writes = []; const requests = [];
const diagnostics = [];
page.on("pageerror", (error) => { errors.push(error.message); diagnostics.push(error.stack); });
page.on("console", (message) => { if (message.type() === "error") diagnostics.push(message.text()); });
page.on("requestfailed", (request) => diagnostics.push(`${request.url()} ${request.failure()?.errorText}`));
page.on("response", (response) => { if (response.status() >= 400) diagnostics.push(`${response.status()} ${response.url()}`); });
page.on("dialog", (dialog) => dialog.accept());
const user = { id: "care-ui-admin", organizationId: "care-ui-fixture", email: "care-ui@example.invalid", firstName: "Taylor", lastName: "Reed", role: "admin" };
const capabilities = ["records", "schedule", "casework", "clinical", "import", "export", "manage", "messages"];
let role = "ADMIN"; let failToday = false; let completed = false;
const client = { id: "care-ui-client", firstName: "Avery", lastName: "Morgan", clientStatus: "ACTIVE", intakeDate: "2026-10-01T12:00:00Z", phone: "555-0110", email: "avery@example.invalid", _count: { cases: 1, appointments: 1 } };
const staff = [{ id: "care-ui-staff", firstName: "Taylor", lastName: "Reed", fullName: "Taylor Reed", active: true }];
const resources = [{ id: "room-1", name: "Consultation room", kind: "ROOM", location: "Main center", active: true }];
const followUp = { id: "follow-up-1", clientId: client.id, title: "Confirm next visit", dueDate: "2026-10-01T12:00:00Z", status: "PENDING", priority: "HIGH", client };
await context.route("**/api/**", async (route) => {
  const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
  requests.push(`${req.method()} ${url.pathname}${url.search}`);
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (path === "/api/auth/refresh") return json({ data: { accessToken: "synthetic-ui-token" } });
  if (path === "/api/auth/me") return json({ data: user });
  if (path === "/api/compassion/access") return json({ allowed: true, role, capabilities: role === "ADMIN" ? capabilities : ["records"] });
  if (req.method() !== "GET") {
    const body = req.postDataJSON(); writes.push({ path, method: req.method(), body });
    if (path === "/api/compassion/follow-ups/follow-up-1") { completed = true; return json({ ...followUp, status: "COMPLETED" }); }
    if (path === "/api/compassion/memberships") return json({ saved: true });
    if (path === "/api/compassion/resources") { resources.push({ id: "resource-new", active: true, ...body }); return json(resources.at(-1), 201); }
  }
  if (path === "/api/compassion/today") return failToday ? json({ error: { message: "Care service is unavailable" } }, 503) : json({ activeClients: 42, activeCases: 12, pendingApprovals: 3, incompleteIntake: 4, appointments: [{ id: "appointment-1", client, startTime: new Date().toISOString(), appointmentType: "INTAKE", status: "SCHEDULED", location: "Consultation room" }], followUps: completed ? [] : [followUp] });
  if (path === "/api/compassion/clients") return json(url.searchParams.has("includeMeta") ? { items: [client], totalCount: 1, totalPages: 1, page: 1, pageSize: 50 } : [client]);
  if (path === "/api/compassion/staff") return json(staff);
  if (path === "/api/compassion/follow-ups") return json(completed ? [] : [followUp]);
  if (path === "/api/compassion/appointments") return json([]);
  if (path === "/api/compassion/reservations") return json([]);
  if (path === "/api/compassion/memberships") return json({ users: [user], roles: ["ADMIN", "RECEPTION", "CLINICIAN", "PHYSICIAN"], memberships: [{ userId: user.id, role: "ADMIN", active: true }] });
  if (path === "/api/compassion/resources") return json(resources);
  if (path === "/api/compassion/readiness") return json({ encryptedStorage: true, clinicalCutoverApproved: false });
  if (path === "/api/compassion/migration/coverage") return json({ supported: ["firstName", "lastName", "externalSourceId"], unavailable: [] });
  if (path === "/api/compassion/migration/batches") return json([]);
  return json({ error: { message: `Unexpected fixture request: ${path}` } }, 404);
});

async function go(path) { await page.goto(`${base}${path}`, { waitUntil: "networkidle" }); }
async function noPageOverflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Page overflows the viewport"); }
try {
  await go("/compassion");
  await page.getByRole("heading", { name: "Welcome back, Taylor" }).waitFor();
  assert.equal(await page.getByRole("navigation", { name: "Client care navigation" }).getByRole("link", { name: "Migration" }).count(), 0);
  await page.getByRole("navigation", { name: "Client care navigation" }).getByRole("link", { name: "Follow-ups", exact: true }).waitFor();
  await page.getByRole("navigation", { name: "Client care navigation" }).getByRole("link", { name: "Client letters" }).waitFor();
  await page.getByText("Avery Morgan", { exact: true }).waitFor();
  await noPageOverflow();
  await page.screenshot({ path: `${evidence}/today-1440.png`, fullPage: true });
  checks.push("Grouped daily/care/tool navigation; follow-ups and letters discoverable; migration absent from primary navigation");
  await page.getByRole("button", { name: "Complete Confirm next visit" }).click();
  await page.getByRole("status").getByText("Follow-up marked complete.").waitFor();
  assert.ok(writes.some((write) => write.path.endsWith("/follow-up-1") && write.body.status === "COMPLETED"));
  await page.getByText("You're all caught up", { exact: true }).waitFor();
  checks.push("Today completes a follow-up through PATCH and refreshes the queue");

  await page.getByRole("searchbox", { name: "Search clients", exact: true }).fill("Avery");
  await page.getByRole("button", { name: "Find client", exact: true }).click();
  await page.getByRole("heading", { name: "Clients", exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Search client directory" }).inputValue(), "Avery");
  await page.getByRole("link", { name: "Avery Morgan", exact: true }).waitFor();
  assert.ok(requests.some((request) => request.includes("/api/compassion/clients?search=Avery")));
  checks.push("Global client search hands the query to the directory and API");

  await go("/compassion/settings");
  await page.getByRole("heading", { name: "Workspace settings" }).waitFor();
  await page.screenshot({ path: `${evidence}/settings-1440.png`, fullPage: true });
  await page.getByRole("navigation", { name: "Compassion settings" }).getByRole("link", { name: "Migration" }).click();
  await page.getByRole("heading", { name: "Client migration" }).waitFor();
  assert.ok(page.url().endsWith("/compassion/settings/migration"));
  for (const path of ["/compassion/import/clients", "/compassion/data-tools"]) { await go(path); await page.getByRole("heading", { name: "Client migration" }).waitFor(); assert.ok(page.url().endsWith("/compassion/settings/migration")); }
  checks.push("Migration lives in Settings with compatible redirects from both previous routes");

  await go("/compassion/settings/access");
  await page.getByLabel("Platform account").selectOption(user.id);
  await page.getByRole("button", { name: "Review and grant access" }).click();
  await page.getByRole("status").getByText("Care membership updated.").waitFor();
  assert.ok(writes.some((write) => write.path.endsWith("/memberships") && write.body.role === "RECEPTION"));
  checks.push("Access management has a dedicated home and preserves explicit reviewed grants");
  await go("/compassion/settings/resources");
  await page.getByLabel("Resource name").fill("Quiet room");
  await page.getByRole("button", { name: "Add resource", exact: true }).click();
  await page.getByText("Quiet room", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Equipment", exact: true }).click();
  await page.getByText("No resources in this view", { exact: true }).waitFor();
  checks.push("Resources can be created and filtered from their dedicated settings page");

  await go("/compassion/appointments?new=1");
  await page.getByRole("heading", { name: "Schedule Appointment", exact: true }).waitFor();
  checks.push("Today's scheduling shortcut opens the appointment editor directly");

  await page.setViewportSize({ width: 390, height: 844 });
  await go("/compassion");
  await noPageOverflow();
  await page.screenshot({ path: `${evidence}/today-390.png`, fullPage: true });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation", { name: "Client care navigation" }).getByRole("link", { name: "Follow-ups", exact: true }).waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Open navigation" }).getAttribute("aria-expanded"), "false");
  await go("/compassion/settings"); await noPageOverflow();
  await page.screenshot({ path: `${evidence}/settings-390.png`, fullPage: true });
  checks.push("390px layouts have no page overflow; mobile navigation supports Escape");

  failToday = true; await go("/compassion");
  await page.getByRole("alert").getByText("Care service is unavailable").waitFor();
  await page.getByText("Your schedule is unavailable", { exact: true }).waitFor();
  assert.equal(await page.getByText("You're all caught up", { exact: true }).count(), 0);
  failToday = false; await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByText("Avery Morgan", { exact: true }).waitFor();
  checks.push("Failed requests display unavailable states; retry restores the real queue");

  role = "READONLY"; const before = requests.length;
  await go("/compassion/settings/access");
  await page.getByText("Settings access required", { exact: true }).waitFor();
  assert.equal(requests.slice(before).some((request) => request.includes("/api/compassion/memberships")), false);
  checks.push("Restricted roles do not mount settings controls or request protected membership data");
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/browser-results.json`, JSON.stringify({ checks, runtimeErrors: errors, fixture: "Isolated synthetic API responses; UI requests and reviewed mutations exercised without database writes." }, null, 2));
  console.log(JSON.stringify({ checks, runtimeErrors: errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  console.error(JSON.stringify({ url: page.url(), text: (await page.locator("body").innerText()).slice(0, 4000), requests, errors, diagnostics }, null, 2));
  throw error;
} finally { await browser.close(); }

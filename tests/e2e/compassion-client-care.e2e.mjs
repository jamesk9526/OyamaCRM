/** Isolated client-care browser verification. Identity transport is stubbed; care APIs and MySQL are real. */
import "dotenv/config";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import authModule from "../../server/src/lib/auth.ts";
const { signAccessToken } = authModule;

const base = process.env.COMPASSION_E2E_WEB || "http://127.0.0.1:3651";
const api = process.env.COMPASSION_E2E_API || "http://127.0.0.1:4100";
const evidence = "docs/status/audit-artifacts/2026-10-29-compassion";
const db = new PrismaClient({ log: [] });
const suffix = randomBytes(7).toString("hex"); const organizationId = `care_browser_${suffix}`;
const user = { id: `care_user_${suffix}`, organizationId, email: `${suffix}@example.invalid`, firstName: "Taylor", lastName: "Reed", role: "staff" };
const donor = { id: `care_donor_${suffix}`, organizationId, email: `donor_${suffix}@example.invalid`, firstName: "Donor", lastName: "Only", role: "staff" };
const token = signAccessToken({ sub: user.id, email: user.email, role: user.role, orgId: organizationId });
const donorToken = signAccessToken({ sub: donor.id, email: donor.email, role: donor.role, orgId: organizationId });
const browser = await chromium.launch({ headless: true });
const checks = []; const errors = [];
async function apiCall(path, body) {
  const response = await fetch(`${api}/api/compassion${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json(); if (!response.ok) throw new Error(`${path}: ${result.error?.message || response.status}`); return result;
}
async function identity(context, account, bearer) {
  await context.route("**/api/auth/refresh", (route) => route.fulfill({ json: { data: { accessToken: bearer } } }));
  await context.route("**/api/auth/me", (route) => route.fulfill({ json: { data: account } }));
  await context.route("**/api/auth/login", (route) => route.fulfill({ json: { data: { user: account, accessToken: bearer } } }));
}
try {
  await mkdir(evidence, { recursive: true });
  await db.organization.create({ data: { id: organizationId, name: "Compassion browser verification" } });
  for (const account of [user, donor]) await db.user.create({ data: account });
  await db.compassionMembership.create({ data: { organizationId, userId: user.id, role: "ADMIN" } });
  const client = await apiCall("/clients", { firstName: "Avery", lastName: "Morgan", email: "avery@example.invalid", phone: "555-0110" });
  const start = new Date(); start.setHours(10, 30, 0, 0);
  await apiCall("/appointments", { clientId: client.id, appointmentType: "INTAKE", startTime: start.toISOString(), durationMinutes: 60, location: "Consultation room" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await identity(context, user, token); const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const unexpectedDonorRequests = [];
  page.on("request", (req) => { if (/\/api\/(?:quickbooks|settings|constituents|donations|campaigns)\//.test(req.url())) unexpectedDonorRequests.push(req.url().replace(base, "")); });
  await page.goto(`${base}/compassion`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Welcome back, Taylor" }).waitFor();
  await page.getByText("Avery Morgan").first().waitFor();
  await page.screenshot({ path: `${evidence}/today-desktop.png`, fullPage: true }); checks.push("Today uses real client-care API data");
  if (await page.locator("[data-donor-appearance]").count()) throw new Error("Donor chrome is present inside Compassion.");
  if (unexpectedDonorRequests.length) throw new Error(`Unexpected donor requests: ${unexpectedDonorRequests.join(", ")}`);
  checks.push("No donor chrome or donor API requests inside client-care workspace");
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await page.getByRole("heading", { name: "Clients", exact: true }).waitFor();
  await page.getByText("Avery Morgan").first().waitFor();
  await page.screenshot({ path: `${evidence}/clients-desktop.png`, fullPage: true }); checks.push("Recovered client directory renders in the refactored shell");
  await page.goto(`${base}/compassion/appointments`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Client schedule" }).waitFor();
  await page.locator(".fc-view-harness").waitFor(); checks.push("Interactive scheduling calendar renders");
  await page.goto(`${base}/compassion/care?clientId=${client.id}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Clinical care", exact: true }).waitFor();
  await page.getByLabel("Encounter date", { exact: false }).fill("2026-10-29");
  await page.getByLabel(/^note$/i).fill("Synthetic browser verification note.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByText("Draft saved.", { exact: false }).waitFor(); checks.push("Clinical draft persists through the real API");
  await page.goto(`${base}/compassion/intake`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Intake inbox" }).waitFor(); checks.push("Intake request workflow renders");
  await page.goto(`${base}/compassion/import/clients`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Client migration" }).waitFor();
  await page.getByLabel("Client export CSV").setInputFiles({ name: "clients.csv", mimeType: "text/csv", buffer: Buffer.from("externalSourceId,firstName,lastName\nui-001,Casey,River\n") });
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await page.getByText("1 new · 0 updates · 0 rejected").waitFor(); checks.push("CSV mapping and server import preview work end to end");
  await page.goto(`${base}/compassion`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation", { name: "Client care navigation" }).getByRole("link", { name: "Clients", exact: true }).click();
  await page.getByRole("heading", { name: "Clients", exact: true }).waitFor();
  await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".care-sidebar")).transform).m41 < -240);
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) throw new Error("Mobile layout overflows the viewport.");
  await page.screenshot({ path: `${evidence}/clients-mobile.png`, fullPage: true }); checks.push("Mobile drawer navigation and viewport containment work");
  await context.close();
  const denied = await browser.newContext(); await identity(denied, donor, donorToken); const deniedPage = await denied.newPage();
  await deniedPage.goto(`${base}/compassion`, { waitUntil: "networkidle" });
  await deniedPage.getByRole("heading", { name: "Compassion access" }).waitFor(); checks.push("Donor-only accounts see access denial"); await denied.close();
  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await anonymous.route("**/api/auth/refresh", (route) => route.fulfill({ status: 204 })); const login = await anonymous.newPage();
  await login.goto(`${base}/compassion/clients`, { waitUntil: "networkidle" });
  await login.getByRole("heading", { name: "Welcome to Compassion" }).waitFor();
  if (!login.url().endsWith("/compassion/login")) throw new Error("Unauthenticated client-care navigation did not use its dedicated login.");
  await login.screenshot({ path: `${evidence}/login-desktop.png`, fullPage: true }); checks.push("Dedicated Compassion login and protected-route redirect work");
  await anonymous.close();
  if (errors.length) throw new Error(`Browser runtime errors: ${errors.join("; ")}`);
  await writeFile(`${evidence}/browser-results.json`, JSON.stringify({ checks, runtimeErrors: errors, fixture: "Disposable synthetic organization; client-care APIs and MySQL exercised, shared identity transport stubbed." }, null, 2));
  console.log(`Compassion browser verification: ${checks.length} checks passed.`);
} finally {
  await browser.close();
  for (const model of [db.compassionClientRedirect, db.compassionConfiguration, db.compassionAudit, db.compassionPortalAccess, db.compassionMessage, db.compassionIntake, db.compassionDocument, db.compassionChart, db.compassionReservation, db.compassionResource, db.compassionImportBatch, db.compassionEnrollment, db.compassionPointEntry, db.compassionClass, db.compassionStaffHours, db.compassionActivity, db.compassionFollowUp, db.compassionService, db.compassionAppointment, db.compassionCase, db.compassionClient, db.compassionStaff, db.compassionMembership, db.compassionScheduleLock]) await model.deleteMany({ where: { organizationId } });
  await db.user.deleteMany({ where: { organizationId } }); await db.organization.deleteMany({ where: { id: organizationId } }); await db.$disconnect();
}

// Isolated browser orchestration test: fixtures never write a database or contact a gateway.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import readinessModule from "../../server/src/services/event-creation-readiness.ts";
const { evaluateCreationReadiness } = readinessModule;

const base = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const artifacts = "docs/status/audit-artifacts/guided-event-creator";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const mode of (process.env.E2E_CREATOR_MODES?.split(",").filter(Boolean) || ["STANDARD", "TRIVIA"])) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    let event; let tickets = []; let creates = 0; let ticketCreates = 0; let previewWrites = 0;
    let failPolicy = true; let failSections = false; let failPublish = true;
    const suggestedSlugTaken = mode === "STANDARD";
    let config = { eventId: "fixture-event", pageSlug: "community-night", pageUrl: `${base}/community-night`, status: "Draft", paymentPolicy: "OfflineFollowUp", currency: "USD", sections: null, deploymentHistory: [] };
    let policySaved = false;
    const readiness = () => evaluateCreationReadiness({ event: { ...event, startDate: new Date(event.startDate), endDate: event.endDate ? new Date(event.endDate) : null, registrationDeadline: event.registrationDeadline ? new Date(event.registrationDeadline) : null }, tickets, sections: config.sections ?? [], paymentPolicy: policySaved ? config.paymentPolicy : undefined, slugValid: Boolean(config.pageSlug), slugUnique: true, stripeReady: false });
    const user = { id: "fixture-user", email: "fixture@example.org", firstName: "Event", lastName: "Organizer", role: "admin", organizationId: "fixture-org", permissions: ["view:events", "edit:events"] };
    await context.route("**/api/**", async (route) => {
      const req = route.request(); const path = new URL(req.url()).pathname; const method = req.method(); const body = method === "GET" ? {} : req.postDataJSON() ?? {};
      const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (path.endsWith("/auth/refresh")) return send({ data: { accessToken: "isolated-fixture" } });
      if (path.endsWith("/auth/me")) return send({ data: user });
      if (path === "/api/settings/branding") return send({ organizationDisplayName: "Community Foundation", primaryColor: "#2563eb", accentColor: "#0f766e", contactEmail: "events@example.org" });
      if (path === "/api/events" && method === "POST") { creates++; event = { ...body, id: "fixture-event", type: body.mode === "TRIVIA" ? "TRIVIA" : "OTHER" }; return send(event, 201); }
      if (path === "/api/events") return send(event ? [{ ...event, pageStatus: config.status }] : []);
      if (path === "/api/events/fixture-event") { if (method === "PATCH") event = { ...event, ...body }; return send({ ...event, ticketTypes: tickets }); }
      if (path.endsWith("/creation-readiness")) return send(readiness());
      if (path.includes("/ticket-types")) {
        if (method === "POST") { ticketCreates++; const ticket = { ...body, id: `fixture-ticket-${ticketCreates}` }; tickets.push(ticket); return send(ticket, 201); }
        if (method === "PATCH") { const id = path.split("/").at(-1); tickets = tickets.map((ticket) => ticket.id === id ? { ...ticket, ...body } : ticket); return send(tickets.find((ticket) => ticket.id === id)); }
        return send(tickets);
      }
      if (path.endsWith("/page-builder-config")) {
        if (method === "PATCH") {
          if (body.sections && body.pageSlug === "community-night" && suggestedSlugTaken) return send({ error: { message: "That public address is already in use." } }, 409);
          if (body.paymentPolicy && !body.sections && failPolicy) { failPolicy = false; return send({ error: { message: "Fixture payment save interrupted. Retry safely." } }, 503); }
          if (body.sections && failSections) return send({ error: { message: "Fixture page save interrupted." } }, 503);
          if (body.status === "Published" && failPublish) { failPublish = false; return send({ error: { message: "Fixture publish interrupted. Your draft remains saved." } }, 503); }
          config = { ...config, ...body, pageUrl: `${base}/${body.pageSlug || config.pageSlug}` };
          if (body.paymentPolicy) policySaved = true;
        }
        return send(config);
      }
      if (path.includes("/register") || path.includes("/checkout") || path.includes("/emails/send")) { previewWrites++; return send({ error: { message: "Preview must not send requests" } }, 500); }
      if (path.endsWith("/report")) return send({ attendance: { total: 0 }, revenue: { total: 0 } });
      return send([]);
    });
    const page = await context.newPage(); const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    await page.goto(`${base}/events/new`);
    // Webpack can swap a dev chunk while the next isolated browser context hydrates.
    // Retry only this initial mount; workflow assertions below never retry writes.
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await page.getByRole("heading", { name: "Create your event" }).waitFor({ timeout: 5000 }); break; }
      catch (error) {
        if (attempt === 2) { console.log(mode, page.url(), (await page.locator("body").innerText()).slice(0,1500), errors); throw error; }
        errors.length = 0;
        await page.reload();
      }
    }
    assert.equal(await page.getByRole("complementary", { name: "OyamaCRM 1.31b updates" }).count(), 0);
    assert.equal(await page.locator(".event-studio-right-rail").count(), 0);
    if (mode === "TRIVIA") await page.getByRole("radio", { name: /Trivia night/ }).check();
    await page.getByLabel("Event name", { exact: true }).fill(`${mode} Community Night`);
    await page.getByLabel("Start date and time", { exact: true }).fill("2030-10-01T18:00");
    await page.getByLabel("Venue name (optional)").fill("Community Hall");
    await page.screenshot({ path: `${artifacts}/${mode.toLowerCase()}-details.png`, fullPage: true });
    await page.getByRole("button", { name: "Save & continue", exact: true }).click();
    await page.getByRole("heading", { name: "Registration", exact: true }).waitFor();
    assert.equal(creates, 1);
    assert.equal(event.type, mode === "TRIVIA" ? "TRIVIA" : "OTHER");
    if (mode === "TRIVIA") {
      await page.getByLabel("Table package — covers multiple guests").check();
      await page.getByLabel("Price (0 for free)").fill("160");
    }
    await page.getByLabel("How will guests pay?").selectOption(mode === "TRIVIA" ? "PayAtEvent" : "NoPaymentRequired");
    await page.getByRole("button", { name: "Save & continue", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Fixture payment save interrupted" }).waitFor();
    assert.equal(ticketCreates, 1);
    await page.getByRole("button", { name: "Save & continue", exact: true }).click();
    await page.getByRole("heading", { name: "Design", exact: true }).waitFor();
    await page.waitForURL("**/create?step=design");
    await page.getByLabel("Public address", { exact: true }).waitFor();
    assert.equal(ticketCreates, 1, "Retry must update the already-created ticket");
    if (suggestedSlugTaken) {
      await page.getByText("Changes could not be saved.", { exact: false }).first().waitFor();
      await page.getByLabel("Public address", { exact: true }).fill("community-night-new");
    }
    await page.getByLabel("Title Override", { exact: true }).fill("A night for our community");
    failSections = true;
    await page.getByRole("button", { name: "Save & review", exact: true }).click();
    await page.getByText("Fixture page save interrupted.", { exact: true }).first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get("step"), "design");
    failSections = false;
    await page.getByRole("button", { name: "Save & review", exact: true }).click();
    await page.getByRole("heading", { name: "Review & publish", exact: true }).waitFor();
    await page.waitForURL("**/create?step=review");
    await page.getByRole("button", { name: "Publish event page", exact: true }).waitFor();
    await page.getByRole("button", { name: "Registration preview", exact: true }).click();
    await page.getByRole("dialog", { name: "Registration preview" }).waitFor();
    await page.getByRole("button", { name: "mobile preview", exact: true }).click();
    await page.screenshot({ path: `${artifacts}/${mode.toLowerCase()}-registration-preview.png`, fullPage: true });
    assert.equal(await page.getByRole("dialog", { name: "Registration preview" }).getByRole("button", { name: /^(Register|Reserve seats)/ }).isDisabled(), true);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Registration preview" }).waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("button", { name: "Registration preview", exact: true }).evaluate((element) => document.activeElement === element), true);
    assert.equal(previewWrites, 0);
    await page.getByRole("button", { name: "Publish event page", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Fixture publish interrupted" }).first().waitFor();
    assert.equal(config.status, "Draft");
    await page.getByRole("button", { name: "Publish event page", exact: true }).click();
    await page.getByRole("heading", { name: "Your event page is live" }).waitFor();
    assert.equal(config.status, "Published");
    assert.equal(errors.length, 0, errors.join("\n"));
    await context.close();
    console.log(`${mode}: creation, partial-save retry, draft save failure, preview, and explicit publishing passed`);
  }
  // Separate draft fixture to verify resume and compact layouts.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path.endsWith("/auth/refresh")) data = { data: { accessToken: "fixture" } };
    else if (path.endsWith("/auth/me")) data = { data: { id: "fixture", email: "fixture@example.org", role: "admin", organizationId: "fixture" } };
    else if (path.endsWith("/creation-readiness")) data = { ready: false, nextStep: "registration", checks: [{ id: "policy", step: "registration", passed: false, label: "Choose payment" }], warnings: [] };
    else if (path.endsWith("/page-builder-config")) data = { status: "Draft", pageSlug: "draft", sections: null, paymentPolicy: "OfflineFollowUp" };
    else if (path === "/api/events") data = [{ id: "draft", name: "Draft Community Night", type: "OTHER", startDate: "2030-10-01T18:00:00Z", active: true, pageStatus: "Draft" }];
    else if (path === "/api/events/draft") data = { id: "draft", type: "OTHER", name: "Draft Community Night", startDate: "2030-10-01T18:00:00Z", active: true, visibility: "PUBLIC" };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  await page.goto(`${base}/events/events`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await page.getByRole("link", { name: "Continue creation", exact: true }).waitFor({ timeout: 5000 }); break; }
    catch (error) { if (attempt === 2) throw error; await page.reload(); }
  }
  await page.getByRole("link", { name: "Continue creation", exact: true }).click();
  await page.getByRole("heading", { name: "Registration", exact: true }).waitFor();
  assert.equal(await page.locator(".event-studio-right-rail").count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  await page.getByLabel("Ticket name").fill("Unsaved ticket");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "All events", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/events/draft/create");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.evaluate(() => history.back());
  await page.getByLabel("Ticket name").waitFor();
  assert.equal(await page.getByLabel("Ticket name").inputValue(), "Unsaved ticket");
  assert.equal(new URL(page.url()).pathname, "/events/draft/create");
  await page.screenshot({ path: `${artifacts}/mobile-registration.png`, fullPage: true });
  await context.close();
  console.log("Mobile: draft resume, unsaved-navigation warning, and no horizontal overflow passed");
} catch (error) {
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) { console.log("Failure:", page.url(), (await page.locator("body").innerText()).slice(0, 4000)); await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }); }
  throw error;
} finally { await browser.close(); }

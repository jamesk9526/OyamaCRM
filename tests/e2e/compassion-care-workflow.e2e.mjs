/** Rendered interaction checks using synthetic fixtures only; no clinical database writes. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.COMPASSION_UI_WEB || "http://127.0.0.1:6368";
const evidence = "docs/status/audit-artifacts/2026-11-03-compassion-care-workflow";
await mkdir(evidence, { recursive: true });
const checks = []; const errors = []; const warnings = []; const writes = [];
let contrast = [];
let confirmationCount = 0;
let activePage;
const client = { id: "fixture-client", firstName: "Avery", lastName: "Morgan", clientStatus: "ACTIVE", intakeDate: "2026-10-20T12:00:00Z", safeContact: { email: true }, cases: [], appointments: [] };
const second = { ...client, id: "fixture-client-2", firstName: "Jordan", lastName: "Rivera" };
const user = { id: "fixture-clinician", role: "staff", firstName: "Taylor", lastName: "Reed", email: "care@example.invalid", organizationId: "synthetic-care-ui" };
const clinical = ["records", "schedule", "casework", "clinical", "messages"];
let role = "CLINICIAN"; let failList = false; let emptyList = false; let sequence = 10; let acceptDialog = true; let omitSelectedClient = false;
const content = { examDate: "2026-11-02", examType: "LIMITED_OBSTETRIC", performedBy: "Taylor Reed", indication: "Synthetic follow-up visit", findings: "Synthetic recorded findings", impression: "Synthetic clinician impression", followUp: "Synthetic follow-up plan", appointmentId: "fixture-appointment" };
const charts = ["DRAFT", "REVIEW", "SIGNED"].map((status, index) => ({ id: `fixture-exam-${index}`, clientId: index === 2 ? second.id : client.id, authorId: user.id, status, kind: "ULTRASOUND", version: 1, createdAt: "2026-11-02T12:00:00Z", updatedAt: "2026-11-02T12:00:00Z", content: { ...content } }));
const documents = charts.slice(1).map((chart, index) => ({ id: `fixture-scan-${index}`, chartId: chart.id, clientId: chart.clientId, name: `synthetic-scan-${index}.png`, mimeType: "image/png", size: 68 }));
const followUps = [{ id: "fixture-task", chartId: "fixture-exam-0", clientId: client.id, title: "Client-care follow-up", dueDate: "2026-01-01T18:00:00Z", status: "IN_PROGRESS", priority: "HIGH", assignedStaffId: user.id, client }];
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA1sAAAAASUVORK5CYII=";
const appointment = { id: "fixture-appointment", clientId: client.id, startTime: "2026-11-03T15:00:00Z", endTime: "2026-11-03T16:00:00Z", appointmentType: "ULTRASOUND", status: "SCHEDULED", location: "Consultation room", client };
const currentUser = () => role === "PHYSICIAN" ? { ...user, id: "fixture-physician", firstName: "Morgan", lastName: "Lee" } : user;
const counts = () => Object.fromEntries(["DRAFT", "REVIEW", "SIGNED"].map((status) => [status, charts.filter((chart) => chart.status === status).length]));
const browser = await chromium.launch({ headless: true });

async function createContext(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: "America/Chicago", serviceWorkers: "block" });
  await context.route("**/api/**", async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (path === "/api/auth/refresh") return json({ data: { accessToken: "synthetic-ui-session" } });
    if (path === "/api/auth/me") return json({ data: currentUser() });
    if (path === "/api/compassion/access") return json({ allowed: true, role, capabilities: role === "READONLY" ? ["records"] : [...clinical, ...(role === "PHYSICIAN" ? ["sign"] : [])] });
    const chartId = /^\/api\/compassion\/charts\/([^/]+)/.exec(path)?.[1];
    const chart = charts.find((item) => item.id === chartId);
    if (req.method() !== "GET") {
      const body = req.postDataJSON(); writes.push({ path, method: req.method(), body });
      if (path === "/api/compassion/charts") {
        const previous = charts.find((item) => item.id === body.previousId);
        const created = { id: `fixture-exam-${++sequence}`, clientId: body.clientId, authorId: currentUser().id, kind: body.kind, status: "DRAFT", version: previous ? previous.version + 1 : 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), content: body.content };
        charts.unshift(created); return json({ id: created.id }, 201);
      }
      if (chart) {
        if (path.endsWith("/submit")) chart.status = "REVIEW";
        else if (path.endsWith("/sign")) chart.status = "SIGNED";
        else if (path.endsWith("/return")) { chart.status = "DRAFT"; chart.content._review = { reason: body.reason }; }
        else if (req.method() === "PATCH") chart.content = { ...body.content, ...(chart.content._review ? { _review: chart.content._review } : {}) };
        chart.updatedAt = new Date(Date.now() + ++sequence).toISOString(); return json({ id: chart.id, status: chart.status });
      }
      if (path === "/api/compassion/documents") { const file = { id: `fixture-scan-${++sequence}`, ...body, size: 68 }; documents.push(file); return json({ id: file.id }, 201); }
      if (/\/ultrasounds\/[^/]+\/follow-ups$/.test(path)) {
        const exam = charts.find((item) => item.id === path.split("/")[4]);
        const task = { id: `fixture-task-${++sequence}`, chartId: exam.id, clientId: exam.clientId, title: "Client-care follow-up", status: "PENDING", ...body, client };
        followUps.push(task); return json(task, 201);
      }
      if (/\/follow-ups\/[^/]+$/.test(path)) { const task = followUps.find((item) => item.id === path.split("/").at(-1)); Object.assign(task, body); return json(task); }
      return json({ error: { message: `Unexpected fixture mutation: ${path}` } }, 400);
    }
    if (path === "/api/compassion/ultrasounds/summary") return json({ ...counts(), openFollowUps: followUps.filter((task) => task.status !== "COMPLETED").length, overdueFollowUps: 1 });
    if (path === "/api/compassion/ultrasounds") {
      if (failList) return json({ error: { message: "Synthetic care service unavailable" } }, 503);
      let found = emptyList ? [] : charts.filter((item) => !url.searchParams.get("clientId") || item.clientId === url.searchParams.get("clientId"));
      if (url.searchParams.get("search")) found = found.filter((item) => { const patient = item.clientId === client.id ? client : second; return `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(url.searchParams.get("search").toLowerCase()); });
      const all = found; if (url.searchParams.get("status")) found = found.filter((item) => item.status === url.searchParams.get("status"));
      return json({ items: found.map((item) => ({ ...item, client: item.clientId === client.id ? client : second, examDate: item.content.examDate || "", performedBy: item.content.performedBy || "", attachmentCount: documents.filter((file) => file.chartId === item.id).length, appointment: item.content.appointmentId ? appointment : null, followUps: followUps.filter((task) => task.chartId === item.id) })), counts: Object.fromEntries(["DRAFT", "REVIEW", "SIGNED"].map((status) => [status, all.filter((item) => item.status === status).length])), total: found.length, page: 1, pageSize: 25 });
    }
    if (chart && path.endsWith("/report")) return json({ title: "Limited Ultrasound Report", client, version: chart.version, content: Object.fromEntries(Object.entries(chart.content).filter(([key]) => key !== "_review")), signedAt: new Date().toISOString(), signedById: "fixture-physician", signatureDigest: "synthetic-integrity-reference" });
    if (chart) return json({ ...chart, client: chart.clientId === client.id ? client : second });
    if (path === "/api/compassion/clients") return json(omitSelectedClient ? [second] : [client, second]);
    if (path === `/api/compassion/clients/${client.id}`) return json(client);
    if (path === `/api/compassion/clients/${second.id}`) return json(second);
    if (path === "/api/compassion/documents") return json(documents.filter((file) => file.clientId === url.searchParams.get("clientId")));
    if (/\/documents\/[^/]+\/download$/.test(path)) return json({ name: "synthetic-scan.png", mimeType: "image/png", base64: png });
    if (path === "/api/compassion/clinical-team") return json([user, { id: "fixture-physician", firstName: "Morgan", lastName: "Lee" }]);
    if (path === "/api/compassion/appointments") return json([appointment]);
    if (path === "/api/compassion/staff") return json([]);
    if (path === "/api/compassion/resources" || path === "/api/compassion/reservations") return json([]);
    if (path === "/api/compassion/follow-ups") return json(followUps.filter((task) => (!url.searchParams.get("chartId") || task.chartId === url.searchParams.get("chartId")) && (url.searchParams.get("status") !== "OPEN" || task.status !== "COMPLETED")));
    if (path === "/api/compassion/today") return json({ activeClients: 8, activeCases: 5, pendingApprovals: 2, incompleteIntake: 1, appointments: [appointment], followUps: followUps.filter((task) => task.status !== "COMPLETED") });
    return json({ error: { message: `Unexpected fixture request: ${path}` } }, 404);
  });
  const page = await context.newPage();
  activePage = page;
  page.on("pageerror", error => errors.push(error.stack || error.message));
  page.on("console", message => { if (message.type() === "warning") warnings.push(message.text()); if (message.type() === "error" && !message.text().includes("503")) errors.push(message.text()); });
  page.on("dialog", dialog => { if (dialog.type() === "confirm") confirmationCount++; return acceptDialog ? dialog.accept() : dialog.dismiss(); });
  return { context, page };
}
async function go(page, path) { await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 }); }
async function noOverflow(page) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Page overflows viewport"); }
async function shot(page, name) { await page.locator("h1").first().scrollIntoViewIfNeeded(); await noOverflow(page); await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true }); }

try {
  const { context, page } = await createContext();
  await go(page, "/compassion/ultrasounds");
  await page.getByRole("heading", { name: "Ultrasounds", exact: true }).waitFor();
  await page.locator(".care-exam-item").first().waitFor();
  await shot(page, "after-worklist-1440");
  contrast = await page.evaluate(() => {
    const luminance = (color) => { const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
    return [".care-exam-stats small", ".care-exam-item-date", ".care-exam-item-bottom", ".care-exam-filters .care-segmented button", ".care-heading .care-button:not(.secondary)"].map(selector => {
      const element = document.querySelector(selector); const foreground = getComputedStyle(element).color;
      let parent = element; let background = "rgba(0, 0, 0, 0)";
      while (parent && background === "rgba(0, 0, 0, 0)") { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
      if (background === "rgba(0, 0, 0, 0)") background = "rgb(255, 255, 255)";
      const a = luminance(foreground), b = luminance(background);
      return { selector, foreground, background, ratio: Number(((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2)) };
    });
  });
  assert.ok(contrast.every(item => item.ratio >= 4.5), JSON.stringify(contrast));
  await page.getByRole("button", { name: "New examination", exact: true }).focus(); await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.matches(".care-stat") && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2), true);
  checks.push("Scoped text/action contrast meets 4.5:1 and keyboard navigation shows a visible focus ring");
  await page.locator(".care-segmented").getByRole("button", { name: "Awaiting review", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".care-exam-item").length === 1);
  await page.getByRole("searchbox", { name: "Search ultrasound clients" }).fill("No matching person");
  await page.getByText("No examinations match these filters", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  checks.push("Worklist, status filtering, client-name search, and empty-filter recovery");

  await go(page, `/compassion/clients/${client.id}`);
  await page.getByRole("button", { name: "ultrasounds", exact: true }).click();
  await page.getByRole("heading", { name: "Ultrasound history" }).waitFor();
  await shot(page, "after-client-1440");
  omitSelectedClient = true;
  await page.getByRole("link", { name: "New examination", exact: false }).click();
  await page.getByRole("heading", { name: "New ultrasound exam" }).waitFor();
  await page.waitForFunction(() => document.querySelector('select[aria-label="Client"]')?.value === "fixture-client");
  assert.equal(await page.getByLabel("Client", { exact: true }).inputValue(), client.id);
  await page.getByLabel("Findings", { exact: true }).fill("Unsaved patient-specific test findings");
  const currentUrl = page.url(); acceptDialog = false;
  const priorConfirmations = confirmationCount;
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 3000 }).catch(error => { if (error.name !== "TimeoutError" && !/aborted|cancel|interrupted/i.test(error.message)) throw error; });
  assert.ok(confirmationCount > priorConfirmations, "Browser history invokes the unsaved-exam confirmation");
  assert.equal(page.url(), currentUrl); assert.equal(await page.getByLabel("Findings", { exact: true }).inputValue(), "Unsaved patient-specific test findings");
  await page.getByRole("link", { name: "Schedule ultrasound", exact: true }).click();
  assert.equal(page.url(), currentUrl); assert.equal(await page.getByLabel("Findings", { exact: true }).inputValue(), "Unsaved patient-specific test findings");
  acceptDialog = true;
  await page.getByLabel("Client", { exact: true }).selectOption(second.id);
  assert.equal(await page.getByLabel("Findings", { exact: true }).inputValue(), "");
  omitSelectedClient = false; await page.getByLabel("Find a client", { exact: true }).fill("Avery");
  await page.getByLabel("Client", { exact: true }).selectOption(client.id);
  checks.push("Preselected client outside directory results, browser-history and scheduling navigation guards, and client-change content reset");
  await page.getByLabel("Exam date", { exact: true }).fill("2026-11-03");
  await page.getByLabel("Performed by", { exact: true }).fill("Taylor Reed");
  await page.getByLabel("Linked ultrasound appointment").selectOption(appointment.id);
  for (const [label, value] of [["Indication / reason for exam", "Synthetic care visit"], ["Findings", "Synthetic documented findings"], ["Clinical impression", "Synthetic documented impression"], ["Follow-up plan", "Synthetic care plan"]]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Create exam draft", exact: true }).click();
  await page.getByLabel("Attach scan or report").waitFor();
  const createdId = charts[0].id;
  await page.getByLabel("Attach scan or report").setInputFiles({ name: "synthetic-upload.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.getByText("Supporting files updated.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("img", { name: "synthetic-scan.png", exact: true }).waitFor();
  await shot(page, "after-examination-1440");
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("button", { name: "Submit for physician review" }).click();
  await page.getByText("Awaiting physician review. This examination and its attachments are locked.", { exact: true }).waitFor();
  assert.ok(writes.some((write) => write.path.endsWith("/submit") && write.body.expectedUpdatedAt));
  await page.getByLabel("Task due date").fill("2026-11-05");
  await page.getByLabel("Task priority").selectOption("HIGH");
  await page.getByRole("button", { name: "Review and create follow-up" }).click();
  await page.getByText("Care follow-up created and linked to this exam.", { exact: true }).waitFor();
  assert.ok(writes.some((write) => write.path.includes("/ultrasounds/") && write.body.approve === true));
  checks.push("Client-scoped draft, linked ultrasound visit, protected upload and preview, submission, and reviewed follow-up creation");

  role = "PHYSICIAN"; await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Request a correction", { exact: true }).click();
  await page.getByLabel("Correction requested").fill("Clarify the synthetic scan findings.");
  await page.getByRole("button", { name: "Return to author" }).click();
  await page.getByText("This draft is editable by its author.", { exact: false }).waitFor();
  assert.equal(await page.getByLabel("Exam date", { exact: true }).isDisabled(), true);
  role = "CLINICIAN"; await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Findings", { exact: true }).fill("Corrected synthetic findings");
  assert.equal(await page.getByRole("button", { name: "Submit for physician review" }).isDisabled(), true);
  await page.getByRole("button", { name: "Save examination", exact: true }).click();
  await page.getByText("Ultrasound draft saved.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Submit for physician review" }).click();
  await page.getByText("Awaiting physician review. This examination and its attachments are locked.", { exact: true }).waitFor();
  role = "PHYSICIAN"; await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("I reviewed this examination and all supporting scans.").check();
  await page.getByRole("button", { name: "Sign examination", exact: true }).click();
  await page.getByRole("link", { name: "Open signed report", exact: true }).waitFor();
  await shot(page, "after-signed-examination-1440");
  await page.getByRole("link", { name: "Open signed report", exact: true }).click();
  await page.getByRole("heading", { name: "Limited Ultrasound Report", exact: true }).waitFor();
  await page.emulateMedia({ media: "print" }); await shot(page, "signed-report-print");
  assert.equal(await page.locator(".care-sidebar").isVisible(), false);
  await page.emulateMedia({ media: "screen" });
  checks.push("Physician correction request, author-only correction, unsaved-change submit guard, explicit sign-off, and preserved print report");
  await go(page, `/compassion/ultrasounds?examId=${createdId}`);
  await page.getByRole("button", { name: "Prepare amendment", exact: true }).click();
  await page.getByLabel("Reason for amendment", { exact: true }).fill("Synthetic correction to the signed report");
  acceptDialog = false; await page.getByRole("button", { name: "Cancel amendment", exact: true }).click();
  assert.equal(await page.getByLabel("Reason for amendment", { exact: true }).inputValue(), "Synthetic correction to the signed report");
  acceptDialog = true;
  await page.getByRole("button", { name: "Save amendment draft", exact: true }).click();
  await page.getByText("Amendment saved as a new draft. Add supporting scans before review.", { exact: true }).waitFor();
  assert.equal(charts.find(chart => chart.id === createdId).status, "SIGNED");
  assert.ok(writes.some(write => write.path === "/api/compassion/charts" && write.body.previousId === createdId));
  checks.push("Amendments create a new draft and preserve the signed original; cancelling unsaved amendments is guarded");

  role = "CLINICIAN"; await go(page, "/compassion");
  await page.getByRole("heading", { name: "Clinical handoffs" }).waitFor(); await shot(page, "after-today-1440");
  await go(page, "/compassion/follow-ups");
  await page.getByRole("link", { name: "Open examination", exact: false }).first().waitFor();
  await page.getByRole("button", { name: "Complete Client-care follow-up", exact: true }).first().click();
  await page.getByRole("combobox", { name: "Follow-up status" }).selectOption("OVERDUE");
  checks.push("Today clinical handoffs, examination links in care follow-ups, and completion of an in-progress task");
  await go(page, `/compassion/appointments?new=1&clientId=${client.id}&appointmentType=ULTRASOUND`);
  await page.getByRole("combobox", { name: "Appointment client", exact: true }).waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Appointment client", exact: true }).inputValue(), client.id);
  const editor = page.locator("form").filter({ has: page.getByRole("combobox", { name: "Appointment client", exact: true }) });
  assert.equal(await editor.getByRole("combobox", { name: "Appointment type", exact: true }).inputValue(), "ULTRASOUND");
  checks.push("Existing scheduling editor prefills the patient and ultrasound visit type");
  failList = true; await go(page, "/compassion/ultrasounds");
  await page.getByText("Examinations are unavailable", { exact: true }).waitFor(); failList = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click(); await page.locator(".care-exam-item").first().waitFor();
  emptyList = true; await page.getByRole("button", { name: "Refresh ultrasound worklist" }).click();
  await page.getByText("A clear place for every ultrasound", { exact: true }).waitFor(); await shot(page, "after-empty-1440"); emptyList = false;
  role = "READONLY"; await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Clinical access required", { exact: true }).waitFor();
  assert.equal(await page.getByRole("navigation", { name: "Client care navigation" }).getByRole("link", { name: "Ultrasounds", exact: true }).count(), 0);
  checks.push("Service error/retry, empty state, and clinical capability visibility");
  await context.close();

  role = "CLINICIAN";
  for (const width of [390, 768]) {
    const mobile = await createContext(width); const p = mobile.page;
    await go(p, "/compassion/ultrasounds"); await p.locator(".care-exam-item").first().waitFor(); await shot(p, `after-worklist-${width}`);
    if (width === 390) { await p.getByRole("button", { name: "Open navigation", exact: true }).click(); await p.getByRole("navigation", { name: "Client care navigation" }).getByRole("link", { name: "Ultrasounds", exact: true }).waitFor(); await p.keyboard.press("Escape"); }
    await go(p, `/compassion/ultrasounds?examId=${createdId}`); await p.getByLabel("Exam date", { exact: true }).waitFor(); await shot(p, `after-examination-${width}`);
    await mobile.context.close();
  }
  checks.push("390px and 768px worklists/examinations without page overflow; mobile navigation and Escape dismissal");
  assert.deepEqual(errors, [], "Unexpected browser runtime errors");
  await writeFile(`${evidence}/ui-checks.json`, JSON.stringify({ syntheticFixtures: true, liveClinicalWrites: false, checks, errors, warnings, contrast, writes: writes.map(({ path, method }) => ({ path, method })) }, null, 2));
  console.log(JSON.stringify({ checks, errors, warnings }, null, 2));
} catch (error) {
  if (activePage && !activePage.isClosed()) { await activePage.screenshot({ path: `${evidence}/ui-failure.png`, fullPage: true }); console.log((await activePage.locator("body").innerText()).slice(-2500)); }
  await writeFile(`${evidence}/ui-failure.json`, JSON.stringify({ message: error.message, checks, errors }, null, 2)); throw error;
} finally { await browser.close(); }

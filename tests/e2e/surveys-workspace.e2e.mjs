import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import definitionModule from "../../server/src/surveys/definition.ts";

const { evaluateAnswers, parseDefinition, starterTemplates } = definitionModule;
const base = process.env.SURVEYS_WEB_URL || "http://127.0.0.1:6487";
const evidence = process.env.SURVEYS_EVIDENCE_DIR || "docs/status/audit-artifacts/2026-11-05-surveys";
const abilities = ["view", "edit", "publish", "send", "responses", "export"];
const timezone = "America/Chicago";
const template = starterTemplates("DONOR")[0];
const token = "A".repeat(43);
const formPath = `/s/respond#d.${token}`;
const card = { id: "synthetic-survey", title: "Donor experience", audience: "DONOR", identity: "ANONYMOUS", status: "DRAFT",
  published: 0, closesAt: null, updatedAt: "2026-11-05T18:00:00.000Z", responseCount: 0 };
const contact = { id: "synthetic-donor", name: "Sample donor", email: "donor@example.invalid" };
let survey;
let publication;
let batch;
let answer;
let careOnly = false;
const browser = await chromium.launch({ headless: true, ...(process.env.SURVEYS_BROWSER_CHANNEL ? { channel: process.env.SURVEYS_BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: timezone });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", error => errors.push(error.message));
await mkdir(evidence, { recursive: true });

await context.route("**/api/**", async route => {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;
  const send = (json, status = 200) => route.fulfill({ status, json });
  if (path === "/api/auth/refresh") return send({ data: { accessToken: "synthetic-test-token" } });
  if (path === "/api/auth/me") return send({ data: { id: "synthetic-author", organizationId: "synthetic-org", firstName: "Taylor",
    lastName: "Reed", email: "taylor@example.invalid", role: careOnly ? "compassion_user" : "admin" } });
  if (path === "/api/surveys/access") return send({ DONOR: abilities, CLIENT: [], timezone });
  if (path === "/api/compassion/surveys/access") return send({ DONOR: [], CLIENT: abilities, timezone });
  if (path.endsWith("/surveys/templates")) return send(starterTemplates(url.searchParams.get("audience")));
  if (path === "/api/surveys" && req.method() === "POST") {
    const input = req.postDataJSON();
    assert.equal(input.templateId, template.id);
    assert.equal(input.identity, "ANONYMOUS");
    survey = { ...card, title: input.title, draft: { ...template.definition, title: input.title }, editVersion: 1,
      timezone, abilities, revisions: [], hasUnpublishedChanges: true };
    return send(survey, 201);
  }
  if (path === "/api/surveys" || path === "/api/compassion/surveys") return send({ items: survey && path === "/api/surveys" ? [survey] : [], page: 1, total: survey && path === "/api/surveys" ? 1 : 0 });
  if (path === `/api/surveys/${card.id}`) {
    if (req.method() === "PATCH") {
      const body = req.postDataJSON();
      assert.equal(body.editVersion, survey.editVersion);
      survey.draft = parseDefinition(body.definition);
      survey.editVersion++;
      return send({ editVersion: survey.editVersion, draft: survey.draft });
    }
    return send(survey);
  }
  if (path.endsWith("/publish")) {
    assert.equal(req.postDataJSON().editVersion, survey.editVersion);
    publication = parseDefinition(survey.draft, true);
    Object.assign(survey, { status: "LIVE", published: 1, hasUnpublishedChanges: false,
      revisions: [{ id: "synthetic-revision", number: 1, path: formPath, createdAt: card.updatedAt }] });
    return send({ revision: 1 });
  }
  if (path.endsWith("/contacts")) return send([contact]);
  if (path.endsWith("/lists")) return send([]);
  if (path.endsWith("/distributions/review")) {
    const input = req.postDataJSON();
    assert.deepEqual(input.contactIds, [contact.id]);
    assert.equal(input.reminderDays, 7);
    return send({ rows: [{ ...contact, excluded: null }], ready: 1, missing: 0, unlinkedEntries: 0,
      sender: "Sample organization <team@example.invalid>", subject: input.subject, message: input.message,
      scheduledAt: null, closesAt: null, reminderDays: 7, revision: { number: 1 }, reviewHash: "synthetic-review" });
  }
  if (path.endsWith("/distributions")) {
    if (req.method() === "POST") {
      const input = req.postDataJSON();
      assert.equal(input.reviewHash, "synthetic-review");
      assert.match(input.requestKey, /^[a-f0-9-]{36}$/);
      batch = { id: "synthetic-batch", revision: 1, subject: input.subject, sendAt: card.updatedAt,
        recipients: 1, reminderDays: 7, counts: { QUEUED: 2 } };
      return send({ id: batch.id }, 202);
    }
    return send(batch ? [batch] : []);
  }
  if (path === "/api/public/surveys/form") {
    assert.deepEqual(req.postDataJSON(), { token });
    assert.equal(req.headers().authorization, undefined);
    return send({ definition: publication, organization: "Sample organization", identity: "ANONYMOUS", completed: false });
  }
  if (path === "/api/public/surveys/responses") {
    const input = req.postDataJSON();
    assert.equal(input.token, token);
    assert.equal(input.answers.rating, 2);
    assert.equal(input.answers["follow-up"], "Synthetic follow-up feedback");
    assert.deepEqual(evaluateAnswers(publication, input.answers).errors, {});
    answer = { id: "synthetic-answer", name: "Anonymous response", createdAt: card.updatedAt,
      contactId: null, revision: 1, title: survey.title, answers: [
        { id: "rating", title: publication.sections[0].questions[0].title, value: input.answers.rating },
        { id: "follow-up", title: publication.sections[0].questions[1].title, value: input.answers["follow-up"] },
      ] };
    return send({ completed: true }, 201);
  }
  if (path.endsWith("/summary")) return send({ completed: answer ? 1 : 0, invitationStats: null,
    questions: [{ id: "rating", title: publication.sections[0].questions[0].title, type: "rating", answered: 1,
      average: 2, nps: null, distribution: [{ label: "2", count: 1, percentage: 100 }] }] });
  if (path.endsWith("/responses/synthetic-answer")) return send(answer);
  if (path.endsWith("/responses")) return send({ items: answer ? [answer] : [], total: answer ? 1 : 0 });
  if (path.endsWith("/export.csv")) return route.fulfill({ status: 200, headers: {
    "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="survey-responses-v1.csv"',
  }, body: "Response ID,Revision\nsynthetic-answer,1\n" });
  // Shared topbar services are outside this test's survey behavior.
  return send({});
});

async function image(name, target = page) {
  assert.equal(await target.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} page overflow`);
  const topbar = target.locator("[data-topbar-root]");
  const heading = target.getByRole("heading", { level: 1 }).first();
  if (await topbar.count() && await heading.count()) {
    const topbarBox = await topbar.boundingBox();
    const headingBox = await heading.boundingBox();
    const scrollY = await target.evaluate(() => window.scrollY);
    assert.ok(headingBox.y + scrollY >= topbarBox.height, `${name} workspace reserves the fixed topbar height`);
  }
  await target.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}

try {
  await page.goto(`${base}/surveys`, { timeout: 120_000 });
  await page.getByRole("heading", { name: "Your survey library is empty" }).waitFor();
  await image("library-1440");
  await page.getByRole("button", { name: "Donor experience" }).click();
  await page.getByRole("button", { name: "Start building" }).click();
  await page.getByRole("heading", { name: "Sections and questions" }).waitFor();
  await page.getByRole("button", { name: "Section", exact: true }).click();
  await page.getByRole("button", { name: "Add question" }).last().click();
  await page.getByRole("textbox", { name: "Question text" }).fill("Would you recommend our organization?");
  await page.getByLabel("Question type").selectOption("boolean");
  await page.getByLabel("Required when shown").check();
  await page.getByRole("button", { name: "Apply question" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Draft saved.").waitFor();
  await page.setViewportSize({ width: 1366, height: 768 });
  await image("builder-1366");
  await page.setViewportSize({ width: 1280, height: 720 });
  await image("builder-1280");
  await page.setViewportSize({ width: 390, height: 844 });
  await image("builder-390");
  await page.getByRole("button", { name: "Preview survey" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Please answer this question.").waitFor();
  assert.equal(await page.getByRole("radio", { name: "1", exact: true }).evaluate(input => input === document.activeElement), true);
  await page.getByRole("radio", { name: "2", exact: true }).check();
  await page.getByLabel("What would help you feel more connected?").waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: "Yes", exact: true }).check();
  await page.getByRole("button", { name: "Submit preview" }).click();
  await page.getByRole("heading", { name: "Response complete" }).waitFor();
  assert.equal(answer, undefined);
  checks.push("Template creation, question editor, responsive builder, save, keyboard error focus, conditional question, multi-page preview");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Review publication" }).click();
  await page.getByRole("button", { name: "Publish survey", exact: true }).click();
  await page.getByRole("heading", { name: "Shared survey link" }).waitFor();
  assert.equal(await page.getByLabel("Survey link").inputValue(), base + formPath);
  await page.getByLabel(/Sample donor/).check();
  await page.getByLabel("Send one reminder").check();
  await page.getByRole("button", { name: "Review invitations" }).click();
  await page.getByText("After 7 days · all original recipients", { exact: false }).waitFor();
  await image("review-1440");
  await page.getByRole("button", { name: "Confirm and queue" }).click();
  await page.getByText("Distribution queued.", { exact: false }).waitFor();
  await page.getByText("2 queued", { exact: true }).waitFor();
  checks.push("Publication review, link generation, anonymous reminder policy, exact recipient confirmation and synthetic delivery history");

  const publicPage = await context.newPage({ viewport: { width: 390, height: 844 } });
  publicPage.on("pageerror", error => errors.push(error.message));
  await publicPage.setViewportSize({ width: 390, height: 844 });
  await publicPage.goto(base + formPath);
  await publicPage.getByRole("heading", { name: "Donor experience", exact: true }).waitFor();
  assert.equal(await publicPage.getByRole("navigation").count(), 0);
  await publicPage.getByRole("radio", { name: "2", exact: true }).check();
  await publicPage.getByLabel("What would help you feel more connected?").fill("Synthetic follow-up feedback");
  await image("respondent-390", publicPage);
  await publicPage.getByRole("button", { name: "Next", exact: true }).click();
  await publicPage.getByRole("radio", { name: "Yes", exact: true }).check();
  await publicPage.getByRole("button", { name: "Submit response" }).click();
  await publicPage.getByRole("heading", { name: "Response complete" }).waitFor();
  await publicPage.close();
  await page.getByRole("button", { name: "4. Responses" }).click();
  await page.getByRole("heading", { name: "Question summaries" }).waitFor();
  assert.equal(await page.getByText("Invitation completion", { exact: false }).count(), 0);
  await image("responses-1440");
  await page.getByRole("button", { name: "Read response" }).click();
  await page.getByText("Synthetic follow-up feedback").waitFor();
  await page.keyboard.press("Escape");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  assert.equal((await download).suggestedFilename(), "survey-responses-v1.csv");
  checks.push("Public mobile layout without CRM chrome, anonymous submission, response chart and detail, CSV download");
  careOnly = true;
  await page.goto(`${base}/surveys?audience=CLIENT`);
  await page.getByRole("heading", { name: "Client surveys", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Your survey library is empty", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Donors", exact: true }).count(), 0);
  await image("client-library-1440");
  await page.setViewportSize({ width: 390, height: 844 });
  await image("client-library-390");
  checks.push("Compassion-only account can open its survey library with donor audience hidden");
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/browser-checks.json`, JSON.stringify({ fixture: "Synthetic survey API and email transport", checks, pageErrors: errors }, null, 2) + "\n");
  console.log(checks.join("\n"));
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  console.error("Survey browser failure at", page.url());
  console.error((await page.locator("body").innerText()).slice(0, 2400));
  for (const other of context.pages().filter(item => item !== page)) {
    console.error("Additional test page", other.url(), (await other.locator("body").innerText()).slice(0, 1400));
  }
  throw error;
} finally {
  await browser.close();
}

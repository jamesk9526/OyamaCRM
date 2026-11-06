/** Browser acceptance using synthetic data and intercepted CRM requests. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import designModule from "../../server/src/oyama-create/studio/design.ts";
import brandModule from "../../server/src/oyama-create/studio/brand.ts";
import registry from "../../server/src/oyama-create/studio/registry.ts";

const evidence = process.env.CREATE_UI_EVIDENCE || "docs/status/audit-artifacts/2026-11-06-create-classic-letters";
await mkdir(evidence, { recursive: true });
const base = process.env.CREATE_UI_WEB || "http://127.0.0.1:3137";
const permissions = ["letters.view", "letters.edit", "letters.create", "letters.export_pdf", "letters.view_sensitive_merge_data", "view:constituents", "view:communications", "edit:communications"];
const user = { id: "fixture-staff", organizationId: "fixture-org", firstName: "Taylor", lastName: "Reed", role: "admin", email: "staff@example.invalid", permissions };
const design = designModule.defaultDesign();
design.brandRevisionId = "fixture-brand";
const brand = brandModule.normalizeBrand({ version: 1, identity: { organizationDisplayName: "Community Foundation", primaryColor: "#126f68" }, signers: [], profiles: [], presets: [] });
const campaign = { id: "classic-fixture", name: "Spring Support Appeal", status: "DRAFT", objective: "GENERAL", revision: 3, audienceListIds: [], channelsJson: ["LETTER"], contents: [], releases: [] };
const content = { id: "fixture-letter", campaignId: campaign.id, name: campaign.name, revision: 3, documentJson: { version: 1, blocks: [] }, variants: [{ id: "letter", channel: "LETTER", revision: 1, documentJson: {} }], designJson: design, classicLetter: true };
campaign.contents = [content];
const template = {
  name: campaign.name, description: "Synthetic acceptance example", category: "THANK_YOU", status: "DRAFT", printSubject: "",
  printBody: "<p>Dear {first} {last},</p><p>Every day, our neighbors find practical care and a welcoming place to ask for help.</p><p>Your support made those conversations possible. Thank you for sharing in this work.</p><p>Read the enclosed update for the next steps.</p>",
  emailSubject: "", emailBody: "", headerPresetId: "", footerPresetId: "", signatureBlockId: "", logoMode: "ORGANIZATION_DEFAULT", customLogoUrl: "",
  printLayoutJson: { letterPdfLayout: { version: 1, pageSize: "Letter (8.5 x 11 in)", margins: { top: .25, bottom: .25, left: .25, right: .25 } } },
};
let working = { template, revision: 3, campaignRevision: 3, letterRevision: 1, renderer: "classic", settings: { headerMode: "RECIPIENT", headerHtml: "", footerHtml: "<p>Community Foundation · Test City</p>" }, advanced: null, logoUrl: "/classic-fixture-logo.svg", brandName: "Community Foundation", signature: { name: "Taylor Reed", title: "Executive Director", closing: "With gratitude,", imageUrl: "" }, diagnostics: [], needsReview: false, saved: true };
let pilot = true, letterWrites = 0, digitalWrites = 0;
const errors = [], checks = [];
const preview = await PDFDocument.create();
const font = await preview.embedFont(StandardFonts.Helvetica);
for (const title of ["Synthetic recipient proof", "Synthetic continuation page"]) {
  const page = preview.addPage([612, 792]); page.drawText(title, { x: 72, y: 700, size: 15, font });
}
const pdf = Buffer.from(await preview.save());
const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 }, reducedMotion: "reduce" });
  await context.route("**/classic-fixture-logo.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="70" viewBox="0 0 320 70"><rect width="70" height="70" rx="12" fill="#126f68"/><path d="M14 48l16-20 11 12 9-10 10 18" fill="none" stroke="#fff" stroke-width="5"/><text x="85" y="31" font-family="Georgia" font-size="19" fill="#126f68">Community Foundation</text><text x="85" y="51" font-family="Arial" font-size="10" fill="#54736d">SERVICE · SUPPORT · HOPE</text></svg>' }));
  await context.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    const json = (body, status = 200) => route.fulfill({ json: body, status });
    if (path === "/api/auth/refresh") return json({ data: { accessToken: "synthetic-token" } });
    if (path === "/api/auth/me") return json({ data: user });
    if (path === "/api/oyama-create/bootstrap") return json({ enabled: true, shellEnabled: pilot, classicLettersEnabled: pilot, unifiedEditorEnabled: true, permissions, capabilities: [] });
    if (path === "/api/letters/merge-fields") return json({ sections: [{ label: "Donor", fields: ["{{donor.firstName}}", "{{donor.salutation}}", "{{gift.amount}}"] }], validationFields: ["{{donor.firstName}}", "{{donor.lastName}}", "{{gift.amount}}"] });
    if (path === "/api/settings/branding") return json({ organizationDisplayName: brand.identity.organizationDisplayName });
    if (path === "/api/letters/header-presets" || path === "/api/letters/signatures") return json([]);
    if (path.endsWith("/imports/ensure")) return json({ status: "IDLE" });
    if (path.endsWith("/imports/sources")) return json({ items: [] });
    if (path.endsWith("/notes")) return json({ revision: 0, text: "", updatedAt: null });
    if (path.endsWith("/campaigns/" + campaign.id)) return json(campaign);
    if (path.endsWith("/letter/recipients")) return json([{ id: "fixture-recipient", firstName: "Jordan", lastName: "Example", addressLine1: "100 Test Way", city: "Test City", state: "IL", zip: "60000" }]);
    if (path.endsWith("/gifts")) return json([]);
    if (path.endsWith("/letter/proof")) {
      assert.equal(request.postDataJSON().revision, content.revision);
      return route.fulfill({ status: 200, contentType: "application/pdf", headers: { "x-classic-warnings": "%5B%5D" }, body: pdf });
    }
    if (path.endsWith("/letter")) {
      if (method === "PUT") {
        const body = request.postDataJSON();
        assert.equal(body.letterRevision, working.letterRevision);
        assert.equal(body.campaignRevision, campaign.revision);
        working = { ...working, template: body.template, revision: ++content.revision, campaignRevision: ++campaign.revision, letterRevision: working.letterRevision + 1 };
        letterWrites++;
      }
      return json({ ...working, revision: content.revision, campaignRevision: campaign.revision });
    }
    if (path.includes("/letter/adaptations/")) {
      const channel = path.split("/").pop(), { action } = request.postDataJSON();
      if (action === "preview") return json({ review: "fixture-review", linked: false, warnings: [], changes: [{ id: 0, before: "", after: "Your support made those conversations possible.", action: "add" }] });
      content.variants.push({ id: channel, channel, revision: 1, documentJson: { enabled: false }, letterLinked: true });
      campaign.channelsJson.push(channel);
      design.channels = { ...design.channels, [channel]: { document: { type: "doc", content: [registry.paragraph("email-text", "Your support made those conversations possible.")] }, reviewedSource: null } };
      content.revision++; campaign.revision++;
      return json({ channel });
    }
    if (path.endsWith("/studio") && method === "PATCH") {
      const body = request.postDataJSON();
      assert.equal(body.channel, "EMAIL");
      assert.equal(body.revision, content.revision);
      content.designJson = body.design; content.revision++; campaign.revision++; digitalWrites++;
      return json({ design: body.design, contentRevision: content.revision, campaignRevision: campaign.revision });
    }
    if (path.endsWith("/studio")) return json({ design: content.designJson, proposed: content.designJson, contentRevision: content.revision, campaignRevision: campaign.revision, brand, canEdit: true });
    if (path.endsWith("/studio/preview")) return json({ channel: "EMAIL", html: "<p>Synthetic email proof</p>", text: "Synthetic email proof", issues: [], adaptations: [] });
    if (path.includes("/studio/") || path.endsWith("/connections")) return json([]);
    return json({});
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/oyama-create/campaigns/${campaign.id}`, { waitUntil: "domcontentloaded" });
  const frame = page.getByRole("region", { name: "Oyama Create unified workspace" });
  const editor = frame.getByRole("textbox", { name: "Print body", exact: true });
  await editor.waitFor({ timeout: 90000 }).catch(async error => {
    await page.screenshot({ path: `${evidence}/load-failure.png` });
    console.log(errors, (await page.locator("body").innerText()).slice(0, 2000)); throw error;
  });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  assert.equal(await page.getByRole("textbox", { name: "Studio letter content", exact: true }).count(), 0);
  assert.equal(await page.getByText("Create OyamaEmail Companion", { exact: true }).count(), 0);
  const divider = frame.getByRole("separator", { name: "Resize navigator" });
  await divider.focus(); await page.keyboard.press("ArrowRight");
  assert.equal(await divider.getAttribute("aria-valuenow"), "251");
  await divider.dblclick(); assert.equal(await divider.getAttribute("aria-valuenow"), "235");
  const sizes = [[1600, 950, "desktop"], [1280, 780, "laptop"], [900, 720, "compact"], [430, 790, "mobile"]];
  for (const [width, height, name] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(180);
    const bounds = await page.evaluate(() => ({ body: document.scrollingElement.scrollHeight, width: document.scrollingElement.scrollWidth, viewport: innerHeight, top: document.querySelector(".v5-titlebar").getBoundingClientRect().top }));
    assert.deepEqual(bounds, { body: height, width, viewport: height, top: 0 });
    await page.screenshot({ path: `${evidence}/${name}.png` });
  }
  await frame.getByRole("button", { name: "Properties", exact: true }).click();
  await frame.getByRole("complementary", { name: "Document properties" }).waitFor({ state: "visible" });
  await page.screenshot({ path: `${evidence}/mobile-properties.png` });
  await frame.getByRole("button", { name: "Close properties", exact: true }).click();
  assert.equal(letterWrites, 0); checks.push("Classic canvas, pinned chrome, resize and overlays at four reference sizes");
  await page.setViewportSize({ width: 1600, height: 950 });
  await frame.getByRole("button", { name: "Reset", exact: true }).click();
  await frame.getByRole("button", { name: "Preview", exact: true }).click();
  await frame.getByRole("button", { name: /Page 2/ }).waitFor();
  await frame.getByRole("img", { name: "PDF page 1", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector(".letter-inline-proof canvas")?.width > 300);
  await page.screenshot({ path: `${evidence}/desktop-proof.png` });
  checks.push("Server PDF page count drives Pages navigator");
  await editor.focus(); await page.keyboard.press("Control+End"); await page.keyboard.insertText(" Additional synthetic text.");
  await frame.getByRole("button", { name: "Undo", exact: true }).click();
  assert.doesNotMatch(await editor.innerText(), /Additional synthetic text/);
  await frame.getByRole("button", { name: "Redo", exact: true }).click();
  assert.match(await editor.innerText(), /Additional synthetic text/);
  await editor.evaluate(element => { element.dataset.retained = "yes"; });
  await frame.getByRole("button", { name: "Convert to", exact: true }).click();
  await page.getByRole("button", { name: "Open converted draft" }).click();
  const email = frame.getByRole("textbox", { name: "Studio email content" });
  await email.waitFor();
  await email.fill("Independent email copy and CTA.");
  await frame.getByRole("group", { name: "Document format" }).getByRole("button", { name: "Letter" }).click();
  await editor.waitFor();
  assert.equal(await editor.getAttribute("data-retained"), "yes");
  assert.doesNotMatch(await editor.innerText(), /Independent email copy/);
  assert.equal(letterWrites, 1); assert.equal(digitalWrites, 1);
  pilot = false; await page.reload({ waitUntil: "domcontentloaded" }); await editor.waitFor();
  checks.push("Undo and redo, explicit conversion, isolated digital saves, retained canvas and rollback reader");
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/browser-checks.json`, JSON.stringify({ synthetic: true, checks, letterWrites, digitalWrites }, null, 2));
  console.log(checks.join("\n"));
} finally {
  await browser.close();
}

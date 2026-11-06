/** Golden print fixtures. Authored copy and recipients are synthetic. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import letters from "../../server/src/routes/letters.ts";
import production from "../../server/src/services/letter-production-renderer.ts";
import fields from "../../server/src/services/letters-merge.ts";
import avery from "../../server/src/services/avery-labels.ts";

const evidence = "docs/status/audit-artifacts/2026-11-06-create-classic-letters";
await mkdir(evidence, { recursive: true });
const source = "/api/public-media/branding/fixture/primary.png";
const logo = `data:image/png;base64,${(await readFile("public/branding/oyama-crm-v2-icon-180.png")).toString("base64")}`;
const date = new Date("2026-11-06T15:00:00Z");
const branding = { organizationName: "Community Foundation", tagline: "", addressLine: "", contactLine: "", taxId: "", footerLegalText: "Synthetic print fixture", logoDataUrl: null, logoFormat: null, primaryColor: "#126f68" };
const headerPreset = { logoAlignment: "LEFT", rightColumnMode: "RECIPIENT", showOrganizationName: true, showTagline: false, showAddress: true, showPhone: false, showWebsite: false };
const signers = { signerName: "Taylor Reed", signerTitle: "Executive Director", closingPhrase: "With gratitude," };
const recipients = [
  { name: "Jordan Example", addressLine1: "200 Sample Street", addressLine2: "", city: "Test City", state: "MO", zip: "65000" },
  { name: "Alexandra and Cameron Example Extended Family Household", addressLine1: "300 Sample Street", addressLine2: "Apartment 14B", city: "Test City", state: "MO", zip: "65000" },
  { name: "Community Partners and Neighborhood Outreach Organization", addressLine1: "400 Sample Street", addressLine2: "", city: "Test City", state: "MO", zip: "65000" },
];
const copy = "<p>Dear {{donor.salutation}},</p><p>Thank you for bringing practical care to our community.</p><p>Gift: {{donation.amount}}</p>";
const table = '<table style="width:100%;border-collapse:collapse"><thead><tr><th>Gift detail</th><th>Value</th></tr></thead><tbody>'
  + Array.from({ length: 48 }, (_, i) => `<tr><td>Giving entry ${i + 1}</td><td>{{gift.amount}}</td></tr>`).join("") + "</tbody></table>";
const fixtures = [
  { id: "short", index: 0, html: copy, paper: "Letter (8.5 x 11 in)", width: 612, height: 792 },
  { id: "household-table", index: 1, html: copy + table + '<div data-letter-page-break="true"></div><p>Continuation after manual break.</p>', paper: "Legal (8.5 x 14 in)", width: 612, height: 1008 },
  { id: "organization", index: 2, html: copy + '<p style="font-family:Times New Roman;font-size:11pt"><strong>Thank you</strong> for this work.</p>', paper: "A4 (8.27 x 11.69 in)", width: 595.28, height: 841.89 },
];
const report = [];
for (const fixture of fixtures) {
  const recipient = recipients[fixture.index], printLayout = { letterPdfLayout: { pageSize: fixture.paper, margins: { top: .5, right: .5, bottom: .5, left: .5 } } };
  const body = fields.renderMergeFields(fixture.html, { "donor.salutation": recipient.name, "gift.amount": "$52.00" });
  assert.doesNotMatch(body, /\{\{/);
  const presets = { headerPreset, signatureBlock: signers };
  const original = await letters.renderGeneratedLetterPdf({
    templateName: "Synthetic Letter", subject: "", constituentName: recipient.name, recipient: { ...recipient, fullName: recipient.name },
    generatedAt: date, mergedPrintBody: body, branding: { ...branding, logoDataUrl: logo, logoFormat: "PNG" }, presets, printLayout,
  });
  const snapshot = {
    version: 2, organizationId: "fixture", templateId: "fixture-letter", revision: 5, title: "Synthetic Letter", subject: "",
    bodyHtml: body, generatedAt: date.toISOString(), recipientId: `recipient-${fixture.index}`, recipient,
    branding: {}, header: {}, footer: {}, signature: {}, layout: { paper: "Letter", margins: { top: .5, right: .5, bottom: .5, left: .5 } },
    assets: { [source]: logo }, warnings: [], blockers: [], classic: { version: 1, branding, presets, logoSource: source, printLayout, sensitive: true, sample: false },
  };
  const queued = await production.renderProductionLetter(snapshot);
  assert.equal(queued.bytes.equals((await production.renderProductionLetter(snapshot)).bytes), true);
  const baseline = await PDFDocument.load(original), actual = await PDFDocument.load(queued.bytes);
  assert.equal(actual.getPageCount(), baseline.getPageCount());
  if (fixture.id === "household-table") assert.ok(actual.getPageCount() > 1);
  for (const page of actual.getPages()) {
    assert.ok(Math.abs(page.getWidth() - fixture.width) < .1);
    assert.ok(Math.abs(page.getHeight() - fixture.height) < .1);
  }
  await writeFile(`${evidence}/${fixture.id}-original.pdf`, original);
  await writeFile(`${evidence}/${fixture.id}-production.pdf`, queued.bytes);
  report.push({ fixture: fixture.id, pages: actual.getPageCount(), size: actual.getPage(0).getSize(), frozenSha256: createHash("sha256").update(queued.bytes).digest("hex") });
}
const labels = await avery.renderAvery5160Pdf(recipients, { startPosition: 29, showGuides: true });
assert.equal((await PDFDocument.load(labels)).getPageCount(), 2);
await writeFile(`${evidence}/labels-start-29.pdf`, labels);
await writeFile(`${evidence}/print-checks.json`, JSON.stringify({ synthetic: true, report, labels: { startPosition: 29, pages: 2, recipientOrder: recipients.map(recipient => recipient.name) } }, null, 2));
console.log(JSON.stringify(report));

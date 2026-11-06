import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFName } from "pdf-lib";
import { applyLetterAdaptation, compareLetterAdaptation, projectLetterAdaptation } from "../../server/src/oyama-create/letter-adaptations";
import { defaultDesign, sourceIdentity } from "../../server/src/oyama-create/studio/design";
import { newBlock, paragraph } from "../../server/src/oyama-create/studio/registry";
import { mergeDigitalDraft } from "../../server/src/oyama-create/classic-digital";
import { renderFrozenClassicLetter } from "../../server/src/oyama-create/classic-print";
import { compactStudioAssets, hydrateStudioAssets } from "../../server/src/oyama-create/studio/frozen-assets";
import type { LetterSnapshot } from "../../server/src/services/letter-production-contract";

const letter = (printBody: string) => ({ printBody, documentJson: { renderer: "classic" } });
const blank = { type: "doc" as const, content: [] };
describe("classic Letter conversions", () => {
  it("carries aliases into email and excludes personal copy, gift tables and print furniture from public drafts", () => {
    const input = letter('<p>Dear {first} {last},</p><p>Thank you for your support.</p><table><tr><td>{{donation.amount}}</td></tr></table><div data-letter-page-break="true"></div><div data-letter-signature="true">Internal signature</div>');
    const design = defaultDesign();
    const email = projectLetterAdaptation(input, design, "EMAIL");
    expect(JSON.stringify(email.content)).toContain("{first}");
    expect(JSON.stringify(email.content)).toContain("donation.amount");
    for (const channel of ["WEB", "SOCIAL", "SMS"] as const) {
      const result = projectLetterAdaptation(input, design, channel);
      expect(result.content).toHaveLength(1);
      expect(JSON.stringify(result.content)).toContain("Thank you for your support.");
      expect(JSON.stringify(result.content)).not.toMatch(/donation.amount|\{first\}|Internal signature/);
      expect(result.warnings).toHaveLength(1);
    }
  });

  it("applies selected updates without replacing a customized channel section or unrelated CTA", () => {
    const base = [paragraph("one", "Before"), paragraph("two", "Stable"), paragraph("three", "Original ask")];
    const target = { ...blank, content: [paragraph("cta", "Email-only CTA")] };
    const first = compareLetterAdaptation(null, target, base);
    const converted = applyLetterAdaptation(target, first.steps, new Set([0, 1, 2]), "EMAIL", "1");
    const adapted = structuredClone(converted.document);
    adapted.content[3].content = [{ type: "text", text: "Customized ask" }];
    const revised = [paragraph("a", "Revised"), paragraph("b", "Stable"), paragraph("c", "Incoming ask"), paragraph("d", "New section")];
    const comparison = compareLetterAdaptation({ version: 1, letterRevision: 1, links: converted.links }, adapted, revised);
    expect(comparison.changes.map(change => change.action)).toEqual(["replace", "conflict", "add"]);
    const updated = applyLetterAdaptation(adapted, comparison.steps, new Set([0, 2]), "EMAIL", "2");
    expect(updated.document.content.map(node => node.content?.[0].text)).toEqual(["Email-only CTA", "Revised", "Stable", "Customized ask", "New section"]);
    expect(updated.document.content[1].attrs?.studioId).toBe(adapted.content[1].attrs?.studioId);
  });

  it("keeps safe organization fields in public copy and retains recipient CRM blocks only in email", () => {
    const design = defaultDesign();
    design.body.content = [paragraph("identity", "A message from {{organization.name}}."), newBlock("studioSalutation", "greeting"),
      newBlock("studioField", "field"), newBlock("studioAsk", "ask"), newBlock("studioHistory", "giving")];
    const source = { printBody: "", documentJson: { renderer: "studio" } };
    expect(projectLetterAdaptation(source, design, "EMAIL").content.map(node => node.type)).toEqual(design.body.content.map(node => node.type));
    for (const channel of ["WEB", "SOCIAL", "SMS"] as const) {
      const result = projectLetterAdaptation(source, design, channel);
      expect(result.content).toHaveLength(1);
      expect(JSON.stringify(result.content)).toContain("{{organization.name}}");
      expect(result.warnings[0]).toContain("4");
    }
  });

  it("ignores changes to Letter or other channel state in a scoped digital save", () => {
    const base = defaultDesign();
    base.body.content = [paragraph("letter", "Letter body")];
    const proposed = structuredClone(base);
    proposed.body.content = [paragraph("letter", "Attempted replacement")];
    proposed.page.paper = "A4";
    proposed.channels = { EMAIL: { document: { ...blank, content: [paragraph("email", "Email body")] }, reviewedSource: sourceIdentity(proposed) }, WEB: { document: { ...blank, content: [paragraph("web", "Unrelated")] }, reviewedSource: null } };
    const saved = mergeDigitalDraft(base, proposed, "EMAIL");
    expect(saved.body).toEqual(base.body);
    expect(saved.page).toEqual(base.page);
    expect(saved.channels?.WEB).toBeUndefined();
    expect(saved.channels?.EMAIL?.reviewedSource).toBe(sourceIdentity(base));
  });
});

describe("classic frozen Letter proofs", () => {
  const source = "/api/public-media/branding/fixture/primary.png";
  const fixture: LetterSnapshot = {
    version: 2, organizationId: "fixture", templateId: "working-copy", revision: 4, title: "Proof", subject: "",
    bodyHtml: "<p>Dear Jordan Example,</p><p>Thank you for your support.</p>", generatedAt: "2026-11-06T10:30:00Z", recipientId: "recipient",
    recipient: { name: "Jordan Example", addressLine1: "123 Test Way", addressLine2: "", city: "Test City", state: "MO", zip: "65000" },
    branding: {}, header: {}, footer: {}, signature: {}, layout: { paper: "Letter", margins: { top: .25, right: .25, bottom: .25, left: .25 } },
    assets: {}, blockers: [], warnings: [],
    classic: { version: 1, sensitive: false, sample: false, logoSource: source,
      branding: { organizationName: "Community Foundation", tagline: "", addressLine: "", contactLine: "", taxId: "", footerLegalText: "", logoDataUrl: null, logoFormat: null, primaryColor: "#126f68" },
      presets: {}, printLayout: { letterPdfLayout: { pageSize: "Half Letter (5.5 x 8.5 in)", orientation: "landscape" } } },
  };
  it("uses the frozen managed logo bytes and reproduces the exact PDF at the approved paper size", async () => {
    const logo = `data:image/png;base64,${(await readFile("public/branding/oyama-crm-v2-icon-180.png")).toString("base64")}`;
    const snapshot = { ...fixture, assets: { [source]: logo } };
    const first = await renderFrozenClassicLetter(snapshot);
    expect(first.bytes.equals((await renderFrozenClassicLetter(snapshot)).bytes)).toBe(true);
    const pdf = await PDFDocument.load(first.bytes);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 396 });
    expect(pdf.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"))?.toString()).toContain("/I0");
    await expect(renderFrozenClassicLetter({ ...fixture, assets: {} })).rejects.toThrow(/logo is missing/);
  });
  it("restores compacted assets for classic jobs without a Studio snapshot", () => {
    const snapshot = structuredClone(fixture);
    snapshot.assets[source] = "data:image/png;base64," + "a".repeat(600);
    const expected = snapshot.assets[source];
    const bundle = compactStudioAssets([{ payloadJson: { studio: { artifacts: [{ snapshot }] } } }]);
    expect(snapshot.assets[source]).toMatch(/^@create-asset:/);
    hydrateStudioAssets(snapshot, bundle);
    expect(snapshot.assets[source]).toBe(expected);
  });
});

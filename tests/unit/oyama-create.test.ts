import { describe, expect, it } from "vitest";
import { documentFrom, variantFrom, effectiveBlocks, planAudience, publicCopySafe, renderShared, safeUrl, type AudienceMember, type SharedDocument } from "@/server/src/oyama-create/domain";
import { azureConfig, azureHeaders, secureEqual } from "@/server/src/oyama-create/providers";
import { emailRecordAccessible, projectLetterCopy, remapManagedCopy } from "@/server/src/oyama-create/legacy";
const member = (key: string, values: Partial<AudienceMember> = {}): AudienceMember => ({ key, constituentId: key, firstName: "Synthetic", lastName: key, email: `${key}@example.invalid`, phone: "+15555550101", addressLine1: "100 Test Way", addressLine2: "", city: "Test City", state: "IL", zip: "60000", country: "US", doNotContact: false, doNotMail: false, doNotEmail: false, emailOptOut: false, ...values });
const document: SharedDocument = { version: 1, blocks: [{ id: "headline", kind: "heading", text: "A shared appeal" }, { id: "copy", kind: "paragraph", text: "Original copy" }] };
const mixed = [member("both"), member("email", { addressLine1: "" }), member("postal", { email: "" }), member("suppressed", { doNotContact: true }), member("external", { constituentId: null, addressLine1: "", phone: "" })];
const emails = new Set(mixed.map(row => row.email));
describe("oyamaCreate shared authoring", () => {
  it("normalizes optional channel schedules and rejects invalid dates", () => { expect(variantFrom({ scheduledAt: "2031-06-02T09:00:00-05:00" })).toHaveProperty("scheduledAt", "2031-06-02T14:00:00.000Z"); expect(variantFrom({})).toHaveProperty("scheduledAt", null); expect(() => variantFrom({ scheduledAt: "not-a-date" })).toThrow("delivery date"); expect(() => variantFrom({ scheduledAt: 123 })).toThrow("delivery date"); });
  it("keeps customized paragraphs while other shared blocks change", () => { const format = variantFrom({ overrides: { copy: "Custom letter copy" } }); expect(effectiveBlocks({ ...document, blocks: document.blocks.map(block => ({ ...block, text: `Changed ${block.text}` })) }, format).map(block => block.text)).toEqual(["Changed A shared appeal", "Custom letter copy"]); });
  it("relinks a paragraph when its explicit customization is removed", () => { expect(effectiveBlocks(document, variantFrom({ overrides: {} }))[1].text).toBe("Original copy"); });
  it("renders plain text and escapes authored markup", () => { const result = renderShared({ version: 1, blocks: [{ id: "x", kind: "paragraph", text: '<script>alert("x")</script>\nHello' }] }, variantFrom({})); expect(result.html).toContain("&lt;script&gt;"); expect(result.html).not.toContain("<script>"); expect(result.text).toContain("\nHello"); });
  it.each(["javascript:alert(1)", "http://example.com", "https://user:secret@example.com", "file:///C:/private", "data:text/html,test"])("rejects unsafe content URL %s", value => expect(() => safeUrl(value)).toThrow());
  it("accepts complete HTTPS URLs and empty optional URLs", () => { expect(safeUrl("https://example.org/path")).toBe("https://example.org/path"); expect(safeUrl("")).toBe(""); });
  it("rejects duplicate block identities", () => expect(() => documentFrom({ ...document, blocks: [document.blocks[0], document.blocks[0]] })).toThrow("unique"));
  it("rejects unknown block types, invalid versions and unbounded copy", () => { expect(() => documentFrom({ version: 2, blocks: [] })).toThrow(); expect(() => documentFrom({ version: 1, blocks: [{ id: "a", kind: "script", text: "" }] })).toThrow(); expect(() => documentFrom({ version: 1, blocks: [{ id: "a", kind: "paragraph", text: "x".repeat(20001) }] })).toThrow(); });
  it.each(["{{donor.firstName}}", "{FirstName}", "//FirstName"])("blocks private merge form %s in public content", text => expect(publicCopySafe({ version: 1, blocks: [{ id: "a", kind: "paragraph", text }] }, variantFrom({}))).toBe(false));
  it("checks customized and caption copy for public recipient data", () => { expect(publicCopySafe(document, variantFrom({ caption: "Hi {{FirstName}}" }))).toBe(false); expect(publicCopySafe(document, variantFrom({ overrides: { copy: "{LastName}" } }))).toBe(false); expect(publicCopySafe(document, variantFrom({ caption: "Everyone is welcome" }))).toBe(true); });
});
describe("reviewed channel routing", () => {
  it("requires an explicit email/letter mode", () => expect(() => planAudience(mixed, ["EMAIL", "LETTER"], null, emails, new Set())).toThrow("Choose"));
  it.each([["EMAIL_FIRST", 3, 1], ["LETTER_FIRST", 2, 2], ["BOTH", 3, 2]] as const)("plans %s without silent double deliveries", (mode, email, letter) => { const plan = planAudience(mixed, ["EMAIL", "LETTER"], mode, emails, new Set()); expect(plan.counts).toMatchObject({ EMAIL: email, LETTER: letter }); expect(plan.overlap).toBe(1); expect(plan.excluded).toBe(1); });
  it("deduplicates delivery addresses while preserving separate postal contacts", () => { const contacts = [member("a"), member("b", { email: "a@example.invalid" })]; const plan = planAudience(contacts, ["EMAIL", "LETTER"], "BOTH", new Set(["a@example.invalid"]), new Set()); expect(plan.counts).toMatchObject({ EMAIL: 1, LETTER: 2 }); });
  it("never infers SMS permission from a phone or email eligibility", () => { expect(planAudience([member("a")], ["SMS"], null, emails, new Set()).counts.SMS).toBe(0); expect(planAudience([member("a")], ["SMS"], null, emails, new Set(["+15555550101"])).counts.SMS).toBe(1); });
  it("re-evaluates global, email and postal suppressions independently", () => { const rows = [member("a", { doNotEmail: true }), member("b", { doNotMail: true }), member("c", { emailOptOut: true }), member("d", { doNotContact: true })]; const plan = planAudience(rows, ["EMAIL", "LETTER", "SMS"], "BOTH", new Set(rows.map(row => row.email)), new Set(["+15555550101"])); expect(plan.counts).toMatchObject({ EMAIL: 1, LETTER: 2, SMS: 1 }); });
  it("does not turn an email-only external entry into a postal recipient", () => expect(planAudience([member("external", { constituentId: null })], ["LETTER"], null, emails, new Set()).counts.LETTER).toBe(0));
});
describe("provider boundaries", () => {
  it("restricts Azure endpoints to resource hosts", () => { expect(() => azureConfig({ endpoint: "https://localhost", sender: "+15555550101", topic: "test" })).toThrow(); expect(() => azureConfig({ endpoint: "https://example.communication.azure.com.evil.org", sender: "+15555550101", topic: "test" })).toThrow(); });
  it("signs the complete request path, query, date, host and body", () => { const url = new URL("https://synthetic.communication.azure.com/sms?api-version=2021-03-07"); const headers = azureHeaders("POST", url, "{}", Buffer.from("synthetic-provider-key").toString("base64"), "Tue, 03 Nov 2026 12:00:00 GMT"); expect(headers["x-ms-content-sha256"]).toBe("RBNvo1WzZ4oRRq0W9+hknpT7T8If536DEMBg9hyq/4o="); expect(headers.Authorization).toMatch(/^HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=/); expect(azureHeaders("POST", url, '{"message":"different"}', Buffer.from("synthetic-provider-key").toString("base64"), headers["x-ms-date"]).Authorization).not.toBe(headers.Authorization); });
  it("uses constant-time equal-length webhook secret comparison", () => { expect(secureEqual("secret", "secret")).toBe(true); expect(secureEqual("secret", "wrong")).toBe(false); expect(secureEqual("", "")).toBe(false); });
});
describe("native copy and ownership compatibility", () => {
  it("preserves native print layout without accumulating duplicate managed paragraphs", () => {
    const format = variantFrom({});
    const initial = projectLetterCopy('<p>Local signature</p>', "content-one", document, format);
    const structured = initial.replace('<h2 ', '<h2 style="margin-bottom:12pt" ');
    const changed = projectLetterCopy(structured, "content-one", { ...document, blocks: document.blocks.map(block => ({ ...block, text: `Updated ${block.text}` })) }, format);
    expect(changed.match(/data-create-block=/g)).toHaveLength(2);
    expect(changed).toContain("Local signature"); expect(changed).toContain("Updated Original copy"); expect(changed).not.toContain(">Original copy<");
  });
  it("remaps managed identities when cloning native email and structured letter content", () => {
    const native = { blocks: [{ id: "create:old", type: "html", html: '<p data-create-block="old:copy">Original</p>' }], content: [{ attrs: { createBlockId: "old:copy" } }], name: "old" };
    const copy = remapManagedCopy(native, "old", "new") as typeof native;
    expect(copy.blocks[0].id).toBe("create:new"); expect(copy.blocks[0].html).toContain('data-create-block="new:copy"'); expect(copy.content[0].attrs.createBlockId).toBe("new:copy"); expect(copy.name).toBe("old");
  });
  it("uses canonical audience sharing and preserves owner-only editing for shared emails", () => {
    const privateEmail = { templateJson: null, audienceFilter: JSON.stringify({ _sharing: { ownerId: "owner", sharedWithOrganization: false } }) };
    expect(emailRecordAccessible(privateEmail, "viewer", "staff")).toBe(false);
    expect(emailRecordAccessible({ ...privateEmail, templateJson: JSON.stringify({ ownerId: "template-owner", sharedWithOrganization: true }) }, "viewer", "staff")).toBe(false);
    const shared = { ...privateEmail, audienceFilter: JSON.stringify({ _sharing: { ownerId: "owner", sharedWithOrganization: true } }) };
    expect(emailRecordAccessible(shared, "viewer", "staff")).toBe(true); expect(emailRecordAccessible(shared, "viewer", "staff", true)).toBe(false);
    expect(emailRecordAccessible(shared, "owner", "staff", true)).toBe(true); expect(emailRecordAccessible(privateEmail, "administrator", "admin", true)).toBe(true);
  });
});

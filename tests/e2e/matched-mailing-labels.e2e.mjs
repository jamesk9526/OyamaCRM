import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.QA_BASE_URL || "http://127.0.0.1:43653";
const evidence = "docs/status/audit-artifacts/2026-10-30-staff-workflows";
const pdf = await PDFDocument.create(); pdf.addPage(); const bytes = Buffer.from(await pdf.save());
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [], requests = [], checks = [];
const ids = ["C", "A", "B"];
const people = ids.map(id => ({ id, firstName: id, lastName: "Donor", type: "DONOR", donorStatus: "ACTIVE", addressLine1: `${id} Main Street`, city: "Austin", state: "TX", zip: "78701", doNotMail: false, doNotContact: false }));
const template = { id: "qa-template", name: "Welcome", category: "GENERAL", status: "ACTIVE", printBody: "Dear donor", printSubject: "Welcome", createdAt: "2026-10-01", updatedAt: "2026-10-01", printLayoutJson: {}, settingsJson: {} };
let generated = [], strictFailure = false;
await context.addInitScript(({ ids }) => sessionStorage.setItem("oyama-letters:temporary-recipient-list:qa-order", JSON.stringify({ name: "Reviewed mailing", constituentIds: ids, donationIds: [], createdAt: "2026-10-30T00:00:00Z" })), { ids });
await context.route("**/api/**", async route => {
 const req = route.request(), url = new URL(req.url()), path = url.pathname;
 if (path === "/api/auth/refresh") return route.fulfill({ json: { data: { accessToken: "synthetic-only" } } });
 if (path === "/api/auth/me") return route.fulfill({ json: { data: { id: "qa-staff", role: "admin", firstName: "QA", lastName: "Staff", organizationId: "qa-org" } } });
 if (path === "/api/notifications/sse") return route.fulfill({ contentType: "text/event-stream", body: "" });
 if (path === "/api/letters/templates") return route.fulfill({ json: [template] });
 if (path === "/api/letters/templates/qa-template") return route.fulfill({ json: template });
 if (path === "/api/letters/generated" && req.method() === "GET") return route.fulfill({ json: generated });
 if (path === "/api/constituents") return route.fulfill({ json: [...people].reverse() });
 if (path === "/api/letters/generated/preview") return route.fulfill({ json: { mergedPrintBody: "Dear C Donor", mergedPrintSubject: "Welcome", missingFields: [], unsupportedFields: [], constituent: people[0] } });
 if (path === "/api/letters/generated/preview-pdf") return route.fulfill({ contentType: "application/pdf", body: bytes });
 if (path === "/api/letters/generated/batch") {
   const body = req.postDataJSON(); requests.push({ path, body });
   // Include >100 and >200 generated letters to catch the former silent PDF cap.
   generated = Array.from({ length: 501 }, (_, i) => ({ id: `letter-${String(i).padStart(3,"0")}`, templateId: template.id, constituentId: ids[i % ids.length], constituent: people[i % ids.length], generatedAt: "2026-10-30T00:00:00Z", status: "GENERATED" }));
   return route.fulfill({ json: { generatedIds: generated.map(x => x.id), generatedCount: generated.length, totalSelected: 501, eligible: 501, skippedCount: 0, skippedByReason: {}, generated: generated.slice(0,200) } });
 }
 if (path === "/api/letters/generated/export-pdf-batch") { requests.push({ path, body: req.postDataJSON() }); return route.fulfill({ contentType: "application/pdf", body: bytes }); }
 if (path === "/api/letters/labels/avery-5160.pdf") {
   const body = req.postDataJSON(); requests.push({ path, body });
   if (strictFailure) return route.fulfill({ status: 409, json: { error: { message: "One matching recipient is suppressed; no partial labels were created." } } });
   return route.fulfill({ contentType: "application/pdf", headers: { "X-Labels-Rendered": String((body.letterIds || body.constituentIds).length) }, body: bytes });
 }
 if (req.method() !== "GET") return route.fulfill({ status: 405, json: { error: { message: "Live writes disabled" } } });
 if (path === "/api/settings/branding") return route.fulfill({ json: {} });
 if (path.includes("notifications")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
 return route.fulfill({ json: [] });
});
page.on("pageerror", error => errors.push(error.message));
try {
 await mkdir(evidence, { recursive: true });
 await page.goto(`${base}/oyama-letters/generate?templateId=qa-template&temporaryListId=qa-order`, { waitUntil: "networkidle" });
 await page.getByRole("heading", { name: "Select Your Options" }).waitFor();
 await page.getByRole("button", { name: "Next: Recipients", exact: true }).first().click();
 await page.getByRole("button", { name: "Preview Letters", exact: true }).first().click();
 await page.getByRole("heading", { name: "Batch Summary", exact: true }).waitFor();
 await page.getByRole("button", { name: "Next: Generate", exact: true }).first().click();
 await page.getByRole("button", { name: "Generate Batch", exact: true }).first().click();
 await page.getByRole("button", { name: "Open letter PDF part 1 of 2 (500)", exact: true }).waitFor();
 await page.getByRole("button", { name: "Open letter PDF part 2 of 2 (1)", exact: true }).waitFor();
 const labelButton = page.getByRole("button", { name: "Labels for PDF part 1 (500)", exact: true });
 const box = labelButton.locator("../..");
 await box.getByRole("combobox", { name: "First label position" }).selectOption("4");
 await box.getByRole("checkbox", { name: "Alignment guides" }).check();
 const download = page.waitForEvent("download"); await labelButton.click(); await download;
 const payload = requests.filter(x => x.path.endsWith("avery-5160.pdf")).at(-1).body;
 assert.deepEqual(payload.letterIds, generated.slice(0,500).map(x => x.id));
 assert.equal(payload.requireAllRecipients, true); assert.equal(payload.startPosition, 4); assert.equal(payload.showGuides, true);
 checks.push("501 generated letters expose all 500+1 PDF parts; matching labels use the exact complete first-part letter IDs, not the capped 200 sample or current audience.");
 strictFailure = true;
 await page.getByRole("button", { name: "Labels for PDF part 2 (1)", exact: true }).click();
 await page.getByRole("alert").filter({ hasText: "no partial labels" }).waitFor();
 checks.push("Unavailable matched recipients show the server error without a partial download.");
 for (const width of [1440,390]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({ path: `${evidence}/matching-labels-${width}.png`, fullPage: true }); }
 assert.deepEqual(errors, []);
 await writeFile(`${evidence}/mailing-browser-checks.json`, JSON.stringify({ checks, pageErrors: errors }, null, 2)); console.log(JSON.stringify({ checks, pageErrors: errors }, null, 2));
} catch (error) { await page.screenshot({ path: `${evidence}/mailing-failure.png`, fullPage: true }); console.error(await page.locator("body").innerText()); throw error; }
finally { await browser.close(); }

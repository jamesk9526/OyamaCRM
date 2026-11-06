/** Compare the two real PDF renderers using fictional recipients and a shared letter. */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import letters from '../../server/src/routes/letters.ts';
import avery from '../../server/src/services/avery-labels.ts';
import designs from '../../server/src/oyama-create/studio/design.ts';
import unified from '../../server/src/oyama-create/studio/unified-document.ts';
import rendering from '../../server/src/oyama-create/studio/render.ts';
import production from '../../server/src/oyama-create/studio/print.ts';

const output = 'docs/status/audit-artifacts/2026-11-06-create-v5';
await mkdir(output, { recursive: true });
const name = 'Jordan Sample';
const copy = 'Thank you for supporting our community. This fictional appeal exercises both production renderers.';
const generatedAt = new Date('2026-11-06T12:00:00Z');
const legacy = await letters.renderGeneratedLetterPdf({
  templateName: 'Synthetic appeal', subject: 'Community appeal', constituentName: name, generatedAt,
  mergedPrintBody: `<p>Dear ${name},</p><p>${copy}</p>`,
  recipient: { fullName: name, addressLine1: '200 Sample Street', addressLine2: '', city: 'Test City', state: 'IL', zip: '60000' },
  branding: { organizationName: 'Synthetic care center', tagline: '', addressLine: '', contactLine: '', taxId: '', footerLegalText: 'Synthetic comparison', logoDataUrl: null, logoFormat: null, primaryColor: '#126f68' },
  presets: {}, printLayout: { pageSize: 'Letter', margins: { top: .8, right: .75, bottom: .8, left: .75 } },
});
const design = designs.defaultDesign();
design.body.content = [{ type: 'paragraph', content: [{ type: 'text', text: 'Dear {{donor.fullName}},' }] }, { type: 'paragraph', content: [{ type: 'text', text: copy }] }];
const brand = { version: 1, identity: { organizationDisplayName: 'Synthetic care center', footerLegalText: 'Synthetic comparison' }, profiles: [], presets: [], signers: [], defaultSignerId: null };
const donor = { ...rendering.emptyDonor(generatedAt.toISOString()), available: true, name, constituentId: 'synthetic-recipient' };
const snapshot = await production.freezeStudioPrint('synthetic-org', unified.upgradeUnifiedDesign(design), donor, brand);
const v5 = (await production.renderFrozenStudio(snapshot)).bytes;
for (const [file, bytes] of [['legacy-comparison.pdf', legacy], ['v5-comparison.pdf', v5]]) {
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 });
  await writeFile(`${output}/${file}`, bytes);
}
const labels = await avery.renderAvery5160Pdf([
  { name, addressLine1: '200 Sample Street', city: 'Test City', state: 'IL', zip: '60000' },
  { name: 'Alexandra Sample Household', addressLine1: '300 Sample Street', city: 'Test City', state: 'IL', zip: '60000' },
  { name: 'Synthetic Organization', addressLine1: '400 Sample Street', city: 'Test City', state: 'IL', zip: '60000' },
], { startPosition: 29, showGuides: true });
assert.equal((await PDFDocument.load(labels)).getPageCount(), 2);
await writeFile(`${output}/avery-start-29.pdf`, labels);
console.log('Both letter renderers produced one US Letter page. Three Avery recipients starting at slot 29 produced two sheets.');

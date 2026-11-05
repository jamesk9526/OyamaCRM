/** Synthetic Studio acceptance. The proof renderer runs with an isolated fixture image and no CRM writes. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { encode } from 'fast-png';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import brandModule from '../../server/src/oyama-create/studio/brand.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import printModule from '../../server/src/oyama-create/studio/print.ts';
import registryModule from '../../server/src/oyama-create/studio/registry.ts';

const { defaultDesign, normalizeDesign } = designModule;
const { normalizeBrand } = brandModule;
const { emptyDonor, renderStudio, renderRegion } = renderModule;
const { freezeStudioPrint, renderFrozenStudio } = printModule;
const { paragraph } = registryModule;
const evidence = 'docs/status/audit-artifacts/2026-11-05-studio-letterhead';
const base = process.env.CREATE_UI_WEB || 'http://127.0.0.1:3248';
const org = 'synthetic-studio-letterhead', asset = `${randomUUID()}.png`;
const assetDir = `public/uploads/letter-media/${org}`, assetPath = `${assetDir}/${asset}`, logoUrl = `/api/letters/media/${org}/${asset}`;
const width = 800, height = 200, pixels = new Uint8Array(width * height * 3);
for (let index = 0; index < width * height; index++) {
  const x = index % width, y = Math.floor(index / width);
  pixels.set(x < 180 ? [38, 88, 160] : y < 14 || y > 186 ? [117, 159, 207] : [220, 237, 253], index * 3);
}
const png = Buffer.from(encode({ width, height, data: pixels, channels: 3 }));
const legacyHtml = `<div style="font-family:Arial,sans-serif;font-size:8px;width:100%;color:#243b58"><img alt="Synthetic logo" src="${logoUrl}" style="margin-right:12px"><strong>Synthetic Community Foundation</strong><div>100 Test Way · Test City</div></div>`;
const brand = normalizeBrand({ version: 1, identity: { organizationDisplayName: 'Synthetic Community Foundation', logoUrl, footerLegalText: 'Synthetic proof fixture' }, presets: [{ id: 'legacy-header', name: 'Migrated letterhead', kind: 'header', legacyHtml, active: true, isDefault: true }] });
const donor = emptyDonor('2026-11-05T12:00:00Z');
const design = defaultDesign();
design.brandRevisionId = 'synthetic-brand';
design.body.content = [{ type: 'heading', attrs: { studioId: 'title', level: 1 }, content: [{ type: 'text', text: 'Supporting our community' }] }, paragraph('intro', 'Your generosity makes a difference. This synthetic letter checks the same page geometry in the editor, preview, and final PDF.')];
design.pack.replySlip.enabled = true;
design.pack.replySlip.content.content = [paragraph('reply', 'Synthetic attached reply slip')];
const permissions = ['view:communications', 'edit:communications', 'letters.view', 'letters.edit', 'letters.export_pdf', 'view:constituents'];
const user = { id: 'synthetic-author', organizationId: org, role: 'admin', firstName: 'Taylor', lastName: 'Sample', email: 'test@example.invalid', permissions };
const content = { id: 'synthetic-letter', campaignId: 'synthetic-campaign', name: 'Synthetic letterhead check', revision: 1, designJson: design, documentJson: { version: 1, blocks: [] }, variants: [{ id: 'letter', channel: 'LETTER', revision: 1, documentJson: {} }] };
const campaign = { id: content.campaignId, name: content.name, ownerId: user.id, status: 'DRAFT', objective: 'FUNDRAISING', revision: 1, channelsJson: ['LETTER'], audienceListIds: [], contents: [content], releases: [] };
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
let page;
const errors = [], proofKinds = [];
await mkdir(evidence, { recursive: true });
await mkdir(assetDir, { recursive: true });
await writeFile(assetPath, png, { flag: 'wx' });
try {
  const frozen = await freezeStudioPrint(org, design, donor, brand, 'LETTER', true);
  assert.match(frozen.headers[0], /max-height:35px/);
  await assert.rejects(() => renderFrozenStudio({ ...frozen, headers: [legacyHtml, legacyHtml] }, true), /first-page header exceeds its reserved margin/);
  const oldFormattedSnapshot = { ...frozen, headers: [legacyHtml.replace('margin-right:12px', 'max-width:140px;max-height:35px;vertical-align:middle;margin-right:12px'), frozen.headers[1]] };
  assert.equal((await renderFrozenStudio(oldFormattedSnapshot, true)).pageCount, 1);

  const context = await browser.newContext({ viewport: { width: 1600, height: 1050 } });
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const json = (value, status = 200) => route.fulfill({ status, json: value });
    if (path === '/api/auth/refresh') return json({ data: { accessToken: 'synthetic-session' } });
    if (path === '/api/auth/me') return json({ data: user });
    if (path === '/api/oyama-create/bootstrap') return json({ enabled: true, studioEnabled: true, permissions, capabilities: [] });
    if (path === `/api/oyama-create/campaigns/${campaign.id}`) return json(campaign);
    if (path === logoUrl) return route.fulfill({ body: png, contentType: 'image/png' });
    if (path.endsWith('/studio/preview')) {
      const input = request.postDataJSON(), current = normalizeDesign(input.design);
      return json({ ...renderStudio(current, donor, brand, { channel: 'LETTER', artifact: input.artifact, sample: true }), channel: 'LETTER', donor, brand, pageChrome: { header: renderRegion(current, donor, brand, 'firstHeader'), footer: renderRegion(current, donor, brand, 'firstFooter') } });
    }
    if (path.endsWith('/studio/proof')) {
      const { kind, revision } = request.postDataJSON();
      proofKinds.push(kind);
      assert.equal(revision, content.revision);
      assert.ok(['ALL', 'LETTER'].includes(kind), 'An attached slip proofs as part of the letter');
      try {
        const snapshot = await freezeStudioPrint(org, content.designJson, donor, brand, 'LETTER', true);
        const result = await renderFrozenStudio(snapshot, true);
        await writeFile(`${evidence}/sample-proof.pdf`, result.bytes);
        return route.fulfill({ body: result.bytes, contentType: 'application/pdf' });
      } catch (error) { return json({ error: { code: 'CREATE_PRINT_READINESS', message: error.message } }, 422); }
    }
    if (path.endsWith('/studio')) {
      if (request.method() === 'PATCH') {
        const { design, revision, campaignRevision } = request.postDataJSON();
        assert.equal(revision, content.revision);
        assert.equal(campaignRevision, campaign.revision);
        content.designJson = normalizeDesign(design);
        content.revision++;
        campaign.revision++;
      }
      return json({ design: content.designJson, brand, canEdit: true, hasEmail: false, contentRevision: content.revision, campaignRevision: campaign.revision });
    }
    if (path.endsWith('/imports/ensure')) return json({ status: 'IDLE' });
    if (path.endsWith('/imports/sources')) return json({ items: [], hasMore: false });
    if (path.startsWith('/api/settings')) return json({});
    return json([]);
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/oyama-create/campaigns/${campaign.id}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Studio letter content' }).waitFor({ timeout: 120_000 });
  const editLogo = page.locator('.cs-paper-region[data-region-name="first-page header"] img');
  const preview = page.getByRole('complementary', { name: 'Live channel preview' });
  const previewFrame = page.frameLocator('iframe[title="Letter live draft preview"]');
  const previewLogo = previewFrame.locator('.studio-preview-region img');
  const logoBounds = locator => locator.evaluate(async image => {
    await image.decode();
    const region = image.closest('.cs-paper-region,.studio-preview-region');
    return { width: image.offsetWidth, height: image.offsetHeight, clipped: region.scrollHeight > region.clientHeight + 2 };
  });
  const headerGeometry = locator => locator.evaluate(image => {
    const imageBounds = image.getBoundingClientRect(), nameBounds = image.parentElement.querySelector('strong').getBoundingClientRect();
    const scale = imageBounds.width / image.offsetWidth;
    return { nameLeft: Math.round((nameBounds.left - imageBounds.left) / scale), sameLine: nameBounds.top < imageBounds.bottom };
  });
  const renderedBounds = { editor: await logoBounds(editLogo), preview: await logoBounds(previewLogo) };
  assert.deepEqual(renderedBounds.editor, { width: 140, height: 35, clipped: false });
  assert.deepEqual(renderedBounds.preview, renderedBounds.editor);
  const headerPositions = { editor: await headerGeometry(editLogo), preview: await headerGeometry(previewLogo) };
  assert.deepEqual(headerPositions.editor, { nameLeft: 152, sameLine: true });
  assert.deepEqual(headerPositions.preview, headerPositions.editor);
  const fonts = await previewFrame.locator('article').evaluate(async article => {
    const document = article.ownerDocument;
    await Promise.all([document.fonts.load('9pt Inter'), document.fonts.load('11pt "Noto Serif"')]);
    return [...document.fonts].map(face => [face.family, face.status]);
  });
  assert.deepEqual(fonts, [['Inter', 'loaded'], ['Noto Serif', 'loaded']]);
  await page.screenshot({ path: `${evidence}/desktop-editor-and-preview.png` });

  await page.getByRole('button', { name: 'Block & design settings', exact: true }).click();
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  const margin = page.locator('[data-studio-margin="top"]');
  await margin.fill('0.25');
  await page.getByRole('button', { name: 'Pack proof', exact: true }).click();
  const warning = page.getByRole('alert', { name: 'PDF proof warning' });
  await warning.waitFor({ timeout: 45_000 });
  assert.match(await warning.innerText(), /Increase the top margin to at least/);
  assert.equal(await page.getByRole('button', { name: 'Retry save', exact: true }).count(), 0);
  assert.match(await page.locator('.cs-save').innerText(), /Saved/);
  await page.screenshot({ path: `${evidence}/proof-margin-warning.png` });
  await warning.getByRole('button', { name: 'Adjust top margin' }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-studio-margin') === 'top');
  assert.ok(await margin.evaluate(input => input === input.ownerDocument.activeElement));
  await margin.fill('0.8');
  await page.getByRole('button', { name: 'Close block and design settings' }).click();
  await preview.getByLabel('Preview letter piece').selectOption('REPLY_SLIP');
  await preview.getByRole('button', { name: 'PDF proof', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Appeal-pack PDF proof' });
  await dialog.waitFor({ timeout: 45_000 });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  assert.deepEqual(proofKinds, ['ALL', 'LETTER']);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('group', { name: 'Builder panel' }).getByRole('button', { name: 'Preview', exact: true }).click();
  await preview.getByLabel('Preview letter piece').selectOption('LETTER');
  await previewFrame.getByText('Supporting our community', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  assert.equal(await previewFrame.locator('article').evaluate(article => article.getBoundingClientRect().right > article.ownerDocument.documentElement.clientWidth + 2), false);
  await page.screenshot({ path: `${evidence}/phone-letter-preview.png` });
  assert.deepEqual(errors, []);
  const checks = { synthetic: true, renderedBounds, headerPositions, fonts, proofKinds, savedRevision: content.revision, errors };
  await writeFile(`${evidence}/checks.json`, JSON.stringify(checks, null, 2));
  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  if (page) await page.screenshot({ path: `${evidence}/failure.png` });
  throw error;
} finally {
  await browser.close();
  await unlink(assetPath);
}

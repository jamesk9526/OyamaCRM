import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { Script } from 'node:vm';

// Synthetic browser data only; never connects to the CRM database or sends letters.
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3102';
const before = process.env.QA_CAPTURE_BEFORE === '1';
const evidence = 'docs/status/audit-artifacts/2026-11-02-letters-ui';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const templates = [
  { id: 'qa-thanks', name: 'Community thank you', category: 'THANK_YOU', status: 'ACTIVE', description: 'A personal note after a gift.', updatedAt: '2026-11-01T12:00:00Z', createdBy: { id: 'qa-staff', firstName: 'Morgan', lastName: 'Staff' }, _count: { generatedLetters: 24 } },
  { id: 'qa-welcome', name: 'Welcome to our community', category: 'WELCOME', status: 'DRAFT', updatedAt: '2026-10-30T12:00:00Z', createdBy: { id: 'qa-user', firstName: 'Alex', lastName: 'Staff' }, _count: { generatedLetters: 0 } },
  { id: 'qa-tax', name: 'Annual giving statement', category: 'TAX_RECEIPT', status: 'ACTIVE', updatedAt: '2026-10-29T12:00:00Z', aiAssisted: true, createdBy: { id: 'qa-user', firstName: 'Alex', lastName: 'Staff' }, _count: { generatedLetters: 120 } },
  { id: 'qa-archive', name: 'Spring appeal', category: 'GENERAL', status: 'ARCHIVED', updatedAt: '2026-04-12T12:00:00Z', createdBy: null, _count: { generatedLetters: 16 } },
];
let production = true;
let failLibrary = false;
let failDelete = false;
let canArchive = true;
const generated = [
  { id: 'qa-generated-1', templateId: 'qa-thanks', category: 'THANK_YOU', status: 'GENERATED', generatedAt: '2026-11-01T12:00:00Z', template: { id: 'qa-thanks', name: 'Community thank you' }, constituent: { id: 'qa-recipient', firstName: 'Morgan', lastName: 'Example', email: 'morgan@example.test' } },
  { id: 'qa-generated-2', templateId: 'qa-tax', category: 'TAX_RECEIPT', status: 'MAILED', generatedAt: '2026-10-30T12:00:00Z', template: { id: 'qa-tax', name: 'Annual giving statement' }, constituent: { id: 'qa-recipient-2', firstName: 'Alex', lastName: 'Example', email: 'alex@example.test' } },
];
const writes = [];
await page.addInitScript(() => {
  localStorage.setItem('oyamaLetters.templateSetupHintDismissed.v1', '1');
});
await page.route('**/_next/static/**', async route => {
  // Buffer and validate development chunks: a truncated streaming response is not a UI failure.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(route.request().url());
      const body = Buffer.from(await response.arrayBuffer());
      if (new URL(route.request().url()).pathname.endsWith('.js')) new Script(body.toString());
      await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') || 'application/javascript', body });
      return;
    } catch (error) { if (attempt === 2) throw error; }
  }
});
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  let body = {};
  if (route.request().method() === 'DELETE') {
    writes.push(path);
    assert.equal(route.request().postDataJSON().confirmation, 'delete');
    if (failDelete) return route.fulfill({ status: 503, json: { error: { message: 'Deletion temporarily unavailable. Try again.' } } });
    if (path.includes('/templates/qa-thanks/')) return route.fulfill({ status: 409, json: { error: { message: 'This template has generated letters. Delete those letters first, or archive the template to retain their history.' } } });
    const collection = path.includes('/templates/') ? templates : generated;
    const id = path.includes('/templates/') ? path.split('/').at(-2) : path.split('/').at(-1);
    const index = collection.findIndex(item => item.id === id);
    assert.ok(index >= 0);
    collection.splice(index, 1);
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith('/auth/refresh')) body = { data: { accessToken: 'qa-fixture-token' } };
  else if (path.endsWith('/auth/me')) body = { id: 'qa-user', organizationId: 'qa-org', role: canArchive ? 'admin' : 'readonly', firstName: 'Alex', lastName: 'Staff', permissions: canArchive ? ['*', 'letters.view', 'letters.edit', 'letters.create', 'letters.generate', 'letters.archive'] : ['letters.view'] };
  else if (path.endsWith('/production/config')) body = { enabled: production };
  else if (path === '/api/letters/templates') {
    if (failLibrary) return route.fulfill({ status: 503, json: { error: { message: 'Library temporarily unavailable.' } } });
    body = templates.filter(template => (!url.searchParams.get('status') || template.status === url.searchParams.get('status')) && (!url.searchParams.get('category') || template.category === url.searchParams.get('category')) && (!url.searchParams.get('search') || template.name.toLowerCase().includes(url.searchParams.get('search').toLowerCase())));
  } else if (path === '/api/letters/templates/qa-thanks') body = { ...templates[0], revision: 1, documentSchemaVersion: 2, printBody: '<h2>Thank you for your support</h2><p>Dear {{donor.firstName}},</p><p>Your generosity helps our community thrive. Thank you for being part of the work.</p>', printLayoutJson: {} };
  else if (path.endsWith('/qa-thanks/publish')) body = { blockers: [], warnings: [], mergeFieldsUsed: [], ready: true };
  else if (path.endsWith('/merge-fields')) body = { sections: [{ key: 'donor', label: 'Contact', fields: ['{{donor.firstName}}', '{{donor.lastName}}'] }] };
  else if (path === '/api/constituents') body = [{ id: 'qa-contact', firstName: 'Morgan', lastName: 'Example' }];
  else if (path === '/api/letters/generated') body = generated.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 100));
  else if (/signatures|header-presets|footer-presets|generated|templates\/qa-thanks\/revisions/.test(path)) body = [];
  else if (path.includes('/notifications')) body = { items: [], unreadCount: 0 };
  else if (path.includes('/modules')) body = [];
  if (route.request().method() !== 'GET' && !path.includes('/auth/') && !path.endsWith('/publish') && !path.includes('/preview')) writes.push(path);
  await route.fulfill({ json: body });
});
async function capture(name) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${evidence}/${before ? 'before-' : ''}${name}.png`, fullPage: true, animations: 'disabled' });
}
async function noOverflow(width) {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scroll <= width + 1, `Page overflows at ${width}px: ${scroll}`);
}
try {
  await page.goto(`${base}/oyama-letters`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('heading', { name: 'Template Library', exact: true }).waitFor();
  await page.getByText('Welcome to our community', { exact: true }).first().waitFor();
  await capture('library-desktop');
  if (!before) {
    const rows = page.locator('.letters-template-row');
    assert.equal(await rows.count(), 4);
    await page.getByRole('searchbox', { name: 'Search templates', exact: true }).fill('community');
    assert.equal(await rows.count(), 2);
    await page.getByRole('searchbox', { name: 'Search templates', exact: true }).fill('no matching letter');
    await page.getByRole('heading', { name: 'No matching templates', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
    assert.equal(await rows.count(), 4);
    await page.getByRole('button', { name: /My templates/, exact: false }).click();
    assert.equal(await rows.count(), 2);
    await page.getByRole('button', { name: /Team templates/, exact: false }).click();
    assert.equal(await rows.count(), 1);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
    await page.getByRole('button', { name: /Filters/, exact: false }).click();
    await page.getByLabel('Template status', { exact: true }).selectOption('ACTIVE');
    assert.equal(await rows.count(), 2);
    await page.getByLabel('Authoring', { exact: true }).selectOption('AI');
    assert.equal(await rows.count(), 1);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
    await page.getByLabel('Sort templates', { exact: true }).selectOption('name');
    assert.match(await rows.first().innerText(), /Annual giving statement/);
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    assert.equal(await page.locator('.letters-template-card').count(), 4);
    await capture('library-grid-desktop');
    await page.getByRole('button', { name: 'List', exact: true }).click();
    failLibrary = true;
    await page.getByRole('button', { name: 'Refresh templates', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'temporarily unavailable' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'No matching templates', exact: true }).count(), 0);
    failLibrary = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await rows.first().waitFor();
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    assert.equal(await page.getByRole('link', { name: 'Template Library', exact: true }).first().getAttribute('aria-current'), 'page');
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await page.getByRole('button', { name: /Filters/, exact: false }).click();
    assert.deepEqual(writes, []);
    await page.getByRole('button', { name: 'Delete Welcome to our community', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Delete template?', exact: true });
    const confirmation = dialog.getByRole('textbox');
    const remove = dialog.getByRole('button', { name: 'Delete template', exact: true });
    assert.equal(await remove.isDisabled(), true);
    await confirmation.fill('DELETE');
    assert.equal(await remove.isDisabled(), true);
    await confirmation.fill('del');
    assert.equal(await remove.isDisabled(), true);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(element => element === document.activeElement), true);
    await capture('delete-confirmation-desktop');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Delete Welcome to our community', exact: true }).evaluate(element => element === document.activeElement), true);
    assert.deepEqual(writes, []);
    await page.getByRole('button', { name: 'Delete Welcome to our community', exact: true }).click();
    assert.equal(await confirmation.inputValue(), '');
    await confirmation.fill('delete');
    failDelete = true;
    await remove.click();
    await dialog.getByRole('alert').filter({ hasText: 'temporarily unavailable' }).waitFor();
    assert.equal(await rows.count(), 4);
    failDelete = false;
    await remove.click();
    await page.getByText('Deleted Welcome to our community.', { exact: true }).waitFor();
    assert.equal(await rows.count(), 3);
    await page.getByRole('button', { name: 'Delete Community thank you', exact: true }).click();
    await confirmation.fill('delete');
    await remove.click();
    await dialog.getByRole('alert').filter({ hasText: 'has generated letters' }).waitFor();
    assert.equal(await rows.count(), 3);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  if (!before) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/oyama-letters/generated`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('heading', { name: 'Generated Letters', exact: true }).waitFor();
    await page.locator('.letters-template-row').first().waitFor();
    await capture('generated-desktop');
    await page.getByRole('button', { name: 'Delete Community thank you for Morgan Example', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 900 });
    const dialog = page.getByRole('dialog', { name: 'Delete generated letter?', exact: true });
    await dialog.getByRole('textbox').fill('delete');
    await noOverflow(390);
    await capture('delete-confirmation-mobile');
    await dialog.getByRole('button', { name: 'Delete letter', exact: true }).click();
    await page.getByText('Deleted Community thank you for Morgan Example.', { exact: true }).waitFor();
    assert.equal(await page.locator('.letters-template-row').count(), 1);
    await noOverflow(390);
    await capture('generated-mobile');
    const remaining = generated[0];
    generated.push(...Array.from({ length: 102 }, (_, index) => ({ ...remaining, id: `qa-older-${index}` })));
    await page.getByRole('button', { name: 'Refresh letters', exact: true }).click();
    await page.getByRole('button', { name: 'Load older letters', exact: true }).click();
    await page.getByText('103 shown · 103 loaded', { exact: true }).waitFor();
    await page.goto(`${base}/oyama-letters`, { waitUntil: 'networkidle' });
  }
  for (const width of before ? [390, 768] : [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    if (!before) await noOverflow(width);
    await capture(`library-${width}`);
  }
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.goto(`${base}/oyama-letters/templates/qa-thanks/builder`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('textbox', { name: 'Letter content', exact: true }).waitFor();
  await capture('builder-desktop');
  await page.setViewportSize({ width: 390, height: 900 });
  if (!before) await noOverflow(390);
  await capture('builder-mobile');
  if (!before) {
    await page.setViewportSize({ width: 320, height: 900 });
    await noOverflow(320);
    await capture('builder-320');
  }
  if (!before) {
  production = false;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('.letter-builder').waitFor();
  await capture('ribbon-desktop');
  await page.setViewportSize({ width: 390, height: 900 });
  if (!before) await noOverflow(390);
  const ribbonPanels = page.getByRole('group', { name: 'Builder panels', exact: true });
  await ribbonPanels.getByRole('button', { name: 'Blocks', exact: true }).click();
  await page.getByRole('complementary', { name: 'Letter blocks', exact: true }).waitFor();
  await ribbonPanels.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('complementary', { name: 'Letter settings', exact: true }).waitFor();
  await ribbonPanels.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByRole('region', { name: 'Writing and print proof', exact: true }).waitFor();
  await capture('ribbon-mobile');
  canArchive = false;
  await page.goto(`${base}/oyama-letters`, { waitUntil: 'networkidle' });
  // A full navigation reload restores auth from the fixture with no delete permission.
  assert.equal(await page.getByRole('button', { name: /^Delete / }).count(), 0);
  }
  assert.deepEqual(errors, []);
  assert.ok(writes.every(path => /\/api\/letters\/(templates\/(qa-welcome|qa-thanks)\/permanent|generated\/qa-generated-1)$/.test(path)));
  await writeFile(`${evidence}/${before ? 'before-' : ''}browser-results.json`, JSON.stringify({ passed: true, fixtureData: true, errors, interceptedDeletionRequests: writes, checks: before ? ['baseline screenshots'] : ['search and filter recovery', 'ownership, status and AI filters', 'sorting', 'grid/list switching', 'load error and retry', 'sidebar accessibility', 'typed delete confirmation: cancel, wrong text, reset, retry, success and template history conflict', 'generated-letter removal and pagination', 'delete controls hidden without permission', 'desktop/mobile library and both editors', 'no horizontal overflow'] }, null, 2));
} catch (error) {
  console.error('URL', page.url(), 'BODY', (await page.locator('body').innerText()).slice(0, 2500), 'ERRORS', errors);
  await capture('failure');
  throw error;
} finally {
  await browser.close();
}

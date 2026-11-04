/** Synthetic settings load/save acceptance. Every API request is intercepted; no real settings are written. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const web = process.env.CRM_AUDIT_WEB || 'http://localhost:3220';
const before = process.env.SETTINGS_CAPTURE_BEFORE === '1';
const evidence = 'docs/status/audit-artifacts/2026-11-04-crm-completeness';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const errors = [], checks = [], writes = [];
const user = { id: 'synthetic-admin', organizationId: 'synthetic-org', firstName: 'Taylor', lastName: 'Sample', role: 'admin', permissions: [] };
let failLoad = true, failSave = false;
let security = { emailMfaEnabled: true, passwordResetEnabled: false, mfaCodeTtlMinutes: 15, passwordResetTtlMinutes: 45 };
let workspaces = { donorEnabled: true, showModuleSwitcher: false, defaultWorkspace: 'donor', donorNavigationLayout: 'sidebar', donorAccentTone: 'teal' };
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (path === '/api/auth/refresh') return json({ data: { accessToken: 'synthetic-session' } });
  if (path === '/api/auth/me') return json({ data: user });
  if (path === '/api/settings/security/auth' || path === '/api/settings/workspaces') {
    if (request.method() === 'GET' && failLoad) return json({ error: { message: 'Synthetic settings unavailable' } }, 500);
    if (request.method() === 'PUT') {
      writes.push({ path, body: request.postDataJSON(), failed: failSave });
      if (failSave) return json({ error: { message: 'Synthetic save failed' } }, 500);
      if (path.endsWith('/auth')) security = request.postDataJSON();
      else workspaces = request.postDataJSON();
    }
    return json(path.endsWith('/auth') ? security : workspaces);
  }
  if (path === '/api/audit-logs') return json({ items: [], total: 0, page: 1, limit: 50 });
  if (path === '/api/setup/snapshots') return json({ snapshots: [] });
  if (path === '/api/settings') return json({ orgName: 'Synthetic CRM', currency: 'USD', fiscalYearStart: 1 });
  if (request.method() !== 'GET') throw new Error(`Unexpected mutation: ${request.method()} ${path}`);
  return json([]);
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
try {
  for (const kind of ['security', 'workspaces']) {
    failLoad = true; failSave = false;
    await page.goto(`${web}/settings/${kind}`);
    await page.getByText('Synthetic settings unavailable', { exact: true }).waitFor();
    const save = page.getByRole('button', { name: kind === 'security' ? 'Save Auth Policy' : 'Save Workspace Settings', exact: true });
    await page.screenshot({ path: `${evidence}/${kind}-load-${before ? 'before' : 'after'}.png`, fullPage: true });
    if (before) {
      assert.equal(await save.isEnabled(), true, 'Baseline reproduces unsafe writable defaults after load failure');
      checks.push(`${kind}: reproduced enabled Save after failed initial read (no write performed)`);
      continue;
    }
    assert.equal(await save.isDisabled(), true);
    assert.equal(writes.length, kind === 'security' ? 0 : 2);
    failLoad = false;
    await page.getByRole('button', { name: kind === 'security' ? 'Retry loading authentication policy' : 'Retry loading workspace settings', exact: true }).click();
    const control = kind === 'security' ? page.getByLabel('MFA code TTL (minutes)', { exact: true }) : page.getByRole('combobox', { name: /^Accent color/ });
    await control.waitFor({ state: 'visible' });
    if (kind === 'security') { assert.equal(await control.inputValue(), '15'); await control.fill('20'); }
    else { assert.equal(await control.inputValue(), 'teal'); await control.selectOption('amber'); }
    failSave = true;
    await save.click();
    await page.getByText('Synthetic save failed', { exact: true }).waitFor();
    assert.equal(await control.inputValue(), kind === 'security' ? '20' : 'amber', 'Failed save retains local edits');
    failSave = false;
    await save.click();
    await page.getByText(kind === 'security' ? 'Authentication policy saved.' : 'Workspace settings saved.', { exact: true }).waitFor();
    await page.reload();
    await page.waitForFunction(({ label, expected }) => {
      const labels = [...document.querySelectorAll('label')];
      const element = labels.find(item => item.textContent.includes(label))?.querySelector('input,select');
      return element?.value === expected && !element.matches(':disabled');
    }, { label: kind === 'security' ? 'MFA code TTL' : 'Accent color', expected: kind === 'security' ? '20' : 'amber' });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: `${evidence}/${kind}-settings-phone.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.setViewportSize({ width: 1440, height: 1000 });
    checks.push(`${kind}: failed load blocks writes; retry restores authoritative values; failed save preserves edits; saved values survive reload; phone fits`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/settings-${before ? 'baseline' : 'browser-checks'}.json`, JSON.stringify({ synthetic: true, checks, errors, writes }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${evidence}/settings-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }

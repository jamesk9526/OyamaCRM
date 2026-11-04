/** Synthetic volunteer directory acceptance; no CRM/provider writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const web = process.env.CRM_AUDIT_WEB || 'http://localhost:3220';
const evidence = 'docs/status/audit-artifacts/2026-11-04-crm-completeness';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const errors = [], checks = [], requests = [];
let fail = false;
let resolveOldSearch;
const oldSearch = new Promise(resolve => { resolveOldSearch = resolve; });
const user = { id: 'synthetic-staff', organizationId: 'synthetic-org', role: 'admin', firstName: 'Taylor', lastName: 'Sample', email: 'staff@example.invalid', permissions: ['view:constituents', 'edit:constituents'] };
const volunteers = Array.from({ length: 125 }, (_, index) => ({ id: `volunteer-${index + 1}`, firstName: index === 0 ? 'Latest' : 'Synthetic', lastName: `Volunteer ${String(index + 1).padStart(3, '0')}`, donorStatus: 'ACTIVE', type: 'VOLUNTEER', email: `person${index + 1}@example.invalid`, phone: null, tags: [] }));
await context.route('**/api/**', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (path === '/api/auth/refresh') return json({ data: { accessToken: 'synthetic-session' } });
  if (path === '/api/auth/me') return json({ data: user });
  if (path === '/api/constituents') {
    requests.push(url.search);
    const search = url.searchParams.get('search') || '';
    if (search === 'old') await oldSearch;
    if (fail) return json({ error: { message: 'Synthetic volunteers unavailable' } }, 500);
    const filtered = search === 'old' ? [{ ...volunteers[0], firstName: 'Stale' }] : search ? volunteers.filter(item => `${item.firstName} ${item.lastName}`.toLowerCase().includes(search.toLowerCase())) : volunteers;
    const page = Number(url.searchParams.get('page') || '1'), pageSize = Number(url.searchParams.get('pageSize') || '25');
    return json(url.searchParams.has('page') ? { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize, totalPages: Math.ceil(filtered.length / pageSize) } : filtered.slice(0, 100));
  }
  if (path === '/api/settings') return json({ orgName: 'Synthetic CRM', currency: 'USD', fiscalYearStart: 1 });
  return json([]);
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${web}/volunteers`);
  await page.getByText('Latest Volunteer 001', { exact: true }).waitFor();
  const welcome = page.getByRole('button', { name: /Got it, let.s get started/ });
  if (await welcome.isVisible()) await welcome.click();
  if (process.env.CRM_AUDIT_BEFORE === '1') {
    await page.screenshot({ path: `${evidence}/volunteers-before-desktop.png`, fullPage: true });
  } else {
    await page.getByText('125 volunteers', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('Synthetic Volunteer 026', { exact: true }).waitFor();
    await page.screenshot({ path: `${evidence}/volunteers-desktop.png`, fullPage: true });
    checks.push('Paginated directory exposes all 125 volunteers and accurate server total');
    const search = page.getByRole('searchbox', { name: 'Search volunteers' });
    await search.fill('old');
    await page.waitForRequest(request => new URL(request.url()).searchParams.get('search') === 'old');
    await search.fill('latest');
    await page.getByText('Latest Volunteer 001', { exact: true }).waitFor();
    resolveOldSearch();
    await page.waitForTimeout(400);
    assert.equal(await page.getByText('Stale Volunteer 001', { exact: true }).count(), 0);
    checks.push('A stale overlapping search cannot replace newer results');
    fail = true;
    await search.fill('unavailable');
    await page.getByRole('alert').filter({ hasText: 'Synthetic volunteers unavailable' }).waitFor();
    assert.equal(await page.getByText('No volunteers found.', { exact: false }).count(), 0);
    fail = false;
    await page.getByRole('button', { name: 'Retry loading volunteers' }).click();
    await page.getByText('No volunteers matching', { exact: false }).waitFor();
    checks.push('Failed loads show an actionable retry and never show a false empty state');
    await search.fill('');
    await page.getByText('125 volunteers', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${evidence}/volunteers-phone.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.getByRole('button', { name: 'Next', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/volunteers-phone-pagination.png`, fullPage: true });
    checks.push('Phone directory remains within viewport with horizontally scrollable table');
    await page.getByRole('link', { name: 'Add Volunteer', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Add New Volunteer', exact: true }).waitFor();
    assert.equal(await page.locator('select').filter({ has: page.locator('option[value="VOLUNTEER"]') }).inputValue(), 'VOLUNTEER');
    await page.goto(`${web}/constituents/new`);
    await page.getByRole('heading', { name: 'Add New Constituent', exact: true }).waitFor();
    assert.equal(await page.locator('select').filter({ has: page.locator('option[value="VOLUNTEER"]') }).inputValue(), 'DONOR');
    checks.push('Add Volunteer initializes volunteer type; ordinary new constituent retains donor default');
    assert.deepEqual(errors, []);
    await writeFile(`${evidence}/volunteers-browser-checks.json`, JSON.stringify({ synthetic: true, checks, errors, requests }, null, 2));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  }
} catch (error) {
  await page.screenshot({ path: `${evidence}/volunteers-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally { resolveOldSearch(); await browser.close(); }

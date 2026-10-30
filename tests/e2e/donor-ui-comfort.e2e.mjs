import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const evidence = 'docs/status/audit-artifacts/2026-10-30-ui-comfort';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], reads = [], checks = [], dashboardReads = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/**', route => route.fulfill({ json: { items: [], unreadCount: 0 } }));
await installDonorWorkspaceFixtures(page);
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/reports/new-donors') { dashboardReads.push(url.pathname); return route.fulfill({ json: { items: [], total: 0, totalPages: 0 } }); }
  if (url.pathname === '/api/notifications') { dashboardReads.push(url.pathname); return route.fulfill({ json: { items: [], unreadCount: 0 } }); }
  if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: { data: { accessToken: 'synthetic-fixture' } } });
  if (url.pathname === '/api/auth/me') return route.fulfill({ json: { data: { id: 'qa-admin', organizationId: 'qa-org', firstName: 'QA', lastName: 'Admin', role: 'admin', email: 'qa@example.invalid' } } });
  if (url.pathname === '/api/constituents' && url.searchParams.has('page')) {
    reads.push(url);
    await new Promise(resolve => setTimeout(resolve, 180));
    return route.fulfill({ json: { items: [], total: 0, totalPages: 0, summary: { total: 0, active: 0, lapsed: 0, prospects: 0 } } });
  }
  if (url.pathname === '/api/donations' || url.pathname === '/api/donations/stats') {
    reads.push(url);
    await new Promise(resolve => setTimeout(resolve, 180));
    return route.fulfill({ json: url.pathname.endsWith('stats') ? { totalRaised: 0, totalGifts: 0, completed: 0, recurring: 0 } : { items: [], total: 0 } });
  }
  if (url.pathname === '/api/setup/status') return route.fulfill({ json: { setupComplete: true } });
  if (route.request().method() !== 'GET') return route.fulfill({ status: 405, json: { error: { message: 'Business writes disabled' } } });
  if (url.pathname === '/api/notifications/sse') return route.fulfill({ contentType: 'text/event-stream', body: '' });
  return route.fallback();
});
try {
  for (const [path, label] of [['/constituents','Search constituents'], ['/donations','Search donations by donor name or email']]) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    const search = page.getByRole('searchbox', { name: label, exact: true });
    await search.waitFor();
    reads.length = 0;
    await search.pressSequentially('Avery', { delay: 35 });
    assert.equal(reads.length, 0, 'No API read during rapid typing');
    await page.waitForURL(/search=Avery/);
    await page.waitForTimeout(450);
    const listPath = path === '/constituents' ? '/api/constituents' : '/api/donations';
    assert.equal(reads.filter(url => url.pathname === listPath).length, 1, 'One list read per settled search');
    await search.fill('Morgan'); await search.press('Enter');
    await page.waitForURL(/search=Morgan/);
    await page.waitForTimeout(450);
    assert.equal(reads.filter(url => url.pathname === listPath && url.searchParams.get('search') === 'Morgan').length, 1, 'Enter does not trigger a second timer request');
    await search.fill(''); await page.waitForURL(url => !url.searchParams.has('search'));
    await page.waitForTimeout(250);
    checks.push(`${path}: rapid typing coalesces to one list read; Enter flushes once; clear removes URL search`);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} overflow at ${width}`);
      await page.screenshot({ path: `${evidence}/${path.slice(1)}-${width}.png`, fullPage: true });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/donations');
  await page.getByRole('button', { name: 'Refresh donations', exact: true }).click();
  await page.locator('.crm-table-loading').waitFor();
  assert.equal(await page.locator('.donor-loading-skeleton').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.ok(await page.locator('.crm-table-loading').evaluate(el => el.getBoundingClientRect().height >= 300));
  await response;
  checks.push('Desktop/tablet/mobile fit viewport; reduced-motion skeleton is static and keeps list space');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'New donors', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await page.waitForTimeout(250);
  dashboardReads.length = 0;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.waitForTimeout(700);
  assert.ok(dashboardReads.includes('/api/reports/new-donors'));
  assert.ok(dashboardReads.includes('/api/notifications'));
  assert.equal(await page.getByRole('button', { name: 'Previous month', exact: true }).getAttribute('aria-pressed'), 'true');
  checks.push('Dashboard refresh reloads new donors and staff reminders while preserving selected month');
  const spotlight = page.locator('.donor-spotlight');
  for (const label of ['Giving momentum', 'Donor relationships', 'Your next steps']) {
    await spotlight.getByRole('button', { name: label, exact: true }).click();
    const colors = await spotlight.locator('h2,h3').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color));
    assert.ok(colors.every(color => color === 'rgb(255, 255, 255)'), `Dark panel headings must be white: ${colors}`);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await spotlight.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await spotlight.screenshot({ path: `${evidence}/spotlight-contrast-${width}.png` });
  }
  checks.push('All three spotlight slides use white headings; desktop and mobile spotlight fit the viewport');
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/browser-results.json`, JSON.stringify({ checks, errors, fixture: 'Synthetic API reads; no business writes' }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) { console.error(JSON.stringify({ url: page.url(), errors, body: (await page.locator('body').innerText()).slice(0, 5000) })); throw error; } finally { await browser.close(); }

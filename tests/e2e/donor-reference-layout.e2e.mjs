import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const evidence = 'docs/status/audit-artifacts/2026-10-30-ui-comfort';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
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
    return route.fulfill({ json: url.pathname.endsWith('stats') ? { totalRaised: 0, totalGifts: 0, completed: 0, recurring: 0 } : { items: [{ id: "qa-gift", amount: 250, date: "2026-10-30T12:00:00Z", constituent: { id: "qa-donor", firstName: "QA", lastName: "Donor" } }], total: 1 } });
  }
  if (url.pathname === '/api/setup/status') return route.fulfill({ json: { setupComplete: true } });
  if (route.request().method() !== 'GET') return route.fulfill({ status: 405, json: { error: { message: 'Business writes disabled' } } });
  if (url.pathname === '/api/notifications/sse') return route.fulfill({ contentType: 'text/event-stream', body: '' });
  return route.fallback();
});
try {
 await page.goto(base + '/', { waitUntil: 'networkidle' });
 await page.getByRole('region', { name: 'Performance summary' }).waitFor();
 const giftLink = page.locator('.donor-reference-operations a[href^="/donations/"]').first();
 console.log("Checking recent gift link");
 await giftLink.waitFor();
 const giftHref = await giftLink.getAttribute('href');
 await giftLink.click();
 console.log("Opened gift");
 await page.waitForURL(url => url.pathname === giftHref);
 await page.goto(base + '/', {waitUntil:'networkidle'});
 const recent = page.getByRole('region', {name:'Recent records'});
 console.log("Checking recent history");
 await recent.locator(`a[href="${giftHref}"]`).waitFor();
 assert.equal(await recent.locator(`a[href="${giftHref}"]`).count(),1);
 await recent.getByRole('button',{name:'Clear',exact:true}).click();
 assert.equal(await recent.locator('a').count(),0);
 for (const width of [1700,390]) {
  await page.setViewportSize({width,height:925});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
  await page.screenshot({path:`${evidence}/reference-dashboard-${width}.png`,fullPage:true});
 }
 console.log('Dashboard desktop/mobile render and overflow checks passed');
} finally { await browser.close(); }

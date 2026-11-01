import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const evidence = 'docs/status/audit-artifacts/2026-11-01-topbar';
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
  if (url.pathname === '/api/search') return route.fulfill({json:{module:'donor',query:url.searchParams.get('q'),results:[]}});
  if (url.pathname === '/api/setup/status') return route.fulfill({ json: { setupComplete: true } });
  if (route.request().method() !== 'GET') return route.fulfill({ status: 405, json: { error: { message: 'Business writes disabled' } } });
  if (url.pathname === '/api/notifications/sse') return route.fulfill({ contentType: 'text/event-stream', body: '' });
  return route.fallback();
});
try {
 await page.goto(base + '/', { waitUntil: 'networkidle' });
 await page.locator('[data-topbar-root="true"]').waitFor();
 await page.getByRole("region", {name:"Performance summary"}).waitFor();
 for (const width of [1440, 1024, 768, 390, 320]) {
  await page.setViewportSize({width,height:900});
  await page.screenshot({path:`${evidence}/topbar-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false, `overflow at ${width}`);
  await page.getByRole('button', {name:/Open profile menu/}).filter({visible:true}).click();
  await page.getByRole('dialog', {name:'Account',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog',{name:'Account',exact:true}).count(),0);
 }
 await page.setViewportSize({width:1440,height:900});
 await page.getByRole('button',{name:'Quick Add',exact:true}).filter({visible:true}).click();
 await page.getByRole('dialog',{name:'Quick Add',exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Switch workspace',exact:true}).filter({visible:true}).click();
 await page.getByRole('dialog',{name:'Switch workspace',exact:true}).waitFor();
 await page.screenshot({path:`${evidence}/workspace-menu.png`});
 await page.keyboard.press('Escape');
 await page.getByRole('textbox',{name:'Search CRM'}).filter({visible:true}).fill('no-match');
 await page.getByText('No direct matches in this CRM scope.').waitFor();
 await page.keyboard.press('Escape');
 const period = page.getByRole('button',{name:/Reporting period:/});
 const before = await period.getAttribute('aria-label');
 await period.click();
 assert.notEqual(await period.getAttribute('aria-label'),before);
 await period.click();
 await page.setViewportSize({width:390,height:900});
 await page.getByRole('button',{name:'Open workspace tools',exact:true}).click();
 await page.getByRole('button',{name:'Quick Add',exact:true}).filter({visible:true}).click();
 await page.getByRole('dialog',{name:'Quick Add',exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Open command search',exact:true}).click();
 await page.getByRole('textbox',{name:'Search CRM'}).filter({visible:true}).waitFor();
 await page.keyboard.press('Escape');
 await writeFile(`${evidence}/checks.json`,JSON.stringify({widths:[1440,1024,768,390,320],errors,checks:['no horizontal overflow','account opens and Escape closes at each width','Quick Add keyboard dismissal','workspace switcher keyboard dismissal','search empty results','reporting period toggle','mobile Quick Add and search']},null,2));
 assert.deepEqual(errors,[]);
 console.log('Top bar responsive and interaction checks passed');
} finally { await browser.close(); }

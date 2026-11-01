import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const evidence = 'docs/status/audit-artifacts/2026-11-01-dashboard-refactor';
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
let failRetention = false, failSummary = false, failMeetings = false;
await page.route('**/api/reports/donor-retention**', route => failRetention ? route.fulfill({status:503,json:{error:{message:'Retention offline'}}}) : route.fallback());
await page.route('**/api/reports/summary**', route => failSummary ? route.fulfill({status:503,json:{error:{message:'Summary offline'}}}) : route.fallback());
await page.route('**/api/meetings/upcoming', route => failMeetings ? route.fulfill({status:503,json:{error:{message:'Meetings offline'}}}) : route.fulfill({json:{items:[],todayCount:0}}));
await page.route('**/api/tasks?**', route => route.fulfill({json:{items:[]}}));
try {
 await page.goto(base + '/', {waitUntil:'networkidle'});
 const metrics = page.getByRole('region',{name:'Performance summary'});
 const refresh = page.getByRole('button',{name:'Refresh',exact:true});
 await refresh.waitFor();
 for (const width of [1440,1024,768,390,320]) {
  await page.setViewportSize({width,height:1000});
  await page.screenshot({path:`${evidence}/dashboard-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false,`overflow at ${width}`);
  const cards = await metrics.locator('.crm-metric-card').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,scroll:n.scrollWidth})));
  assert.ok(cards.every(c=>c.scroll<=Math.ceil(c.width)),`metric overflow at ${width}`);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'MY',exact:true}).click();
 await refresh.click(); await page.waitForLoadState('networkidle'); await refresh.waitFor();
 assert.equal(await page.getByRole('button',{name:'MY',exact:true}).getAttribute('aria-pressed'),'true');
 failRetention=true;
 await refresh.click(); await page.waitForLoadState('networkidle'); await refresh.waitFor();
 assert.ok((await metrics.innerText()).includes('$250.00'),`retention failure discarded summary: ${await metrics.innerText()}`);
 await page.getByRole('alert').filter({hasText:'Some dashboard data'}).waitFor();
 failRetention=false;failSummary=true;failMeetings=true;
 await refresh.click();await page.waitForLoadState('networkidle'); await refresh.waitFor();
 assert.ok(!(await metrics.innerText()).includes('$250.00'),'failed summary displayed stale totals');
 await page.getByRole('button',{name:'Retry meetings'}).waitFor();
 await page.screenshot({path:`${evidence}/partial-failure.png`,fullPage:true});
 failSummary=false;failMeetings=false;
 await refresh.click();await page.waitForLoadState('networkidle'); await refresh.waitFor();
 assert.ok((await metrics.innerText()).includes('$250.00'));
 failSummary=true;
 await page.getByRole('button',{name:/Reporting period:/}).click();
 await refresh.waitFor();
 await page.waitForLoadState('networkidle'); await refresh.waitFor();
 assert.ok(!(await metrics.innerText()).includes('$250.00'),'period switch kept previous totals');
 failSummary=false;
 await page.getByRole('button',{name:/Reporting period:/}).click();
 await page.waitForLoadState('networkidle'); await refresh.waitFor();
 await page.getByRole('button',{name:'Supporter relationships',exact:true}).click();
 await page.getByRole('heading',{name:'Donor retention',exact:true}).waitFor();
 await page.getByRole('button',{name:/Show .* widgets/}).click();
 await page.locator('#dashboard-detailed-insights').waitFor();
 await writeFile(`${evidence}/checks.json`,JSON.stringify({errors,checks:['five responsive widths','metric cards do not overflow','task filter survives refresh','partial core failures isolated','failed summary clears stale totals','meeting failure retry','recovery','relationship focus','detailed insights','failed reporting period switch clears previous totals']},null,2));
 assert.deepEqual(errors,[]);
 console.log('Dashboard refactor checks passed');
} catch (error) {
 await page.screenshot({path:`${evidence}/failure.png`,fullPage:true});
 console.error({url:page.url(),errors,body:(await page.locator("body").innerText()).slice(0,1600)});
 throw error;
} finally { await browser.close(); }

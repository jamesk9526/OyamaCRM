import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const evidence = 'docs/status/audit-artifacts/2026-11-01-fiscal-audit';
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
await page.clock.install({time:new Date('2026-07-01T00:30:00Z')});
let retentionFails=false;
const fiscalReads=[];
await page.addInitScript(hidden => {
 localStorage.setItem('oyama-reporting-year-mode','calendar');
 localStorage.setItem('dashboard-hidden-widgets',JSON.stringify(hidden));
}, ['at-a-glance', 'donor-pipeline', 'actionable-insights', 'ai-insights', 'ai-opportunities', 'ai-chat', 'goal-health', 'campaign-scorecard', 'donation-velocity', 'engagement-pulse', 'workflow-pressure', 'follow-up-capacity', 'stewardship-attention', 'top-donors', 'weekly-stats', 'monthly-donors', 'designation-mix', 'recurring-giving-health', 'giving-trend', 'recent-donations', 'tasks', 'meetings']);
await page.route('**/api/settings',route=>route.fulfill({json:{fiscalYearStart:7,fiscalYearEnd:6}}));
await page.route('**/api/reports/summary**',route=>{
 const fiscal=new URL(route.request().url()).searchParams.get('dateBasis')==='fiscal';
 fiscalReads.push(route.request().url());
 return route.fulfill({json:{ytdAmount:fiscal?100:250,monthAmount:100,totalConstituents:4,activeCampaigns:0,activeGoalTotal:1000,pendingTasks:0,overdueTasks:0,newDonorsThisMonth:0,period:{basis:fiscal?'fiscal':'calendar',year:fiscal?2027:2026,label:fiscal?'FY 2027':'2026',from:fiscal?'2026-07-01T00:00:00.000Z':'2026-01-01T00:00:00.000Z',through:'2026-07-01T00:30:00.000Z',monthFrom:'2026-07-01T00:00:00.000Z',monthThrough:'2026-07-01T00:30:00.000Z'}}});
});
await page.route('**/api/reports/donor-retention**',route=>retentionFails?route.fulfill({status:503,json:{error:{message:'Retention offline'}}}):route.fulfill({json:{total:10,retained:4,rate:40}}));
try {
 await page.goto(base+'/',{waitUntil:'networkidle'});
 const metrics=page.getByRole('region',{name:'Performance summary'});
 await page.getByRole('button',{name:'Refresh',exact:true}).waitFor();
 await page.getByRole('button',{name:/Reporting period:/}).click();
 await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:/Reporting period: FY 2027/}).waitFor();
 await metrics.getByText('$100.00',{exact:true}).first().waitFor();
 const href=await metrics.getByRole('link').first().getAttribute('href');
 assert.ok(href.includes('from=2026-07-01'),href);
 assert.ok(fiscalReads.some(url=>url.includes('dateBasis=fiscal')));
 await page.getByRole('button',{name:/Show .* widgets/}).click();
 await page.getByText('Linear estimate based on completed giving',{exact:false}).waitFor();
 retentionFails=true;
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'Retry insight',exact:true}).waitFor();
 await page.screenshot({path:`${evidence}/fiscal-failure-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:1000});
 await page.screenshot({path:`${evidence}/fiscal-mobile.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await writeFile(`${evidence}/checks.json`,JSON.stringify({errors,fiscalReads,checks:['FY 2027 label for July 2026 start','fiscal summary API query','matching gifts date link','fiscal forecast interval','unavailable retention insight with retry','mobile overflow']},null,2));
 assert.deepEqual(errors,[]);
 console.log('Fiscal dashboard browser checks passed');
} finally {await browser.close();}

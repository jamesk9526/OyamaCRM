import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const evidence = 'docs/status/audit-artifacts/2026-11-01-v2-workspace';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(45000);
const errors = [], reads = [], checks = [], dashboardReads = [];
page.on('console',msg=>{if(msg.text().startsWith('V2ERR')) console.error(msg.text());});
await page.addInitScript(()=>window.addEventListener('error',e=>console.error('V2ERR',e.message,e.filename,e.lineno,e.colno)));
page.on('pageerror', error => errors.push(`${error.message} ${error.stack ?? ''}`));
// Buffer large development chunks before browser delivery; dev streaming can truncate a cold response.
await page.route('**/_next/static/**', async route => {
 for(let attempt=0;attempt<3;attempt++) {
  try {
   const response=await fetch(route.request().url());
   const body=Buffer.from(await response.arrayBuffer());
   await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/javascript',body});
   return;
  } catch(error) { if(attempt===2) {console.error('Static chunk transport failed',String(error));await route.abort();} }
 }
});
await page.route('**/api/**', route => route.fulfill({ json: { items: [], unreadCount: 0 } }));
await installDonorWorkspaceFixtures(page);
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/reports/new-donors') { dashboardReads.push(url.pathname); return route.fulfill({ json: { items: [], total: 0, totalPages: 0 } }); }
  if (url.pathname === '/api/notifications') { dashboardReads.push(url.pathname); return route.fulfill({ json: { items: [], unreadCount: 0 } }); }
  if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: { data: { accessToken: 'synthetic-fixture' } } });
  if (url.pathname === '/api/auth/me') return route.fulfill({ json: { data: { id: 'qa-admin', organizationId: 'qa-org', firstName: 'QA', lastName: 'Admin', role: 'admin', email: 'qa@example.invalid' } } });
  if (url.pathname === '/api/search') return route.fulfill({json:{module:'donor',query:url.searchParams.get('q'),results:[]}});
  if (url.pathname === '/api/setup/status') return route.fulfill({ json: { setupComplete: true } });
  if (route.request().method() !== 'GET') return route.fulfill({ status: 405, json: { error: { message: 'Business writes disabled' } } });
  if (url.pathname === '/api/notifications/sse') return route.fulfill({ contentType: 'text/event-stream', body: '' });
  return route.fallback();
});
await page.addInitScript(()=>localStorage.setItem('oyama:release:2.0:qa-org:qa-admin','seen'));
try {
 await page.goto(base+'/constituents',{waitUntil:'networkidle'});
 const table=page.locator('#constituent-table');
 await table.waitFor();
 assert.equal(await page.getByRole('button',{name:'Open Steward workspace',exact:true}).count(),0);
 await page.waitForFunction(()=>document.querySelector('#constituent-table')?.dataset.spreadsheet==='true');
 await page.mouse.move(100,200);
 await page.screenshot({path:`${evidence}/constituents-desktop.png`,fullPage:true,animations:"disabled"});
 const dock=page.locator('.workspace-command-dock');
 await dock.getByRole('button',{name:/Expand .* commands/}).hover();
 await page.getByRole('navigation',{name:'Page actions'}).waitFor();
 await page.screenshot({path:`${evidence}/command-dock-expanded.png`,fullPage:true,animations:"disabled"});
 await page.keyboard.press('Escape');
 const cell=table.locator('tbody tr').first().locator('td').nth(1);
 await cell.click({position:{x:8,y:8}});
 await page.keyboard.press('ArrowRight');
 await page.keyboard.press('Shift+ArrowRight');
 assert.ok(await table.locator('[data-sheet-selected=true]').count()>=2);
 const copied=await page.evaluate(()=>{const clipboardData=new DataTransfer();document.activeElement.dispatchEvent(new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData}));return clipboardData.getData('text/plain');});
 assert.ok(copied.includes('\t'),copied);
 await cell.scrollIntoViewIfNeeded();
 await page.screenshot({path:`${evidence}/spreadsheet-selection.png`,fullPage:true,animations:"disabled"});
 const header=table.locator('thead th').nth(1);
 const before=await header.boundingBox();
 await page.mouse.move(before.x+before.width-2,before.y+before.height/2);
 await page.mouse.down();await page.mouse.move(before.x+before.width+60,before.y+before.height/2);await page.mouse.up();
 const after=await header.boundingBox();
 assert.ok(after.width>before.width+30,`resize ${before.width} to ${after.width}`);
 const comfortable=await cell.boundingBox();
 await page.getByRole('button',{name:'Compact rows',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-density=compact]'));
 const compact=await cell.boundingBox();
 assert.ok(compact.height<comfortable.height,`row density ${comfortable.height} to ${compact.height}`);
 await page.screenshot({path:`${evidence}/spreadsheet-compact.png`,fullPage:true,animations:"disabled"});
 await page.locator('a[href="/donations"]:visible').first().click();
 await page.waitForURL(base+'/donations');
 await page.locator('table[data-spreadsheet=true]:visible').first().waitFor();
 await page.locator('table[data-spreadsheet=true]:visible').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:`${evidence}/donations-desktop.png`,fullPage:true,animations:'disabled'});
 await page.locator('a[href="/"]:visible').first().click();
 await page.waitForURL(base+'/',{waitUntil:'domcontentloaded'});
 await page.getByRole('region',{name:'Performance summary'}).waitFor();
 await page.getByRole('button',{name:'Refresh',exact:true}).waitFor();
 await page.waitForFunction(()=>document.getElementById('crm-main-content')?.scrollTop===0);
 await page.screenshot({path:`${evidence}/dashboard-desktop.png`,fullPage:true,animations:"disabled"});
 await page.setViewportSize({width:390,height:1000});
 await page.screenshot({path:`${evidence}/dashboard-mobile.png`,fullPage:true,animations:"disabled"});
 await page.getByRole('button',{name:/Expand .* commands/}).dispatchEvent('click');
 await page.getByRole('navigation',{name:'Page actions'}).waitFor();
 await page.screenshot({path:`${evidence}/command-dock-mobile.png`,fullPage:true,animations:"disabled"});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('a[href="/constituents"]:visible').first().click();
 await page.waitForURL(base+'/constituents');
 await page.getByRole('heading',{name:'Constituents',exact:true}).waitFor();
 await page.screenshot({path:`${evidence}/constituents-mobile.png`,fullPage:true,animations:"disabled"});
 await writeFile(`${evidence}/checks.json`,JSON.stringify({errors,copied,checks:['command dock hover and Escape','cell navigation','range selection and TSV copy','column resize','row density reduces height','donations table enhancement','desktop/mobile screenshot captures','mobile overflow']},null,2));
 assert.deepEqual(errors,[]);
 console.log('V2 workspace checks passed');
} catch(error) {await page.screenshot({path:`${evidence}/failure.png`,fullPage:true,animations:"disabled"});throw error;}
finally {await browser.close();}

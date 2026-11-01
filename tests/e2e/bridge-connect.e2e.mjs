import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const evidence = 'docs/status/audit-artifacts/2026-11-01-bridge-pairing';
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
const configuration={enabled:true,mode:'remote',endpointUrl:'https://bridge.example.invalid',model:'qwen3.5:9b',thinkingModel:'qwen3.5:9b',reasoningMode:'standard',agenticMultiStage:false,chatHeadEnabled:false,temperature:0.3,maxTokens:600,timeoutMs:120000,systemPrompt:'Steward',hasApiKey:true};
await page.route('**/api/steward-ai/config',r=>r.fulfill({json:{data:configuration}}));
await page.route('**/api/steward-ai/memory/preferences',r=>r.fulfill({json:{data:{memoryEnabled:true,fileContextEnabled:true}}}));
await page.route('**/api/steward-ai/memories**',r=>r.fulfill({json:{data:[]}}));
await page.route('**/api/steward-ai/context-files**',r=>r.fulfill({json:{data:[]}}));
let connects=0;
await page.route('**/api/steward-ai/bridge/connect',r=>{connects++;return r.fulfill({json:{data:{connected:true,config:configuration}}});});
const payload={endpoint:'https://bridge.example.invalid',apiKey:'synthetic-test-key-12345',model:'qwen3.5:9b'};
const token=Buffer.from(JSON.stringify(payload)).toString('base64url')+'.signature';
try {
 await page.goto(base+'/settings/ai#bridgePair='+token,{waitUntil:'networkidle'});
 await page.getByText('Desktop endpoint:',{exact:false}).waitFor();
 assert.equal(connects,0,'handoff must be reviewed before settings change');
 assert.equal(new URL(page.url()).hash,'','credential removed from visible URL');
 await page.getByRole('button',{name:'Verify and connect',exact:true}).click();
 await page.getByText('Desktop bridge connected. Endpoint, key, and selected models were verified and saved.',{exact:true}).waitFor();
 assert.equal(connects,1);
 await page.screenshot({path:`${evidence}/crm-connected-desktop.png`,fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`${evidence}/crm-connected-mobile.png`,fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);
 await writeFile(`${evidence}/crm-checks.json`,JSON.stringify({fixtureData:true,errors,connects,checks:['fragment captured and removed','explicit review before connect','single verified connect','successful config refresh','desktop/mobile screenshots']},null,2));
} finally {await browser.close();}

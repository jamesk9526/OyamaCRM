import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const evidence = 'docs/status/audit-artifacts/2026-11-01-steward-v2';
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
let requestCount=0;
await page.route('**/api/steward-ai/memories',route=>route.fulfill({json:{data:[]}}));
await page.route('**/api/steward-ai/memory/preferences',route=>route.fulfill({json:{data:{memoryEnabled:true}}}));
await page.route('**/api/steward-feedback',route=>{if(route.request().method()==='GET')return route.fulfill({json:{data:{items:[{id:'qa-report',createdAt:'2026-11-01T12:00:00Z',metadata:{rating:'down',reason:'incorrect',source:'crm',note:'Synthetic QA improvement report.'}}]}}});const body=route.request().postDataJSON();assert.equal(body.reason,'incorrect');assert.equal(body.excerpt,'');return route.fulfill({json:{data:{saved:true,reportId:body.reportId}}});});
await page.route('**/api/steward-ai/playbooks', route=>route.fulfill({json:{data:{playbooks:[{id:'tasks',title:'Create a follow-up task',terms:['tasks'],path:'/tasks',steps:'Use New Task, choose an owner, and review before saving.'}]}}}));
await page.route('**/api/steward-ai/chat/stream', async route=>{
 requestCount++;
 const payload=route.request().postDataJSON();
 assert.ok(payload.messages.every(item=>['user','assistant'].includes(item.role)));
 if(payload.messages.at(-1).content==='trigger failure')return route.fulfill({status:503,json:{error:{message:'Runtime unavailable. Retry shortly.'}}});
 return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'chunk',delta:'Reviewed workflow: verify the reporting period.'})+'\n'+JSON.stringify({type:'done',reply:'Reviewed workflow: verify the reporting period.',provider:'playbook',model:'reviewed-playbook',toolsUsed:['playbook.fiscal']})+'\n'});
});
try {
 await page.goto(base+'/',{waitUntil:'networkidle'});
 const launcher=page.getByRole('button',{name:'Open Steward AI chat',exact:true});
 await launcher.click();
 const panel=page.getByRole('dialog',{name:'Steward AI assistant'});
 await panel.waitFor();
 await page.screenshot({path:`${evidence}/chathead-desktop.png`,fullPage:true,animations:"disabled"});
 await panel.getByRole('button',{name:'Explain fiscal year',exact:true}).click();
 await panel.getByText('Reviewed workflow: verify the reporting period.',{exact:true}).waitFor();
 assert.equal(requestCount,1);
 await panel.getByRole('button',{name:'Unhelpful response',exact:true}).click();
 await panel.getByLabel('Details (optional)').fill('Synthetic QA feedback');
 await panel.getByRole('button',{name:'Submit feedback',exact:true}).click();
 await panel.getByText('Saved to the improvements log.',{exact:true}).waitFor();
 await page.screenshot({path:`${evidence}/chathead-response-desktop.png`,fullPage:true,animations:"disabled"});
 await panel.getByRole('tab',{name:'Quick actions'}).click();
 await panel.getByText('Create a follow-up task',{exact:true}).waitFor();
 await page.screenshot({path:`${evidence}/chathead-actions-desktop.png`,fullPage:true,animations:"disabled"});
 await panel.getByRole('tab',{name:'Insights'}).click();
 assert.ok(await panel.getByText('No insights are assumed before checking your data.',{exact:false}).isVisible());
 await panel.getByRole('tab',{name:'Chat',exact:true}).click();
 await panel.getByRole('textbox',{name:'Your message to Steward'}).fill('trigger failure');
 await panel.getByRole('button',{name:'Send message'}).click();
 await panel.getByRole('alert').filter({hasText:'Runtime unavailable'}).waitFor();
 await panel.getByRole('button',{name:'New conversation'}).click();
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const bounds=await panel.boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,JSON.stringify({width,bounds}));
 }
 await page.setViewportSize({width:390,height:900});
 await page.screenshot({path:`${evidence}/chathead-mobile.png`,fullPage:true,animations:"disabled"});
 await panel.getByRole('textbox').focus();await page.keyboard.press('Escape');
 assert.equal(await panel.count(),0);
 assert.equal(await launcher.evaluate(el=>el===document.activeElement),true);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('steward:open-with-prompt',{detail:{prompt:'Explain fiscal year',mode:'help'}})));
 await panel.getByText('Reviewed workflow: verify the reporting period.',{exact:true}).waitFor();
 assert.equal(requestCount,3);
 await panel.getByRole('button',{name:'Close Steward',exact:true}).click();
 await page.goto(base+'/settings/ai/improvements',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Master improvements log',exact:true}).waitFor();
 await page.getByText('Synthetic QA improvement report.',{exact:true}).waitFor();
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:`${evidence}/master-improvements-desktop.png`,fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`${evidence}/master-improvements-mobile.png`,fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);
 await writeFile(`${evidence}/checks.json`,JSON.stringify({errors,fixtureData:true,requestCount,checks:['launcher open/close and Escape focus return','single request per shortcut','NDJSON response rendering','quick action catalog','insights have no invented numbers','503 error state','new conversation','contextual event','four responsive widths']},null,2));
} finally { await browser.close(); }

import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const dir='docs/status/audit-artifacts/2026-11-05-mountain-loader';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {
for (const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 let releaseSettings, releaseReport;
 const settingsGate=new Promise(r=>releaseSettings=r);
 const reportGate=new Promise(r=>releaseReport=r);
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body={items:[],unreadCount:0};
  if(path==='/api/auth/refresh') body={data:{accessToken:'synthetic-qa'}};
  if(path==='/api/auth/me') body={data:{id:'qa-loader',organizationId:'qa',firstName:'QA',lastName:'Loader',role:'admin',email:'qa@example.invalid'}};
  if(path==='/api/settings/workspaces') {await settingsGate;body={};}
  if(path==='/api/setup/status') body={setupComplete:true};
  if(path==='/api/designations') body=[];
  if(path.includes('/api/reports/library/')) {await reportGate;return route.fulfill({status:503,json:{error:{message:'Synthetic QA report failure'}}});}
  if(path==='/api/notifications/sse') return route.fulfill({contentType:'text/event-stream',body:''});
  return route.fulfill({json:body});
 });
 await page.goto('http://localhost:3000/reports?report=donations',{waitUntil:'domcontentloaded'});
 const splash=page.getByRole('status').filter({hasText:'Loading your workspace'});
 await splash.waitFor();
 await page.screenshot({path:`${dir}/workspace-${width}.png`});
 releaseSettings();
 const report=page.getByRole('status').filter({hasText:'Preparing your report'});
 await report.waitFor();
 await report.scrollIntoViewIfNeeded();
 const sun=report.locator('svg g');
 const animation=await sun.evaluate(el=>getComputedStyle(el).animationTimingFunction);
 assert.equal(animation,'ease-in-out');
 assert.equal(await report.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:`${dir}/report-${width}.png`});
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await sun.evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.screenshot({path:`${dir}/reduced-motion-${width}.png`});
 releaseReport();
 await report.waitFor({state:'hidden'});
 await page.getByText('Synthetic QA report failure',{exact:false}).first().waitFor();
 results.push({width,easing:animation,reducedMotion:'none',reportFailureClearsLoader:true});
 await page.close();
}
await writeFile(`${dir}/checks.json`,JSON.stringify({data:'Synthetic browser-only API fixtures; no business writes',results},null,2));
console.log(JSON.stringify(results));
} finally {await browser.close();}

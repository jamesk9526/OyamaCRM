import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';
const evidence='docs/status/audit-artifacts/2026-11-05-workspace-switcher';
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(20000);
const errors=[],checks=[];
let role='admin', surveyError=false;
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',r=>r.fulfill({json:{items:[],unreadCount:0}}));
await installDonorWorkspaceFixtures(page);
await page.route('**/api/**',async r=>{
 const path=new URL(r.request().url()).pathname;
 const send=(json,status=200)=>r.fulfill({json,status});
 if(path==='/api/auth/refresh')return send({data:{accessToken:'synthetic-test-token'}});
 if(path==='/api/auth/me')return send({data:{id:'synthetic-user',organizationId:'synthetic-org',firstName:'Sample',lastName:'Staff',role,email:'sample@example.invalid'}});
 if(path==='/api/setup/status')return send({setupComplete:true});
 if(path==='/api/settings/workspaces')return send({donorEnabled:true,showModuleSwitcher:true,defaultWorkspace:'donor',donorNavigationLayout:'sidebar',donorAccentTone:'blue'});
 if(path==='/api/surveys/access'||path==='/api/compassion/surveys/access')return surveyError?send({error:{message:'Synthetic unavailable'}},503):send({DONOR:role==='compassion_user'?[]:['view'],CLIENT:role==='compassion_user'?['view']:[]});
 if(path==='/api/quickbooks/status')return send({data:{configured:true,enabled:true,connected:true,summary:{pending:2,failed:1,lastSuccessfulSync:null},timezone:'America/Chicago'}});
 if(path==='/api/notifications/sse')return r.fulfill({contentType:'text/event-stream',body:''});
 return r.fallback();
});
try{
 await page.goto('http://127.0.0.1:3000/donations',{waitUntil:'networkidle',timeout:120000});
 await page.locator('[data-topbar-root="true"]').waitFor();
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:900});
  const trigger=page.getByRole('button',{name:'Switch workspace',exact:true}).filter({visible:true});
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Switch workspace',exact:true});
  await dialog.getByRole('button',{name:/QuickBooks/}).waitFor();
  await dialog.getByRole('button',{name:/Surveys/}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Find a workspace'}).evaluate(el=>document.activeElement===el),true);
  await page.screenshot({path:`${evidence}/after-${width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);
  const bounds=await dialog.boundingBox();assert(bounds.x>=0 && bounds.x+bounds.width<=width+1);
  await page.getByRole('textbox',{name:'Find a workspace'}).fill('quick');
  assert.equal(await dialog.locator('[data-workspace-choice]').count(),1);
  await page.keyboard.press('ArrowDown');
  assert.match(await page.evaluate(()=>document.activeElement.textContent),/QuickBooks/);
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
  checks.push(`width ${width}: direct topbar access, searchable QuickBooks choice, keyboard browsing, Escape focus restoration, no overflow`);
 }
 await page.setViewportSize({width:1440,height:900});
 await page.getByRole('button',{name:'Switch workspace',exact:true}).filter({visible:true}).click();
 const dialog=page.getByRole('dialog',{name:'Switch workspace',exact:true});
 await page.getByRole('textbox',{name:'Find a workspace'}).fill('nothing-matches');
 await dialog.getByRole('status').waitFor();
 await page.keyboard.press('Tab');
 assert(await dialog.evaluate(el=>el.contains(document.activeElement)));
 await page.keyboard.press('Escape');
 checks.push('Search empty state and focus containment');
 // Permission fixtures exercise visibility without any application writes.
 for(const nextRole of ['readonly']){
  role=nextRole;
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'}); await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Switch workspace',exact:true}).filter({visible:true}).click();
  assert.equal(await page.getByRole('dialog',{name:'Switch workspace'}).getByRole('button',{name:/QuickBooks/}).count(),0);
  await page.keyboard.press('Escape');
  checks.push(`${role}: QuickBooks hidden`);
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${evidence}/checks.json`,JSON.stringify({data:'Synthetic browser-only API fixtures; no real accounting writes',checks,errors},null,2));
 console.log('Workspace switcher browser checks passed');
}catch(error){console.log(await page.locator("body").innerText());await page.screenshot({path:`${evidence}/failure.png`});throw error;}finally{await browser.close();}


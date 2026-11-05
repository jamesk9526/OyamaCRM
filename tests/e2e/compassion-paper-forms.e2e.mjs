/** Synthetic browser acceptance checks; no real client records or outbound communications. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import templateModule from '../../server/src/compassion/form-templates.ts';
const { FORM_TEMPLATES } = templateModule;
const base=process.env.COMPASSION_UI_WEB||'http://127.0.0.1:6381';
const evidence='docs/status/audit-artifacts/2026-11-05-compassion-paper-forms';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1080},timezoneId:'America/Chicago'});const page=await context.newPage();
const errors=[],checks=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
let role='ADMIN';let failSave=false;let revision=0;const records=new Map();const documents=[];
const client={id:'paper-client',firstName:'Avery',lastName:'Morgan',clientStatus:'ACTIVE',intakeDate:'2026-11-01T12:00:00Z',dateOfBirth:'1998-04-10T00:00:00Z',phone:'555-0110',email:'avery@example.invalid',cases:[{id:'paper-case',caseNumber:'CASE-TEST',caseStatus:'OPEN',summary:'Synthetic care case'}],appointments:[],safeContact:{phone:false,email:false,sms:false,voicemail:false},_count:{cases:1,appointments:0}};
const capabilities=['records','schedule','casework','clinical','export','manage','messages'];
await context.route('**/api/**',async route=>{
 const req=route.request();const url=new URL(req.url());const path=url.pathname;requests.push(`${req.method()} ${path}`);const send=(body,status=200)=>route.fulfill({status,json:body});
 if(path==='/api/auth/refresh')return send({data:{accessToken:'synthetic-ui-token'}});
 if(path==='/api/auth/me')return send({data:{id:'paper-author',organizationId:'synthetic-paper-org',firstName:'Taylor',lastName:'Reed',email:'taylor@example.invalid',role:'admin'}});
 if(path==='/api/compassion/access')return send({allowed:true,role,capabilities:role==='RECEPTION'?['records','schedule','messages']:capabilities});
 if(path==='/api/compassion/clients/paper-client')return send(client);
 if(path==='/api/compassion/clients')return send(url.searchParams.has('includeMeta')?{items:[client],page:1,pageSize:50,totalCount:1,totalPages:1}:[client]);
 if(path==='/api/compassion/clients/paper-client/forms')return send([...records.values()].map(r=>({...r,recordType:r.kind==='HEALTH_PREGNANCY_INTAKE'?'chart':'casework'})));
 if(path==='/api/compassion/staff')return send([{id:'staff',firstName:'Taylor',lastName:'Reed'}]);
 if(path==='/api/compassion/visits')return send([]);
 if(path==='/api/compassion/documentation-queue')return send([]);
 if(path==='/api/compassion/documents')return send(documents);
 if(path==='/api/compassion/case-forms' || path==='/api/compassion/charts'){
   if(req.method()==='POST'){if(failSave)return send({error:{message:'Synthetic save unavailable'}},503);const body=req.postDataJSON();const id=`paper-record-${++revision}`;const row={...body,id,authorId:'paper-author',version:1,status:'DRAFT',updatedAt:new Date().toISOString(),createdAt:new Date().toISOString()};records.set(id,row);return send({id,...row},201);}return send([]);
 }
 if(/^\/api\/compassion\/(case-forms|charts)\/paper-record-\d+$/.test(path)){
  const id=path.split('/').at(-1);const row=records.get(id);if(req.method()==='PATCH'){if(failSave)return send({error:{message:'Synthetic save unavailable'}},503);const body=req.postDataJSON();Object.assign(row,body,{version:row.version+1,updatedAt:new Date().toISOString()});return send(row);}return send(row);
 }
 if(path.endsWith('/documents')||path.endsWith('/revisions'))return send([]);
 if(path==='/api/compassion/reports/definitions')return send([]);
 if(path==='/api/compassion/reports/monthly')return send({definitionVersion:0,columns:['A2A','B.C.','FOB at visit','Birth','Pregnant','Spiritual'].map((label,i)=>({key:String(i),label,configured:false})),rows:[],totals:{appointments:0,noShows:0,rescheduled:0,attendedVisits:0,completedVisits:0,uniqueClients:0,supplies:0,metrics:{}},rules:'Synthetic report: actual visits only. Unconfigured totals are not inferred.'});
 if(path==='/api/compassion/today')return send({activeClients:1,activeCases:1,pendingApprovals:0,incompleteIntake:0,appointments:[],followUps:[]});
 if(path==='/api/compassion/ultrasounds')return send({items:[],total:0,page:1,pageSize:25,counts:{DRAFT:0,REVIEW:0,SIGNED:0}});
 if(path==='/api/compassion/follow-ups')return send([]);
 if(path==='/api/compassion/appointments')return send([]);
 return send({error:{message:`Unexpected synthetic request: ${path}`}},404);
});
async function go(path){await page.goto(base+path,{waitUntil:'networkidle'});}
async function overflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'page overflow');}
try{
 await go('/compassion/clients/paper-client?tab=forms');await page.getByRole('heading',{name:'Avery Morgan',exact:true}).waitFor();await page.screenshot({path:`${evidence}/client-file-1440.png`,fullPage:true});await overflow();checks.push('Client file tabs, light sidebar, grouped record entry and scoped forms');
 for(const kind of ['CASE_INTAKE','HEALTH_PREGNANCY_INTAKE']){
  await go(`/compassion/clients/paper-client/forms/new?kind=${kind}`);await page.locator('.paper-page').first().waitFor();assert.equal(await page.locator('.paper-page').count(),3);
  const fieldCount=FORM_TEMPLATES[kind].pages.flat().flatMap(s=>s.fields).length;assert.equal(await page.locator('.paper-field,.paper-choice-field').count(),fieldCount);
  for(const section of FORM_TEMPLATES[kind].pages.flat())for(const field of section.fields){if(field.options){const labels=await page.locator(`input[name="paper-${field.key}"]`).evaluateAll(inputs=>inputs.map(input=>input.parentElement.textContent.trim()));assert.deepEqual(labels,field.options);}}
  await page.locator('.paper-page').first().screenshot({path:`${evidence}/${kind.toLowerCase()}-page1-1440.png`});await overflow();
  await page.emulateMedia({media:'print'});await page.pdf({path:`${evidence}/${kind.toLowerCase()}-print.pdf`,preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
  checks.push(`${kind}: all fields/choices rendered in three source pages; print proof captured`);
 }
 await go('/compassion/clients/paper-client/forms/new?kind=CASE_INTAKE');await page.locator('#paper-firstName').fill('Synthetic');await page.locator('#paper-lastName').fill('Entry');
 failSave=true;await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic save unavailable'}).waitFor();assert.equal(await page.locator('#paper-firstName').inputValue(),'Synthetic');failSave=false;
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForURL(/forms\/paper-record-/);await page.locator('#paper-firstName').waitFor();assert.equal(await page.locator('#paper-firstName').inputValue(),'Synthetic');checks.push('Paper entry retains edits after failed save; draft persists and resumes');
 await page.locator('#paper-firstName').fill('Updated');await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('status').filter({hasText:'Draft saved securely.'}).waitFor();assert.equal(records.values().next().value.version,2);checks.push('Existing draft saves a revision');
 await page.locator('input[name="paper-phonePermission"]').first().check();
 assert.equal(await page.locator('input[name="paper-phonePermission"]').first().isChecked(),true);
 page.removeAllListeners('dialog');let prompted=false;page.on('dialog',async d=>{prompted=true;await d.dismiss();});
 await page.getByRole('link',{name:'Client file',exact:false}).first().click();assert.equal(prompted,true);assert.match(page.url(),/forms\/paper-record-/);
 page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('status').filter({hasText:'Draft saved securely.'}).waitFor();
 checks.push('Checkbox entry and cancellation of unsaved navigation');
 await page.locator('#paper-outsideHelp').fill('Synthetic continuation detail. '.repeat(30));
 await page.emulateMedia({media:'print'});await page.pdf({path:`${evidence}/case-long-answer-print.pdf`,preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
 assert.equal(await page.locator('.paper-continuation').count(),1);checks.push('Long paper answers receive an explicit continuation page');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('status').filter({hasText:'Draft saved securely.'}).waitFor();
 await page.setViewportSize({width:768,height:1024});await page.screenshot({path:`${evidence}/case-intake-768.png`,fullPage:true});await overflow();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${evidence}/case-intake-390.png`,fullPage:true});await overflow();await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('link',{name:'Client Files',exact:true}).waitFor();await page.keyboard.press('Escape');checks.push('Tablet/mobile form wrapping, confined viewport, navigation dismissal');
 await page.locator('#paper-firstName').focus();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle!=='none'));checks.push('Keyboard focus remains visible');
 await page.setViewportSize({width:1440,height:1080});await go('/compassion/reports');await page.getByRole('heading',{name:'Monthly statistics',exact:true}).waitFor();await page.getByText('Not configured — no total is inferred.').first().waitFor();await page.screenshot({path:`${evidence}/monthly-register-1440.png`,fullPage:true});checks.push('Empty monthly register explains source rules and unconfigured columns');
 role='RECEPTION';await go('/compassion/clients/paper-client/forms/new?kind=HEALTH_PREGNANCY_INTAKE');await page.getByRole('alert').filter({hasText:'Your role cannot open this form.'}).waitFor();assert.equal(await page.locator('.paper-page').count(),0);checks.push('Reception cannot render the clinical form');
 assert.deepEqual(errors,[]);await writeFile(`${evidence}/ui-checks.json`,JSON.stringify({synthetic:true,checks,errors,requests},null,2));console.log(JSON.stringify({checks,errors}));
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true});console.error(JSON.stringify({url:page.url(),errors,body:(await page.locator('body').innerText()).slice(0,2200)}));throw error;}finally{await browser.close();}


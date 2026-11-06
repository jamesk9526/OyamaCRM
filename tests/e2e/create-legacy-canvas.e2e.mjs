import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='docs/status/audit-artifacts/2026-11-05-create-legacy-canvas';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 let template={id:'old-letter',name:'Original November Letter',status:'DRAFT',category:'GENERAL',printBody:'<p>Dear {first} {last},</p><p>Thank you for {{donation.amount}}.</p>',printLayoutJson:{},printSubject:'Thank you'};
 const permissions=['letters.view','letters.edit','letters.create','edit:communications','view:communications'];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,json=(body,status=200)=>route.fulfill({json:body,status});
  if(path==='/api/auth/refresh')return json({data:{accessToken:'synthetic'}});
  if(path==='/api/auth/me')return json({data:{id:'qa',organizationId:'qa-org',firstName:'QA',lastName:'Admin',role:'admin'}});
  if(path==='/api/oyama-create/bootstrap')return json({enabled:true,permissions,capabilities:[]});
  if(path==='/api/letters/production/config')return json({enabled:false});
  if(path==='/api/letters/templates/old-letter'){
   if(route.request().method()==='PATCH'){Object.assign(template,route.request().postDataJSON());writes.push(path);}
   return json(template);
  }
  if(path==='/api/letters/templates/old-letter/publish')return json({canPublish:true,blockers:[],errors:[],warnings:[],checks:[],branding:{}});
  if(path==='/api/letters/merge-fields')return json({sections:[{label:'Donor',fields:['{first}','{last}','{{donation.amount}}']}],validationFields:['{first}','{last}','{{donation.amount}}']});
  if(path==='/api/settings/branding')return json({organizationDisplayName:'Synthetic Foundation',globalHeaderHtml:'<p>Original branding header</p>'});
  if(path==='/api/oyama-create/campaigns/qa')return json({id:'qa',name:template.name,status:'DRAFT',objective:'GENERAL',isTemplate:true,revision:1,channelsJson:['LETTER'],audienceListIds:[],contents:[{id:'piece',name:template.name,campaignId:'qa',revision:1,documentJson:{version:1,blocks:[]},variants:[{channel:'LETTER',legacyId:template.id,revision:1,documentJson:{}}]}],releases:[]});
  if(path==='/api/oyama-create/contents/piece/studio')return json({error:{message:'Synthetic Studio fixture'}},503);
  if(path==='/api/oyama-create/imports/sources')return json({items:[]});
  if(route.request().method()!=='GET'){
   if(path==='/api/oyama-create/imports/ensure')return json({});
   if(path==='/api/oyama-create/legacy/import'){writes.push(path);return json({campaignId:'qa',contentId:'piece'});}
   return json({error:{message:'Unexpected test write '+path}},400);
  }
  return json([]);
 });
 await page.goto('http://localhost:3000/oyama-create/campaigns/qa',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Return to upgraded Create Studio',exact:true}).waitFor();
 const canvas=page.getByRole('region',{name:'Original OyamaCRM Letters canvas'});
 await page.screenshot({path:`${dir}/loading-${width}.png`});
 const editor=canvas.locator('[contenteditable="true"]').first();await editor.waitFor();
 await editor.scrollIntoViewIfNeeded();
 const canvasStyle=await canvas.locator('.letter-page').first().evaluate(el=>{const style=getComputedStyle(el);return {width:Math.round(parseFloat(style.width)),font:style.fontFamily,padding:style.padding};});
 const editorStyle=await editor.evaluate(el=>{const style=getComputedStyle(el);return {font:style.fontFamily,size:style.fontSize,lineHeight:style.lineHeight};});
 assert.ok((await editor.innerHTML()).includes('{first}'));
 await page.screenshot({path:`${dir}/canvas-${width}.png`});
 await editor.fill('Dear {first} {last}, updated synthetic letter.');
 const saves=canvas.getByRole('button',{name:/^Save(?: template)?$/i});
 await saves.first().click();
 await page.waitForFunction(()=>document.body.textContent.includes('Template saved.'));
 assert.ok(writes.includes('/api/letters/templates/old-letter'));assert.ok(writes.includes('/api/oyama-create/legacy/import'));
 await page.getByRole('button',{name:'Return to upgraded Create Studio',exact:true}).click();
 await page.getByRole('button',{name:'Use original Letters canvas',exact:true}).waitFor();
 await page.goto('http://localhost:3000/oyama-letters/templates/old-letter?legacy=1',{waitUntil:'networkidle'});
 const originalEditor=page.locator('[contenteditable="true"]').first();await originalEditor.waitFor();
 assert.deepEqual(await page.locator('.letter-page').first().evaluate(el=>{const style=getComputedStyle(el);return {width:Math.round(parseFloat(style.width)),font:style.fontFamily,padding:style.padding};}),canvasStyle);
 assert.deepEqual(await originalEditor.evaluate(el=>{const style=getComputedStyle(el);return {font:style.fontFamily,size:style.fontSize,lineHeight:style.lineHeight};}),editorStyle);
 await originalEditor.scrollIntoViewIfNeeded();
 await page.screenshot({path:`${dir}/standalone-${width}.png`});
 assert.deepEqual(errors,[]);results.push({width,originalCanvas:true,mergeTokensPreserved:true,savedOriginal:true,refreshCreate:true,studioStillAvailable:true});await page.close();
}await writeFile(`${dir}/checks.json`,JSON.stringify({fixtures:'Synthetic API records; no real sends or records',results},null,2));console.log(JSON.stringify(results));}finally{await browser.close();}

import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.QA_BASE_URL||'http://localhost:3000';
const dir='docs/status/audit-artifacts/2026-11-05-create-original-library';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 let failImport=true, imported=false;
 const originals=Array.from({length:45},(_,index)=>({id:`letter-${String(index).padStart(2,'0')}`,name:`Original letter ${index}`,channel:'LETTER',status:'ACTIVE',isTemplate:true,historical:false,campaignId:null,contentId:null,canImport:true}));
 originals[0].name='May 2026 Newletter';
 const email={...originals[0],id:'old-email',channel:'EMAIL',name:'May 2026 Newsletter — Email'};
 const permissions=['letters.view','letters.create','letters.edit','view:communications','edit:communications'];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,url=new URL(route.request().url());
  const json=(body,status=200)=>route.fulfill({status,json:body});
  if(path==='/api/auth/refresh')return json({data:{accessToken:'synthetic-test'}});
  if(path==='/api/auth/me')return json({data:{id:'qa-admin',organizationId:'qa-org',firstName:'QA',lastName:'Admin',role:'admin',email:'qa@example.invalid'}});
  if(path==='/api/oyama-create/bootstrap')return json({enabled:true,studioEnabled:true,permissions,capabilities:[]});
  if(route.request().method()!=='GET'){
   writes.push({path,body:route.request().postDataJSON()});
   if(path==='/api/oyama-create/imports/ensure')return json({});
   if(path==='/api/oyama-create/legacy/import'){
    if(failImport)return json({error:{message:'Synthetic import error; original retained'}},422);
    imported=true;return json({campaignId:'qa-imported',contentId:'qa-piece'},201);
   }
   return json({error:{message:'Unexpected test write'}},400);
  }
  if(path==='/api/oyama-create/legacy'){
   let items=url.searchParams.get('channel')==='EMAIL'?[email]:originals;
   if(url.searchParams.get('q'))items=items.filter(item=>item.name.includes(url.searchParams.get('q')));
   if(url.searchParams.get('id'))items=items.filter(item=>item.id===url.searchParams.get('id'));
   if(url.searchParams.get('after'))items=items.filter(item=>item.id>url.searchParams.get('after'));
   return json({items:items.slice(0,40),hasMore:items.length>40,nextCursor:items.length>40?items[39].id:null});
  }
  if(path==='/api/oyama-create/campaigns')return json({items:[],hasMore:false,nextCursor:null});
  if(path==='/api/oyama-create/campaigns/qa-imported')return json({id:'qa-imported',name:originals[0].name,objective:'GENERAL',status:'DRAFT',isTemplate:true,revision:1,channelsJson:['LETTER','EMAIL'],audienceListIds:[],contents:[{id:'qa-piece',campaignId:'qa-imported',name:originals[0].name,revision:1,documentJson:{version:1,blocks:[]},variants:[{channel:'LETTER',legacyId:originals[0].id,documentJson:{},revision:1}]}],releases:[]});
  if(path==='/api/oyama-create/imports/sources')return json({items:imported?[{id:'qa-source-letter',sourceType:'LETTER',name:originals[0].name},{id:'qa-source-email',sourceType:'EMAIL',name:email.name}]:[],nextCursor:null,total:0});
  if(path==='/api/oyama-create/imports')return json({run:{status:'IDLE',scanned:0},inventory:{total:0,statuses:{}}});
  if(path==='/api/oyama-create/contents/qa-piece/studio')return json({error:{message:'Synthetic editor fixture ends at source identity'}},503);
  return json([]);
 });
 await page.goto(base+'/oyama-create/library/legacy',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Content import & source library',exact:true}).waitFor();
 await page.screenshot({path:`${dir}/before-inventory-${width}.png`,fullPage:true});
 await page.getByRole('link',{name:'Create library',exact:true}).click();
 await page.getByRole('heading',{name:'Your creative library',exact:true}).waitFor();
 await page.screenshot({path:dir+'/library-'+width+'.png',fullPage:true});
 await page.getByRole('link',{name:'Import existing letters & emails',exact:true}).click();
 await page.getByText('May 2026 Newletter',{exact:true}).waitFor();
 await page.screenshot({path:`${dir}/originals-${width}.png`});
 if(width<600)assert.equal(await page.getByRole('region',{name:'Original letters and emails'}).evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.getByRole('button',{name:'Load more originals',exact:true}).click();
 await page.getByText('Original letter 44',{exact:true}).waitFor();
 await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname==='/api/oyama-create/legacy'&&new URL(response.url()).searchParams.get('q')==='Original letter 44'),page.getByRole('searchbox',{name:'Search original names'}).fill('Original letter 44')]);
 await page.getByText('Original letter 44',{exact:true}).waitFor();
 await page.getByRole('searchbox',{name:'Search original names'}).fill('');
 await page.getByText('May 2026 Newletter',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Source library'}).selectOption('EMAIL');
 await page.getByText(email.name,{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Source library'}).selectOption('LETTER');
 const row=page.getByRole('row').filter({hasText:'May 2026 Newletter'});
 await row.getByRole('button',{name:'Import to library',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Import to Create library'});
 await dialog.press('Escape');
 await dialog.waitFor({state:'hidden'});
 assert.equal(await row.getByRole('button',{name:'Import to library',exact:true}).evaluate(el=>el===document.activeElement),true);
 await row.getByRole('button',{name:'Import to library',exact:true}).click();
 await dialog.getByRole('button',{name:'Import and open'}).click();
 await dialog.getByText('Synthetic import error; original retained',{exact:true}).waitFor();
 failImport=false;
 await dialog.getByRole('button',{name:'Import and open'}).click();
 await page.waitForURL('**/oyama-create/campaigns/qa-imported?content=qa-piece');
 const names=page.getByLabel('Original source names');
 await names.getByText('Letter: May 2026 Newletter',{exact:true}).waitFor();
 await names.getByText('Email: '+email.name,{exact:true}).waitFor();
 await page.screenshot({path:`${dir}/imported-names-${width}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 assert.equal(writes.filter(item=>item.path==='/api/oyama-create/legacy/import').length,2);
 assert.equal(writes.some(item=>/release|send/.test(item.path)),false);
 results.push({width,search:true,pagination:true,errorRetry:true,exactOriginalNames:true,noDispatch:true});
 await page.close();
}
await writeFile(`${dir}/checks.json`,JSON.stringify({data:'Synthetic browser-only fixtures',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}

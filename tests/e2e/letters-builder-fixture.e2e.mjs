import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
const fixture='docs/status/audit-artifacts/2026-11-02-letter-builder';
const output=process.env.QA_ARTIFACT_DIR || fixture;
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1600,height:1050}});
async function capture(name) {
 await page.waitForFunction(() => {
  const workspace=document.querySelector('.lb-workspace');
  const toolbar=document.querySelector('[aria-label="Letter formatting"]');
  return workspace && toolbar && getComputedStyle(workspace).backgroundColor==='rgb(234, 242, 247)' && getComputedStyle(toolbar).display==='flex';
 },null,{timeout:30000});
 await page.addStyleTag({content:"nextjs-portal{display:none!important}"});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`${output}/${name}`,fullPage:true});
}
const errors=[]; page.on('pageerror',error=>errors.push(error.stack || error.message));
let template={id:'qa-template',name:'Community thank you',category:'GENERAL',revision:1,documentSchemaVersion:2,printSubject:'',printBody:'<h2>Thank you for your support</h2><p>Dear {{donor.firstName}},</p><p>Your generosity supports our community. We appreciate your partnership.</p>',printLayoutJson:{}};
let failSave=false; let failRender=true;
// Validate buffered dev chunks before delivery; do not confuse transport truncation with UI behavior.
await page.route('**/_next/static/**',async route=>{
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(route.request().url());
   const body=Buffer.from(await response.arrayBuffer());
   if(new URL(route.request().url()).pathname.endsWith('.js'))new Script(body.toString());
   await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/javascript',body});return;
  }catch(error){if(attempt===2)throw error;}
 }
});
await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;let body={};
 if(path.endsWith('/auth/refresh'))body={data:{accessToken:'qa-fixture-token'}};
 else if(path.endsWith('/auth/me'))body={id:'qa-user',organizationId:'qa-org',role:'ADMIN',firstName:'QA',lastName:'Staff',permissions:['*','letters.view','letters.edit','letters.generate','letters.create','letters.export_pdf']};
 else if(path.endsWith('/production/config'))body={enabled:true};
 else if(path.endsWith('/merge-fields'))body={sections:[{label:'Contact',fields:['{{donor.firstName}}','{{donor.lastName}}']},{label:'Donation',fields:['{{gift.amount}}','{{gift.date}}','{{gift.fund}}']}]};
 else if(path==='/api/constituents')body=[{id:'qa-contact',firstName:'Alexandra',lastName:'Example'}];
 else if(path==='/api/letters/templates/qa-template')body=template;
 else if(path==='/api/letters/production/templates/qa-template'){
  if(failSave)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:{message:'This template changed in another session.'}})});
  const incoming=route.request().postDataJSON();template={...template,...incoming,revision:template.revision+1};body=template;
 }else if(path==='/api/letters/production/jobs')body={id:'qa-job',status:failRender?'FAILED':'READY',revision:template.revision,error:failRender?'QA render failure: retry available':null};
 else if(path==='/api/letters/production/artifacts/qa-job/pdf')return route.fulfill({contentType:'application/pdf',body:await readFile(`${fixture}/multi-page-letter.pdf`)});
 else if(/signatures|header-presets|footer-presets/.test(path))body=[];
 else if(path.includes('/notifications'))body={items:[],unreadCount:0};
 else if(path.includes('/branding'))body={};
 else if(path.includes('/modules'))body=[];
 await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
});
try {
 await page.goto(`${process.env.E2E_WEB_BASE_URL || 'http://localhost:3000'}/oyama-letters/templates/qa-template/builder`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByRole('textbox',{name:'Letter content'}).waitFor({timeout:30000});
 await capture(`desktop.png`);
 await page.getByRole('button',{name:'Text Add a paragraph',exact:true}).click();
 await page.getByRole('textbox',{name:'Letter content'}).pressSequentially('Additional paragraph verified.');
 await page.getByRole('button',{name:'Save letter',exact:true}).click();
 await page.getByText('Saved · r2').waitFor();
 assert.match(template.printBody,/<p[^>]*>Additional paragraph verified\.<\/p>/);
 assert.match(template.printBody,/<h2[^>]*>Thank you for your support<\/h2>/);
 await page.getByRole('textbox',{name:'Letter content'}).getByText('Additional paragraph verified.',{exact:true}).click();
 await page.keyboard.press('Home');
 await page.keyboard.press('Shift+End');
 await page.getByRole('button',{name:'Bold',exact:true}).click();
 await page.getByRole('button',{name:'Bold',exact:true,pressed:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Bold',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Bold',exact:true}).click();
 await page.getByLabel('Paper size',{exact:true}).selectOption('A4 (8.27 x 11.69 in)');
 await page.getByRole('button',{name:'Save letter',exact:true}).click();
 await page.getByText('Saved · r3').waitFor();
 assert.equal(template.printLayoutJson.letterPdfLayout.pageSize,'A4 (8.27 x 11.69 in)');
 failSave=true;
 await page.getByRole('textbox',{name:'Letter name',exact:true}).fill('Conflict draft');
 await page.getByRole('button',{name:'Save letter',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'another session'}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'Letter name',exact:true}).inputValue(),'Conflict draft');
 failSave=false;
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'QA render failure'}).waitFor();
 failRender=false;
 await page.getByRole('textbox',{name:'Letter name',exact:true}).fill('Community thank you');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await page.getByText('6 PDF pages · current proof',{exact:true}).waitFor({timeout:30000});
 await page.getByRole('button',{name:'Next page',exact:true}).click();
 await page.getByRole('img',{name:'PDF page 2',exact:true}).last().waitFor();
 assert.equal(await page.getByRole('button',{name:'Preview',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Render print proof',exact:true}).count(),0);
 await page.getByRole('textbox',{name:'Letter content'}).press('End');
 await page.getByRole('textbox',{name:'Letter content'}).pressSequentially(' Proof freshness check.');
 await page.getByRole('button',{name:'Save letter',exact:true}).click();
 await page.getByText('Out of date · latest edits are not shown',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Download PDF',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Print PDF',exact:true}).isDisabled(),true);
 failRender=true;
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'QA render failure'}).waitFor();
 await page.getByText('Out of date · latest edits are not shown',{exact:true}).waitFor();
 failRender=false;
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await page.getByText('6 PDF pages · current proof',{exact:true}).waitFor();

 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download PDF',exact:true}).click();
 const downloaded=await downloadEvent;
 assert.deepEqual(await readFile(await downloaded.path()),await readFile(`${fixture}/multi-page-letter.pdf`));

 for(const width of [390,768,1280,1600]){
  await page.setViewportSize({width,height:1000});
  if(width<=900)await page.getByRole('button',{name:'write',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await capture(`width-${width}.png`);
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(dimensions.scroll<=dimensions.width+1,`Overflow at ${width}: ${dimensions.scroll}`);
 }
 await page.setViewportSize({width:1600,height:1050});
 await page.getByRole('button',{name:'review',exact:true}).click();
 await page.evaluate(()=>window.scrollTo(0,0));
 await capture(`canonical-review-desktop.png`);
 await page.setViewportSize({width:390,height:1000});
 await page.getByRole('button',{name:'settings',exact:true}).click();
 await page.getByRole('button',{name:'document',exact:true}).click();
 await page.evaluate(()=>window.scrollTo(0,0));
 await capture(`canonical-settings-mobile.png`);
 await page.getByRole('button',{name:'blocks',exact:true}).click();
 await page.getByRole('textbox',{name:'Search document blocks',exact:true}).fill('page');
 await capture(`canonical-block-search-mobile.png`);
 await page.getByRole('button',{name:'proof',exact:true}).click();
 await page.getByRole('img',{name:'PDF page 2',exact:true}).last().waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));
 await capture(`canonical-proof-mobile.png`);
 await page.setViewportSize({width:2400,height:1100});
 await page.getByRole('img',{name:'PDF page 2',exact:true}).last().waitFor();
 const writing=await page.locator('.lb-canvas-column').boundingBox();
 const proof=await page.locator('.lb-proof-section').boundingBox();
 assert.ok(proof.x>=writing.x+writing.width-2,'Proof should be beside writing at 2400px');
 await capture('wide-side-by-side-proof.png');
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/browser-results.json`,JSON.stringify({passed:true,errors,checks:['editing','revision saves','A4 layout persistence','save conflict preserves draft','proof failure visibility','responsive widths','stale proof remains stale after failed refresh','stale download/print disabled','download matches original PDF bytes','canonical Preview action']},null,2));
}catch(error){console.log('URL',page.url());console.log('BODY',(await page.locator('body').innerText()).slice(0,3000));console.log('ERRORS',errors);await page.screenshot({path:`${output}/failure.png`,fullPage:true});throw error;}finally{await browser.close();}

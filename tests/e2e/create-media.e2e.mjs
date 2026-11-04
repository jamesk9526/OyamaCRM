/** Visible synthetic artwork, real public image routes and Next proxy. CRM/provider data is intercepted. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import brandModule from '../../server/src/oyama-create/studio/brand.ts';
import registryModule from '../../server/src/oyama-create/studio/registry.ts';
import printModule from '../../server/src/oyama-create/studio/print.ts';
import emailModule from '../../server/src/services/oyama-email/email-render-service.ts';
const {defaultDesign, normalizeDesign}=designModule, {renderStudio, renderEmailDocument, emptyDonor}=renderModule, {normalizeBrand}=brandModule, {paragraph,newBlock}=registryModule, {freezeStudioPrint,renderFrozenStudio}=printModule;
const web=process.env.CREATE_MEDIA_WEB||'http://localhost:3216', port=Number(process.env.CREATE_MEDIA_API_PORT||3217);
const evidence='docs/status/audit-artifacts/2026-11-04-create-media', org='synthetic-media-qa';
await mkdir(evidence,{recursive:true});
process.env.NODE_ENV='test';
const apiImport=await import('../../server/src/index.ts'), api=apiImport.default.default||apiImport.default;
const server=await new Promise((resolve,reject)=>{const listener=api.listen(port,'127.0.0.1',error=>error?reject(error):resolve(listener));});
const browser=await chromium.launch({headless:true});
const files=[],checks=[],requests=[],errors=[];
let page;
async function imageAsset(namespace,name,svg){
  const source=await browser.newPage({viewport:{width:800,height:400}});
  try {
    await source.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    const png=await source.locator('svg').screenshot({omitBackground:true});
    const directory=`public/uploads/${namespace}/${org}`;await mkdir(directory,{recursive:true});const file=`${directory}/${name}`;await writeFile(file,png);files.push(file);
    return {name,url:`/uploads/${namespace}/${org}/${name}`,png};
  }finally{await source.close();}
}
async function checkImages(locator,label,min=1){
  await locator.first().waitFor({timeout:120000});
  await locator.evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  const result=await locator.evaluateAll(images=>images.map(image=>({src:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight,visibleWidth:image.getBoundingClientRect().width,visibleHeight:image.getBoundingClientRect().height})));
  assert.ok(result.length>=min,label+' image count');
  assert.ok(result.every(image=>image.width>1&&image.height>1&&image.visibleWidth>0&&image.visibleHeight>0),label+' decoded and visible: '+JSON.stringify(result));
  checks.push({label,images:result});
}
try{
  const logo=await imageAsset('letter-media','logo.png','<svg width="560" height="160" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="10" width="128" height="128" rx="30" fill="#245ec7"/><path d="M36 78l25 25 48-58" fill="none" stroke="white" stroke-width="12"/><text x="160" y="75" font-family="Arial" font-size="42" font-weight="bold" fill="#17324f">SYNTHETIC</text><text x="160" y="119" font-family="Arial" font-size="29" fill="#315f82">COMMUNITY FUND</text></svg>');
  const white=await imageAsset('branding','white-logo.png','<svg width="360" height="140" xmlns="http://www.w3.org/2000/svg"><path d="M20 70l30 30 60-66" fill="none" stroke="white" stroke-width="14"/><text x="130" y="87" font-family="Arial" font-size="32" fill="white">SYNTHETIC</text></svg>');
  const signature=await imageAsset('letter-media','signature.png','<svg width="620" height="170" xmlns="http://www.w3.org/2000/svg"><text x="12" y="112" font-family="Georgia" font-style="italic" font-size="83" fill="#17324f">Taylor Sample</text><path d="M28 145Q250 110 560 135" fill="none" stroke="#17324f" stroke-width="4"/></svg>');
  const story=await imageAsset('email-media','story.png','<svg width="720" height="240" xmlns="http://www.w3.org/2000/svg"><rect width="720" height="240" rx="12" fill="#d7e9f4"/><circle cx="115" cy="110" r="62" fill="#65a6d7"/><path d="M0 240l220-140 160 140" fill="#315f82"/><text x="310" y="100" font-family="Arial" font-size="30" fill="#17324f">A SYNTHETIC STORY</text><text x="310" y="145" font-family="Arial" font-size="22" fill="#17324f">Visible image acceptance fixture</text></svg>');
  const brand=normalizeBrand({version:1,identity:{organizationDisplayName:'Synthetic Community Fund',logoUrl:`http://localhost:1${logo.url}`,logoSquareUrl:white.url,streetAddress1:'100 Test Way',city:'Test City',stateProvince:'IL',postalCode:'60000'},presets:[],profiles:[],signers:[{id:'signer',name:'Executive director',signerName:'Taylor Sample',signerTitle:'Executive Director',signatureImageUrl:`http://localhost:1${signature.url}`,active:true}],defaultSignerId:'signer'});
  const permissions=['view:communications','edit:communications','view:campaigns','edit:campaigns','view:constituents','letters.view','letters.edit','letters.create','letters.export_pdf','letters.manage_branding','letters.manage_signatures','create.brand.publish'];
  const user={id:'synthetic-staff',organizationId:org,firstName:'Taylor',lastName:'Sample',role:'admin',email:'staff@example.invalid',permissions};
  const donor={...emptyDonor(),available:true,sensitiveAllowed:true,name:'Jordan Sample',salutation:'Dear Jordan,',address:'200 Test Street\nTest City IL 60000',entityKind:'individual'};
  const design=defaultDesign();design.brandRevisionId='synthetic-brand';design.body.content=[paragraph('opening','This synthetic appeal verifies the same visible artwork in the letter and email.'),{type:'image',attrs:{studioId:'story',src:story.url,alt:'Synthetic impact illustration',width:85}},newBlock('studioSignature','signature')];
  const content={id:'synthetic-content',campaignId:'synthetic-campaign',name:'Visible artwork appeal',revision:1,documentJson:{version:1,blocks:[]},designJson:normalizeDesign(design),variants:['LETTER','EMAIL'].map(channel=>({id:channel,channel,revision:1,documentJson:{},needsReview:false}))};
  const campaign={id:'synthetic-campaign',name:'Synthetic media acceptance',objective:'FUNDRAISING',ownerId:user.id,isTemplate:false,status:'DRAFT',revision:1,channelsJson:['LETTER','EMAIL'],deliveryMode:'BOTH',audienceListIds:[],contents:[content],releases:[]};
  const assets=[logo,white,signature,story].map((asset,index)=>({id:'asset-'+index,name:asset.name,url:asset.url,width:index===2?620:560,height:160}));
  const context=await browser.newContext({viewport:{width:1500,height:1000}});
  await context.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(/^\/api\/(?:letters\/media|email-campaigns\/media|public-media\/branding)\//.test(path))return route.continue();
    const json=body=>route.fulfill({json:body});
    if(path==='/api/auth/refresh')return json({data:{accessToken:'synthetic-session'}});
    if(path==='/api/auth/me')return json({data:user});
    if(path==='/api/oyama-create/bootstrap')return json({enabled:true,studioEnabled:true,brandHubEnabled:true,permissions,capabilities:[]});
    if(path==='/api/oyama-create/brand')return json({document:brand,draftRevision:1,published:{id:'synthetic-brand',revision:1,document:brand},canEditIdentity:true,canEditPresets:true,canEditSignatures:true,canPublish:true});
    if(path==='/api/oyama-create/studio/assets')return json(assets);
    if(path===`/api/oyama-create/campaigns/${campaign.id}`)return json(campaign);
    if(path.endsWith('/studio/preview')){const body=request.postDataJSON(),doc=normalizeDesign(body.design);return json({... (body.channel==='EMAIL'?renderEmailDocument(doc,donor,brand):renderStudio(doc,donor,brand)),donor,brand});}
    if(path.endsWith('/studio'))return json({design:content.designJson,proposed:content.designJson,brand,latestBrandId:'synthetic-brand',contentRevision:1,campaignRevision:1,canEdit:true,hasEmail:true});
    if(path==='/api/settings')return json({});
    return json([]);
  });
  page=await context.newPage();page.on('pageerror',error=>{errors.push(error.message);console.error('BROWSER',error.message);});page.on('dialog',dialog=>dialog.accept());
  page.on('response',response=>{if(/\/api\/(?:letters\/media|email-campaigns\/media|public-media\/branding)\//.test(response.url()))requests.push({url:response.url(),status:response.status(),type:response.headers()['content-type']});});
  await page.goto(`${web}/oyama-create/library/brand`);
  await page.getByRole('button',{name:'Logos & Assets',exact:true}).click();
  await checkImages(page.locator('.cs-brand-body img'),'Brand Hub logos and asset thumbnails',6);
  const backgroundButton=page.locator('.cs-logo-preview').nth(1).getByRole('button');await backgroundButton.focus();await page.keyboard.press('Space');assert.equal(await backgroundButton.getAttribute('aria-pressed'),'true');checks.push({label:'Preview background control works from the keyboard'});
  await page.screenshot({path:`${evidence}/brand-logos-desktop.png`,fullPage:true});
  const logoInput=page.getByRole('textbox',{name:'Saved image URL',exact:true}).first(),savedUrl=await logoInput.inputValue();
  await logoInput.fill(`/api/letters/media/${org}/missing.png`);await page.getByText('Image unavailable. Replace the upload or check its saved URL.').waitFor();
  await page.screenshot({path:`${evidence}/brand-missing-image.png`,fullPage:true});await logoInput.fill(savedUrl);
  await page.getByRole('button',{name:'Signatures',exact:true}).click();await checkImages(page.locator('.cs-signature-preview img'),'Saved signature preview');
  await page.screenshot({path:`${evidence}/brand-signatures-desktop.png`,fullPage:true});
  for(const width of [768,390]){await page.setViewportSize({width,height:1000});await page.locator('aside.oc-sidebar').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished)));await page.screenshot({path:`${evidence}/brand-signatures-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Brand layout overflow '+width);}
  await page.setViewportSize({width:1500,height:1050});await page.goto(`${web}/oyama-create/campaigns/${campaign.id}`);
  await page.getByRole('textbox',{name:'Studio letter content'}).waitFor({timeout:30000});
  await page.locator('.cs-library-tabs').getByRole('button',{name:'Assets',exact:true}).click();await checkImages(page.locator('.cs-library .cs-asset img'),'Studio asset chooser thumbnails',4);await checkImages(page.locator('.cs-page-track img'),'Letter canvas artwork and signature',2);await page.screenshot({path:`${evidence}/letter-images-desktop.png`,fullPage:true});
  await page.getByRole('button',{name:'Email',exact:true}).click();await page.getByRole('button',{name:'Refresh email preview',exact:true}).click();
  await checkImages(page.frameLocator('iframe[title="Studio responsive email"]').locator('img'),'Responsive email artwork',3);await page.screenshot({path:`${evidence}/email-images-desktop.png`,fullPage:true});
  for(const asset of [logo,white,signature,story]){const result=await context.request.get(`${web}${asset.url}`);assert.equal(result.status(),200,'Legacy upload compatibility proxy');assert.deepEqual(await result.body(),asset.png);}
  checks.push({label:'Legacy /uploads links proxy to real anonymous API image routes',count:4});
  const email=renderEmailDocument(content.designJson,donor,brand);const html=emailModule.absolutizeEmailAssetUrls(email.html,web);await writeFile(`${evidence}/outgoing-synthetic-email.html`,html);
  const inbox=await browser.newPage({viewport:{width:1000,height:1000}});await inbox.setContent(html);await checkImages(inbox.locator('img'),'Outgoing HTML without a CRM session',3);await inbox.screenshot({path:`${evidence}/outgoing-email.png`,fullPage:true});await inbox.setViewportSize({width:390,height:900});await checkImages(inbox.locator('img'),'Outgoing email on phone',3);assert.equal(await inbox.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await inbox.screenshot({path:`${evidence}/outgoing-email-mobile.png`,fullPage:true});await inbox.close();
  const proofDesign=structuredClone(content.designJson);proofDesign.body.content.push(newBlock('letterPageBreak','break'),paragraph('second','The second page verifies continuation branding with frozen uploaded artwork.'),{type:'image',attrs:{studioId:'second-story',src:story.url,alt:'Second-page synthetic illustration',width:70}});
  const frozen=await freezeStudioPrint(org,proofDesign,donor,brand,'LETTER',true);
  for(const file of files)await unlink(file);
  const proof=await renderFrozenStudio(frozen,true);assert.equal(proof.pageCount,2);await writeFile(`${evidence}/letter-images-proof.pdf`,proof.bytes);checks.push({label:'Two-page Chromium proof uses frozen artwork after originals are removed',pages:proof.pageCount,assets:Object.keys(frozen.assets).filter(key=>!key.startsWith('font:'))});
  await writeFile(`${evidence}/browser-checks.json`,JSON.stringify({synthetic:true,checks,requests,errors},null,2));assert.deepEqual(errors,[]);assert.ok(requests.filter(item=>!item.url.includes('missing.png')).every(item=>item.status===200&&item.type.startsWith('image/')));
  await writeFile(`${evidence}/browser-checks.json`,JSON.stringify({synthetic:true,checks,requests,errors},null,2));console.log(JSON.stringify({checks:checks.map(item=>item.label),errors},null,2));
}catch(error){await writeFile(`${evidence}/browser-checks.json`,JSON.stringify({synthetic:true,checks,requests,errors,error:error.message},null,2));if(page)await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));for(const file of files)await unlink(file).catch(()=>{});for(const namespace of ['branding','letter-media','email-media'])await rmdir(`public/uploads/${namespace}/${org}`).catch(()=>{});}

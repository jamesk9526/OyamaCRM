/** Synthetic browser fixtures exercising the real Studio. No live CRM/provider writes. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import registryModule from '../../server/src/oyama-create/studio/registry.ts';
import brandModule from '../../server/src/oyama-create/studio/brand.ts';
const {defaultDesign,normalizeDesign}=designModule,{renderStudio,renderEmailDocument,emptyDonor}=renderModule,{paragraph,newBlock}=registryModule,{normalizeBrand}=brandModule;
const evidence='docs/status/audit-artifacts/2026-11-04-create-word-studio';await mkdir(evidence,{recursive:true});
const permissions=['view:communications','edit:communications','view:campaigns','edit:campaigns','view:constituents','letters.view','letters.edit','letters.create','letters.generate_batch','letters.export_pdf','letters.manage_print_queue','letters.manage_branding','letters.manage_signatures','letters.view_sensitive_merge_data','create.brand.publish','create.connections.manage'];
const user={id:'synthetic-staff',organizationId:'synthetic-org',firstName:'Taylor',lastName:'Reed',role:'admin',email:'staff@example.invalid',permissions};
const brand=normalizeBrand({version:1,identity:{organizationDisplayName:'Synthetic Community Foundation',primaryColor:'#245ec7',accentColor:'#315f82',streetAddress1:'100 Test Way',city:'Test City',stateProvince:'IL',postalCode:'60000',footerLegalText:'Synthetic acceptance fixture only'},signers:[{id:'synthetic-signer',name:'Executive director',signerName:'Taylor Reed',signerTitle:'Executive Director',closingPhrase:'With gratitude,',typedSignature:'Taylor Reed',active:true}],presets:[],profiles:[],defaultSignerId:'synthetic-signer'});
let design=defaultDesign();design.brandRevisionId='synthetic-brand-1';design.data.givingUrl='/give/synthetic-form';design.body.content=[{type:'heading',attrs:{studioId:'headline',level:2},content:[{type:'text',text:'Together, more is possible.'}]},paragraph('opening','Your generosity opens doors for our neighbors. This synthetic appeal is used only to verify Studio editing and proofs.'),newBlock('studioSignature','signature')];
const content={id:'synthetic-content',campaignId:'synthetic-campaign',name:'Community appeal letter',revision:1,documentJson:{version:1,blocks:[]},designJson:design,variants:['LETTER','EMAIL'].map(channel=>({id:channel,channel,revision:1,documentJson:{},needsReview:false,legacyId:null}))};
const campaign={id:'synthetic-campaign',name:'Community appeal',objective:'FUNDRAISING',description:'Synthetic browser acceptance campaign',ownerId:user.id,isTemplate:false,status:'DRAFT',revision:1,fundraisingCampaignId:null,eventId:null,audienceListIds:[],channelsJson:['LETTER','EMAIL'],deliveryMode:'BOTH',contents:[content],releases:[]};
for(const count of [1,2,5,20]){const d=defaultDesign();d.brandRevisionId='synthetic-brand-1';d.body.content=[];for(let n=1;n<=count;n++){if(n>1)d.body.content.push(newBlock('letterPageBreak','break-'+n));d.body.content.push({type:'heading',attrs:{studioId:'heading-'+n,level:2},content:[{type:'text',text:'Synthetic page '+n}]},paragraph('paragraph-'+n,'Synthetic flowing page content. '.repeat(30)));}campaign.contents.push({...structuredClone(content),id:'pagination-'+count,name:count+' page editing fixture',designJson:d});}
const catalogDesign=defaultDesign();catalogDesign.brandRevisionId='synthetic-brand-1';catalogDesign.data.givingUrl='/give/synthetic-form';campaign.contents.push({...structuredClone(content),id:'catalog-fixture',name:'All block editing fixture',designJson:catalogDesign});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLvsAAAAASUVORK5CYII=','base64');const assets=[];
const donor={...emptyDonor(),available:true,sensitiveAllowed:true,constituentId:'synthetic-donor',name:'Jordan Sample',salutation:'Dear Jordan,',address:'200 Test Street\nTest City IL 60000',entityKind:'individual'};
const browser=await chromium.launch({headless:true}),errors=[],checks=[],writes=[];
let page;
try{
 const context=await browser.newContext({viewport:{width:1600,height:1050}});
 await context.route('**/uploads/letter-media/synthetic-org/*',route=>route.fulfill({contentType:'image/png',body:png}));
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method(),json=(body,status=200)=>route.fulfill({status,json:body});
  if(path==='/api/auth/refresh')return json({data:{accessToken:'synthetic-session'}});
  if(path==='/api/auth/me')return json({data:user});
  if(path==='/api/oyama-create/bootstrap')return json({enabled:true,studioEnabled:true,brandHubEnabled:true,permissions,capabilities:[]});
  if(path===`/api/oyama-create/campaigns/${campaign.id}`)return json(campaign);
  if(path.endsWith('/studio/preview')){const body=req.postDataJSON(),d=normalizeDesign(body.design);return json({... (body.channel==='EMAIL'?renderEmailDocument(d,donor,brand):renderStudio(d,donor,brand)),donor,brand});}
  if(path.endsWith('/studio')&&method==='PATCH'){const body=req.postDataJSON(),piece=campaign.contents.find(item=>path.includes('/contents/'+item.id+'/'));const d=normalizeDesign(body.design);piece.designJson=d;piece.revision++;campaign.revision++;writes.push({path,design:structuredClone(d)});return json({design:d,contentRevision:piece.revision,campaignRevision:campaign.revision});}
  if(path.endsWith('/studio')){const piece=campaign.contents.find(item=>path.includes('/contents/'+item.id+'/'));return json({design:piece.designJson,proposed:piece.designJson,originalHtml:null,brand,latestBrandId:'synthetic-brand-1',contentRevision:piece.revision,campaignRevision:campaign.revision,canEdit:true,hasEmail:true});}
  if(path==='/api/oyama-create/studio/recipients')return json([{id:'synthetic-donor',firstName:'Jordan',lastName:'Sample',displayName:null,organizationName:null}]);
  if(path==='/api/oyama-create/brand')return json({document:brand,draftRevision:1,published:{id:'synthetic-brand-1',revision:1,document:brand},canEditIdentity:true,canEditPresets:true,canEditSignatures:true,canPublish:true,studioEnabled:true,brandHubEnabled:true});
  if(path==='/api/oyama-create/brand/history')return json([{id:'synthetic-brand-1',revision:1,publishedAt:new Date().toISOString(),publishedBy:user.id}]);
  if(path==='/api/oyama-create/studio/assets'){if(method==='POST'){const asset={id:'synthetic-asset-'+assets.length,name:'Synthetic image',url:'/uploads/letter-media/synthetic-org/fixture.png',width:1,height:1};assets.push(asset);return json(asset,201);}return json(assets);}
  if(path==='/api/oyama-create/trash/preview')return json({name:campaign.name,reviewToken:'synthetic-review',trashed:false,pendingDeliveries:0,activeDefault:false,usedBy:[]});
  if(path==='/api/oyama-create/trash'&&method==='POST'){campaign.trashed=true;return json({id:'synthetic-trash',revision:1},201);}
  if(path==='/api/oyama-create/trash')return json({items:campaign.trashed?[{id:'synthetic-trash',kind:'CAMPAIGN',resourceId:campaign.id,name:campaign.name,revision:1,removedAt:new Date().toISOString(),removedBy:'Synthetic staff'}]:[],hasMore:false});
  if(path==='/api/oyama-create/trash/synthetic-trash/restore'){campaign.trashed=false;return json({restored:true});}
  if(path==='/api/settings')return json({});
  if(method!=='GET')writes.push({path,body:req.postDataJSON()});
  return json([]);
 });
 page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Runtime.enable');cdp.on('Runtime.exceptionThrown',event=>console.log('BROWSER_EXCEPTION',JSON.stringify(event.exceptionDetails)));page.on('pageerror',error=>errors.push(error.stack||error.message));page.on('dialog',dialog=>dialog.accept());
 await page.goto(`${process.env.CREATE_UI_WEB||'http://localhost:3218'}/oyama-create/campaigns/${campaign.id}`,{waitUntil:'domcontentloaded'});
 const editor=page.getByRole('textbox',{name:'Studio letter content'});await editor.waitFor({timeout:120000});
 await page.screenshot({path:`${evidence}/letter-desktop.png`,fullPage:true});
 await editor.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Unified writing acceptance.');
 await page.getByRole('button',{name:'Save',exact:true}).click();checks.push('Direct letter typing and persistence');
 await page.locator('.cs-library-tabs').getByRole('button',{name:'Patterns',exact:true}).click();await page.getByRole('button',{name:/Photo and story A photo/}).click();
 await page.getByRole('button',{name:'Save',exact:true}).click();assert.ok(JSON.stringify(campaign.contents[0].designJson).includes('A story of possibility'));checks.push('Pattern inserts editable content at cursor');
 await page.getByRole('button',{name:'Undo Studio edit',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await page.locator('.cs-save').filter({hasText:'Saved to server'}).waitFor();
 await editor.locator('p').first().click();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowRight');
 const selectedLetterText=await page.evaluate(()=>getSelection()?.toString());assert.ok(selectedLetterText?.length===3,JSON.stringify(await page.evaluate(()=>({text:getSelection()?.toString(),anchor:getSelection()?.anchorNode?.parentElement?.outerHTML,offset:getSelection()?.anchorOffset,active:document.activeElement?.outerHTML.slice(0,500)}))));
 await page.getByRole('button',{name:'Email',exact:true}).click();const email=page.locator('.cs-email-writing .cs-editable');await email.waitFor();await page.waitForFunction(expected=>getSelection()?.toString()===expected,selectedLetterText);checks.push('Exact text selection retained across Letter and Email');
 await email.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Shared email edit.');await page.getByRole('button',{name:'Save',exact:true}).click();assert.ok(JSON.stringify(campaign.contents[0].designJson.body).includes('Shared email edit.'));
 await page.getByRole('button',{name:'Customize for Email',exact:true}).click();await email.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Protected email copy.');await page.getByRole('button',{name:'Save',exact:true}).click();assert.ok(JSON.stringify(campaign.contents[0].designJson.email.overrides).includes('Protected email copy.'));assert.equal(JSON.stringify(campaign.contents[0].designJson.body).includes('Protected email copy.'),false);
 await page.screenshot({path:`${evidence}/email-editing-desktop.png`,fullPage:true});
 await page.getByRole('button',{name:'Letter',exact:true}).click();assert.ok((await editor.innerText()).includes('Shared email edit.'));assert.equal((await editor.innerText()).includes('Protected email copy.'),false);checks.push('Email shared edits update letter and customizations remain protected');
 await page.getByRole('tab',{name:'Layout',exact:true}).click();await page.getByRole('button',{name:'Page, margins & letterhead',exact:true}).click();await page.getByRole('tab',{name:'Home',exact:true}).click();
 for(const width of [1600,900,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);const writePanel=page.getByRole('button',{name:'write',exact:true});if(await writePanel.isVisible())await writePanel.click();await page.screenshot({path:`${evidence}/builder-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Overflow '+width);}
 checks.push('Desktop tablet phone layout');
 await page.setViewportSize({width:1600,height:1050});await page.getByRole('button',{name:'Exit writing view',exact:true}).click();
 await page.getByRole('button',{name:'Move to Trash',exact:true}).first().click();const trashDialog=page.getByRole('dialog',{name:'Move to Trash'});await trashDialog.getByRole('button',{name:'Move to Trash',exact:true}).click();
 await page.goto(`${process.env.CREATE_UI_WEB||'http://localhost:3218'}/oyama-create/trash`);await page.getByRole('button',{name:'Restore',exact:true}).waitFor();await page.screenshot({path:`${evidence}/trash-desktop.png`,fullPage:true});await page.getByRole('button',{name:'Restore',exact:true}).click();await page.getByRole('heading',{name:'Trash is empty'}).waitFor();checks.push('Campaign Trash review and restore UI with synthetic responses');
 assert.deepEqual(errors,[]);await writeFile(`${evidence}/studio-browser-checks.json`,JSON.stringify({synthetic:true,checks,errors,draftWrites:writes.length},null,2));
 console.log(JSON.stringify({checks,errors,draftWrites:writes.length},null,2));
}catch(error){if(page){await page.screenshot({path:`${evidence}/studio-failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${evidence}/studio-failure.txt`,`${error.stack}\nBrowser errors: ${errors.join('\n')}`);}throw error;}finally{await browser.close();}

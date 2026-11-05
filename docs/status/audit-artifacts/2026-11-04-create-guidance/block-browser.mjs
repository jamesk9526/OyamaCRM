/** Synthetic browser fixtures exercising the real Studio. No live CRM/provider writes. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import designModule from '../../../../server/src/oyama-create/studio/design.ts';
import renderModule from '../../../../server/src/oyama-create/studio/render.ts';
import registryModule from '../../../../server/src/oyama-create/studio/registry.ts';
import brandModule from '../../../../server/src/oyama-create/studio/brand.ts';
const {defaultDesign,normalizeDesign}=designModule,{renderStudio,renderEmailDocument,emptyDonor}=renderModule,{paragraph,newBlock}=registryModule,{normalizeBrand}=brandModule;
const evidence='docs/status/audit-artifacts/2026-11-04-create-guidance';await mkdir(evidence,{recursive:true});
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
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']}),errors=[],checks=[],writes=[];
design.pack.replySlip.enabled=true;design.pack.replySlip.placement='attached';design.pack.replySlip.content={type:'doc',content:[newBlock('studioResponse','attached-reply')]};donor.giving={total:125,count:1,largest:125,lastAmount:125,firstDate:null,lastDate:null,gifts:[]};
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
 await page.goto(`${process.env.CREATE_UI_WEB||'http://localhost:3212'}/oyama-create/campaigns/${campaign.id}`,{waitUntil:'domcontentloaded'});
 const editor=page.getByRole('textbox',{name:'Studio letter content'});await editor.waitFor({timeout:120000});

 const baseline=process.env.BLOCK_BASELINE==='1',targeted=baseline||process.env.BLOCK_TARGETED==='1';const prefix=baseline?'before-':'after-';const {STUDIO_BLOCKS}=registryModule;const {walkNodes}=designModule;
 await page.getByRole('combobox',{name:'Studio recipient',exact:true}).selectOption('synthetic-donor');await page.getByRole('button',{name:'Apply preview',exact:true}).click();
 for(const block of targeted?STUDIO_BLOCKS.filter(block=>block.type==='studioHistory'):STUDIO_BLOCKS){
  await page.locator('.cs-library-tabs').getByRole('button',{name:'Blocks',exact:true}).click();
  const button=page.locator('.cs-blocks button').filter({has:page.locator('strong',{hasText:new RegExp('^'+block.name+'$')})});
  await button.click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.locator('.cs-save').filter({hasText:'Saved to server'}).waitFor();
  assert.ok(walkNodes(content.designJson.body).some(node=>node.type===block.type),'Persisted correct block '+block.name);
  if(block.type==='studioHistory'){
   const preview=editor.locator('.cs-atomic').filter({has:page.locator('.cs-block-label',{hasText:'Giving summary'})});
   await preview.waitFor();assert.match(await preview.innerText(),/Giving in the selected period/);
   if(baseline)assert.match(await preview.innerText(),/Yes, I want to help/);else assert.doesNotMatch(await preview.innerText(),/Yes, I want to help/);
   await page.screenshot({path:`${evidence}/${prefix}giving-summary-desktop.png`,fullPage:true});
  }
 }
 if(!targeted)for(const block of STUDIO_BLOCKS)assert.ok(walkNodes(content.designJson.body).some(node=>node.type===block.type),'Earlier blocks retained '+block.name);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  if(width===390)await page.getByRole('button',{name:'write',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:`${evidence}/${prefix}blocks-${width}.png`,fullPage:true});
  if(width===390&&!baseline){await page.getByRole('button',{name:'blocks',exact:true}).click();await page.screenshot({path:`${evidence}/after-gallery-390.png`,fullPage:true});await page.getByRole('button',{name:'settings',exact:true}).click();await page.getByRole('combobox',{name:'Giving display',exact:true}).waitFor();await page.getByText('Choose a CRM recipient above and select Apply preview', {exact:false}).waitFor();await page.screenshot({path:`${evidence}/after-giving-settings-390.png`,fullPage:true});}
 }
 const pack=renderStudio(content.designJson,donor,brand);assert.match(pack.text,/Yes, I want to help/);
 assert.deepEqual(errors,[]);
 await writeFile(`${evidence}/${prefix}${targeted?"giving-summary":"block"}-checks.json`,JSON.stringify({fixture:'Synthetic browser APIs; no live CRM/provider writes',blocks:(targeted?STUDIO_BLOCKS.filter(block=>block.type==='studioHistory'):STUDIO_BLOCKS).map(block=>block.name),givingSummary:baseline?'Regression reproduced: attached reply slip appears inside Giving summary':'125 USD; no attached reply slip inside block',fullPack:'Reply slip retained',errors},null,2));
} catch(error){if(page){console.log((await page.locator('body').innerText()).slice(-3000));await page.screenshot({path:`${evidence}/block-failure.png`,fullPage:true});}throw error;}finally{await browser.close();}

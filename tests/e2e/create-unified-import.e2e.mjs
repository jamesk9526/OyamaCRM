/** Synthetic browser fixtures exercising the real Studio. No live CRM/provider writes. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import registryModule from '../../server/src/oyama-create/studio/registry.ts';
import brandModule from '../../server/src/oyama-create/studio/brand.ts';
import channelModule from '../../server/src/oyama-create/studio/channel-render.ts';
import domainModule from '../../server/src/oyama-create/domain.ts';
const {renderChannel}=channelModule,{variantFrom}=domainModule;
const {defaultDesign,normalizeDesign}=designModule,{renderStudio,renderEmailDocument,emptyDonor}=renderModule,{paragraph,newBlock}=registryModule,{normalizeBrand}=brandModule;
const evidence='docs/status/audit-artifacts/2026-11-04-create-unified-import';await mkdir(evidence,{recursive:true});
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
campaign.channelsJson=['LETTER','EMAIL','SOCIAL','WEB','SMS'];content.variants=campaign.channelsJson.map(channel=>({id:channel,channel,revision:1,documentJson:variantFrom({caption:['SOCIAL','SMS'].includes(channel)?'Synthetic public message.':''}),needsReview:false,legacyId:null}));
let runStatus='IDLE';const importedSources=Array.from({length:105},(_,index)=>({id:'source-'+String(index).padStart(3,'0'),sourceId:'legacy-'+index,sourceType:index%2?'LETTER':'EMAIL',name:'Synthetic source '+index,status:index===104?'HISTORICAL':'CONVERTED',campaignId:campaign.id,contentId:content.id,diagnostics:[],fingerprint:'fixture-'+index,error:null,missing:false}));
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']}),errors=[],checks=[],writes=[];
let page;
try{
 const context=await browser.newContext({viewport:{width:1600,height:1050}});
 await context.addInitScript(()=>{if(window!==window.top)return;localStorage.setItem('emailBuilder.reusableSections.v1',JSON.stringify([{id:'browser-section',name:'Synthetic saved browser section',block:{id:'local-block',type:'text',content:'<p>Recovered synthetic section.</p>'}}]));}); 
 await context.route('**/uploads/letter-media/synthetic-org/*',route=>route.fulfill({contentType:'image/png',body:png}));
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method(),json=(body,status=200)=>route.fulfill({status,json:body});
  if(path==='/api/auth/refresh')return json({data:{accessToken:'synthetic-session'}});
  if(path==='/api/auth/me')return json({data:user});
  if(path==='/api/oyama-create/bootstrap')return json({enabled:true,studioEnabled:true,brandHubEnabled:true,permissions,capabilities:[]});
  if(path===`/api/oyama-create/campaigns/${campaign.id}`)return json(campaign);
  if(path==='/api/oyama-create/imports/ensure')return json({status:runStatus});
  if(path==='/api/oyama-create/imports')return json({run:{status:runStatus,scanned:105,lastError:null},inventory:{total:105,statuses:{CONVERTED:104,HISTORICAL:1}}});
  if(path==='/api/oyama-create/imports/control'){runStatus=req.postDataJSON().action==='PAUSE'?'PAUSED':'RUNNING';return json({status:runStatus});}
  if(path==='/api/oyama-create/imports/sources'){const filtered=importedSources.filter(item=>(!url.searchParams.get('q')||item.name.includes(url.searchParams.get('q')))&&(!url.searchParams.get('contentId')||item.contentId===url.searchParams.get('contentId'))&&(!url.searchParams.get('status')||item.status===url.searchParams.get('status'))&&(!url.searchParams.get('type')||item.sourceType===url.searchParams.get('type')));const after=url.searchParams.get('after');const remaining=after?filtered.filter(item=>item.id>after):filtered;return json({items:remaining.slice(0,40),hasMore:remaining.length>40,nextCursor:remaining.length>40?remaining[39].id:null,total:filtered.length});}
  if(path==='/api/oyama-create/imports/recover'){writes.push({path});return json({recovered:true,sourceId:'recovered-local'},201);}
  if(path.startsWith('/api/oyama-create/imports/sources/')){const source=importedSources.find(item=>path.endsWith(item.id));if(source)return json({source,revisions:[{id:'revision',fingerprint:source.fingerprint,snapshotJson:{originalHtml:'<p>Synthetic original content.</p>',record:{}},createdAt:new Date().toISOString()}]});}
  if(path.includes('/variants/')&&method==='PATCH'){const body=req.postDataJSON(),variant=content.variants.find(item=>path.endsWith(item.channel));variant.documentJson=variantFrom(body.document);variant.revision++;campaign.revision++;return json(variant);}
  if(path.endsWith('/studio/preview')){const body=req.postDataJSON(),d=normalizeDesign(body.design);return json({...renderChannel(d,donor,brand,body.channel||'LETTER',variantFrom(body.format||content.variants.find(item=>item.channel===body.channel)?.documentJson)),channel:body.channel,donor,brand});}
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
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.stack||error.message));page.on('dialog',dialog=>dialog.accept());
 await page.goto(`${process.env.CREATE_UI_WEB||'http://localhost:3214'}/oyama-create/campaigns/${campaign.id}`,{waitUntil:'domcontentloaded'});
 const editor=page.getByRole('textbox',{name:'Studio letter content'});await editor.waitFor({timeout:120000});

 async function screenshot(name){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Viewport overflow '+name);await page.screenshot({path:`${evidence}/${name}.png`,fullPage:true});}
 const preview=page.getByRole('complementary',{name:'Live channel preview'}),tabs=preview.getByRole('tablist',{name:'Preview channel'});
 await preview.getByRole('status').filter({hasText:'Current draft'}).waitFor();await screenshot('unified-desktop');
 await editor.evaluate(el=>el.dataset.syntheticInstance='retained');await editor.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Unified draft retained.');
 await page.locator('.cs-save').filter({hasText:'Saved to server'}).waitFor();const writesBeforeSwitch=writes.length;
 for(const channel of ['Email','Social','Web','SMS','Letter']){await tabs.getByRole('tab',{name:channel,exact:true}).click();await preview.getByRole('status').filter({hasText:'Current draft'}).waitFor();assert.equal(await editor.getAttribute('data-synthetic-instance'),'retained');}
 assert.equal(writes.length,writesBeforeSwitch);checks.push('All five preview tabs retain the editor and do not save or publish');
 await page.getByRole('separator',{name:'Resize editor and preview'}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('separator').getAttribute('aria-valuenow'),'55');
 await tabs.getByRole('tab',{name:'Email',exact:true}).click();await preview.getByRole('button',{name:'Customize Email',exact:true}).click();
 const adaptation=page.locator('.cs-canvas .cs-editable:visible');await adaptation.waitFor();await adaptation.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Protected email-only copy.');
 await page.locator('.cs-save').filter({hasText:'Saved to server'}).waitFor();assert.ok(JSON.stringify(content.designJson.channels.EMAIL.document).includes('Protected email-only copy.'));assert.equal(JSON.stringify(content.designJson.body).includes('Protected email-only copy.'),false);
 await page.getByRole('button',{name:'Return to shared content',exact:true}).click();assert.equal(await editor.getAttribute('data-synthetic-instance'),'retained');await screenshot('email-customization-desktop');checks.push('Explicit Email adaptation saves independently of the shared document');
 await preview.getByRole('button',{name:'mobile',exact:true}).click();await screenshot('email-mobile-preview');
 await page.getByRole('button',{name:'Exit writing view',exact:true}).click();await page.getByRole('button',{name:'Review browser recovery',exact:true}).click();await page.getByRole('checkbox',{name:/Recover privately into organization/}).check();await page.getByRole('button',{name:'Recover into Create',exact:true}).click();await page.getByText('Synthetic saved browser section',{exact:true}).waitFor({state:'hidden'});assert.ok(writes.some(item=>item.path.endsWith('/imports/recover')));assert.ok(await page.evaluate(()=>localStorage.getItem('emailBuilder.reusableSections.v1').includes('browser-section')));checks.push('Browser recovery confirms organization and retains the local original');
 await page.getByRole('button',{name:'Focus writing',exact:true}).click();
 for(const width of [900,390]){
  await page.setViewportSize({width,height:1000});await page.getByRole('group',{name:'Builder panel'}).getByRole('button',{name:'Preview',exact:true}).click();await page.frameLocator('iframe[title="Email live draft preview"]').getByText('Together, more is possible.',{exact:true}).waitFor();await screenshot('preview-'+width);
  await page.getByRole('group',{name:'Builder panel'}).getByRole('button',{name:'Edit',exact:true}).click();await screenshot('editor-'+width);
 }
 checks.push('Tablet and phone Edit/Preview panels fit the viewport');
 await page.setViewportSize({width:1600,height:1050});await page.goto((process.env.CREATE_UI_WEB||'http://localhost:3214')+'/oyama-create/library/legacy',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Content import & source library'}).waitFor();await page.getByRole('button',{name:'Load more source records',exact:true}).click();await page.getByText('Synthetic source 79',{exact:true}).waitFor();
 await page.getByRole('searchbox',{name:'Search imported content'}).fill('Synthetic source 104');await page.getByText('Synthetic source 104',{exact:true}).waitFor();await screenshot('older-source-search');
 await page.getByRole('button',{name:'View original',exact:true}).click();await page.getByRole('dialog',{name:'Synthetic source 104'}).waitFor();await screenshot('preserved-original-review');await page.getByRole('button',{name:'Close dialog'}).click();
 checks.push('Paginated import library loads older sources, searches beyond 100 records and opens the preserved original');
 await page.setViewportSize({width:390,height:1000});await page.waitForFunction(()=>document.querySelector('.oc-sidebar').getBoundingClientRect().right<=1);await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('navigation',{name:'oyamaCreate',exact:true}).getByRole('link',{name:'History',exact:true}).waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.oc-sidebar').getBoundingClientRect().right<=1);await screenshot('imports-phone');
 await page.setViewportSize({width:1600,height:1050});
 for(const selectedChannel of ['LETTER','EMAIL']){campaign.channelsJson=[selectedChannel];await page.goto(`${process.env.CREATE_UI_WEB||'http://localhost:3214'}/oyama-create/campaigns/${campaign.id}`,{waitUntil:'networkidle'});await page.getByRole('textbox',{name:'Studio letter content'}).waitFor();const channelPreview=page.getByRole('complementary',{name:'Live channel preview'});await channelPreview.getByRole('status').filter({hasText:'Current draft'}).waitFor();assert.equal(await channelPreview.getByRole('tab',{name:selectedChannel==='LETTER'?'Letter':'Email',exact:true}).getAttribute('aria-selected'),'true');if(selectedChannel==='EMAIL')assert.equal(await page.getByRole('button',{name:'Pack proof',exact:true}).isDisabled(),true);await screenshot(selectedChannel.toLowerCase()+'-only-desktop');}
 checks.push('Letter-only and Email-only campaigns open in the same workspace without requiring the other channel');
 assert.deepEqual(errors,[]);assert.equal(writes.some(item=>/\/(release|approve|send-test)$/.test(item.path)),false);
 await writeFile(`${evidence}/browser-checks.json`,JSON.stringify({fixture:'Synthetic browser APIs; no live CRM/provider writes',checks,errors},null,2));
}catch(error){if(page){await page.screenshot({path:`${evidence}/browser-failure.png`,fullPage:true});console.error((await page.locator('body').innerText()).slice(-2500));}console.error(errors);throw error;}finally{await browser.close();}

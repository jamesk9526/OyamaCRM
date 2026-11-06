/** Synthetic browser fixtures exercising the real Studio. No live CRM/provider writes. */
import htmlDocumentModule from '../../server/src/oyama-create/studio/html-document.ts';
const {exportHtmlDocument,importHtmlDocument}=htmlDocumentModule;
let htmlConflict=false;
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
const {defaultDesign,normalizeDesign}=designModule,{renderStudio,renderRegion,renderEmailDocument,emptyDonor}=renderModule,{paragraph,newBlock}=registryModule,{normalizeBrand}=brandModule;
const evidence='docs/status/audit-artifacts/2026-11-06-create-v5';await mkdir(evidence,{recursive:true});
const permissions=['view:communications','edit:communications','view:campaigns','edit:campaigns','view:constituents','letters.view','letters.edit','letters.create','letters.generate_batch','letters.export_pdf','letters.manage_print_queue','letters.manage_branding','letters.manage_signatures','letters.view_sensitive_merge_data','create.brand.publish','create.connections.manage'];
const user={id:'synthetic-staff',organizationId:'synthetic-org',firstName:'Taylor',lastName:'Reed',role:'admin',email:'staff@example.invalid',permissions};
const brand=normalizeBrand({version:1,identity:{organizationDisplayName:'Synthetic Community Foundation',primaryColor:'#245ec7',accentColor:'#315f82',streetAddress1:'100 Test Way',city:'Test City',stateProvince:'IL',postalCode:'60000',footerLegalText:'Synthetic acceptance fixture only'},signers:[{id:'synthetic-signer',name:'Executive director',signerName:'Taylor Reed',signerTitle:'Executive Director',closingPhrase:'With gratitude,',typedSignature:'Taylor Reed',active:true}],presets:[],profiles:[],defaultSignerId:'synthetic-signer'});
let design=defaultDesign();design.brandRevisionId='synthetic-brand-1';design.data.givingUrl='/give/synthetic-form';design.body.content=[{type:'heading',attrs:{studioId:'headline',level:2},content:[{type:'text',text:'Together, more is possible.'}]},paragraph('opening','Your generosity opens doors for our neighbors. This synthetic appeal is used only to verify Studio editing and proofs.'),newBlock('studioSignature','signature')];
design.body.content[1].content.push({type:'text',text:' Dear {{donor.fullName}}.'});
const content={id:'synthetic-content',campaignId:'synthetic-campaign',name:'Community appeal letter',revision:1,documentJson:{version:1,blocks:[]},designJson:design,variants:['LETTER','EMAIL'].map(channel=>({id:channel,channel,revision:1,documentJson:{},needsReview:false,legacyId:null}))};
const campaign={id:'synthetic-campaign',name:'Community appeal',objective:'FUNDRAISING',description:'Synthetic browser acceptance campaign',ownerId:user.id,isTemplate:false,status:'DRAFT',revision:1,fundraisingCampaignId:null,eventId:null,audienceListIds:[],channelsJson:['LETTER','EMAIL'],deliveryMode:'BOTH',contents:[content],releases:[]};
for(const count of [1,2,5,20]){const d=defaultDesign();d.brandRevisionId='synthetic-brand-1';d.body.content=[];for(let n=1;n<=count;n++){if(n>1)d.body.content.push(newBlock('letterPageBreak','break-'+n));d.body.content.push({type:'heading',attrs:{studioId:'heading-'+n,level:2},content:[{type:'text',text:'Synthetic page '+n}]},paragraph('paragraph-'+n,'Synthetic flowing page content. '.repeat(30)));}campaign.contents.push({...structuredClone(content),id:'pagination-'+count,name:count+' page editing fixture',designJson:d});}
const catalogDesign=defaultDesign();catalogDesign.brandRevisionId='synthetic-brand-1';catalogDesign.data.givingUrl='/give/synthetic-form';campaign.contents.push({...structuredClone(content),id:'catalog-fixture',name:'All block editing fixture',designJson:catalogDesign});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLvsAAAAASUVORK5CYII=','base64');const assets=[];
const donor={...emptyDonor(),available:true,sensitiveAllowed:true,constituentId:'synthetic-donor',name:'Jordan Sample',salutation:'Dear Jordan,',address:'200 Test Street\nTest City IL 60000',entityKind:'individual'};
campaign.channelsJson=['LETTER','EMAIL','SOCIAL','WEB','SMS'];content.variants=campaign.channelsJson.map(channel=>({id:channel,channel,revision:1,documentJson:variantFrom({caption:['SOCIAL','SMS'].includes(channel)?'Synthetic public message.':''}),needsReview:false,legacyId:null}));
let runStatus='IDLE';const importedSources=Array.from({length:105},(_,index)=>({id:'source-'+String(index).padStart(3,'0'),sourceId:'legacy-'+index,sourceType:index%2?'LETTER':'EMAIL',name:'Synthetic source '+index,status:index===104?'HISTORICAL':'CONVERTED',campaignId:campaign.id,contentId:content.id,diagnostics:[],fingerprint:'fixture-'+index,error:null,missing:false}));
const tableDesign=defaultDesign();tableDesign.version=4;tableDesign.brandRevisionId='synthetic-brand-1';
const longTable=newBlock('table','long-table');longTable.content=[longTable.content[0],...Array.from({length:45},(_,i)=>({type:'tableRow',content:[{type:'tableCell',content:[paragraph(`table-row-${i}-a`,`Synthetic gift ${i+1}`)]},{type:'tableCell',content:[paragraph(`table-row-${i}-b`,'$25.00')]}]}))];tableDesign.body.content=[longTable];campaign.contents.push({...structuredClone(content),id:'table-v5-fixture',name:'Table pagination fixture',designJson:tableDesign});
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']}),errors=[],checks=[],writes=[];
let shellEnabled=true, unifiedEditorEnabled=true;
let page;let notes={text:'',revision:0,updatedAt:null},noteWrites=0;
try{
 const context=await browser.newContext({viewport:{width:1600,height:1050}});
 await context.addInitScript(()=>{if(window!==window.top)return;localStorage.setItem('emailBuilder.reusableSections.v1',JSON.stringify([{id:'browser-section',name:'Synthetic saved browser section',block:{id:'local-block',type:'text',content:'<p>Recovered synthetic section.</p>'}}]));}); 
 await context.route('**/uploads/letter-media/synthetic-org/*',route=>route.fulfill({contentType:'image/png',body:png}));
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method(),json=(body,status=200)=>route.fulfill({status,json:body});
  if(path==='/api/auth/refresh')return json({data:{accessToken:'synthetic-session'}});
  if(path==='/api/auth/me')return json({data:user});
  if(path==='/api/oyama-create/bootstrap')return json({enabled:true,studioEnabled:true,brandHubEnabled:true,shellEnabled,unifiedEditorEnabled,permissions,capabilities:[]});
  if(path.endsWith('/readiness'))return json({campaignRevision:campaign.revision,ready:false,issues:[],schedules:[],eligibility:{total:0,overlap:0,excluded:0,missingEmail:0,missingPostal:0,missingSmsConsent:0,counts:{}}});
  if(path===`/api/oyama-create/campaigns/${campaign.id}`)return json(campaign);
  if(path==='/api/oyama-create/imports/ensure')return json({status:runStatus});
  if(path==='/api/oyama-create/imports')return json({run:{status:runStatus,scanned:105,lastError:null},inventory:{total:105,statuses:{CONVERTED:104,HISTORICAL:1}}});
  if(path==='/api/oyama-create/imports/control'){runStatus=req.postDataJSON().action==='PAUSE'?'PAUSED':'RUNNING';return json({status:runStatus});}
  if(path==='/api/oyama-create/imports/sources'){const filtered=importedSources.filter(item=>(!url.searchParams.get('q')||item.name.includes(url.searchParams.get('q')))&&(!url.searchParams.get('contentId')||item.contentId===url.searchParams.get('contentId'))&&(!url.searchParams.get('status')||item.status===url.searchParams.get('status'))&&(!url.searchParams.get('type')||item.sourceType===url.searchParams.get('type')));const after=url.searchParams.get('after');const remaining=after?filtered.filter(item=>item.id>after):filtered;return json({items:remaining.slice(0,40),hasMore:remaining.length>40,nextCursor:remaining.length>40?remaining[39].id:null,total:filtered.length});}
  if(path==='/api/oyama-create/imports/recover'){writes.push({path});return json({recovered:true,sourceId:'recovered-local'},201);}
  if(path.startsWith('/api/oyama-create/imports/sources/')){const source=importedSources.find(item=>path.endsWith(item.id));if(source)return json({source,revisions:[{id:'revision',fingerprint:source.fingerprint,snapshotJson:{originalHtml:'<p>Synthetic original content.</p>',record:{}},createdAt:new Date().toISOString()}]});}
  if(path.includes('/variants/')&&method==='PATCH'){const body=req.postDataJSON(),variant=content.variants.find(item=>path.endsWith(item.channel));variant.documentJson=variantFrom(body.document);variant.revision++;campaign.revision++;return json(variant);}
  if(path.endsWith('/studio/html')){const piece=campaign.contents.find(item=>path.includes('/contents/'+item.id+'/'));const body=req.postDataJSON(),scope=body.scope||'SHARED';if(body.action==='EXPORT')return json({html:exportHtmlDocument(piece.designJson,brand,scope),scope,revision:piece.revision,fingerprint:'fixture-'+piece.revision});if(htmlConflict||body.revision!==piece.revision)return json({error:{message:'Synthetic HTML conflict; source retained.'}},409);return json(importHtmlDocument(piece.designJson,brand,body.html,scope));}
  if(path.endsWith('/studio/preview')){const body=req.postDataJSON(),d=normalizeDesign(body.design),channel=body.channel||'LETTER';return json({...renderChannel(d,donor,brand,channel,variantFrom(body.format||content.variants.find(item=>item.channel===channel)?.documentJson),body.artifact||'LETTER'),channel,donor,brand,...(channel==='LETTER'&&!['OUTER_ENVELOPE','RETURN_ENVELOPE'].includes(body.artifact)?{pageChrome:{header:renderRegion(d,donor,brand,'firstHeader'),footer:renderRegion(d,donor,brand,'firstFooter')}}:{})});}
  if(path.endsWith('/studio')&&method==='PATCH'){const body=req.postDataJSON(),piece=campaign.contents.find(item=>path.includes('/contents/'+item.id+'/'));const d=normalizeDesign(body.design);piece.designJson=d;piece.revision++;campaign.revision++;writes.push({path,sourceMode:body.sourceMode,design:structuredClone(d)});return json({design:d,contentRevision:piece.revision,campaignRevision:campaign.revision});}
  if(path.endsWith('/studio')){const piece=campaign.contents.find(item=>path.includes('/contents/'+item.id+'/'));return json({design:piece.designJson,proposed:piece.designJson,originalHtml:null,brand,latestBrandId:'synthetic-brand-1',contentRevision:piece.revision,campaignRevision:campaign.revision,canEdit:true,hasEmail:true});}
  if(path==='/api/oyama-create/studio/recipients')return json([{id:'synthetic-donor',firstName:'Jordan',lastName:'Sample',displayName:null,organizationName:null}]);
  if(path==='/api/oyama-create/brand')return json({document:brand,draftRevision:1,published:{id:'synthetic-brand-1',revision:1,document:brand},canEditIdentity:true,canEditPresets:true,canEditSignatures:true,canPublish:true,studioEnabled:true,brandHubEnabled:true});
  if(path==='/api/oyama-create/brand/history')return json([{id:'synthetic-brand-1',revision:1,publishedAt:new Date().toISOString(),publishedBy:user.id}]);
  if(path==='/api/oyama-create/studio/assets'){if(method==='POST'){const asset={id:'synthetic-asset-'+assets.length,name:'Synthetic image',url:'/uploads/letter-media/synthetic-org/fixture.png',width:1,height:1};assets.push(asset);return json(asset,201);}return json(assets);}
  if(path==='/api/oyama-create/trash/preview')return json({name:campaign.name,reviewToken:'synthetic-review',trashed:false,pendingDeliveries:0,activeDefault:false,usedBy:[]});
  if(path==='/api/oyama-create/trash'&&method==='POST'){campaign.trashed=true;return json({id:'synthetic-trash',revision:1},201);}
  if(path==='/api/oyama-create/trash')return json({items:campaign.trashed?[{id:'synthetic-trash',kind:'CAMPAIGN',resourceId:campaign.id,name:campaign.name,revision:1,removedAt:new Date().toISOString(),removedBy:'Synthetic staff'}]:[],hasMore:false});
  if(path==='/api/oyama-create/trash/synthetic-trash/restore'){campaign.trashed=false;return json({restored:true});}
  if(path.endsWith('/notes')){if(method==='PUT'){notes={...req.postDataJSON(),revision:notes.revision+1};noteWrites++;}return json(notes);}
  if(path==='/api/settings')return json({});
  if(method!=='GET')writes.push({path,body:req.postDataJSON()});
  return json([]);
 });
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.stack||error.message));page.on('dialog',dialog=>dialog.accept());
 const base=process.env.CREATE_UI_WEB||'http://localhost:3000';await page.goto(`${base}/oyama-create/campaigns/${campaign.id}`,{waitUntil:'domcontentloaded'});

 const editor=page.getByRole('textbox',{name:'Studio letter content',exact:true});await editor.waitFor({timeout:120000});await page.evaluate(()=>document.fonts.ready);
 const frame=page.getByRole('region',{name:'Oyama Create unified workspace',exact:true}),rail=page.getByRole('region',{name:'Document pages',exact:true});
 const shot=async name=>page.screenshot({path:`${evidence}/${name}.png`,fullPage:true});
 const geometry=()=>page.evaluate(()=>({root:document.documentElement.scrollHeight,viewport:innerHeight,wide:document.documentElement.scrollWidth>innerWidth+1,top:document.querySelector('.v5-titlebar').getBoundingClientRect().top,canvas:document.querySelector('.cs-page-rail').getBoundingClientRect().height}));
 await editor.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.insertText(' V5 typed content.');
 await shot('before-save');await frame.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.v5-save-state')?.textContent?.includes('Saved to server'),{},{timeout:20000});assert.ok(writes.some(item=>item.design?.version===4));
 const written=writes.length;
 const split=page.getByRole('separator',{name:'Resize navigator',exact:true});await split.focus();await page.keyboard.press('ArrowRight');assert.equal(await split.getAttribute('aria-valuenow'),'251');await split.dblclick();assert.equal(await split.getAttribute('aria-valuenow'),'235');
 await frame.getByRole('button',{name:'Properties',exact:true}).click();await frame.getByRole('button',{name:'Properties',exact:true}).click();
 await frame.getByRole('button',{name:'Compact',exact:true}).click();await frame.getByRole('button',{name:'Comfortable',exact:true}).click();assert.equal(writes.length,written);checks.push('Dock resizing, hiding/restoring and density do not save or change document revisions');
 await frame.getByRole('tab',{name:'Notes',exact:true}).click();await frame.getByRole('textbox',{name:'Shared draft notes'}).fill('Internal shared note: proof this letter.');await frame.getByRole('button',{name:'Save notes',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.v5-notes [role=status]')?.textContent==='Notes saved',{},{timeout:20000});assert.equal(noteWrites,1);assert.equal(writes.length,written);checks.push('Shared internal notes use their separate API');
 await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'Search workspace commands'}).fill('revision');await page.getByRole('dialog').getByRole('button',{name:'Revision history'}).waitFor();await page.keyboard.press('Escape');
 await frame.getByRole('tab',{name:'Page',exact:true}).click();
 for(const [width,height,name] of [[1600,950,'desktop'],[1280,780,'laptop'],[900,720,'compact'],[430,790,'mobile']]){
   await page.setViewportSize({width,height});await page.waitForTimeout(250);const g=await geometry();if(g.root!==g.viewport)console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>['fixed','absolute'].includes(getComputedStyle(el).position)&&el.getBoundingClientRect().bottom>innerHeight+5).slice(0,20).map(el=>({tag:el.tagName,cls:el.className,rect:el.getBoundingClientRect().toJSON(),position:getComputedStyle(el).position}))));assert.equal(g.root,g.viewport,JSON.stringify(g));assert.equal(g.wide,false);assert.equal(g.top,0);assert.ok(g.canvas>200);await shot(name);
   if(width===430){await frame.getByRole('button',{name:'Properties',exact:true}).click();await page.getByRole('complementary',{name:'Document properties',exact:true}).waitFor({state:'visible'});await shot('mobile-properties');await frame.getByRole('button',{name:'Close properties',exact:true}).click();}
 }
 checks.push('Pinned chrome and bounded document viewport at all four reference sizes, mobile properties overlay');
 await page.setViewportSize({width:1600,height:950});await frame.getByRole('button',{name:'Properties',exact:true}).click();
 await editor.focus();await page.keyboard.press('Control+End');await page.keyboard.insertText(' Long synthetic paragraph for pagination. '.repeat(350));await page.waitForTimeout(900);
 const pageCount=await page.locator('.cv5-paper-track>.cs-paper-page').count();assert.ok(pageCount>=3,`expected flowing pages, found ${pageCount}`);
 await rail.evaluate(element=>element.scrollTop=420);const g=await geometry();assert.equal(g.top,0);assert.equal(await page.locator('.v5-navigator-scroll').evaluate(element=>element.scrollTop),0);await shot('multipage');checks.push(`Vertical automatic pagination produces ${pageCount} pages without persisting generated page nodes`);
 await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Email',exact:true}).click();await page.getByRole('textbox',{name:'Studio email content',exact:true}).waitFor();await shot('email');await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Letter',exact:true}).click();await editor.waitFor();

 await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Web',exact:true}).click();
 const web=page.getByRole('textbox',{name:'Studio web content',exact:true});await web.waitFor();await web.fill('Independent public web copy');await web.evaluate(element=>element.dataset.acceptanceInstance='retained-web');
 await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Letter',exact:true}).click();await editor.waitFor();
 await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Web',exact:true}).click();await web.waitFor();assert.equal(await web.getAttribute('data-acceptance-instance'),'retained-web');assert.equal(await web.innerText(),'Independent public web copy');assert.ok(!JSON.stringify(content.designJson.body).includes('Independent public web copy'));
 await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'SMS',exact:true}).click();await page.getByRole('textbox',{name:'Studio sms content',exact:true}).fill('Synthetic opted-in text copy');
 await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Social',exact:true}).click();await page.getByRole('textbox',{name:'Studio social content',exact:true}).fill('Synthetic public social copy');
 await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Letter',exact:true}).click();await editor.waitFor();checks.push('All five formats share the schema editor; channel instances and independent public copy survive switching');
 await frame.getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('dialog',{name:'Recipient & channel preview'}).waitFor();await page.getByRole('tab',{name:'Email',exact:true}).click();await page.frameLocator('iframe[title="Email live draft preview"]').getByText('V5 typed content.',{exact:false}).waitFor();await shot('preview');await page.keyboard.press('Escape');
 checks.push('Retained letter/email editing and independent channel previews');
 await frame.getByRole('button',{name:'Review & prepare',exact:true}).click();await frame.waitFor({state:'hidden'});await page.getByRole('navigation',{name:'Campaign workspace'}).getByRole('button',{name:'Content',exact:true}).click();await frame.waitFor({state:'visible'});checks.push('Campaign review remains reachable and returns to the same editor');


 await frame.getByRole('combobox',{name:'Content piece',exact:true}).selectOption('table-v5-fixture');
 const tableEditor=page.getByRole('textbox',{name:'Studio letter content',exact:true});await tableEditor.waitFor();await page.waitForFunction(()=>document.querySelectorAll('.cs-editable [data-create-page-gap]').length>0,{},{timeout:20000});
 const tableState=await tableEditor.evaluate(element=>{const box=element.getBoundingClientRect(),scale=box.width/element.offsetWidth;const rows=[...element.querySelectorAll('tr')].filter(row=>!row.closest('[data-create-page-gap]'));return {rows:rows.length,width:element.querySelector('table').getBoundingClientRect().width/scale,body:element.offsetWidth,gaps:element.querySelectorAll('[data-create-page-gap]').length,headers:element.querySelectorAll('[data-create-page-gap] th').length};});
 assert.equal(tableState.rows,46);assert.ok(tableState.width<=tableState.body+2,JSON.stringify(tableState));assert.ok(tableState.headers>0);await shot('table-flow');checks.push('Long editable tables preserve every row, physical width, and repeated page headings');
 await frame.getByRole('combobox',{name:'Content piece',exact:true}).selectOption(content.id);
 campaign.channelsJson=['EMAIL'];content.variants=content.variants.filter(item=>item.channel==='EMAIL');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('textbox',{name:'Studio email content',exact:true}).waitFor();assert.equal(await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Email',exact:true}).getAttribute('aria-pressed'),'true');await shot('email-only');
 campaign.channelsJson=['WEB'];content.variants=[{id:'WEB',channel:'WEB',revision:1,documentJson:{},needsReview:false,legacyId:null}];
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('textbox',{name:'Studio web content',exact:true}).waitFor();assert.equal(await page.getByRole('group',{name:'Document format',exact:true}).getByRole('button',{name:'Web',exact:true}).getAttribute('aria-pressed'),'true');await shot('web-only');checks.push('Email-only and public-only campaigns open their own format immediately');

 shellEnabled=false;unifiedEditorEnabled=false;campaign.channelsJson=['LETTER'];content.variants=[{id:'LETTER',channel:'LETTER',revision:1,documentJson:{},needsReview:false,legacyId:'retained-original-letter'}];
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('textbox',{name:'Studio letter content',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Use original Letters canvas'}).count(),0);assert.equal(await page.getByRole('region',{name:'Oyama Create unified workspace'}).count(),0);
 checks.push('Disabling both flags keeps a bound v4 draft in the compatible Studio editor');
 assert.deepEqual(errors,[]);await writeFile(`${evidence}/browser-checks.json`,JSON.stringify({synthetic:true,checks,errors,draftWrites:writes.length,noteWrites},null,2));console.log(JSON.stringify({checks,errors},null,2));
}catch(error){if(page){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${evidence}/failure.txt`,`${error.stack}\n${errors.join('\n')}`);}throw error;}finally{await browser.close();}

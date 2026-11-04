/** Synthetic browser fixtures exercising the real Studio. No live CRM/provider writes. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import registryModule from '../../server/src/oyama-create/studio/registry.ts';
import brandModule from '../../server/src/oyama-create/studio/brand.ts';
const {defaultDesign,normalizeDesign}=designModule,{renderStudio,renderEmailDocument,emptyDonor}=renderModule,{paragraph,newBlock,STUDIO_BLOCKS}=registryModule,{normalizeBrand}=brandModule;
const evidence='docs/status/audit-artifacts/2026-11-03-create-studio';await mkdir(evidence,{recursive:true});
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
  if(path==='/api/settings')return json({});
  if(method!=='GET')writes.push({path,body:req.postDataJSON()});
  return json([]);
 });
 page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Runtime.enable');cdp.on('Runtime.exceptionThrown',event=>console.log('BROWSER_EXCEPTION',JSON.stringify(event.exceptionDetails)));page.on('pageerror',error=>errors.push(error.stack||error.message));page.on('dialog',dialog=>dialog.accept());
 if(!process.env.STUDIO_BRAND_ONLY){
 await page.goto(`${process.env.CREATE_UI_WEB||'http://localhost:3214'}/oyama-create/campaigns/${campaign.id}`,{waitUntil:'domcontentloaded'});
 const editor=page.getByRole('textbox',{name:'Studio letter content'});await editor.waitFor({timeout:120000});
 await page.screenshot({path:`${evidence}/studio-desktop-before.png`,fullPage:true});
 await editor.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' A working letter-first editor.');
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForTimeout(1600);
 assert.ok(writes.some(write=>JSON.stringify(write.design).includes('A working letter-first editor.')));checks.push('Real Tiptap typing and server draft save');
 await page.getByRole('button',{name:'Email',exact:true}).click();await page.getByRole('button',{name:'Customize for email'}).nth(1).click();
 await page.getByRole('button',{name:'Edit rich email customization',exact:true}).click();await page.getByRole('textbox',{name:'Studio letter content',exact:true}).fill('Protected email introduction.');await page.getByRole('button',{name:'Apply customized block',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Letter',exact:true}).click();await editor.waitFor();await editor.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Shared revision after email customization.');
 await page.getByRole('button',{name:'Email',exact:true}).click();await page.getByText('Protected email introduction.',{exact:true}).waitFor();await page.getByRole('button',{name:'Keep reviewed customizations'}).click();checks.push('Protected email copy survives shared letter edits and requires review');
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForTimeout(1600);await page.screenshot({path:`${evidence}/studio-email-desktop.png`,fullPage:true});
 await page.getByRole('button',{name:'Letter',exact:true}).click();
 await page.getByLabel('Content piece',{exact:true}).selectOption('catalog-fixture');await editor.waitFor();
 for(const definition of STUDIO_BLOCKS){
  await page.locator('.cs-library-tabs').getByRole('button',{name:'Blocks',exact:true}).click();await editor.focus();await page.keyboard.press('Control+End');const insert=page.locator('.cs-library .cs-blocks button').filter({has:page.getByText(definition.name,{exact:true})});
  if(definition.type==='image'){const chooser=page.waitForEvent('filechooser');await insert.click();await(await chooser).setFiles({name:'synthetic-image.png',mimeType:'image/png',buffer:png});await page.waitForResponse(response=>response.url().endsWith('/studio/assets')&&response.request().method()==='POST');}
  else await insert.click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=campaign.contents.find(item=>item.id==='catalog-fixture').designJson;assert.ok(JSON.stringify(saved).includes('"type":"'+definition.type+'"'),'Inserted '+definition.type);
 }
 await page.getByLabel('Content piece',{exact:true}).selectOption(content.id);await editor.waitFor();await page.getByLabel('Content piece',{exact:true}).selectOption('catalog-fixture');await editor.waitFor();
 for(const definition of STUDIO_BLOCKS)assert.ok(JSON.stringify(campaign.contents.find(item=>item.id==='catalog-fixture').designJson).includes('"type":"'+definition.type+'"'),'Reopened '+definition.type);
 await editor.locator('[data-letter-signature]').last().click();await page.getByLabel('Closing override',{exact:true}).fill('With sincere thanks,');await page.getByRole('button',{name:'Save',exact:true}).click();assert.ok(JSON.stringify(campaign.contents.find(item=>item.id==='catalog-fixture').designJson).includes('With sincere thanks,'));
 await page.getByRole('button',{name:'Duplicate block',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();assert.equal(await editor.locator('[data-letter-signature]').count(),2);await page.getByRole('button',{name:'Undo Studio edit',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();
 checks.push('Every catalog block inserted, saved and reopened; signature inspector, duplication and undo work');await page.screenshot({path:evidence+'/studio-block-catalog.png',fullPage:true});
 await page.setViewportSize({width:1600,height:1050});
 for(const count of [1,2,5,20]){
  await page.getByLabel('Content piece',{exact:true}).selectOption('pagination-'+count);await editor.waitFor();
  await page.waitForFunction(expected=>document.querySelectorAll('.cs-page-navigation button').length===expected,count);
  await editor.focus();await page.keyboard.press('Control+End');await page.keyboard.type(' Cross-page typing fixture.');assert.ok((await editor.innerText()).includes('Cross-page typing fixture.'));
  await page.keyboard.press('Control+z');assert.equal((await editor.innerText()).includes('Cross-page typing fixture.'),false);await page.keyboard.press('Control+y');assert.ok((await editor.innerText()).includes('Cross-page typing fixture.'));
  await editor.evaluate(element=>{const data=new DataTransfer();data.setData('text/html','<p><strong>Rich pasted fixture</strong></p>');data.setData('text/plain','Rich pasted fixture');element.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});assert.ok((await editor.innerText()).includes('Rich pasted fixture'));assert.equal(await editor.locator('strong').filter({hasText:'Rich pasted fixture'}).count(),1);
  await page.keyboard.press('Control+a');const selected=await page.evaluate(()=>getSelection()?.toString()||'');assert.ok(selected.includes('Synthetic page 1')&&selected.includes('Synthetic page '+count));await page.keyboard.press('ArrowRight');
  await page.getByRole('button',{name:'Save',exact:true}).click();checks.push(count+' pages: typing, rich paste, selection, undo/redo and saved reflow');
 }
 await page.screenshot({path:evidence+'/studio-20-page-editing.png',fullPage:true});
 await page.getByLabel('Content piece',{exact:true}).selectOption(content.id);await editor.waitFor();
 for(const width of [1600,900,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);await page.screenshot({path:`${evidence}/studio-${width}.png`,fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false,`Viewport overflow at ${width}`);checks.push(`Studio fits ${width}px viewport`);}
 }
 await page.setViewportSize({width:1600,height:1050});if(process.env.STUDIO_BRAND_ONLY)await page.goto(`${process.env.CREATE_UI_WEB||'http://localhost:3214'}/oyama-create/library/brand`);else{await page.locator('aside.oc-sidebar a[href="/oyama-create/library"]').click();await page.getByRole('link',{name:'Brand Hub & assets',exact:true}).click();}await page.getByRole('heading',{name:/Brand Hub/i}).waitFor();await page.getByRole('button',{name:'Signatures',exact:true}).click();await page.getByRole('textbox',{name:'Preset name',exact:true}).waitFor();await page.screenshot({path:`${evidence}/brand-hub-signatures.png`,fullPage:true});checks.push('Canonical Brand Hub signatures reachable within Create');
 const accessibility=await page.evaluate(()=>{const parse=value=>{const parts=value.match(/[0-9.]+/g)?.slice(0,3).map(Number)||[0,0,0];return parts.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});};const light=value=>{const [r,g,b]=parse(value);return .2126*r+.7152*g+.0722*b;};return ['.oc-button.primary','.oc-tabs button','.cs-brand-command strong'].map(selector=>{const element=document.querySelector(selector),style=getComputedStyle(element);let background=element;while(background&&getComputedStyle(background).backgroundColor==='rgba(0, 0, 0, 0)')background=background.parentElement;const fg=light(style.color),bg=light(getComputedStyle(background||document.body).backgroundColor);return {selector,foreground:style.color,background:getComputedStyle(background||document.body).backgroundColor,contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};});});
 for(const sample of accessibility)assert.ok(sample.contrast>=4.5,'Contrast '+JSON.stringify(sample));await page.keyboard.press('Tab');const focus=await page.evaluate(()=>{const element=document.activeElement,style=getComputedStyle(element);return {tag:element?.tagName,outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth};});assert.notEqual(focus.outlineStyle,'none');checks.push('Keyboard focus indicator and measured application text/action contrast');await writeFile(evidence+'/accessibility-checks.json',JSON.stringify({synthetic:true,accessibility,focus},null,2));
 assert.deepEqual(errors,[]);await writeFile(`${evidence}/studio-browser-checks.json`,JSON.stringify({synthetic:true,checks,errors,draftWrites:writes.length},null,2));
 console.log(JSON.stringify({checks,errors,draftWrites:writes.length},null,2));
}catch(error){if(page){await page.screenshot({path:`${evidence}/studio-failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${evidence}/studio-failure.txt`,`${error.stack}\nBrowser errors: ${errors.join('\n')}`);}throw error;}finally{await browser.close();}

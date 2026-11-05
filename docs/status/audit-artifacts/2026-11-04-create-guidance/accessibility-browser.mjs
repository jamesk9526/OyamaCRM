/** Synthetic browser acceptance fixtures. No real communications, patients, donations, or public publishing. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import domain from '../../../../server/src/oyama-create/domain.ts';
const { renderShared, variantFrom } = domain;
const base=process.env.CREATE_UI_WEB||'http://localhost:3212';
const evidence='docs/status/audit-artifacts/2026-11-04-create-guidance'; await mkdir(evidence,{recursive:true});
const proofBytes=Buffer.from('Unused in guidance checks');
const checks=[], errors=[], warnings=[], writes=[];
const user={id:'synthetic-create-user',organizationId:'synthetic-create-org',role:'admin',firstName:'Taylor',lastName:'Reed',email:'synthetic@example.invalid'};
const permissions=['view:communications','edit:communications','view:campaigns','edit:campaigns','view:events','view:constituents','edit:constituents','letters.view','letters.edit','letters.create','letters.generate_batch','letters.export_pdf','letters.manage_print_queue','create.sms.publish','create.social.publish','create.connections.manage'];
user.permissions=permissions;
const channels=['EMAIL','LETTER','WEB','SMS','SOCIAL']; const now=new Date().toISOString();
const content={id:'synthetic-content',campaignId:'synthetic-campaign',name:'Community appeal message',revision:1,scheduledAt:now,documentJson:{version:1,blocks:[{id:'headline',kind:'heading',text:'Together, we can open more doors.'},{id:'copy',kind:'paragraph',text:'Your generosity creates new possibilities for our community. Help us welcome more neighbors this year.'}]},variants:channels.map(channel=>({id:`synthetic-${channel}`,channel,revision:1,documentJson:variantFrom({subject:'Open more doors with us',caption:['SMS','SOCIAL'].includes(channel)?'Your generosity makes new possibilities. Join our community appeal.':'',ctaLabel:'Learn more',ctaUrl:'https://example.invalid/campaign',formEnabled:channel==='WEB',consentText:'I agree to be contacted about this campaign.',network:'FACEBOOK',accountId:'12345'}),needsReview:false,externalChanges:false,nativeApproved:false,legacyId:null}))};
const campaign={id:'synthetic-campaign',name:'Community appeal',objective:'FUNDRAISING',description:'A synthetic campaign used only for interface verification.',ownerId:user.id,isTemplate:false,status:'DRAFT',revision:1,fundraisingCampaignId:null,eventId:null,audienceListIds:['synthetic-audience'],channelsJson:channels,deliveryMode:'BOTH',startsAt:now,endsAt:null,updatedAt:now,contents:[content],releases:[],_count:{contents:1,releases:0}};
const other={...campaign,id:'synthetic-newsletter',name:'November community update',objective:'NEWSLETTER',status:'ACTIVE',channelsJson:['EMAIL','WEB'],contents:[],_count:{contents:2,releases:1}};
const schedules=()=>campaign.contents.flatMap(item=>item.variants.filter(variant=>campaign.channelsJson.includes(variant.channel)).map(variant=>({contentId:item.id,contentName:item.name,channel:variant.channel,scheduledAt:variant.documentJson.scheduledAt||item.scheduledAt||campaign.startsAt||now})));
const audiences=[{id:'synthetic-audience',name:'Community supporters',description:'Synthetic mixed email and postal audience',_count:{recipients:12}}];
const nativeEmail={id:'native-email',name:'Synthetic native email',status:'DRAFT',subject:'Synthetic email subject',previewText:'',fromName:'Synthetic sender',fromEmail:'sender@example.invalid',replyToEmail:'sender@example.invalid',purpose:'MARKETING',preferenceCategory:'GENERAL_UPDATES',template:{version:1,contentWidth:640,backgroundColor:'#ffffff',fontFamily:'Arial',baseFontSize:16,lineHeight:1.6,textColor:'#26364f',linkColor:'#245ec7',blocks:[{id:'test-text',type:'text',content:'<p>Synthetic editable email copy.</p>'}]},settings:{includeUnsubscribeLink:true,includePhysicalAddress:true,enablePlainTextVersion:true,physicalAddress:'100 Test Way, Test City IL 60000',footerBrandingText:'Synthetic organization'},updatedAt:now,renderedHtml:'<p>Synthetic editable email copy.</p>',renderedText:'Synthetic editable email copy.'};
let enabled=true, sequence=1, readinessIssues=false, conflict=false;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']}); let activePage;
async function fixture(width=1440){
 const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'America/Chicago'});
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  const json=(body,status=200)=>route.fulfill({status,json:body});
  if(path==='/api/auth/refresh')return json({data:{accessToken:'synthetic-ui-session'}});
  if(path==='/api/auth/me')return json({data:user});
  if(req.method()!=='GET'){
   const body=req.postDataJSON();writes.push({path,method:req.method(),body});
   if(path==='/api/oyama-email/templates/native-email'){Object.assign(nativeEmail,body,{updatedAt:new Date().toISOString()});return json(nativeEmail);}
   if(path.endsWith('/proof'))return route.fulfill({contentType:'application/pdf',body:proofBytes});
   if(path.endsWith('/config')){enabled=body.enabled;return json({enabled});}
   if(path==='/api/oyama-create/campaigns'){const created={...campaign,id:`synthetic-new-${++sequence}`,name:body.name,objective:body.objective,channelsJson:body.channels,audienceListIds:body.audienceListIds,deliveryMode:body.deliveryMode,contents:[],isTemplate:body.isTemplate,revision:1};Object.assign(campaign,created);return json(created,201);}
   if(path===`/api/oyama-create/campaigns/${campaign.id}`){Object.assign(campaign,{...body,channelsJson:body.channels,revision:campaign.revision+1});return json(campaign);}
   if(path.endsWith('/contents')){const next={...content,id:`synthetic-piece-${++sequence}`,name:body.name,documentJson:body.document,variants:channels.map(channel=>({...content.variants.find(v=>v.channel===channel),id:`format-${sequence}-${channel}`}))};campaign.contents.push(next);campaign.revision++;return json(next,201);}
   const item=campaign.contents.find(item=>path.includes(`/contents/${item.id}`));
   if(item){
    const variant=item.variants.find(v=>path.endsWith(`/${v.channel}`));
    if(path.includes('/native/')){variant.legacyId=`native-${variant.channel.toLowerCase()}`;campaign.revision++;return json(variant);}
    if(path.includes('/review/')){variant.needsReview=false;variant.externalChanges=false;variant.revision++;campaign.revision++;return json({reviewed:true});}
    if(path.includes('/variants/')){variant.documentJson=body.document;variant.revision++;campaign.revision++;return json({...variant,campaignRevision:campaign.revision});}
    if(conflict){conflict=false;return json({error:{message:'This content has a newer saved revision. Your draft has been preserved.'}},409);}
    item.name=body.name;item.documentJson=body.document;item.scheduledAt=body.scheduledAt;item.revision++;campaign.revision++;for(const v of item.variants)if(Object.keys(v.documentJson.overrides).length)v.needsReview=true;
    return json({...item,campaignRevision:campaign.revision});
   }
   if(path.endsWith('/approve')){campaign.status='APPROVED';campaign.releases=[{id:'synthetic-release',status:'APPROVED',campaignRevision:campaign.revision,approvedAt:now,approvedBy:user.id}];return json({id:'synthetic-release',status:'APPROVED',counts:{EMAIL:8,LETTER:10,SMS:3}},201);}
   if(path.endsWith('/release')){campaign.status='ACTIVE';campaign.releases[0].status='RELEASED';return json({released:true});}
   if(path.includes('/deliveries/'))return json({updated:true});
   if(path.includes('/legacy/import'))return json({campaignId:campaign.id,contentId:campaign.contents[0].id},201);
   if(path.includes('/submissions'))return json({received:true},202);
   if(path.includes('/connections/')&&path.endsWith('/verify'))return json({ready:true});
   return json({error:{message:`Unexpected synthetic write ${path}`}},400);
  }
  if(path==='/api/oyama-create/bootstrap')return json({enabled,permissions,capabilities:channels.map(channel=>({channel,available:true,requiresConnection:['SMS','SOCIAL'].includes(channel),previews:['content']}))});
  if(path==='/api/oyama-create/campaigns')return json({items:url.searchParams.get('templates')==='true'?[]:[campaign,other],hasMore:false});
  if(path===`/api/oyama-create/campaigns/${campaign.id}`)return json(campaign);
  if(path.endsWith('/readiness'))return json({campaignRevision:campaign.revision,ready:!readinessIssues,schedules:schedules(),issues:readinessIssues?[{channel:'SMS',message:'Verify the Azure SMS sender and Event Grid connection in Settings.'}]:[],eligibility:{total:12,overlap:6,excluded:1,missingEmail:4,missingPostal:2,missingSmsConsent:9,counts:{EMAIL:8,LETTER:10,SMS:3}}});
  if(path.endsWith('/results'))return json({deliveries:[{channel:'EMAIL',status:'ACCEPTED',_count:{_all:8}},{channel:'LETTER',status:'PREPARED',_count:{_all:10}}],email:{accepted:8,confirmedDelivered:null,opened:null,clicked:null},giving:null,leads:[],socialInsights:{available:false,reason:'Provider insights are unavailable for this synthetic account.'},eventResultsUrl:null});
  if(path.includes('/preview/')){const item=campaign.contents.find(item=>path.includes(item.id)),variant=item.variants.find(v=>path.endsWith(v.channel));const rendered=renderShared(item.documentJson,variant.documentJson);return json({...rendered,nativeHtml:null,adaptationIssues:[],externalChanges:variant.externalChanges});}
  if(path==='/api/oyama-create/audiences')return json(audiences);
  if(path==='/api/oyama-create/calendar')return json(url.searchParams.get('after')?{items:schedules().map(item=>({id:`${item.contentId}:${item.channel}`,contentId:item.contentId,name:item.contentName,channel:item.channel,scheduledAt:item.scheduledAt,campaignId:campaign.id,campaign:{name:campaign.name,status:campaign.status}})),hasMore:false,nextCursor:null}:{items:[],hasMore:true,nextCursor:'synthetic-next-page'});
  if(path==='/api/oyama-create/connections')return json([{id:'azure-fixture',provider:'AZURE_SMS',readyAt:null,error:null,configJson:{sender:'+15555550999',eventGridVerified:false}},{id:'meta-fixture',provider:'META',readyAt:now,error:null,configJson:{accounts:[{id:'12345',name:'Synthetic Community Page',instagramId:'67890',instagramName:'syntheticcommunity'}]}}]);
  if(path==='/api/oyama-create/legacy')return json({items:[{id:'old-email',channel:'EMAIL',name:'Original appeal template',status:'DRAFT',historical:false,isTemplate:true,campaignId:null},{id:'sent-email',channel:'EMAIL',name:'Prior sent newsletter',status:'SENT',historical:true,isTemplate:false,campaignId:null},{id:'old-letter',channel:'LETTER',name:'Original thank-you letter',status:'ACTIVE',historical:false,isTemplate:true,campaignId:null}],limited:false});
  if(path==='/api/oyama-create/deliveries')return json({items:[{id:'synthetic-delivery',releaseId:'release',channel:'EMAIL',recipientKey:'recipient@example.invalid',status:'PENDING',scheduledAt:now,attempts:0,providerId:null,executionId:null,error:null,release:{campaignId:campaign.id,campaign:{name:campaign.name}}}],total:1,page:1,pageSize:50});
  if(path.includes('/api/oyama-create/public/pages/'))return json({id:'public-fixture',name:campaign.name,document:content.documentJson,format:content.variants.find(v=>v.channel==='WEB').documentJson,publishedAt:now});
  if(path==='/api/oyama-create/leads'||path==='/api/oyama-create/publications'||path==='/api/oyama-create/sms-consent')return json([]);
  if(path.startsWith('/api/oyama-create/legacy/'))return json({campaignId:null});
  if(path.includes('/merge-fields'))return json({groups:[{key:'contact',label:'Contact',available:true,fields:[{token:'{FirstName}',description:'First name'}]}],sections:[{label:'Contact',fields:['{FirstName}','{LastName}']}]});
  if(path==='/api/campaigns'||path==='/api/events'||path==='/api/constituents')return json([]);
  if(path==='/api/letters/production/config')return json({enabled:true});
  if(path==='/api/letters/templates/native-letter')return json({id:'native-letter',name:'Synthetic native letter',category:'GENERAL',printSubject:'Synthetic subject',printBody:'<h2>Synthetic native letter</h2><p>Layout editor acceptance content.</p>',documentSchemaVersion:2,revision:1,documentJson:{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Synthetic native letter'}]},{type:'paragraph',content:[{type:'text',text:'Layout editor acceptance content.'}]}]},printLayoutJson:{}});
  if(path==='/api/oyama-email/templates/native-email')return json(nativeEmail);
  if(path==='/api/settings')return json({smtpFromName:'Synthetic sender',smtpFromEmail:'sender@example.invalid'});
  return json(path.includes('settings')||path.includes('branding')?{}:[]);
 });
 const page=await context.newPage();activePage=page;
 page.on('pageerror',error=>errors.push(error.stack||error.message));page.on('console',msg=>{if(msg.type()==='warning')warnings.push(msg.text());if(msg.type()==='error'&&!msg.text().includes('409'))errors.push(msg.text());});
 page.on('dialog',dialog=>dialog.dismiss());return {page,context};
}
async function go(page,path){await page.goto(base+path,{waitUntil:'networkidle',timeout:60000});}
async function shot(page,name){await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:Array.from(document.querySelectorAll('body *')).map(el=>({tag:el.tagName,class:typeof el.className==='string'?el.className:'',right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).filter(el=>el.right>innerWidth+1).slice(0,12)}));if(overflow.scroll>overflow.width)console.error({name,...overflow});assert.equal(overflow.scroll>overflow.width,false,'Viewport overflow');await page.screenshot({path:`${evidence}/${name}.png`,fullPage:true});}
try {
 const {page}=await fixture();await go(page,`/oyama-create/campaigns/${campaign.id}`);
 const button=page.getByRole('button',{name:'Next: choose audience',exact:true});await button.waitFor();await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
 assert.ok(await button.evaluate(el=>el===document.activeElement&&parseFloat(getComputedStyle(el).outlineWidth)>=2),'Visible keyboard focus');
 const contrast=await page.locator('.oc-task-guide p').evaluate(el=>{const luminance=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const a=luminance(getComputedStyle(el).color),b=luminance(getComputedStyle(el.parentElement.parentElement).backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
 assert.ok(contrast>=4.5);await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Choose who receives this campaign',exact:true}).waitFor();assert.equal(writes.length,0);
 await writeFile(`${evidence}/accessibility-checks.json`,JSON.stringify({fixture:'Synthetic browser APIs',keyboardFocus:'Visible; Enter activates next step',helperContrast:contrast,errors},null,2));assert.deepEqual(errors,[]);
} finally {await browser.close();}

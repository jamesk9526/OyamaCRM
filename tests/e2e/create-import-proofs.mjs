/** Production renderer with synthetic converted content; no database writes or print jobs. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import conversionModule from '../../server/src/oyama-create/studio/conversion.ts';
import printModule from '../../server/src/oyama-create/studio/print.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import channelModule from '../../server/src/oyama-create/studio/channel-render.ts';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import brandModule from '../../server/src/oyama-create/studio/brand.ts';
import domainModule from '../../server/src/oyama-create/domain.ts';
const {convertLegacy}=conversionModule,{freezeStudioPrint,renderFrozenStudio}=printModule,{emptyDonor}=renderModule,{renderChannel}=channelModule,{sourceIdentity,walkNodes}=designModule,{normalizeBrand}=brandModule,{variantFrom}=domainModule;
const dir='docs/status/audit-artifacts/2026-11-04-create-unified-import';await mkdir(dir,{recursive:true});
const brand=normalizeBrand({version:1,identity:{organizationDisplayName:'Synthetic Community Foundation',streetAddress1:'100 Test Way',city:'Test City',stateProvince:'IL',postalCode:'60000',footerLegalText:'Synthetic conversion fixture only'},signers:[],presets:[],profiles:[],defaultSignerId:null});
const donor={...emptyDonor('2026-11-04T12:00:00Z'),available:true,sensitiveAllowed:true,name:'Jordan Sample',salutation:'Dear Jordan,',address:'200 Test Street\nTest City IL 60000',constituentId:'synthetic-donor',entityKind:'INDIVIDUAL'};
const original='<h2>A lasting difference</h2><p>Dear <strong>{{donor.fullName}}</strong>,</p><p>Your generosity supports our neighbors. This is synthetic content for conversion verification.</p><div style="background-color:#edf4fc;padding:16px"><p><strong>Original preserved layout</strong></p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px">Education</td><td style="padding:8px">Community support</td></tr></table></div><p>Every gift helps us plan the next chapter.</p>';
const letter=convertLegacy({name:'Converted letter',printBody:original,printLayoutJson:{paper:'Letter',margins:{top:.8,right:.75,bottom:.8,left:.75}}},'LETTER');
for(const node of walkNodes(letter.design.body))if(node.type==='studioHtml')node.attrs.reviewedHtml=node.attrs.html;
letter.design.pack.replySlip={enabled:true,placement:'separate',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Please use my gift where it is needed most.'}]}]}};letter.design.pack.outerEnvelope.enabled=true;letter.design.pack.returnEnvelope.enabled=true;
const results=[];
for(const kind of ['LETTER','REPLY_SLIP','OUTER_ENVELOPE','RETURN_ENVELOPE']){
 const preview=renderChannel(letter.design,donor,brand,'LETTER',variantFrom({}),kind),snapshot=await freezeStudioPrint('synthetic-org',letter.design,donor,brand,kind,true);
 assert.equal(snapshot.html,preview.html);const rendered=await renderFrozenStudio(snapshot,true);assert.equal(rendered.pageCount,1);
 await writeFile(`${dir}/converted-${kind.toLowerCase()}.pdf`,rendered.bytes);results.push({kind,pages:rendered.pageCount,previewMatchesFrozenHtml:true});
}
const sourceEmail={name:'Converted email',subject:'A lasting difference',previewText:'Synthetic email preview',bodyHtml:original,templateJson:JSON.stringify({template:{contentWidth:640,blocks:[{id:'heading',type:'header',headerTitle:'A lasting difference'},{id:'copy',type:'text',content:'<p>Dear {{donor.fullName}},</p><p>Your generosity supports our neighbors.</p>'},{id:'columns',type:'columns',leftHtml:'<p>Education opportunities</p>',rightHtml:'<p>Community support</p>'},{id:'action',type:'button',label:'Read our story',href:'https://example.invalid/story'},{id:'html',type:'html',html:'<div style="background-color:#edf4fc;padding:16px"><p>Original preserved layout</p></div>'}]},settings:{footerBrandingText:'Synthetic conversion fixture'}})};
const email=convertLegacy(sourceEmail,'EMAIL');for(const node of walkNodes(email.design.body))if(node.type==='studioHtml')node.attrs.reviewedHtml=node.attrs.html;
email.design.channels={EMAIL:{document:structuredClone(email.design.body),reviewedSource:sourceIdentity(email.design)}};
const output=renderChannel(email.design,donor,brand,'EMAIL',variantFrom({}));assert.equal(output.issues.filter(item=>item.blocking).length,0);assert.ok(output.html.includes('Read our story'));assert.ok(output.html.includes('Jordan Sample'));
await writeFile(`${dir}/converted-email.html`,output.html);await writeFile(`${dir}/converted-email.txt`,output.text);
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});try{const page=await browser.newPage();for(const width of [800,375]){await page.setViewportSize({width,height:1000});await page.setContent(output.html);await page.screenshot({path:`${dir}/converted-email-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}}finally{await browser.close();}
await writeFile(`${dir}/proof-checks.json`,JSON.stringify({synthetic:true,results,email:{blockingIssues:0,desktopMobileRendered:true},diagnostics:{letter:letter.diagnostics,email:email.diagnostics}},null,2));
console.log(JSON.stringify({results,emailBlockingIssues:0},null,2));

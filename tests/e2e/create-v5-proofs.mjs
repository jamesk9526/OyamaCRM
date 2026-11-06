/** Synthetic renderer regression corpus, never a claim of real legacy-template equivalence. */
import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import unifiedModule from '../../server/src/oyama-create/studio/unified-document.ts';
import registryModule from '../../server/src/oyama-create/studio/registry.ts';
import brandModule from '../../server/src/oyama-create/studio/brand.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import printModule from '../../server/src/oyama-create/studio/print.ts';
const {defaultDesign,dimensions}=designModule,{upgradeUnifiedDesign}=unifiedModule,{newBlock,paragraph}=registryModule;
const {normalizeBrand}=brandModule,{emptyDonor,renderStudio}=renderModule,{freezeStudioPrint,renderFrozenStudio}=printModule;
const evidence='docs/status/audit-artifacts/2026-11-06-create-v5';await mkdir(evidence,{recursive:true});
const brand=normalizeBrand({version:1,identity:{organizationDisplayName:'Synthetic care center',streetAddress1:'100 Test Way',city:'Test City',stateProvince:'IL',postalCode:'60000',footerLegalText:'Synthetic output acceptance only'},profiles:[],presets:[],signers:[{id:'one',name:'Director',signerName:'Taylor Reed',signerTitle:'Director',typedSignature:'Taylor Reed',active:true},{id:'two',name:'Chair',signerName:'Morgan Sample',signerTitle:'Board chair',typedSignature:'Morgan Sample',active:true}],defaultSignerId:'one'});
const donor={...emptyDonor('2026-11-06T12:00:00Z'),available:true,sensitiveAllowed:true,constituentId:'synthetic-recipient',name:'Jordan Sample',salutation:'Dear Jordan,',address:'200 Sample Street\nTest City, IL 60000',entityKind:'INDIVIDUAL',currency:'USD',mergeValues:{'donor.firstName':'Jordan','donor.lastName':'Sample'},gift:{id:'synthetic-gift',amount:125,date:'2026-11-01T12:00:00Z',fund:'General',receiptNumber:'SYNTHETIC-1',deductible:125},giving:{total:125,count:1,largest:125,lastAmount:125,firstDate:'2026-11-01T12:00:00Z',lastDate:'2026-11-01T12:00:00Z',gifts:[{amount:125,date:'2026-11-01T12:00:00Z',fund:'General'}]}};
const base=defaultDesign();base.brandRevisionId='synthetic-brand';base.body.content=[paragraph('greeting','Dear {first} {last},'),paragraph('copy','Thank you for supporting families. This synthetic letter verifies preserved copy, recipient fields, and printed geometry.'),newBlock('studioReceipt','receipt'),{...newBlock('studioSignature','signatures'),attrs:{...newBlock('studioSignature','signatures').attrs,signerId:'one',secondSignerId:'two'}}];
base.body.content[2].attrs.statement='No goods or services were provided.';
base.regions.firstHeader={mode:'custom',presetId:'',content:{type:'doc',content:[paragraph('header','Synthetic care center · {first} {last}')]}};
const results=[];
for(const paper of ['LETTER','A4','LEGAL','HALF_LETTER']){
  const original=structuredClone(base);original.page.paper=paper;
  const upgraded=upgradeUnifiedDesign(original);
  const before=renderStudio(original,donor,brand),after=renderStudio(upgraded,donor,brand);assert.equal(after.html,before.html);assert.deepEqual(after.issues,before.issues);
  const snapshot=await freezeStudioPrint('synthetic-org',upgraded,donor,brand,'LETTER');assert.equal(snapshot.version,2);
  const rendered=await renderFrozenStudio(snapshot);const pdf=await PDFDocument.load(rendered.bytes),size=dimensions(upgraded.page);
  assert.ok(Math.abs(pdf.getPage(0).getWidth()-size.width*.75)<1);assert.ok(Math.abs(pdf.getPage(0).getHeight()-size.height*.75)<1);
  await writeFile(`${evidence}/proof-${paper.toLowerCase()}.pdf`,rendered.bytes);results.push({paper,pages:pdf.getPageCount(),width:pdf.getPage(0).getWidth(),height:pdf.getPage(0).getHeight(),preservedHtml:true});
}
const long=upgradeUnifiedDesign(base);long.body.content=[];
for(let i=1;i<=3;i++){if(i>1)long.body.content.push(newBlock('letterPageBreak','break-'+i));long.body.content.push(paragraph('paragraph-'+i,`Synthetic explicit page ${i}. `+'Long recipient-safe content. '.repeat(20)));}
const table=newBlock('table','annual-table');table.content=[{type:'tableRow',content:[{type:'tableHeader',content:[paragraph('th1','Gift')]},{type:'tableHeader',content:[paragraph('th2','Amount')]}]},...Array.from({length:40},(_,i)=>({type:'tableRow',content:[{type:'tableCell',content:[paragraph(`row-${i}-a`,`Synthetic gift ${i+1}`)]},{type:'tableCell',content:[paragraph(`row-${i}-b`,'$25.00')]}]}))];long.body.content.push(table);
long.pack.replySlip.enabled=true;long.pack.replySlip.placement='separate';long.pack.replySlip.content.content=[paragraph('reply-heading','Synthetic reply slip'),{...newBlock('studioResponse','reply-choices'),attrs:{...newBlock('studioResponse','reply-choices').attrs,amounts:[25,50,100]}}];long.pack.outerEnvelope.enabled=true;long.pack.returnEnvelope.enabled=true;
const longDonor={...donor,name:'The Synthetic Alexandra and Christopher Sample Household',salutation:'Dear Alexandra and Christopher,',mergeValues:{'donor.firstName':'Alexandra and Christopher','donor.lastName':'Sample Household'}};
for(const kind of ['LETTER','REPLY_SLIP','OUTER_ENVELOPE','RETURN_ENVELOPE']){
  const snapshot=await freezeStudioPrint('synthetic-org',long,longDonor,brand,kind,true),rendered=await renderFrozenStudio(snapshot,true);
  await writeFile(`${evidence}/pack-${kind.toLowerCase()}.pdf`,rendered.bytes);results.push({kind,pages:rendered.pageCount,recipient:'synthetic long household'});
}
const denied=renderStudio(upgradeUnifiedDesign(base),{...donor,sensitiveAllowed:false},brand);assert.ok(denied.issues.some(issue=>issue.code==='DONOR_PERMISSION'));assert.ok(!denied.html.includes('$125.00'));
await writeFile(`${evidence}/proof-checks.json`,JSON.stringify({synthetic:true,scope:'Schema upgrade compatibility and current Chromium production output; original jsPDF and physical print acceptance remain separate gates',results},null,2));
console.log(JSON.stringify({results},null,2));

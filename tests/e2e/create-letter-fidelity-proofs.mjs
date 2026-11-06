/** Synthetic recipient-specific print regression; no database writes or dispatch. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import printModule from '../../server/src/oyama-create/studio/print.ts';
const {defaultDesign}=designModule,{emptyDonor}=renderModule,{freezeStudioPrint,renderFrozenStudio}=printModule;
const dir='docs/status/audit-artifacts/2026-11-05-standalone-communications';await mkdir(dir,{recursive:true});
const brand={version:1,identity:{organizationDisplayName:'Synthetic Care Center'},profiles:[],presets:[{id:'continue',kind:'header',name:'Continuation',content:{type:'doc',content:[]},legacyHtml:'<p>Continuation for {first} {last}</p>',active:true,isDefault:false}],signers:[{id:'signer',name:'QA signer',signerName:'Synthetic Director',signerTitle:'Director',closingPhrase:'With gratitude,',signatureImageUrl:'',typedSignature:'',email:'',phone:'',active:true}],defaultSignerId:'signer'};
const design=defaultDesign();design.page.margins.top=1.25;
design.regions.firstHeader={mode:'custom',presetId:'',content:{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Synthetic Care Center'}]},{type:'paragraph',content:[{type:'text',text:'To {first} {last}'}]}]}};
design.regions.header={mode:'brand',presetId:'continue',content:{type:'doc',content:[]}};
for(const key of ['firstFooter','footer'])design.regions[key]={mode:'custom',presetId:'',content:{type:'doc',content:[{type:'studioHtml',attrs:{html:'<p>Approved footer · Page <span data-studio-page-number>1</span> of <span data-studio-total-pages>1</span></p>',reviewedHtml:'<p>Approved footer · Page <span data-studio-page-number>1</span> of <span data-studio-total-pages>1</span></p>'}}]}};
design.body.content=[{type:'paragraph',content:[{type:'text',text:'Dear {first} {last}, thank you for {{donation.amount}} on {{donation.date}}.'}]},...Array.from({length:8},(_,i)=>({type:'paragraph',content:[{type:'text',text:`Synthetic paragraph ${i+1}. Your partnership supports this test program. This content checks wrapping, spacing and recipient isolation.`}]})),{type:'letterPageBreak',attrs:{studioId:'explicit-break'}},{type:'paragraph',content:[{type:'text',text:'Second-page message for {first} {last}.'}]},{type:'studioSignature',attrs:{signerId:'signer',studioId:'signature'}}];
const results=[];
for(const [first,last,amount] of [['Jordan','Rivera',125],['Morgan','Chen',280]]){
 const donor={...emptyDonor('2026-11-05T12:00:00Z'),available:true,sensitiveAllowed:true,name:`${first} ${last}`,salutation:`Dear ${first},`,address:'100 Synthetic Way\nTest City IL 60000',entityKind:'INDIVIDUAL',mergeValues:{'donor.firstName':first,'donor.lastName':last},gift:{id:'synthetic-'+first,amount,date:'2026-11-01T00:00:00Z',fund:'General',receiptNumber:'QA',deductible:amount}};
 const frozen=await freezeStudioPrint('synthetic-org',design,donor,brand);
 assert.deepEqual(frozen.issues,[]);
 assert.ok(frozen.headers[0].includes(first));assert.ok(frozen.headers[1].includes(first));assert.ok(frozen.html.includes('$'+amount.toFixed(2)));
 const output=await renderFrozenStudio(frozen);assert.equal(output.pageCount,2);
 await writeFile(`${dir}/${first.toLowerCase()}-proof.pdf`,output.bytes);
 results.push({recipient:donor.name,pages:output.pageCount,issues:frozen.issues,headersResolved:true,amount});
}
const clipped={...design,page:{...design.page,margins:{...design.page.margins,top:.125}}};
const frozen=await freezeStudioPrint('synthetic-org',clipped,{...emptyDonor(),available:true,sensitiveAllowed:true,name:'Test',mergeValues:{'donor.firstName':'Test','donor.lastName':'Recipient'},gift:{id:'test',amount:1,date:'2026-11-01',fund:'General',receiptNumber:'QA',deductible:1}},brand);
await assert.rejects(()=>renderFrozenStudio(frozen),/header exceeds its reserved margin/);
await writeFile(`${dir}/proof-checks.json`,JSON.stringify({data:'Synthetic recipient fixtures',results,clippedHeaderRejected:true},null,2));console.log(JSON.stringify(results));

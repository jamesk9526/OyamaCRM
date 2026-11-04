/** Uses the production Chromium renderer with synthetic donor data. Never creates print jobs. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import printModule from '../../server/src/oyama-create/studio/print.ts';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import renderModule from '../../server/src/oyama-create/studio/render.ts';
import registryModule from '../../server/src/oyama-create/studio/registry.ts';
import brandModule from '../../server/src/oyama-create/studio/brand.ts';
const {freezeStudioPrint,renderFrozenStudio}=printModule,{defaultDesign}=designModule,{emptyDonor}=renderModule,{paragraph,newBlock}=registryModule,{normalizeBrand}=brandModule;
const dir='docs/status/audit-artifacts/2026-11-03-create-studio';await mkdir(dir,{recursive:true});const results=[];
const brand=normalizeBrand({version:1,identity:{organizationDisplayName:'Synthetic Community Foundation',streetAddress1:'100 Test Way',city:'Test City',stateProvince:'IL',postalCode:'60000',footerLegalText:'Synthetic proof fixture - never for production mailing'},signers:[{id:'synthetic-signer',name:'Executive director',signerName:'Taylor Reed',signerTitle:'Executive Director',typedSignature:'Taylor Reed',closingPhrase:'With gratitude,',active:true}],presets:[],profiles:[],defaultSignerId:'synthetic-signer'});
const donor={...emptyDonor('2026-11-03T12:00:00Z'),available:true,sensitiveAllowed:true,constituentId:'synthetic-donor',name:'Jordan Sample',salutation:'Dear Jordan,',address:'200 Test Street\nTest City IL 60000',entityKind:'INDIVIDUAL',responseCode:'synthetic-response-code-fixture'};
for(const count of [1,2,5,20]){
 const d=defaultDesign();d.brandRevisionId='synthetic-brand';d.body.content=[];
 for(let n=1;n<=count;n++){if(n>1)d.body.content.push(newBlock('letterPageBreak',`break-${n}`));d.body.content.push({type:'heading',attrs:{studioId:`head-${n}`,level:2},content:[{type:'text',text:`Synthetic page ${n}`}]},paragraph(`text-${n}`,'A synthetic appeal paragraph checks editable flow and final output. '.repeat(12)));}
 const frozen=await freezeStudioPrint('synthetic-org',d,donor,brand),pdf=await renderFrozenStudio(frozen,true);assert.equal(pdf.pageCount,count,`Expected ${count} pages`);await writeFile(`${dir}/proof-${count}-pages.pdf`,pdf.bytes);results.push({fixture:`${count} pages`,pages:pdf.pageCount});
}
const d=defaultDesign();d.brandRevisionId='synthetic-brand';d.data.givingUrl='https://example.invalid/give/synthetic';d.body.content=[newBlock('studioSalutation','salutation'),paragraph('appeal','Your support creates more opportunities for our neighbors. '.repeat(8)),newBlock('studioQr','giving-qr'),newBlock('table','gift-table')];
const table=d.body.content.at(-1);table.content=[table.content[0],...Array.from({length:60},(_,index)=>({type:'tableRow',content:[{type:'tableCell',attrs:{colspan:1,rowspan:1},content:[paragraph(`row-${index}-a`,`Gift row ${index+1}`)]},{type:'tableCell',attrs:{colspan:1,rowspan:1},content:[paragraph(`row-${index}-b`,'Synthetic table content that must remain visible.')] }]}))];
const merged=table.content[5].content[0];merged.attrs.rowspan=6;for(let row=6;row<=10;row++)merged.content.push(...table.content[row].content.shift().content);
d.body.content.push(newBlock('studioSignature','signature'));d.pack.replySlip={enabled:true,placement:'separate',content:{type:'doc',content:[newBlock('studioResponse','reply')]}};d.pack.replySlip.content.content[0].attrs.amounts=[25,50,100];d.pack.outerEnvelope.enabled=true;d.pack.returnEnvelope.enabled=true;
for(const kind of ['LETTER','REPLY_SLIP','OUTER_ENVELOPE','RETURN_ENVELOPE']){const frozen=await freezeStudioPrint('synthetic-org',d,donor,brand,kind,true),pdf=await renderFrozenStudio(frozen,true);await writeFile(`${dir}/appeal-${kind.toLowerCase()}.pdf`,pdf.bytes);results.push({fixture:kind,pages:pdf.pageCount});}
const oversized=defaultDesign();oversized.body.content=[{type:'studioGroup',attrs:{studioId:'oversized',keepTogether:true},content:[paragraph('long','Unsplit oversized group. '.repeat(700))]}];const frozen=await freezeStudioPrint('synthetic-org',oversized,donor,brand);await assert.rejects(()=>renderFrozenStudio(frozen,true),/taller|exceeds/);results.push({fixture:'oversized group',rejected:true});
await writeFile(`${dir}/proof-checks.json`,JSON.stringify({synthetic:true,results},null,2));console.log(JSON.stringify(results,null,2));

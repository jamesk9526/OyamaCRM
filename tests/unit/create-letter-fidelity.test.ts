import { describe, expect, it } from 'vitest';
import type { LetterTemplate } from '@prisma/client';
import { defaultDesign } from '@/server/src/oyama-create/studio/design';
import { convertLegacy } from '@/server/src/oyama-create/studio/conversion';
import { emptyDonor, renderStudio, renderRegion, regionIssues } from '@/server/src/oyama-create/studio/render';
import { exportHtmlDocument } from '@/server/src/oyama-create/studio/html-document';
import type { BrandDocument } from '@/server/src/oyama-create/studio/types';
import { restoreLegacyLogoBounds } from '@/server/src/oyama-create/studio/html';
const brand:BrandDocument={version:1,identity:{organizationDisplayName:'Synthetic Care Center',logoUrl:'/api/public-media/branding/synthetic/logo.png'},profiles:[],signers:[],defaultSignerId:null,presets:[]};
const donor={...emptyDonor(),available:true,sensitiveAllowed:true,name:'Jordan Rivera',mergeValues:{'donor.firstName':'Jordan','donor.lastName':'Rivera'},gift:{id:'gift',amount:125,date:'2026-11-01T00:00:00.000Z',fund:'General',receiptNumber:'QA-1',deductible:125}};
describe('legacy letter conversion and header fidelity',()=>{
 it('does not disclose sensitive legacy values or donor markup without permission',()=>{
  const design=defaultDesign(),html='<p>{first} {{gift.amount}}</p>';
  design.body.content=[{type:'studioHtml',attrs:{html,reviewedHtml:html}}];
  const denied=renderStudio(design,{...donor,sensitiveAllowed:false,mergeValues:{'donor.firstName':'<script>unsafe()</script>','gift.amount':'SECRET'}},brand);
  expect(denied.issues.some(item=>item.code==='DONOR_PERMISSION')).toBe(true);expect(denied.html).not.toContain('SECRET');expect(denied.html).not.toContain('<script>');
  const allowed=renderStudio(design,{...donor,mergeValues:{'donor.firstName':'<img src=x onerror=unsafe()>'}},brand);
  expect(allowed.html).toContain('&lt;img');expect(allowed.html).not.toContain('<img');
 });
 it('repairs only the recognizable duplicated automatic legacy header logo',()=>{
  const logo=String(brand.identity.logoUrl),inner=`<div style="font-size:8px"><img src="${logo}"><h1>Original</h1></div>`;
  const duplicated=`<div style="font-size:8px"><img src="${logo}" style="max-width:140px;max-height:35px">${inner}</div>`;
  expect(restoreLegacyLogoBounds(duplicated,logo).match(/<img\b/g)).toHaveLength(1);
  expect(restoreLegacyLogoBounds(`<p><img src="${logo}"><img src="${logo}"></p>`,logo).match(/<img\b/g)).toHaveLength(2);
 });
 it('resolves single-brace fields inside preserved HTML and formats gift aliases',()=>{
  const design=defaultDesign(),html='<p style="text-align:left">Dear {first} {last}, {{donation.amount}} on {{donation.date}}</p>';
  design.body.content=[{type:'studioHtml',attrs:{studioId:'original',html,reviewedHtml:html}}];
  const rendered=renderStudio(design,donor,brand);
  expect(rendered.html).toContain('Dear Jordan Rivera, $125.00 on 11/1/2026');expect(rendered.issues).toEqual([]);
 });
 it('keeps original merge tokens visible in setup preview and HTML source',()=>{
  const letter={name:'Original',printBody:'<p>Dear {first} {last}, {{donation.amount}}</p>',printLayoutJson:{}} as LetterTemplate;
  const {design}=convertLegacy(letter,'LETTER');
  expect(renderStudio(design,emptyDonor(),brand).html).toContain('{first}');
  expect(exportHtmlDocument(design,brand)).toContain('{first}');
 });
 it('resolves donor fields in original header presets and retains their authoring tokens',()=>{
  const design=defaultDesign();design.regions.firstHeader.presetId='personalized';
  const custom={...brand,presets:[{id:'personalized',name:'Personalized',kind:'header' as const,content:{type:'doc' as const,content:[]},legacyHtml:'<p>To {first} {last}</p>',active:true,isDefault:false}]};
  expect(renderRegion(design,donor,custom,'firstHeader')).toContain('To Jordan Rivera');
  expect(regionIssues(design,donor,custom)).toEqual([]);
  expect(exportHtmlDocument(design,custom)).toContain('To {first} {last}');
  expect(regionIssues(design,emptyDonor(),custom).some(item=>item.blocking)).toBe(true);
 });
 it('uses the shared content styling wrapper for structured header regions',()=>{
  const design=defaultDesign();design.regions.firstHeader={mode:'custom',presetId:'',content:{type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Synthetic Care Center'}]}]}};
  expect(renderRegion(design,donor,brand,'firstHeader')).toContain('class="studio-content"');
 });
 it('preserves already-delimited merge-field tokens in structured legacy letters',()=>{
  const letter={name:'Original',printBody:'<p>Original</p>',printLayoutJson:{},documentSchemaVersion:2,documentJson:{type:'doc',content:[{type:'paragraph',content:[{type:'mergeField',attrs:{token:'{{donor.fullName}}'}}]}]}} as unknown as LetterTemplate;
  expect(convertLegacy(letter,'LETTER').design.body.content[0].content?.[0].text).toBe('{{donor.fullName}}');
 });
});

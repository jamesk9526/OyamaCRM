import type { Request } from 'express';
import type { CreateCampaign } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from '../helpers/create-memory-database';
vi.mock('@/server/src/lib/prisma',()=>({prisma:db}));
import { resolveStudioDonor } from '@/server/src/oyama-create/studio/donor';
import { readLegacyBrand, sanitizeBrandHtml } from '@/server/src/oyama-create/studio/brand-service';
import { renderRegion, renderStudio, regionIssues } from '@/server/src/oyama-create/studio/render';
import { defaultDesign, DONOR_FIELDS } from '@/server/src/oyama-create/studio/design';
import { SUPPORTED_LETTER_MERGE_FIELDS, SIMPLE_LETTER_MERGE_FIELDS, collectMergeFieldKeys } from '@/server/src/services/letters-merge';
const org='synthetic-merge-org', actor={user:{sub:'staff',orgId:org,role:'admin',email:'staff@example.invalid'}} as Request;
const campaign={id:'create',organizationId:org,fundraisingCampaignId:'fundraise'} as CreateCampaign;
beforeEach(async()=>{
 resetCreateRows();
 await db.organization.create({data:{id:org,name:'Synthetic Foundation'}});
 await db.organizationSettings.create({data:{organizationId:org,currency:'USD',fiscalYearStart:1}});
 await db.user.create({data:{id:'staff',organizationId:org,firstName:'QA',lastName:'Director',jobTitle:'Director',email:'staff@example.invalid'}});
 await db.pluginSetting.create({data:{organizationId:org,pluginKey:'organization-branding',config:{organizationDisplayName:'Synthetic Foundation',missionStatement:'Care',streetAddress1:'100 Org Street',city:'Town',stateProvince:'IL',postalCode:'60000',contactPhone:'555-0100',contactEmail:'org@example.invalid',websiteUrl:'https://example.invalid',taxId:'QA-TAX',globalHeaderHtml:'<table style="width:100%"><tr><td><img src="/uploads/branding/synthetic-merge-org/header.png" style="width:120px"></td><td><p>To {first} {last}</p><p>{address}</p></td></tr></table>',globalFooterHtml:'<p>Original footer {{organization.name}}</p>'}}});
 await db.campaign.create({data:{id:'fundraise',organizationId:org,name:'Annual Appeal',goal:1000}});
 await db.event.create({data:{id:'event',organizationId:org,name:'Donor Dinner'}});
 await db.constituent.create({data:{id:'person',organizationId:org,firstName:'Jordan',lastName:'Rivera',displayName:'Jordan Rivera',entityKind:'INDIVIDUAL',organizationName:'QA Company',organizationCategory:'Business',contactFirstName:'Casey',contactLastName:'Rivera',contactTitle:'Coordinator',email:'recipient@example.invalid',phone:'555-0101',addressLine1:'200 Donor Street',addressLine2:'Suite 2',city:'Town',state:'IL',zip:'60000',country:'US',tags:[]}});
 await db.designation.create({data:{id:'designation',organizationId:org,name:'General'}});
 await db.donation.create({data:{id:'gift',constituentId:'person',amount:125,date:new Date('2026-10-01T00:00:00Z'),status:'COMPLETED',designationId:'designation',campaignId:'fundraise',eventId:'event',paymentMethod:'CREDIT_CARD',receiptNumber:'QA-001',taxDeductible:true,taxDeductibleAmount:100}});
});
describe('complete legacy catalog in Create',()=>{
 it('resolves every supported old field with real service context and imports global header layout',async()=>{
  const design=defaultDesign();design.data.year=2026;
  const donor=await resolveStudioDonor(actor,campaign,design,'person',new Date('2026-11-05'));
  donor.mergeValues!['household.name']='Rivera Household';
  const brand=sanitizeBrandHtml(await readLegacyBrand(org));
  for(const token of SUPPORTED_LETTER_MERGE_FIELDS){
   design.body.content=[{type:'paragraph',content:[{type:'text',text:token}]}];
   const output=renderStudio(design,donor,brand);
   expect(output.issues,token).toEqual([]);expect(output.html,token).not.toContain('{{');
  }
  design.body.content=[{type:'paragraph',content:[{type:'text',text:SIMPLE_LETTER_MERGE_FIELDS.join(' | ')}]}];
  expect(renderStudio(design,donor,brand).issues).toEqual([]);
  expect(renderRegion(design,donor,brand,'firstHeader')).toContain('To Jordan Rivera');
  expect(renderRegion(design,donor,brand,'firstHeader')).toContain('<table');
  expect(renderRegion(design,donor,brand,'firstHeader')).toContain('width:120px');
  expect(regionIssues(design,donor,brand)).toEqual([]);
  expect(collectMergeFieldKeys(...SUPPORTED_LETTER_MERGE_FIELDS).every(key=>DONOR_FIELDS.includes(key))).toBe(true);
 });
 it('resolves new field tokens and structured legacy fields through the same values',async()=>{
  const design=defaultDesign();design.data.year=2026;
  const donor=await resolveStudioDonor(actor,campaign,design,'person');const brand=await readLegacyBrand(org);
  design.body.content=[{type:'paragraph',content:[{type:'text',text:'{{name}} {{giving.total}} {{giving.count}} {{gift.deductible}}'}]},{type:'studioField',attrs:{field:'donor.firstName'}}];
  const output=renderStudio(design,donor,brand);expect(output.issues).toEqual([]);expect(output.text).toContain('$125.00');expect(output.text).toContain('$100.00');expect(output.text).toContain('Jordan');
 });
 it('keeps organization greetings compatible and denies sensitive field resolution',async()=>{
  await db.constituent.update({where:{id:'person'},data:{entityKind:'ORGANIZATION',organizationName:'QA Church'}});
  await db.userPermission.create({data:{userId:'staff',permission:'letters.view_sensitive_merge_data',granted:false}});
  const design=defaultDesign(),donor=await resolveStudioDonor(actor,campaign,design,'person'),brand=await readLegacyBrand(org);
  expect(donor.mergeValues!['donor.firstName']).toBe('QA Church');expect(donor.mergeValues!['donor.lastName']).toBe('');expect(donor.gift).toBeNull();
  design.body.content=[{type:'paragraph',content:[{type:'text',text:'{{giving.total}} {{year.taxDeductibleTotal}}'}]}];
  expect(renderStudio(design,donor,brand).issues.some(item=>item.code==='DONOR_PERMISSION')).toBe(true);
  expect(rows.createDelivery).toHaveLength(0);
 });
});

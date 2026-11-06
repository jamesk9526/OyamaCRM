import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma",()=>({prisma:db}));
import routes from "@/server/src/oyama-create/routes";
import { signAccessToken } from "@/server/src/lib/auth";
import { importCommunication, processImports } from "@/server/src/oyama-create/import-service";
import type { Request } from "express";
const app=express();app.use(express.json({limit:"5mb"}));app.use('/api/oyama-create',routes);
app.use((error:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{void _next;res.status(500).json({error:error.message});});
const org='synthetic-import-org';
const call=(method:'get'|'post'|'patch',path:string,body?:unknown,role='admin',orgId=org)=>request(app)[method]('/api/oyama-create'+path).set('Authorization','Bearer '+signAccessToken({sub:'admin',orgId,role,email:'synthetic@example.invalid'})).send(body as object);
beforeEach(async()=>{resetCreateRows();await db.user.create({data:{id:'admin',organizationId:org,role:'admin',active:true,email:'synthetic@example.invalid'}});await db.organization.create({data:{id:org,name:'Synthetic organization'}});});
describe('automatic Create import',()=>{
 it('imports letters and emails when legacy letterhead contains unfrozen images',async()=>{
  const headerHtml=`<p><img src="/uploads/branding/${org}/header.png" alt="Letterhead" onerror="unsafe()"></p>`;
  const footerHtml='<p><img src="https://example.invalid/footer.png" alt="Footer"></p>';
  await db.letterHeaderPreset.create({data:{id:'image-header',organizationId:org,name:'Image header',isDefault:true,isActive:true,customHtml:headerHtml}});
  await db.letterFooterPreset.create({data:{id:'image-footer',organizationId:org,name:'Image footer',isDefault:true,isActive:true,customHtml:footerHtml}});
  await db.letterTemplate.create({data:{id:'old-letter',organizationId:org,name:'Existing thank you',printBody:'<p>Original letter</p>',headerPresetId:'image-header',footerPresetId:'image-footer'}});
  await db.emailCampaign.create({data:{id:'old-email',organizationId:org,name:'Existing email',subject:'Original',bodyHtml:'<p>Original email</p>'}});
  const originalLetter=structuredClone(rows.letterTemplate[0]),originalEmail=structuredClone(rows.emailCampaign[0]);
  for(const [channel,legacyId] of [['LETTER','old-letter'],['EMAIL','old-email']]){
   const result=await call('post','/legacy/import',{channel,legacyId});
   expect(result.status,result.text).toBe(201);
  }
  expect(rows.createCampaign).toHaveLength(2);
  const brand=rows.createImportSourceRevision[0].snapshotJson.brand;
  expect(brand.presets.find((item:{id:string})=>item.id==='image-header').legacyHtml).toContain(`/api/public-media/branding/${org}/header.png`);
  expect(brand.presets.find((item:{id:string})=>item.id==='image-footer').legacyHtml).toContain('https://example.invalid/footer.png');
  expect(JSON.stringify(brand)).not.toContain('onerror');
  expect(rows.letterTemplate[0]).toEqual(originalLetter);expect(rows.emailCampaign[0]).toEqual(originalEmail);
  expect(rows.createDelivery).toHaveLength(0);
 });
 it('recovers previously failed letter imports through the existing retry worker',async()=>{
  await db.letterHeaderPreset.create({data:{id:'retry-header',organizationId:org,name:'Existing image header',isDefault:true,isActive:true,customHtml:`<img src="/uploads/branding/${org}/header.png">`}});
  await db.letterTemplate.create({data:{id:'retry-letter',organizationId:org,name:'Previously missing letter',printBody:'<p>Retained message</p>',headerPresetId:'retry-header'}});
  await db.createImportSource.create({data:{organizationId:org,sourceType:'LETTER',sourceId:'retry-letter',name:'Previously missing letter',status:'FAILED',error:'A document image is missing from its frozen asset package.',shared:true}});
  expect((await call('post','/imports/control',{action:'RETRY'})).status).toBe(200);
  for(let n=0;n<12;n++)await processImports(30);
  const source=rows.createImportSource.find(item=>item.sourceId==='retry-letter');
  expect(source?.status).toBe('CONVERTED');expect(source?.error).toBeNull();expect(source?.campaignId).toBeTruthy();
  expect(rows.createCampaign).toHaveLength(1);expect(rows.createDelivery).toHaveLength(0);
 });
 it('still rejects another organization’s letterhead images during import',async()=>{
  await db.letterHeaderPreset.create({data:{id:'foreign-header',organizationId:org,name:'Invalid header',isDefault:true,isActive:true,customHtml:'<img src="/uploads/branding/another-org/header.png">'}});
  await db.letterTemplate.create({data:{id:'foreign-letter',organizationId:org,name:'Foreign image',printBody:'<p>Retained message</p>'}});
  expect((await call('post','/legacy/import',{channel:'LETTER',legacyId:'foreign-letter'})).status).toBe(403);
  expect(rows.createCampaign).toHaveLength(0);
 });
 const actor=()=>({user:{sub:'admin',orgId:org,role:'admin',email:'synthetic@example.invalid'}} as Request);
 const email=(id:string,extra:Record<string,unknown>={})=>db.emailCampaign.create({data:{id,organizationId:org,name:id,subject:'Original',bodyHtml:'<p>Original</p>',...extra}});
 const finish=async()=>{for(let n=0;n<12;n++)await processImports(30);};
 it('inventories without writes, converts more than 100 sources and skips unchanged sources on repeat',async()=>{
  for(let index=0;index<105;index++)for(const type of ['emailCampaign','letterTemplate'])await db[type].create({data:{id:`${type}-${String(index).padStart(4,'0')}`,organizationId:org,name:`Synthetic ${index}`,subject:'Subject',bodyHtml:'<p>Reusable copy</p>',printBody:'<p>Reusable copy</p>',createdByUserId:'admin'}});
  expect((await call('get','/imports/inventory')).body.total).toBe(210);expect(rows.createImportSource).toHaveLength(0);
  expect((await call('post','/imports/ensure',{})).status).toBe(200);
  for(let count=0;count<20;count++)await processImports(30);
  expect(rows.createImportSource).toHaveLength(210);expect(rows.createCampaign).toHaveLength(210);expect(rows.createContent.every(item=>item.designJson?.version===3)).toBe(true);
  expect(rows.createImportSource.filter(item=>item.status==='CONVERTED')).toHaveLength(105);expect(rows.createImportSource.filter(item=>item.status==='NEEDS_REVIEW')).toHaveLength(105);
  const revisions=rows.createImportSourceRevision.length;await call('post','/imports/control',{action:'RESCAN'});for(let count=0;count<20;count++)await processImports(30);
  expect(rows.createCampaign).toHaveLength(210);expect(rows.createImportSourceRevision).toHaveLength(revisions);
  const first=await call('get','/imports/sources?limit=100'),second=await call('get',`/imports/sources?limit=100&after=${first.body.nextCursor}`),third=await call('get',`/imports/sources?limit=100&after=${second.body.nextCursor}`);
  expect(new Set([...first.body.items,...second.body.items,...third.body.items].map(item=>item.id)).size).toBe(210);
  expect(rows.createImportRun[0].inventoryJson.total).toBe(210);
  const campaigns=await call('get','/campaigns?templates=true'),older=await call('get',`/campaigns?templates=true&after=${campaigns.body.nextCursor}`),oldest=await call('get',`/campaigns?templates=true&after=${older.body.nextCursor}`);
  expect(new Set([...campaigns.body.items,...older.body.items,...oldest.body.items].map(item=>item.id)).size).toBe(210);
 });
 it('retains original sent executions and PDFs as history, without new delivery work',async()=>{
  await db.emailCampaign.create({data:{id:'sent',organizationId:org,name:'Sent',subject:'Original',bodyHtml:'<p>Original</p>',status:'SENT',totalRecipients:3,sentAt:new Date()}});
  const original=structuredClone(rows.emailCampaign[0]);await call('post','/imports/ensure',{});for(let n=0;n<9;n++)await processImports();
  expect(rows.createImportSource[0].status).toBe('HISTORICAL');expect(rows.emailCampaign[0]).toEqual(original);expect(rows.createDelivery).toHaveLength(0);
 });
 it('pauses/resumes and retains a Create draft when its legacy source changes',async()=>{
  await db.emailCampaign.create({data:{id:'draft',organizationId:org,name:'Draft',subject:'Original',bodyHtml:'<p>Original</p>'}});
  await call('post','/imports/ensure',{});await call('post','/imports/control',{action:'PAUSE'});expect(await processImports()).toBe(0);
  await call('post','/imports/control',{action:'RESUME'});await processImports();const design=structuredClone(rows.createContent[0].designJson);
  await db.emailCampaign.update({where:{id:'draft'},data:{bodyHtml:'<p>A separate legacy edit</p>'}});await call('post','/imports/control',{action:'RESCAN'});await processImports();
  expect(rows.createContent[0].designJson).toEqual(design);expect(rows.createImportSource[0].status).toBe('SOURCE_CHANGED');expect(rows.createImportSourceRevision).toHaveLength(2);
 });
 it('preserves private sharing and forbids foreign or unprivileged import operations',async()=>{
  await db.emailCampaign.create({data:{id:'private',organizationId:org,name:'Private',subject:'Private',bodyHtml:'<p>Private</p>',audienceFilter:JSON.stringify({_sharing:{ownerId:'other-user',sharedWithOrganization:false}})}});
  await call('post','/imports/ensure',{});await processImports();expect((await call('get','/imports/sources',undefined,'staff')).body.items).toEqual([]);
  expect((await call('post','/imports/ensure',{},'staff')).status).toBe(403);
  expect((await call('get',`/imports/sources/${rows.createImportSource[0].id}`,undefined,'admin','foreign')).status).toBe(404);
 });
 it('upgrades an incomplete binding once and preserves subsequent Studio edits and Trash',async()=>{
  await email('bound');const campaign=await db.createCampaign.create({data:{organizationId:org,ownerId:'admin',name:'Existing binding',audienceListIds:[],channelsJson:['EMAIL']}});
  const content=await db.createContent.create({data:{organizationId:org,campaignId:campaign.id,name:'Existing',documentJson:{version:1,blocks:[]}}});
  await db.createVariant.create({data:{organizationId:org,contentId:content.id,channel:'EMAIL',legacyId:'bound',documentJson:{}}});
  await importCommunication(actor(),org,'admin','EMAIL','bound');expect(rows.createCampaign).toHaveLength(1);expect(rows.createContent[0].designJson.version).toBe(3);
  rows.createContent[0].designJson.email.subject='Edited in Studio';const revisions=rows.createDocumentRevision.length;
  await db.createTrashItem.create({data:{organizationId:org,kind:'CAMPAIGN',resourceId:campaign.id,name:'In Trash',removedBy:'admin'}});
  await importCommunication(actor(),org,'admin','EMAIL','bound');expect(rows.createContent[0].designJson.email.subject).toBe('Edited in Studio');expect(rows.createDocumentRevision).toHaveLength(revisions);expect(rows.createTrashItem[0].restoredAt).toBeNull();
 });
 it('uses source IDs to group companions and never groups equal names',async()=>{
  await email('original-email',{name:'Equal name'});await email('unrelated',{name:'Equal name'});
  await db.letterTemplate.create({data:{id:'companion',organizationId:org,name:'Different name',printBody:'<p>Letter companion</p>',printLayoutJson:{schema:'oyama-communication-roundtrip-v1',sourceTemplateId:'original-email'}}});
  const imported=await importCommunication(actor(),org,'admin','EMAIL','original-email');await importCommunication(actor(),org,'admin','EMAIL','unrelated');const letter=await importCommunication(actor(),org,'admin','LETTER','companion');
  expect(letter.campaignId).toBe(imported.campaignId);expect(rows.createCampaign).toHaveLength(2);expect(rows.createContent.find(item=>item.id===imported.contentId)?.designJson.channels.LETTER.document).toBeTruthy();
 });
 it('records Create-generated email executions only as history',async()=>{
  await email('execution',{status:'SENT',audienceFilter:JSON.stringify({_create:{deliveryId:'existing-delivery'}})});
  await call('post','/imports/ensure',{});await finish();expect(rows.createCampaign).toHaveLength(0);expect(rows.createImportSource[0].status).toBe('HISTORICAL');expect(rows.createDelivery).toHaveLength(0);
 });
 it('isolates per-source failures, retries them and excludes clinical records',async()=>{
  await email('a-bad',{bodyHtml:'<p><img src="/uploads/email-media/foreign/picture.png"></p>'});await email('b-good');
  await db.letterTemplate.create({data:{id:'clinical',organizationId:org,name:'Clinical',crmScope:'CLINICAL',printBody:'Clinical record'}});
  await call('post','/imports/ensure',{});await finish();expect(rows.createImportSource.find(item=>item.sourceId==='a-bad')?.status).toBe('FAILED');expect(rows.createImportSource.find(item=>item.sourceId==='b-good')?.status).toBe('NEEDS_REVIEW');expect(rows.createImportSource.some(item=>item.sourceId==='clinical')).toBe(false);
  await db.emailCampaign.update({where:{id:'a-bad'},data:{bodyHtml:'<p>Corrected source</p>'}});await call('post','/imports/control',{action:'RETRY'});await finish();expect(rows.createImportSource.find(item=>item.sourceId==='a-bad')?.error).toBeNull();expect(rows.createCampaign).toHaveLength(2);
 });
 it('allows only one worker lease and resumes after an interrupted lease expires',async()=>{
  await email('leased');await call('post','/imports/ensure',{});
  await db.createImportRun.update({where:{organizationId:org},data:{leaseToken:'interrupted',leaseUntil:new Date(Date.now()+60000)}});expect(await processImports()).toBe(0);
  await db.createImportRun.update({where:{organizationId:org},data:{leaseUntil:new Date(Date.now()-1000)}});await Promise.all([processImports(),processImports()]);
  expect(rows.createCampaign).toHaveLength(1);expect(rows.createImportSourceRevision).toHaveLength(1);
 });
 it('retains editable content and its original snapshot when a source is deleted',async()=>{
  await email('removed');const imported=await importCommunication(actor(),org,'admin','EMAIL','removed');rows.emailCampaign=[];
  expect((await call('get',`/contents/${imported.contentId}/studio`)).status).toBe(200);
  const preview=await call('post',`/contents/${imported.contentId}/studio/preview`,{channel:'EMAIL'});expect(preview.status).toBe(200);expect(preview.body.text).toContain('Original');
  await call('post','/imports/ensure',{});await new Promise(resolve=>setTimeout(resolve,5));await finish();expect(rows.createImportSource[0].missing).toBe(true);expect(rows.createContent).toHaveLength(1);
 });
 it('enforces current sharing on source snapshots, search and history after permission changes',async()=>{
  await email('restricted',{audienceFilter:JSON.stringify({_sharing:{ownerId:'other',sharedWithOrganization:true}})});const imported=await importCommunication(actor(),org,'admin','EMAIL','restricted');
  await db.emailCampaign.update({where:{id:'restricted'},data:{audienceFilter:JSON.stringify({_sharing:{ownerId:'other',sharedWithOrganization:false}})}});
  expect((await call('get',`/imports/revisions/${rows.createImportSourceRevision[0].id}`,undefined,'staff')).status).toBe(404);
  expect((await call('get',`/campaigns/${imported.campaignId}`,undefined,'staff')).status).toBe(403);expect((await call('get','/imports/sources',undefined,'staff')).body.items).toEqual([]);
 });
 it('creates clean drafts from historical email and leaves its delivery records unchanged',async()=>{
  await email('sent-copy',{status:'SENT',totalRecipients:4,sentAt:new Date(),scheduledAt:new Date(),audienceFilter:'{"recipientListId":"old-list"}'});const original=structuredClone(rows.emailCampaign[0]);
  const imported=await importCommunication(actor(),org,'admin','EMAIL','sent-copy');const copied=await call('post',`/campaigns/${imported.campaignId}/duplicate`,{name:'New draft'});expect(copied.status).toBe(201);expect(copied.body.audienceListIds).toEqual([]);expect(copied.body.startsAt).toBeNull();
  expect(rows.emailCampaign[0]).toEqual(original);expect(rows.emailCampaign[1]).toMatchObject({status:'DRAFT',totalRecipients:0,sentAt:null,scheduledAt:null,audienceFilter:null});expect(rows.createDelivery).toHaveLength(0);
 });
 it('recovers browser sections and letter drafts privately, idempotently and only into the confirmed organization',async()=>{
  const body={organizationId:org,confirm:true,kind:'DRAFT',name:'Browser letter',record:{printBody:'<p>Browser recovery</p>',printSubject:'Original letter subject'}};
  expect((await call('post','/imports/recover',{...body,organizationId:'foreign'})).status).toBe(400);
  const first=await call('post','/imports/recover',body);expect(first.status).toBe(201);expect((await call('post','/imports/recover',body)).status).toBe(200);expect(rows.createCampaign).toHaveLength(1);expect(rows.createCampaign[0].channelsJson).toEqual(['LETTER']);expect(rows.createImportSource[0]).toMatchObject({ownerId:'admin',shared:false});expect(rows.letterTemplate).toHaveLength(1);
  expect((await call('post','/imports/recover',{...body,record:{printBody:'<p>Clinical</p>',crmScope:'CLINICAL'}})).status).toBe(400);
 });
 it('preserves oversized originals outside editor limits and materializes them only for preview',async()=>{
  const original='<div style="padding:10px">'+'Original oversized content. '.repeat(8000)+'</div>';await email('large',{bodyHtml:original});const imported=await importCommunication(actor(),org,'admin','EMAIL','large');
  expect(rows.createImportSourceRevision[0].snapshotJson.originalHtml).toBe(original);expect(rows.createContent[0].designJson.body.content[0].attrs.sourceRevisionId).toBeTruthy();
  const preview=await call('post',`/contents/${imported.contentId}/studio/preview`,{channel:'EMAIL'});expect(preview.status).toBe(200);expect(preview.body.html).toContain('Original oversized content.');
 });
 it('keeps HTML edits in new immutable revisions and reports missing managed images',async()=>{
  await email('html-edit',{bodyHtml:'<div style="padding:10px"><p>Original HTML</p></div>'});const imported=await importCommunication(actor(),org,'admin','EMAIL','html-edit');const original=structuredClone(rows.createImportSourceRevision[0]);
  const edited=await call('post',`/imports/revisions/${original.id}/html`,{html:`<div><p>Edited preserved copy</p><img src="/uploads/email-media/${org}/missing.png"></div>`});expect(edited.status).toBe(201);expect(rows.createImportSourceRevision[0]).toEqual(original);
  const design=structuredClone(rows.createContent[0].designJson);design.body.content=[{type:'studioHtml',attrs:{studioId:'preserved',html:'',sourceRevisionId:edited.body.id,reviewedHtml:edited.body.id}}];
  const preview=await call('post',`/contents/${imported.contentId}/studio/preview`,{channel:'EMAIL',design});expect(preview.status).toBe(200);expect(preview.body.issues.some((issue:{code:string})=>issue.code==='IMAGE_MISSING')).toBe(true);expect(preview.body.text).toContain('Edited preserved copy');
 });
 it('cannot materialize generated donor history through a lower-permission preview reference',async()=>{
  await email('safe');const imported=await importCommunication(actor(),org,'admin','EMAIL','safe');
  const source=await db.createImportSource.create({data:{organizationId:org,sourceType:'GENERATED_LETTER',sourceId:'generated',name:'Generated history',status:'HISTORICAL',shared:true,diagnostics:[]}});
  const revision=await db.createImportSourceRevision.create({data:{sourceId:source.id,fingerprint:'private',snapshotJson:{originalHtml:'<p>Private generated donor output</p>'}}});
  await db.userPermission.create({data:{userId:'admin',permission:'letters.view_sensitive_merge_data',granted:false}});
  const design=structuredClone(rows.createContent[0].designJson);design.body.content=[{type:'studioHtml',attrs:{studioId:'history',sourceRevisionId:revision.id}}];
  expect((await call('post',`/contents/${imported.contentId}/studio/preview`,{channel:'EMAIL',design})).status).toBe(403);
 });
 it('moves a separately queued legacy draft into history without replacing Create work',async()=>{
  await email('later-queued');await importCommunication(actor(),org,'admin','EMAIL','later-queued');const design=structuredClone(rows.createContent[0].designJson);
  await db.emailCampaign.update({where:{id:'later-queued'},data:{status:'SCHEDULED',scheduledAt:new Date()}});const result=await importCommunication(actor(),org,'admin','EMAIL','later-queued');expect(result.historical).toBe(true);expect(rows.createImportSource[0].status).toBe('HISTORICAL');expect(rows.createContent[0].designJson).toEqual(design);
 });
 it('gives an authorized new draft its own private snapshots before original sharing changes',async()=>{
  await email('shared-copy',{audienceFilter:JSON.stringify({_sharing:{ownerId:'other-owner',sharedWithOrganization:true}})});const imported=await importCommunication(actor(),org,'admin','EMAIL','shared-copy');
  await db.userPermission.create({data:{userId:'admin',permission:'edit:communications',granted:true}});
  const duplicate=await call('post',`/campaigns/${imported.campaignId}/duplicate`,{name:'Private editable copy'},'staff');expect(duplicate.status).toBe(201);
  const copied=rows.createContent.find(item=>item.campaignId===duplicate.body.id)!;expect(copied.designJson.presentation.sourceRevisionId).not.toBe(rows.createContent[0].designJson.presentation.sourceRevisionId);
  const savedCopy=structuredClone(copied.designJson),nativeCopy=rows.createVariant.find(item=>item.contentId===copied.id&&item.channel==='EMAIL')!;
  await importCommunication(actor(),org,'admin','EMAIL',nativeCopy.legacyId);expect(rows.createContent.find(item=>item.id===copied.id)?.designJson).toEqual(savedCopy);
  await db.emailCampaign.update({where:{id:'shared-copy'},data:{audienceFilter:JSON.stringify({_sharing:{ownerId:'other-owner',sharedWithOrganization:false}})}});
  expect((await call('get',`/campaigns/${imported.campaignId}`,undefined,'staff')).status).toBe(403);
  const preview=await call('post',`/contents/${copied.id}/studio/preview`,{channel:'EMAIL'},'staff');expect(preview.status).toBe(200);expect(preview.body.text).toContain('Original');
 });
});

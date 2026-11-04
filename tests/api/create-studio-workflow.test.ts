/** Real Studio HTTP handlers; persistence, identities and recipient values are synthetic. */
import "dotenv/config";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
const provider=vi.hoisted(()=>({send:vi.fn(async(input:Record<string,unknown>)=>{void input;return {acceptedAt:new Date(),providerResponse:"Synthetic acceptance",providerMessageId:"synthetic-message"};})}));
vi.mock("@/server/src/services/smtp-service",()=>({createOrganizationEmailSender:async()=>provider,resolveOrganizationSmtpSettings:async()=>({smtpFromName:"Synthetic Sender",smtpFromEmail:"sender@example.invalid"})}));
import brandRoutes from "@/server/src/oyama-create/studio/brand-routes";
import studioRoutes from "@/server/src/oyama-create/studio/routes";
import emailRoutes from "@/server/src/oyama-create/studio/email";
import outputRoutes from "@/server/src/oyama-create/studio/brand-resources";
import { publicBrandIdentity } from "@/server/src/oyama-create/studio/brand-service";
import { normalizeBrand } from "@/server/src/oyama-create/studio/brand";
import {assertStudioPrintAccess,maskStudioGenerated} from "@/server/src/oyama-create/studio/print-access";
import { defaultDesign } from "@/server/src/oyama-create/studio/design";
import { responseAttribution } from "@/server/src/oyama-create/studio/response";
import { recordCreatePrintStatus, assertCurrentCreateArtifact } from "@/server/src/oyama-create/print-adapter";
import { signAccessToken } from "@/server/src/lib/auth";
const app = express(); app.use(express.json());
const { requireAuth } = await import("@/server/src/middleware/requireAuth"); app.use("/api/oyama-create", requireAuth, brandRoutes, studioRoutes, emailRoutes, outputRoutes);
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { void _next; res.status(500).json({ error: { message: error.message } }); });
const org = "synthetic-studio-org";
const call = (method: "get" | "put" | "post" | "patch", path: string, body?: unknown, role = "admin", organizationId = org) => { const action = request(app)[method](`/api/oyama-create${path}`).set("Authorization", `Bearer ${signAccessToken({ sub: "synthetic-staff", orgId: organizationId, email: "staff@example.invalid", role })}`); return body === undefined ? action : action.send(body as object); };
beforeEach(async () => { resetCreateRows(); await db.organization.create({ data: { id: org, name: "Synthetic original organization" } }); await db.organizationSettings.create({ data: { organizationId: org, oyamaCreateEnabled: false } }); });
describe("reviewed Brand Hub", () => {
  it("keeps a public event pinned until an explicit reviewed brand adoption",async()=>{
    await db.event.create({data:{id:"event",organizationId:org,name:"Synthetic event"}});const state=(await call("get","/brand")).body;state.document.identity.organizationDisplayName="New published identity";await call("put","/brand/draft",{revision:0,document:state.document});const review=(await call("get","/brand/review")).body;expect((await call("post","/brand/publish",{...review,confirm:true})).status).toBe(200);
    expect((await publicBrandIdentity(org,"EVENT","event"))?.organizationDisplayName).toBe("Synthetic original organization");
    const adoption=(await call("get","/brand/outputs/EVENT/event/review")).body;expect(adoption.after.organizationDisplayName).toBe("New published identity");expect((await call("put","/brand/outputs/EVENT/event",{...adoption,confirm:true})).status).toBe(200);expect((await publicBrandIdentity(org,"EVENT","event"))?.organizationDisplayName).toBe("New published identity");expect((await call("put","/brand/outputs/EVENT/event",{...adoption,confirm:true})).status).toBe(409);
  });
  it("reads current branding without publishing or changing legacy settings", async () => { const response = await call("get", "/brand"); expect(response.status).toBe(200); expect(response.body.document.identity.organizationDisplayName).toBe("Synthetic original organization"); expect(rows.createBrandDraft).toHaveLength(0); expect(rows.createBrandRevision).toHaveLength(0); });
  it("requires reviewed publication rather than an imported baseline for Brand Hub cutover",async()=>{await db.createBrandRevision.create({data:{organizationId:org,revision:1,documentJson:{},publishedBy:"synthetic-staff"}});const result=await call("put","/studio/config",{studioEnabled:true,brandHubEnabled:true,confirm:true});expect(result.status).toBe(422);expect(rows.organizationSettings[0].oyamaCreateBrandHubEnabled).not.toBe(true);});
  it("saves a draft, preserves the public baseline, and publishes only the reviewed revision", async () => {
    const state = (await call("get", "/brand")).body; state.document.identity.organizationDisplayName = "Synthetic updated brand";
    expect((await call("put", "/brand/draft", { revision: 0, document: state.document })).status).toBe(200); expect(rows.pluginSetting).toHaveLength(0);
    const review = (await call("get", "/brand/review")).body;
    const published = await call("post", "/brand/publish", { ...review, confirm: true }); expect(published.status, JSON.stringify(published.body)).toBe(200);
    expect(rows.createBrandRevision).toHaveLength(2); expect(rows.createBrandRevision[0].documentJson.identity.organizationDisplayName).toBe("Synthetic original organization"); expect(rows.pluginSetting[0].config.organizationDisplayName).toBe("Synthetic updated brand"); expect(rows.organizationSettings[0].createBrandPublicBaselineId).toBe(rows.createBrandRevision[0].id); expect(rows.organizationSettings[0].oyamaCreateEnabled).toBe(false);
  });
  it("refuses stale draft saves and stale publication reviews", async () => {
    const state = (await call("get", "/brand")).body; await call("put", "/brand/draft", { revision: 0, document: state.document }); const review = (await call("get", "/brand/review")).body;
    state.document.identity.tagline = "A later synthetic edit"; expect((await call("put", "/brand/draft", { revision: 0, document: state.document })).status).toBe(409); expect((await call("put", "/brand/draft", { revision: 1, document: state.document })).status).toBe(200); expect((await call("post", "/brand/publish", { ...review, confirm: true })).status).toBe(409); expect(rows.createBrandRevision).toHaveLength(0);
  });
  it("does not grant identity editing or publication through signature permissions", async () => {
    const state = (await call("get", "/brand")).body; state.document.identity.tagline = "Disallowed identity edit";
    expect((await call("put", "/brand/draft", { revision: 0, document: state.document }, "manager")).status).toBe(403);
    expect((await call("post", "/brand/publish", { confirm: true }, "manager")).status).toBe(403);
  });
  it("scopes brand revisions to the organization and excludes clinical-only accounts", async () => {
    expect((await call("get", "/brand", undefined, "compassion_user")).status).toBe(403);
    const foreign = await db.createBrandRevision.create({ data: { organizationId: "foreign", revision: 1, documentJson: {}, publishedBy: "foreign" } }); expect((await call("get", `/brand/revisions/${foreign.id}`)).status).toBe(404);
  });
});
async function studio() {
  const campaign = await db.createCampaign.create({data:{organizationId:org,name:"Synthetic appeal",ownerId:"synthetic-staff",channelsJson:["LETTER"],audienceListIds:[]}});
  const content = await db.createContent.create({data:{organizationId:org,campaignId:campaign.id,name:"Synthetic letter",documentJson:{version:1,blocks:[{id:"copy",kind:"paragraph",text:"Original shared copy"}]}}});
  await db.createVariant.create({data:{organizationId:org,contentId:content.id,channel:"LETTER",documentJson:{},legacyId:null}});
  return {campaign,content};
}
describe("Studio design persistence and personalization",()=>{
 it("saves sender settings and sends a test only with explicit reviewed authorization",async()=>{
  provider.send.mockClear();const {campaign,content}=await studio();rows.createCampaign[0].channelsJson=["LETTER","EMAIL"];await db.createVariant.create({data:{organizationId:org,contentId:content.id,channel:"EMAIL",documentJson:{},legacyId:null}});
  await db.createBrandRevision.create({data:{organizationId:org,revision:1,publishedBy:"synthetic-staff",documentJson:normalizeBrand({version:1,identity:{organizationDisplayName:"Synthetic",streetAddress1:"100 Test Way",city:"Test City"},signers:[],presets:[],profiles:[]})}});
  const design=defaultDesign();design.body.content[0].content=[{type:"text",text:"Synthetic test message"}];design.email.subject="Synthetic subject";
  expect((await call("post",`/contents/${content.id}/studio/convert`,{design,confirm:true,campaignRevision:campaign.revision})).status).toBe(200);
  const settings=await call("put",`/contents/${content.id}/studio/email-settings`,{revision:2,campaignRevision:2,fromName:"Reviewed sender",replyToEmail:"reply@example.invalid",purpose:"FUNDRAISING"});expect(settings.status,JSON.stringify(settings.body)).toBe(200);
  expect((await call("post",`/contents/${content.id}/studio/send-test`,{revision:2,toEmail:"test@example.invalid"})).status).toBe(400);expect(provider.send).not.toHaveBeenCalled();
  const sent=await call("post",`/contents/${content.id}/studio/send-test`,{revision:2,toEmail:"test@example.invalid",confirm:true});expect(sent.status,JSON.stringify(sent.body)).toBe(200);expect(sent.body.confirmedDelivered).toBe(false);expect(provider.send).toHaveBeenCalledOnce();expect(provider.send.mock.calls[0][0]).toMatchObject({to:"test@example.invalid",subject:"[TEST] Synthetic subject",replyToOverride:"reply@example.invalid"});
 });
 it("rejects managed assets belonging to another tenant",async()=>{const {content}=await studio();const design=defaultDesign();design.body.content=[{type:"image",attrs:{studioId:"foreign-image",src:"/uploads/letter-media/foreign/photo.png"}}];expect((await call("post",`/contents/${content.id}/studio/convert`,{design,confirm:true,campaignRevision:1})).status).toBe(403);expect(rows.createContent[0].designJson).toBeNull();});
 it("converts into a pinned draft while retaining the original revision",async()=>{
  const {campaign,content}=await studio();const result=await call("post",`/contents/${content.id}/studio/convert`,{presetId:"classic",confirm:true,campaignRevision:campaign.revision});
  expect(result.status,JSON.stringify(result.body)).toBe(200);expect(result.body.design.version).toBe(2);expect(result.body.design.brandRevisionId).toBeTruthy();expect(rows.createDocumentRevision).toHaveLength(2);expect(rows.createDocumentRevision[0].documentJson.legacy).toBe(true);expect(rows.letterTemplate).toHaveLength(1);
 });
 it("rejects cross-tenant conversion and stale design saves without losing the saved document",async()=>{
  const {content}=await studio();expect((await call("post",`/contents/${content.id}/studio/convert`,{confirm:true,campaignRevision:1},"admin","foreign")).status).toBe(404);
  const converted=(await call("post",`/contents/${content.id}/studio/convert`,{presetId:"classic",confirm:true,campaignRevision:1})).body;
  const original=structuredClone(converted.design);converted.design.email.subject="First saved subject";
  const saved=await call("patch",`/contents/${content.id}/studio`,{design:converted.design,revision:2,campaignRevision:2});expect(saved.status,JSON.stringify(saved.body)).toBe(200);
  const stale=await call("patch",`/contents/${content.id}/studio`,{design:original,revision:2,campaignRevision:2});expect(stale.status).toBe(409);expect(rows.createContent[0].designJson.email.subject).toBe("First saved subject");expect(rows.createDocumentRevision).toHaveLength(3);
 });
 it("resolves actual selected gifts and keeps unauthorized financial data unavailable",async()=>{
  const {campaign,content}=await studio();const design=defaultDesign();design.data.year=2026;design.body.content=[{type:"studioHistory",attrs:{studioId:"giving"}}];
  await db.constituent.create({data:{id:"person",organizationId:org,firstName:"Jordan",lastName:"Sample",entityKind:"INDIVIDUAL",tags:[]}});
  await db.constituent.create({data:{id:"other",organizationId:"foreign",firstName:"Foreign",tags:[]}});
  await db.donation.create({data:{id:"gift",constituentId:"person",status:"COMPLETED",amount:125,date:new Date("2026-08-01T12:00:00Z"),designation:{name:"General"},receiptNumber:"SYNTHETIC",taxDeductible:true}});
  const current=await call("post",`/contents/${content.id}/studio/preview`,{design,constituentId:"person"});expect(current.status,JSON.stringify(current.body)).toBe(200);expect(current.body.donor.giving.total).toBe(125);expect(current.body.donor.gift.id).toBe("gift");
  expect((await call("post",`/contents/${content.id}/studio/preview`,{design,constituentId:"other"})).status).toBe(404);
  rows.userPermission.push({userId:"synthetic-staff",permission:"letters.view_sensitive_merge_data",granted:false});
  const restricted=await call("post",`/contents/${content.id}/studio/preview`,{design,constituentId:"person"});expect(restricted.status).toBe(200);expect(restricted.body.donor.giving).toBeNull();expect(restricted.body.html).not.toContain("125.00");expect(restricted.body.issues.some((item:{code:string})=>item.code==="DONOR_PERMISSION")).toBe(true);expect(campaign.organizationId).toBe(org);
 });
 it("does not accept a brand revision from another organization",async()=>{
  const {content}=await studio();await call("post",`/contents/${content.id}/studio/convert`,{presetId:"classic",confirm:true,campaignRevision:1});const design=rows.createContent[0].designJson;design.brandRevisionId="foreign-brand";
  const result=await call("patch",`/contents/${content.id}/studio`,{design,revision:2,campaignRevision:2});expect(result.status).toBe(404);
 });
});
describe("opaque giving attribution and appeal-pack status",()=>{
 it("protects frozen donor PDFs and masks legacy generated-body reads after a sensitive-data denial",async()=>{
   const req={user:{sub:"synthetic-staff",orgId:org,role:"admin"}} as unknown as express.Request;await expect(assertStudioPrintAccess(req,{studio:{sensitive:true}})).resolves.toBeUndefined();rows.userPermission.push({userId:"synthetic-staff",permission:"letters.view_sensitive_merge_data",granted:false});await expect(assertStudioPrintAccess(req,{studio:{sensitive:true}})).rejects.toThrow(/Sensitive donor output/);await expect(assertStudioPrintAccess(req,{studio:{sensitive:false}})).resolves.toBeUndefined();
   const masked=maskStudioGenerated([{metadataJson:{studioSensitive:true},mergedPrintBody:"Private giving total $125.00",donation:{amount:125}}],false);expect(JSON.stringify(masked)).not.toContain("125");expect(masked[0].mergedPrintBody).toContain("requires permission");
 });
 it("validates response destinations and returns campaign attribution without recipient values",async()=>{
  const code="a".repeat(24);await db.createRelease.create({data:{id:"release",organizationId:org,campaignId:"create-campaign",status:"RELEASED",snapshotJson:{campaign:{fundraisingCampaignId:null}}}});await db.createResponseCode.create({data:{organizationId:org,code,lookupKey:"unique",releaseId:"release",contentId:"content",constituentId:"private-person",payloadJson:{givingUrl:"/give/form"}}});
  const result=await responseAttribution(org,"form",code);expect(result.createCampaignId).toBe("create-campaign");expect(JSON.stringify(result)).not.toContain("private-person");await expect(responseAttribution(org,"different",code)).rejects.toThrow();await expect(responseAttribution("foreign","form",code)).rejects.toThrow();
 });
 it("tracks the least completed print piece and rejects obsolete extra pieces",async()=>{
  await db.createRelease.create({data:{id:"release",organizationId:org,campaignId:"campaign",status:"RELEASED"}});await db.createDelivery.create({data:{id:"delivery",organizationId:org,releaseId:"release",channel:"LETTER",status:"PREPARED",providerId:"letter-job",deliveryKey:"unique"}});
  await db.createPrintArtifact.create({data:{organizationId:org,deliveryId:"delivery",kind:"LETTER",renderJobId:"letter-job",status:"PREPARED"}});await db.createPrintArtifact.create({data:{organizationId:org,deliveryId:"delivery",kind:"OUTER_ENVELOPE",renderJobId:"envelope-job",status:"PREPARED"}});
  await recordCreatePrintStatus(org,{artifactId:"letter-job"},"PRINTED");expect(rows.createDelivery[0].status).toBe("PREPARED");await recordCreatePrintStatus(org,{artifactId:"envelope-job"},"PRINTED");expect(rows.createDelivery[0].status).toBe("PRINTED");rows.createRelease[0].status="SUPERSEDED";await expect(assertCurrentCreateArtifact(org,"envelope-job")).rejects.toThrow(/superseded/);
 });
});

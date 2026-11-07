/** Real HTTP and crypto; explicitly synthetic persistence, not production database evidence. */
import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { generate } from "otplib";
import { careRows, resetCareRows } from "../helpers/compassion-memory-database";
vi.mock("@/server/src/compassion/database", async () => {
  const { careMemoryDatabase } = await import("../helpers/compassion-memory-database");
  const { AsyncLocalStorage } = await import("node:async_hooks"); const context = new AsyncLocalStorage<boolean>(); let tail = Promise.resolve();
  return { prisma: careMemoryDatabase, compassionDatabase: careMemoryDatabase, atomic: async (_org:string, work:()=>Promise<unknown>) => { if(context.getStore())return work();const previous=tail;let release!:()=>void;tail=new Promise<void>(r=>{release=r;});await previous;try{return await context.run(true,work);}finally{release();} } };
});
import app from "@/server/src/compassion/app";
import { hashPassword, signAccessToken } from "@/server/src/lib/auth";
import { digest, seal, unseal } from "@/server/src/compassion/security";
import { defaultPolicies } from "@/server/src/compassion/contracts/modules";
const base="/api/compassion/physician-review";
const password="Synthetic reviewer test password";
const version=new Date("2026-11-06T12:00:00Z");
const staff=(role="ADMIN")=>signAccessToken({sub:role,email:`${role}@example.invalid`,role:"staff",orgId:"org"});
const admin=(path:string,body?:unknown)=>body?request(app).put(`/api/compassion${path}`).set("Authorization",`Bearer ${staff()}`).send(body as object):request(app).get(`/api/compassion${path}`).set("Authorization",`Bearer ${staff()}`);
beforeEach(async()=>{
  resetCareRows();process.env.COMPASSION_ENCRYPTION_KEY="ab".repeat(32);
  careRows.user=[{id:"reviewer",organizationId:"org",email:"physician@example.invalid",role:"compassion_user",active:true,passwordHash:await hashPassword(password),firstName:"Test",lastName:"Physician",updatedAt:version},{id:"ADMIN",organizationId:"org",email:"ADMIN@example.invalid",role:"admin",active:true,firstName:"Test",lastName:"Admin",updatedAt:version}];
  careRows.compassionMembership=[{id:"r",userId:"reviewer",organizationId:"org",role:"ULTRASOUND_REVIEWER",active:true,updatedAt:version},{id:"a",userId:"ADMIN",organizationId:"org",role:"ADMIN",active:true,updatedAt:version}];
  careRows.compassionConfiguration=[{organizationId:"org",pluginKey:"module:physician-review",enabled:true,config:{allowedRoles:["ULTRASOUND_REVIEWER"]}}];
  careRows.compassionClient=[{id:"patient",organizationId:"org",firstName:"Synthetic",lastName:"Patient",dateOfBirth:new Date("2000-01-01")}];
  careRows.compassionChart=[{id:"exam",organizationId:"org",clientId:"patient",kind:"ULTRASOUND",status:"REVIEW",version:1,createdAt:version,updatedAt:version,encryptedContent:seal(JSON.stringify({examDate:"2026-11-06",indication:"Synthetic",findings:"Protected findings",impression:"Test",followUp:"Test"}),"org:patient:chart")},{id:"unrelated",organizationId:"org",clientId:"patient",kind:"CLINICAL_NOTE",status:"REVIEW",version:1,updatedAt:version}];
  careRows.compassionDocument=[{id:"scan",organizationId:"org",clientId:"patient",chartId:"exam",name:"Synthetic scan.png",mimeType:"image/png",size:3,checksum:digest(Buffer.from("png")),deletedAt:null,encryptedContent:seal(Buffer.from("png").toString("base64"),"org:patient:document")},{id:"foreign",organizationId:"other",clientId:"other",chartId:"exam",deletedAt:null}];
});
async function login(){return request(app).post(`${base}/login`).send({email:"physician@example.invalid",password});}
async function session(){const first=await login();expect(first.status).toBe(200);const result=await request(app).post(`${base}/verify`).send({challenge:first.body.challenge,code:await generate({secret:first.body.setupKey})});expect(result.status).toBe(200);return {cookie:result.headers["set-cookie"][0].split(";")[0],csrf:result.body.csrf,secret:first.body.setupKey,recoveryCodes:result.body.recoveryCodes};}
const get=(path:string,cookie:string)=>request(app).get(`${base}${path}`).set("Cookie",cookie);
const post=(path:string,s:{cookie:string;csrf:string},body:object)=>request(app).post(`${base}${path}`).set("Cookie",s.cookie).set("X-Review-CSRF",s.csrf).send(body);

describe("restricted physician review",()=>{
  it("rejects expired MFA challenges and previously accepted authenticator codes",async()=>{
    const s=await session();const first=await login();
    expect((await request(app).post(`${base}/verify`).send({challenge:first.body.challenge,code:await generate({secret:s.secret})})).status).toBe(401);
    const current=careRows.compassionReviewerChallenge.at(-1)!;current.expiresAt=new Date(Date.now()-1000);
    expect((await request(app).post(`${base}/verify`).send({challenge:first.body.challenge,code:await generate({secret:s.secret,epoch:Math.floor(Date.now()/30000)*30+30})})).status).toBe(401);
  });
  it("requires HTTPS for production physician authentication",async()=>{
    const previous=process.env.NODE_ENV;process.env.NODE_ENV="production";
    try{expect((await login()).status).toBe(426);}finally{process.env.NODE_ENV=previous;}
  });
  it("requires password and enrolled MFA without issuing general CRM tokens",async()=>{
    expect((await get("/ultrasounds","")).status).toBe(401);
    const first=await login();expect(first.body.enroll).toBe(true);expect(first.headers["set-cookie"]).toBeUndefined();
    expect(String(careRows.compassionReviewerAuthenticator[0].encryptedSecret)).not.toContain(first.body.setupKey);
    const result=await request(app).post(`${base}/verify`).send({challenge:first.body.challenge,code:await generate({secret:first.body.setupKey})});
    expect(result.status).toBe(200);expect(result.body.accessToken).toBeUndefined();expect(result.body.recoveryCodes).toHaveLength(8);
    expect(JSON.stringify(careRows.compassionReviewerAuthenticator[0].recoveryHashes)).not.toContain(result.body.recoveryCodes[0]);
    expect((await request(app).post(`${base}/verify`).send({challenge:first.body.challenge,code:"123456"})).status).toBe(401);
    const forged=signAccessToken({sub:"reviewer",email:"physician@example.invalid",role:"compassion_user",orgId:"org"});
    expect((await request(app).get("/api/compassion/clients").set("Authorization",`Bearer ${forged}`)).status).toBe(403);
    expect((await request(app).get("/api/compassion/charts/exam").set("Authorization",`Bearer ${forged}`)).status).toBe(403);
  });
  it("bounds review records and files to submitted ultrasounds in the organization",async()=>{
    const s=await session();const queue=await get("/ultrasounds",s.cookie);expect(queue.body.items).toHaveLength(1);expect(JSON.stringify(queue.body)).not.toContain("Protected findings");
    expect((await get("/ultrasounds/exam",s.cookie)).body.content.findings).toBe("Protected findings");
    expect((await get("/ultrasounds/unrelated",s.cookie)).status).toBe(404);
    expect((await get("/ultrasounds/exam/documents/foreign",s.cookie)).status).toBe(404);
    expect((await get("/ultrasounds/exam/documents/scan",s.cookie)).status).toBe(200);
    careRows.compassionChart[0].status="DRAFT";expect((await get("/ultrasounds/exam",s.cookie)).status).toBe(404);
  });
  it("requires CSRF, attestation, the reviewed version and attachment manifest",async()=>{
    const s=await session();const exam=(await get("/ultrasounds/exam",s.cookie)).body;
    const body={attest:true,expectedUpdatedAt:exam.updatedAt,expectedAttachmentDigest:exam.attachmentDigest};
    expect((await post("/ultrasounds/exam/sign",s,{attest:true,expectedAttachmentDigest:exam.attachmentDigest})).status).toBe(400);
    expect((await post("/ultrasounds/exam/sign",{...s,csrf:"wrong"},body)).status).toBe(403);
    expect((await post("/ultrasounds/exam/sign",s,{...body,expectedUpdatedAt:"stale"})).status).toBe(409);
    expect((await post("/ultrasounds/exam/sign",s,{...body,expectedAttachmentDigest:"stale"})).status).toBe(409);
    expect((await post("/ultrasounds/exam/sign",s,{...body,attest:false})).status).toBe(400);
    const results=await Promise.all([post("/ultrasounds/exam/sign",s,body),post("/ultrasounds/exam/sign",s,body)]);
    expect(results.map(r=>r.status).sort()).toEqual([200,400]);
    const signed=careRows.compassionChart[0];expect(signed.status).toBe("SIGNED");expect(signed.signedById).toBe("reviewer");
    const content=JSON.parse(unseal(String(signed.encryptedContent),"org:patient:chart"));expect(content._signoff.signer.name).toBe("Test Physician");expect(content._signoff.signer.role).toBe("ULTRASOUND_REVIEWER");expect(content._signoff.attachments).toEqual([{id:"scan",checksum:digest(Buffer.from("png"))}]);
    expect((await get("/ultrasounds?completed=true",s.cookie)).body.items).toHaveLength(1);
    expect(careRows.compassionAudit.some(a=>a.action==="CHART_SIGNED")).toBe(true);
  });
  it("returns corrections without granting draft editing",async()=>{
    const s=await session();expect((await post("/ultrasounds/exam/return",s,{expectedUpdatedAt:version.toISOString(),reason:"Clarify the finding"})).status).toBe(200);
    expect(careRows.compassionChart[0].status).toBe("DRAFT");expect((await get("/ultrasounds/exam",s.cookie)).status).toBe(404);
    careRows.compassionAudit.push({ id:"other-actor", actorId:"another-physician", organizationId:"org", action:"CHART_RETURNED_FOR_CORRECTION", entityId:"exam", createdAt:new Date() });
    const history = (await get("/ultrasounds?completed=true",s.cookie)).body;
    expect(history.total).toBe(1);expect(history.items[0]).toMatchObject({status:"RETURNED",version:1});
    expect(history.items[0].id).not.toBe("exam");expect(JSON.stringify(history)).not.toContain("Clarify the finding");
  });
  it("expires sessions and revokes them on membership, account or module changes",async()=>{
    const s=await session();careRows.compassionReviewerSession[0].lastActivityAt=new Date(Date.now()-16*60000);expect((await get("/ultrasounds",s.cookie)).status).toBe(401);
    careRows.compassionReviewerSession[0].lastActivityAt=new Date();careRows.user[0].updatedAt=new Date();expect((await get("/ultrasounds",s.cookie)).status).toBe(401);
    careRows.user[0].updatedAt=version;careRows.compassionMembership[0].active=false;expect((await get("/ultrasounds",s.cookie)).status).toBe(403);
    careRows.compassionMembership[0].active=true;careRows.compassionConfiguration[0].enabled=false;expect((await get("/ultrasounds",s.cookie)).status).toBe(403);
  });
  it("uses recovery codes only to reset enrollment and revoke existing sessions",async()=>{
    const s=await session();const first=await login();const result=await request(app).post(`${base}/verify`).send({challenge:first.body.challenge,recoveryCode:s.recoveryCodes[0]});
    expect(result.body.recovery).toBe(true);expect(result.headers["set-cookie"]).toBeUndefined();expect(careRows.compassionReviewerAuthenticator).toHaveLength(0);expect((await get("/ultrasounds",s.cookie)).status).toBe(401);
  });
  it("requires fresh MFA for signing and revokes a session after repeated failed step-up",async()=>{
    const s=await session();const exam=(await get("/ultrasounds/exam",s.cookie)).body;careRows.compassionReviewerSession[0].mfaAt=new Date(Date.now()-6*60000);
    for(let i=0;i<5;i++)expect((await post("/ultrasounds/exam/sign",s,{attest:true,expectedUpdatedAt:exam.updatedAt,expectedAttachmentDigest:exam.attachmentDigest,code:"invalid"})).status).toBe(401);
    expect(careRows.compassionReviewerSession[0].revokedAt).toBeInstanceOf(Date);expect(careRows.compassionChart[0].status).toBe("REVIEW");
  });
  it("accepts a fresh authenticator step-up before a signature",async()=>{
    const s=await session();const exam=(await get("/ultrasounds/exam",s.cookie)).body;careRows.compassionReviewerSession[0].mfaAt=new Date(Date.now()-6*60000);
    const code=await generate({secret:s.secret,epoch:Math.floor(Date.now()/30000)*30+30});
    expect((await post("/ultrasounds/exam/sign",s,{attest:true,expectedUpdatedAt:exam.updatedAt,expectedAttachmentDigest:exam.attachmentDigest,code})).status).toBe(200);
  });
  it("disables existing public intake and portal links with their modules",async()=>{
    careRows.compassionPortalAccess=[{organizationId:"org",clientId:"patient",tokenHash:digest("portal-test"),revokedAt:null,expiresAt:new Date(Date.now()+60000)}];
    careRows.compassionIntake=[{organizationId:"org",clientId:"patient",tokenHash:digest("intake-test"),status:"REQUESTED",expiresAt:new Date(Date.now()+60000)}];
    careRows.compassionConfiguration.push(...["communications","casework"].map(id=>({organizationId:"org",pluginKey:`module:${id}`,enabled:false,config:{allowedRoles:["ADMIN"]}})));
    expect((await request(app).get("/api/compassion-public/portal/portal-test")).status).toBe(401);
    expect((await request(app).get("/api/compassion-public/intake/intake-test")).status).toBe(404);
  });
  it("cannot turn a module role allowance into clinical permission",async()=>{
    careRows.user.push({id:"read",organizationId:"org",active:true,role:"readonly"});careRows.compassionMembership.push({userId:"read",organizationId:"org",active:true,role:"READONLY"});
    const token=signAccessToken({sub:"read",email:"read@example.invalid",role:"readonly",orgId:"org"});
    expect((await request(app).get("/api/compassion/charts/exam").set("Authorization",`Bearer ${token}`)).status).toBe(403);
    careRows.compassionConfiguration.push({organizationId:"org",pluginKey:"module:clinical",enabled:true,config:{allowedRoles:["READONLY"]}});
    expect((await request(app).get("/api/compassion/charts/exam").set("Authorization",`Bearer ${staff()}`)).status).toBe(403);
  });
  it("enforces module boundaries for encoded chart/document ids and casework originals",async()=>{
    careRows.compassionConfiguration.push({organizationId:"org",pluginKey:"module:ultrasounds",enabled:false,config:{allowedRoles:["ADMIN"]}});
    expect((await request(app).get("/api/compassion/charts/%65xam").set("Authorization",`Bearer ${staff()}`)).status).toBe(403);
    expect((await request(app).get("/api/compassion/documents/%73can/download").set("Authorization",`Bearer ${staff()}`)).status).toBe(403);
    careRows.compassionDocument.push({id:"case-original",organizationId:"org",chartId:null,accessScope:"CASEWORK"});
    careRows.compassionConfiguration.push({organizationId:"org",pluginKey:"module:casework",enabled:false,config:{allowedRoles:["ADMIN"]}});
    expect((await request(app).get("/api/compassion/documents/case-original/download").set("Authorization",`Bearer ${staff()}`)).status).toBe(403);
  });
  it("enforces module dependencies, core availability, role restrictions and aggregate projection",async()=>{
    const policies=defaultPolicies();expect((await admin("/modules",{approve:true,policies:policies.map(p=>p.id==="clinical"?{...p,enabled:false}:p)})).status).toBe(409);
    expect((await admin("/modules",{approve:true,policies:policies.map(p=>p.id==="core"?{...p,enabled:false}:p)})).status).toBe(400);
    expect((await admin("/modules",{approve:true,policies:policies.map(p=>["ultrasounds","clinical","casework"].includes(p.id)?{...p,enabled:false}:p)})).status).toBe(200);
    expect((await request(app).get("/api/compassion/ultrasounds").set("Authorization",`Bearer ${staff()}`)).status).toBe(403);
    expect((await request(app).get("/api/compassion/cases").set("Authorization",`Bearer ${staff()}`)).status).toBe(403);
    const access=await admin("/access");expect(access.body.modules.casework).toBe(false);
  });
});

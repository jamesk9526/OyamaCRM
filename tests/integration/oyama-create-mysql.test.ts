/** Opt-in verification in an EMPTY disposable MySQL schema; never uses DATABASE_URL. */
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import mysql, { type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const url = process.env.CREATE_MYSQL_TEST_URL;
let connection: Connection, second: Connection;
const prefix = randomUUID().replace(/-/g, "");
describe.skipIf(!url)("oyamaCreate MySQL migration and contention", () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!/^\/oyama_create_test_[a-z0-9_]+$/i.test(parsed.pathname)) throw new Error("CREATE_MYSQL_TEST_URL must point to an empty disposable schema named oyama_create_test_*. No existing CRM schema is accepted.");
    connection = await mysql.createConnection({ uri: url!, multipleStatements: true });
    const [tables] = await connection.query("SHOW TABLES");
    if ((tables as unknown[]).length) throw new Error("The disposable schema must be empty. No existing tables will be removed.");
    await connection.query("CREATE TABLE OrganizationSettings (id VARCHAR(191) PRIMARY KEY, organizationId VARCHAR(191) NOT NULL UNIQUE)");
    const migration = await readFile("prisma/migrations/20261103140000_oyama_create/migration.sql", "utf8");
    await connection.query(migration);
    await connection.query(await readFile("prisma/migrations/20261103200000_create_studio/migration.sql", "utf8"));
    await connection.query(await readFile("prisma/migrations/20261104120000_create_recoverable_trash/migration.sql", "utf8"));
    await connection.query(await readFile("prisma/migrations/20261104210000_create_automatic_import/migration.sql", "utf8"));
    await connection.query(await readFile("prisma/migrations/20261106030000_create_v5_workspace/migration.sql", "utf8"));
    second = await mysql.createConnection(url!);
    await connection.execute("INSERT INTO CreateCampaign (id, organizationId, name, ownerId, audienceListIds, channelsJson, updatedAt) VALUES (?, 'synthetic', 'Synthetic concurrency test', 'synthetic', '[]', '[\"EMAIL\"]', NOW(3))", [prefix]);
  });
  afterAll(async () => { await connection?.end(); await second?.end(); });
  it("installs the additive schema and a disabled rollout default", async () => {
    await connection.execute("INSERT INTO OrganizationSettings (id, organizationId) VALUES (?, 'synthetic')", [prefix]);
    const [rows] = await connection.execute("SELECT oyamaCreateEnabled FROM OrganizationSettings WHERE id=?", [prefix]);
    expect((rows as Array<{ oyamaCreateEnabled: number }>)[0].oyamaCreateEnabled).toBe(0);
  });
  it("allows one approved release per campaign revision under concurrent inserts", async () => {
    const sql = "INSERT INTO CreateRelease (id, organizationId, campaignId, campaignRevision, fingerprint, snapshotJson, approvedBy) VALUES (?, 'synthetic', ?, 1, ?, '{}', 'synthetic')";
    const outcomes = await Promise.allSettled([connection.execute(sql, [`${prefix}-one`, prefix, "one"]), second.execute(sql, [`${prefix}-two`, prefix, "two"])]);
    expect(outcomes.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(item => item.status === "rejected")).toHaveLength(1);
  });
  it("claims a due delivery exactly once using compare-and-swap", async () => {
    const [releases] = await connection.execute("SELECT id FROM CreateRelease WHERE campaignId=?", [prefix]);
    const releaseId = (releases as Array<{ id: string }>)[0].id;
    await connection.execute("INSERT INTO CreateDelivery (id, organizationId, releaseId, contentId, channel, recipientKey, deliveryKey, payloadJson, status, scheduledAt, updatedAt) VALUES (?, 'synthetic', ?, 'synthetic', 'EMAIL', 'synthetic@example.invalid', ?, '{}', 'PENDING', NOW(3), NOW(3))", [prefix, releaseId, prefix]);
    const sql = "UPDATE CreateDelivery SET status='SENDING', attempts=attempts+1 WHERE id=? AND status='PENDING'";
    const results = await Promise.all([connection.execute(sql, [prefix]), second.execute(sql, [prefix])]);
    expect(results.map(([result]) => (result as mysql.ResultSetHeader).affectedRows).sort()).toEqual([0, 1]);
  });
  it("keeps Studio and Brand Hub defaults disabled", async () => {
    const [rows]=await connection.execute("SELECT oyamaCreateStudioEnabled,oyamaCreateBrandHubEnabled FROM OrganizationSettings WHERE id=?",[prefix]);
    expect((rows as Array<{oyamaCreateStudioEnabled:number;oyamaCreateBrandHubEnabled:number}>)[0]).toMatchObject({oyamaCreateStudioEnabled:0,oyamaCreateBrandHubEnabled:0});
  });
  it("keeps v5 opt-in and guards shared notes without changing campaign revisions", async () => {
    const [settings] = await connection.execute("SELECT oyamaCreateV5ShellEnabled, oyamaCreateUnifiedEditorEnabled FROM OrganizationSettings WHERE id=?", [prefix]);
    expect((settings as unknown[])[0]).toMatchObject({ oyamaCreateV5ShellEnabled: 0, oyamaCreateUnifiedEditorEnabled: 0 });
    const content = `${prefix}-notes`;
    await connection.execute("INSERT INTO CreateContent (id, campaignId, organizationId, name, documentJson, updatedAt) VALUES (?, ?, 'synthetic', 'Notes fixture', '{}', NOW(3))", [content, prefix]);
    const insert = "INSERT INTO CreateContentNote (id, organizationId, contentId, text, updatedBy, updatedAt) VALUES (?, 'synthetic', ?, 'Internal', 'synthetic', NOW(3))";
    const created = await Promise.allSettled([connection.execute(insert, [`${prefix}-note-1`, content]), second.execute(insert, [`${prefix}-note-2`, content])]);
    expect(created.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const update = "UPDATE CreateContentNote SET text=?, revision=revision+1 WHERE organizationId='synthetic' AND contentId=? AND revision=1";
    const results = await Promise.all([connection.execute(update, ['First edit', content]), second.execute(update, ['Second edit', content])]);
    expect(results.map(([result]) => (result as mysql.ResultSetHeader).affectedRows).sort()).toEqual([0, 1]);
    const [campaigns] = await connection.execute("SELECT revision FROM CreateCampaign WHERE id=?", [prefix]);
    expect((campaigns as unknown[])[0]).toMatchObject({ revision: 1 });
  });
  it("allows one immutable brand revision and one draft-save winner", async()=>{
    const insert="INSERT INTO CreateBrandRevision (id,organizationId,revision,documentJson,publishedBy) VALUES (?,'synthetic',1,'{}','synthetic')";
    const outcome=await Promise.allSettled([connection.execute(insert,[`${prefix}-brand-1`]),second.execute(insert,[`${prefix}-brand-2`])]);expect(outcome.filter(item=>item.status==="fulfilled")).toHaveLength(1);
    await connection.execute("INSERT INTO CreateBrandDraft (id,organizationId,revision,documentJson,updatedBy,updatedAt) VALUES (?,'synthetic',1,'{}','synthetic',NOW(3))",[`${prefix}-draft`]);
    const update="UPDATE CreateBrandDraft SET revision=revision+1 WHERE organizationId='synthetic' AND revision=1";const winners=await Promise.all([connection.execute(update),second.execute(update)]);expect(winners.map(([result])=>(result as mysql.ResultSetHeader).affectedRows).sort()).toEqual([0,1]);
  });
  it("enforces response lookup and appeal-piece uniqueness",async()=>{
    const insert="INSERT INTO CreateResponseCode (id,organizationId,code,lookupKey,releaseId,contentId,channel,payloadJson) VALUES (?,'synthetic',?,?,?,'content','LETTER','{}')";
    await connection.execute(insert,[`${prefix}-response`,`${prefix}-code`,`${prefix}-lookup`,prefix]);await expect(second.execute(insert,[`${prefix}-response-2`,`${prefix}-code-2`,`${prefix}-lookup`,prefix])).rejects.toThrow();
    const piece="INSERT INTO CreatePrintArtifact (id,organizationId,deliveryId,kind,snapshotJson,updatedAt) VALUES (?,'synthetic',?,'LETTER','{}',NOW(3))";
    await connection.execute(piece,[`${prefix}-piece`,prefix]);await expect(second.execute(piece,[`${prefix}-piece-2`,prefix])).rejects.toThrow();
  });
  it("allows one trash entry and one restore revision winner", async () => {
    const insert = "INSERT INTO CreateTrashItem (id,organizationId,kind,resourceId,name,removedBy) VALUES (?,'synthetic','CAMPAIGN',?,'Synthetic trash','synthetic')";
    const outcomes = await Promise.allSettled([connection.execute(insert,[`${prefix}-trash-1`,prefix]),second.execute(insert,[`${prefix}-trash-2`,prefix])]);
    expect(outcomes.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    const update="UPDATE CreateTrashItem SET restoredAt=NOW(3),revision=revision+1 WHERE organizationId='synthetic' AND resourceId=? AND revision=1 AND restoredAt IS NULL";
    const winners=await Promise.all([connection.execute(update,[prefix]),second.execute(update,[prefix])]);
    expect(winners.map(([result])=>(result as mysql.ResultSetHeader).affectedRows).sort()).toEqual([0,1]);
  });
  it("enforces one import source and one immutable revision under contention",async()=>{
    const insert="INSERT INTO CreateImportSource (id,organizationId,sourceType,sourceId,name,diagnostics,updatedAt) VALUES (?,'synthetic','EMAIL',?,'Synthetic source','[]',NOW(3))";
    const outcomes=await Promise.allSettled([connection.execute(insert,[`${prefix}-source-1`,prefix]),second.execute(insert,[`${prefix}-source-2`,prefix])]);
    expect(outcomes.filter(item=>item.status==="fulfilled")).toHaveLength(1);
    const [sources]=await connection.execute("SELECT id FROM CreateImportSource WHERE organizationId='synthetic' AND sourceId=?",[prefix]);
    const sourceId=(sources as Array<{id:string}>)[0].id;
    const revision="INSERT INTO CreateImportSourceRevision (id,sourceId,fingerprint,snapshotJson) VALUES (?,?,'unchanged','{}')";
    const revisions=await Promise.allSettled([connection.execute(revision,[`${prefix}-revision-1`,sourceId]),second.execute(revision,[`${prefix}-revision-2`,sourceId])]);
    expect(revisions.filter(item=>item.status==="fulfilled")).toHaveLength(1);
    await expect(connection.execute("DELETE FROM CreateImportSource WHERE id=?",[sourceId])).rejects.toThrow();
  });
  it("claims an import lease once and invalidates an old worker on pause",async()=>{
    await connection.execute("INSERT INTO CreateImportRun (id,organizationId,actorId,cursorJson,updatedAt) VALUES (?,'synthetic','synthetic','{}',NOW(3))",[`${prefix}-import`]);
    const claim="UPDATE CreateImportRun SET leaseToken=?,leaseUntil=DATE_ADD(NOW(3),INTERVAL 2 MINUTE) WHERE organizationId='synthetic' AND status='RUNNING' AND (leaseUntil IS NULL OR leaseUntil<NOW(3))";
    const results=await Promise.all([connection.execute(claim,['worker-one']),second.execute(claim,['worker-two'])]);
    expect(results.map(([result])=>(result as mysql.ResultSetHeader).affectedRows).sort()).toEqual([0,1]);
    await connection.execute("UPDATE CreateImportRun SET status='PAUSED',leaseToken=NULL,leaseUntil=NULL WHERE organizationId='synthetic'");
    const [stale]=await second.execute("UPDATE CreateImportRun SET cursorJson='{\"phase\":5}' WHERE organizationId='synthetic' AND leaseToken IN ('worker-one','worker-two')");
    expect((stale as mysql.ResultSetHeader).affectedRows).toBe(0);
  });

});

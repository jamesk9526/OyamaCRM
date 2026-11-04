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
});

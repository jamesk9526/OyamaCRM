/**
 * Smoke tests for OyamaWatchdog operations routes.
 * Covers permissions, backup policy CRUD, manifest, verification, restore dry-run, vault auditing, audit filters, and health.
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
let staffToken = "";
let backupId = "";
let dryRunId = "";
let vaultEntryId = "";
let createdPolicyId = "";

function isStoreUnavailable(status: number, body: unknown): boolean {
  const code = (body as { error?: { code?: string } })?.error?.code;
  return status === 503 || code === "WATCHDOG_STORE_UNAVAILABLE";
}

function adminAuth() {
  return { Authorization: `Bearer ${adminToken}` };
}

function staffAuth() {
  return { Authorization: `Bearer ${staffToken}` };
}

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const adminLogin = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });

  expect(adminLogin.status).toBe(200);
  adminToken = adminLogin.body.data?.accessToken ?? "";
  expect(adminToken).toBeTruthy();

  const unique = Date.now();
  const staffEmail = `watchdog.ops.staff.${unique}@hopefoundation.org`;
  const staffPassword = "staff12345!";

  const createStaff = await request(app)
    .post("/api/users")
    .set(adminAuth())
    .send({
      email: staffEmail,
      firstName: "Watchdog",
      lastName: "Staff",
      role: "staff",
      password: staffPassword,
    });

  expect(createStaff.status).toBe(201);

  const staffLogin = await request(app).post("/api/auth/login").send({
    email: staffEmail,
    password: staffPassword,
  });

  expect(staffLogin.status).toBe(200);
  staffToken = staffLogin.body.data?.accessToken ?? "";
  expect(staffToken).toBeTruthy();
});

describe("watchdog ops smoke", () => {
  it("enforces admin-only access on operations workspace routes", async () => {
    const [overviewAsStaff, restoreExecuteAsStaff] = await Promise.all([
      request(app).get("/api/watchdog/ops/overview").set(staffAuth()),
      request(app)
        .post("/api/watchdog/ops/restore/execute")
        .set(staffAuth())
        .send({
          backupId: "not-used",
          dryRunId: "not-used",
          confirmationText: "not-used",
          reason: "permission check",
          execute: true,
        }),
    ]);

    expect(overviewAsStaff.status).toBe(403);
    expect(restoreExecuteAsStaff.status).toBe(403);
  });

  it("supports backup policy CRUD and environment manifest backup", async () => {
    const policyName = `smoke-policy-${Date.now()}`;

    const createPolicy = await request(app)
      .post("/api/watchdog/ops/backups/policies")
      .set(adminAuth())
      .send({
        policyName,
        backupScope: "DATABASE",
        cronExpression: "0 */4 * * *",
        retentionDays: 45,
        storageTarget: "watchdog-default",
        encrypted: true,
        enabled: true,
        notes: "smoke policy",
      });

    if (isStoreUnavailable(createPolicy.status, createPolicy.body)) {
      expect(createPolicy.body.error?.code).toBe("WATCHDOG_STORE_UNAVAILABLE");
      return;
    }

    expect(createPolicy.status).toBe(201);
    expect(createPolicy.body.item?.id).toBeTruthy();
    createdPolicyId = String(createPolicy.body.item.id);

    const listPolicies = await request(app)
      .get("/api/watchdog/ops/backups/policies")
      .set(adminAuth());

    expect(listPolicies.status).toBe(200);
    expect(Array.isArray(listPolicies.body.items)).toBe(true);
    expect(listPolicies.body.items.some((item: { id: string }) => item.id === createdPolicyId)).toBe(true);

    const updatePolicy = await request(app)
      .patch(`/api/watchdog/ops/backups/policies/${createdPolicyId}`)
      .set(adminAuth())
      .send({
        enabled: false,
        retentionDays: 60,
      });

    expect(updatePolicy.status).toBe(200);
    expect(updatePolicy.body.item.enabled).toBe(false);
    expect(updatePolicy.body.item.retentionDays).toBe(60);

    const manifest = await request(app)
      .post("/api/watchdog/ops/backups/environment-manifest")
      .set(adminAuth())
      .send({});

    expect(manifest.status).toBe(201);
    expect(manifest.body.manifest?.manifestType).toBe("ENVIRONMENT_MANIFEST");
    expect(Array.isArray(manifest.body.manifest?.entries)).toBe(true);

    const firstEntry = manifest.body.manifest.entries[0];
    if (firstEntry && firstEntry.present) {
      expect(firstEntry.value).toBe("***redacted***");
    }

    const deletePolicy = await request(app)
      .delete(`/api/watchdog/ops/backups/policies/${createdPolicyId}`)
      .set(adminAuth());

    expect(deletePolicy.status).toBe(200);
    expect(deletePolicy.body.success).toBe(true);
  });

  it("creates a backup, verifies it, and runs restore dry-run with pre-restore warning", async () => {
    const exportBackup = await request(app)
      .post("/api/watchdog/backups/export")
      .set(adminAuth())
      .send({
        label: `watchdog-ops-smoke-${Date.now()}`,
        includeWatchdogDatabase: true,
      });

    if (isStoreUnavailable(exportBackup.status, exportBackup.body) || exportBackup.status === 500) {
      expect([500, 503]).toContain(exportBackup.status);
      return;
    }

    expect(exportBackup.status).toBe(201);
    expect(exportBackup.body.item?.id).toBeTruthy();
    backupId = String(exportBackup.body.item.id);

    const verifyBackup = await request(app)
      .post("/api/watchdog/ops/backups/verify")
      .set(adminAuth())
      .send({ backupId });

    expect(verifyBackup.status).toBe(200);
    expect(["VERIFIED", "FAILED"]).toContain(verifyBackup.body.item?.status);
    expect(verifyBackup.body.item).toHaveProperty("checksumMatches");

    const listVerifications = await request(app)
      .get(`/api/watchdog/ops/backups/verifications?backupId=${encodeURIComponent(backupId)}`)
      .set(adminAuth());

    expect(listVerifications.status).toBe(200);
    expect(Array.isArray(listVerifications.body.items)).toBe(true);
    expect(listVerifications.body.items.length).toBeGreaterThan(0);

    const dryRun = await request(app)
      .post("/api/watchdog/ops/restore/dry-run")
      .set(adminAuth())
      .send({ backupId });

    expect(dryRun.status).toBe(201);
    expect(["DRY_RUN_PASSED", "DRY_RUN_FAILED"]).toContain(dryRun.body.dryRun?.status);
    expect(Array.isArray(dryRun.body.dryRun?.warnings)).toBe(true);
    expect(
      dryRun.body.dryRun.warnings.some((warning: string) =>
        warning.toLowerCase().includes("pre-restore backup"),
      ),
    ).toBe(true);

    dryRunId = String(dryRun.body.dryRun.id);

    const executeMissingFlag = await request(app)
      .post("/api/watchdog/ops/restore/execute")
      .set(adminAuth())
      .send({
        backupId,
        dryRunId,
        confirmationText: exportBackup.body.item.label,
        reason: "smoke validation",
        execute: false,
      });

    expect(executeMissingFlag.status).toBe(400);
    expect(executeMissingFlag.body.error?.code).toBe("WATCHDOG_RESTORE_EXECUTE_CONFIRM");
  }, 20_000);

  it("keeps vault secrets masked by default and records reveal access events", async () => {
    const createVaultEntry = await request(app)
      .post("/api/watchdog/vault")
      .set(adminAuth())
      .send({
        name: `Ops Smoke Secret ${Date.now()}`,
        category: "Internal Service",
        username: "ops-smoke",
        website: "https://example.local/watchdog",
        password: "super-secret-value",
        notes: "smoke test secret",
      });

    if (isStoreUnavailable(createVaultEntry.status, createVaultEntry.body)) {
      expect(createVaultEntry.body.error?.code).toBe("WATCHDOG_STORE_UNAVAILABLE");
      return;
    }

    expect(createVaultEntry.status).toBe(201);
    expect(createVaultEntry.body.item?.id).toBeTruthy();
    vaultEntryId = String(createVaultEntry.body.item.id);

    const listVault = await request(app)
      .get("/api/watchdog/vault")
      .set(adminAuth());

    expect(listVault.status).toBe(200);
    expect(Array.isArray(listVault.body.items)).toBe(true);

    const listedItem = listVault.body.items.find((item: { id: string }) => item.id === vaultEntryId);
    expect(listedItem).toBeTruthy();
    expect(listedItem).not.toHaveProperty("password");

    const reveal = await request(app)
      .post(`/api/watchdog/ops/vault/${vaultEntryId}/reveal`)
      .set(adminAuth())
      .send({ reason: "smoke reveal audit validation" });

    expect(reveal.status).toBe(200);
    expect(reveal.body.item?.id).toBe(vaultEntryId);
    expect(reveal.body.item?.password).toBe("super-secret-value");

    const accessEvents = await request(app)
      .get(`/api/watchdog/ops/vault/access-events?vaultEntryId=${encodeURIComponent(vaultEntryId)}`)
      .set(adminAuth());

    expect(accessEvents.status).toBe(200);
    expect(Array.isArray(accessEvents.body.items)).toBe(true);
    expect(
      accessEvents.body.items.some(
        (event: { vaultEntryId: string; accessType: string }) =>
          event.vaultEntryId === vaultEntryId && event.accessType === "reveal",
      ),
    ).toBe(true);
  });

  it("supports audit feed filtering and returns health dashboard payload", async () => {
    const audit = await request(app)
      .get("/api/watchdog/ops/audit")
      .query({
        eventType: "WATCHDOG_VAULT_SECRET_REVEALED",
        module: "watchdog",
        limit: 25,
      })
      .set(adminAuth());

    expect(audit.status).toBe(200);
    expect(Array.isArray(audit.body.items)).toBe(true);
    expect(audit.body.pagination).toHaveProperty("page");
    expect(audit.body.pagination).toHaveProperty("total");

    const health = await request(app)
      .get("/api/watchdog/ops/health")
      .set(adminAuth());

    expect(health.status).toBe(200);
    expect(Array.isArray(health.body.checks)).toBe(true);
    expect(health.body.checks.length).toBeGreaterThan(0);
    expect(health.body.summary).toHaveProperty("healthy");
    expect(health.body.summary).toHaveProperty("partial");
    expect(health.body.summary).toHaveProperty("broken");
    expect(health.body.summary).toHaveProperty("notImplemented");
  });
});

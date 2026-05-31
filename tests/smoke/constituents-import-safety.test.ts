import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let token = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  token = login.body.data?.accessToken ?? "";
});

describe("constituent import safety", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("records import runs and supports guarded rollback", async () => {
    const suffix = `${Date.now()}`;
    const externalId = `safe-import-${suffix}`;
    const email = `safe-import-${suffix}@example.com`;
    const phone = `8${suffix.slice(-9).padStart(9, "0")}`;

    const importRes = await request(app)
      .post("/api/constituents/import")
      .set(auth())
      .send({
        records: [
          {
            firstName: "Safety",
            lastName: `Rollback-${suffix}`,
            email,
            externalId,
            phone,
            type: "donor",
          },
          {
            firstName: "Safety",
            lastName: `Rollback-${suffix}`,
            email,
            externalId,
            phone,
            type: "donor",
          },
        ],
        mode: "create_only",
        dryRun: false,
        matchExtId: true,
        matchEmail: true,
        matchPhone: false,
        duplicateResolution: "merge",
        allowOrgImport: true,
      });

    expect(importRes.status).toBe(200);
    expect(importRes.body.created).toBe(1);
    expect(importRes.body.duplicatesInFile + importRes.body.skipped).toBeGreaterThanOrEqual(1);
    expect(typeof importRes.body.importRunId).toBe("string");
    expect(importRes.body.rollbackSupported).toBe(true);
    const runId = importRes.body.importRunId as string;

    const historyRes = await request(app)
      .get("/api/constituents/import/history?limit=10")
      .set(auth());

    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body.items)).toBe(true);
    expect((historyRes.body.items as Array<{ runId: string }>).some((item) => item.runId === runId)).toBe(true);

    const previewRes = await request(app)
      .post(`/api/constituents/import/${runId}/rollback/preview`)
      .set(auth())
      .send({});

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.runId).toBe(runId);

    const cleanupByEmail = async () => {
      const cleanupCandidatesRes = await request(app)
        .get(`/api/constituents?search=${encodeURIComponent(email)}&limit=200`)
        .set(auth());
      expect(cleanupCandidatesRes.status).toBe(200);
      const cleanupRows = Array.isArray(cleanupCandidatesRes.body)
        ? cleanupCandidatesRes.body as Array<{ id: string; email?: string | null }>
        : ((cleanupCandidatesRes.body?.items ?? []) as Array<{ id: string; email?: string | null }>);

      const matchingRows = cleanupRows.filter((row) => (row.email ?? "").toLowerCase() === email.toLowerCase());
      for (const row of matchingRows) {
        const deleteRes = await request(app)
          .delete(`/api/constituents/${row.id}`)
          .set(auth());
        expect([200, 204]).toContain(deleteRes.status);
      }
    };

    if (previewRes.body.canRollback) {
      expect(previewRes.body.summary.canDeleteCreated).toBeGreaterThanOrEqual(1);

      const rollbackRes = await request(app)
        .post(`/api/constituents/import/${runId}/rollback`)
        .set(auth())
        .send({
          confirm: true,
          confirmationText: `ROLLBACK-CONSTITUENT-IMPORT:${runId}`,
        });

      if (rollbackRes.status === 200) {
        expect(rollbackRes.body.runId).toBe(runId);
        expect(rollbackRes.body.deletedCreated).toBeGreaterThanOrEqual(1);
      } else {
        expect(rollbackRes.status).toBe(409);
        await cleanupByEmail();
      }
    } else {
      expect(Array.isArray(previewRes.body.blockedReasons)).toBe(true);
      const rollbackBlocked = await request(app)
        .post(`/api/constituents/import/${runId}/rollback`)
        .set(auth())
        .send({
          confirm: true,
          confirmationText: `ROLLBACK-CONSTITUENT-IMPORT:${runId}`,
        });
      expect(rollbackBlocked.status).toBe(409);
      await cleanupByEmail();
    }

    const searchRes = await request(app)
      .get(`/api/constituents?search=${encodeURIComponent(email)}&limit=200`)
      .set(auth());

    expect(searchRes.status).toBe(200);
    const rows = Array.isArray(searchRes.body)
      ? searchRes.body as Array<{ email?: string | null }>
      : ((searchRes.body?.items ?? []) as Array<{ email?: string | null }>);
    expect(rows.some((row) => (row.email ?? "").toLowerCase() === email.toLowerCase())).toBe(false);
  });

  it("requires typed rollback confirmation text", async () => {
    const suffix = `${Date.now()}`;
    const externalId = `safe-import-confirm-${suffix}`;
    const email = `safe-import-confirm-${suffix}@example.com`;

    const importRes = await request(app)
      .post("/api/constituents/import")
      .set(auth())
      .send({
        records: [
          {
            firstName: "Confirm",
            lastName: `Guard-${suffix}`,
            email,
            externalId,
            phone: "555-555-1212",
          },
        ],
        mode: "create_only",
        dryRun: false,
        matchExtId: true,
        matchEmail: true,
        matchPhone: true,
      });

    expect(importRes.status).toBe(200);
    const runId = importRes.body.importRunId as string;
    expect(typeof runId).toBe("string");

    const guarded = await request(app)
      .post(`/api/constituents/import/${runId}/rollback`)
      .set(auth())
      .send({
        confirm: true,
        confirmationText: "ROLLBACK",
      });

    expect(guarded.status).toBe(400);

    // Cleanup with correct confirmation so this test does not leave extra records.
    const cleanup = await request(app)
      .post(`/api/constituents/import/${runId}/rollback`)
      .set(auth())
      .send({
        confirm: true,
        confirmationText: `ROLLBACK-CONSTITUENT-IMPORT:${runId}`,
      });

    expect([200, 409]).toContain(cleanup.status);
  });

  it("imports explicit communication preference flags and country", async () => {
    const suffix = `${Date.now()}`;
    const externalId = `safe-import-prefs-${suffix}`;
    const email = `safe-import-prefs-${suffix}@example.com`;

    const importRes = await request(app)
      .post("/api/constituents/import")
      .set(auth())
      .send({
        records: [
          {
            firstName: "Preference",
            lastName: `Flags-${suffix}`,
            email,
            externalId,
            country: "ca",
            doNotEmail: "true",
            doNotCall: "yes",
            doNotMail: "1",
            doNotContact: "false",
            emailOptOut: "true",
          },
        ],
        mode: "create_only",
        dryRun: false,
        matchExtId: true,
        matchEmail: true,
        matchPhone: true,
      });

    expect(importRes.status).toBe(200);
    const runId = importRes.body.importRunId as string;
    expect(typeof runId).toBe("string");

    const searchRes = await request(app)
      .get(`/api/constituents?search=${encodeURIComponent(email)}&limit=200`)
      .set(auth());

    expect(searchRes.status).toBe(200);
    const rows = Array.isArray(searchRes.body)
      ? searchRes.body as Array<{ id: string; email?: string | null }>
      : ((searchRes.body?.items ?? []) as Array<{ id: string; email?: string | null }>);

    const imported = rows.find((row) => (row.email ?? "").toLowerCase() === email.toLowerCase());
    expect(imported).toBeTruthy();

    const detailRes = await request(app)
      .get(`/api/constituents/${imported!.id}`)
      .set(auth());

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.country).toBe("CA");
    expect(detailRes.body.doNotEmail).toBe(true);
    expect(detailRes.body.doNotCall).toBe(true);
    expect(detailRes.body.doNotMail).toBe(true);
    expect(detailRes.body.doNotContact).toBe(false);
    expect(detailRes.body.emailOptOut).toBe(true);

    const cleanup = await request(app)
      .post(`/api/constituents/import/${runId}/rollback`)
      .set(auth())
      .send({
        confirm: true,
        confirmationText: `ROLLBACK-CONSTITUENT-IMPORT:${runId}`,
      });

    expect([200, 409]).toContain(cleanup.status);
  });
});

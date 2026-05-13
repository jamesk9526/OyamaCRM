/**
 * Grants + Funders CRUD smoke tests.
 * Covers funder creation, grant lifecycle (create, read, update, sections, activity),
 * and the stats endpoint.
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let token = "";
let funderId = "";
let grantId = "";
let caseItemId = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  token = login.body.data?.accessToken ?? "";
});

describe("grants and funders CRUD", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  // ── Funders ─────────────────────────────────────────────────────────────────

  it("lists funders (may be empty)", async () => {
    const res = await request(app).get("/api/grants/funders").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("creates a funder and returns 201", async () => {
    const res = await request(app)
      .post("/api/grants/funders")
      .set(auth())
      .send({
        name: "Smoke Test Foundation",
        type: "PRIVATE_FOUNDATION",
        contactName: "Jane Tester",
        contactEmail: "jane@smoketest.org",
        notes: "Created by smoke test",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe("Smoke Test Foundation");
    funderId = res.body.id;
  });

  it("rejects funder creation without name", async () => {
    const res = await request(app)
      .post("/api/grants/funders")
      .set(auth())
      .send({ type: "PRIVATE_FOUNDATION" });
    expect(res.status).toBe(400);
  });

  it("updates funder website and notes", async () => {
    expect(funderId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/grants/funders/${funderId}`)
      .set(auth())
      .send({ website: "https://smoketest.org", notes: "Updated by smoke test" });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBeGreaterThan(0);
    expect(res.body.id).toBe(funderId);
    expect(res.body.website).toBe("https://smoketest.org");
  });

  // ── Grants ──────────────────────────────────────────────────────────────────

  it("lists grants with shape", async () => {
    const res = await request(app).get("/api/grants").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns grants stats summary", async () => {
    const res = await request(app).get("/api/grants/stats").set(auth());
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe("number");
    expect(typeof res.body.totalRequested).toBe("number");
    expect(typeof res.body.totalAwarded).toBe("number");
  });

  it("creates a new grant", async () => {
    expect(funderId).toBeTruthy();
    const applicationDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/grants")
      .set(auth())
      .send({
        funderId,
        title: "Smoke Test Grant",
        status: "PROSPECTING",
        amountRequested: 50000,
        applicationDeadline,
        programArea: "Education",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe("Smoke Test Grant");
    expect(res.body.status).toBe("RESEARCH");
    expect(res.body.donationId).toBeUndefined();
    expect(res.body.receiptNumber).toBeUndefined();
    grantId = res.body.id;
  });

  it("fetches the grant by ID with sections", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app).get(`/api/grants/${grantId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(grantId);
    // Should include sections array (seeded by default)
    expect(Array.isArray(res.body.sections)).toBe(true);
    expect(res.body.sections.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown grant", async () => {
    const res = await request(app).get("/api/grants/nonexistent-grant-xyz").set(auth());
    expect(res.status).toBe(404);
  });

  it("updates grant status to SUBMITTED", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/grants/${grantId}`)
      .set(auth())
      .send({ status: "SUBMITTED", amountRequested: 55000 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PROPOSAL_SUBMITTED");
  });

  it("rejects invalid status values with validation error", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/grants/${grantId}`)
      .set(auth())
      .send({ status: "NOT_A_REAL_STATUS" });
    expect(res.status).toBe(400);
  });

  it("updates a writing section content", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/grants/${grantId}/sections/executive_summary`)
      .set(auth())
      .send({ content: "This is the smoke-test executive summary.", completed: false });
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("smoke-test");
  });

  it("creates a reminder case item for the grant", async () => {
    expect(grantId).toBeTruthy();
    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post(`/api/grants/${grantId}/case-items`)
      .set(auth())
      .send({
        kind: "REMINDER",
        title: "Smoke reminder",
        description: "Reminder from smoke test",
        status: "PENDING",
        dueAt: due,
        remindAt: due,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.kind).toBe("REMINDER");
    caseItemId = res.body.id;
  });

  it("creates a resource case item for the grant", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app)
      .post(`/api/grants/${grantId}/case-items`)
      .set(auth())
      .send({
        kind: "RESOURCE",
        title: "Application portal",
        status: "ACTIVE",
        resourceType: "Portal",
        url: "https://example.org/grants/smoke",
      });
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe("RESOURCE");
    expect(res.body.url).toContain("example.org");
  });

  it("lists case items for one grant", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app).get(`/api/grants/${grantId}/case-items`).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("updates case item status", async () => {
    expect(grantId).toBeTruthy();
    expect(caseItemId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/grants/${grantId}/case-items/${caseItemId}`)
      .set(auth())
      .send({ status: "COMPLETED" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMPLETED");
  });

  it("lists grant sections", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app).get(`/api/grants/${grantId}/sections`).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("adds an activity note to the grant", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app)
      .post(`/api/grants/${grantId}/activity`)
      .set(auth())
      .send({ type: "NOTE", note: "Smoke test note added during test run" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });

  it("lists activity timeline for the grant", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app).get(`/api/grants/${grantId}/activity`).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("deletes the smoke grant", async () => {
    expect(grantId).toBeTruthy();
    const res = await request(app).delete(`/api/grants/${grantId}`).set(auth());
    expect([200, 204]).toContain(res.status);
  });

  it("deletes the smoke funder", async () => {
    expect(funderId).toBeTruthy();
    const res = await request(app).delete(`/api/grants/funders/${funderId}`).set(auth());
    expect([200, 204]).toContain(res.status);
  });
});

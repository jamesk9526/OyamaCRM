/**
 * Critical hardening smoke tests.
 * Focuses on auth protection and strict validation for high-risk write paths.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let accessToken = "";

const createdFunderIds: string[] = [];
const createdGrantIds: string[] = [];

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });

  expect(login.status).toBe(200);
  accessToken = login.body.data?.accessToken ?? "";
  expect(accessToken).toBeTruthy();
});

afterAll(async () => {
  const auth = { Authorization: `Bearer ${accessToken}` };

  for (const grantId of createdGrantIds) {
    await request(app).delete(`/api/grants/${grantId}`).set(auth);
  }

  for (const funderId of createdFunderIds) {
    await request(app).delete(`/api/grants/funders/${funderId}`).set(auth);
  }
});

/** Returns auth headers for privileged smoke requests. */
function authHeader() {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Creates one smoke funder and tracks it for cleanup. */
async function createSmokeFunder(label: string): Promise<string> {
  const res = await request(app)
    .post("/api/grants/funders")
    .set(authHeader())
    .send({
      name: `Critical Funder ${label} ${Date.now()}`,
      type: "PRIVATE_FOUNDATION",
    });

  expect(res.status).toBe(201);
  expect(res.body.id).toBeTruthy();
  createdFunderIds.push(res.body.id);
  return res.body.id as string;
}

/** Creates one smoke grant and tracks it for cleanup. */
async function createSmokeGrant(funderId: string, label: string): Promise<string> {
  const res = await request(app)
    .post("/api/grants")
    .set(authHeader())
    .send({
      funderId,
      title: `Critical Grant ${label} ${Date.now()}`,
      status: "RESEARCH",
    });

  expect(res.status).toBe(201);
  expect(res.body.id).toBeTruthy();
  createdGrantIds.push(res.body.id);
  return res.body.id as string;
}

describe("critical hardening smoke", () => {
  it("blocks unauthenticated access to protected endpoints", async () => {
    const [livecomRes, grantsRes, settingsRes] = await Promise.all([
      request(app).get("/api/livecom/interactions"),
      request(app).get("/api/grants"),
      request(app).get("/api/settings"),
    ]);

    expect(livecomRes.status).toBe(401);
    expect(grantsRes.status).toBe(401);
    expect(settingsRes.status).toBe(401);
  });

  it("rejects invalid grant status on create with 400", async () => {
    const funderId = await createSmokeFunder("InvalidStatusCreate");

    const res = await request(app)
      .post("/api/grants")
      .set(authHeader())
      .send({
        funderId,
        title: "Grant with invalid status",
        status: "INVALID_STATUS",
      });

    expect(res.status).toBe(400);
  });

  it("rejects invalid grant status filters with 400", async () => {
    const res = await request(app)
      .get("/api/grants?status=INVALID_STATUS_FILTER")
      .set(authHeader());

    expect(res.status).toBe(400);
  });

  it("rejects LiveCom create payloads without detail", async () => {
    const res = await request(app)
      .post("/api/livecom/interactions")
      .set(authHeader())
      .send({
        constituentId: "con_01",
      });

    expect(res.status).toBe(400);
  });

  it("rejects LiveCom create payloads for unknown constituents", async () => {
    const res = await request(app)
      .post("/api/livecom/interactions")
      .set(authHeader())
      .send({
        constituentId: "con_not_real",
        detail: "Unknown constituent test",
      });

    expect(res.status).toBe(404);
  });

  it("accepts note alias when adding grant activity", async () => {
    const funderId = await createSmokeFunder("ActivityNoteAlias");
    const grantId = await createSmokeGrant(funderId, "ActivityNoteAlias");

    const res = await request(app)
      .post(`/api/grants/${grantId}/activity`)
      .set(authHeader())
      .send({
        type: "NOTE",
        note: "Critical hardening note alias test",
      });

    expect(res.status).toBe(201);
    expect(res.body.description).toContain("note alias test");
  });
});

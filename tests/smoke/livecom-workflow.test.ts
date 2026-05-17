/**
 * LiveCom smoke workflow tests.
 * Verifies interaction create/update/list behavior and constituent timeline linkage.
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let accessToken = "";
let createdInteractionId = "";
let targetConstituentId = "";
const uniqueSeed = `livecom-smoke-${Date.now()}`;
let createdDetail = `LiveCom smoke detail ${uniqueSeed}`;

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

  const constituents = await request(app).get("/api/constituents?limit=20").set(authHeader());
  expect(constituents.status).toBe(200);
  const rows = Array.isArray(constituents.body) ? constituents.body : constituents.body?.items;
  targetConstituentId = String(rows?.[0]?.id ?? "");
  expect(targetConstituentId).toBeTruthy();
});

/** Returns authorization headers for the seeded admin user. */
function authHeader() {
  return { Authorization: `Bearer ${accessToken}` };
}

describe("LiveCom smoke workflow", () => {
  it("lists tracked interactions", async () => {
    const res = await request(app).get("/api/livecom/interactions?limit=25").set(authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("creates one tracked interaction", async () => {
    const res = await request(app)
      .post("/api/livecom/interactions")
      .set(authHeader())
      .send({
        constituentId: targetConstituentId,
        detail: createdDetail,
        channel: "WEB_CHAT",
        status: "NEW",
        priority: "MEDIUM",
        owner: "Smoke Tester",
        eventLabel: "Chat Started",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.constituentId).toBe(targetConstituentId);
    expect(res.body.detail).toContain(uniqueSeed);
    expect(res.body.channel).toBe("WEB_CHAT");
    expect(res.body.status).toBe("NEW");

    createdInteractionId = res.body.id;
    expect(createdInteractionId).toBeTruthy();
  });

  it("surfaces the interaction in the linked constituent timeline", async () => {
    expect(createdInteractionId).toBeTruthy();

    const res = await request(app)
      .get(`/api/constituents/${targetConstituentId}`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activities)).toBe(true);

    const matched = (res.body.activities as Array<{ id: string; description: string }>).find(
      (activity) => activity.id === createdInteractionId || activity.description.includes(uniqueSeed),
    );

    expect(matched).toBeTruthy();
  });

  it("updates status, owner, and priority", async () => {
    expect(createdInteractionId).toBeTruthy();
    createdDetail = `LiveCom smoke updated ${uniqueSeed}`;

    const res = await request(app)
      .patch(`/api/livecom/interactions/${createdInteractionId}`)
      .set(authHeader())
      .send({
        status: "IN_PROGRESS",
        owner: "Steward Team",
        priority: "HIGH",
        detail: createdDetail,
        eventLabel: "Agent Reply Sent",
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdInteractionId);
    expect(res.body.status).toBe("IN_PROGRESS");
    expect(res.body.owner).toBe("Steward Team");
    expect(res.body.priority).toBe("HIGH");
    expect(res.body.detail).toContain(uniqueSeed);
  });

  it("supports status and search filtering", async () => {
    expect(createdInteractionId).toBeTruthy();

    const res = await request(app)
      .get(`/api/livecom/interactions?status=IN_PROGRESS&search=${encodeURIComponent(uniqueSeed)}&limit=100`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const found = (res.body as Array<{ id: string }>).some((row) => row.id === createdInteractionId);
    expect(found).toBe(true);
  });
});

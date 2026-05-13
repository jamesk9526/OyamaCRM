/**
 * Authenticated smoke tests for persisted HRM API routes.
 * Verifies that dashboard, people, scheduling, locations, messages, and settings endpoints are wired and operational.
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let authToken = "";
let createdLocationId = "";
let createdMessageId = "";

/** Sends one authenticated GET request using the seeded admin user token. */
function authGet(path: string) {
  return request(app).get(path).set("Authorization", `Bearer ${authToken}`);
}

/** Sends one authenticated POST request using the seeded admin user token. */
function authPost(path: string, body: string | object | undefined) {
  return request(app).post(path).set("Authorization", `Bearer ${authToken}`).send(body);
}

/** Sends one authenticated PATCH request using the seeded admin user token. */
function authPatch(path: string, body: string | object | undefined) {
  return request(app).patch(path).set("Authorization", `Bearer ${authToken}`).send(body);
}

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });

  expect(login.status).toBe(200);
  authToken = login.body.data?.accessToken ?? "";
  expect(authToken).toBeTruthy();
});

describe("GET /api/hrm/dashboard", () => {
  it("returns metrics and widget arrays", async () => {
    const res = await authGet("/api/hrm/dashboard");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("metrics");
    expect(res.body.metrics).toHaveProperty("activeStaff");
    expect(Array.isArray(res.body.todaySchedule)).toBe(true);
    expect(Array.isArray(res.body.locationStatus)).toBe(true);
    expect(Array.isArray(res.body.announcements)).toBe(true);
  });
});

describe("GET /api/hrm/people", () => {
  it("returns people list and totals", async () => {
    const res = await authGet("/api/hrm/people");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty("totals");
    expect(typeof res.body.totals.total).toBe("number");
  });
});

describe("GET /api/hrm/scheduling", () => {
  it("returns schedule buckets and conflict list", async () => {
    const res = await authGet("/api/hrm/scheduling");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.todayItems)).toBe(true);
    expect(Array.isArray(res.body.upcomingItems)).toBe(true);
    expect(Array.isArray(res.body.conflicts)).toBe(true);
    expect(Array.isArray(res.body.staffAvailability)).toBe(true);
  });
});

describe("/api/hrm/locations", () => {
  it("creates one location", async () => {
    const unique = `${Date.now()}`;
    const res = await authPost("/api/hrm/locations", {
      name: `HRM Smoke ${unique}`,
      code: `HRM-${unique.slice(-5)}`,
      timezone: "America/Chicago",
      status: "ACTIVE",
      city: "Smoke City",
      state: "IL",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("item");
    expect(res.body.item).toHaveProperty("id");
    createdLocationId = res.body.item.id;
    expect(createdLocationId).toBeTruthy();
  });

  it("updates the created location", async () => {
    expect(createdLocationId).toBeTruthy();

    const res = await authPatch(`/api/hrm/locations/${createdLocationId}`, {
      status: "INACTIVE",
      notes: "Updated by smoke test",
    });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe("INACTIVE");
  });

  it("lists location rows", async () => {
    const res = await authGet("/api/hrm/locations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const found = (res.body.items as Array<{ id: string }>).some((location) => location.id === createdLocationId);
    expect(found).toBe(true);
  });
});

describe("/api/hrm/messages", () => {
  it("sends one broadcast message", async () => {
    const res = await authPost("/api/hrm/messages", {
      title: `HRM smoke message ${Date.now()}`,
      body: "Smoke test message body",
      kind: "ANNOUNCEMENT",
      priority: "NORMAL",
      broadcastAll: true,
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("item");
    expect(res.body.item).toHaveProperty("id");
    createdMessageId = res.body.item.id;
    expect(createdMessageId).toBeTruthy();
  });

  it("returns sent messages", async () => {
    const res = await authGet("/api/hrm/messages?folder=sent");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.unreadCount).toBe("number");
  });

  it("archives the created message", async () => {
    expect(createdMessageId).toBeTruthy();

    const res = await authPatch(`/api/hrm/messages/${createdMessageId}/archive`, {});
    expect(res.status).toBe(200);
    expect(res.body.item.archivedAt).toBeTruthy();
  });
});

describe("/api/hrm/settings", () => {
  it("returns persisted settings payload", async () => {
    const res = await authGet("/api/hrm/settings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("item");
    expect(res.body.item).toHaveProperty("defaultTimezone");
    expect(Array.isArray(res.body.locationOptions)).toBe(true);
  });

  it("updates settings values", async () => {
    const getRes = await authGet("/api/hrm/settings");
    expect(getRes.status).toBe(200);

    const current = getRes.body.item;

    const patchRes = await authPatch("/api/hrm/settings", {
      defaultTimezone: current.defaultTimezone,
      defaultLocationId: current.defaultLocationId,
      allowCompassionAssignmentSync: current.allowCompassionAssignmentSync,
      requireSchedulableFlag: current.requireSchedulableFlag,
      messageDigestEnabled: current.messageDigestEnabled,
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body).toHaveProperty("item");
    expect(patchRes.body.item.defaultTimezone).toBe(current.defaultTimezone);
  });
});

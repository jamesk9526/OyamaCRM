/** Smoke tests for Compassion public scheduling endpoints, slot policy enforcement, and permissions. */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
let readonlyToken = "";
let widgetToken = "";
let requestedDate = "";
let firstSlotStart = "";
let uniqueLocation = "";

/** Builds a YYYY-MM-DD date key for the public slots API. */
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const adminLogin = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  adminToken = adminLogin.body.data?.accessToken ?? "";

  const readonlyLogin = await request(app).post("/api/auth/login").send({
    email: "viewer@hopefoundation.org",
    password: "readonly123!",
  });
  readonlyToken = readonlyLogin.body.data?.accessToken ?? "";

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(0, 0, 0, 0);
  requestedDate = toDateKey(tomorrow);
  widgetToken = `smoke-widget-${Date.now()}`;
  uniqueLocation = `Smoke Test Office ${Date.now()}`;

  const configured = await request(app)
    .put("/api/compassion/appointment-widget")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      enabled: true,
      config: {
        enabled: true,
        token: widgetToken,
        slotIntervalMinutes: 30,
        appointmentDurationMinutes: 30,
        minLeadHours: 0,
        maxAdvanceDays: 120,
        locationOptions: [uniqueLocation],
        availabilityBlocks: [
          {
            id: "smoke-public-slot-block",
            dayOfWeek: tomorrow.getDay(),
            startTime: "09:00",
            endTime: "11:00",
            location: uniqueLocation,
            appointmentType: "ANY",
            capacity: 1,
            isActive: true,
          },
        ],
        blackoutDates: [],
      },
    });

  expect(configured.status).toBe(200);
  expect(configured.body.enabled).toBe(true);
});

describe("compassion public scheduling", () => {
  it("allows authenticated users to read widget settings", async () => {
    const res = await request(app)
      .get("/api/compassion/appointment-widget")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.publicUrl).toBe("string");
    expect(String(res.body.scriptSnippet)).toContain("/embed/compassion-schedule.js");
  });

  it("blocks readonly users from updating widget settings", async () => {
    const res = await request(app)
      .put("/api/compassion/appointment-widget")
      .set("Authorization", `Bearer ${readonlyToken}`)
      .send({ enabled: true, config: { token: widgetToken } });

    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown widget token", async () => {
    const res = await request(app).get("/api/compassion-public/widget/not-a-real-token/config");
    expect(res.status).toBe(404);
  });

  it("validates public slots date format", async () => {
    const res = await request(app).get(`/api/compassion-public/widget/${widgetToken}/slots?date=05-10-2026`);
    expect(res.status).toBe(400);
  });

  it("returns slot availability for the configured date", async () => {
    const res = await request(app).get(`/api/compassion-public/widget/${widgetToken}/slots?date=${requestedDate}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots.length).toBeGreaterThan(0);
    expect(res.body.slots[0]?.location).toBe(uniqueLocation);
    firstSlotStart = String(res.body.slots[0]?.startTime ?? "");
    expect(firstSlotStart).toBeTruthy();
  });

  it("rejects invalid public booking payloads", async () => {
    const res = await request(app)
      .post(`/api/compassion-public/widget/${widgetToken}/appointments`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("rejects unavailable slots with conflict response", async () => {
    const impossibleStart = new Date(`${requestedDate}T23:00:00`).toISOString();

    const res = await request(app)
      .post(`/api/compassion-public/widget/${widgetToken}/appointments`)
      .send({
        firstName: "Morgan",
        lastName: "Lane",
        phone: "555-1212",
        location: uniqueLocation,
        appointmentType: "INTAKE",
        startTime: impossibleStart,
      });

    expect(res.status).toBe(409);
    expect(res.body?.error?.code).toBe("SLOT_UNAVAILABLE");
  });

  it("creates an appointment from a valid slot and enforces capacity", async () => {
    const first = await request(app)
      .post(`/api/compassion-public/widget/${widgetToken}/appointments`)
      .send({
        firstName: "Jordan",
        lastName: "Bennett",
        email: `jordan.${Date.now()}@example.com`,
        phone: "555-0101",
        location: uniqueLocation,
        appointmentType: "INTAKE",
        startTime: firstSlotStart,
      });

    expect(first.status).toBe(201);
    expect(first.body.appointmentId).toBeTruthy();

    const second = await request(app)
      .post(`/api/compassion-public/widget/${widgetToken}/appointments`)
      .send({
        firstName: "Taylor",
        lastName: "Reed",
        email: `taylor.${Date.now()}@example.com`,
        phone: "555-0202",
        location: uniqueLocation,
        appointmentType: "INTAKE",
        startTime: firstSlotStart,
      });

    expect(second.status).toBe(409);
    expect(second.body?.error?.code).toBe("SLOT_UNAVAILABLE");
  });
});

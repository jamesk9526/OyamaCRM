/** Smoke tests for Compassion appointment scheduling, conflict prevention, and public-to-admin sync. */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let accessToken = "";
let adminUserId = "";
let createdClientId = "";
let createdAppointmentId = "";

/** Builds a YYYY-MM-DD key from a date instance. */
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  accessToken = login.body.data?.accessToken ?? "";

  const me = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${accessToken}`);
  adminUserId = String(me.body?.data?.id ?? me.body?.id ?? "");
});

describe("compassion appointments workspace", () => {
  it("creates a dedicated client for appointment tests", async () => {
    const suffix = Date.now();
    const res = await request(app)
      .post("/api/compassion/clients")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        firstName: "Sched",
        lastName: `Workspace${suffix}`,
        email: `sched.workspace.${suffix}@example.com`,
      });

    expect(res.status).toBe(201);
    createdClientId = res.body.id;
    expect(createdClientId).toBeTruthy();
  });

  it("creates a scheduled appointment and returns workspace flags", async () => {
    const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    start.setHours(10, 0, 0, 0);

    const res = await request(app)
      .post("/api/compassion/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: createdClientId,
        appointmentType: "INTAKE",
        startTime: start.toISOString(),
        durationMinutes: 60,
        location: `Room ${Date.now()}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe(createdClientId);
    expect(res.body.durationMinutes).toBeGreaterThanOrEqual(60);
    expect(typeof res.body.flags?.firstVisit).toBe("boolean");
    createdAppointmentId = res.body.id;
  });

  it("blocks conflicting overlapping appointment for same client", async () => {
    const overlap = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    overlap.setHours(10, 30, 0, 0);

    const res = await request(app)
      .post("/api/compassion/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: createdClientId,
        appointmentType: "FOLLOW_UP",
        startTime: overlap.toISOString(),
        durationMinutes: 30,
      });

    expect(res.status).toBe(409);
    expect(res.body?.error?.code).toBe("APPOINTMENT_CONFLICT");
    expect(Array.isArray(res.body?.conflicts)).toBe(true);
  });

  it("lists appointments with filter and search support", async () => {
    const listByStatus = await request(app)
      .get(`/api/compassion/appointments?status=SCHEDULED&clientId=${encodeURIComponent(createdClientId)}&limit=200`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listByStatus.status).toBe(200);
    expect(Array.isArray(listByStatus.body)).toBe(true);
    const foundByClient = (listByStatus.body as Array<{ id: string }>).some((row) => row.id === createdAppointmentId);
    expect(foundByClient).toBe(true);

    const listBySearch = await request(app)
      .get("/api/compassion/appointments?search=Sched&limit=200")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listBySearch.status).toBe(200);
    expect(Array.isArray(listBySearch.body)).toBe(true);
    const found = (listBySearch.body as Array<{ id: string }>).some((row) => row.id === createdAppointmentId);
    expect(found).toBe(true);
  });

  it("supports reschedule and status transitions", async () => {
    const movedStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    movedStart.setHours(14, 0, 0, 0);

    const rescheduled = await request(app)
      .patch(`/api/compassion/appointments/${createdAppointmentId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        startTime: movedStart.toISOString(),
        durationMinutes: 45,
      });

    expect(rescheduled.status).toBe(200);
    expect(rescheduled.body.id).toBe(createdAppointmentId);
    expect(["SCHEDULED", "RESCHEDULED"]).toContain(rescheduled.body.status);

    const completed = await request(app)
      .patch(`/api/compassion/appointments/${createdAppointmentId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "COMPLETED" });

    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe("COMPLETED");
  });

  it("syncs public widget bookings into admin appointment list", async () => {
    const token = `sync-widget-${Date.now()}`;
    const now = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    now.setHours(0, 0, 0, 0);
    const dateKey = toDateKey(now);
    const location = `Sync Office ${Date.now()}`;

    const configured = await request(app)
      .put("/api/compassion/appointment-widget")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        enabled: true,
        config: {
          enabled: true,
          token,
          slotIntervalMinutes: 30,
          appointmentDurationMinutes: 30,
          minLeadHours: 0,
          maxAdvanceDays: 180,
          locationOptions: [location],
          availabilityBlocks: [
            {
              id: "sync-test-block",
              dayOfWeek: now.getDay(),
              startTime: "09:00",
              endTime: "10:00",
              location,
              appointmentType: "ANY",
              capacity: 1,
              isActive: true,
            },
          ],
          blackoutDates: [],
        },
      });

    expect(configured.status).toBe(200);

    const slots = await request(app)
      .get(`/api/compassion-public/widget/${token}/slots?date=${dateKey}`);

    expect(slots.status).toBe(200);
    expect(Array.isArray(slots.body.slots)).toBe(true);
    expect(slots.body.slots.length).toBeGreaterThan(0);

    const startTime = slots.body.slots[0].startTime;
    const publicLastName = `PublicSync${Date.now()}`;
    const publicPhone = `555${Date.now().toString().slice(-7)}`;

    const booked = await request(app)
      .post(`/api/compassion-public/widget/${token}/appointments`)
      .send({
        firstName: "Widget",
        lastName: publicLastName,
        email: `widget.sync.${Date.now()}@example.com`,
        phone: publicPhone,
        location,
        appointmentType: "INTAKE",
        startTime,
      });

    expect(booked.status).toBe(201);
    expect(booked.body.appointmentId).toBeTruthy();
    const syncedId = String(booked.body.appointmentId);

    const appointmentDetail = await request(app)
      .get(`/api/compassion/appointments/${syncedId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(appointmentDetail.status).toBe(200);
    expect(appointmentDetail.body.id).toBe(syncedId);
    expect(appointmentDetail.body.client?.lastName).toBe(publicLastName);
  });
});

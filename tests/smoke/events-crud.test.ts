/**
 * Events CRUD smoke tests.
 * Covers event lifecycle: create, read, update, delete (soft/hard),
 * ticket-type management, guest registration, guest check-in,
 * dashboard summary, and the reports summary endpoint.
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let token = "";
let eventId = "";
let ticketTypeId = "";
let guestId = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  token = login.body.data?.accessToken ?? "";
});

describe("events CRUD", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("returns the dashboard summary with required fields", async () => {
    const res = await request(app).get("/api/events/dashboard-summary").set(auth());
    expect(res.status).toBe(200);
    expect(typeof res.body.totalEvents).toBe("number");
    expect(typeof res.body.activeEvents).toBe("number");
    expect(typeof res.body.upcomingEvents).toBe("number");
    expect(typeof res.body.registeredGuests).toBe("number");
    expect(typeof res.body.checkedInGuests).toBe("number");
    expect(typeof res.body.totalRevenue).toBe("number");
  });

  it("creates an event and returns 201", async () => {
    const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/events")
      .set(auth())
      .send({
        name: "Smoke Test Gala",
        type: "GALA",
        status: "DRAFT",
        startDate,
        location: "Smoke Test Venue",
        capacity: 200,
        revenueGoal: 50000,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe("Smoke Test Gala");
    eventId = res.body.id;
  });

  it("fetches the event by ID", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app).get(`/api/events/${eventId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(eventId);
    expect(Array.isArray(res.body.ticketTypes)).toBe(true);
  });

  it("returns 404 for unknown event", async () => {
    const res = await request(app).get("/api/events/nonexistent-event-xyz").set(auth());
    expect(res.status).toBe(404);
  });

  it("updates event name and status to PUBLISHED", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/events/${eventId}`)
      .set(auth())
      .send({ status: "PUBLISHED", location: "Updated Venue" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PUBLISHED");
    expect(res.body.location).toBe("Updated Venue");
  });

  // ── Ticket Types ─────────────────────────────────────────────────────────────

  it("creates a ticket type for the event", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app)
      .post(`/api/events/${eventId}/ticket-types`)
      .set(auth())
      .send({
        name: "General Admission",
        price: 75,
        capacity: 150,
        description: "Standard ticket",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe("General Admission");
    ticketTypeId = res.body.id;
  });

  it("lists ticket types for the event", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app)
      .get(`/api/events/${eventId}/ticket-types`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("updates ticket type price", async () => {
    expect(eventId).toBeTruthy();
    expect(ticketTypeId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/events/${eventId}/ticket-types/${ticketTypeId}`)
      .set(auth())
      .send({ price: 85 });
    expect(res.status).toBe(200);
    expect(Number(res.body.price)).toBe(85);
  });

  // ── Guests ───────────────────────────────────────────────────────────────────

  it("registers a guest for the event", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app)
      .post(`/api/events/${eventId}/guests`)
      .set(auth())
      .send({
        firstName: "Smoke",
        lastName: "Guest",
        email: "smoke.guest@example.com",
        rsvpStatus: "CONFIRMED",
        ticketTypeId,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.firstName).toBe("Smoke");
    guestId = res.body.id;
  });

  it("lists guests for the event", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app)
      .get(`/api/events/${eventId}/guests`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items ?? res.body)).toBe(true);
  });

  it("checks in the guest", async () => {
    expect(eventId).toBeTruthy();
    expect(guestId).toBeTruthy();
    const res = await request(app)
      .patch(`/api/events/${eventId}/guests/${guestId}`)
      .set(auth())
      .send({ checkedIn: true, checkedInAt: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.checkedIn).toBe(true);
  });

  // ── Reports ──────────────────────────────────────────────────────────────────

  it("returns events reports summary with correct shape", async () => {
    const res = await request(app).get("/api/events/reports/summary").set(auth());
    expect(res.status).toBe(200);
    expect(typeof res.body.totalEvents).toBe("number");
    expect(typeof res.body.totalRevenue).toBe("number");
    expect(typeof res.body.totalAttendees).toBe("number");
    expect(Array.isArray(res.body.topEvents)).toBe(true);
  });

  // ── Delete (hard — no orders) ────────────────────────────────────────────────

  it("deletes the smoke event (soft delete since it has a guest)", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app).delete(`/api/events/${eventId}`).set(auth());
    expect([200, 204]).toContain(res.status);
  });
});

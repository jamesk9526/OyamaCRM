/**
 * Events CRUD smoke tests.
 * Covers event lifecycle, ticket types, table seating, guest check-in,
 * order and sponsor workflows, donor-safe export, and reporting endpoints.
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let token = "";
let eventId = "";
let ticketTypeId = "";
let guestId = "";
let tableId = "";
let orderId = "";
let sponsorId = "";
let supportConstituentId = "";
let checkinCode = "";
let savedEventPageUrl = "";

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

  it("gets or creates a constituent for order and sponsor workflows", async () => {
    const list = await request(app)
      .get("/api/constituents?limit=20")
      .set(auth());
    expect(list.status).toBe(200);

    const rows = Array.isArray(list.body)
      ? (list.body as Array<{ id?: string }>)
      : ((list.body?.items ?? []) as Array<{ id?: string }>);

    const existing = rows.find((row) => typeof row?.id === "string" && row.id.length > 0);
    if (existing?.id) {
      supportConstituentId = existing.id;
      return;
    }

    const unique = Date.now();
    const created = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "Events",
        lastName: `Smoke ${unique}`,
        email: `events-smoke-${unique}@example.org`,
        type: "DONOR",
      });

    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    supportConstituentId = created.body.id;
  });

  // ── Tables ───────────────────────────────────────────────────────────────────

  it("creates a table for the event", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .post(`/api/events/${eventId}/tables`)
      .set(auth())
      .send({
        name: "Table 1",
        capacity: 10,
        tableNumber: 1,
        hostName: "Smoke Host",
        isSponsored: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe("Table 1");
    tableId = res.body.id;
  });

  it("updates table details", async () => {
    expect(tableId).toBeTruthy();

    const res = await request(app)
      .patch(`/api/events/tables/${tableId}`)
      .set(auth())
      .send({
        capacity: 12,
        hostName: "Updated Host",
      });

    expect(res.status).toBe(200);
    expect(res.body.hostName).toBe("Updated Host");
    expect(Number(res.body.capacity)).toBe(12);
  });

  it("lists tables for the event", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/${eventId}/tables`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as Array<{ id: string }>).some((row) => row.id === tableId)).toBe(true);
  });

  // ── Guests ───────────────────────────────────────────────────────────────────

  it("registers a guest for the event", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app)
      .post(`/api/events/${eventId}/guests`)
      .set(auth())
      .send({
        constituentId: supportConstituentId || undefined,
        firstName: "Smoke",
        lastName: "Guest",
        email: "smoke.guest@example.com",
        rsvpStatus: "CONFIRMED",
        paymentStatus: "DUE",
        ticketTypeId,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.firstName).toBe("Smoke");
    expect(typeof res.body.checkinCode).toBe("string");
    guestId = res.body.id;
    checkinCode = String(res.body.checkinCode ?? "");
  });

  it("lists guests for the event", async () => {
    expect(eventId).toBeTruthy();
    const res = await request(app)
      .get(`/api/events/${eventId}/guests`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as Array<{ id: string }>).some((row) => row.id === guestId)).toBe(true);
  });

  it("looks up the guest by check-in code", async () => {
    expect(checkinCode).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/guests/by-code/${encodeURIComponent(checkinCode)}?eventId=${encodeURIComponent(eventId)}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(guestId);
    expect(String(res.body.checkinCode || "").toUpperCase()).toBe(checkinCode.toUpperCase());
  });

  it("assigns guest to a table", async () => {
    expect(guestId).toBeTruthy();
    expect(tableId).toBeTruthy();

    const res = await request(app)
      .patch(`/api/events/guests/${guestId}/assign-table`)
      .set(auth())
      .send({ tableId });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(guestId);
    expect(res.body.table?.id).toBe(tableId);
  });

  it("checks in the guest", async () => {
    expect(eventId).toBeTruthy();
    expect(guestId).toBeTruthy();
    const res = await request(app)
      .post(`/api/events/guests/${guestId}/check-in`)
      .set(auth())
      .send({ checkedIn: true });
    expect(res.status).toBe(200);
    expect(res.body.checkedIn).toBe(true);
  });

  // ── Orders ───────────────────────────────────────────────────────────────────

  it("creates a manual event order", async () => {
    expect(eventId).toBeTruthy();
    expect(ticketTypeId).toBeTruthy();
    expect(supportConstituentId).toBeTruthy();

    const res = await request(app)
      .post(`/api/events/${eventId}/orders`)
      .set(auth())
      .send({
        constituentId: supportConstituentId,
        status: "PENDING",
        paymentMethod: "CHECK",
        notes: "Events smoke test order",
        items: [
          {
            ticketTypeId,
            quantity: 2,
            unitPrice: 85,
            totalPrice: 170,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.constituent?.id).toBe(supportConstituentId);
    expect(Number(res.body.totalAmount)).toBe(170);
    orderId = res.body.id;
  });

  it("updates order status to CONFIRMED", async () => {
    expect(orderId).toBeTruthy();

    const res = await request(app)
      .patch(`/api/events/orders/${orderId}`)
      .set(auth())
      .send({
        status: "CONFIRMED",
        notes: "Confirmed by smoke test",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CONFIRMED");
  });

  it("lists orders for the event", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/${eventId}/orders`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as Array<{ id: string }>).some((row) => row.id === orderId)).toBe(true);
  });

  // ── Sponsors ────────────────────────────────────────────────────────────────

  it("creates a sponsor record", async () => {
    expect(eventId).toBeTruthy();
    expect(supportConstituentId).toBeTruthy();

    const res = await request(app)
      .post(`/api/events/${eventId}/sponsors`)
      .set(auth())
      .send({
        constituentId: supportConstituentId,
        level: "GOLD",
        amount: 2500,
        benefits: "Logo placement and stage mention",
        notes: "Events smoke sponsor",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.level).toBe("GOLD");
    expect(Number(res.body.amount)).toBe(2500);
    sponsorId = res.body.id;
  });

  it("lists sponsors for the event", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/${eventId}/sponsors`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as Array<{ id: string }>).some((row) => row.id === sponsorId)).toBe(true);
  });

  it("updates sponsor level and amount", async () => {
    expect(sponsorId).toBeTruthy();

    const res = await request(app)
      .patch(`/api/events/sponsors/${sponsorId}`)
      .set(auth())
      .send({
        level: "PLATINUM",
        amount: 3200,
      });

    expect(res.status).toBe(200);
    expect(res.body.level).toBe("PLATINUM");
    expect(Number(res.body.amount)).toBe(3200);
  });

  // ── Reports & Exports ───────────────────────────────────────────────────────

  it("returns default event page builder config", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/${eventId}/page-builder-config`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.eventId).toBe(eventId);
    expect(typeof res.body.pageUrl).toBe("string");
    expect(res.body.pageUrl).toContain("/events/");
    expect(["Draft", "Published"]).toContain(res.body.status);
  });

  it("updates event page builder url config", async () => {
    expect(eventId).toBeTruthy();

    const nextUrl = `https://oyamachurch.org/events/smoke-url-${Date.now()}`;
    const res = await request(app)
      .patch(`/api/events/${eventId}/page-builder-config`)
      .set(auth())
      .send({
        pageUrl: nextUrl,
      });

    expect(res.status).toBe(200);
    expect(res.body.eventId).toBe(eventId);
    expect(res.body.pageUrl).toBe(nextUrl);
    savedEventPageUrl = nextUrl;
  });

  it("returns persisted event page builder url config", async () => {
    expect(eventId).toBeTruthy();
    expect(savedEventPageUrl).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/${eventId}/page-builder-config`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.pageUrl).toBe(savedEventPageUrl);
  });

  it("returns event-level reporting data with expected shape", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/${eventId}/report`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.event?.id).toBe(eventId);
    expect(typeof res.body.attendance?.total).toBe("number");
    expect(typeof res.body.revenue?.total).toBe("number");
    expect(typeof res.body.revenue?.orderCount).toBe("number");
    expect(typeof res.body.donorInsights?.linkedGuests).toBe("number");
    expect(typeof res.body.counts?.sponsors).toBe("number");
  });

  it("returns donor-safe export json payload", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/${eventId}/donor-safe-export`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.event?.id).toBe(eventId);
    expect(typeof res.body.summary?.totalGuests).toBe("number");
    expect(Array.isArray(res.body.rows)).toBe(true);

    const guestRow = (res.body.rows as Array<{ guestId: string; followUpAction: string; ssn?: string }>).find(
      (row) => row.guestId === guestId,
    );
    expect(guestRow).toBeTruthy();
    expect(typeof guestRow?.followUpAction).toBe("string");
    expect(Object.prototype.hasOwnProperty.call(guestRow ?? {}, "ssn")).toBe(false);
  });

  it("returns donor-safe export csv content", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .get(`/api/events/${eventId}/donor-safe-export?format=csv`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"] ?? "")).toContain("text/csv");
    expect(String(res.text ?? "")).toContain("event_name,guest_id");
    expect(String(res.text ?? "")).toContain("follow_up_action");
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

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  it("deletes the sponsor record", async () => {
    expect(sponsorId).toBeTruthy();

    const res = await request(app)
      .delete(`/api/events/sponsors/${sponsorId}`)
      .set(auth());

    expect(res.status).toBe(200);
  });

  it("deletes the event table and confirms guest unassignment", async () => {
    expect(tableId).toBeTruthy();

    const deleted = await request(app)
      .delete(`/api/events/tables/${tableId}`)
      .set(auth());

    expect(deleted.status).toBe(200);

    const guests = await request(app)
      .get(`/api/events/${eventId}/guests`)
      .set(auth());

    expect(guests.status).toBe(200);
    const linkedGuest = (guests.body as Array<{ id: string; table: { id: string } | null }>).find(
      (row) => row.id === guestId,
    );
    expect(linkedGuest).toBeTruthy();
    expect(linkedGuest?.table).toBeNull();
  });

  it("deletes the smoke event and marks it inactive when related records exist", async () => {
    expect(eventId).toBeTruthy();

    const res = await request(app)
      .delete(`/api/events/${eventId}`)
      .set(auth());

    expect([200, 204]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.soft).toBe(true);
    }

    const fetchAfterDelete = await request(app)
      .get(`/api/events/${eventId}`)
      .set(auth());

    if (fetchAfterDelete.status === 200) {
      expect(fetchAfterDelete.body.active).toBe(false);
      expect(fetchAfterDelete.body.status).toBe("CANCELLED");
    } else {
      expect(fetchAfterDelete.status).toBe(404);
    }
  });
});

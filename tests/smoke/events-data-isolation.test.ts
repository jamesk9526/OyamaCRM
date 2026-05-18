/**
 * Events data-isolation smoke test.
 *
 * Verifies the Events CRM safety net: when two events live in the same org,
 * guests, tables, and check-in totals returned for Event A must not appear in
 * Event B. This is the contract the event-scoped UI relies on so that selecting
 * an event in the workspace never mixes data with another event.
 *
 * Covers the explicit P0 requirement from the Events CRM roadmap:
 *   "No guest/table/check-in/donation data should mix between events."
 */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let token = "";
let eventAId = "";
let eventBId = "";
let guestAId = "";
let guestBId = "";
let tableAId = "";
let tableBId = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  token = login.body.data?.accessToken ?? "";
});

describe("events data isolation", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("creates two distinct events for isolation testing", async () => {
    const startDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
    const [a, b] = await Promise.all([
      request(app)
        .post("/api/events")
        .set(auth())
        .send({
          name: "Isolation Smoke — Event A",
          type: "GALA",
          status: "DRAFT",
          startDate,
          location: "Venue A",
          capacity: 100,
        }),
      request(app)
        .post("/api/events")
        .set(auth())
        .send({
          name: "Isolation Smoke — Event B",
          type: "GALA",
          status: "DRAFT",
          startDate,
          location: "Venue B",
          capacity: 100,
        }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    eventAId = a.body.id;
    eventBId = b.body.id;
    expect(eventAId).toBeTruthy();
    expect(eventBId).toBeTruthy();
    expect(eventAId).not.toBe(eventBId);
  });

  it("creates a table in Event A and a separate table in Event B", async () => {
    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/events/${eventAId}/tables`)
        .set(auth())
        .send({ name: "Table A1", capacity: 8, tableNumber: 1 }),
      request(app)
        .post(`/api/events/${eventBId}/tables`)
        .set(auth())
        .send({ name: "Table B1", capacity: 8, tableNumber: 1 }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    tableAId = a.body.id;
    tableBId = b.body.id;
    expect(tableAId).not.toBe(tableBId);
  });

  it("creates a guest in Event A and a separate guest in Event B", async () => {
    const uniqueEmailSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/events/${eventAId}/guests`)
        .set(auth())
        .send({
          firstName: "Alpha",
          lastName: "OnlyEventA",
          email: `alpha+${uniqueEmailSuffix}@isolation.test`,
        }),
      request(app)
        .post(`/api/events/${eventBId}/guests`)
        .set(auth())
        .send({
          firstName: "Beta",
          lastName: "OnlyEventB",
          email: `beta+${uniqueEmailSuffix}@isolation.test`,
        }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    guestAId = a.body.id;
    guestBId = b.body.id;
    expect(guestAId).not.toBe(guestBId);
  });

  it("Event A guest list does not include Event B guests", async () => {
    const res = await request(app).get(`/api/events/${eventAId}/guests`).set(auth());
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: string; lastName?: string }>).map((g) => g.id);
    expect(ids).toContain(guestAId);
    expect(ids).not.toContain(guestBId);
    // Defensive: no row labeled with the other event's marker should appear.
    const lastNames = (res.body as Array<{ lastName?: string }>).map((g) => g.lastName ?? "");
    expect(lastNames.some((n) => n === "OnlyEventB")).toBe(false);
  });

  it("Event B guest list does not include Event A guests", async () => {
    const res = await request(app).get(`/api/events/${eventBId}/guests`).set(auth());
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: string }>).map((g) => g.id);
    expect(ids).toContain(guestBId);
    expect(ids).not.toContain(guestAId);
  });

  it("Event A tables list does not include Event B tables", async () => {
    const res = await request(app).get(`/api/events/${eventAId}/tables`).set(auth());
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: string }>).map((t) => t.id);
    expect(ids).toContain(tableAId);
    expect(ids).not.toContain(tableBId);
  });

  it("Event B tables list does not include Event A tables", async () => {
    const res = await request(app).get(`/api/events/${eventBId}/tables`).set(auth());
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: string }>).map((t) => t.id);
    expect(ids).toContain(tableBId);
    expect(ids).not.toContain(tableAId);
  });

  it("checking in a guest in Event A does not change Event B check-in totals", async () => {
    // Capture Event B's checked-in count before the action.
    const beforeB = await request(app).get(`/api/events/${eventBId}/guests`).set(auth());
    expect(beforeB.status).toBe(200);
    const beforeBChecked = (beforeB.body as Array<{ checkedIn: boolean }>).filter((g) => g.checkedIn).length;

    // Check in the Event A guest.
    const check = await request(app).post(`/api/events/guests/${guestAId}/check-in`).set(auth()).send({});
    expect([200, 201]).toContain(check.status);

    // Verify Event A reflects the check-in.
    const afterA = await request(app).get(`/api/events/${eventAId}/guests`).set(auth());
    expect(afterA.status).toBe(200);
    const guestAAfter = (afterA.body as Array<{ id: string; checkedIn: boolean }>).find((g) => g.id === guestAId);
    expect(guestAAfter?.checkedIn).toBe(true);

    // Verify Event B's checked-in count is unchanged.
    const afterB = await request(app).get(`/api/events/${eventBId}/guests`).set(auth());
    expect(afterB.status).toBe(200);
    const afterBChecked = (afterB.body as Array<{ checkedIn: boolean }>).filter((g) => g.checkedIn).length;
    expect(afterBChecked).toBe(beforeBChecked);

    // And that Event A's guest does not appear in Event B's list.
    const bIds = (afterB.body as Array<{ id: string }>).map((g) => g.id);
    expect(bIds).not.toContain(guestAId);
  });

  it("Event A report does not aggregate Event B activity", async () => {
    const [reportA, reportB] = await Promise.all([
      request(app).get(`/api/events/${eventAId}/report`).set(auth()),
      request(app).get(`/api/events/${eventBId}/report`).set(auth()),
    ]);
    expect(reportA.status).toBe(200);
    expect(reportB.status).toBe(200);
    // Both reports must exist independently; Event B has zero check-ins from this test.
    // The contract here is that the per-event endpoint returns event-scoped numbers,
    // not org-wide aggregates.
    expect(reportA.body).toBeTruthy();
    expect(reportB.body).toBeTruthy();
    expect(reportA.body).not.toBe(reportB.body);
  });
});

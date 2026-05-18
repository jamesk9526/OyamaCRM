import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/src/lib/prisma";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let token = "";
let eventId = "";
let tableId = "";
let tableUid = "";
let tableKey = "";
let hostEmail = "";
let hostToken = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  token = login.body.data?.accessToken ?? "";
  expect(token).toBeTruthy();

  const startDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
  const eventRes = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: `TableLink API Test ${Date.now()}`,
      type: "GALA",
      status: "DRAFT",
      startDate,
      location: "TableLink API Venue",
      capacity: 120,
    });
  expect(eventRes.status).toBe(201);
  eventId = String(eventRes.body.id);
  hostEmail = `table-host-${Date.now()}@example.org`;

  const tableRes = await request(app)
    .post(`/api/events/${eventId}/tables`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "API Test Table",
      capacity: 8,
      tableNumber: 99,
      hostName: "API Host",
      hostEmail,
      status: "OPEN",
    });

  expect(tableRes.status).toBe(201);
  tableId = String(tableRes.body.id);
  tableUid = String(tableRes.body.tableUid);
  tableKey = String(tableRes.body.publicCode ?? tableRes.body.tableUid);
  expect(tableUid).toBeTruthy();
});

describe("events public tablelink api", () => {
  it("denies host access requests when email does not match table host", async () => {
    const res = await request(app).post("/api/events/public/tablelink/request-access").send({
      eventId,
      tableKey,
      email: "wrong-host@example.org",
    });

    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe("ACCESS_DENIED");
  });

  it("issues and verifies a host access token for the matching host email", async () => {
    const issue = await request(app).post("/api/events/public/tablelink/request-access").send({
      eventId,
      tableKey,
      email: hostEmail,
    });

    expect(issue.status).toBe(200);
    expect(issue.body.ok).toBe(true);
    expect(issue.body.tableUid).toBe(tableUid);
    expect(typeof issue.body.token).toBe("string");
    hostToken = String(issue.body.token ?? "");

    const verify = await request(app).post("/api/events/public/tablelink/verify-token").send({
      eventId,
      token: hostToken,
    });

    expect(verify.status).toBe(200);
    expect(verify.body.ok).toBe(true);
    expect(verify.body.eventId).toBe(eventId);
    expect(verify.body.tableUid).toBe(tableUid);
  });

  it("requires a public token for host portal table detail", async () => {
    const res = await request(app).get(`/api/events/public/tablelink/${eventId}/${tableUid}`);
    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe("TOKEN_REQUIRED");
  });

  it("rejects invalid public host tokens", async () => {
    const res = await request(app)
      .get(`/api/events/public/tablelink/${eventId}/${tableUid}`)
      .set("x-tablelink-token", "invalid-token-value");

    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe("ACCESS_DENIED");
  });

  it("blocks public host edits and invites when the table is locked", async () => {
    const lock = await request(app)
      .patch(`/api/events/tables/${tableId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "LOCKED" });
    expect(lock.status).toBe(200);

    const patchRes = await request(app)
      .patch(`/api/events/public/tablelink/${eventId}/${tableUid}`)
      .set("x-tablelink-token", hostToken)
      .send({ notes: "should fail while locked" });

    expect(patchRes.status).toBe(423);
    expect(patchRes.body?.error?.code).toBe("TABLE_LOCKED");

    const inviteRes = await request(app)
      .post(`/api/events/public/tablelink/${eventId}/${tableUid}/invite-guest`)
      .set("x-tablelink-token", hostToken)
      .send({ inviteEmail: `invite-${randomUUID()}@example.org` });

    expect(inviteRes.status).toBe(423);
    expect(inviteRes.body?.error?.code).toBe("TABLE_LOCKED");
  });

  it("returns cancelled and expired invite outcomes for guest self-entry routes", async () => {
    const cancelledToken = `cancelled-${randomUUID()}`;
    const cancelledHash = createHash("sha256").update(cancelledToken).digest("hex");
    await prisma.eventGuestInvite.create({
      data: {
        eventId,
        tableId,
        inviteEmail: `cancelled-${randomUUID()}@example.org`,
        tokenHash: cancelledHash,
        status: "CANCELLED",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const cancelledRead = await request(app).get(`/api/events/public/tablelink/invites/${cancelledToken}`);
    expect(cancelledRead.status).toBe(200);
    expect(cancelledRead.body?.invite?.status).toBe("CANCELLED");

    const cancelledComplete = await request(app)
      .post(`/api/events/public/tablelink/invites/${cancelledToken}/complete`)
      .send({
        firstName: "Guest",
        lastName: "Cancelled",
        email: `guest-cancelled-${randomUUID()}@example.org`,
      });

    expect(cancelledComplete.status).toBe(410);
    expect(cancelledComplete.body?.error?.code).toBe("INVITE_CANCELLED");

    const expiredToken = `expired-${randomUUID()}`;
    const expiredHash = createHash("sha256").update(expiredToken).digest("hex");
    await prisma.eventGuestInvite.create({
      data: {
        eventId,
        tableId,
        inviteEmail: `expired-${randomUUID()}@example.org`,
        tokenHash: expiredHash,
        status: "CREATED",
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
    });

    const expiredRead = await request(app).get(`/api/events/public/tablelink/invites/${expiredToken}`);
    expect(expiredRead.status).toBe(200);
    expect(expiredRead.body?.invite?.status).toBe("EXPIRED");

    const expiredComplete = await request(app)
      .post(`/api/events/public/tablelink/invites/${expiredToken}/complete`)
      .send({
        firstName: "Guest",
        lastName: "Expired",
        email: `guest-expired-${randomUUID()}@example.org`,
      });

    expect(expiredComplete.status).toBe(410);
    expect(expiredComplete.body?.error?.code).toBe("INVITE_EXPIRED");
  });
});
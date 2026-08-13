import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/src/lib/prisma";
import { loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
const cleanupIds: string[] = [];

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;
  adminToken = (await loginAsAdmin(app)).token;
});

afterAll(async () => {
  if (cleanupIds.length > 0) {
    await prisma.constituent.deleteMany({ where: { id: { in: cleanupIds } } });
  }
});

describe("constituent account closure", () => {
  it("hides a closed constituent and removes saved-list membership", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const suffix = Date.now();
    const email = `closed-account-${suffix}@example.org`;
    const created = await request(app)
      .post("/api/constituents")
      .set(auth)
      .send({ firstName: "Closure", lastName: `Test ${suffix}`, email, type: "DONOR" });

    expect(created.status).toBe(201);
    cleanupIds.push(created.body.id);

    const list = await request(app)
      .post("/api/email-campaigns/lists")
      .set(auth)
      .send({ name: `Closure list ${suffix}`, recipientConstituentIds: [created.body.id] });
    expect(list.status).toBe(201);
    expect(list.body.recipientsCount).toBe(1);

    const closed = await request(app)
      .post(`/api/constituents/${created.body.id}/close`)
      .set(auth)
      .send({ reason: "API closure regression test" });
    expect(closed.status).toBe(200);
    expect(closed.body.removedAudienceMemberships).toBe(1);

    const hiddenDetail = await request(app).get(`/api/constituents/${created.body.id}`).set(auth);
    expect(hiddenDetail.status).toBe(404);

    const search = await request(app).get(`/api/constituents?search=${encodeURIComponent(email)}&limit=all`).set(auth);
    expect(search.status).toBe(200);
    expect(search.body).toEqual([]);

    const listDetail = await request(app).get(`/api/email-campaigns/lists/${list.body.id}`).set(auth);
    expect(listDetail.status).toBe(200);
    expect(listDetail.body.recipients).toEqual([]);

    const stored = await prisma.constituent.findFirst({
      where: { id: created.body.id, closedAt: { not: null } },
      select: { closedReason: true, doNotContact: true, doNotEmail: true, doNotCall: true, doNotMail: true },
    });
    expect(stored).toMatchObject({
      closedReason: "API closure regression test",
      doNotContact: true,
      doNotEmail: true,
      doNotCall: true,
      doNotMail: true,
    });

    await prisma.emailRecipientList.delete({ where: { id: list.body.id } });
  });
});

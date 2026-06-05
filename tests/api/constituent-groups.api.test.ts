import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/src/lib/prisma";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let token = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });

  token = login.body.data?.accessToken ?? "";
});

describe("constituent groups api", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("creates a group and links a person constituent to it", async () => {
    const suffix = `${Date.now()}`;
    const groupName = `Grace Fellowship ${suffix}`;

    const groupRes = await request(app)
      .post("/api/constituents/groups")
      .set(auth())
      .send({
        name: groupName,
        groupType: "CHURCH",
      });

    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.id as string;

    const created = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "Rachel",
        lastName: `Moore ${suffix}`,
        type: "DONOR",
        groupMemberships: [
          {
            groupId,
            relationshipLabel: "Member",
            isPrimary: true,
          },
        ],
      });

    expect(created.status).toBe(201);

    const detail = await request(app)
      .get(`/api/constituents/${created.body.id}`)
      .set(auth());

    expect(detail.status).toBe(200);
    expect(detail.body.groupMemberships.some((membership: {
      relationshipLabel?: string | null;
      isPrimary?: boolean;
      group?: { id?: string; name?: string; groupType?: string };
    }) => (
      membership.group?.id === groupId
      && membership.group?.name === groupName
      && membership.group?.groupType === "CHURCH"
      && membership.relationshipLabel === "Member"
      && membership.isPrimary === true
    ))).toBe(true);

    const groups = await request(app)
      .get("/api/constituents/groups")
      .set(auth());

    expect(groups.status).toBe(200);
    expect(groups.body.some((group: { id?: string; name?: string }) => group.id === groupId && group.name === groupName)).toBe(true);

    const cleanup = await request(app)
      .delete(`/api/constituents/${created.body.id}`)
      .set(auth());

    expect([200, 204]).toContain(cleanup.status);
    await prisma.constituentGroupMember.deleteMany({ where: { groupId } });
    await prisma.constituentGroup.deleteMany({ where: { id: groupId } });
  });
});

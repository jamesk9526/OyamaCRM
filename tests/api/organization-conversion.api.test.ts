import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

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

describe("organization conversion data-tools api", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("previews and applies organization conversion candidates", async () => {
    const suffix = `${Date.now()}`;

    const created = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "Church of",
        lastName: `Aurora ${suffix}`,
        email: `org-convert-${suffix}@example.com`,
        type: "DONOR",
      });

    expect(created.status).toBe(201);
    const constituentId = created.body.id as string;

    const preview = await request(app)
      .get("/api/data-tools/organization-conversion/preview?limit=1000")
      .set(auth());

    expect(preview.status).toBe(200);
    const candidate = (preview.body.candidates as Array<{ constituentId: string }>).find((row) => row.constituentId === constituentId);
    expect(candidate).toBeTruthy();

    const orgName = `Church of Aurora ${suffix}`;
    const groupName = `${orgName} Members`;
    const apply = await request(app)
      .post("/api/data-tools/organization-conversion/apply")
      .set(auth())
      .send({
        conversions: [
          {
            constituentId,
            organizationName: orgName,
            displayName: orgName,
            type: "ORGANIZATION",
            organizationCategory: "CHURCH",
            groupType: "CHURCH",
            keepOriginalNameInNotes: true,
            addTags: true,
            createConstituentGroup: true,
            constituentGroupName: groupName,
          },
        ],
      });

    expect(apply.status).toBe(200);
    expect(apply.body.appliedCount).toBeGreaterThanOrEqual(1);

    const detail = await request(app)
      .get(`/api/constituents/${constituentId}`)
      .set(auth());

    expect(detail.status).toBe(200);
    expect(detail.body.firstName).toBe("");
    expect(detail.body.lastName).toBe(orgName);
    expect(detail.body.organizationName).toBe(orgName);
    expect(detail.body.displayName).toBe(orgName);
    expect(detail.body.entityKind).toBe("ORGANIZATION");
    expect(detail.body.organizationCategory).toBe("CHURCH");
    expect(Array.isArray(detail.body.groupMemberships)).toBe(true);
    expect(detail.body.groupMemberships.some((membership: { group?: { name?: string } }) => membership.group?.name === groupName)).toBe(true);

    const remove = await request(app)
      .delete(`/api/constituents/${constituentId}`)
      .set(auth());

    expect([200, 204]).toContain(remove.status);
  });
});

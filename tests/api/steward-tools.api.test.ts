// API integration tests for Steward tool list and execution coverage.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
const createdTemplateIds: string[] = [];

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const admin = await loginAsAdmin(app);
  adminToken = admin.token;
});

afterAll(async () => {
  const auth = { Authorization: `Bearer ${adminToken}` };
  for (const id of createdTemplateIds) {
    await request(app).delete(`/api/letters/templates/${id}`).set(auth);
  }
});

describe("steward tools api", () => {
  it("lists expanded donor tools for the active user", async () => {
    const response = await request(app)
      .get("/api/steward-ai/tools?moduleKey=donor&scopePath=/steward-ai-workspace")
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(200);

    const tools = response.body?.data?.tools;
    expect(Array.isArray(tools)).toBe(true);

    const names = tools.map((tool: { name: string }) => tool.name);
    expect(names).toContain("donor.getAcknowledgmentQueue");
    expect(names).toContain("donor.getRecurringGivingHealth");
    expect(names).toContain("donor.getPledgeAtRisk");
    expect(names).toContain("grants.getDeadlineRadar");
    expect(names).toContain("communications.listDraftsForReview");
    expect(names).toContain("letters.createLetterDraft");
  });

  it("executes new read tools with deterministic response shapes", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const recurring = await request(app)
      .post("/api/steward-ai/tools/execute")
      .set(auth)
      .send({
        tool: "donor.getRecurringGivingHealth",
        moduleKey: "donor",
        scopePath: "/steward-ai-workspace",
        input: { limit: 5, windowDays: 45 },
      })
      .expect(200);

    expect(recurring.body?.data?.tool).toBe("donor.getRecurringGivingHealth");
    expect(typeof recurring.body?.data?.result?.activeRecurringDonors).toBe("number");

    const grants = await request(app)
      .post("/api/steward-ai/tools/execute")
      .set(auth)
      .send({
        tool: "grants.getDeadlineRadar",
        moduleKey: "donor",
        scopePath: "/steward-ai-workspace",
        input: { limit: 8, windowDays: 120 },
      })
      .expect(200);

    expect(grants.body?.data?.tool).toBe("grants.getDeadlineRadar");
    expect(typeof grants.body?.data?.result?.totals?.total).toBe("number");
  });

  it("enforces confirm-first writes and can create a letter draft tool output", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const missingConfirm = await request(app)
      .post("/api/steward-ai/tools/execute")
      .set(auth)
      .send({
        tool: "letters.createLetterDraft",
        moduleKey: "donor",
        scopePath: "/steward-ai-workspace",
        input: {
          name: "Steward Tool Draft Missing Confirm",
          category: "THANK_YOU",
          printSubject: "Thanks for your partnership",
          printBody: "<p>Thank you for your gift.</p>",
        },
      });

    expect(missingConfirm.status).toBe(400);
    expect(missingConfirm.body?.error?.code).toBe("CONFIRMATION_REQUIRED");

    const created = await request(app)
      .post("/api/steward-ai/tools/execute")
      .set(auth)
      .send({
        tool: "letters.createLetterDraft",
        confirm: true,
        moduleKey: "donor",
        scopePath: "/steward-ai-workspace",
        input: {
          name: `Steward Tool Draft ${Date.now()}`,
          category: "THANK_YOU",
          printSubject: "Thanks for your partnership",
          printBody: "<p>Thank you for your gift.</p>",
        },
      })
      .expect(200);

    expect(created.body?.data?.tool).toBe("letters.createLetterDraft");
    expect(created.body?.data?.result?.created).toBe(true);
    expect(typeof created.body?.data?.result?.draft?.id).toBe("string");

    createdTemplateIds.push(String(created.body.data.result.draft.id));
  });
});

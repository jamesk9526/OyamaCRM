import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const admin = await loginAsAdmin(app);
  adminToken = admin.token;
});

describe("email campaign workflow api", () => {
  it("returns blockers on validate and blocks scheduling when campaign is not ready", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app)
      .post("/api/email-campaigns")
      .set(auth)
      .send({
        name: `Validation Blocking Campaign ${Date.now()}`,
      });

    expect(created.status).toBe(201);

    const validate = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/validate`)
      .set(auth)
      .send({});

    expect(validate.status).toBe(200);
    expect(validate.body?.valid).toBe(false);
    expect(Array.isArray(validate.body?.blockers)).toBe(true);
    expect(validate.body.blockers.length).toBeGreaterThan(0);

    const scheduledAt = new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString();
    const schedule = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/schedule`)
      .set(auth)
      .send({ scheduledAt });

    expect(schedule.status).toBe(400);
    expect(schedule.body?.error?.code).toBe("CAMPAIGN_NOT_READY");
    expect(schedule.body?.validation?.valid).toBe(false);
  });

  it("supports queue lifecycle controls, archive, and duplicate", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app)
      .post("/api/email-campaigns")
      .set(auth)
      .send({
        name: `Lifecycle Campaign ${Date.now()}`,
        subject: "Lifecycle Subject",
        fromName: "Hope Foundation",
        fromEmail: "admin@hopefoundation.org",
        replyToEmail: "admin@hopefoundation.org",
        bodyHtml: "<p>Lifecycle body</p>",
        bodyText: "Lifecycle body",
        templateSnapshot: {
          templateId: "template-lifecycle",
          templateName: "Lifecycle Template",
          templateVersion: "v1",
        },
      });

    expect(created.status).toBe(201);

    const ready = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/ready`)
      .set(auth)
      .send({});

    expect(ready.status).toBe(200);
    expect(ready.body?.workflow?.preparationStatus).toBe("READY");

    const queued = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/queue`)
      .set(auth)
      .send({});

    expect(queued.status).toBe(200);
    expect(queued.body?.workflow?.needsReview).toBe(true);

    const paused = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/queue-control`)
      .set(auth)
      .send({ action: "PAUSE" });

    expect(paused.status).toBe(200);
    expect(paused.body?.workflow?.queueState).toBe("PAUSED");

    const resumed = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/queue-control`)
      .set(auth)
      .send({ action: "RESUME" });

    expect(resumed.status).toBe(200);
    expect(resumed.body?.workflow?.queueState).toBe("ACTIVE");

    const archived = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/archive`)
      .set(auth)
      .send({});

    expect(archived.status).toBe(200);
    expect(archived.body?.workflow?.archivedAt).toBeTruthy();
    expect(archived.body?.workspaceStatus).toBe("ARCHIVED");

    const duplicate = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/duplicate`)
      .set(auth)
      .send({});

    expect(duplicate.status).toBe(201);
    expect(duplicate.body?.id).toBeTruthy();
    expect(duplicate.body?.id).not.toBe(created.body.id);
    expect(String(duplicate.body?.name ?? "")).toContain("(Copy)");
    expect(duplicate.body?.status).toBe("DRAFT");
  });

  it("returns unscheduled draft campaigns in calendar workspace payload", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app)
      .post("/api/email-campaigns")
      .set(auth)
      .send({
        name: `Calendar Draft Campaign ${Date.now()}`,
        subject: "Calendar coverage",
      });

    expect(created.status).toBe(201);

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString();
    const calendar = await request(app)
      .get(`/api/email-campaigns/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .set(auth);

    expect(calendar.status).toBe(200);
    expect(Array.isArray(calendar.body?.events)).toBe(true);
    expect(Array.isArray(calendar.body?.unscheduledDrafts)).toBe(true);

    const matchingDraft = (calendar.body?.unscheduledDrafts ?? []).find((row: { campaignId?: string }) => row.campaignId === created.body.id);
    expect(matchingDraft).toBeTruthy();
  });
});

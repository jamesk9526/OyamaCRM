import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { loginAsAdmin } from "@/tests/helpers/auth";

process.env.EMAIL_CAMPAIGN_WEBHOOK_SECRET ??= "test-webhook-secret";

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

  it("renders branding-backed organization merge fields in preview and blocks unsupported merge tokens", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const branding = await request(app)
      .put("/api/settings/branding")
      .set(auth)
      .send({
        organizationDisplayName: "Hope Foundation",
        contactPhone: "312-555-0100",
        websiteUrl: "https://hope.example.org/give",
        streetAddress1: "123 Main St",
        city: "Chicago",
        stateProvince: "IL",
        postalCode: "60601",
        taxId: "12-3456789",
        defaultLetterSignerTitle: "Development Director",
      });

    expect(branding.status).toBe(200);

    const created = await request(app)
      .post("/api/email-campaigns")
      .set(auth)
      .send({
        name: `Merge Coverage Campaign ${Date.now()}`,
        subject: "Hello {{firstName}}",
        fromName: "Jamie Sender",
        fromEmail: "admin@hopefoundation.org",
        replyToEmail: "reply@hopefoundation.org",
        bodyHtml: "<p>{{organization.address}}</p><p>{{organizationWebsite}}</p><p>{{organizationPhone}}</p><p>{{organizationTaxId}}</p><p>{{staffTitle}}</p>",
        bodyText: "{{organization.address}} | {{organizationWebsite}} | {{organizationPhone}} | {{organizationTaxId}} | {{staffTitle}}",
      });

    expect(created.status).toBe(201);

    const preview = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/preview`)
      .set(auth)
      .send({ recipientEmail: "preview@example.org" });

    expect(preview.status).toBe(200);
    expect(preview.body?.bodyHtml).toContain("123 Main St, Chicago, IL, 60601");
    expect(preview.body?.bodyHtml).toContain("https://hope.example.org/give");
    expect(preview.body?.bodyHtml).toContain("312-555-0100");
    expect(preview.body?.bodyHtml).toContain("12-3456789");
    expect(preview.body?.bodyHtml).toContain("Development Director");

    const invalid = await request(app)
      .post("/api/email-campaigns")
      .set(auth)
      .send({
        name: `Unsupported Merge Campaign ${Date.now()}`,
        subject: "Unsupported {{organization.foobar}}",
        fromName: "Jamie Sender",
        fromEmail: "admin@hopefoundation.org",
        replyToEmail: "reply@hopefoundation.org",
        bodyHtml: "<p>Hello {{organization.foobar}}</p>",
        bodyText: "Hello {{organization.foobar}}",
      });

    expect(invalid.status).toBe(201);

    const validation = await request(app)
      .post(`/api/email-campaigns/${invalid.body.id}/validate`)
      .set(auth)
      .send({});

    expect(validation.status).toBe(200);
    expect(validation.body?.valid).toBe(false);
    expect(validation.body?.blockers).toContain("Unsupported merge fields: {{organization.foobar}}.");
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

  it("ingests delivery webhooks idempotently and updates campaign delivery stats", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app)
      .post("/api/email-campaigns")
      .set(auth)
      .send({
        name: `Webhook Campaign ${Date.now()}`,
        subject: "Webhook coverage",
      });

    expect(created.status).toBe(201);

    const payload = {
      campaignId: created.body.id,
      recipientEmail: "recipient+webhook@example.org",
      eventType: "delivered",
      eventAt: new Date().toISOString(),
    };

    const first = await request(app)
      .post("/api/email-campaigns/webhooks/delivery")
      .set({ "x-oyama-webhook-secret": "test-webhook-secret" })
      .send(payload);

    expect(first.status).toBe(202);
    expect(first.body?.processed).toBe(1);
    expect(first.body?.rejected).toBe(0);

    const second = await request(app)
      .post("/api/email-campaigns/webhooks/delivery")
      .set({ "x-oyama-webhook-secret": "test-webhook-secret" })
      .send(payload);

    expect(second.status).toBe(202);
    expect(second.body?.processed).toBe(1);
    expect(second.body?.rejected).toBe(0);

    const campaign = await request(app)
      .get(`/api/email-campaigns/${created.body.id}`)
      .set(auth);

    expect(campaign.status).toBe(200);
    expect(campaign.body?.delivered).toBe(1);
  });
});

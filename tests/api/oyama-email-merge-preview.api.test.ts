import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/src/lib/prisma";
import { loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
let organizationId = "";
let adminUserId = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const admin = await loginAsAdmin(app);
  adminToken = admin.token;

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@hopefoundation.org" },
    select: { id: true, organizationId: true },
  });
  if (!adminUser) {
    throw new Error("Seed admin user not found for merge preview tests.");
  }
  adminUserId = adminUser.id;
  organizationId = adminUser.organizationId;
});

describe("oyama email merge field audit", () => {
  it("returns the complete merge field catalog used by builder and preview tooling", async () => {
    const res = await request(app)
      .get("/api/oyama-email/merge-fields")
      .set({ Authorization: `Bearer ${adminToken}` });

    expect(res.status).toBe(200);
    const tokens = new Set(
      (res.body?.groups ?? []).flatMap((group: { fields?: Array<{ token?: string }> }) => group.fields ?? []).map((field: { token?: string }) => field.token),
    );

    expect(tokens.has("{{preferredName}}")).toBe(true);
    expect(tokens.has("{{organizationWebsite}}")).toBe(true);
    expect(tokens.has("{{managePreferencesUrl}}")).toBe(true);
    expect(tokens.has("{{preferencesUrl}}")).toBe(true);
    expect(tokens.has("{{stewardPath.status}}")).toBe(true);
    expect(tokens.has("{{gift.taxDeductibleAmount}}")).toBe(true);
  });

  it("shows template preview warnings for unsupported or empty merge data and blocks unsupported test sends", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const unique = Date.now();
    const recipientEmail = `merge-preview-template-${unique}@example.org`;

    await request(app)
      .put("/api/settings/branding")
      .set(auth)
      .send({
        organizationDisplayName: "Hope Foundation",
        websiteUrl: "https://hope.example.org",
        streetAddress1: "123 Main St",
        city: "Chicago",
        stateProvince: "IL",
        postalCode: "60601",
      });

    await prisma.constituent.create({
      data: {
        organizationId,
        firstName: "Ava",
        lastName: "Donor",
        email: recipientEmail,
      },
    });

    const created = await request(app)
      .post("/api/oyama-email/templates")
      .set(auth)
      .send({
        name: `Merge Preview Template ${unique}`,
        subject: "Hello {{preferredName}} {{unsupported.foo}}",
        previewText: "{{preferencesUrl}}",
        template: {
          version: 1,
          contentWidth: 600,
          backgroundColor: "#f3f7f5",
          fontFamily: "Arial, Helvetica, sans-serif",
          baseFontSize: 16,
          lineHeight: 1.6,
          textColor: "#1f2937",
          linkColor: "#0f5c3c",
          blocks: [
            {
              id: "block_1",
              type: "text",
              content: "<p>{{organizationWebsite}}</p><p>{{event.name}}</p><p>{{unsupported.foo}}</p><p>{{preferencesUrl}}</p>",
            },
          ],
        },
        settings: {
          includeUnsubscribeLink: true,
          includePhysicalAddress: true,
          enablePlainTextVersion: true,
          physicalAddress: "",
          footerBrandingText: "",
        },
      });

    expect(created.status).toBe(201);

    const preview = await request(app)
      .post(`/api/oyama-email/templates/${created.body.id}/preview`)
      .set(auth)
      .send({ recipientEmail });

    expect(preview.status).toBe(200);
    expect(preview.body?.html).toContain("https://hope.example.org");
    expect(preview.body?.html).toContain("/preferences/");
    expect(preview.body?.warnings).toContain("Unsupported merge fields: {{unsupported.foo}}.");
    expect(Array.isArray(preview.body?.warnings)).toBe(true);
    expect((preview.body?.warnings ?? []).some((warning: string) => warning.includes("{{event.name}}"))).toBe(true);

    const sendTest = await request(app)
      .post(`/api/oyama-email/templates/${created.body.id}/send-test`)
      .set(auth)
      .send({ toEmail: recipientEmail, recipientEmail });

    expect(sendTest.status).toBe(400);
    expect(sendTest.body?.error?.code).toBe("UNSUPPORTED_MERGE_FIELDS");
  });

  it("keeps live campaign preview aligned with donor, gift, event, organization, compliance, and steward merge fields", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const unique = Date.now();
    const recipientEmail = `merge-preview-campaign-${unique}@example.org`;

    await request(app)
      .put("/api/settings/branding")
      .set(auth)
      .send({
        organizationDisplayName: "Hope Foundation",
        contactPhone: "312-555-0199",
        websiteUrl: "https://hope.example.org/give",
        streetAddress1: "456 River Rd",
        city: "Chicago",
        stateProvince: "IL",
        postalCode: "60602",
        taxId: "98-7654321",
        defaultLetterSignerTitle: "Director of Development",
      });

    const constituent = await prisma.constituent.create({
      data: {
        organizationId,
        firstName: "Jordan",
        lastName: "Lee",
        email: recipientEmail,
        totalLifetimeGiving: 250,
        totalYtdGiving: 125,
        giftCount: 3,
        firstGiftDate: new Date("2025-01-15T00:00:00.000Z"),
        lastGiftDate: new Date("2025-05-01T00:00:00.000Z"),
        lastGiftAmount: 125,
      },
    });

    const donorCampaign = await prisma.campaign.create({
      data: {
        organizationId,
        name: `Spring Appeal ${unique}`,
        startDate: new Date("2025-03-01T00:00:00.000Z"),
        goal: 5000,
      },
    });

    const event = await prisma.event.create({
      data: {
        organizationId,
        name: `Spring Gala ${unique}`,
        startDate: new Date("2025-04-20T18:00:00.000Z"),
        location: "Main Hall",
        city: "Chicago",
        state: "IL",
      },
    });

    await prisma.donation.create({
      data: {
        constituentId: constituent.id,
        campaignId: donorCampaign.id,
        eventId: event.id,
        amount: 125,
        receiptNumber: `RCPT-${unique}`,
        taxDeductible: true,
      },
    });

    const path = await prisma.stewardPath.create({
      data: {
        organizationId,
        name: `Welcome Path ${unique}`,
        crmScope: "DONOR",
        targetType: "DONOR",
        triggerType: "MANUAL",
        status: "ACTIVE",
        createdByUserId: adminUserId,
      },
    });

    const step = await prisma.stewardPathStep.create({
      data: {
        pathId: path.id,
        orderIndex: 1,
        name: "Thank-You Email",
        stepType: "DRAFT_EMAIL",
      },
    });

    await prisma.stewardPathEnrollment.create({
      data: {
        organizationId,
        pathId: path.id,
        targetType: "DONOR",
        targetId: constituent.id,
        constituentId: constituent.id,
        status: "ACTIVE",
        currentStepId: step.id,
        nextStepDueAt: new Date("2025-06-15T00:00:00.000Z"),
      },
    });

    const created = await request(app)
      .post("/api/email-campaigns")
      .set(auth)
      .send({
        name: `Campaign Merge Preview ${unique}`,
        subject: "Hello {{ donor.firstName }}",
        fromName: "Jamie Sender",
        fromEmail: "admin@hopefoundation.org",
        replyToEmail: "reply@hopefoundation.org",
        bodyHtml: [
          "<p>{{ donor.firstName }} {{ donor.lastName }}</p>",
          "<p>{{ gift.amount }} {{ gift.receiptNumber }}</p>",
          "<p>{{ event.name }} {{ event.location }}</p>",
          "<p>{{ campaign.name }} {{ campaign.goal }} {{ campaign.raised }}</p>",
          "<p>{{ staff.name }} {{ staff.email }}</p>",
          "<p>{{ organization.address }} {{ organization.taxId }}</p>",
          "<p>{{ stewardPath.name }} {{ stewardPath.currentStep }} {{ stewardPath.status }}</p>",
          "<p>{{ preferencesUrl }}</p>",
        ].join(""),
        bodyText: [
          "{{ donor.firstName }} {{ donor.lastName }}",
          "{{ gift.amount }} {{ gift.receiptNumber }}",
          "{{ event.name }} {{ event.location }}",
          "{{ campaign.name }} {{ campaign.goal }} {{ campaign.raised }}",
          "{{ staff.name }} {{ staff.email }}",
          "{{ organization.address }} {{ organization.taxId }}",
          "{{ stewardPath.name }} {{ stewardPath.currentStep }} {{ stewardPath.status }}",
          "{{ preferencesUrl }}",
        ].join(" | "),
      });

    expect(created.status).toBe(201);

    const preview = await request(app)
      .post(`/api/email-campaigns/${created.body.id}/preview`)
      .set(auth)
      .send({ recipientEmail });

    expect(preview.status).toBe(200);
    expect(preview.body?.bodyHtml).toContain("Jordan Lee");
    expect(preview.body?.bodyHtml).toContain("$125.00");
    expect(preview.body?.bodyHtml).toContain(`RCPT-${unique}`);
    expect(preview.body?.bodyHtml).toContain(`Spring Gala ${unique}`);
    expect(preview.body?.bodyHtml).toContain("Main Hall, Chicago, IL");
    expect(preview.body?.bodyHtml).toContain(`Spring Appeal ${unique}`);
    expect(preview.body?.bodyHtml).toContain("$5,000.00");
    expect(preview.body?.bodyHtml).toContain("Jamie Sender");
    expect(preview.body?.bodyHtml).toContain("456 River Rd, Chicago, IL, 60602");
    expect(preview.body?.bodyHtml).toContain("98-7654321");
    expect(preview.body?.bodyHtml).toContain(`Welcome Path ${unique}`);
    expect(preview.body?.bodyHtml).toContain("Thank-You Email");
    expect(preview.body?.bodyHtml).toContain("ACTIVE");
    expect(preview.body?.bodyHtml).toContain("/preferences/");
    expect(preview.body?.warnings ?? []).toHaveLength(0);

    const templatePreviewByConstituent = await request(app)
      .post(`/api/oyama-email/templates/${created.body.id}/preview`)
      .set(auth)
      .send({ previewMode: "selected", recipientConstituentId: constituent.id });

    expect(templatePreviewByConstituent.status).toBe(200);
    expect(templatePreviewByConstituent.body?.recipient?.id).toBe(constituent.id);
    expect(templatePreviewByConstituent.body?.recipient?.fullName).toContain("Jordan Lee");
  });
});

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
}, 30000);

describe("letters merge aliases API", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("renders simple donor and donation aliases from database-backed preview context", { timeout: 20000 }, async () => {
    const suffix = Date.now();
    const constituent = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "AliasFirst",
        lastName: `AliasLast${suffix}`,
        email: `alias-${suffix}@example.org`,
        addressLine1: "123 Alias Ave",
        city: "Chicago",
        state: "IL",
        zip: "60601",
        type: "DONOR",
      });
    expect(constituent.status).toBe(201);

    const donation = await request(app)
      .post("/api/donations")
      .set(auth())
      .send({
        constituentId: constituent.body.id,
        amount: 321.45,
        date: "2026-06-29T00:00:00.000Z",
        paymentMethod: "CHECK",
        status: "COMPLETED",
        taxDeductible: true,
        notes: "Alias merge test donation",
      });
    expect(donation.status).toBe(201);

    const template = await request(app)
      .post("/api/letters/templates")
      .set(auth())
      .send({
        name: `Alias Merge ${suffix}`,
        category: "THANK_YOU",
        status: "ACTIVE",
        printBody: "Dear {first} {last}, thank you for //amount on {giftDate}. {name} / {email}",
        emailBody: "Receipt {receipt} for {amount}.",
      });
    expect(template.status).toBe(201);

    const preview = await request(app)
      .post("/api/letters/generated/preview")
      .set(auth())
      .send({
        templateId: template.body.id,
        constituentId: constituent.body.id,
        donationMode: "specific",
        donationId: donation.body.id,
      });

    expect(preview.status).toBe(200);
    expect(preview.body.mergedPrintBody).toContain(`Dear AliasFirst AliasLast${suffix}`);
    expect(preview.body.mergedPrintBody).toContain("$321.45");
    expect(preview.body.mergedPrintBody).toContain("June 29, 2026");
    expect(preview.body.mergedPrintBody).not.toContain("June 28, 2026");
    expect(preview.body.mergedPrintBody).toContain(`AliasFirst AliasLast${suffix}`);
    expect(preview.body.mergedPrintBody).toContain(`alias-${suffix}@example.org`);
    expect(preview.body.unsupportedFields).toEqual([]);

    const previewPdf = await request(app)
      .post("/api/letters/generated/preview-pdf?preview=1&inline=1")
      .set(auth())
      .send({
        templateId: template.body.id,
        constituentId: constituent.body.id,
        donationMode: "specific",
        donationId: donation.body.id,
      });

    expect(previewPdf.status).toBe(200);
    expect(previewPdf.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.isBuffer(previewPdf.body)).toBe(true);
    expect(previewPdf.body.byteLength).toBeGreaterThan(1000);
  });

  it("uses selected donation IDs as per-recipient merge context instead of falling back to recent gifts", async () => {
    const suffix = Date.now();
    const constituent = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "SelectedGift",
        lastName: `Donor${suffix}`,
        email: `selected-gift-${suffix}@example.org`,
        addressLine1: "456 Selected Way",
        city: "Aurora",
        state: "MO",
        zip: "65605",
        type: "DONOR",
      });
    expect(constituent.status).toBe(201);

    const selectedDonation = await request(app)
      .post("/api/donations")
      .set(auth())
      .send({
        constituentId: constituent.body.id,
        amount: 42.5,
        date: "2026-01-10T12:00:00.000Z",
        paymentMethod: "CHECK",
        status: "COMPLETED",
        taxDeductible: true,
        notes: "Selected donation merge context test",
      });
    expect(selectedDonation.status).toBe(201);

    const newerDonation = await request(app)
      .post("/api/donations")
      .set(auth())
      .send({
        constituentId: constituent.body.id,
        amount: 999,
        date: "2026-06-15T12:00:00.000Z",
        paymentMethod: "CHECK",
        status: "COMPLETED",
        taxDeductible: true,
        notes: "More recent gift that must not override selected context",
      });
    expect(newerDonation.status).toBe(201);

    const template = await request(app)
      .post("/api/letters/templates")
      .set(auth())
      .send({
        name: `Selected Donation Merge ${suffix}`,
        category: "THANK_YOU",
        status: "ACTIVE",
        printBody: "Dear {{donor.firstName}}, selected gift {{gift.amount}} on {{gift.date}}.",
        emailBody: "Selected gift {{gift.amount}}.",
      });
    expect(template.status).toBe(201);

    const preview = await request(app)
      .post("/api/letters/generated/preview")
      .set(auth())
      .send({
        templateId: template.body.id,
        constituentId: constituent.body.id,
        donationMode: "selected",
        donationIds: [selectedDonation.body.id],
      });

    expect(preview.status).toBe(200);
    expect(preview.body.mergedPrintBody).toContain("$42.50");
    expect(preview.body.mergedPrintBody).toContain("January 10, 2026");
    expect(preview.body.mergedPrintBody).not.toContain("$999.00");
    expect(preview.body.missingFields).toEqual([]);
  });

  it("renders gift date and amount on the same line for browser print PDF preview", async () => {
    const suffix = Date.now();
    const constituent = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "PrintPdf",
        lastName: `GiftLine${suffix}`,
        email: `print-pdf-gift-line-${suffix}@example.org`,
        addressLine1: "789 Print Preview Rd",
        city: "Monett",
        state: "MO",
        zip: "65708",
        type: "DONOR",
      });
    expect(constituent.status).toBe(201);

    const donation = await request(app)
      .post("/api/donations")
      .set(auth())
      .send({
        constituentId: constituent.body.id,
        amount: 77.77,
        date: "2026-07-07T00:00:00.000Z",
        paymentMethod: "CHECK",
        status: "COMPLETED",
        taxDeductible: true,
        notes: "Browser print PDF merge preview test",
      });
    expect(donation.status).toBe(201);

    const template = await request(app)
      .post("/api/letters/templates")
      .set(auth())
      .send({
        name: `Browser Print PDF Merge ${suffix}`,
        category: "THANK_YOU",
        status: "DRAFT",
        printSubject: "Printable Letter",
        printBody: [
          "<p>Dear {{donor.fullName}},</p>",
          "<p>{{gift.date}} {{gift.amount}}</p>",
          "<p>Alias: {giftDate} {giftAmount}</p>",
        ].join(""),
        emailBody: "Thanks {{donor.fullName}}.",
      });
    expect(template.status).toBe(201);

    const preview = await request(app)
      .get(`/api/letters/templates/${template.body.id}/print-preview`)
      .set(auth());

    expect(preview.status).toBe(200);
    expect(preview.body.mergedPrintBody).toContain("July 7, 2026 $77.77");
    expect(preview.body.mergedPrintBody).toContain("Alias: July 7, 2026 $77.77");
    expect(preview.body.mergedPrintBody).not.toContain("{{gift.date}}");
    expect(preview.body.mergedPrintBody).not.toContain("{{gift.amount}}");
    expect(preview.body.mergedPrintBody).not.toContain("{giftDate}");
    expect(preview.body.mergedPrintBody).not.toContain("{giftAmount}");
    expect(preview.body.resolvedDonationId).toBe(donation.body.id);
  });

  it("uses each batch recipient's most recent donation across all time by default", async () => {
    const suffix = Date.now();
    const template = await request(app)
      .post("/api/letters/templates")
      .set(auth())
      .send({
        name: `Batch Recent Gift Merge ${suffix}`,
        category: "THANK_YOU",
        status: "ACTIVE",
        printBody: "Dear {{donor.firstName}}, batch gift {{gift.amount}} on {{gift.date}}.",
        emailBody: "Batch gift {{gift.amount}}.",
      });
    expect(template.status).toBe(201);

    const first = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "BatchRecentOne",
        lastName: `Donor${suffix}`,
        email: `batch-recent-one-${suffix}@example.org`,
        addressLine1: "100 Batch Ave",
        city: "Monett",
        state: "MO",
        zip: "65708",
        type: "DONOR",
      });
    const second = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "BatchRecentTwo",
        lastName: `Donor${suffix}`,
        email: `batch-recent-two-${suffix}@example.org`,
        addressLine1: "200 Batch Ave",
        city: "Aurora",
        state: "MO",
        zip: "65605",
        type: "DONOR",
      });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const oldFirstGift = await request(app)
      .post("/api/donations")
      .set(auth())
      .send({
        constituentId: first.body.id,
        amount: 10,
        date: "2025-01-05T12:00:00.000Z",
        paymentMethod: "CHECK",
        status: "COMPLETED",
        taxDeductible: true,
      });
    const recentFirstGift = await request(app)
      .post("/api/donations")
      .set(auth())
      .send({
        constituentId: first.body.id,
        amount: 88.88,
        date: "2025-02-14T12:00:00.000Z",
        paymentMethod: "CHECK",
        status: "COMPLETED",
        taxDeductible: true,
      });
    const secondGift = await request(app)
      .post("/api/donations")
      .set(auth())
      .send({
        constituentId: second.body.id,
        amount: 55.55,
        date: "2024-11-20T12:00:00.000Z",
        paymentMethod: "CHECK",
        status: "COMPLETED",
        taxDeductible: true,
      });
    expect(oldFirstGift.status).toBe(201);
    expect(recentFirstGift.status).toBe(201);
    expect(secondGift.status).toBe(201);

    const batch = await request(app)
      .post("/api/letters/generated/batch")
      .set(auth())
      .send({
        templateId: template.body.id,
        constituentIds: [first.body.id, second.body.id],
        donationMode: "recent",
        dryRun: false,
        deliveryTarget: "PDF_ONLY",
      });

    expect(batch.status).toBe(200);
    expect(batch.body.generatedCount).toBe(2);
    expect(batch.body.skippedCount).toBe(0);

    const generatedIds = batch.body.generatedIds as string[];
    const generated = await prisma.generatedLetter.findMany({
      where: { id: { in: generatedIds } },
      select: {
        constituentId: true,
        donationId: true,
        mergedPrintBody: true,
      },
    });
    expect(generated).toHaveLength(2);

    const firstLetter = generated.find((row) => row.constituentId === first.body.id);
    const secondLetter = generated.find((row) => row.constituentId === second.body.id);
    expect(firstLetter?.donationId).toBe(recentFirstGift.body.id);
    expect(firstLetter?.mergedPrintBody).toContain("$88.88");
    expect(firstLetter?.mergedPrintBody).toContain("February 14, 2025");
    expect(firstLetter?.mergedPrintBody).not.toContain("$0.00");
    expect(firstLetter?.mergedPrintBody).not.toContain("$10.00");
    expect(secondLetter?.donationId).toBe(secondGift.body.id);
    expect(secondLetter?.mergedPrintBody).toContain("$55.55");
    expect(secondLetter?.mergedPrintBody).toContain("November 20, 2024");
    expect(secondLetter?.mergedPrintBody).not.toContain("$0.00");
  });

  it("keeps recipient, campaign, event, organization, and year merge context when batch-generating", async () => {
    const suffix = Date.now();
    const admin = await prisma.user.findUnique({
      where: { email: "admin@hopefoundation.org" },
      select: { organizationId: true },
    });
    if (!admin) throw new Error("Seed admin user not found for batch merge test.");

    const template = await request(app)
      .post("/api/letters/templates")
      .set(auth())
      .send({
        name: `Batch Merge Context ${suffix}`,
        category: "THANK_YOU",
        status: "ACTIVE",
        printBody: "Dear {{donor.firstName}} — {{campaign.name}} — {{event.name}} — {{organization.name}} — {{year}}.",
        emailBody: "{{donor.firstName}} {{campaign.name}} {{event.name}} {{year}}",
      });
    expect(template.status).toBe(201);

    const recipient = await request(app)
      .post("/api/constituents")
      .set(auth())
      .send({
        firstName: "BatchContext",
        lastName: `Recipient${suffix}`,
        email: `batch-context-${suffix}@example.org`,
        addressLine1: "300 Context Ave",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        type: "DONOR",
      });
    expect(recipient.status).toBe(201);

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: admin.organizationId,
        name: `Batch Context Campaign ${suffix}`,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const event = await prisma.event.create({
      data: {
        organizationId: admin.organizationId,
        name: `Batch Context Event ${suffix}`,
        startDate: new Date("2026-08-15T17:00:00.000Z"),
      },
    });

    const batch = await request(app)
      .post("/api/letters/generated/batch")
      .set(auth())
      .send({
        templateId: template.body.id,
        constituentIds: [recipient.body.id],
        campaignId: campaign.id,
        eventId: event.id,
        year: 2024,
        donationMode: "none",
        deliveryTarget: "PDF_ONLY",
      });

    expect(batch.status).toBe(200);
    expect(batch.body.generatedCount).toBe(1);
    expect(batch.body.skippedCount).toBe(0);

    const generated = await prisma.generatedLetter.findUnique({
      where: { id: batch.body.generatedIds[0] },
      select: {
        constituentId: true,
        campaignId: true,
        eventId: true,
        mergedPrintBody: true,
        mergedEmailBody: true,
      },
    });
    expect(generated?.constituentId).toBe(recipient.body.id);
    expect(generated?.campaignId).toBe(campaign.id);
    expect(generated?.eventId).toBe(event.id);
    expect(generated?.mergedPrintBody).toContain("BatchContext");
    expect(generated?.mergedPrintBody).toContain(campaign.name);
    expect(generated?.mergedPrintBody).toContain(event.name);
    expect(generated?.mergedPrintBody).toContain("Hope Foundation");
    expect(generated?.mergedPrintBody).toContain("2024");
    expect(generated?.mergedEmailBody).toContain("BatchContext");
    expect(generated?.mergedEmailBody).toContain(campaign.name);
    expect(generated?.mergedEmailBody).toContain(event.name);
    expect(generated?.mergedEmailBody).toContain("2024");
  });
});

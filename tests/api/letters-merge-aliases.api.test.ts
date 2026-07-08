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
}, 30000);

describe("letters merge aliases API", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("renders simple donor and donation aliases from database-backed preview context", async () => {
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
});

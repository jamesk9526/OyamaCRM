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
        date: "2026-06-13T12:00:00.000Z",
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
    expect(preview.body.mergedPrintBody).toContain("June 13, 2026");
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
});

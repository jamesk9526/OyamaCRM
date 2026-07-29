import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getStripeObjectMetadata,
  hashStripePayload,
  parseStripeSignatureHeader,
  verifyStripeWebhookSignature,
} from "../../server/src/services/stripe-webhooks";

describe("Stripe webhook safety", () => {
  it("accepts a current valid v1 signature and rejects altered payloads", () => {
    const rawBody = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    const timestamp = 1_700_000_000;
    const secret = "whsec_test";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    const header = `t=${timestamp},v1=bad,v1=${signature}`;

    expect(verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: header,
      webhookSecret: secret,
      nowSeconds: timestamp + 30,
    })).toBe(true);
    expect(verifyStripeWebhookSignature({
      rawBody: `${rawBody} `,
      signatureHeader: header,
      webhookSecret: secret,
      nowSeconds: timestamp + 30,
    })).toBe(false);
  });

  it("rejects stale deliveries and malformed headers", () => {
    expect(parseStripeSignatureHeader("v1=nope")).toBeNull();
    expect(verifyStripeWebhookSignature({
      rawBody: "{}",
      signatureHeader: `t=1,v1=${"a".repeat(64)}`,
      webhookSecret: "whsec_test",
      nowSeconds: 1_000,
      toleranceSeconds: 10,
    })).toBe(false);
  });

  it("reads metadata from recurring invoice subscription details", () => {
    expect(getStripeObjectMetadata({
      parent: { subscription_details: { metadata: { siteToken: "site_123", giftType: "monthly" } } },
    })).toMatchObject({ siteToken: "site_123", giftType: "monthly" });
  });

  it("creates stable payload fingerprints", () => {
    expect(hashStripePayload("{}")).toHaveLength(64);
    expect(hashStripePayload("{}")).toBe(hashStripePayload("{}"));
  });
});

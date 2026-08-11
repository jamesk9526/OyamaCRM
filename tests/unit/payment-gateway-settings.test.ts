import { describe, expect, it } from "vitest";
import { normalizeStoredPaymentGatewayConfig } from "../../server/src/services/payment-gateway-settings";

describe("payment gateway Stripe environment storage", () => {
  it("migrates legacy test credentials into the sandbox slot", () => {
    const config = normalizeStoredPaymentGatewayConfig({
      version: 1,
      currency: "USD",
      stripe: {
        enabled: true,
        mode: "sandbox",
        publishableKey: "pk_test_legacy",
        secretKeyEncrypted: "encrypted-test-secret",
        webhookSecretEncrypted: "encrypted-test-webhook",
      },
    });

    expect(config.version).toBe(2);
    expect(config.stripe.environments.sandbox).toMatchObject({
      publishableKey: "pk_test_legacy",
      secretKeyEncrypted: "encrypted-test-secret",
      webhookSecretEncrypted: "encrypted-test-webhook",
    });
    expect(config.stripe.environments.production.publishableKey).toBe("");
  });

  it("keeps independent test and live credential sets", () => {
    const config = normalizeStoredPaymentGatewayConfig({
      version: 2,
      stripe: {
        enabled: true,
        mode: "production",
        environments: {
          sandbox: { publishableKey: "pk_test_saved", secretKeyEncrypted: "test-secret", webhookSecretEncrypted: "test-webhook" },
          production: { publishableKey: "pk_live_saved", secretKeyEncrypted: "live-secret", webhookSecretEncrypted: "live-webhook" },
        },
      },
    });

    expect(config.stripe.environments.sandbox.publishableKey).toBe("pk_test_saved");
    expect(config.stripe.environments.production.publishableKey).toBe("pk_live_saved");
    expect(config.stripe.mode).toBe("production");
  });
});

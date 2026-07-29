import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "../../server/src/services/oyama-email/email-render-service.js";

describe("email to letter text conversion", () => {
  it("removes scoped email CSS rather than placing it in the printable letter", () => {
    const result = htmlToPlainText('<style>.oyama-email-root { color: #ff69fe; }</style><p>Thank you for your faithful support.</p>');
    expect(result).toBe("Thank you for your faithful support.");
    expect(result).not.toContain("oyama-email-root");
  });
});

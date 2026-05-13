import { describe, expect, it } from "vitest";
import {
  categoryForPurpose,
  getCampaignComplianceIssues,
  hashPublicEmailToken,
  parseEmailPurpose,
  requiresPreferenceCompliance,
} from "@/server/src/services/email-compliance";

describe("email compliance helpers", () => {
  it("parses known purposes and falls back safely", () => {
    expect(parseEmailPurpose("fundraising")).toBe("FUNDRAISING");
    expect(parseEmailPurpose("transactional")).toBe("TRANSACTIONAL");
    expect(parseEmailPurpose("unknown-value")).toBe("MARKETING");
  });

  it("maps purpose to preference category", () => {
    expect(categoryForPurpose("FUNDRAISING")).toBe("FUNDRAISING_APPEAL");
    expect(categoryForPurpose("NEWSLETTER")).toBe("NEWSLETTER");
    expect(categoryForPurpose("RECEIPT")).toBe("RECEIPTS");
  });

  it("requires unsubscribe controls for marketing-like purposes only", () => {
    expect(requiresPreferenceCompliance("MARKETING")).toBe(true);
    expect(requiresPreferenceCompliance("EVENT_PROMOTION")).toBe(true);
    expect(requiresPreferenceCompliance("TRANSACTIONAL")).toBe(false);
    expect(requiresPreferenceCompliance("THANK_YOU")).toBe(false);
  });

  it("flags missing unsubscribe and preferences controls for gated purposes", () => {
    const issues = getCampaignComplianceIssues({
      purpose: "MARKETING",
      subject: "Impact update",
      bodyHtml: "<p>Hello donor</p>",
      bodyText: "Hello donor",
      fromEmail: "noreply@example.org",
      replyToEmail: null,
    });

    expect(issues.some((issue) => issue.includes("unsubscribe"))).toBe(true);
    expect(issues.some((issue) => issue.includes("preferences"))).toBe(true);
  });

  it("accepts transactional sends without unsubscribe controls", () => {
    const issues = getCampaignComplianceIssues({
      purpose: "TRANSACTIONAL",
      subject: "Receipt",
      bodyHtml: "<p>Thanks for your gift</p>",
      bodyText: "Thanks for your gift",
      fromEmail: "noreply@example.org",
      replyToEmail: null,
    });

    expect(issues).toHaveLength(0);
  });

  it("hashes public token values deterministically", () => {
    const a = hashPublicEmailToken("token-abc");
    const b = hashPublicEmailToken("token-abc");
    const c = hashPublicEmailToken("token-def");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

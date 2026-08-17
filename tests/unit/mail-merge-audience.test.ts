import { describe, expect, it } from "vitest";
import { resolveAudienceListConstituents } from "../../app/components/letters/mail-merge-audience";

const constituents = [
  { id: "crm-1", email: "one@example.org" },
  { id: "crm-2", email: null },
  { id: "crm-3", email: "shared@example.org" },
  { id: "crm-4", email: "shared@example.org" },
];

describe("mail merge audience resolution", () => {
  it("loads CRM-backed list members even when their stored email is null", () => {
    expect(resolveAudienceListConstituents(constituents, [
      { constituentId: "crm-1", email: null },
      { constituentId: "crm-2", email: null },
    ])).toEqual({ constituentIds: ["crm-1", "crm-2"], unmatchedMemberCount: 0 });
  });

  it("loads legacy and external members by normalized email", () => {
    expect(resolveAudienceListConstituents(constituents, [
      { email: " ONE@EXAMPLE.ORG " },
      { email: "shared@example.org" },
    ])).toEqual({ constituentIds: ["crm-1", "crm-3", "crm-4"], unmatchedMemberCount: 0 });
  });

  it("supports mixed lists, deduplicates matches, and reports unmatched members", () => {
    expect(resolveAudienceListConstituents(constituents, [
      { constituentId: "crm-1" },
      { email: "one@example.org" },
      { constituentId: "missing", email: "shared@example.org" },
      { constituentId: null, email: null },
      { email: "missing@example.org" },
    ])).toEqual({ constituentIds: ["crm-1", "crm-3", "crm-4"], unmatchedMemberCount: 2 });
  });
});

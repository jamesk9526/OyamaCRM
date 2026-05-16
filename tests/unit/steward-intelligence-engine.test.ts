import { describe, expect, it } from "vitest";
import {
  buildDailyStewardThoughtFallback,
  buildDeterministicEmailDraft,
  buildGrowthIdeas,
  calculateLapseRisk,
  calculatePropensityWindow,
  calculateRfmScore,
  normalizeDailyThoughtAiResponse,
  type StewardIntelligenceDonorInput,
} from "@/server/src/services/steward-intelligence-engine";

function donor(overrides: Partial<StewardIntelligenceDonorInput> = {}): StewardIntelligenceDonorInput {
  return {
    id: "donor-1",
    firstName: "Jane",
    lastName: "Smith",
    donorStatus: "ACTIVE",
    giftCount: 3,
    totalLifetimeGiving: 900,
    lastGiftAmount: 250,
    firstGiftDate: new Date("2024-01-10T00:00:00.000Z"),
    lastGiftDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    engagementScore: 62,
    doNotEmail: false,
    doNotCall: false,
    ...overrides,
  };
}

describe("steward-intelligence-engine", () => {
  it("computes bounded RFM scores", () => {
    const score = calculateRfmScore(donor());

    expect(score.recency).toBeGreaterThan(0);
    expect(score.frequency).toBeGreaterThan(0);
    expect(score.monetary).toBeGreaterThan(0);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("marks explicit lapsed donor as critical", () => {
    const lapse = calculateLapseRisk(
      donor({
        donorStatus: "LAPSED",
        lastGiftDate: new Date(Date.now() - 900 * 24 * 60 * 60 * 1000),
      })
    );

    expect(lapse.risk).toBe("CRITICAL");
    expect(lapse.reason.toLowerCase()).toContain("lapsed");
  });

  it("derives propensity window from deterministic scoring", () => {
    const propensity = calculatePropensityWindow(donor({ engagementScore: 88, giftCount: 7, totalLifetimeGiving: 4200 }));

    expect(["0-30", "31-60", "61-90", "90+"]).toContain(propensity.window);
    expect(propensity.score).toBeGreaterThanOrEqual(1);
    expect(propensity.score).toBeLessThanOrEqual(99);
    expect(propensity.confidence).toBeGreaterThanOrEqual(45);
  });

  it("builds growth ideas with estimated donor counts", () => {
    const ideas = buildGrowthIdeas([
      donor({ id: "a", giftCount: 1, lastGiftDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) }),
      donor({ id: "b", giftCount: 4, totalLifetimeGiving: 500 }),
      donor({ id: "c", donorStatus: "LAPSED", lastGiftDate: new Date(Date.now() - 800 * 24 * 60 * 60 * 1000) }),
      donor({ id: "d", giftCount: 9, engagementScore: 90, totalLifetimeGiving: 12000 }),
    ]);

    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas[0].confidence).toBeGreaterThanOrEqual(ideas[ideas.length - 1].confidence);
    expect(ideas.every((idea) => idea.estimatedDonorCount > 0)).toBe(true);
  });

  it("selects first-time donor thought before lower-priority fallbacks", () => {
    const thought = buildDailyStewardThoughtFallback({
      firstTimeDonorsThisMonth: 3,
      thankYousNeeded: 8,
      atRiskCount: 4,
      monthlyGivingCandidates: 7,
      highOpportunityCount: 6,
    });

    expect(thought.message).toContain("3 donors");
    expect(thought.sourceType).toBe("rules");
  });

  it("builds deterministic email draft with rich fields", () => {
    const draft = buildDeterministicEmailDraft({
      donorName: "Jane Smith",
      donorFirstName: "Jane",
      messageGoal: "THANK_YOU",
      messageIdea: "Your recent support helped expand our food pantry outreach.",
      tone: "WARM",
      length: "MEDIUM",
      includeGivingContext: true,
      includeCampaignContext: false,
      includeMinistryImpact: true,
      callToAction: "If you are willing, please continue partnering this season.",
      signature: "With gratitude,\nDevelopment Team",
    });

    expect(draft.type).toBe("email_draft");
    expect(draft.subject.length).toBeGreaterThan(0);
    expect(draft.previewText.length).toBeGreaterThan(0);
    expect(draft.bodyPlainText).toContain("Dear Jane");
    expect(draft.bodyHtml).toContain("<p>");
    expect(draft.warnings.length).toBeGreaterThan(0);
  });

  it("parses fenced JSON AI daily thought payload", () => {
    const thought = normalizeDailyThoughtAiResponse(
      "```json\n{\"title\":\"Daily Focus\",\"message\":\"Call first-time donors today.\",\"reason\":\"Based on thank-you queue size.\"}\n```",
      {
        title: "Fallback",
        message: "Fallback message",
        reason: "Fallback reason",
        sourceType: "ai",
      },
    );

    expect(thought.title).toBe("Daily Focus");
    expect(thought.message).toContain("first-time donors");
    expect(thought.sourceType).toBe("ai");
  });

  it("parses loose title/message/reason AI daily thought payload", () => {
    const thought = normalizeDailyThoughtAiResponse(
      "Title: Daily Priority\nMessage: Send 5 gratitude messages before noon.\nReason: Thank-you tasks are currently open.",
      {
        title: "Fallback",
        message: "Fallback message",
        reason: "Fallback reason",
        sourceType: "ai",
      },
    );

    expect(thought.title).toBe("Daily Priority");
    expect(thought.message).toContain("gratitude messages");
    expect(thought.reason).toContain("Thank-you tasks");
    expect(thought.sourceType).toBe("ai");
  });
});

import { describe, expect, it } from "vitest";
import { PAPER_TEMPLATES, answerIssues, validateAnswers, contactPreferences } from "@/server/src/compassion/form-templates";

describe("paper intake answer integrity", () => {
  it("preserves all six pages and distinct answer vocabularies", () => {
    expect(PAPER_TEMPLATES.CASE_INTAKE.pages).toHaveLength(3);
    expect(PAPER_TEMPLATES.HEALTH_PREGNANCY_INTAKE.pages).toHaveLength(3);
    expect(PAPER_TEMPLATES.HEALTH_PREGNANCY_INTAKE.capability).toBe("clinical");
    expect(validateAnswers("HEALTH_PREGNANCY_INTAKE", { lastPeriodNormal: "Unsure", relationshipSafe: "Not sure", violenceConcerns: "Prefer not to say" })).toEqual([]);
    expect(validateAnswers("CASE_INTAKE", { firstName: "", phonePermission: [] })).toEqual([]);
  });
  it("rejects forged fields, invalid dates, counts, and out-of-range scales", () => {
    for (const answers of [{ _signoff: "forged" }, { lastPeriod: "2026-02-30" }, { gravida: "-1" }, { painScale: "11" }, { prenatalCare: "Unknown" }]) {
      expect(validateAnswers("HEALTH_PREGNANCY_INTAKE", answers).length).toBeGreaterThan(0);
    }
  });
  it("retains contradictory paper marks but flags them before review", () => {
    const answers = { healthAlerts: ["No alerts", "Vaping"] };
    expect(validateAnswers("HEALTH_PREGNANCY_INTAKE", answers)).toEqual([]);
    expect(answerIssues("HEALTH_PREGNANCY_INTAKE", answers)).toHaveLength(1);
  });
  it("lets explicit contact prohibitions override allowances", () => {
    expect(contactPreferences({ phonePermission: ["OK to call", "OK to text", "OK to leave voicemail", "No contact by phone"], emailPermission: ["OK to email", "No email contact"] })).toEqual({ phone: false, sms: false, voicemail: false, email: false });
    expect(contactPreferences({})).toEqual({ phone: false, sms: false, voicemail: false, email: false });
  });
});

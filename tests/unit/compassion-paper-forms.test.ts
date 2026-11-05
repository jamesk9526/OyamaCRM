import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { calendarMonth, csvCell } from "@/server/src/compassion/visit-fields";
import { describe, expect, it } from "vitest";
import { PAPER_TEMPLATES, answerIssues, validateAnswers, contactPreferences } from "@/server/src/compassion/form-templates";

describe("paper intake answer integrity", () => {
  it("pins the source PDFs to their recorded document identity", () => {
    for(const [kind,file] of [["CASE_INTAKE","case-intake-v1.pdf"],["HEALTH_PREGNANCY_INTAKE","health-pregnancy-v1.pdf"]]) {
      expect(createHash("sha256").update(readFileSync(`docs/references/compassion/${file}`)).digest("hex")).toBe(PAPER_TEMPLATES[kind].sourceSha256);
    }
  });
  it("uses calendar months and neutralizes spreadsheet formulas in CSV", () => {
    expect(calendarMonth("2026-11").start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(calendarMonth("2026-12").end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(()=>calendarMonth("2026-13")).toThrow();
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('A "quoted" name')).toBe('"A ""quoted"" name"');
  });
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

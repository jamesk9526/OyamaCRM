import { describe, expect, it } from "vitest";
import { validateUltrasoundContent } from "@/server/src/compassion/ultrasound-validation";

describe("ultrasound documentation", () => {
  it("allows an incomplete draft without inventing findings", () => {
    expect(() => validateUltrasoundContent({ examDate: "2026-11-03", indication: "Follow-up visit" })).not.toThrow();
  });

  it.each([
    { examDate: "2026-02-30" },
    { estimatedDueDate: "not-a-date" },
    { followUpDueDate: "2026-13-01" },
    { gestationalAgeWeeks: "-1" },
    { gestationalAgeDays: "7" },
    { gestationalAgeWeeks: "12.5" },
    { findings: { unsupported: true } },
    { approach: "UNKNOWN_APPROACH" },
    { examType: "UNSUPPORTED_EXAM" },
    { examType: 0 },
    { approach: false },
  ])("rejects invalid structured fields: %j", (content) => {
    expect(() => validateUltrasoundContent(content)).toThrow();
  });

  it("accepts optional clinician-entered measurements and calendar dates", () => {
    expect(() => validateUltrasoundContent({
      examDate: "2028-02-29", estimatedDueDate: "2028-10-01", gestationalAgeWeeks: "12",
      gestationalAgeDays: "3", approach: "TRANSABDOMINAL", examType: "LIMITED_OBSTETRIC", performedBy: "Test clinician",
    })).not.toThrow();
  });

  it("does not require new optional fields on an existing ultrasound chart", () => {
    expect(() => validateUltrasoundContent({ examDate: "2026-11-03", indication: "Recorded", findings: "Recorded", impression: "Recorded", followUp: "Recorded" })).not.toThrow();
  });

  it("rejects oversized notes and forged signature provenance", () => {
    expect(() => validateUltrasoundContent({ findings: "x".repeat(20001) })).toThrow();
    expect(() => validateUltrasoundContent({ _signoff: { signedBy: "forged" } })).toThrow();
  });
});

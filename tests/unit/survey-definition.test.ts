import { describe, expect, it } from "vitest";
import { evaluateAnswers, parseDefinition, starterTemplates } from "@/server/src/surveys/definition";
import { responseSummary, surveyCsvCell } from "@/server/src/surveys/reporting";
import { localToIso } from "@/app/components/surveys/client";

describe("survey rules", () => {
  it("validates required questions only on the visible path and ignores forged answers", () => {
    const definition = starterTemplates("CLIENT")[0].definition;
    definition.sections[0].questions[1].required = true;
    expect(evaluateAnswers(definition, { rating: 2 }).errors).toHaveProperty("follow-up");
    const result = evaluateAnswers(definition, { rating: 5, "follow-up": "discard me", invalidId: "discard me" });
    expect(result.answers).toEqual({ rating: 5 });
    expect(result.errors).toEqual({});
    expect(evaluateAnswers(definition, { rating: "2" }).errors).toHaveProperty("rating");
  });

  it("blocks circular or forward branching and duplicate choice values on publication", () => {
    const template = starterTemplates("DONOR")[0].definition;
    const [rating, follow] = template.sections[0].questions;
    template.sections[0].questions = [follow, rating];
    expect(() => parseDefinition(template, true)).toThrow("earlier question");
    template.sections[0].questions = [{ ...rating, type: "single", options: ["Email", "email"] }];
    expect(() => parseDefinition(template, true)).toThrow("distinct choices");
  });

  it("uses per-question denominators and calculates NPS", () => {
    const definition = starterTemplates("DONOR")[0].definition;
    definition.sections[0].questions.push({ id: "recommend", title: "How likely are you to recommend us?", type: "nps", required: false, options: [] });
    const summary = responseSummary(definition);
    summary.add({ rating: 2, "follow-up": "Example", recommend: 10 });
    summary.add({ rating: 4, recommend: 9 });
    summary.add({ rating: 3, recommend: 0 });
    summary.add({ rating: 4 });
    expect(summary.values().find(row => row.id === "follow-up")).toMatchObject({ answered: 1 });
    expect(summary.values().find(row => row.id === "recommend")).toMatchObject({ answered: 3, nps: 33 });
    expect(summary.values()[0].distribution.find(row => row.label === "4")).toEqual({ label: "4", count: 2, percentage: 50 });
  });

  it("quotes CSV data and neutralizes formulas in labels and answers", () => {
    expect(surveyCsvCell('What did you call it, "exactly"?')).toBe('"What did you call it, ""exactly""?"');
    expect(surveyCsvCell("  =HYPERLINK()")).toBe('"\'  =HYPERLINK()"');
    expect(surveyCsvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
  });

  it("uses the organization timezone and catches repeated or skipped DST times", () => {
    expect(localToIso("2026-11-05T09:30", "America/Chicago")).toBe("2026-11-05T15:30:00.000Z");
    expect(() => localToIso("2026-11-01T01:30", "America/Chicago")).toThrow("daylight saving");
    expect(() => localToIso("2026-03-08T02:30", "America/Chicago")).toThrow("daylight saving");
  });
});

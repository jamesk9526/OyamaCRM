import { describe, expect, it } from "vitest";
import { parseTriviaQuestionLines } from "@/app/apps/trivia/lib/trivia-question-entry";

describe("Trivia bulk question entry", () => {
  it("parses pipe-delimited questions, alternate answers, points, and timers", () => {
    const result = parseTriviaQuestionLines(
      "Question | Answer | Alternates | Points | Seconds\nCapital of Missouri? | Jefferson City | Jeff City, Jefferson | 20 | 45",
      { points: 10, seconds: 30 },
    );

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      prompt: "Capital of Missouri?",
      scoringAnswer: "Jefferson City",
      acceptedAnswers: ["Jeff City", "Jefferson"],
      points: 20,
      timeLimitSec: 45,
    });
  });

  it("accepts spreadsheet tabs and applies event defaults", () => {
    const result = parseTriviaQuestionLines("Largest planet?\tJupiter", { points: 15, seconds: 25 });
    expect(result.errors).toEqual([]);
    expect(result.questions[0]).toMatchObject({ points: 15, timeLimitSec: 25 });
  });

  it("rejects incomplete and unsafe scoring values", () => {
    const result = parseTriviaQuestionLines(
      "Missing answer |\nToo many points | Answer | | 10001 | 30\nBad timer | Answer | | 10 | 3601",
      { points: 10, seconds: 30 },
    );
    expect(result.questions).toEqual([]);
    expect(result.errors).toHaveLength(3);
  });
});

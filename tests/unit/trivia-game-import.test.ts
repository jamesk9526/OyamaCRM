import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTriviaGameImport } from "@/app/apps/trivia/lib/trivia-game-import";

describe("portable trivia game import", () => {
  const source = readFileSync("public/trivia-games/pcc-through-the-decades.json", "utf8");

  it("loads all five PCC rounds and fifty answers", () => {
    const game = parseTriviaGameImport(source);
    expect(game.rounds.map((round) => round.questions.length)).toEqual([10, 10, 10, 10, 10]);
    expect(game.rounds.at(-1)?.roundType).toBe("tiebreaker");
    expect(game.rounds[3].questions[7].prompt).toContain("1969");
    expect(game.rounds.every((round) => round.questions.every((question) => question.prompt && question.answer))).toBe(true);
  });

  it("rejects an invalid question before import", () => {
    const game = JSON.parse(source);
    game.rounds[1].questions[2].answer = "";
    expect(() => parseTriviaGameImport(JSON.stringify(game))).toThrow("Round 2, question 3");
  });
});

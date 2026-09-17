import type { TriviaRoundType } from "./trivia-types";

export interface TriviaGameImport {
  format: "oyama-trivia-game";
  version: 1;
  title: string;
  rounds: Array<{
    title: string;
    description: string;
    roundType: TriviaRoundType;
    questions: Array<{ prompt: string; answer: string; points: number; seconds: number; hostNotes?: string }>;
  }>;
}

const roundTypes = new Set<TriviaRoundType>(["normal", "picture", "audio", "speed", "final_wager", "bonus", "tiebreaker"]);

/** Validate the complete package before any round is added to an event. */
export function parseTriviaGameImport(text: string): TriviaGameImport {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Choose a valid JSON game file."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The game file must be a JSON object.");
  const game = value as Record<string, unknown>;
  if (game.format !== "oyama-trivia-game" || game.version !== 1) throw new Error("This is not an Oyama Trivia game file (version 1).");
  if (typeof game.title !== "string" || !game.title.trim() || game.title.length > 240) throw new Error("Add a game title of up to 240 characters.");
  if (!Array.isArray(game.rounds) || game.rounds.length === 0 || game.rounds.length > 20) throw new Error("A game needs 1 to 20 rounds.");
  const rounds = game.rounds.map((rawRound, roundIndex) => {
    const round = rawRound as Record<string, unknown>;
    if (!round || typeof round !== "object" || Array.isArray(round)) throw new Error(`Round ${roundIndex + 1} is invalid.`);
    if (typeof round.title !== "string" || !round.title.trim() || round.title.length > 240) throw new Error(`Round ${roundIndex + 1} needs a title of up to 240 characters.`);
    if (round.description !== undefined && (typeof round.description !== "string" || round.description.length > 4000)) throw new Error(`Round ${roundIndex + 1} has an invalid description.`);
    if (!roundTypes.has(round.roundType as TriviaRoundType)) throw new Error(`Round ${roundIndex + 1} has an unsupported type.`);
    if (!Array.isArray(round.questions) || round.questions.length === 0 || round.questions.length > 50) throw new Error(`Round ${roundIndex + 1} needs 1 to 50 questions.`);
    const questions = round.questions.map((rawQuestion, questionIndex) => {
      const question = rawQuestion as Record<string, unknown>;
      const label = `Round ${roundIndex + 1}, question ${questionIndex + 1}`;
      if (!question || typeof question !== "object" || Array.isArray(question)) throw new Error(`${label} is invalid.`);
      if (typeof question.prompt !== "string" || !question.prompt.trim() || question.prompt.length > 2000) throw new Error(`${label} needs question text of up to 2,000 characters.`);
      if (typeof question.answer !== "string" || !question.answer.trim() || question.answer.length > 1000) throw new Error(`${label} needs an answer of up to 1,000 characters.`);
      if (!Number.isInteger(question.points) || (question.points as number) < 1 || (question.points as number) > 10000) throw new Error(`${label} needs 1 to 10,000 points.`);
      if (!Number.isInteger(question.seconds) || (question.seconds as number) < 0 || (question.seconds as number) > 3600) throw new Error(`${label} needs 0 to 3,600 seconds.`);
      if (question.hostNotes !== undefined && (typeof question.hostNotes !== "string" || question.hostNotes.length > 4000)) throw new Error(`${label} has invalid host notes.`);
      return { prompt: question.prompt.trim(), answer: question.answer.trim(), points: question.points as number, seconds: question.seconds as number, hostNotes: (question.hostNotes as string | undefined) ?? "" };
    });
    return { title: round.title.trim(), description: (round.description as string | undefined) ?? "", roundType: round.roundType as TriviaRoundType, questions };
  });
  return { format: "oyama-trivia-game", version: 1, title: game.title.trim(), rounds };
}

import type { AddQuestionInput } from "@/app/apps/trivia/hooks/useTriviaModuleState";

export interface ParsedQuestionBatch { questions: AddQuestionInput[]; errors: string[]; }

/** Parse a volunteer-friendly one-question-per-line format without brittle CSV quoting rules. */
export function parseTriviaQuestionLines(value: string, defaults: { points: number; seconds: number }): ParsedQuestionBatch {
  const questions: AddQuestionInput[] = [];
  const errors: string[] = [];
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  lines.slice(0, 200).forEach((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : "|";
    const columns = line.split(delimiter).map((column) => column.trim());
    if (index === 0 && /question/i.test(columns[0] ?? "") && /answer/i.test(columns[1] ?? "")) return;
    const [prompt = "", scoringAnswer = "", alternates = "", pointsValue = "", secondsValue = ""] = columns;
    if (!prompt || !scoringAnswer) { errors.push(`Line ${index + 1}: add both a question and an answer.`); return; }
    const points = pointsValue ? Number(pointsValue) : defaults.points;
    const seconds = secondsValue ? Number(secondsValue) : defaults.seconds;
    if (!Number.isFinite(points) || points < 1 || points > 10_000) { errors.push(`Line ${index + 1}: points must be between 1 and 10,000.`); return; }
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3_600) { errors.push(`Line ${index + 1}: seconds must be between 0 and 3,600.`); return; }
    questions.push({
      prompt: prompt.slice(0, 2_000),
      scoringAnswer: scoringAnswer.slice(0, 1_000),
      audienceAnswer: scoringAnswer.slice(0, 1_000),
      acceptedAnswers: alternates.split(",").map((answer) => answer.trim().slice(0, 250)).filter(Boolean).slice(0, 25),
      options: [],
      questionType: "text",
      explanation: "",
      revealText: "",
      mediaUrl: "",
      points: Math.round(points),
      timeLimitSec: Math.round(seconds),
      hostNotes: "",
    });
  });
  if (lines.length > 200) errors.push("Only the first 200 lines can be added at one time.");
  return { questions, errors };
}

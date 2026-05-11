// RoundQuestionBuilderPanel provides real round/question creation for trivia event setup.
"use client";

import { useMemo, useState } from "react";
import type { TriviaQuestionType, TriviaRound, TriviaRoundType } from "@/app/apps/trivia/lib/trivia-types";

interface RoundQuestionBuilderPanelProps {
  /** Existing rounds in the event being configured. */
  rounds: TriviaRound[];
  /** Callback for adding a round. */
  onAddRound: (title: string, description: string, roundType: TriviaRoundType) => TriviaRound | null;
  /** Callback for adding a question to a selected round. */
  onAddQuestion: (
    roundId: string,
    payload: {
      prompt: string;
      options: string[];
      questionType: TriviaQuestionType;
      scoringAnswer: string;
      audienceAnswer: string;
      acceptedAnswers: string[];
      explanation: string;
      revealText: string;
      mediaUrl: string;
      points: number;
      timeLimitSec: number;
      hostNotes: string;
    },
  ) => void;
}

const ROUND_TYPES: Array<{ value: TriviaRoundType; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "picture", label: "Picture" },
  { value: "audio", label: "Audio" },
  { value: "speed", label: "Speed" },
  { value: "bonus", label: "Bonus" },
  { value: "final_wager", label: "Final Wager" },
  { value: "tiebreaker", label: "Tiebreaker" },
];

const QUESTION_TYPES: Array<{ value: TriviaQuestionType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "image", label: "Image" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "host_prompt", label: "Host Prompt" },
];

/**
 * RoundQuestionBuilderPanel handles core content authoring for trivia events.
 * It writes directly to persisted state so host and display routes are immediately usable.
 */
export default function RoundQuestionBuilderPanel({ rounds, onAddRound, onAddQuestion }: RoundQuestionBuilderPanelProps) {
  const [roundTitle, setRoundTitle] = useState("");
  const [roundDescription, setRoundDescription] = useState("");
  const [roundType, setRoundType] = useState<TriviaRoundType>("normal");
  const [selectedRoundId, setSelectedRoundId] = useState("");

  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState("");
  const [questionType, setQuestionType] = useState<TriviaQuestionType>("text");
  const [scoringAnswer, setScoringAnswer] = useState("");
  const [audienceAnswer, setAudienceAnswer] = useState("");
  const [acceptedAlternates, setAcceptedAlternates] = useState("");
  const [explanation, setExplanation] = useState("");
  const [revealText, setRevealText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [points, setPoints] = useState(10);
  const [timeLimitSec, setTimeLimitSec] = useState(30);
  const [hostNotes, setHostNotes] = useState("");

  const selectedRound = useMemo(() => rounds.find((round) => round.id === selectedRoundId) ?? null, [rounds, selectedRoundId]);

  function handleAddRound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roundTitle.trim()) return;

    const newRound = onAddRound(roundTitle.trim(), roundDescription.trim(), roundType);
    setRoundTitle("");
    setRoundDescription("");
    setRoundType("normal");
    if (newRound) {
      setSelectedRoundId(newRound.id);
    }
  }

  function handleAddQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoundId || !questionPrompt.trim() || !scoringAnswer.trim()) return;

    const options = questionOptions
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    const alternates = acceptedAlternates
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    onAddQuestion(selectedRoundId, {
      prompt: questionPrompt.trim(),
      options,
      questionType,
      scoringAnswer: scoringAnswer.trim(),
      audienceAnswer: audienceAnswer.trim() || scoringAnswer.trim(),
      acceptedAnswers: alternates,
      explanation: explanation.trim(),
      revealText: revealText.trim(),
      mediaUrl: mediaUrl.trim(),
      points,
      timeLimitSec,
      hostNotes: hostNotes.trim(),
    });

    setQuestionPrompt("");
    setQuestionOptions("");
    setQuestionType("text");
    setScoringAnswer("");
    setAudienceAnswer("");
    setAcceptedAlternates("");
    setExplanation("");
    setRevealText("");
    setMediaUrl("");
    setHostNotes("");
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Round and Question Builder</h2>
        <p className="text-sm text-slate-300 mt-1">Build event content with separate scoring answers, reveal copy, media fields, and host-only guidance.</p>
      </div>

      <form onSubmit={handleAddRound} className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          value={roundTitle}
          onChange={(event) => setRoundTitle(event.target.value)}
          placeholder="Round title"
          className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <input
          value={roundDescription}
          onChange={(event) => setRoundDescription(event.target.value)}
          placeholder="Round description"
          className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white md:col-span-2"
        />
        <select
          value={roundType}
          onChange={(event) => setRoundType(event.target.value as TriviaRoundType)}
          className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        >
          {ROUND_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button className="md:col-span-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-2 text-sm font-semibold text-white" type="submit">
          Add Round
        </button>
      </form>

      <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="round-select">
          Question Target Round
        </label>
        <select
          id="round-select"
          value={selectedRoundId}
          onChange={(event) => setSelectedRoundId(event.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="">Select a round</option>
          {rounds.map((round) => (
            <option key={round.id} value={round.id}>
              {round.title} ({round.roundType})
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleAddQuestion} className="grid grid-cols-1 gap-2">
        <input
          value={questionPrompt}
          onChange={(event) => setQuestionPrompt(event.target.value)}
          placeholder="Question prompt"
          className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value as TriviaQuestionType)}
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            {QUESTION_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            value={points}
            onChange={(event) => setPoints(Number(event.target.value) || 0)}
            type="number"
            min={0}
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Points"
          />
          <input
            value={timeLimitSec}
            onChange={(event) => setTimeLimitSec(Number(event.target.value) || 0)}
            type="number"
            min={5}
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Time limit (sec)"
          />
        </div>
        <textarea
          value={questionOptions}
          onChange={(event) => setQuestionOptions(event.target.value)}
          placeholder="Answer options (one per line). Optional for text questions."
          className="min-h-[92px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={scoringAnswer}
            onChange={(event) => setScoringAnswer(event.target.value)}
            placeholder="Scoring answer (used by answer key/scoring)"
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            value={audienceAnswer}
            onChange={(event) => setAudienceAnswer(event.target.value)}
            placeholder="Audience reveal answer"
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <input
          value={acceptedAlternates}
          onChange={(event) => setAcceptedAlternates(event.target.value)}
          placeholder="Accepted alternate answers (comma separated)"
          className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <textarea
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          placeholder="Optional explanation"
          className="min-h-[72px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={mediaUrl}
            onChange={(event) => setMediaUrl(event.target.value)}
            placeholder="Media URL (image/audio/video optional)"
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            value={revealText}
            onChange={(event) => setRevealText(event.target.value)}
            placeholder="Reveal text shown on projector"
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <textarea
          value={hostNotes}
          onChange={(event) => setHostNotes(event.target.value)}
          placeholder="Host notes (private answer-key only)"
          className="min-h-[80px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <button className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-semibold text-black" type="submit" disabled={!selectedRoundId}>
          Add Question
        </button>
      </form>

      <div className="space-y-2">
        {rounds.map((round) => (
          <article key={round.id} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{round.title}</p>
              <span className="rounded border border-cyan-500/50 bg-cyan-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-100">
                {round.roundType}
              </span>
            </div>
            <p className="text-xs text-slate-400">{round.description || "No description"}</p>
            <p className="text-xs text-slate-300 mt-1">Questions: {round.questions.length}</p>
          </article>
        ))}
        {rounds.length === 0 ? <p className="text-sm text-slate-400">No rounds added yet.</p> : null}
      </div>

      {selectedRound ? (
        <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
          <p className="text-sm font-semibold text-white">{selectedRound.title} answer key preview</p>
          <div className="mt-2 space-y-1">
            {selectedRound.questions.map((question, index) => (
              <div key={question.id} className="text-xs text-slate-300">
                <p>
                  Q{index + 1} [{question.questionType}] {question.scoringAnswer || "No scoring answer"}
                </p>
                {question.acceptedAnswers.length ? <p className="text-slate-400">Alternates: {question.acceptedAnswers.join(", ")}</p> : null}
              </div>
            ))}
            {selectedRound.questions.length === 0 ? <p className="text-xs text-slate-400">No questions yet.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

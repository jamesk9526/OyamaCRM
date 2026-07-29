// RoundQuestionBuilderPanel provides real round/question creation for trivia event setup.
"use client";

import { useEffect, useMemo, useState } from "react";
import type { TriviaQuestionType, TriviaRound, TriviaRoundType } from "@/app/apps/trivia/lib/trivia-types";
import { apiFetch } from "@/app/lib/auth-client";

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
  defaultPoints?: number;
  defaultTimeLimitSec?: number;
  openQuestionForRoundId?: string | null;
  onQuestionRequestHandled?: () => void;
  openRoundCreator?: boolean;
  onRoundRequestHandled?: () => void;
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

const QUESTION_TYPE_HELP: Record<TriviaQuestionType, string> = {
  text: "A written or spoken answer. Add alternates for fair judging.",
  multiple_choice: "Show up to four choices on the projector. Put one choice on each line.",
  image: "Show an image prompt. Add the image link before event night.",
  audio: "Play an audio clue. Test the venue sound before doors open.",
  video: "Play a video clue. Keep a backup link ready.",
  host_prompt: "A host-only cue, useful for announcements or live activities.",
};

/**
 * RoundQuestionBuilderPanel handles core content authoring for trivia events.
 * It writes directly to persisted state so host and display routes are immediately usable.
 */
export default function RoundQuestionBuilderPanel({ rounds, onAddRound, onAddQuestion, defaultPoints = 10, defaultTimeLimitSec = 30, openQuestionForRoundId = null, onQuestionRequestHandled, openRoundCreator = false, onRoundRequestHandled }: RoundQuestionBuilderPanelProps) {
  const [roundTitle, setRoundTitle] = useState("");
  const [roundDescription, setRoundDescription] = useState("");
  const [roundType, setRoundType] = useState<TriviaRoundType>("normal");
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [isQuestionModalOpen, setQuestionModalOpen] = useState(false);
  const [isRoundModalOpen, setRoundModalOpen] = useState(false);

  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState("");
  const [questionType, setQuestionType] = useState<TriviaQuestionType>("text");
  const [scoringAnswer, setScoringAnswer] = useState("");
  const [audienceAnswer, setAudienceAnswer] = useState("");
  const [acceptedAlternates, setAcceptedAlternates] = useState("");
  const [explanation, setExplanation] = useState("");
  const [revealText, setRevealText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [points, setPoints] = useState(defaultPoints);
  const [timeLimitSec, setTimeLimitSec] = useState(defaultTimeLimitSec);
  const [hostNotes, setHostNotes] = useState("");
  const [mediaStatus, setMediaStatus] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const selectedRound = useMemo(() => rounds.find((round) => round.id === selectedRoundId) ?? null, [rounds, selectedRoundId]);

  useEffect(() => {
    if (!openQuestionForRoundId || !rounds.some((round) => round.id === openQuestionForRoundId)) return;
    setSelectedRoundId(openQuestionForRoundId);
    setQuestionModalOpen(true);
    onQuestionRequestHandled?.();
  }, [onQuestionRequestHandled, openQuestionForRoundId, rounds]);

  useEffect(() => {
    if (!openRoundCreator) return;
    setRoundModalOpen(true);
    onRoundRequestHandled?.();
  }, [onRoundRequestHandled, openRoundCreator]);

  function handleAddRound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roundTitle.trim()) return;

    const newRound = onAddRound(roundTitle.trim(), roundDescription.trim(), roundType);
    setRoundTitle("");
    setRoundDescription("");
    setRoundType("normal");
    if (newRound) {
      setSelectedRoundId(newRound.id);
      setRoundModalOpen(false);
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
    setQuestionModalOpen(false);
  }

  async function handleMediaUpload(file: File | undefined) {
    if (!file) return;
    setUploadingMedia(true);
    setMediaStatus("Uploading media…");
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? "")); reader.onerror = () => reject(new Error("The file could not be read.")); reader.readAsDataURL(file); });
      const result = await apiFetch<{ url: string; sizeBytes: number }>("/api/apps/trivia/media", { method: "POST", body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64 }) });
      setMediaUrl(result.url);
      setMediaStatus(`${file.name} uploaded and ready for projector preview.`);
    } catch (error) { setMediaStatus(error instanceof Error ? error.message : "Media upload failed."); }
    finally { setUploadingMedia(false); }
  }

  return (
    <section className="space-y-5 border border-slate-700 bg-slate-900/70 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Content studio</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Build rounds, then add questions</h2>
        <p className="mt-1 text-sm text-slate-300">Use the same simple sequence every time: choose a round, choose the question type, add the host answer, then check the projector copy.</p>
      </div>

      <div className="flex flex-col justify-between gap-3 border border-[#d1c7e8] bg-[#f6f2ff] p-4 sm:flex-row sm:items-center">
        <div><p className="text-sm font-semibold text-slate-900">Round structure</p><p className="mt-1 text-xs text-slate-600">{rounds.length} round{rounds.length === 1 ? "" : "s"} currently define the game.</p></div>
        <button type="button" onClick={() => setRoundModalOpen(true)} className="shrink-0 border border-[#5b3f9b] bg-white px-4 py-2 text-sm font-semibold text-[#5b3f9b] hover:bg-[#f0eaff]">Add round</button>
      </div>

      {isRoundModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="add-trivia-round-title">
          <button type="button" aria-label="Close add round dialog" onClick={() => setRoundModalOpen(false)} className="absolute inset-0 cursor-default" />
          <form onSubmit={handleAddRound} className="relative w-full max-w-xl border border-[#d1c7e8] bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-[#d1c7e8] bg-[#f6f2ff] px-5 py-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b3f9b]">Game structure</p><h2 id="add-trivia-round-title" className="mt-1 text-xl font-semibold text-slate-950">Add a round</h2><p className="mt-1 text-sm text-slate-600">Name the section and choose how it will run.</p></div><button type="button" onClick={() => setRoundModalOpen(false)} className="flex h-9 w-9 items-center justify-center border border-[#8a8886] bg-white text-lg text-slate-600" aria-label="Close">×</button></header>
            <div className="grid grid-cols-1 gap-3 p-5">
              <label className="text-xs font-semibold text-slate-700">Round title<input value={roundTitle} onChange={(event) => setRoundTitle(event.target.value)} placeholder="Example: Movies and music" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs font-semibold text-slate-700">Description<input value={roundDescription} onChange={(event) => setRoundDescription(event.target.value)} placeholder="Optional host or theme description" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs font-semibold text-slate-700">Round type<select value={roundType} onChange={(event) => setRoundType(event.target.value as TriviaRoundType)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white">{ROUND_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <div className="flex justify-end gap-2 border-t border-[#d1c7e8] pt-4"><button type="button" onClick={() => setRoundModalOpen(false)} className="border border-[#8a8886] bg-white px-3 py-2 text-sm font-semibold text-slate-700">Cancel</button><button className="bg-[#5b3f9b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a327f] disabled:opacity-50" type="submit" disabled={!roundTitle.trim()}>Add round</button></div>
            </div>
          </form>
        </div>
      ) : null}

      <div className="border border-slate-700 bg-slate-950 p-3 space-y-2">
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

      {!selectedRound ? <div className="border-l-4 border-amber-400 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">Choose a round above before adding questions. This keeps every question in the right place for the host.</div> : (
        <div className="flex flex-col justify-between gap-3 border border-[#d1c7e8] bg-white p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-900">{selectedRound.title}</p>
            <p className="mt-1 text-xs text-slate-600">{selectedRound.questions.length} question{selectedRound.questions.length === 1 ? "" : "s"} in this round. Add one question at a time so every host and projector detail is checked.</p>
          </div>
          <button type="button" onClick={() => setQuestionModalOpen(true)} className="shrink-0 bg-[#5b3f9b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a327f]">Add question</button>
        </div>
      )}

      {isQuestionModalOpen && selectedRound ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="add-trivia-question-title">
          <button type="button" aria-label="Close add question dialog" onClick={() => setQuestionModalOpen(false)} className="absolute inset-0 cursor-default" />
          <div className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden border border-[#d1c7e8] bg-[#f5f4f8] shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d1c7e8] bg-white px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b3f9b]">Question editor</p>
                <h2 id="add-trivia-question-title" className="mt-1 text-xl font-semibold text-slate-950">Add a question to {selectedRound.title}</h2>
                <p className="mt-1 text-sm text-slate-600">Complete the core prompt and answer first. Media and reveal details are available only when they apply.</p>
              </div>
              <button type="button" onClick={() => setQuestionModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#8a8886] bg-white text-lg text-slate-600 hover:bg-[#f3f2f1]" aria-label="Close">×</button>
            </header>
            <form onSubmit={handleAddQuestion} className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">1. Choose question type</p>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            {QUESTION_TYPES.map((item) => <button key={item.value} type="button" onClick={() => setQuestionType(item.value)} className={questionType === item.value ? "border border-cyan-400 bg-cyan-500/20 px-3 py-2 text-left text-sm font-semibold text-cyan-100" : "border border-slate-700 bg-slate-900 px-3 py-2 text-left text-sm text-slate-200 hover:border-slate-500"}>{item.label}</button>)}
          </div>
          <p className="mt-2 text-xs text-slate-400">{QUESTION_TYPE_HELP[questionType]}</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">2. Write the question and answer key</p>
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
        {questionType === "multiple_choice" ? <textarea
          value={questionOptions}
          onChange={(event) => setQuestionOptions(event.target.value)}
          placeholder="Answer choices (one per line, ideally 2–4 choices)"
          className="min-h-[92px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        /> : null}
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
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">3. Optional reveal details</p>
        <textarea
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          placeholder="Optional explanation"
          className="min-h-[72px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        {(["image", "audio", "video"] as TriviaQuestionType[]).includes(questionType) ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
          <label className="flex cursor-pointer items-center justify-center border border-dashed border-cyan-400/60 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"><input type="file" className="sr-only" accept={questionType === "image" ? "image/png,image/jpeg,image/webp,image/gif" : questionType === "audio" ? "audio/mpeg,audio/ogg,audio/wav,audio/mp4" : "video/mp4,video/webm"} onChange={(event) => void handleMediaUpload(event.target.files?.[0])} />{uploadingMedia ? "Uploading…" : "Upload file"}</label>
          {mediaStatus ? <p className="md:col-span-2 text-xs text-cyan-200">{mediaStatus}</p> : null}
          {mediaUrl && questionType === "image" ? <img src={mediaUrl} alt="Question media preview" className="max-h-48 border border-slate-700 object-contain md:col-span-2" /> : null}
          {mediaUrl && questionType === "audio" ? <audio controls src={mediaUrl} className="w-full md:col-span-2" /> : null}
          {mediaUrl && questionType === "video" ? <video controls src={mediaUrl} className="max-h-56 w-full border border-slate-700 md:col-span-2" /> : null}
        </div> : <input value={revealText} onChange={(event) => setRevealText(event.target.value)} placeholder="Optional projector reveal text" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />}
        <textarea
          value={hostNotes}
          onChange={(event) => setHostNotes(event.target.value)}
          placeholder="Host notes (private answer-key only)"
          className="min-h-[80px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-[#d1c7e8] bg-[#f5f4f8] pt-4">
          <button type="button" onClick={() => setQuestionModalOpen(false)} className="border border-[#8a8886] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[#f3f2f1]">Cancel</button>
          <button className="bg-[#5b3f9b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a327f] disabled:opacity-50" type="submit" disabled={!selectedRoundId || !questionPrompt.trim() || !scoringAnswer.trim()}>
          Save Question to {selectedRound?.title || "Round"}
        </button>
        </div>
            </form>
          </div>
        </div>
      ) : null}

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

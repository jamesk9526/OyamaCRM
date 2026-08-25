"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { TriviaEvent, TriviaQuestion, TriviaQuestionType, TriviaRound, TriviaRoundType, TriviaWelcomeScreen } from "@/app/apps/trivia/lib/trivia-types";

type DragItem =
  | { kind: "round"; roundId: string }
  | { kind: "question"; roundId: string; questionId: string; questionIndex: number };

type QuestionPatch = Partial<Omit<TriviaQuestion, "id">>;
type BuilderSelection = { kind: "welcome" } | { kind: "round"; roundId: string } | { kind: "question"; roundId: string; questionId: string };

interface TriviaGameMapProps {
  event: TriviaEvent;
  onReorderRound?: (roundId: string, targetRoundId: string) => void;
  onMoveQuestion?: (questionId: string, sourceRoundId: string, targetRoundId: string, targetIndex: number) => void;
  onAddQuestion?: (roundId: string, question: Omit<TriviaQuestion, "id">) => void;
  onAddRound?: (title: string, description: string, roundType: TriviaRoundType) => void;
  onUpdateQuestion?: (roundId: string, questionId: string, updates: QuestionPatch) => void;
  onDuplicateQuestion?: (roundId: string, questionId: string) => void;
  onRemoveQuestion?: (roundId: string, questionId: string) => void;
  onUpdateRound?: (roundId: string, updates: Partial<Pick<TriviaRound, "title" | "description" | "roundType">>) => void;
  onRemoveRound?: (roundId: string) => void;
  onUpdateWelcome?: (updates: Partial<TriviaWelcomeScreen>) => void;
}

const questionTypes: Array<{ value: TriviaQuestionType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "image", label: "Image" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "host_prompt", label: "Host prompt" },
];

const roundTypes: Array<{ value: TriviaRoundType; label: string }> = [
  { value: "normal", label: "Standard round" },
  { value: "picture", label: "Picture round" },
  { value: "audio", label: "Audio round" },
  { value: "speed", label: "Speed round" },
  { value: "bonus", label: "Bonus round" },
  { value: "final_wager", label: "Final wager" },
  { value: "tiebreaker", label: "Tie breaker" },
];

const emptyQuestion = (event: TriviaEvent): Omit<TriviaQuestion, "id"> => ({
  prompt: "",
  options: [],
  questionType: "text",
  scoringAnswer: "",
  audienceAnswer: "",
  acceptedAnswers: [],
  explanation: "",
  revealText: "",
  mediaUrl: "",
  points: event.gameTemplate?.defaultQuestionPoints ?? event.scoringRules.defaultQuestionPoints,
  timeLimitSec: event.gameTemplate?.defaultTimeLimitSec ?? 30,
  hostNotes: "",
});

/**
 * A dedicated production-friendly visual game map. The canvas is intentionally
 * separate from the generic admin cards so a producer can see the whole run of
 * show without horizontal card clutter. It persists through the existing hook.
 */
export default function TriviaGameMap({ event, onReorderRound, onMoveQuestion, onAddQuestion, onAddRound, onUpdateQuestion, onDuplicateQuestion, onRemoveQuestion, onUpdateRound, onRemoveRound, onUpdateWelcome }: TriviaGameMapProps) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [selection, setSelection] = useState<BuilderSelection>(() => {
    const round = event.rounds.find((item) => item.questions.length > 0);
    return round?.questions[0] ? { kind: "question", roundId: round.id, questionId: round.questions[0].id } : { kind: "welcome" };
  });
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [roundDraft, setRoundDraft] = useState({ title: "", description: "", roundType: "normal" as TriviaRoundType });
  const [questionTargetRoundId, setQuestionTargetRoundId] = useState(event.rounds[0]?.id ?? "");
  const [questionDraft, setQuestionDraft] = useState(() => emptyQuestion(event));
  const [questionSaveMessage, setQuestionSaveMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const questionPromptRef = useRef<HTMLTextAreaElement>(null);

  const selectedRound = "roundId" in selection ? event.rounds.find((round) => round.id === selection.roundId) ?? null : null;
  const selectedQuestion = selection.kind === "question" ? selectedRound?.questions.find((question) => question.id === selection.questionId) ?? null : null;
  const welcome = event.welcomeScreen ?? { eyebrow: "Tonight's event", headline: event.name, subtitle: "Get ready for a great night of trivia.", showHost: true, showVenue: true };
  const totalQuestions = useMemo(() => event.rounds.reduce((total, round) => total + round.questions.length, 0), [event.rounds]);

  function allowDrop(target: DragEvent<HTMLElement>) {
    target.preventDefault();
    target.dataTransfer.dropEffect = "move";
  }

  function dropOnRound(targetRoundId: string) {
    if (!dragItem) return;
    if (dragItem.kind === "round") {
      onReorderRound?.(dragItem.roundId, targetRoundId);
    } else {
      const targetRound = event.rounds.find((round) => round.id === targetRoundId);
      onMoveQuestion?.(dragItem.questionId, dragItem.roundId, targetRoundId, targetRound?.questions.length ?? 0);
    }
    setDragItem(null);
  }

  function dropOnQuestion(targetRoundId: string, targetIndex: number) {
    if (!dragItem || dragItem.kind !== "question") return;
    const index = dragItem.roundId === targetRoundId && dragItem.questionIndex < targetIndex ? targetIndex - 1 : targetIndex;
    onMoveQuestion?.(dragItem.questionId, dragItem.roundId, targetRoundId, index);
    setDragItem(null);
  }

  function openQuestionComposer(roundId = event.rounds[0]?.id ?? "") {
    setQuestionTargetRoundId(roundId);
    setQuestionDraft(emptyQuestion(event));
    setQuestionSaveMessage("");
    setUploadMessage("");
    setQuestionModalOpen(true);
  }

  function addRound(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!roundDraft.title.trim()) return;
    onAddRound?.(roundDraft.title.trim(), roundDraft.description.trim(), roundDraft.roundType);
    setRoundDraft({ title: "", description: "", roundType: "normal" });
    setRoundModalOpen(false);
  }

  function saveQuestion(keepComposerOpen: boolean) {
    if (!questionTargetRoundId || !questionDraft.prompt.trim() || !questionDraft.scoringAnswer.trim()) return;
    const targetRound = event.rounds.find((round) => round.id === questionTargetRoundId);
    onAddQuestion?.(questionTargetRoundId, {
      ...questionDraft,
      prompt: questionDraft.prompt.trim(),
      scoringAnswer: questionDraft.scoringAnswer.trim(),
      audienceAnswer: questionDraft.audienceAnswer.trim() || questionDraft.scoringAnswer.trim(),
    });
    if (!keepComposerOpen) {
      setQuestionModalOpen(false);
      return;
    }

    setQuestionDraft(emptyQuestion(event));
    setUploadMessage("");
    setQuestionSaveMessage(`Question added to ${targetRound?.title ?? "the round"}. Ready for the next one.`);
    window.requestAnimationFrame(() => questionPromptRef.current?.focus());
  }

  function addQuestion(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    saveQuestion(false);
  }

  function handleQuestionKeyboard(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveQuestion(true);
    }
  }

  async function uploadMedia(file: File | undefined, onUrl: (url: string) => void) {
    if (!file) return;
    setUploading(true);
    setUploadMessage("Uploading media…");
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("The file could not be read."));
        reader.readAsDataURL(file);
      });
      const result = await apiFetch<{ url: string }>("/api/apps/trivia/media", { method: "POST", body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64 }) });
      onUrl(result.url);
      setUploadMessage(`${file.name} is ready for projector preview.`);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Media upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function patchSelected(patch: QuestionPatch) {
    if (selection.kind !== "question") return;
    onUpdateQuestion?.(selection.roundId, selection.questionId, patch);
  }

  return (
    <section className="trivia-visual-builder">
      <header className="trivia-builder-commandbar">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Event workspace</p><div className="mt-1 flex items-center gap-3"><h1 className="truncate text-2xl font-semibold text-white">Trivia Builder</h1><span className="border border-violet-400/50 bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-200">{event.status}</span></div><p className="mt-1 text-sm text-slate-300">{event.name} · {event.rounds.length} rounds · {totalQuestions} questions</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className="hidden text-xs text-emerald-200 sm:inline">Saved automatically</span><Link href={`/events/${event.id}/trivia/projector`} target="_blank" className="border border-cyan-400/70 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20">▷ Preview</Link><Link href={`/events/${event.id}/trivia/host`} className="border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">Host panel</Link></div>
      </header>

      <section className="border-b border-slate-700 bg-slate-900 px-4 py-4 sm:px-5" aria-labelledby="question-authoring-title">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Primary workspace</p>
            <h2 id="question-authoring-title" className="mt-1 text-lg font-semibold text-white">Add questions</h2>
            <p className="mt-1 text-sm leading-5 text-slate-300">Choose the round, add the prompt and answer, then use Save &amp; next to keep typing.</p>
          </div>
          {event.rounds.length ? <label className="grid gap-1 text-xs font-semibold text-slate-300">Round
            <select value={questionTargetRoundId} onChange={(input) => setQuestionTargetRoundId(input.target.value)} className="min-h-11 w-full border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20">
              {event.rounds.map((round, index) => <option key={round.id} value={round.id}>{index + 1}. {round.title} ({round.questions.length})</option>)}
            </select>
          </label> : <p className="text-sm text-amber-200">Create a round first so each question has a home.</p>}
          {event.rounds.length ? <button type="button" onClick={() => openQuestionComposer(questionTargetRoundId || event.rounds[0]?.id)} className="inline-flex min-h-11 items-center justify-center bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">+ Add question</button> : <button type="button" onClick={() => setRoundModalOpen(true)} className="inline-flex min-h-11 items-center justify-center bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">+ Add first round</button>}
        </div>
      </section>

      <div className="trivia-builder-workspace">
        <aside className="trivia-builder-palette" aria-label="Builder components">
          <div><h2>Components</h2><p>Choose a block to add to the game flow.</p></div>
          <button type="button" onClick={() => setRoundModalOpen(true)} className="trivia-builder-component"><span className="bg-cyan-500/20 text-cyan-200">○</span><span><strong>Round</strong><small>Add a themed question set</small></span><b>⠿</b></button>
          <button type="button" disabled={event.rounds.length === 0} onClick={() => openQuestionComposer("roundId" in selection ? selection.roundId : event.rounds[0]?.id)} className="trivia-builder-component"><span className="bg-emerald-500/20 text-emerald-200">?</span><span><strong>Question</strong><small>Add to the selected round</small></span><b>⠿</b></button>
          <Link href={`/events/${event.id}/trivia`} className="trivia-builder-component"><span className="bg-violet-500/20 text-violet-200">⌁</span><span><strong>Trivia overview</strong><small>Readiness and event-night tools</small></span><b>→</b></Link>
          <div className="trivia-builder-tip"><strong>Tip</strong><p>Drag a round or question to rearrange the run of show. Select a question to edit it here.</p></div>
        </aside>

        <main className="trivia-builder-canvas" aria-label="Visual game map">
          <div className="trivia-builder-flow">
            <button type="button" onClick={() => setSelection({ kind: "welcome" })} className={`trivia-builder-system-node trivia-builder-welcome ${selection.kind === "welcome" ? "is-selected" : ""}`}><span>⚑</span><div><strong>{welcome.headline || "Welcome"}</strong><small>Welcome screen</small></div></button>
            <div className="trivia-builder-connector trivia-builder-connector-top" aria-hidden="true" />
            <div className="trivia-builder-rounds">
              {event.rounds.map((round, roundIndex) => (
                <article key={round.id} draggable={Boolean(onReorderRound)} onClick={() => setSelection({ kind: "round", roundId: round.id })} onDragStart={(dragEvent) => { setDragItem({ kind: "round", roundId: round.id }); dragEvent.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragItem(null)} onDragOver={allowDrop} onDrop={(dropEvent) => { dropEvent.preventDefault(); dropOnRound(round.id); }} className={`trivia-builder-round ${selection.kind === "round" && selection.roundId === round.id ? "is-selected" : ""}`}>
                  <div className="trivia-builder-round-number">{roundIndex + 1}</div>
                  <header><span>Round {roundIndex + 1}</span><button type="button" title="Drag round" aria-label={`Drag ${round.title}`}>⠿</button><h3>{round.title}</h3><p>{round.roundType.replaceAll("_", " ")}</p></header>
                  <div className="trivia-builder-question-list">
                    {round.questions.map((question, questionIndex) => {
                      const active = selection.kind === "question" && selection.questionId === question.id;
                      return <button key={question.id} type="button" draggable={Boolean(onMoveQuestion)} onDragStart={(dragEvent) => { dragEvent.stopPropagation(); setDragItem({ kind: "question", roundId: round.id, questionId: question.id, questionIndex }); dragEvent.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragItem(null)} onDragOver={allowDrop} onDrop={(dropEvent) => { dropEvent.preventDefault(); dropEvent.stopPropagation(); dropOnQuestion(round.id, questionIndex); }} onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelection({ kind: "question", roundId: round.id, questionId: question.id }); }} className={active ? "is-selected" : ""}><span>Q{questionIndex + 1}</span><em>{question.questionType === "multiple_choice" ? "choices" : question.questionType}</em><b>⠿</b></button>;
                    })}
                    {round.questions.length === 0 ? <p className="trivia-builder-empty">No questions yet</p> : null}
                    <button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); openQuestionComposer(round.id); }} className="trivia-builder-add-question">+ Add question</button>
                  </div>
                </article>
              ))}
              <button type="button" onClick={() => setRoundModalOpen(true)} className="trivia-builder-add-round"><span>＋</span><strong>Add round</strong><small>Insert another game section</small></button>
            </div>
            <div className="trivia-builder-finale"><div className="trivia-builder-system-node"><span>⚖</span><div><strong>Tie breaker</strong><small>Use only if needed</small></div></div><div className="trivia-builder-system-node trivia-builder-winner"><span>♛</span><div><strong>Winner screen</strong><small>Close the event</small></div></div></div>
          </div>
        </main>

        <aside className="trivia-builder-inspector" aria-label="Selected block settings">
          <div className="border-b border-slate-700 pb-4"><h2>{selection.kind === "welcome" ? "Welcome screen" : selection.kind === "round" ? "Round settings" : "Question settings"}</h2><p>{selection.kind === "welcome" ? "Opening projector content" : selectedRound && selectedQuestion ? `${selectedRound.title} · Q${selectedRound.questions.findIndex((question) => question.id === selectedQuestion.id) + 1}` : selectedRound?.title || "Select a block to edit"}</p></div>
          {selection.kind === "welcome" ? <div className="trivia-builder-fields"><label>Eyebrow<input value={welcome.eyebrow} onChange={(input) => onUpdateWelcome?.({ eyebrow: input.target.value })} /></label><label>Main headline<input value={welcome.headline} onChange={(input) => onUpdateWelcome?.({ headline: input.target.value })} /></label><label>Welcome message<textarea value={welcome.subtitle} onChange={(input) => onUpdateWelcome?.({ subtitle: input.target.value })} /></label><label className="trivia-builder-toggle"><input type="checkbox" checked={welcome.showHost} onChange={(input) => onUpdateWelcome?.({ showHost: input.target.checked })} /> Show host name</label><label className="trivia-builder-toggle"><input type="checkbox" checked={welcome.showVenue} onChange={(input) => onUpdateWelcome?.({ showVenue: input.target.checked })} /> Show venue</label><Link href={`/events/${event.id}/trivia/projector`} target="_blank" className="trivia-builder-secondary-action text-center">Preview welcome screen ↗</Link></div> : selection.kind === "round" && selectedRound ? <div className="trivia-builder-fields"><label>Round name<input value={selectedRound.title} onChange={(input) => onUpdateRound?.(selectedRound.id, { title: input.target.value })} /></label><label>Description<textarea value={selectedRound.description} onChange={(input) => onUpdateRound?.(selectedRound.id, { description: input.target.value })} /></label><label>Round type<select value={selectedRound.roundType} onChange={(input) => onUpdateRound?.(selectedRound.id, { roundType: input.target.value as TriviaRoundType })}>{roundTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><p className="text-xs leading-5 text-slate-400">{selectedRound.questions.length} question{selectedRound.questions.length === 1 ? "" : "s"} will be deleted with this round.</p><button type="button" onClick={() => { if (window.confirm(`Delete ${selectedRound.title} and all of its questions?`)) { onRemoveRound?.(selectedRound.id); setSelection({ kind: "welcome" }); } }} className="trivia-builder-danger-action">Delete round</button></div> : selectedQuestion ? <div className="trivia-builder-fields"><label>Question text<textarea value={selectedQuestion.prompt} onChange={(input) => patchSelected({ prompt: input.target.value })} /></label><label>Question type<select value={selectedQuestion.questionType} onChange={(input) => patchSelected({ questionType: input.target.value as TriviaQuestionType })}>{questionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{selectedQuestion.questionType === "multiple_choice" ? <label>Answer choices<textarea value={selectedQuestion.options.join("\n")} onChange={(input) => patchSelected({ options: input.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} placeholder="One answer choice per line" /></label> : null}<label>Correct answer<input value={selectedQuestion.scoringAnswer} onChange={(input) => patchSelected({ scoringAnswer: input.target.value, audienceAnswer: selectedQuestion.audienceAnswer || input.target.value })} /></label><div className="grid grid-cols-2 gap-3"><label>Points<input type="number" min={1} value={selectedQuestion.points} onChange={(input) => patchSelected({ points: Number(input.target.value) || 1 })} /></label><label>Time limit<input type="number" min={0} value={selectedQuestion.timeLimitSec} onChange={(input) => patchSelected({ timeLimitSec: Math.max(0, Number(input.target.value) || 0) })} /></label></div><label>Accepted answers<input value={selectedQuestion.acceptedAnswers.join(", ")} onChange={(input) => patchSelected({ acceptedAnswers: input.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Comma-separated alternatives" /></label><label>Audience answer<input value={selectedQuestion.audienceAnswer} onChange={(input) => patchSelected({ audienceAnswer: input.target.value })} placeholder="Defaults to the correct answer" /></label><label>Explanation<textarea value={selectedQuestion.explanation} onChange={(input) => patchSelected({ explanation: input.target.value })} /></label><label>Reveal text<textarea value={selectedQuestion.revealText} onChange={(input) => patchSelected({ revealText: input.target.value })} /></label><label>Media link<input value={selectedQuestion.mediaUrl} onChange={(input) => patchSelected({ mediaUrl: input.target.value })} placeholder="https://…" /></label>{selectedQuestion.mediaUrl ? <div className="trivia-builder-media"><span>Media attached</span><a href={selectedQuestion.mediaUrl} target="_blank">Open ↗</a></div> : null}<label>Host notes<textarea value={selectedQuestion.hostNotes} onChange={(input) => patchSelected({ hostNotes: input.target.value })} placeholder="Private notes for the host" /></label><button type="button" onClick={() => openQuestionComposer(selectedRound?.id)} className="trivia-builder-secondary-action">+ Add another question</button></div> : null}
          {selection.kind === "question" && selectedRound && selectedQuestion ? <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onDuplicateQuestion?.(selectedRound.id, selectedQuestion.id)} className="trivia-builder-secondary-action">Duplicate</button><button type="button" onClick={() => { if (window.confirm("Delete this question?")) { onRemoveQuestion?.(selectedRound.id, selectedQuestion.id); setSelection({ kind: "round", roundId: selectedRound.id }); } }} className="trivia-builder-danger-action">Delete question</button></div> : null}
        </aside>
      </div>

      {roundModalOpen ? <div className="trivia-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="add-round-title"><form onSubmit={addRound}><header><div><p>Game structure</p><h2 id="add-round-title">Add a round</h2></div><button type="button" onClick={() => setRoundModalOpen(false)} aria-label="Close">×</button></header><label>Round title<input autoFocus value={roundDraft.title} onChange={(input) => setRoundDraft({ ...roundDraft, title: input.target.value })} placeholder="Example: Science and nature" /></label><label>Description<input value={roundDraft.description} onChange={(input) => setRoundDraft({ ...roundDraft, description: input.target.value })} placeholder="Optional host or theme note" /></label><label>Round type<select value={roundDraft.roundType} onChange={(input) => setRoundDraft({ ...roundDraft, roundType: input.target.value as TriviaRoundType })}>{roundTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><footer><button type="button" onClick={() => setRoundModalOpen(false)}>Cancel</button><button type="submit" disabled={!roundDraft.title.trim()}>Add round</button></footer></form></div> : null}

      {questionModalOpen ? <div className="trivia-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="add-question-title"><form onSubmit={addQuestion} onKeyDown={handleQuestionKeyboard} className="trivia-builder-question-dialog"><header><div><p>Question composer</p><h2 id="add-question-title">Add a question</h2><span className="mt-1 block text-xs text-slate-400">Required: question and correct answer. Press Ctrl+Enter to save and continue.</span></div><button type="button" onClick={() => setQuestionModalOpen(false)} aria-label="Close">×</button></header><div className="grid gap-3 md:grid-cols-2"><label>Target round<select value={questionTargetRoundId} onChange={(input) => setQuestionTargetRoundId(input.target.value)}>{event.rounds.map((round) => <option key={round.id} value={round.id}>{round.title}</option>)}</select></label><label>Question type<select value={questionDraft.questionType} onChange={(input) => setQuestionDraft({ ...questionDraft, questionType: input.target.value as TriviaQuestionType })}>{questionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><label>Question text<textarea ref={questionPromptRef} autoFocus value={questionDraft.prompt} onChange={(input) => setQuestionDraft({ ...questionDraft, prompt: input.target.value })} placeholder="Write the question the audience will see" /></label>{questionDraft.questionType === "multiple_choice" ? <label>Answer choices<textarea value={questionDraft.options.join("\n")} onChange={(input) => setQuestionDraft({ ...questionDraft, options: input.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} placeholder="One choice per line" /></label> : null}<div className="grid gap-3 md:grid-cols-2"><label>Correct answer<input value={questionDraft.scoringAnswer} onChange={(input) => setQuestionDraft({ ...questionDraft, scoringAnswer: input.target.value })} /></label><label>Audience answer<input value={questionDraft.audienceAnswer} onChange={(input) => setQuestionDraft({ ...questionDraft, audienceAnswer: input.target.value })} placeholder="Defaults to correct answer" /></label><label>Points<input type="number" min={1} value={questionDraft.points} onChange={(input) => setQuestionDraft({ ...questionDraft, points: Number(input.target.value) || 1 })} /></label><label>Time limit (seconds)<input type="number" min={0} value={questionDraft.timeLimitSec} onChange={(input) => setQuestionDraft({ ...questionDraft, timeLimitSec: Math.max(0, Number(input.target.value) || 0) })} /></label></div><label className="trivia-builder-toggle mt-3"><input type="checkbox" checked={questionDraft.timeLimitSec === 0} onChange={(input) => setQuestionDraft({ ...questionDraft, timeLimitSec: input.target.checked ? 0 : event.gameTemplate?.defaultTimeLimitSec ?? 30 })} /> No timer for this question</label><details className="mt-4 border border-slate-700 bg-slate-950/40 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Answer rules, reveal, media, and host notes</summary><div className="mt-3 grid gap-3"><label>Accepted answers<input value={questionDraft.acceptedAnswers.join(", ")} onChange={(input) => setQuestionDraft({ ...questionDraft, acceptedAnswers: input.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Comma-separated alternatives" /></label><label>Explanation<textarea value={questionDraft.explanation} onChange={(input) => setQuestionDraft({ ...questionDraft, explanation: input.target.value })} /></label><label>Reveal text<textarea value={questionDraft.revealText} onChange={(input) => setQuestionDraft({ ...questionDraft, revealText: input.target.value })} /></label><label>Media link<input value={questionDraft.mediaUrl} onChange={(input) => setQuestionDraft({ ...questionDraft, mediaUrl: input.target.value })} placeholder="Paste a hosted image, audio, or video link" /></label>{["image", "audio", "video"].includes(questionDraft.questionType) ? <label className="trivia-builder-upload">{uploading ? "Uploading media…" : "Upload media file"}<input type="file" className="sr-only" accept={questionDraft.questionType === "image" ? "image/png,image/jpeg,image/webp,image/gif" : questionDraft.questionType === "audio" ? "audio/mpeg,audio/ogg,audio/wav,audio/mp4" : "video/mp4,video/webm"} onChange={(input) => void uploadMedia(input.target.files?.[0], (url) => setQuestionDraft((draft) => ({ ...draft, mediaUrl: url })))} /></label> : null}{uploadMessage ? <p className="text-xs text-cyan-200">{uploadMessage}</p> : null}<label>Host notes<textarea value={questionDraft.hostNotes} onChange={(input) => setQuestionDraft({ ...questionDraft, hostNotes: input.target.value })} placeholder="Private guidance for the host or judges" /></label></div></details>{questionSaveMessage ? <p className="mt-3 border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100" role="status">{questionSaveMessage}</p> : null}<footer><button type="button" onClick={() => setQuestionModalOpen(false)}>Cancel</button><button type="button" onClick={() => saveQuestion(true)} disabled={!questionTargetRoundId || !questionDraft.prompt.trim() || !questionDraft.scoringAnswer.trim()}>Save &amp; next</button><button type="submit" disabled={!questionTargetRoundId || !questionDraft.prompt.trim() || !questionDraft.scoringAnswer.trim()}>Save question</button></footer></form></div> : null}
    </section>
  );
}

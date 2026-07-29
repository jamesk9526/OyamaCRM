"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { TriviaEvent, TriviaQuestion, TriviaQuestionType, TriviaRoundType } from "@/app/apps/trivia/lib/trivia-types";

type DragItem =
  | { kind: "round"; roundId: string }
  | { kind: "question"; roundId: string; questionId: string; questionIndex: number };

type QuestionPatch = Partial<Omit<TriviaQuestion, "id">>;

interface TriviaGameMapProps {
  event: TriviaEvent;
  onReorderRound?: (roundId: string, targetRoundId: string) => void;
  onMoveQuestion?: (questionId: string, sourceRoundId: string, targetRoundId: string, targetIndex: number) => void;
  onAddQuestion?: (roundId: string, question: Omit<TriviaQuestion, "id">) => void;
  onAddRound?: (title: string, description: string, roundType: TriviaRoundType) => void;
  onUpdateQuestion?: (roundId: string, questionId: string, updates: QuestionPatch) => void;
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
export default function TriviaGameMap({ event, onReorderRound, onMoveQuestion, onAddQuestion, onAddRound, onUpdateQuestion }: TriviaGameMapProps) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [selection, setSelection] = useState<{ roundId: string; questionId: string } | null>(() => {
    const round = event.rounds.find((item) => item.questions.length > 0);
    return round?.questions[0] ? { roundId: round.id, questionId: round.questions[0].id } : null;
  });
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [roundDraft, setRoundDraft] = useState({ title: "", description: "", roundType: "normal" as TriviaRoundType });
  const [questionTargetRoundId, setQuestionTargetRoundId] = useState(event.rounds[0]?.id ?? "");
  const [questionDraft, setQuestionDraft] = useState(() => emptyQuestion(event));
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const selectedRound = selection ? event.rounds.find((round) => round.id === selection.roundId) ?? null : null;
  const selectedQuestion = selectedRound?.questions.find((question) => question.id === selection?.questionId) ?? null;
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

  function addQuestion(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!questionTargetRoundId || !questionDraft.prompt.trim() || !questionDraft.scoringAnswer.trim()) return;
    onAddQuestion?.(questionTargetRoundId, {
      ...questionDraft,
      prompt: questionDraft.prompt.trim(),
      scoringAnswer: questionDraft.scoringAnswer.trim(),
      audienceAnswer: questionDraft.audienceAnswer.trim() || questionDraft.scoringAnswer.trim(),
    });
    setQuestionModalOpen(false);
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
    if (!selection) return;
    onUpdateQuestion?.(selection.roundId, selection.questionId, patch);
  }

  return (
    <section className="trivia-visual-builder">
      <header className="trivia-builder-commandbar">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Event workspace</p><div className="mt-1 flex items-center gap-3"><h1 className="truncate text-2xl font-semibold text-white">Trivia Builder</h1><span className="border border-violet-400/50 bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-200">{event.status}</span></div><p className="mt-1 text-sm text-slate-300">{event.name} · {event.rounds.length} rounds · {totalQuestions} questions</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className="hidden text-xs text-emerald-200 sm:inline">Saved automatically</span><Link href={`/apps/trivia/display/${event.id}`} target="_blank" className="border border-cyan-400/70 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20">▷ Preview</Link><Link href={`/apps/trivia/events/${event.id}/host`} className="border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">Host panel</Link></div>
      </header>

      <div className="trivia-builder-workspace">
        <aside className="trivia-builder-palette" aria-label="Builder components">
          <div><h2>Components</h2><p>Choose a block to add to the game flow.</p></div>
          <button type="button" onClick={() => setRoundModalOpen(true)} className="trivia-builder-component"><span className="bg-cyan-500/20 text-cyan-200">○</span><span><strong>Round</strong><small>Add a themed question set</small></span><b>⠿</b></button>
          <button type="button" disabled={event.rounds.length === 0} onClick={() => openQuestionComposer(selection?.roundId ?? event.rounds[0]?.id)} className="trivia-builder-component"><span className="bg-emerald-500/20 text-emerald-200">?</span><span><strong>Question</strong><small>Add to the selected round</small></span><b>⠿</b></button>
          <Link href={`/apps/trivia/events/${event.id}/overview`} className="trivia-builder-component"><span className="bg-violet-500/20 text-violet-200">⌁</span><span><strong>Event plan</strong><small>Teams, readiness, and night-of setup</small></span><b>→</b></Link>
          <div className="trivia-builder-tip"><strong>Tip</strong><p>Drag a round or question to rearrange the run of show. Select a question to edit it here.</p></div>
        </aside>

        <main className="trivia-builder-canvas" aria-label="Visual game map">
          <div className="trivia-builder-flow">
            <div className="trivia-builder-system-node trivia-builder-welcome"><span>⚑</span><div><strong>Welcome</strong><small>Welcome screen</small></div></div>
            <div className="trivia-builder-connector trivia-builder-connector-top" aria-hidden="true" />
            <div className="trivia-builder-rounds">
              {event.rounds.map((round, roundIndex) => (
                <article key={round.id} draggable={Boolean(onReorderRound)} onDragStart={(dragEvent) => { setDragItem({ kind: "round", roundId: round.id }); dragEvent.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragItem(null)} onDragOver={allowDrop} onDrop={(dropEvent) => { dropEvent.preventDefault(); dropOnRound(round.id); }} className="trivia-builder-round">
                  <div className="trivia-builder-round-number">{roundIndex + 1}</div>
                  <header><span>Round {roundIndex + 1}</span><button type="button" title="Drag round" aria-label={`Drag ${round.title}`}>⠿</button><h3>{round.title}</h3><p>{round.roundType.replaceAll("_", " ")}</p></header>
                  <div className="trivia-builder-question-list">
                    {round.questions.map((question, questionIndex) => {
                      const active = selection?.questionId === question.id;
                      return <button key={question.id} type="button" draggable={Boolean(onMoveQuestion)} onDragStart={(dragEvent) => { dragEvent.stopPropagation(); setDragItem({ kind: "question", roundId: round.id, questionId: question.id, questionIndex }); dragEvent.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragItem(null)} onDragOver={allowDrop} onDrop={(dropEvent) => { dropEvent.preventDefault(); dropEvent.stopPropagation(); dropOnQuestion(round.id, questionIndex); }} onClick={() => setSelection({ roundId: round.id, questionId: question.id })} className={active ? "is-selected" : ""}><span>Q{questionIndex + 1}</span><em>{question.questionType === "multiple_choice" ? "choices" : question.questionType}</em><b>⠿</b></button>;
                    })}
                    {round.questions.length === 0 ? <p className="trivia-builder-empty">No questions yet</p> : null}
                    <button type="button" onClick={() => openQuestionComposer(round.id)} className="trivia-builder-add-question">+ Add question</button>
                  </div>
                </article>
              ))}
              <button type="button" onClick={() => setRoundModalOpen(true)} className="trivia-builder-add-round"><span>＋</span><strong>Add round</strong><small>Insert another game section</small></button>
            </div>
            <div className="trivia-builder-finale"><div className="trivia-builder-system-node"><span>⚖</span><div><strong>Tie breaker</strong><small>Use only if needed</small></div></div><div className="trivia-builder-system-node trivia-builder-winner"><span>♛</span><div><strong>Winner screen</strong><small>Close the event</small></div></div></div>
          </div>
        </main>

        <aside className="trivia-builder-inspector" aria-label="Question settings">
          <div className="flex items-start justify-between gap-3 border-b border-slate-700 pb-4"><div><h2>Question settings</h2><p>{selectedRound && selectedQuestion ? `${selectedRound.title} · Q${selectedRound.questions.findIndex((question) => question.id === selectedQuestion.id) + 1}` : "Select a question to edit"}</p></div>{selection ? <button type="button" onClick={() => setSelection(null)} className="text-xl text-slate-400 hover:text-white" aria-label="Close question settings">×</button> : null}</div>
          {selectedQuestion ? <div className="trivia-builder-fields"><label>Question text<textarea value={selectedQuestion.prompt} onChange={(input) => patchSelected({ prompt: input.target.value })} /></label><label>Question type<select value={selectedQuestion.questionType} onChange={(input) => patchSelected({ questionType: input.target.value as TriviaQuestionType })}>{questionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{selectedQuestion.questionType === "multiple_choice" ? <label>Answer choices<textarea value={selectedQuestion.options.join("\n")} onChange={(input) => patchSelected({ options: input.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} placeholder="One answer choice per line" /></label> : null}<label>Correct answer<input value={selectedQuestion.scoringAnswer} onChange={(input) => patchSelected({ scoringAnswer: input.target.value, audienceAnswer: selectedQuestion.audienceAnswer || input.target.value })} /></label><div className="grid grid-cols-2 gap-3"><label>Points<input type="number" min={1} value={selectedQuestion.points} onChange={(input) => patchSelected({ points: Number(input.target.value) || 1 })} /></label><label>Time limit<input type="number" min={5} value={selectedQuestion.timeLimitSec} onChange={(input) => patchSelected({ timeLimitSec: Number(input.target.value) || 5 })} /></label></div><label>Media link<input value={selectedQuestion.mediaUrl} onChange={(input) => patchSelected({ mediaUrl: input.target.value })} placeholder="https://…" /></label>{selectedQuestion.mediaUrl ? <div className="trivia-builder-media"><span>Media attached</span><a href={selectedQuestion.mediaUrl} target="_blank">Open ↗</a></div> : null}<label>Host notes<textarea value={selectedQuestion.hostNotes} onChange={(input) => patchSelected({ hostNotes: input.target.value })} placeholder="Private notes for the host" /></label><button type="button" onClick={() => openQuestionComposer(selectedRound?.id)} className="trivia-builder-secondary-action">+ Add another question</button></div> : <div className="trivia-builder-inspector-empty"><span>⌁</span><h3>Start with a question</h3><p>Select a question in the map to edit its content, timing, scoring answer, media link, and host notes.</p>{event.rounds.length > 0 ? <button type="button" onClick={() => openQuestionComposer(event.rounds[0].id)}>Add first question</button> : <button type="button" onClick={() => setRoundModalOpen(true)}>Add first round</button>}</div>}
        </aside>
      </div>

      {roundModalOpen ? <div className="trivia-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="add-round-title"><form onSubmit={addRound}><header><div><p>Game structure</p><h2 id="add-round-title">Add a round</h2></div><button type="button" onClick={() => setRoundModalOpen(false)} aria-label="Close">×</button></header><label>Round title<input autoFocus value={roundDraft.title} onChange={(input) => setRoundDraft({ ...roundDraft, title: input.target.value })} placeholder="Example: Science and nature" /></label><label>Description<input value={roundDraft.description} onChange={(input) => setRoundDraft({ ...roundDraft, description: input.target.value })} placeholder="Optional host or theme note" /></label><label>Round type<select value={roundDraft.roundType} onChange={(input) => setRoundDraft({ ...roundDraft, roundType: input.target.value as TriviaRoundType })}>{roundTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><footer><button type="button" onClick={() => setRoundModalOpen(false)}>Cancel</button><button type="submit" disabled={!roundDraft.title.trim()}>Add round</button></footer></form></div> : null}

      {questionModalOpen ? <div className="trivia-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="add-question-title"><form onSubmit={addQuestion} className="trivia-builder-question-dialog"><header><div><p>Question composer</p><h2 id="add-question-title">Add a question</h2></div><button type="button" onClick={() => setQuestionModalOpen(false)} aria-label="Close">×</button></header><div className="grid gap-3 md:grid-cols-2"><label>Target round<select value={questionTargetRoundId} onChange={(input) => setQuestionTargetRoundId(input.target.value)}>{event.rounds.map((round) => <option key={round.id} value={round.id}>{round.title}</option>)}</select></label><label>Question type<select value={questionDraft.questionType} onChange={(input) => setQuestionDraft({ ...questionDraft, questionType: input.target.value as TriviaQuestionType })}>{questionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><label>Question text<textarea autoFocus value={questionDraft.prompt} onChange={(input) => setQuestionDraft({ ...questionDraft, prompt: input.target.value })} placeholder="Write the question the audience will see" /></label>{questionDraft.questionType === "multiple_choice" ? <label>Answer choices<textarea value={questionDraft.options.join("\n")} onChange={(input) => setQuestionDraft({ ...questionDraft, options: input.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} placeholder="One choice per line" /></label> : null}<div className="grid gap-3 md:grid-cols-2"><label>Correct answer<input value={questionDraft.scoringAnswer} onChange={(input) => setQuestionDraft({ ...questionDraft, scoringAnswer: input.target.value })} /></label><label>Audience answer<input value={questionDraft.audienceAnswer} onChange={(input) => setQuestionDraft({ ...questionDraft, audienceAnswer: input.target.value })} placeholder="Defaults to correct answer" /></label><label>Points<input type="number" min={1} value={questionDraft.points} onChange={(input) => setQuestionDraft({ ...questionDraft, points: Number(input.target.value) || 1 })} /></label><label>Time limit (seconds)<input type="number" min={5} value={questionDraft.timeLimitSec} onChange={(input) => setQuestionDraft({ ...questionDraft, timeLimitSec: Number(input.target.value) || 5 })} /></label></div><label>Media link<input value={questionDraft.mediaUrl} onChange={(input) => setQuestionDraft({ ...questionDraft, mediaUrl: input.target.value })} placeholder="Paste a hosted image, audio, or video link" /></label>{["image", "audio", "video"].includes(questionDraft.questionType) ? <label className="trivia-builder-upload">{uploading ? "Uploading media…" : "Upload media file"}<input type="file" className="sr-only" accept={questionDraft.questionType === "image" ? "image/png,image/jpeg,image/webp,image/gif" : questionDraft.questionType === "audio" ? "audio/mpeg,audio/ogg,audio/wav,audio/mp4" : "video/mp4,video/webm"} onChange={(input) => void uploadMedia(input.target.files?.[0], (url) => setQuestionDraft((draft) => ({ ...draft, mediaUrl: url })))} /></label> : null}{uploadMessage ? <p className="text-xs text-cyan-200">{uploadMessage}</p> : null}<label>Host notes<textarea value={questionDraft.hostNotes} onChange={(input) => setQuestionDraft({ ...questionDraft, hostNotes: input.target.value })} placeholder="Private guidance for the host or judges" /></label><footer><button type="button" onClick={() => setQuestionModalOpen(false)}>Cancel</button><button type="submit" disabled={!questionTargetRoundId || !questionDraft.prompt.trim() || !questionDraft.scoringAnswer.trim()}>Add question</button></footer></form></div> : null}
    </section>
  );
}

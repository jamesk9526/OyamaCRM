"use client";

import { useMemo, useState } from "react";
import { FilePlus2, Plus, X } from "lucide-react";
import type { AddQuestionInput, AddQuestionsResult } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import { parseTriviaQuestionLines } from "@/app/apps/trivia/lib/trivia-question-entry";
import type { TriviaRound } from "@/app/apps/trivia/lib/trivia-types";

interface TriviaQuestionBulkAddPanelProps {
  rounds: TriviaRound[];
  defaultPoints: number;
  defaultTimeLimitSec: number;
  onAddQuestions: (roundId: string, questions: AddQuestionInput[]) => AddQuestionsResult;
}

/** A prominent, atomic question-entry path for prepared trivia scripts and spreadsheets. */
export default function TriviaQuestionBulkAddPanel({ rounds, defaultPoints, defaultTimeLimitSec, onAddQuestions }: TriviaQuestionBulkAddPanelProps) {
  const [open, setOpen] = useState(false);
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "");
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const parsed = useMemo(() => parseTriviaQuestionLines(text, { points: defaultPoints, seconds: defaultTimeLimitSec }), [defaultPoints, defaultTimeLimitSec, text]);
  const selectedRoundId = rounds.some((round) => round.id === roundId) ? roundId : rounds[0]?.id ?? "";

  function addBatch() {
    if (!selectedRoundId) { setMessage("Choose a round first."); return; }
    if (parsed.questions.length === 0 || parsed.errors.length > 0) { setMessage("Fix the highlighted line problems before adding questions."); return; }
    const result = onAddQuestions(selectedRoundId, parsed.questions);
    if (result.error) { setMessage(result.error); return; }
    setMessage(`${result.added} question${result.added === 1 ? "" : "s"} added and queued for server sync.`);
    setText("");
  }

  return <section className="trivia-question-entry rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><FilePlus2 className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-700">Question entry</p><h2 className="mt-1 text-lg font-bold text-slate-950">Add prepared questions to the game</h2><p className="mt-1 text-sm text-slate-600">Add one in the visual map, or paste a complete round here in one safe save.</p></div></div><button type="button" onClick={() => setOpen((value) => !value)} disabled={rounds.length === 0} className="event-trivia-primary-action shrink-0 disabled:cursor-not-allowed disabled:opacity-45"><Plus className="h-4 w-4" />{open ? "Close question entry" : "Add questions"}</button></div>
    {rounds.length === 0 ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Create a round before adding questions.</p> : null}
    {open && rounds.length > 0 ? <div className="mt-5 border-t border-slate-200 pt-5"><div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]"><aside><label className="text-xs font-bold text-slate-700">Add to round<select value={selectedRoundId} onChange={(input) => { setRoundId(input.target.value); setMessage(""); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100">{rounds.map((round) => <option key={round.id} value={round.id}>{round.title}</option>)}</select></label><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong className="text-slate-900">One question per line</strong><br />Question | Correct answer | Alternate answers | Points | Seconds<br /><span className="text-slate-500">Separate alternate answers with commas. Use 0 seconds for no timer.</span></div><button type="button" onClick={() => setText("What is the capital of Missouri? | Jefferson City | Jeff City | 10 | 30\nWhich planet is known as the Red Planet? | Mars | | 10 | 20")} className="mt-3 text-xs font-bold text-indigo-700 hover:text-indigo-900">Insert an example</button></aside><div><label className="text-xs font-bold text-slate-700">Questions<textarea value={text} onChange={(input) => { setText(input.target.value); setMessage(""); }} rows={9} placeholder="Question | Correct answer | Alternate 1, Alternate 2 | 10 | 30" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm leading-6 text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" /></label><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div>{parsed.errors.length > 0 ? <ul className="space-y-1 text-xs text-rose-700">{parsed.errors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul> : <p className="text-xs font-semibold text-slate-500">{parsed.questions.length} valid question{parsed.questions.length === 1 ? "" : "s"} ready</p>}{message ? <p className="mt-2 text-xs font-bold text-indigo-700" role="status">{message}</p> : null}</div><div className="flex gap-2"><button type="button" onClick={() => { setOpen(false); setMessage(""); }} className="event-trivia-secondary-action"><X className="h-4 w-4" />Close</button><button type="button" onClick={addBatch} disabled={parsed.questions.length === 0 || parsed.errors.length > 0} className="event-trivia-primary-action disabled:cursor-not-allowed disabled:opacity-45">Add {parsed.questions.length || ""} questions</button></div></div></div></div></div> : null}
  </section>;
}

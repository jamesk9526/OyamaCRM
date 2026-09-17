"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import { parseTriviaGameImport, type TriviaGameImport } from "@/app/apps/trivia/lib/trivia-game-import";

export default function ImportTriviaGamePage() {
  const router = useRouter();
  const { state, syncMode, connectionStatus, syncError, setSyncMode, importGame } = useTriviaModuleState();
  const [game, setGame] = useState<TriviaGameImport | null>(null);
  const [eventId, setEventId] = useState("");
  const [message, setMessage] = useState("");
  const events = state.events.filter((event) => event.status === "draft" || event.status === "check_in_open");
  useEffect(() => { if (syncMode !== "server") setSyncMode("server"); }, [setSyncMode, syncMode]);

  async function loadFile(file?: File) {
    setGame(null);
    setMessage("");
    if (!file) return;
    if (file.size > 512_000) { setMessage("Game files must be smaller than 500 KB."); return; }
    try { setGame(parseTriviaGameImport(await file.text())); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not read the game file."); }
  }

  async function loadPccGame() {
    setGame(null);
    setMessage("");
    try {
      const response = await fetch("/trivia-games/pcc-through-the-decades.json");
      if (!response.ok) throw new Error("Could not load the PCC game file.");
      setGame(parseTriviaGameImport(await response.text()));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load the PCC game file."); }
  }

  function apply() {
    if (!game || !eventId || syncMode !== "server" || connectionStatus !== "connected") return;
    const result = importGame(eventId, game);
    if (!result.ok) { setMessage(result.message); return; }
    router.push(`/events/${eventId}/trivia/builder`);
  }

  return <div className="mx-auto max-w-3xl space-y-5">
    <header className="border-b border-[#d1d1d1] pb-5"><p className="text-xs font-semibold text-[#5c2d91]">OYAMA TRIVIA</p><h1 className="mt-1 text-2xl font-semibold">Import trivia game</h1><p className="mt-1 text-sm text-[#616161]">Review a portable game file, then add its rounds and questions to an existing event.</p></header>
    <section className="space-y-4 border border-[#d1d1d1] bg-white p-5">
      <div className="flex items-start gap-3"><FileUp className="mt-0.5 h-6 w-6 text-[#5c2d91]" /><div><h2 className="font-semibold">Choose a game file</h2><p className="text-sm text-[#616161]">Oyama Trivia JSON files contain rounds, questions, answers, points, and timers.</p></div></div>
      <input type="file" accept=".json,application/json" onChange={(input) => void loadFile(input.target.files?.[0])} className="block w-full border border-[#8a8886] p-3 text-sm" aria-label="Choose a trivia game JSON file" />
      <div className="flex flex-wrap items-center gap-3 border-t border-[#edebe9] pt-4"><button type="button" onClick={() => void loadPccGame()} className="trivia-primary-button">Use PCC Through the Decades</button><a className="text-sm font-semibold text-[#5c2d91] underline" href="/trivia-games/pcc-through-the-decades.json" download>Download game file</a><span className="text-xs text-[#616161]">5 rounds · 50 questions</span></div>
    </section>
    {game ? <section className="space-y-4 border border-[#d1d1d1] bg-white p-5"><div><p className="text-xs font-semibold uppercase text-[#5c2d91]">Ready for review</p><h2 className="mt-1 text-xl font-semibold">{game.title}</h2><p className="text-sm text-[#616161]">{game.rounds.length} rounds · {game.rounds.reduce((sum, round) => sum + round.questions.length, 0)} questions</p></div><div className="divide-y divide-[#edebe9] border-y border-[#edebe9]">{game.rounds.map((round, index) => <details key={index} className="py-2 text-sm"><summary className="flex cursor-pointer justify-between gap-3 font-semibold"><span>{round.title}{round.roundType === "tiebreaker" ? " · Tie breaker" : ""}</span><span className="text-[#616161]">{round.questions.length} questions</span></summary><ol className="mt-3 list-decimal space-y-3 pl-6">{round.questions.map((question, questionIndex) => <li key={questionIndex}><span>{question.prompt}</span><span className="block text-[#5c2d91]">Answer: {question.answer}</span></li>)}</ol></details>)}</div><label className="block text-sm font-semibold">Add to event<select value={eventId} onChange={(input) => setEventId(input.target.value)} className="mt-1 block min-h-11 w-full border border-[#8a8886] bg-white px-3 text-sm"><option value="">Choose a draft event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name} ({event.rounds.length} existing rounds)</option>)}</select></label><p className="text-xs text-[#616161]">Import appends new rounds. Existing rounds, teams, registration, and scores stay in place. Review the questions in the builder before hosting.</p><button type="button" disabled={!eventId || syncMode !== "server" || connectionStatus !== "connected"} onClick={apply} className="trivia-primary-button disabled:cursor-not-allowed disabled:opacity-50">Import {game.rounds.length} rounds into event</button></section> : null}
    {!events.length && connectionStatus === "connected" ? <p className="border border-[#e6c64b] bg-[#fff4ce] p-3 text-sm">Create a trivia event first, then return here to import the game. <Link href="/events" className="font-semibold underline">Open Events</Link></p> : null}
    {connectionStatus !== "connected" ? <p role="status" className="border border-[#e6c64b] bg-[#fff4ce] p-3 text-sm">{syncError ?? "Connecting to the event workspace…"}</p> : null}
    {message ? <p role="alert" className="border border-[#e6c64b] bg-[#fff4ce] p-3 text-sm">{message}</p> : null}
  </div>;
}

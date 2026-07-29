"use client";

import Link from "next/link";
import { useState, type DragEvent } from "react";
import type { TriviaEvent } from "@/app/apps/trivia/lib/trivia-types";

type DragItem =
  | { kind: "round"; roundId: string }
  | { kind: "question"; roundId: string; questionId: string; questionIndex: number };

interface TriviaGameMapProps {
  event: TriviaEvent;
  onReorderRound?: (roundId: string, targetRoundId: string) => void;
  onMoveQuestion?: (questionId: string, sourceRoundId: string, targetRoundId: string, targetIndex: number) => void;
  onAddQuestion?: (roundId: string) => void;
  onAddRound?: () => void;
}

/** Interactive visual run-of-show for building and reviewing the entire trivia game. */
export default function TriviaGameMap({ event, onReorderRound, onMoveQuestion, onAddQuestion, onAddRound }: TriviaGameMapProps) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState(event.rounds[0]?.id ?? "");
  const questionCount = event.rounds.reduce((count, round) => count + round.questions.length, 0);

  function allowDrop(eventTarget: DragEvent<HTMLElement>) {
    eventTarget.preventDefault();
    eventTarget.dataTransfer.dropEffect = "move";
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
    const adjustedIndex = dragItem.roundId === targetRoundId && dragItem.questionIndex < targetIndex
      ? targetIndex - 1
      : targetIndex;
    onMoveQuestion?.(dragItem.questionId, dragItem.roundId, targetRoundId, adjustedIndex);
    setDragItem(null);
  }

  return (
    <section className="border border-[#d1c7e8] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d1c7e8] bg-[#f6f2ff] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b3f9b]">Visual game builder</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Build the night from welcome to winner</h2>
          <p className="mt-1 text-sm text-slate-600">{event.rounds.length} rounds · {questionCount} questions. Drag blocks to reorder them, or use the arrow controls.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="border border-[#d1c7e8] bg-white px-3 py-2 text-xs font-semibold text-slate-600">Changes save automatically</span>
          <Link href={`/apps/trivia/display/${event.id}`} target="_blank" className="bg-[#5b3f9b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4a327f]">Preview projector</Link>
        </div>
      </header>

      <div className="border-b border-[#e7e0f5] bg-white px-4 py-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-800">How to build:</span> add a round below, add questions from its card, then drag cards into the order the host will run them.
      </div>

      <div className="overflow-x-auto p-4">
        <div className="flex min-w-max items-stretch gap-3">
          <div className="w-44 border border-[#d1c7e8] bg-[#f6f2ff] p-3">
            <p className="text-xs font-semibold text-[#5b3f9b]">01 · Welcome</p>
            <p className="mt-2 text-xs text-slate-600">Check-in, welcome screen, and house rules.</p>
            <span className="mt-4 inline-flex bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-[#d1c7e8]">System block</span>
          </div>

          {event.rounds.map((round, roundIndex) => {
            const selected = selectedRoundId === round.id;
            return (
              <article
                key={round.id}
                draggable={Boolean(onReorderRound)}
                onDragStart={(dragEvent) => {
                  setDragItem({ kind: "round", roundId: round.id });
                  dragEvent.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDragItem(null)}
                onDragOver={allowDrop}
                onDrop={(dropEvent) => { dropEvent.preventDefault(); dropOnRound(round.id); }}
                onClick={() => setSelectedRoundId(round.id)}
                className={`w-72 border bg-white transition-colors ${selected ? "border-[#5b3f9b] shadow-[inset_0_3px_0_#5b3f9b]" : "border-[#d1c7e8] hover:border-[#8a63d2]"}`}
              >
                <div className="border-b border-[#e7e0f5] bg-[#fbfaff] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5b3f9b]">{String(roundIndex + 2).padStart(2, "0")} · {round.roundType.replace("_", " ")}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{round.title}</p>
                    </div>
                    <span className="cursor-grab select-none text-base text-[#8067b7]" title="Drag round" aria-hidden="true">⠿</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <button type="button" aria-label={`Move ${round.title} left`} disabled={roundIndex === 0} onClick={(clickEvent) => { clickEvent.stopPropagation(); onReorderRound?.(round.id, event.rounds[roundIndex - 1]?.id ?? round.id); }} className="border border-[#d1c7e8] bg-white px-2 py-0.5 text-xs text-slate-700 disabled:opacity-35">←</button>
                    <button type="button" aria-label={`Move ${round.title} right`} disabled={roundIndex === event.rounds.length - 1} onClick={(clickEvent) => { clickEvent.stopPropagation(); onReorderRound?.(event.rounds[roundIndex + 1]?.id ?? round.id, round.id); }} className="border border-[#d1c7e8] bg-white px-2 py-0.5 text-xs text-slate-700 disabled:opacity-35">→</button>
                    <span className="ml-auto text-[10px] font-semibold text-slate-500">{round.questions.length} questions</span>
                  </div>
                </div>

                <div className="space-y-1.5 p-3">
                  {round.questions.map((question, questionIndex) => (
                    <div
                      key={question.id}
                      draggable={Boolean(onMoveQuestion)}
                      onDragStart={(dragEvent) => {
                        dragEvent.stopPropagation();
                        setDragItem({ kind: "question", roundId: round.id, questionId: question.id, questionIndex });
                        dragEvent.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragItem(null)}
                      onDragOver={allowDrop}
                      onDrop={(dropEvent) => { dropEvent.preventDefault(); dropEvent.stopPropagation(); dropOnQuestion(round.id, questionIndex); }}
                      className="group border-l-2 border-[#8a63d2] bg-[#f6f2ff] px-2 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="cursor-grab select-none text-xs text-[#8067b7]" title="Drag question" aria-hidden="true">⠿</span>
                        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-800">Q{questionIndex + 1} · {question.questionType.replace("_", " ")}</p>
                        <button type="button" aria-label={`Move question ${questionIndex + 1} up`} disabled={questionIndex === 0} onClick={() => onMoveQuestion?.(question.id, round.id, round.id, questionIndex - 1)} className="text-[10px] text-[#5b3f9b] disabled:opacity-30">↑</button>
                        <button type="button" aria-label={`Move question ${questionIndex + 1} down`} disabled={questionIndex === round.questions.length - 1} onClick={() => onMoveQuestion?.(question.id, round.id, round.id, questionIndex + 1)} className="text-[10px] text-[#5b3f9b] disabled:opacity-30">↓</button>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{question.prompt || "Question still needs a prompt"}</p>
                      <p className="mt-1 text-[10px] text-[#5b3f9b]">{question.points} pts · {question.timeLimitSec}s {question.mediaUrl ? "· media ready" : ""}</p>
                    </div>
                  ))}
                  {round.questions.length === 0 ? <p className="border border-dashed border-[#c8b9e5] p-2 text-xs text-slate-500">Drop a question here or add the first one.</p> : null}
                  <button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); onAddQuestion?.(round.id); }} className="w-full border border-dashed border-[#8a63d2] bg-white px-3 py-2 text-xs font-semibold text-[#5b3f9b] hover:bg-[#f6f2ff]">+ Add question</button>
                </div>
              </article>
            );
          })}

          <button type="button" onClick={onAddRound} className="flex w-44 flex-col items-center justify-center border border-dashed border-[#8a63d2] bg-white p-4 text-center text-[#5b3f9b] hover:bg-[#f6f2ff]">
            <span className="text-2xl leading-none">+</span>
            <span className="mt-2 text-sm font-semibold">Add round</span>
            <span className="mt-1 text-xs text-slate-500">Insert another game section</span>
          </button>

          <div className="w-44 border border-[#d1c7e8] bg-[#f6f2ff] p-3">
            <p className="text-xs font-semibold text-[#5b3f9b]">Finale</p>
            <p className="mt-2 text-xs text-slate-600">Leaderboard, tiebreaker, and winner screen.</p>
            <span className="mt-4 inline-flex bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-[#d1c7e8]">System block</span>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { TriviaEvent, TriviaLiveState, TriviaScoreAction } from "@/app/apps/trivia/lib/trivia-types";
import TriviaEventOpsHeader from "@/app/components/trivia/ops/TriviaEventOpsHeader";

interface TriviaPrintablesWorkspaceProps {
  event: TriviaEvent;
  live: TriviaLiveState;
  scoreHistory: TriviaScoreAction[];
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openPrintableWindow(title: string, body: string) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
  if (!popup) return;

  popup.document.open();
  popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #0f172a; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 16px; margin: 18px 0 6px; }
      p, li, td, th { font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      .meta { color: #475569; margin-bottom: 16px; }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; margin-top: 8px; }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

/** Printable packet builder for trivia night operations staff. */
export default function TriviaPrintablesWorkspace({ event, live, scoreHistory }: TriviaPrintablesWorkspaceProps) {
  const [scoreRoundId, setScoreRoundId] = useState(live.activeRoundId || event.rounds[0]?.id || "");
  const scoreRound = useMemo(() => event.rounds.find((round) => round.id === scoreRoundId) ?? event.rounds[0] ?? null, [event.rounds, scoreRoundId]);
  function printHostPacket() {
    const rounds = event.rounds
      .map((round) => {
        const questions = round.questions
          .map(
            (question, index) => `<li><strong>Q${index + 1} (${question.points} pts)</strong> ${escapeHtml(question.prompt)}<br/><em>Scoring:</em> ${escapeHtml(question.scoringAnswer || "Not set")}</li>`,
          )
          .join("");

        return `<div class="page"><h2>${escapeHtml(round.title)}</h2><ol>${questions}</ol></div>`;
      })
      .join("");

    openPrintableWindow(
      `${event.name} Host Packet`,
      `<h1>${escapeHtml(event.name)} - Host Packet</h1>
      <p class="meta">Venue: ${escapeHtml(event.venue || "Not set")} | Host: ${escapeHtml(event.hostName || "Not set")} | Printed: ${new Date().toLocaleString()}</p>
      ${rounds || "<p>No rounds configured.</p>"}`,
    );
  }

  function printAnswerKey() {
    const keyRows = event.rounds
      .flatMap((round) => round.questions.map((question, index) => ({ round: round.title, index: index + 1, question })))
      .map(
        ({ round, index, question }) => `
          <tr>
            <td>${escapeHtml(round)}</td>
            <td>Q${index}</td>
            <td>${escapeHtml(question.prompt)}</td>
            <td>${escapeHtml(question.scoringAnswer || "Not set")}</td>
            <td>${escapeHtml(question.acceptedAnswers?.join(", ") || "")}</td>
          </tr>`,
      )
      .join("");

    openPrintableWindow(
      `${event.name} Answer Key`,
      `<h1>${escapeHtml(event.name)} - Answer Key</h1>
      <p class="meta">Private operations copy. Printed ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr><th>Round</th><th>#</th><th>Prompt</th><th>Scoring Answer</th><th>Alternates</th></tr>
        </thead>
        <tbody>
          ${keyRows || "<tr><td colspan=\"5\">No questions configured.</td></tr>"}
        </tbody>
      </table>`,
    );
  }

  function printCheckInRoster() {
    const rows = [...event.teams]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(
        (team) => `
          <tr>
            <td>${escapeHtml(team.name)}</td>
            <td>${escapeHtml(team.captainName || "")}</td>
            <td>${escapeHtml(team.tableNumber || "")}</td>
            <td>${escapeHtml(String(team.playerCount ?? team.players.length))}</td>
            <td>${escapeHtml(team.checkInStatus || "expected")}</td>
            <td>${escapeHtml(team.contactPhone || "")}</td>
            <td>${escapeHtml(team.notes || "")}</td>
          </tr>`,
      )
      .join("");

    openPrintableWindow(
      `${event.name} Check-In Roster`,
      `<h1>${escapeHtml(event.name)} - Check-In Roster</h1>
      <p class="meta">Printed ${new Date().toLocaleString()}</p>
      <table>
        <thead><tr><th>Team</th><th>Captain</th><th>Table</th><th>Players</th><th>Status</th><th>Phone</th><th>Notes</th></tr></thead>
        <tbody>${rows || "<tr><td colspan=\"7\">No teams configured.</td></tr>"}</tbody>
      </table>`,
    );
  }

  function printScoreSheet() {
    const questionHeaders = Array.from({ length: Math.max(scoreRound?.questions.length ?? 0, 1) }, (_, index) => `<th>Q${index + 1}</th>`).join("");
    const rows = [...event.teams]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((team) => `<tr><td>${escapeHtml(team.name)}</td><td>${escapeHtml(team.tableNumber || "")}</td>${Array.from({ length: Math.max(scoreRound?.questions.length ?? 0, 1) }, () => "<td></td>").join("")}<td></td></tr>`)
      .join("");

    openPrintableWindow(
      `${event.name} Score Sheet`,
      `<h1>${escapeHtml(event.name)} - Score Sheet</h1>
      <p class="meta">Round: ${escapeHtml(scoreRound?.title || "Not selected")}</p>
      <table>
        <thead><tr><th>Team</th><th>Table</th>${questionHeaders}<th>Total</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="${Math.max(scoreRound?.questions.length ?? 0, 1) + 3}">No teams configured.</td></tr>`}</tbody>
      </table>
      <div class="box"><strong>Scorekeeper Note:</strong> Last score action ${escapeHtml(live.lastScoreActionSummary || "None")}</div>`,
    );
  }

  return (
    <section className="space-y-4">
      <TriviaEventOpsHeader event={event} live={live} scoreHistory={scoreHistory} />

      <section className="border border-[#d1c7e8] bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b3f9b]">Print center</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Prepare paper backups before doors open</h2>
        <p className="mt-1 text-sm text-slate-600">Each action opens a print-ready page. Keep the host packet and a manual score sheet at the scorer table.</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={printHostPacket} className="border border-[#d1c7e8] bg-white p-4 text-left hover:border-[#5b3f9b] hover:bg-[#f6f2ff]">
          <p className="text-[11px] uppercase tracking-wide text-[#5b3f9b]">Operations Packet</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Print Host Packet</h2>
          <p className="mt-1 text-sm text-slate-600">Round-by-round prompts with scoring answers and speaking flow notes.</p>
        </button>

        <button type="button" onClick={printAnswerKey} className="border border-[#d1c7e8] bg-white p-4 text-left hover:border-[#5b3f9b] hover:bg-[#f6f2ff]">
          <p className="text-[11px] uppercase tracking-wide text-[#5b3f9b]">Judge Packet</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Print Answer Key</h2>
          <p className="mt-1 text-sm text-slate-600">Private accepted answers and alternates by question.</p>
        </button>

        <button type="button" onClick={printCheckInRoster} className="border border-[#d1c7e8] bg-white p-4 text-left hover:border-[#5b3f9b] hover:bg-[#f6f2ff]">
          <p className="text-[11px] uppercase tracking-wide text-[#5b3f9b]">Front Desk</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Print Check-In Roster</h2>
          <p className="mt-1 text-sm text-slate-600">Expected teams with captain, table, status, and contact notes.</p>
        </button>

        <div className="border border-[#d1c7e8] bg-[#f6f2ff] p-4"><p className="text-[11px] uppercase tracking-wide text-[#5b3f9b]">Scoring Backup</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Print Manual Score Sheet</h2><p className="mt-1 text-sm text-slate-600">A paper fallback with one column for every question in the chosen round.</p><label className="mt-3 block text-xs font-semibold text-slate-700">Round<select value={scoreRoundId} onChange={(input) => setScoreRoundId(input.target.value)} className="mt-1 h-9 w-full border border-[#a99ad0] bg-white px-2 text-sm">{event.rounds.map((round) => <option key={round.id} value={round.id}>{round.title} · {round.questions.length} questions</option>)}</select></label><button type="button" onClick={printScoreSheet} className="mt-3 w-full bg-[#5b3f9b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4a327f]">Print selected score sheet</button></div>
      </div>
    </section>
  );
}

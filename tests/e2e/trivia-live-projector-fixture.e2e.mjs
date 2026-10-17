// Real host and projector components using one local event-scoped API fixture.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = require(createRequire(require.resolve("tsx")).resolve("esbuild"));
const postcss = require(createRequire(require.resolve("@tailwindcss/postcss")).resolve("postcss"));
const tailwind = require("@tailwindcss/postcss");
const root = process.cwd();
const css = (await postcss([tailwind({ base: root })]).process(await readFile("app/globals.css", "utf8"), { from: path.join(root, "app/globals.css") })).css;
const bundle = await build({
  stdin: { resolveDir: root, loader: "tsx", contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import HostControlPanel from './app/components/trivia/HostControlPanel';
    import TriviaLiveProjector from './app/components/trivia/TriviaLiveProjector';
    import {useTriviaLiveEvent} from './app/apps/trivia/hooks/useTriviaLiveEvent';
    import {createSampleTriviaEvent} from './app/apps/trivia/lib/trivia-sample-data';
    import {createDefaultLiveState} from './app/apps/trivia/lib/trivia-demo-data';
    function Host() {
      const event=React.useMemo(()=>{const value=createSampleTriviaEvent('live-fixture');value.id='live-fixture';value.name='Live Fixture';value.displaySettings.showTimerOnQuestion=true;value.rounds=[{id:'round-1',title:'Round One',description:'',roundType:'normal',questions:[{id:'question-1',prompt:'Which planet is known as the Red Planet?',options:['Earth','Mars'],questionType:'text',scoringAnswer:'Mars',audienceAnswer:'Mars',acceptedAnswers:[],explanation:'Mars appears red.',revealText:'Mars',points:10,timeLimitSec:30,hostNotes:'Private note'},{id:'question-2',prompt:'Second fixture question',options:[],questionType:'text',scoringAnswer:'Two',audienceAnswer:'Two',acceptedAnswers:[],explanation:'',revealText:'',points:10,timeLimitSec:30,hostNotes:''}]}];value.teams=[];value.updatedAt=new Date().toISOString();return value},[]);
      const liveState=useTriviaLiveEvent('live-fixture');
      const live=liveState.snapshot?.live ?? createDefaultLiveState(event);
      const send=(action,payload)=>{void liveState.sendCommand(action,payload)};
      return <main className="trivia-admin-content bg-slate-950 p-4 text-white"><HostControlPanel event={event} live={live}
        connectionStatus={liveState.connectionStatus} serverSyncEnabled saving={liveState.saving} saveError={liveState.error}
        onRetrySync={()=>void liveState.refresh()} onProjectorOpened={()=>send('projector_opened')}
        onNextQuestion={()=>send('next_question')} onPreviousQuestion={()=>send('previous_question')}
        onSetRound={roundId=>send('set_round',{roundId})} onSetStage={stage=>send('set_stage',{stage})}
        onShowWinner={()=>{}} onSetTimerRunning={running=>send(running?'timer_start':'timer_pause')}
        onResetTimer={()=>send('timer_reset')} /></main>;
    }
    function App() { return location.pathname==='/host' ? <Host/> : <TriviaLiveProjector eventId="live-fixture"/> }
    createRoot(document.getElementById('root')).render(<App/>);` },
  bundle: true, write: false, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": JSON.stringify("development"), "process.env.NEXT_PUBLIC_API_URL": JSON.stringify("http://127.0.0.1:4000") },
});

const fixture = {
  event: {
    id: "live-fixture", name: "Live Fixture", venue: "Local test", hostName: "Host", startAt: new Date().toISOString(),
    status: "live", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rounds: [{ id: "round-1", title: "Round One", description: "", roundType: "normal", questions: [
      { id: "question-1", prompt: "Which planet is known as the Red Planet?", options: ["Earth", "Mars"], questionType: "text", scoringAnswer: "Mars", audienceAnswer: "Mars", acceptedAnswers: [], explanation: "Mars appears red.", revealText: "Mars", points: 10, timeLimitSec: 30, hostNotes: "Private note" },
      { id: "question-2", prompt: "Second fixture question", options: [], questionType: "text", scoringAnswer: "Two", audienceAnswer: "Two", acceptedAnswers: [], explanation: "", revealText: "", points: 10, timeLimitSec: 30, hostNotes: "" },
    ] }], teams: [], scoringRules: { defaultQuestionPoints: 10, allowPartialCredit: true, allowNegativeScores: false, finalWagerEnabled: true, tieBreakerMode: "single_question" }, displaySettings: { highContrast: true, showTeamColors: true, showTimerOnQuestion: true, defaultStage: "welcome" },
  },
  live: { activeRoundId: "round-1", activeQuestionIndex: 0, stage: "welcome", timerDefaultSec: 30, timerRemainingSec: 30, timerRunning: false, timerEndsAt: null, leaderboardVisible: false, answerRevealed: false, displayOpenedAt: null, winnerTeamId: null, lastHostAction: "Ready", updatedAt: new Date().toISOString() },
  scoreHistory: [],
  revision: 1,
};
const requests = [];
function currentSnapshot() {
  const now = new Date();
  let live = { ...fixture.live };
  if (live.timerRunning && live.timerEndsAt) {
    const remaining = Math.max(0, Math.ceil((Date.parse(live.timerEndsAt) - now.getTime()) / 1000));
    live = { ...live, timerRemainingSec: remaining, timerRunning: remaining > 0, timerEndsAt: remaining > 0 ? live.timerEndsAt : null };
  }
  return { event: fixture.event, live, scoreHistory: fixture.scoreHistory, revision: String(fixture.revision), serverNow: now.toISOString() };
}
function sendJson(res, body, status = 200) { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-cache" }); res.end(JSON.stringify(body)); }
const server = createServer(async (req, res) => {
  if (req.url === "/app.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); res.end(bundle.outputFiles[0].text); return; }
  if (req.url === "/app.css") { res.writeHead(200, { "Content-Type": "text/css" }); res.end(css); return; }
  if (req.url === "/api/apps/trivia/events/live-fixture/live" && req.method === "GET") {
    requests.push({ method: "GET", url: req.url });
    const snapshot = currentSnapshot();
    const etag = `"${snapshot.revision}"`;
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) { res.writeHead(304); res.end(); return; }
    sendJson(res, snapshot); return;
  }
  if (req.url === "/api/apps/trivia/events/live-fixture/live" && req.method === "PATCH") {
    requests.push({ method: "PATCH", url: req.url });
    let raw = ""; for await (const chunk of req) raw += chunk;
    const command = JSON.parse(raw);
    if (command.expectedRevision !== String(fixture.revision)) { sendJson(res, { error: { message: "conflict" } }, 409); return; }
    const now = new Date();
    if (command.action === "set_stage") fixture.live.stage = command.payload.stage;
    if (command.action === "set_question") { fixture.live.activeQuestionIndex = command.payload.questionIndex; fixture.live.stage = "question"; fixture.live.timerRemainingSec = fixture.event.rounds[0].questions[command.payload.questionIndex].timeLimitSec; fixture.live.timerEndsAt = null; fixture.live.timerRunning = false; }
    if (command.action === "next_question") { fixture.live.activeQuestionIndex = Math.min(1, fixture.live.activeQuestionIndex + 1); fixture.live.stage = "question"; fixture.live.timerRemainingSec = 30; fixture.live.timerRunning = false; fixture.live.timerEndsAt = null; }
    if (command.action === "previous_question") { fixture.live.activeQuestionIndex = Math.max(0, fixture.live.activeQuestionIndex - 1); fixture.live.stage = "question"; }
    if (command.action === "set_round") { fixture.live.activeRoundId = command.payload.roundId; fixture.live.activeQuestionIndex = 0; fixture.live.stage = "round_intro"; }
    if (command.action === "timer_start") { fixture.live.timerRunning = true; fixture.live.timerEndsAt = new Date(now.getTime() + fixture.live.timerRemainingSec * 1000).toISOString(); }
    if (command.action === "timer_pause") { fixture.live = { ...currentSnapshot().live, timerRunning: false, timerEndsAt: null }; }
    if (command.action === "timer_reset") { fixture.live.timerRunning = false; fixture.live.timerEndsAt = null; fixture.live.timerRemainingSec = 30; }
    if (command.action === "projector_opened") fixture.live.displayOpenedAt = now.toISOString();
    fixture.live.updatedAt = now.toISOString(); fixture.revision += 1;
    sendJson(res, currentSnapshot()); return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const host = await context.newPage();
  const projector = await context.newPage();
  host.on("pageerror", error => errors.push(`host: ${error.message}`));
  projector.on("pageerror", error => errors.push(`projector: ${error.message}`));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await Promise.all([host.goto(`${origin}/host`), projector.goto(`${origin}/projector`)]);
  try { await host.getByRole("button", { name: "Show question", exact: true }).waitFor({ timeout: 7_000 }); }
  catch (error) { console.error("Host fixture did not load:", await host.locator("#root").innerText(), errors); throw error; }
  await projector.getByRole("heading", { name: "Live Fixture", exact: true }).waitFor();
  const start = Date.now();
  await host.getByRole("button", { name: "Show question", exact: true }).click();
  await projector.getByText("Which planet is known as the Red Planet?", { exact: true }).waitFor();
  const updateLatencyMs = Date.now() - start;
  assert.equal(await projector.getByRole("heading", { name: "Question 1", exact: true }).count(), 1);
  assert.equal(await projector.getByText("Private note", { exact: true }).count(), 0);
  assert.equal(await projector.getByText("Mars appears red.", { exact: true }).count(), 0);
  await host.close();
  async function showStage(stage) {
    fixture.live.stage = stage;
    fixture.live.updatedAt = new Date().toISOString();
    fixture.revision += 1;
    if (stage === "blank") await projector.getByRole("main", { name: "Projector intentionally blank" }).waitFor();
    else await projector.locator(`[data-stage="${stage}"]`).waitFor();
  }
  for (const stage of ["check_in_open", "check_in_closed", "round_intro", "break", "final_question", "tiebreaker", "leaderboard", "answer", "explanation", "winner", "blank"]) {
    await showStage(stage);
    if (stage === "answer") assert.equal(await projector.getByText("Mars appears red.", { exact: true }).count(), 0);
    if (stage === "explanation") await projector.getByText("Mars appears red.", { exact: true }).waitFor();
    if (stage === "winner") {
      await projector.getByRole("heading", { name: "Results coming soon" }).waitFor();
      assert.equal(await projector.locator(".trivia-projector-confetti").count(), 0);
    }
  }
  fixture.event.teams = [
    { id: "team-1", name: "Team One", score: 20, active: true, players: [], sortOrder: 0 },
    { id: "team-2", name: "Team Two", score: 20, active: true, players: [], sortOrder: 1 },
  ];
  await showStage("winner");
  await projector.getByRole("heading", { name: "A tie to settle" }).waitFor();
  await showStage("leaderboard");
  assert.deepEqual(await projector.locator(".trivia-projector-ranking > span").allTextContents(), ["1", "1"]);
  fixture.event.teams[0].score = 30;
  await showStage("winner");
  await projector.getByRole("heading", { name: "Team One", exact: true }).waitFor();
  assert.equal(await projector.locator(".trivia-projector-confetti i").count(), 18);
  await projector.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await projector.locator(".trivia-projector-confetti").evaluate(el => getComputedStyle(el).display), "none");
  await projector.setViewportSize({ width: 1920, height: 1080 });
  await projector.screenshot({ path: "node_modules/.cache/trivia-projector-winner.png" });
  fixture.live.activeQuestionIndex = 99;
  await showStage("question");
  await projector.getByRole("heading", { name: "Next question coming up" }).waitFor();
  assert.ok(updateLatencyMs < 2_000, `projector update should be visible within poll bound; got ${updateLatencyMs}ms`);
  assert.equal(requests.some(({ url }) => url.includes("/state")), false);
  assert.equal(requests.filter(({ method }) => method === "PATCH").length, 1, "show-question saves once; projector state reads never write");
  assert.deepEqual(errors, []);
  console.log(`PASS Trivia projector: all audience stages, separate explanation reveal, pending and tied results, winner celebration, tied rankings, missing-question fallback, reduced motion; no page errors. Initial update: ${updateLatencyMs}ms.`);

} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

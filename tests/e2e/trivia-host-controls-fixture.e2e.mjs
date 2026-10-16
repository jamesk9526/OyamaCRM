// Real host controls with deterministic local state; no database or external writes.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = require(createRequire(require.resolve("tsx")).resolve("esbuild"));
const postcss = require(createRequire(require.resolve("@tailwindcss/postcss")).resolve("postcss"));
const tailwind = require("@tailwindcss/postcss");
const root = process.cwd();
const output = path.join(root, "docs/status/audit-artifacts/2026-10-16-trivia-host");
const css = (await postcss([tailwind({ base: root })]).process(await readFile("app/globals.css", "utf8"), { from: path.join(root, "app/globals.css") })).css;
const bundle = await build({
  stdin: { resolveDir: root, loader: "tsx", contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import Host from './app/components/trivia/HostControlPanel';
    import {createSampleTriviaEvent} from './app/apps/trivia/lib/trivia-sample-data';
    import {createDefaultLiveState} from './app/apps/trivia/lib/trivia-demo-data';
    function Fixture() {
      const [event,setEvent] = useState(() => {
        const event=createSampleTriviaEvent('host-fixture');
        event.teams.forEach(team => {team.active=true;team.score=0});
        event.rounds[0].questions[0].hostNotes='Read slowly; accept the short name.';
        event.rounds[0].questions.push({...event.rounds[0].questions[0],id:'second-question',prompt:'Second question'});
        return event;
      });
      const [live,setLive]=useState(()=>createDefaultLiveState(event));
      const [connected,setConnected]=useState(true);
      const update=patch=>setLive(previous=>({...previous,...patch}));
      return <main className="trivia-admin-content bg-slate-950 p-4 text-white">
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={()=>setEvent(previous=>({...previous,teams:previous.teams.map((team,i)=>({...team,score:i===0?10:0}))}))}>Fixture unique leader</button>
          <button onClick={()=>update({activeQuestionIndex:live.activeQuestionIndex+1})}>Fixture external question</button>
          <button onClick={()=>setConnected(false)}>Fixture disconnect</button>
          <button onClick={()=>setEvent(previous=>({...previous,rounds:previous.rounds.map(round=>({...round,questions:[]}))}))}>Fixture empty rounds</button>
        </div>
        <output aria-label="Fixture stage">{live.stage}</output>
        <Host event={event} live={live} connectionStatus={connected?'connected':'offline'} serverSyncEnabled
          onNextQuestion={()=>update({activeQuestionIndex:live.activeQuestionIndex+1})}
          onPreviousQuestion={()=>update({activeQuestionIndex:live.activeQuestionIndex-1})}
          onSetRound={id=>update({activeRoundId:id,activeQuestionIndex:0,stage:'round_intro'})}
          onSetStage={stage=>update({stage,answerRevealed:stage==='answer'})}
          onShowWinner={()=>update({stage:'winner'})}
          onSetTimerRunning={timerRunning=>update({timerRunning})}
          onResetTimer={()=>update({timerRemainingSec:30,timerRunning:false})}
          onTickTimer={timerRemainingSec=>update({timerRemainingSec})}
          onProjectorOpened={()=>{}}
          onCreateCheckpoint={async()=>{throw new Error('Fixture checkpoint unavailable')}} />
      </main>
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);` },
  bundle: true, write: false, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
});
const server = createServer((req, res) => {
  if (req.url === "/app.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].text); }
  else if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1100 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const winner = page.getByRole("button", { name: "Final winner screen", exact: true });
  await winner.waitFor();
  assert.equal(await winner.isDisabled(), true);
  await page.getByText(/First place is tied:/).waitFor();
  await page.getByText("Host reference · answer and notes", { exact: true }).click();
  await page.getByText("Read slowly; accept the short name.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Fixture unique leader", exact: true }).click();
  assert.equal(await winner.isEnabled(), true);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1360, height: 1100 });
  await page.getByRole("button", { name: "Reveal Answer", exact: true }).click();
  await page.getByRole("button", { name: "Confirm Reveal Answer", exact: true }).waitFor();
  await page.getByRole("button", { name: "Fixture external question", exact: true }).click();
  await page.getByRole("button", { name: "Reveal Answer", exact: true }).waitFor();
  await page.getByRole("button", { name: "Reveal Answer", exact: true }).click();
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "welcome");
  await page.getByRole("button", { name: "Confirm Reveal Answer", exact: true }).click();
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "answer");
  await page.getByRole("button", { name: "Save safety checkpoint", exact: true }).click();
  await page.getByText("Fixture checkpoint unavailable", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Emergency hold", exact: true }).click();
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "blank");
  await page.getByRole("button", { name: "Fixture empty rounds", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Question", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Fixture disconnect", exact: true }).click();
  assert.equal(await page.getByRole("combobox", { name: "Active round" }).isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log("PASS trivia host fixture: tied winner, private notes, stale confirmation, answer reveal, checkpoint error, emergency hold, empty round, disconnected controls, mobile overflow, zero page errors.");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

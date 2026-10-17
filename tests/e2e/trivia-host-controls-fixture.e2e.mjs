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
const output = process.env.TRIVIA_HOST_ARTIFACT_DIR || path.join(root, "docs/status/audit-artifacts/2026-10-16-trivia-simplification");
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
        event.rounds[0].questions.push({...event.rounds[0].questions[0],id:'third-question',prompt:'Third question'});
        return event;
      });
      const [live,setLive]=useState(()=>createDefaultLiveState(event));
      const [connected,setConnected]=useState(true);
      const [saving,setSaving]=useState(false);
      const [saveError,setSaveError]=useState('');
      const update=patch=>setLive(previous=>({...previous,...patch}));
      return <main className="trivia-admin-content bg-slate-950 p-4 text-white">
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={()=>setEvent(previous=>({...previous,teams:previous.teams.map((team,i)=>({...team,score:i===0?10:0}))}))}>Fixture unique leader</button>
          <button onClick={()=>setEvent(previous=>({...previous,teams:previous.teams.map((team,i)=>({...team,score:i===1?20:0}))}))}>Fixture change leader</button>
          <button onClick={()=>update({activeQuestionIndex:live.activeQuestionIndex+1,stage:'question',timerRunning:false,timerRemainingSec:30,timerEndsAt:null})}>Fixture external question</button>
          <button onClick={()=>setConnected(false)}>Fixture disconnect</button>
          <button onClick={()=>setSaving(previous=>!previous)}>Fixture toggle saving</button>
          <button onClick={()=>setSaveError('Fixture save unavailable')}>Fixture failed save</button>
          <button onClick={()=>setEvent(previous=>({...previous,rounds:previous.rounds.map(round=>({...round,questions:[]}))}))}>Fixture empty rounds</button>
        </div>
        <output aria-label="Fixture stage">{live.stage}</output>
        <Host event={event} live={live} connectionStatus={connected?'connected':'offline'} serverSyncEnabled saving={saving} saveError={saveError} onRetrySync={()=>setSaveError('')}
          onNextQuestion={()=>update({activeQuestionIndex:live.activeQuestionIndex+1,stage:'question',timerRunning:false,timerRemainingSec:30,timerEndsAt:null})}
          onPreviousQuestion={()=>update({activeQuestionIndex:live.activeQuestionIndex-1,stage:'question',timerRunning:false,timerRemainingSec:30,timerEndsAt:null})}
          onSetRound={id=>update({activeRoundId:id,activeQuestionIndex:0,stage:'round_intro'})}
          onSetStage={stage=>update({stage,answerRevealed:stage==='answer',...(!['question','timer_only','final_question','tiebreaker'].includes(stage)?{timerRunning:false,timerEndsAt:null}:{})})}
          onShowWinner={()=>update({stage:'winner'})}
          onSetTimerRunning={timerRunning=>update({timerRunning,timerRemainingSec:live.timerEndsAt?Math.max(0,Math.ceil((Date.parse(live.timerEndsAt)-Date.now())/1000)):live.timerRemainingSec,timerEndsAt:timerRunning?new Date(Date.now()+live.timerRemainingSec*1000).toISOString():null})}
          onResetTimer={(seconds=30)=>update({timerDefaultSec:seconds,timerRemainingSec:seconds,timerRunning:false,timerEndsAt:null})}
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
  await page.clock.install();
  await page.getByRole("button", { name: "Show question", exact: true }).waitFor();
  await page.getByText("Selected question · not on display", { exact: true }).waitFor();
  const questionNav = page.getByRole("group", { name: "Question navigation" });
  assert.equal(await questionNav.getByRole("button", { name: "Previous question", exact: true }).isDisabled(), true);
  assert.equal(await questionNav.getByRole("button", { name: "Next question", exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole("button", { name: "Final winner screen", exact: true }).isVisible(), false);
  await page.getByText("More display controls", { exact: true }).click();
  const winner = page.getByRole("button", { name: "Final winner screen", exact: true });
  await winner.waitFor();
  assert.equal(await winner.isDisabled(), true);
  await page.getByText(/First place is tied:/).waitFor();
  await page.getByText("Host reference · answer and notes", { exact: true }).click();
  await page.getByText("Read slowly; accept the short name.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Fixture unique leader", exact: true }).click();
  assert.equal(await winner.isEnabled(), true);
  await winner.click();
  await page.getByRole("button", { name: "Confirm winner screen", exact: true }).waitFor();
  await page.getByRole("button", { name: "Fixture change leader", exact: true }).click();
  await page.getByRole("button", { name: "Final winner screen", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "welcome");
  await page.getByText("More display controls", { exact: true }).click();
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1360, height: 1100 });
  const showQuestion = page.getByRole("button", { name: "Show question", exact: true });
  await showQuestion.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "question");
  const audiencePreview = page.getByRole("region", { name: "Audience preview" });
  await audiencePreview.getByText(/Question 1 of/).waitFor();
  await audiencePreview.getByText("What the audience sees", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /timer/i }).count(), 0);
  await page.getByRole("button", { name: "Reveal answer", exact: true }).click();
  await page.getByRole("button", { name: "Confirm reveal answer", exact: true }).waitFor();
  await page.getByRole("button", { name: "Fixture external question", exact: true }).click();
  await page.getByRole("button", { name: "Reveal answer", exact: true }).waitFor();
  await questionNav.getByRole("button", { name: "Next question", exact: true }).click();
  await questionNav.getByRole("button", { name: "Confirm next", exact: true }).click();
  assert.equal(await page.getByText("3 / 3", { exact: true }).count(), 1);
  await questionNav.getByRole("button", { name: "Previous question", exact: true }).click();
  await questionNav.getByRole("button", { name: "Confirm previous", exact: true }).click();
  assert.equal(await page.getByText("2 / 3", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Reveal answer", exact: true }).click();
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "question");
  await page.getByRole("button", { name: "Confirm reveal answer", exact: true }).click();
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "answer");
  await audiencePreview.getByText(/^Correct answer:/).first().waitFor();
  await page.getByRole("button", { name: "Next question", exact: true }).last().click();
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "question");
  await page.getByRole("button", { name: "Fixture failed save", exact: true }).click();
  await page.getByText("Fixture save unavailable", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry game sync", exact: true }).click();
  assert.equal(await page.getByText("Fixture save unavailable", { exact: true }).count(), 0);
  await page.getByText("Round navigation and recovery", { exact: true }).click();
  await page.getByRole("button", { name: "Save safety checkpoint", exact: true }).click();
  await page.getByText("Fixture checkpoint unavailable", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Emergency hold", exact: true }).click();
  assert.equal(await page.getByLabel("Fixture stage").textContent(), "blank");
  await page.getByRole("button", { name: "Fixture toggle saving", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Show question", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Emergency hold", exact: true }).isEnabled(), true);
  await page.getByRole("button", { name: "Fixture toggle saving", exact: true }).click();
  await page.getByRole("button", { name: "Fixture empty rounds", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Add questions to begin", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Fixture disconnect", exact: true }).click();
  assert.equal(await page.getByRole("combobox", { name: "Active round" }).isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log("PASS trivia host fixture: guided flow, selected and audience-visible question previews with round/question numbering, answer reveal preview, keyboard show question, retired timer absence, hidden secondary controls, tied winner and changed-leader confirmation, private notes, stale confirmation, save/retry and checkpoint errors, emergency hold, saving guard, empty round, offline controls, 320px overflow, zero page errors.");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

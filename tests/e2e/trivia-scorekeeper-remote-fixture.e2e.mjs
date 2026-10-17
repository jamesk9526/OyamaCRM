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
const output = path.join(root, "node_modules/.cache/phone-scorekeeper");
const css = (await postcss([tailwind({ base: root })]).process(await readFile("app/globals.css", "utf8"), { from: path.join(root, "app/globals.css") })).css;
const bundle = await build({
  stdin: { resolveDir: root, loader: "tsx", contents: "\n    import React from 'react';\n    import {createRoot} from 'react-dom/client';\n    import Remote from './app/components/trivia/TriviaRemoteController';\n    import {createSampleTriviaEvent} from './app/apps/trivia/lib/trivia-sample-data';\n    import {createDefaultLiveState} from './app/apps/trivia/lib/trivia-demo-data';\n    import {resolveRemoteScore} from './server/src/services/trivia-score-control';\n    const event=createSampleTriviaEvent('phone-fixture');\n    event.rounds[0].questions[0].hostNotes='Private host note';\n    event.rounds[0].questions.push({...event.rounds[0].questions[0],id:'second',prompt:'Second phone question'});\n    event.live=createDefaultLiveState(event);\n    let revision=1;\n    window.fixture={event,actions:[]};\n    window.fetch=async(url,options={})=>{\n      const body=options.body?JSON.parse(options.body):{};\n      if(String(url).endsWith('/claim')) return new Response(JSON.stringify({eventId:event.id,accessToken:'fixture'}));\n      if(String(url).endsWith('/actions')) {\n        window.fixture.actions.push(body);\n        const team=event.teams.find(t=>t.id===body.payload.teamId);const result=resolveRemoteScore(team.score,body.payload,false);\n        if(!result.ok) return new Response(JSON.stringify({error:{message:result.message}}),{status:400});\n        if(body.expectedRevision!==String(revision)) return new Response(JSON.stringify({error:{message:'Game changed'}}),{status:409});\n        team.score=result.nextScore;revision++;\n        return new Response(JSON.stringify({event,revision:String(revision)}));\n      }\n      return new Response(JSON.stringify({event,revision:String(revision),role:'scorekeeper',label:'Host',expiresAt:'2099-01-01'}));\n    };\n    createRoot(document.getElementById('root')).render(<Remote eventId={event.id}/>);\n" },
  plugins: [{name:"fixture-navigation", setup(build) { build.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"})); build.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export const useSearchParams=()=>new URLSearchParams(window.location.search);",loader:"js"})); }}],
  bundle: true, write: false, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": JSON.stringify("development"), "process.env": "{}" },
});
const server = createServer((req, res) => {
  if (req.url === "/app.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].text); }
  else if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}) }).catch(error=>{server.close();throw error;});

try {
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByLabel('Four-digit code').fill('1234');await page.getByRole('button',{name:'Connect to event',exact:true}).click();
 const total=page.getByLabel(/Custom total for/).first();
 await total.fill('42');await total.locator('..').locator('..').getByRole('button',{name:'Set total',exact:true}).click();
 await page.getByText('42 points',{exact:true}).waitFor();
 const row=page.getByText('42 points',{exact:true}).locator('..').locator('..');
 await row.getByRole('button',{name:'+1',exact:true}).click();await page.getByText('43 points',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.fixture.actions[0].payload.total),42);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS phone scorekeeper: custom total, one-point increment, server acknowledgement, mobile width; no page errors.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}

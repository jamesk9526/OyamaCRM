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
const output = path.join(root, "docs/status/audit-artifacts/2026-10-17-phone-remote");
const css = (await postcss([tailwind({ base: root })]).process(await readFile("app/globals.css", "utf8"), { from: path.join(root, "app/globals.css") })).css;
const bundle = await build({
  stdin: { resolveDir: root, loader: "tsx", contents: "\n    import React from 'react';\n    import {createRoot} from 'react-dom/client';\n    import Remote from './app/components/trivia/TriviaRemoteController';\n    import {createSampleTriviaEvent} from './app/apps/trivia/lib/trivia-sample-data';\n    import {createDefaultLiveState} from './app/apps/trivia/lib/trivia-demo-data';\n    import {applyRemoteTriviaHostAction} from './server/src/services/trivia-host-control';\n    const event=createSampleTriviaEvent('phone-fixture');\n    event.rounds[0].questions[0].hostNotes='Private host note';\n    event.rounds[0].questions.push({...event.rounds[0].questions[0],id:'second',prompt:'Second phone question'});\n    event.live=createDefaultLiveState(event);\n    let revision=1;\n    window.fixture={event,actions:[]};\n    window.fetch=async(url,options={})=>{\n      const body=options.body?JSON.parse(options.body):{};\n      if(String(url).endsWith('/claim')) return new Response(JSON.stringify({eventId:event.id,accessToken:'fixture'}));\n      if(String(url).endsWith('/actions')) {\n        window.fixture.actions.push(body);\n        const result=applyRemoteTriviaHostAction(event,event.live,body.action,body.payload,new Date().toISOString());\n        if(!result.ok) return new Response(JSON.stringify({error:{message:result.message}}),{status:400});\n        if(body.expectedRevision!==String(revision)) return new Response(JSON.stringify({error:{message:'Game changed'}}),{status:409});\n        event.live=result.live;revision++;\n        return new Response(JSON.stringify({event,revision:String(revision)}));\n      }\n      return new Response(JSON.stringify({event,revision:String(revision),role:'host',label:'Host',expiresAt:'2099-01-01'}));\n    };\n    createRoot(document.getElementById('root')).render(<Remote eventId={event.id}/>);\n" },
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
 const page=await browser.newPage({viewport:{width:320,height:844}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',m=>{if(m.type()==='error')console.error(m.text())});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByLabel('Four-digit code').fill('1234');
 await page.getByRole('button',{name:'Connect to event',exact:true}).click();
 await page.getByRole('button',{name:'Next question',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/timer/i}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Previous round',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Next round',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.fixture.actions.length),0);
 await page.getByRole('button',{name:'Confirm next round',exact:true}).click();
 await page.waitForFunction(()=>window.fixture.event.live.activeRoundId===window.fixture.event.rounds[1].id);
 await page.getByRole('button',{name:'Previous round',exact:true}).click();
 await page.getByRole('button',{name:'Confirm previous round',exact:true}).click();
 await page.waitForFunction(()=>window.fixture.event.live.activeRoundId===window.fixture.event.rounds[0].id);

 await page.getByText('Private answer & host notes',{exact:true}).click();
 await page.getByText('Private host note',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Next question',exact:true}).click();
 await page.getByRole('button',{name:'Confirm next question',exact:true}).click();
 await page.getByText('Second phone question',{exact:true}).waitFor();
 await page.getByRole('button',{name:/Change round/}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
 await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
 await page.getByRole('button',{name:'Confirm reveal answer',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.fixture.event.live.stage),'answer');
 assert.equal(await page.evaluate(()=>window.fixture.actions.every(x=>typeof x.expectedRevision==='string')),true);
 await page.getByRole('button',{name:'Emergency hold · blank projector',exact:true}).click();
 await page.waitForFunction(()=>window.fixture.event.live.stage==='blank');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await mkdir(output,{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 await page.getByText('Connection & access',{exact:true}).click();
 await page.getByRole('button',{name:'Disconnect / change code',exact:true}).click();
 await page.getByLabel('Four-digit code').waitFor();
 await page.goto(`http://127.0.0.1:${server.address().port}/?code=1234`);
 await page.getByRole('button',{name:'Next question',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Four-digit code').count(),0);
 assert.equal(new URL(page.url()).search,'');
 console.log('Phone remote: access, icons, manual reveal, navigation, dialog, revision, hold, reconnect, 320/390px passed');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }

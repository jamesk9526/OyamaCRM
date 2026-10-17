// Phone table/check-in regression fixture. Uses real components without external writes.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const { build } = require(createRequire(require.resolve("tsx")).resolve("esbuild"));
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import ScorekeepingPanel from './app/components/trivia/ScorekeepingPanel';
 import {useTriviaModuleState} from './app/apps/trivia/hooks/useTriviaModuleState';
 localStorage.setItem('oyama.trivia.sync.mode.v1','local');
 function Fixture(){const api=useTriviaModuleState();const event=api.state.events[0];
 if(!event)return <button onClick={()=>api.createSampleEvent()}>Create game</button>;
 return <><output aria-label="Team scores">{event.teams.map(t=>t.name+':'+t.score).join('|')}</output>
 <ScorekeepingPanel teams={event.teams} scoreHistory={api.state.scoreHistoryByEventId[event.id]||[]} defaultQuestionPoints={10} allowPartialCredit activeRoundId={null} activeQuestionId={null} onApplyScore={payload=>api.applyScoreAction(event.id,payload)} onUndoLast={()=>api.undoLastScoreAction(event.id)}/></>}
 createRoot(document.getElementById('root')).render(<Fixture/>);
`},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env':JSON.stringify({NODE_ENV:'development'})}});
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/app.js"></script>')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Create game',exact:true}).click();
 const total=page.getByLabel('Custom total',{exact:true});
 await total.fill('42');await page.getByRole('button',{name:'Set total',exact:true}).click();
 await page.getByText(/currently 42 points/).waitFor();
 await page.getByRole('button',{name:'+1 Point',exact:true}).click();await page.getByText(/currently 43 points/).waitFor();
 await page.getByRole('button',{name:'-1 Point',exact:true}).click();await page.getByText(/currently 42 points/).waitFor();
 await total.fill('7');await page.getByRole('button',{name:'Set total',exact:true}).click();await page.getByText(/currently 7 points/).waitFor();
 await page.getByRole('button',{name:'Undo Last Action',exact:true}).click();await page.getByText(/currently 42 points/).waitFor();
 await total.fill('0');await page.getByRole('button',{name:'Set total',exact:true}).click();await page.getByText(/currently 0 points/).waitFor();
 await page.getByRole('button',{name:'-1 Point',exact:true}).click();await page.getByText(/currently 0 points/).waitFor();
 for(const value of ['','-1','1.5','2147483648']){await total.fill(value);assert.equal(await page.getByRole('button',{name:'Set total',exact:true}).isDisabled(),true);}
 await page.reload();await page.getByText(/currently 42 points|currently 0 points/).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: +1/-1, custom total up/down/zero, undo, invalid inputs, local reload persistence and no page errors.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

// Phone table/check-in regression fixture. Uses real components without external writes.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const { build } = require(createRequire(require.resolve("tsx")).resolve("esbuild"));
const bundle = await build({
  stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {TableManagerRemote,TriviaCheckInRemote} from './app/components/trivia/TriviaTableRemote';
    import TeamManagerPanel from './app/components/trivia/TeamManagerPanel';
    import {createSampleTriviaEvent} from './app/apps/trivia/lib/trivia-sample-data';
    function Fixture(){
      const [teams,setTeams]=useState(()=>{const team=createSampleTriviaEvent('tables').teams[0];return [{...team,id:'team-one',name:'Alpha',tableNumber:'12',players:['Guest Searchable'],tableHostName:'Host Searchable',checkInStatus:'expected'}]});
      const [mode,setMode]=useState('tables');const [fail,setFail]=useState(false);const [last,setLast]=useState('');
      async function action(name,payload){setLast(JSON.stringify({name,payload}));if(fail)return false;
        if(name==='update_team')setTeams(previous=>previous.map(team=>team.id===payload.teamId?{...team,...payload}:team));
        if(name==='add_team')setTeams(previous=>[...previous,{...previous[0],...payload,id:'walkin',tableNumber:payload.tableNumber||'13'}]);
        if(name==='check_in')setTeams(previous=>previous.map(team=>team.id===payload.teamId?{...team,checkInStatus:payload.status||'checked_in'}:team));return true;
      }
      return <><nav><button onClick={()=>setMode('builder')}>Open team manager</button><button onClick={()=>setTeams(previous=>previous.map(team=>({...team})))}>Poll fresh objects</button><button onClick={()=>setFail(!fail)}>Toggle failure</button><button onClick={()=>setMode(mode==='tables'?'checkin':'tables')}>Switch mode</button><button onClick={()=>setTeams(previous=>previous.map(team=>({...team,checkInStatus:'late'})))}>Late arrival</button><button onClick={()=>setTeams([])}>Empty roster</button></nav><output aria-label="Last action">{last}</output>{mode==='builder'?<TeamManagerPanel teams={teams} onAddTeam={()=>{}} onRemoveTeam={()=>{}} onReorderTeam={()=>{}} onUpdateTeam={(id,updates)=>{if(fail)return {ok:false,error:'Table number already assigned.'};setTeams(previous=>previous.map(team=>team.id===id?{...team,...updates}:team));return {ok:true};}}/>:mode==='tables'?<TableManagerRemote teams={teams} busy={false} onAction={action}/>:<TriviaCheckInRemote teams={teams} busy={false} onAction={action}/>}</>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  ` },
  bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": JSON.stringify("development") },
});
const server = createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text);}
  else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#161126;color:white;font:16px sans-serif}input,textarea,select{display:block;width:100%;min-height:48px}button,summary{min-height:48px}article,form{margin:12px 0;padding:12px;border:1px solid #8067b7}output{display:block;overflow-wrap:anywhere}</style><div id="root"></div><script src="/app.js"></script>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.E2E_BROWSER_CHANNEL?{channel:process.env.E2E_BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByText('Edit table and guests',{exact:false}).click();
 const name=page.getByLabel('Team name',{exact:true});await name.fill('Edited Alpha');
 await page.getByRole('button',{name:'Poll fresh objects'}).click();assert.equal(await name.inputValue(),'Edited Alpha');
 await page.getByRole('button',{name:'Toggle failure'}).click();await page.getByRole('button',{name:'Save table and guests',exact:true}).click();
 assert.equal(await name.inputValue(),'Edited Alpha');await page.getByText('Not saved.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Toggle failure'}).click();await page.getByRole('button',{name:'Save table and guests',exact:true}).click();await page.getByText('Table and guests saved.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'+ Walk-in team',exact:true}).click();const walkin=page.locator('form').filter({has:page.getByRole('heading',{name:'Add walk-in team'})});
 await walkin.getByLabel('Team name',{exact:true}).fill('New team');await page.getByRole('button',{name:'Toggle failure'}).click();await walkin.getByRole('button',{name:'Add walk-in team',exact:true}).click();
 assert.equal(await walkin.getByLabel('Team name',{exact:true}).inputValue(),'New team');await page.getByText('Team not added.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Toggle failure'}).click();await walkin.getByRole('button',{name:'Add walk-in team',exact:true}).click();await page.getByText('Walk-in team added.',{exact:false}).waitFor();assert.equal(await page.getByRole('heading',{name:'Add walk-in team'}).count(),0);
 await page.getByRole('button',{name:'Switch mode'}).click();const search=page.getByRole('searchbox');await search.fill('Guest Searchable');assert.equal(await page.getByRole('button',{name:'Check in table',exact:true}).count(),1);
 await search.fill('12');await page.getByRole('button',{name:'Check in table',exact:true}).click();await page.getByText('✓ Arrived',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Undo accidental check-in'}).click();await page.getByRole('button',{name:'Confirm undo check-in'}).click();await page.getByRole('button',{name:'Check in table',exact:true}).waitFor();assert.match(await page.getByLabel('Last action').innerText(),/"status":"expected"/);
 await page.getByRole('button',{name:'Late arrival'}).click();assert.equal(await page.getByRole('button',{name:'Check in table',exact:true}).count(),0);
 await search.fill('missing');await page.getByText('No matching teams.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Open team manager'}).click();
 const number=page.getByLabel('Table number for Edited Alpha',{exact:true});await number.fill('45');
 await page.getByRole('button',{name:'Poll fresh objects'}).click();assert.equal(await number.inputValue(),'45');
 await page.getByRole('button',{name:'Toggle failure'}).click();
 await number.locator('..').locator('..').getByRole('button',{name:'Apply table number'}).click();
 await page.getByRole('alert').filter({hasText:'Table number already assigned.'}).waitFor();assert.equal(await number.inputValue(),'45');
 await page.getByRole('button',{name:'Toggle failure'}).click();
 await number.locator('..').locator('..').getByRole('button',{name:'Apply table number'}).click();
 assert.equal(await number.inputValue(),'45');assert.equal(await number.locator('..').locator('..').getByRole('button',{name:'Apply table number'}).isDisabled(),true);
 await page.getByPlaceholder('Search teams by name, player, or table number').fill('45');assert.equal(await page.locator('article').count(),1);
 await page.getByRole('button',{name:'Switch mode'}).click();await page.getByRole('button',{name:'Switch mode'}).click();
 await page.getByRole('button',{name:'Empty roster'}).click();await page.getByText('No teams registered yet.',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 console.log('PASS: phone drafts survive polling/failed saves; failed walk-ins retained; successful walk-ins clear; guest search, check-in/undo, late arrival, empty/search states; no runtime errors or horizontal overflow.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

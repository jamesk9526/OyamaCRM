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
const output = path.join(root, "docs/status/audit-artifacts/2026-10-17-stripe-reconciliation");
const css = (await postcss([tailwind({ base: root })]).process(await readFile("app/globals.css", "utf8"), { from: path.join(root, "app/globals.css") })).css;
const bundle = await build({
 stdin: { resolveDir: root, loader: "tsx", contents: `
 import React from 'react'; import {createRoot} from 'react-dom/client';
 import Payments from './app/events/[eventId]/payments/page';
 window.fixture={result:'unpaid',checks:0,order:{id:'order-1',orderNumber:'EV-1',status:'PENDING',totalAmount:50,paymentMethod:'ONLINE',paidAt:null,createdAt:'2026-10-17',constituent:{firstName:'Fixture',lastName:'Guest'}}};
 window.fixtureApi=async(url,options)=>{
  if(url.endsWith('/check-stripe')) {window.fixture.checks++; if(window.fixture.result==='error')throw new Error('Stripe could not be reached. Try again.'); if(window.fixture.result==='paid')window.fixture.order={...window.fixture.order,status:'CONFIRMED',paidAt:'2026-10-17'}; return {message:window.fixture.result==='paid'?'Stripe payment verified.':'Stripe has not confirmed payment.'};}
  return [{...window.fixture.order}];
 };
 createRoot(document.getElementById('root')).render(<Payments/>);
 ` },
 plugins:[{name:'fixture',setup(build){
  build.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));
  build.onResolve({filter:/auth-client$/},()=>({path:'auth',namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='navigation'?"export const useParams=()=>({eventId:'event-1'});":"export const apiFetch=(...args)=>window.fixtureApi(...args);"}));
 }}],
 bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':JSON.stringify('development')},
});
const server = createServer((req, res) => {
  if (req.url === "/app.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].text); }
  else if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}) }).catch(error=>{server.close();throw error;});

try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const check=page.getByRole('button',{name:'Check Stripe payment',exact:true});
 await check.click();await page.getByRole('status').filter({hasText:'has not confirmed'}).waitFor();
 assert.equal(await check.count(),1);
 await page.evaluate(()=>window.fixture.result='error');await check.click();
 await page.getByRole('alert').filter({hasText:'could not be reached'}).waitFor();
 assert.equal(await check.isEnabled(),true);
 await page.evaluate(()=>window.fixture.result='paid');await check.click();
 await page.getByRole('status').filter({hasText:'verified'}).waitFor();
 await page.getByText('CONFIRMED',{exact:true}).waitFor();
 assert.equal(await check.count(),0);
 assert.equal(await page.evaluate(()=>window.fixture.checks),3);
 await mkdir(output,{recursive:true});await page.screenshot({path:path.join(output,'payments-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(output,'payments-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Stripe payment UI: unpaid, retry after failure, confirmed refresh, desktop/mobile passed');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}

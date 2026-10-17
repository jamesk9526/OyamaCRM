// Real React components with local API fixtures; never connects to an application database.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = require(createRequire(require.resolve("tsx")).resolve("esbuild"));
const postcss = require(createRequire(require.resolve("@tailwindcss/postcss")).resolve("postcss"));
const tailwind = require("@tailwindcss/postcss");
const root = process.cwd();
const out = path.join(root, "node_modules/.cache/event-table-merge");
const css = (await postcss([tailwind({ base: root })]).process(await readFile("app/globals.css", "utf8"), { from: path.join(root, "app/globals.css") })).css;
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import Guests from './app/events/guests/page'; import Tables from './app/events/tables/page';
    createRoot(document.getElementById('root')).render(location.pathname.endsWith('/tables') ? React.createElement(Tables) : React.createElement(Guests));`,
    resolveDir: root, loader: "tsx" },
  bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env": JSON.stringify({ NODE_ENV: "development", NEXT_PUBLIC_API_URL: "http://localhost:4000" }) },
  plugins: [{ name: "next-fixtures", setup(builder) {
    builder.onResolve({ filter: /^next\/(navigation|link)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: args.path.endsWith("navigation")
      ? `export const useParams=()=>({eventId:'selected-event'}); export const useSearchParams=()=>new URLSearchParams(); export const usePathname=()=>location.pathname; export const useRouter=()=>({replace:()=>{}});`
      : `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`, loader: "jsx", resolveDir: root }));
  } }],
});
const server = createServer((req, res) => {
  if (req.url === "/app.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].text); }
  else if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const event = { id: "selected-event", name: "Merge Night", active: true, startDate: "2026-11-01T18:00:00Z" };
let tables = [
 { id:"source", name:"Table Two", tableNumber:2, tableUid:"tbl_source", capacity:2, status:"OPEN", shape:"round", xPosition:20, yPosition:20, isSponsored:false },
 { id:"target", name:"Table Nine", tableNumber:9, tableUid:"tbl_target", capacity:2, status:"OPEN", shape:"round", xPosition:220, yPosition:20, isSponsored:false },
];
const guests=[{id:"paid",firstName:"Paid",lastName:"Guest",tableId:"source",seatId:"seat-source",checkedIn:true,paymentStatus:"PAID",orderId:"order-paid"},{id:"due",firstName:"Unpaid",lastName:"Guest",tableId:"target",seatId:"seat-target",checkedIn:false,paymentStatus:"DUE",orderId:"order-due"}];
const data=t=>({...t,guests:guests.filter(g=>g.tableId===t.id),_count:{guests:guests.filter(g=>g.tableId===t.id).length},seats:[],guestInvites:[]});
let fail=true;let merges=0;
await page.route("**/api/**",async route=>{
 const req=route.request(),url=new URL(req.url());
 const reply=(body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
 if(req.method()==="PATCH" && url.pathname.startsWith("/api/events/tables/")){const t=tables.find(t=>t.id===url.pathname.split("/").at(-1));Object.assign(t,req.postDataJSON());return reply(data(t));}
 if(url.pathname==="/api/events")return reply([event]);
 if(url.pathname.endsWith("/tables"))return reply(tables.map(data));
 if(url.pathname.endsWith("/guests"))return reply(guests);
 if(url.pathname.endsWith("/emails/logs"))return reply([]);
 if(url.pathname.includes("/tablelink/"))return reply(data(tables.find(t=>t.tableUid===url.pathname.split('/').at(-1))));
 if(req.method()==="POST"&&url.pathname==="/api/events/tables/source/merge"){
  merges++;assert.deepEqual(req.postDataJSON(),{targetTableId:"target",confirmed:true});
  if(fail)return reply({error:{message:"Seating changed. Refresh and retry."}},409);
  guests[0].tableId="target";tables[1].capacity=4;tables=tables.filter(t=>t.id!=="source");
  return reply({table:data(tables[0]),removedTableId:"source"});
 }
 throw new Error(`Unexpected fixture request ${req.method()} ${url.pathname}`);
});
try {
 await mkdir(out,{recursive:true});
 await page.goto(`${base}/events/selected-event/tables`);
 await page.getByRole("button",{name:/Table Two, 1 of 2 seats/}).dblclick();
 await page.getByRole("button",{name:"Merge tables",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Merge tables"});
 assert.equal(await dialog.getByRole("button",{name:"Confirm merge"}).isDisabled(),true);
 assert.equal(await dialog.getByLabel("Table to keep").locator('option[value="source"]').count(),0);
 await dialog.getByLabel("Table to keep").selectOption("target");
 await dialog.getByText("Keep Table 9. Remove Table 2.",{exact:false}).waitFor();
 await dialog.getByRole("button",{name:"Cancel",exact:true}).click();assert.equal(merges,0);
 await page.getByRole("button",{name:"Merge tables",exact:true}).click();
 await dialog.getByLabel("Table to keep").selectOption("target");
 await dialog.getByRole("button",{name:"Confirm merge"}).click();
 await dialog.getByRole("alert").waitFor();assert.equal(tables.length,2);
 assert.equal(await dialog.getByLabel("Table to keep").inputValue(),"target");
 await page.screenshot({path:path.join(out,"merge-review.png")});
 fail=false;
 await dialog.getByRole("button",{name:"Confirm merge"}).click();
 await page.getByRole("button",{name:/Table Nine, 2 of 4 seats/}).waitFor();
 assert.equal(await page.getByRole("button",{name:/Table Two, 1 of 2 seats/}).count(),0);
 assert.equal(guests.length,2);assert.equal(guests[0].paymentStatus,"PAID");assert.equal(guests[0].orderId,"order-paid");assert.equal(guests[1].paymentStatus,"DUE");
 assert.deepEqual(errors,[]);
 console.log("PASS: choose kept table, exclude source, cancel without writes, conflict/retry, source removed, guests and payment links retained; no browser errors.");
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}

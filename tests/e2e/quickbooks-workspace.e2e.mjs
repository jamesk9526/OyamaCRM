import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { installDonorWorkspaceFixtures } from "./fixtures/donor-daily-workspace.mjs";
const base = process.env.QUICKBOOKS_WEB_URL || "http://127.0.0.1:3000";
const evidence = "docs/status/audit-artifacts/2026-11-05-quickbooks";
await mkdir(evidence, {recursive:true});
const scenario=process.argv[2];
if (!scenario) {
 const results=[];
 for (const name of ["admin","staff","dashboard"]) {
  const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),name],{stdio:"inherit",env:process.env});
  assert.equal(result.status,0,`${name} browser scenario failed`);
  results.push(JSON.parse(await readFile(`${evidence}/browser-checks-${name}.json`,"utf8")));
 }
 await writeFile(`${evidence}/browser-checks.json`,JSON.stringify({data:"Synthetic browser-only fixtures; independent browser processes; no real accounting writes",checks:results.flatMap(result=>result.checks),errors:results.flatMap(result=>result.errors)},null,2));
 process.exit(0);
}

const browser = await chromium.launch({headless:true});
let context = await browser.newContext({viewport:{width:1440,height:1000}});
let page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [], checks = [], sends = [];
let connected = true, daily = false, role = "admin";
const gift = {id:"synthetic-gift",status:"PENDING",amount:25,customerName:"Sample donor",memo:"General support",attemptCount:0,createdAt:"2026-11-05T12:00:00Z",donation:{id:"synthetic-donation",amount:25,date:"2026-11-05",paymentMethod:"CHECK",constituent:{firstName:"Sample",lastName:"Donor"}}};
page.on("pageerror",error=>errors.push(error.stack || error.message));

page.on("dialog",dialog=>dialog.accept());
async function installFixtures(context) {
await context.route("**/api/**",route=>route.fulfill({json:{items:[],unreadCount:0}}));
await installDonorWorkspaceFixtures(context);
await context.route("**/api/**",async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,send=(json,status=200)=>route.fulfill({json,status});
 if(path==="/api/auth/refresh")return send({data:{accessToken:"synthetic-test-token"}});
 if(path==="/api/auth/me")return send({data:{id:"synthetic-user",organizationId:"synthetic-org",firstName:"Sample",lastName:"Staff",role,email:"sample@example.invalid"}});
 if(path==="/api/reports/new-donors")return send({items:[],total:0,totalPages:0});
 if(path==="/api/setup/status")return send({setupComplete:true});
 if(path==="/api/settings/workspaces")return send({donorEnabled:true,showModuleSwitcher:true,defaultWorkspace:"donor",donorNavigationLayout:"sidebar",donorAccentTone:"blue"});
 if(path==="/api/quickbooks/status")return send({data:{configured:true,enabled:true,connected,environment:"sandbox",timezone:"America/Chicago",dailySyncEnabled:daily,dailySyncHour:23,connectedAt:"2026-11-01T00:00:00Z",summary:{pending:gift.status==="PENDING"?1:0,failed:0,lastSuccessfulSync:gift.syncedAt??null}}});
 if(path==="/api/quickbooks/sync-queue"){const status=url.searchParams.get("status");return send({data:{items:!status||status===gift.status?[gift]:[],total:!status||status===gift.status?1:0}});}
 if(path==="/api/quickbooks/sync-queue/synthetic-gift/sync"){sends.push(gift.id);gift.status="SYNCED";gift.syncedAt=new Date().toISOString();gift.qbEntityId="synthetic-receipt";return send({data:{qbEntityId:gift.qbEntityId}});}
 if(path==="/api/quickbooks/settings"){daily=req.postDataJSON().sendingMode==="daily";return send({data:{sendingMode:daily?"daily":"manual"}});}
 if(path==="/api/quickbooks/activity")return send({data:{items:[{id:"synthetic-activity",action:"QB_SYNCED",entityId:gift.id,createdAt:"2026-11-05T15:00:00Z",user:{firstName:"Sample",lastName:"Staff"}}]}});
 if(path==="/api/quickbooks/auth-uri")return send({data:{authUri:"https://appcenter.intuit.com/connect/oauth2?synthetic-test=1"}});
 if(path==="/api/notifications/sse")return route.fulfill({contentType:"text/event-stream",body:""});
 return route.fallback();
});
}
await installFixtures(context);
try {
 if (scenario === "admin") {
 await page.goto(`${base}/quickbooks-sync`,{waitUntil:"networkidle",timeout:120000});
 await page.getByRole("heading",{name:"QuickBooks",exact:true}).waitFor();
 const welcome=page.getByRole("button",{name:"Got it, let’s get started"}); if(await welcome.count()) await welcome.click();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.getByRole("button",{name:"Donation sync",exact:true}).click();
  await page.getByText("Sample donor",{exact:true}).filter({visible:true}).waitFor();
  await page.screenshot({path:`${evidence}/workspace-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole("button",{name:"Connection & settings",exact:true}).click();
  await page.getByText("Sending preferences",{exact:true}).waitFor();
  await page.screenshot({path:`${evidence}/settings-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  checks.push(`Workspace and settings at ${width}px: no horizontal overflow`);
 }
 await page.getByRole("checkbox",{name:"Enable daily automatic sending"}).click();
 await page.waitForFunction(()=>document.querySelector("input[type=checkbox]:checked"));
 assert.equal(daily,true); checks.push("Administrator can opt into daily sending with confirmation");
 await page.getByRole("button",{name:"Donation sync",exact:true}).click();
 await page.getByRole("checkbox",{name:"Select all gifts on this page"}).check();
 await page.getByRole("button",{name:"Send selected (1)",exact:true}).click();
 await page.getByText("No donations in this view.",{exact:false}).waitFor();
 assert.deepEqual(sends,["synthetic-gift"]);
 await page.getByRole("button",{name:"Sent history",exact:true}).click();
 await page.getByText("synthetic-receipt",{exact:false}).filter({visible:true}).waitFor();
 checks.push("Selected sending refreshes pending queue and exposes receipt in sent history");
 await page.getByRole("button",{name:"Activity log",exact:true}).click();
 await page.getByText("Sample Staff",{exact:false}).filter({visible:true}).last().waitFor();
 checks.push("Activity log displays sending user");
 } else if (scenario === "staff") {
 connected=false; role="staff";
 await page.setViewportSize({width:390,height:1000});
 await page.goto(`${base}/quickbooks-sync`,{waitUntil:"networkidle"});
 await page.getByRole("button",{name:"Connection & settings",exact:true}).click();
 await page.getByRole("button",{name:"Connect to QuickBooks",exact:true}).waitFor();
 assert.equal(await page.getByRole("checkbox",{name:"Enable daily automatic sending"}).count(),0);
 assert.equal(await page.getByText("Advanced connection configuration",{exact:true}).count(),0);
 checks.push("Staff can connect; developer configuration and daily settings are hidden");
 await page.screenshot({path:`${evidence}/staff-connect-390.png`,fullPage:true});
 await context.route("https://appcenter.intuit.com/**", route => route.abort());
 const authRequest=page.waitForRequest("https://appcenter.intuit.com/**");
 await page.getByRole("button",{name:"Connect to QuickBooks",exact:true}).click();
 await authRequest;
 checks.push("Connect hands off to Intuit sign-in using the authorization URL");
 } else {
 await page.setViewportSize({width:390,height:1000});
 await page.goto(`${base}/`,{waitUntil:"networkidle"});
 await page.getByRole("region",{name:"QuickBooks overview"}).waitFor();
 await page.getByRole("region",{name:"QuickBooks overview"}).screenshot({path:`${evidence}/dashboard-widget-390.png`});
 checks.push("Dashboard contains QuickBooks summary widget");
 }

 assert.deepEqual(errors,[]);
 await writeFile(`${evidence}/browser-checks-${scenario}.json`,JSON.stringify({data:"Synthetic browser-only fixtures; no real accounting writes",checks,errors},null,2));
 console.log("QuickBooks browser checks passed");
} catch(error){ await writeFile(`${evidence}/failed-inline-scripts.json`, JSON.stringify(await page.locator("script:not([src])").allTextContents())); console.log(errors); console.log(await page.locator("body").innerText()); await page.screenshot({path:`${evidence}/failure.png`,fullPage:true});throw error;} finally {await browser.close();}

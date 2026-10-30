/** Synthetic browser-only task state; every API call is intercepted, no database writes. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.QA_BASE_URL || "http://localhost:4780";
const evidence = "docs/status/audit-artifacts/2026-10-30-tasks";
const user = {id:"operator",firstName:"Taylor",lastName:"Reed",email:"task-fixture@example.invalid",role:"admin",organizationId:"task-fixture",permissions:["view:tasks","edit:tasks"]};
const other = {id:"other",firstName:"Morgan",lastName:"Lee"};
let rows = Array.from({length:27},(_,i)=>({id:`task-${i}`,title:i===0?"Future follow-up":i===1?"Undated follow-up":`Review item ${i}`,type:"FOLLOW_UP",status:"PENDING",priority:"MEDIUM",dueDate:i===1?null:"2027-12-01T23:59:59.999Z",assigneeId:user.id,assignee:user,createdBy:user,description:"Synthetic fixture",constituentId:null,constituent:null}));
const linked = { ...rows[0], id:"linked-outside-queue",title:"Completed notification task",status:"COMPLETED",completedAt:"2026-10-29T12:00:00Z" };
const checks=[],errors=[],calls=[],writes=[];
const check=(message)=>{checks.push(message);console.log(message);};
let failNextAction=false,failList=false;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:"America/Chicago"});
await context.addInitScript(() => window.addEventListener("error",event=>console.error("TASK_QA_ERROR",JSON.stringify({message:event.message,filename:event.filename,line:event.lineno,column:event.colno}))));
const page=await context.newPage();page.on("pageerror",e=>{errors.push(e.message);console.error(e.stack);});
page.on("console",message=>{if(message.text().startsWith("TASK_QA_ERROR"))console.error(message.text());});
await context.route("**/api/**",async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();calls.push(`${method} ${path}${url.search}`);
 const reply=(json,status=200)=>route.fulfill({status,json});
 if(path==="/api/auth/refresh")return reply({data:{accessToken:"synthetic-task-session"}});
 if(path==="/api/auth/me")return reply({data:user});
 if(path==="/api/tasks/assignees")return reply({items:[user,other]});
 if(path==="/api/tasks/templates")return reply([{id:"call",name:"Thank-you call",title:"Call donor",type:"CALL",priority:"HIGH",description:"Thank donor",dueInDays:1}]);
 if(path==="/api/constituents")return reply([{id:"person",firstName:"Avery",lastName:"Client"}]);
 if(path==="/api/notifications/sse")return route.fulfill({contentType:"text/event-stream",body:""});
 if(path.includes("notifications"))return reply({items:[],unreadCount:0});
 if(path==="/api/tasks"&&method==="GET"){
  if(failList)return reply({error:{message:"Task list temporarily unavailable"}},503);
  const search=url.searchParams.get("search")?.toLowerCase(),status=url.searchParams.get("status"),type=url.searchParams.get("type");
  const matches=rows.filter(row=>(!status||row.status===status)&&(!type||row.type===type)&&(!search||row.title.toLowerCase().includes(search)));
  const number=Number(url.searchParams.get("page")||1),limit=Number(url.searchParams.get("limit")||25);
  return reply({items:matches.slice((number-1)*limit,number*limit),total:matches.length,page:number,limit,totalPages:Math.max(1,Math.ceil(matches.length/limit))});
 }
 if(path==="/api/tasks/linked-outside-queue")return reply(linked);
 if(path.startsWith("/api/tasks")&&method!=="GET"){
  writes.push({path,method,fixtureOnly:true});
  if(failNextAction){failNextAction=false;return reply({error:{message:"Task update temporarily unavailable"}},503);}
  const data=req.postDataJSON()||{};
  if(path==="/api/tasks"&&method==="POST"){const saved={...rows[0],...data,id:"created-browser",assignee:data.assigneeId===other.id?other:user};rows.unshift(saved);return reply(saved,201);}
  if(path==="/api/tasks/bulk-assign"){for(const row of rows)if(data.taskIds.includes(row.id)){row.assigneeId=data.assigneeId;row.assignee=other;}return reply({updatedCount:data.taskIds.length});}
  const id=path.split("/")[3],row=rows.find(item=>item.id===id);
  if(!row)return reply({error:{message:"Task not found"}},404);
  if(method==="DELETE"){rows=rows.filter(item=>item.id!==id);return route.fulfill({status:204});}
  if(path.endsWith("/complete"))row.status="COMPLETED";
  else if(path.endsWith("/reopen"))row.status="PENDING";
  else Object.assign(row,data,{assignee:data.assigneeId===other.id?other:data.assigneeId===null?null:user});
  return reply(row);
 }
 return reply({});
});
const row=(title)=>page.getByRole("row").filter({has:page.getByText(title,{exact:true})});
try{
 await mkdir(evidence,{recursive:true});
 await page.goto(`${base}/tasks`,{waitUntil:"networkidle"});
 await page.getByRole("heading",{name:"Make the next step happen"}).waitFor();
 await row("Future follow-up").waitFor();await row("Undated follow-up").waitFor();
 assert.ok(calls.some(call=>call.includes("/api/tasks?")&&call.includes("queue=all")));
 await page.getByText("27 matching tasks - Page 1 of 2",{exact:true}).waitFor();
 await page.getByRole("button",{name:"Next",exact:true}).click();await page.getByText("27 matching tasks - Page 2 of 2",{exact:true}).waitFor();
 check("My work includes future/undated tasks and paginates using server totals");
 await page.goto(`${base}/tasks?create=1`,{waitUntil:"networkidle"});
 const dialog=page.getByRole("dialog");await dialog.waitFor();
 await dialog.getByLabel("Task title",{exact:true}).fill("Browser task");
 await dialog.getByLabel("Assigned to",{exact:true}).selectOption(other.id);
 await dialog.getByLabel("Due date",{exact:false}).fill("2026-11-06");
 await dialog.getByLabel("In-app reminder",{exact:false}).fill("2026-11-06T09:30");
 await dialog.getByRole("button",{name:"Create Task",exact:true}).click();
 await page.getByText("Task saved.",{exact:true}).waitFor();await row("Browser task").waitFor();
 const saved=rows.find(item=>item.id==="created-browser");assert.equal(new Date(saved.dueDate).getHours(),23);assert.equal(new Date(saved.dueDate).getMinutes(),59);assert.ok(saved.reminderAt);
 check("Create link opens editor; assignment, local end-of-day due date and reminder save");
 await row("Browser task").getByRole("button",{name:"Edit",exact:true}).click();await dialog.getByLabel("Task title",{exact:true}).fill("Browser task edited");await dialog.getByRole("button",{name:"Save changes",exact:true}).click();await row("Browser task edited").waitFor();
 await row("Browser task edited").getByRole("button",{name:"Done",exact:true}).click();await row("Browser task edited").getByRole("button",{name:"Reopen",exact:true}).waitFor();
 await page.getByRole("combobox",{name:"Task status",exact:true}).selectOption("COMPLETED");await row("Browser task edited").waitFor();
 await row("Browser task edited").getByRole("button",{name:"Reopen",exact:true}).click();await page.getByRole("heading",{name:"No tasks in this view"}).waitFor();
 await page.getByRole("combobox",{name:"Task status",exact:true}).selectOption("");await row("Browser task edited").waitFor();
 check("Edit, complete, completed filter and reopen run the real task actions");
 failNextAction=true;await row("Browser task edited").getByRole("button",{name:"Done",exact:true}).click();await page.getByRole("alert").filter({hasText:"Task update temporarily unavailable"}).waitFor();await page.getByRole("button",{name:"Retry",exact:true}).click();await row("Browser task edited").getByRole("button",{name:"Done",exact:true}).waitFor();
 check("Task action errors are visible and retry reloads unchanged task");
 await page.getByRole("checkbox",{name:"Select task: Browser task edited",exact:true}).check();
 await page.getByRole("combobox",{name:"Reassign selected tasks to"}).selectOption(other.id);page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Reassign selected",exact:true}).click();await page.getByText("1 tasks reassigned.",{exact:true}).waitFor();
 check("Bulk assignment changes only explicitly selected tasks after confirmation");
 await page.goto(`${base}/tasks?taskId=linked-outside-queue`,{waitUntil:"networkidle"});await page.getByRole("region",{name:"Linked task",exact:true}).getByText("Completed notification task",{exact:true}).last().waitFor();
 check("Notification deep link loads exact completed task outside current page");
 await page.getByRole("button",{name:"Dismiss linked task",exact:true}).click();
 page.once("dialog",dialog=>dialog.dismiss());await row("Browser task edited").getByRole("button",{name:"Delete task: Browser task edited",exact:true}).click();assert.ok(rows.some(item=>item.id==="created-browser"));
 page.once("dialog",dialog=>dialog.accept());await row("Browser task edited").getByRole("button",{name:"Delete task: Browser task edited",exact:true}).click();await page.getByText("Task deleted.",{exact:true}).waitFor();assert.ok(!rows.some(item=>item.id==="created-browser"));
 check("Delete requires confirmation and updates list after confirmed success");
 failList=true;await page.getByRole("button",{name:"Refresh",exact:true}).click();await page.getByRole("alert").filter({hasText:"Task list temporarily unavailable"}).waitFor();assert.equal(await page.getByRole("heading",{name:"No tasks in this view"}).count(),0);failList=false;await page.getByRole("button",{name:"Retry",exact:true}).click();await row("Future follow-up").waitFor();
 check("Failed list is an error state, not an empty success, and retry recovers");
 await page.screenshot({path:`${evidence}/tasks-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:"networkidle"});await page.getByRole("heading",{name:"Make the next step happen"}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 await page.screenshot({path:`${evidence}/tasks-mobile.png`,fullPage:true});
 await page.goto(`${base}/settings/tasks`,{waitUntil:"networkidle"});await page.getByRole("heading",{name:"Task workflow",exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Save Changes",exact:true}).count(),0);
 check("Mobile390px fits and settings describes live workflows without fake saves");
 assert.deepEqual(errors,[]);await writeFile(`${evidence}/browser-results.json`,JSON.stringify({checks,errors,fixtureMutations:writes.length,persistentWrites:0,fixture:"Synthetic API responses only"},null,2));console.log(JSON.stringify({checks,errors,persistentWrites:0},null,2));
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true});await writeFile(`${evidence}/failure.json`,JSON.stringify({url:page.url(),text:await page.locator("body").innerText(),errors},null,2));throw error;}finally{await browser.close();}

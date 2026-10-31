import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(20000);
let saved=[];const columns=[{key:'designation',label:'Fund'},{key:'amount',label:'Amount',type:'currency'}];
await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname, method=route.request().method();let data={items:[],unreadCount:0};
if(path==='/api/auth/refresh')data={data:{accessToken:'fixture'}};
if(path==='/api/auth/me')data={data:{id:'qa-admin',organizationId:'qa-org',role:'admin',firstName:'QA',lastName:'Admin',email:'qa@example.invalid'}};
if(path==='/api/setup/status')data={data:{setupCompleted:true}};
if(path==='/api/reports/library/donations')data={title:'Donations',columns,rows:[{designation:'General',amount:10}],notices:[],summary:[]};
if(path==='/api/reports/custom'){if(method==='POST'){saved.push({id:'report1',config:route.request().postDataJSON()});data={id:'report1'};}else data={items:saved};}
if(path==='/api/reports/custom/run')data={title:route.request().postDataJSON().name,description:'Completed gifts in the chosen period.',generatedAt:new Date().toISOString(),columns:[{key:'group',label:'Fund'},{key:'count',label:'Records',type:'number'},{key:'total',label:'Amount',type:'currency'}],rows:[{group:'General',count:1,total:10}],summary:[{label:'Groups',value:1}],notices:[]};
return route.fulfill({json:data});});
try{await page.goto('http://localhost:3000/reports/custom');await page.getByRole('heading',{name:'Custom report studio'}).waitFor();await page.getByRole('button',{name:'Fund allocation summary',exact:false}).click();await page.getByRole('button',{name:'Run report',exact:true}).click();await page.getByRole('heading',{name:'Fund allocation summary',exact:true}).waitFor();await page.getByRole('button',{name:'Save as new report'}).click();await page.getByRole('status').filter({hasText:'Report definition saved'}).waitFor();assert.equal(saved[0].config.groupBy,'designation');await mkdir('docs/status/audit-artifacts/2026-10-30-report-studio',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`docs/status/audit-artifacts/2026-10-30-report-studio/studio-${width}.png`,fullPage:true});}console.log('PASS: starter, grouping, run, presentation, save, desktop/mobile layout (mock API).');}finally{await browser.close();}

/** Synthetic route-only restoration regression. No templates, deliveries or business writes. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='docs/status/audit-artifacts/2026-11-05-standalone-communications';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});const checks=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),bootstrapReads=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/refresh')return route.fulfill({json:{data:{accessToken:'synthetic-restoration'}}});
  if(path==='/api/auth/me')return route.fulfill({json:{data:{id:'qa',organizationId:'qa-org',firstName:'QA',lastName:'Admin',role:'admin',email:'qa@example.invalid'}}});
  if(path==='/api/oyama-create/bootstrap'){bootstrapReads.push(path);return route.fulfill({json:{enabled:true,permissions:['letters.view','view:communications'],capabilities:[]}});}
  if(route.request().method()!=='GET')return route.fulfill({status:405,json:{error:{message:'Business writes disabled'}}});
  return route.fulfill({json:[]});
 });
 await page.goto('http://localhost:3000/oyama-letters',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Template Library',exact:true}).waitFor();
 if(await page.getByRole('button',{name:'Dismiss',exact:true}).isVisible())await page.getByRole('button',{name:'Dismiss',exact:true}).click();
 assert.equal(new URL(page.url()).pathname,'/oyama-letters');assert.equal(bootstrapReads.length,0);
 await page.screenshot({path:`${dir}/local-letters-${width}.png`});
 await page.getByRole('link',{name:'Create New Template',exact:true}).first().click();
 await page.waitForURL('**/oyama-letters/templates/new');
 await page.getByRole('button',{name:/save/i}).first().waitFor();
 assert.equal(bootstrapReads.length,0);
 await page.goto('http://localhost:3000/oyama-email',{waitUntil:'networkidle'});
 await page.getByText('Email Template Library',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/oyama-email');assert.equal(bootstrapReads.length,0);
 await page.screenshot({path:`${dir}/local-email-${width}.png`});
 checks.push({width,lettersLibrary:true,newLetterEditor:true,emailLibrary:true,noCreateRedirect:true,noBusinessWrites:true});await page.close();
}await writeFile(`${dir}/restoration-checks.json`,JSON.stringify({fixtures:'Synthetic browser API data',checks},null,2));console.log(JSON.stringify(checks));}finally{await browser.close();}

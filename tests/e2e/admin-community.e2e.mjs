import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(20000);
const evidence='docs/status/audit-artifacts/2026-10-30-admin-community';
await mkdir(evidence,{recursive:true});
const admin={id:'qa-admin',organizationId:'qa-org',firstName:'Jordan',lastName:'Lee',role:'admin',email:'jordan@example.invalid',jobTitle:'Development Director',bio:'Helping our team build lasting donor relationships.',phone:'555-0100',timezone:'America/Chicago',preferredName:null,avatarUrl:null,createdAt:'2026-01-01T12:00:00Z',lastLoginAt:null};
const colleague={...admin,id:'other',firstName:'Morgan',lastName:'Chen',jobTitle:'Operations Director'};
let posts=[{id:'post1',body:'Welcome to our administrator community. Share a win from this week!',authorId:'other',author:colleague,createdAt:'2026-10-30T12:00:00Z',updatedAt:'2026-10-30T12:00:00Z',_count:{replies:0,reactions:0},reactions:[]}];
let replies=[];
await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();
 const json=data=>route.fulfill({json:data});
 if(path==='/api/auth/refresh')return json({data:{accessToken:'fixture'}});
 if(path==='/api/auth/me')return json({data:admin});
 if(path==='/api/setup/status')return json({data:{setupCompleted:true}});
 if(path==='/api/users/me/profile'){
  if(method==='PUT'){Object.assign(admin,route.request().postDataJSON());return json({profile:admin});}
  return json({profile:admin,usage:{periodDays:30,actionCount:0,loginCount:0,activeDays:0,activeSessions:1,lastActivityAt:null,recentActivity:[]}});
 }
 if(path==='/api/admin-community/members')return json({items:[admin,colleague],hasMore:false});
 if(path==='/api/admin-community/posts'){
  if(method==='POST'){const data=route.request().postDataJSON();posts.unshift({id:'new-post',body:data.body,kind:data.kind,title:data.title,stage:'OPEN',authorId:admin.id,author:admin,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),_count:{replies:0,reactions:0},reactions:[]});return json({id:'new-post'});}
  return json({items:posts,hasMore:false});
 }
 if(path.endsWith('/stage')){posts.find(p=>path.includes(p.id)).stage=route.request().postDataJSON().stage;return json({saved:true});}
 if(path.endsWith('/reaction')){posts.find(p=>path.includes(p.id)).reactions=[{userId:admin.id}];posts.find(p=>path.includes(p.id))._count.reactions=1;return json({saved:true});}
 if(path.endsWith('/replies')){
  if(method==='POST'){replies.push({id:'reply1',body:route.request().postDataJSON().body,authorId:admin.id,author:admin,createdAt:new Date().toISOString()});posts.find(p=>path.includes(p.id))._count.replies++;return json({id:'reply1'});}
  return json({items:replies,hasMore:false});
 }
 return json({items:[],unreadCount:0});
});
try{
 await page.goto('http://localhost:3000/community');
 await page.getByRole('heading',{name:'Your team. One conversation.'}).waitFor();
 await page.getByLabel('Your update',{exact:true}).fill('Our donor welcome project is ready for team review.');
 await page.getByRole('button',{name:'Publish update',exact:true}).click();
 await page.getByText('Our donor welcome project is ready for team review.',{exact:true}).waitFor();
 const post=page.getByRole('article').filter({hasText:'Welcome to our administrator community.'});
 await post.getByRole('button',{name:'Like · 0',exact:true}).click();
 await post.getByRole('button',{name:'Liked · 1',exact:true}).waitFor();
 await post.getByRole('button',{name:'Replies · 0'}).click();
 await post.getByLabel('Your reply',{exact:true}).fill('Thank you! Looking forward to collaborating.');
 await post.getByRole('button',{name:'Post reply',exact:true}).click();
 await post.getByText('Thank you! Looking forward to collaborating.',{exact:true}).waitFor();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${evidence}/feed-${width}.png`,fullPage:true});
 }
 console.log('Checking board creation');
 await page.getByRole('button',{name:'Ideas & Projects',exact:true}).click();
 await page.getByLabel('Entry type',{exact:true}).selectOption('PROJECT');
 await page.getByLabel('Title',{exact:true}).fill('New donor welcome project');
 await page.getByLabel('Your update',{exact:true}).fill('Coordinate welcome calls and share working notes here.');
 await page.getByRole('button',{name:'Publish update',exact:true}).click();
 const project=page.getByRole('article').filter({hasText:'New donor welcome project'});
 await project.getByLabel('Stage',{exact:true}).selectOption('IN_PROGRESS');
 await project.getByLabel('Stage',{exact:true}).waitFor();
 assert.equal(posts.find(p=>p.title==='New donor welcome project').stage,'IN_PROGRESS');
 await page.screenshot({path:`${evidence}/ideas-projects-390.png`,fullPage:true});
 await page.getByRole('button',{name:'Admin directory',exact:true}).click();
 await page.getByRole('heading',{name:'Morgan Chen',exact:true}).waitFor();
 await page.goto('http://localhost:3000/settings/profile');
 await page.getByLabel('Job title',{exact:true}).fill('Director of Donor Engagement');
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Profile saved'}).waitFor();
 assert.equal(admin.jobTitle,'Director of Donor Engagement');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${evidence}/profile-${width}.png`,fullPage:true});
 }
 console.log('PASS: publish, like, reply persistence, directory, profile save; desktop/mobile overflow (mock APIs only).');
}finally{await browser.close();}

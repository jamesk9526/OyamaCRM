import { createRequire } from 'node:module';
const { build } = createRequire(require.resolve('tsx'))('esbuild');
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { renderGeneratedLetterPdf } from '../server/src/routes/letters';

async function main() {
const dir = '.tmp/letters-fidelity';
await mkdir(dir, { recursive: true });
const shims: Record<string, string> = {
  'next/navigation': `export const usePathname=()=>'/oyama-letters/templates/fidelity'; export const useSearchParams=()=>new URLSearchParams(); export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/link': `import React from 'react'; export default function Link({children,href,...props}){return React.createElement('a',{...props,href},children)}`,
  '@/app/components/auth/AuthProvider': `export const useAuth=()=>({user:{id:'fixture',firstName:'Test',lastName:'Reviewer',permissions:[],role:'ADMIN'},signOut:()=>{}});`,
  '@/app/lib/auth-client': `export const API_BASE=''; export const apiRequestUrl=p=>p; export const getAccessToken=()=>null; export const apiFetchResponse=(path,init={})=>fetch(path,{...init,headers:{'Content-Type':'application/json'}}); export const apiFetch=async(path,init)=>{const r=await apiFetchResponse(path,init);if(!r.ok)throw new Error('Fixture request failed');return r.json()};`,
};
await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Workspace from './app/components/letters/OyamaLettersWorkspace';createRoot(document.getElementById('root')).render(<Workspace view="builder" templateId="fidelity"/>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, outfile: `${dir}/app.js`, platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name:'fixtures', setup(b) {
    b.onResolve({filter:/^(next\/(navigation|link)|@\/app\/(lib\/auth-client|components\/auth\/AuthProvider))$/},a=>({path:a.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:shims[a.path],loader:'jsx',resolveDir:process.cwd()}));
  }}],
});
let template: any = { id:'fidelity',name:'Print fidelity test letter',category:'THANK_YOU',status:'DRAFT',printSubject:'',printBody:'<p>Dear Test Recipient,</p>'+Array.from({length:8},()=>'<p>Thank you for supporting practical care in our community. Your generosity helps families find the support they need, when they need it most.</p>').join(''),printLayoutJson:null };
const branding = {organizationName:'Test Organization',tagline:'',addressLine:'123 Test Street',contactLine:'',taxId:'',footerLegalText:'',logoDataUrl:null,logoFormat:null,primaryColor:'#0f766e'} as const;
const render = (body:string, layout?:unknown) => renderGeneratedLetterPdf({templateName:'Fidelity fixture',subject:'',constituentName:'Test Recipient',generatedAt:new Date('2026-09-08T12:00:00Z'),mergedPrintBody:body,branding,presets:{},printLayout:layout});
for (const [name,body,layout] of [
  ['one-page',template.printBody,null],
  ['overflow','<p>'+ 'Thank you for your generous support. '.repeat(750)+'</p>',null],
  ['manual-break','<p>First page.</p><div data-letter-page-break="true">New page</div><p>Second page.</p>',null],
  ['a4',template.printBody,{letterPdfLayout:{pageSize:'A4 (8.27 x 11.69 in)',margins:{left:1.5,right:0.125,top:0.5,bottom:0.5}}}],
  ['line-height','<p style="font-size:9pt;line-height:18px">'+'Your support brings hope to families. '.repeat(200)+'</p>',null],
] as const) await writeFile(`${dir}/${name}.pdf`,await render(body,layout));
createServer(async(req,res)=>{
  try {
    const path = new URL(req.url!,'http://localhost').pathname;
    const chunks=[];for await(const c of req)chunks.push(c);const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
    if(path==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(`${dir}/app.js`));return;}
    if(path==='/style.css'){res.setHeader('Content-Type','text/css');res.end(await readFile('.next/dev/static/css/app/layout.css'));return;}
    if(path.endsWith('/sample-pdf')){const pdf=await render(body.draft.printBody,body.draft.printLayoutJson);res.setHeader('Content-Type','application/pdf');res.end(pdf);return;}
    if(path.startsWith('/api/')){
      res.setHeader('Content-Type','application/json');let result:any={};
      if(path.endsWith('/merge-fields'))result={sections:[]};
      else if(path.endsWith('/signatures')||path.endsWith('/header-presets'))result=[];
      else if(path==='/api/settings/branding')result={organizationDisplayName:'Test Organization'};
      else if(path==='/api/constituents')result=[{id:'test',firstName:'Test',lastName:'Recipient',doNotMail:false,addressLine1:'123 Test Street'}];
      else if(path.endsWith('/publish'))result={blockers:[],warnings:[],canPublish:true};
      else if(path==='/api/letters/templates/fidelity'){if(req.method==='PATCH')template={...template,...body};result=template;}
      res.end(JSON.stringify(result));return;
    }
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div style="background:#fff4ce;padding:4px">Isolated UI test fixture — synthetic data, real letter editor and PDF renderer</div><div id="root"></div><script src="/app.js"></script></body></html>');
  } catch(e){res.statusCode=500;res.end(String(e));}
}).listen(3005,'127.0.0.1',()=>console.log('Letter fidelity fixture: http://localhost:3005'));
}
void main();

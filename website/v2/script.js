"use strict";
const shots = {
 dashboard: {src:"assets/dashboard.png",alt:"OyamaCRM v2 dashboard showing giving summaries, charts, and daily work",caption:"A shared view of giving, follow-ups, and the next steps that matter."},
 tables: {src:"assets/tables.png",alt:"Constituent table with selected spreadsheet cells and the active cell address",caption:"Familiar cell navigation, range selection, and copy controls for your daily records."},
 commands: {src:"assets/commands.png",alt:"Expanded contextual command dock above the bottom workspace pill",caption:"Your current page’s actions, grouped in a compact ribbon when you need them."}
};
const image=document.querySelector('#product-shot');
const dialog=document.querySelector('#preview-dialog');
let current='dashboard';
function selectShot(key){
 const shot=shots[key];if(!shot)return;
 current=key;image.src=shot.src;image.alt=shot.alt;
 document.querySelector('#screen-caption').textContent=shot.caption;
 document.querySelector('.screen-preview').setAttribute('aria-label',`Enlarge ${key} screenshot`);
 document.querySelectorAll('[data-shot]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.shot===key)));
}
document.querySelectorAll('[data-shot]').forEach(button=>button.addEventListener('click',()=>selectShot(button.dataset.shot)));
document.querySelectorAll('[data-select]').forEach(link=>link.addEventListener('click',()=>selectShot(link.dataset.select)));
function preview(){const shot=shots[current];const large=dialog.querySelector('img');large.src=shot.src;large.alt=shot.alt;dialog.showModal();}
document.querySelector('.screen-preview').addEventListener('click',preview);
document.querySelector('.enlarge').addEventListener('click',preview);
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});
const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('#site-nav');
function closeMenu(){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';nav.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){closeMenu();toggle.focus();}});
window.addEventListener('resize',()=>{if(innerWidth>600)closeMenu();});

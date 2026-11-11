const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const errors=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push(String(e.message||e)));
const dom = new JSDOM(fs.readFileSync(process.argv[2],'utf8'), {runScripts:'dangerously', url:'http://localhost/?fast=1', pretendToBeVisual:true, virtualConsole:vc});
const w=dom.window,d=w.document,G=w.__vool; w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=()=>{};
const click=el=>{ if(el) el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); }; const R=n=>Math.floor(Math.random()*n);
const scores=[];
for(let k=0;k<200;k++){
  G.state=G.fresh(); G.A.start();
  for(let j=0;j<8;j++){ const bs=[...d.querySelectorAll('[data-a="inc"]:not([disabled])')]; click(bs[R(bs.length)]); }
  if(R(2)) click(d.querySelector('[data-a="pet"][data-k="dog"]'));
  const hs=[...d.querySelectorAll('[data-a="home"]')].map(b=>b.dataset.v); click(d.querySelector(`[data-a="home"][data-v="${hs[R(hs.length)]}"]`));
  const he=[...d.querySelectorAll('[data-a="heat"]')].map(b=>b.dataset.v); if(he.length) click(d.querySelector(`[data-a="heat"][data-v="${he[R(he.length)]}"]`));
  click(d.querySelector('[data-a="toPrep"]'));
  const sl=[...d.querySelectorAll('[data-a="slist"]')].map(b=>b.dataset.id).sort(()=>Math.random()-.5).slice(0,R(5)); sl.forEach(id=>click(d.querySelector(`[data-a="slist"][data-id="${id}"]`)));
  if(R(2)) click(d.querySelector('[data-a="goShop"]:not([disabled])'));
  const tk=[...d.querySelectorAll('[data-a="task"]')].map(b=>b.dataset.id).sort(()=>Math.random()-.5); tk.forEach(id=>click(d.querySelector(`[data-a="task"][data-id="${id}"]`)));
  click(d.querySelector('[data-a="goShop"]:not([disabled])'));
  if(G.usedMin(G.state)>G.BUDGET) throw new Error('over budget '+G.usedMin(G.state));
  if(/undefined|NaN/.test(d.querySelector('main').textContent)) throw new Error('bad prep text');
  click(d.querySelector('[data-a="begin"]')); if(G.state.screen==='prep') click(d.querySelector('[data-a="begin"]'));
  let g=0;
  while(G.state.screen==='scene'){ if(++g>20) throw new Error('loop');
    const en=[...d.querySelectorAll('.opt:not([disabled])')]; if(!en.length) throw new Error('dead end '+G.SC[G.state.i].id);
    click(en[R(en.length)]); click(d.querySelector('#nx')); }
  if(G.state.screen!=='end') throw new Error('no end');
  if(/undefined|NaN|\[object/.test(d.body.textContent)) throw new Error('bad text on end');
  scores.push(G.finalScore(G.state));
  click(d.querySelector('[data-a="again"]')); if(G.state.screen!=='prep'||G.usedMin(G.state)!==0) throw new Error('again failed');
}
scores.sort((a,b)=>a-b); console.log('plays',scores.length,'random-play scores p10/p50/p90',scores[20],scores[100],scores[180],'errors',errors.length?errors.slice(0,3):'none');

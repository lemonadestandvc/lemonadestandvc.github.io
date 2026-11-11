const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(String(e.message||e)));
const dom = new JSDOM(fs.readFileSync(process.argv[2],'utf8'), {runScripts:'dangerously', url:'http://localhost/?fast=1', virtualConsole:vc});
const G = dom.window.__vool; const R=n=>Math.floor(Math.random()*n); const clone=s=>JSON.parse(JSON.stringify(s));
const homes=Object.keys(G.HOMES);
function randSetup(){ return {fam:{adults:1+R(2), baby:R(3)===0?1:0, small:R(3), school:R(3), teen:R(3)===0?1:0, dog:R(2)===0, cat:R(3)===0}, home:homes[R(4)], heat:['ahi','kamin','ei'][R(3)]}; }
function prep(su, policy){
  const st={fam:su.fam,home:su.home,heat:su.heat,prep:G.freshPrep(),picks:[],comm:0};
  const c=G.ctx(st); const vis=G.visibleItems(c);
  const home=vis.filter(i=>i.where==='home').map(i=>i.id).sort(()=>Math.random()-.5);
  const shopI=vis.filter(i=>i.where==='shop').map(i=>i.id).sort(()=>Math.random()-.5);
  const shopFirst = policy==='smart' ? true : R(2)===0;
  const nShop = policy==='smart' ? 4 : R(6);
  const doHome=()=>{ home.forEach(id=>{ if(policy!=='smart' && R(3)===0) return; if(G.taskMin(st,id) <= G.BUDGET-G.usedMin(st)){ st.prep.done[id]=true; if(id==='light') st.prep.batt=Math.random()<.5; } }); };
  const doS=()=>{ st.prep.list = policy==='smart' ? ['food','stove','radio','cash'].filter(x=>shopI.includes(x)).concat(shopI.filter(x=>x==='batt')).slice(0,nShop) : shopI.slice(0,nShop); if(st.prep.list.length && G.BUDGET-G.usedMin(st)>=45) G.doShop(st); };
  if(shopFirst){doS();doHome();} else {doHome();doS();}
  G.beginRun(st); return st;
}
function play(st,policy){
  for(let si=0;si<G.SC.length;si++){ const sc=G.SC[si]; const en=G.sceneEntry(st,si); en.echo.forEach(t=>{ if(!t||/undefined|NaN/.test(t)) throw new Error('bad echo '+t); }); G.addFx(st.m,en.d); st.crises=(st.crises||0)+en.crisis.length; en.crisis.forEach(t=>{ if(!t||/undefined|NaN/.test(t)) throw new Error('bad crisis '+t); }); if(G.houseSvg){ st.i=si; const sv=G.houseSvg(st,'scene'); if(/NaN|undefined/.test(sv)) throw new Error('bad svg '+sc.id); } const c=G.ctx(st);
    const ok=G.visibleOpts(sc,c).filter(o=>!(o.req&&!st.picks.includes(o.req))); if(!ok.length) throw new Error('dead end '+sc.id);
    let id; if(policy==='random') id=ok[R(ok.length)].id; else {let b=-1e9; ok.forEach(o=>{const cl=clone(st);const r=G.resolve(cl,sc,o.id);const v=Object.values(r.deltas).reduce((a,x)=>a+x,0)+(cl.comm-st.comm)*8+Math.random(); if(v>b){b=v;id=o.id;}});}
    const r=G.resolve(st,sc,id); const o=G.visibleOpts(sc,c).find(x=>x.id===id);
    [typeof o.t==='function'?o.t(c):o.t, typeof o.r==='function'?o.r(c):o.r, typeof sc.text==='function'?sc.text(c):sc.text, typeof sc.title==='function'?sc.title(c):sc.title].concat(r.lines.map(l=>l.text)).forEach(t=>{ if(!t||/undefined|NaN|\[object/.test(t)) throw new Error('bad text '+sc.id+' '+id+': '+t); });
  } return st;
}
const out={}; const nItems=[];
for(const [pp,gp] of [['random','random'],['random','greedy'],['smart','greedy']]){ const a=[];
  for(let k=0;k<1500;k++){ const st=play(prep(randSetup(),pp),gp); a.push(G.rawScore(st)); if(pp==='random') nItems.push(st.picks.length); }
  a.sort((x,y)=>x-y); const q=p=>+a[Math.floor(p*(a.length-1))].toFixed(1); console.log(pp+'/'+gp,'p10',q(.1),'p50',q(.5),'p90',q(.9),'max',q(1)); }
nItems.sort((a,b)=>a-b); console.log('items obtained (random prep) p10/p50/p90', nItems[Math.floor(.1*nItems.length)], nItems[Math.floor(.5*nItems.length)], nItems[Math.floor(.9*nItems.length)]);
console.log('errors', errs.length?errs.slice(0,3):'none');

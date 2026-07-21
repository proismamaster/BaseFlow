// Harness P5.6 (Ismail 2026-07-14, "PRIMA l'arco dell'if POI il while, mai insieme; per TUTTI
// gli annidamenti"). Verifica che ogni transizione back-edge (ritorno in un header di ciclo)
// si illumini in DUE fasi DISGIUNTE: 'out' (arco che esce dal nodo, in giu') e 'back' (ritorno
// all'header). Invariante robusta e indipendente dagli indici:
//   - out e back sono DISGIUNTI (nessun segmento acceso in entrambe le fasi),
//   - out UNIONE back == insieme COMPLETO (fase singola) -> niente perso, niente aggiunto,
//   - entrambi NON vuoti,
//   - la fase 'back' contiene il segmento che risale piu' in alto (verso l'header),
//     la fase 'out' NO -> "prima esci, poi torni su".
// Testata su piu' strutture, inclusi annidamenti di if dentro cicli e cicli dentro cicli.
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W=1000,H=1000;

function makeApp(){
  let strokes=[];
  const ctxMock={ strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',_path:[],
    beginPath(){this._path=[];}, moveTo(x,y){this._path.push(['M',x,y]);}, lineTo(x,y){this._path.push(['L',x,y]);},
    quadraticCurveTo(){}, rect(){}, closePath(){},
    stroke(){ for(let i=1;i<this._path.length;i++){const a=this._path[i-1],b=this._path[i]; if(b[0]==='L') strokes.push({x1:Math.round(a[1]),y1:Math.round(a[2]),x2:Math.round(b[1]),y2:Math.round(b[2]),c:(''+this.strokeStyle).toLowerCase()});} },
    fill(){}, clearRect(){strokes=[];}, fillText(){}, measureText(t){return{width:(t||'').length*8};}, save(){}, restore(){}, setLineDash(){}, setTransform(){}, arc(){} };
  const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""}};
  const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
  const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
  const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sandbox]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n});
  vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'), context, {filename:'execute.js'});
  vm.runInContext('window.onload();', context);
  const run=(c)=>vm.runInContext(c,context);
  const ins=(f,t)=>{ const ok=run(`frecceSelected=frecce.findIndex(ff=>${f}); frecceSelected!==-1;`); if(!ok) throw new Error('NO ARC '+f); run(`inserisciNodo(${JSON.stringify(t)});`); run('draw(nodi);'); };
  return { run, ins, nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))')),
    strokesRef:()=>strokes, setStrokes:(v)=>{strokes.length=0;}, capture:(from,to,branch,phase)=>{ run(`_execBranch=${JSON.stringify(branch)}; highlightExecEdge(${from},${to}${phase?','+JSON.stringify(phase):''});`); return strokes.filter(s=>s.c==='#ff9800').map(s=>{ // normalizza direzione per confronto
      const key = (s.x1<s.x2||(s.x1===s.x2&&s.y1<=s.y2)) ? `${s.x1},${s.y1},${s.x2},${s.y2}` : `${s.x2},${s.y2},${s.x1},${s.y1}`; return {key, minY:Math.min(s.y1,s.y2), maxY:Math.max(s.y1,s.y2)}; }); } };
}

let fails=0;
const check=(cond,msg)=>{ console.log((cond?'  OK  ':'  FAIL')+' '+msg); if(!cond) fails++; };

function testTransition(label, buildFn, pick, lbeExpect){
  console.log('\n### '+label);
  const app = makeApp();
  buildFn(app);
  const nodes = app.nodes();
  const {from,to,branch} = pick(nodes);
  console.log('  nodi:', JSON.stringify(nodes.map(n=>n.i+':'+n.t)));
  console.log(`  transizione back-edge: from=${from} to=${to} branch=${branch}`);
  // segmento MAIN del loop_body_end ("parte verticale del while") in coord normalizzate
  const arcs = JSON.parse(app.run('JSON.stringify(frecce.map(f=>({t:f.type,from:f.fromNodeIndex,to:f.toNodeIndex,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))'));
  const lbe = arcs.find(a=>a.t==='loop_body_end' && a.to===to);
  const normKey = (x1,y1,x2,y2)=> (x1<x2||(x1===x2&&y1<=y2)) ? `${x1},${y1},${x2},${y2}` : `${x2},${y2},${x1},${y1}`;
  const lbeKey = lbe ? normKey(lbe.x1,lbe.y1,lbe.x2,lbe.y2) : null;
  const full = app.capture(from,to,branch,null);
  const out  = app.capture(from,to,branch,'out');
  const back = app.capture(from,to,branch,'back');
  const kset = a=>new Set(a.map(x=>x.key));
  const S=(a)=>[...new Set(a.map(x=>x.key))];
  const outK=kset(out), backK=kset(back), fullK=kset(full);
  const inter=[...outK].filter(k=>backK.has(k));
  const union=new Set([...outK,...backK]);
  const missing=[...fullK].filter(k=>!union.has(k));
  const extra=[...union].filter(k=>!fullK.has(k));
  check(out.length>0, 'fase out NON vuota');
  check(back.length>0, 'fase back NON vuota');
  check(inter.length===0, 'out e back DISGIUNTE (nessun segmento in entrambe)');
  check(missing.length===0 && extra.length===0, 'out UNIONE back == insieme completo (niente perso/aggiunto)');
  // la fase back deve contenere il segmento che RISALE piu' in alto (minY minima)
  const minYout = Math.min(...out.map(s=>s.minY));
  const minYback = Math.min(...back.map(s=>s.minY));
  check(minYback <= minYout, `il ritorno (back, minY=${minYback}) risale piu' in alto dell'uscita (out, minY=${minYout})`);
  // check specifico "parte verticale del while": dove finisce lo stelo del back-edge?
  if (lbeKey && lbeExpect) {
    const inOut = outK.has(lbeKey), inBack = backK.has(lbeKey);
    const where = inOut ? 'out' : (inBack ? 'back' : 'assente');
    check(where === lbeExpect, `stelo loop_body_end (parte verticale del while) in fase '${where}' (atteso '${lbeExpect}')`);
  }
  if (inter.length) console.log('   inter:', JSON.stringify(inter));
  if (missing.length) console.log('   missing:', JSON.stringify(missing));
  if (extra.length) console.log('   extra:', JSON.stringify(extra));
}

// A) while { if {} } -> if -> while (true): lo stelo del while (loop_body_end) va in BACK
testTransition('while{ if{} }: if -> while (true)',
  (a)=>{ a.ins('ff.type==="normal"','while'); a.ins('ff.type==="loop_body"','if'); },
  (nodes)=>{ const wf=nodes.find(n=>n.t==='while'); const iff=nodes.find(n=>n.t==='if'); return {from:iff.i,to:wf.i,branch:'true'}; },
  'back');

// B) while { print } -> print -> while (null): loop_body_end e' l'uscita DIRETTA del blocco -> OUT
testTransition('while{ print }: print -> while (null)',
  (a)=>{ a.ins('ff.type==="normal"','while'); a.ins('ff.type==="loop_body"','print'); },
  (nodes)=>{ const wf=nodes.find(n=>n.t==='while'); const pr=nodes.find(n=>n.t==='print'); return {from:pr.i,to:wf.i,branch:null}; },
  'out');

// C) while { while { if {} } } -> if(interno) -> while(interno)  [ANNIDAMENTO]: stelo in BACK
testTransition('while{ while{ if{} } }: if -> while interno (true)  [annidato]',
  (a)=>{ a.ins('ff.type==="normal"','while'); a.ins('ff.type==="loop_body"','while'); a.ins('ff.type==="loop_body" && flow.nodes[ff.fromNodeIndex].type==="while" && ff.fromNodeIndex===2','if'); },
  (nodes)=>{ const inner=nodes.filter(n=>n.t==='while')[1]; const iff=nodes.find(n=>n.t==='if'); return {from:iff.i,to:inner.i,branch:'true'}; },
  'back');

// D) while { if { true: Casa } } -> Casa -> while (null): il BLOCCO nel ramo dell'if (lo screen di
// Ismail). L'uscita di Casa e' 'out'; il back-edge del while (loop_body_end, di proprieta' dell'if)
// va in BACK -> "la parte verticale del while" NON si accende insieme all'arco di Casa.
testTransition('while{ if{ true:Casa } }: Casa -> while (null)  [blocco nel ramo]',
  (a)=>{ a.ins('ff.type==="normal"','while'); a.ins('ff.type==="loop_body"','if'); a.ins('ff.type==="if_true" && ff.fromNodeIndex===2','home'); },
  (nodes)=>{ const wf=nodes.find(n=>n.t==='while'); const casa=nodes.find(n=>n.t==='home'); return {from:casa.i,to:wf.i,branch:null}; },
  'back');

console.log('\n=== ESITO P5.6 ===');
console.log(fails===0 ? 'PASS' : `FAIL (${fails})`);
process.exit(fails===0?0:1);

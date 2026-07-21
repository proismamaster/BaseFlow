// Indagine #3 (Ismail 2026-07-17): "l'arco verticale di ricongiunzione dell'if NON si illumina in
// esecuzione". Il mio harness p6d aveva provato che computeEdgeGroups INCLUDE la discesa; qui provo
// la cosa piu' vicina all'esecuzione REALE: catturo la SEQUENZA di executingEdge.litGroup che
// animateExecEdge accende durante la transizione ramo->join, sostituendo sleep con una cattura.
// Verifico se, in quella sequenza, compare un frame in cui e' acceso il tratto VERTICALE di discesa
// (if_join, x~cx, che scende fino al join). Se NON compare -> il bug e' nell'ANIMAZIONE, non nella
// geometria.
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1000, H = 1000;
function makeApp() {
  const styleMock=()=>({setProperty(){},removeProperty(){},getPropertyValue:()=>'',setAttribute(){}});
  const ctxMock = { strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',globalAlpha:1,beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){} };
  const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:styleMock(),clientWidth:W,scrollWidth:W};
  const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:styleMock(),value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,clientWidth:W,scrollWidth:W,offsetWidth:W});
  const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
  const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sb]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,clearTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','settings','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n});
  // execute.js e' un file separato in js/ (non js/core/)
  vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'), context, {filename:'execute'});
  vm.runInContext('window.onload && window.onload();', context);
  const run=(c)=>vm.runInContext(c,context);
  const ins=(f,t)=>{ run(`frecceSelected=frecce.findIndex(ff=>${f});`); run(`inserisciNodo(${JSON.stringify(t)});`); run('draw(nodi);'); };
  return { run, ins, context,
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type})))')),
    frecce:()=>JSON.parse(run('JSON.stringify(frecce.map(f=>({from:f.fromNodeIndex,to:f.toNodeIndex,type:f.type,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))')) };
}
let fails=0; const check=(c,m)=>{ console.log((c?'  OK  ':'  FAIL')+' '+m); if(!c) fails++; };
const near=(a,b,tol)=>Math.abs(a-b)<=(tol||3);

(async function(){
  const app = makeApp();
  app.ins('ff.type==="normal"','if');       // start(0) if(1) end(2)
  app.ins('ff.type==="if_true"','output');  // ramo true: output(2) -> start(0) if(1) output(2) end(3)
  console.log('nodi:', JSON.stringify(app.nodes()));
  const fr = app.frecce();
  const ij = fr.find(f=>f.type==='if_join');
  console.log('if_join arc (discesa):', ij?`(${ij.x1},${ij.y1})->(${ij.x2},${ij.y2})`:'ASSENTE');

  // Sostituisci sleep con una cattura di executingEdge.litGroup (snapshot) a ogni gruppo acceso.
  app.run(`
    globalThis.__snaps = [];
    sleep = function(){ try { __snaps.push(executingEdge && executingEdge.litGroup ? JSON.parse(JSON.stringify(executingEdge.litGroup)) : null); } catch(e){ __snaps.push(null); } return Promise.resolve(); };
    pauseRequested = false; stopRequested = false; runSpeed = 50; _execBranch = null;
  `);
  // Transizione REALE ramo->join: output(2) -> join(3), branch null (azzerato a ogni nodo).
  await app.context.eval ? null : null;
  await app.run('animateExecEdge(2, 3, 50, 1)');
  const snaps = JSON.parse(app.run('JSON.stringify(__snaps)'));
  console.log('numero di gruppi accesi nella transizione 2->3:', snaps.length);
  snaps.forEach((s,i)=> console.log(`  frame ${i}:`, s? s.map(g=>`(${g.x1},${g.y1})->(${g.x2},${g.y2})${g.a?'*':''}`).join(' ') : 'null'));

  // La discesa e' un segmento ~verticale a x=ij.x1 che copre parte di [ij.y1..ij.y2].
  const isDescent = (g)=>{
    if (!ij) return false;
    const vert = near(g.x1,g.x2,4) && near(g.x1, ij.x1, 6);
    const loY=Math.min(g.y1,g.y2), hiY=Math.max(g.y1,g.y2), ijLo=Math.min(ij.y1,ij.y2), ijHi=Math.max(ij.y1,ij.y2);
    return vert && Math.min(hiY,ijHi)-Math.max(loY,ijLo) > 4;
  };
  const descentLit = snaps.some(s=> s && s.some(isDescent));
  check(descentLit, 'durante la transizione ramo->join, la DISCESA verticale (if_join) viene accesa');

  // WP-E2: la discesa e l'arco del ramo (stelo/ponte, NON-discesa) devono stare nello STESSO frame
  // (accesi e spenti insieme), e la transizione forward deve essere UN SOLO frame.
  const mergedFrame = snaps.some(s=> s && s.some(isDescent) && s.some(g=>!isDescent(g)));
  check(mergedFrame, 'WP-E2: la discesa e l\'arco del ramo si accendono nello STESSO frame (insieme)');
  check(snaps.length === 1, `WP-E2: la transizione forward ramo->join e' UN SOLO frame (trovati ${snaps.length})`);

  console.log('\n=== ESITO indagine #3 / WP-E2 ===');
  console.log(fails===0 ? 'PASS (discesa accesa INSIEME al ramo, un solo gesto)' : `FAIL (${fails})`);
  process.exit(fails===0?0:1);
})();

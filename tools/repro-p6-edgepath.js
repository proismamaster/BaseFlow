// Harness P6 (Strategia A). Verifica computeEdgePath(from,to,branch): la polilinea F->T
// deve essere CONNESSA (ogni segmento attacca al successivo), partire vicino a F e ARRIVARE
// vicino a T, e -- nei casi con annidamento -- includere il back-edge CONDIVISO dell'header
// (che il vecchio matching per (from,to) lasciava spento). Casi:
//   A) while{assign}: assign->while  (blocco: ritorno intero, un solo gesto)
//   B) erroe1 for{if{while{assign}}}: while.false->for  (il back-edge del for DEVE essere nel path)
//   C) erroe1: if.false->for
//   D) erroe1: assign->while (ritorno while interno)
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..'); const W = 1000, H = 1000;
function makeApp() {
  const ctxMock = { strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){} };
  const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
  const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
  const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
  const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sb]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n});
  vm.runInContext('window.onload();', context);
  const run=(c)=>vm.runInContext(c,context);
  const ins=(f,t)=>{ run(`frecceSelected=frecce.findIndex(ff=>${f});`); run(`inserisciNodo(${JSON.stringify(t)});`); run('draw(nodi);'); };
  return { run, ins,
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type})))')),
    nodePos:(i)=>JSON.parse(run(`JSON.stringify(nodi[${i}]?{x:Math.round(nodi[${i}].relX*w),y:Math.round(nodi[${i}].relY*h)}:null)`)),
    path:(from,to,branch)=>JSON.parse(run(`JSON.stringify(computeEdgePath(${from},${to},${JSON.stringify(branch)}))`)) };
}
let fails=0; const check=(c,m)=>{ console.log((c?'  OK  ':'  FAIL')+' '+m); if(!c) fails++; };
const near=(a,b,tol)=>Math.abs(a-b)<=(tol||6);

function testPath(label, build, from, to, branch, expectReachHeader) {
  console.log('\n### '+label);
  const app = makeApp(); app.run('draw(nodi);'); build(app);
  const p = app.path(from, to, branch);
  const fp = app.nodePos(from), tp = app.nodePos(to);
  console.log('  path:', p.map(s=>`(${s.x1},${s.y1})->(${s.x2},${s.y2})`).join(' '));
  check(p.length > 0, 'path non vuoto');
  // connesso: fine di seg[i] ~ inizio di seg[i+1]
  let connected = true;
  for (let i=0;i<p.length-1;i++){ if(!(near(p[i].x2,p[i+1].x1)&&near(p[i].y2,p[i+1].y1))) connected=false; }
  check(connected, 'polilinea CONNESSA (ogni tratto attacca al successivo)');
  // parte vicino a F
  check(p.length>0 && near(p[0].x1, fp.x, 130) && p[0].y1 >= fp.y-40, 'parte dal punto di uscita di F');
  // arriva vicino all'header T (Y del nodo T)
  const last = p[p.length-1];
  check(p.length>0 && near(last.y2, tp.y, 40), `arriva all'header T (yFine=${last.y2}, yT=${tp.y})`);
  if (expectReachHeader) {
    // il punto piu' alto del path deve arrivare al livello d'INGRESSO dell'header (~ yT, tol 40),
    // provando che il back-edge/ritorno e' incluso (non si ferma a meta').
    const minY = Math.min(...p.map(s=>Math.min(s.y1,s.y2)));
    check(near(minY, tp.y, 40), `il path RISALE fino all'header (minY=${minY} ~ yT=${tp.y}) => back-edge incluso`);
  }
}

// A
testPath('while{ assign }: assign->while (blocco)',
  (a)=>{ a.ins('ff.type==="normal"','while'); a.ins('ff.type==="loop_body"','assign'); }, 2, 1, null, true);
// B/C/D — erroe1
const buildErroe1=(a)=>{ a.ins('ff.type==="normal"','for'); a.ins('ff.type==="loop_body"','if'); a.ins('ff.type==="if_true"&&ff.fromNodeIndex===2','while'); a.ins('ff.type==="loop_body"&&ff.fromNodeIndex===3','assign'); };
testPath('erroe1: while(3).false->for(1)  [il back-edge del for DEVE esserci]', buildErroe1, 3, 1, 'false', true);
testPath('erroe1: if(2).false->for(1)', buildErroe1, 2, 1, 'false', true);
testPath('erroe1: assign(4)->while(3)  [ritorno while interno]', buildErroe1, 4, 3, null, true);

console.log('\n=== ESITO P6 (computeEdgePath) ===');
console.log(fails===0 ? 'PASS' : `FAIL (${fails})`);
process.exit(fails===0?0:1);

// Harness WP-D1 (Ismail round-15D): durante l'esecuzione di un IF, la transizione dal ramo
// (true/false) verso il JOIN deve illuminare ANCHE il tratto VERTICALE di ricongiunzione
// (arco 'if_join', dalla convergenza dei rami giu' fino al nodo di join), non solo l'arco del
// ramo. Qui NON si giudica: si MISURA cosa contiene oggi il litGroup (concatenazione dei
// gruppi di computeEdgeGroups) per 4 casi, confrontandolo con le coordinate REALI dell'arco
// if_join preso da frecce[]:
//   1) ramo TRUE con un blocco  -> lastTrue -> join   (branch null)
//   2) ramo FALSE con un blocco -> lastFalse -> join  (branch null)
//   3) ramo TRUE VUOTO          -> if -> join         (branch 'true')
//   4) ramo FALSE VUOTO         -> if -> join         (branch 'false')
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1000, H = 1000;
function makeApp() {
  const styleMock=()=>({setProperty(){},removeProperty(){},getPropertyValue:()=>'',setAttribute(){}});
  const ctxMock = { strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){} };
  const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:styleMock(),clientWidth:W,scrollWidth:W};
  const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:styleMock(),value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,clientWidth:W,scrollWidth:W,offsetWidth:W});
  const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
  const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sb]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n});
  vm.runInContext('window.onload();', context);
  const run=(c)=>vm.runInContext(c,context);
  const ins=(f,t)=>{ run(`frecceSelected=frecce.findIndex(ff=>${f});`); run(`inserisciNodo(${JSON.stringify(t)});`); run('draw(nodi);'); };
  return { run, ins,
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type})))')),
    frecce:()=>JSON.parse(run('JSON.stringify(frecce.map(f=>({from:f.fromNodeIndex,to:f.toNodeIndex,type:f.type,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))')),
    groups:(from,to,branch)=>JSON.parse(run(`JSON.stringify(computeEdgeGroups(${from},${to},${JSON.stringify(branch)}, true))`)) };
}
let fails=0; const check=(c,m)=>{ console.log((c?'  OK  ':'  FAIL')+' '+m); if(!c) fails++; };
const near=(a,b,tol)=>Math.abs(a-b)<=(tol||6);

// Un segmento e' "la discesa if_join" se e' ~verticale ad x=cx e copre (parte de) il tratto
// dell'arco if_join reale [ijx, ijy1]->[ijx, ijy2].
function segCoversDescent(seg, ij) {
  const vertical = near(seg.x1, seg.x2, 4) && near(seg.x1, ij.x1, 8);
  if (!vertical) return false;
  const loY = Math.min(seg.y1, seg.y2), hiY = Math.max(seg.y1, seg.y2);
  const ijLo = Math.min(ij.y1, ij.y2), ijHi = Math.max(ij.y1, ij.y2);
  // sovrapposizione verticale non banale col tratto if_join
  const ov = Math.min(hiY, ijHi) - Math.max(loY, ijLo);
  return ov > 4;
}

function testCase(label, build, from, to, branch) {
  console.log('\n### '+label);
  const app = makeApp(); app.run('draw(nodi);'); build(app);
  const fr = app.frecce();
  const ij = fr.find(f=>f.type==='if_join');
  console.log('  nodi:', JSON.stringify(app.nodes()));
  console.log('  if_join arc:', ij ? `(${ij.x1},${ij.y1})->(${ij.x2},${ij.y2}) from=${ij.from} to=${ij.to}` : 'ASSENTE');
  check(!!ij, 'esiste un arco if_join in frecce[]');
  const groups = app.groups(from, to, branch);
  const allSegs = [].concat(...groups.map(g=>g.segs));
  console.log('  gruppi:', groups.map(g=>g.type+'['+g.segs.length+']').join(' '));
  console.log('  segs:', allSegs.map(s=>`(${s.x1},${s.y1})->(${s.x2},${s.y2})`).join(' '));
  if (ij) {
    const hit = allSegs.some(s=>segCoversDescent(s, ij));
    check(hit, 'il litGroup INCLUDE la discesa verticale if_join fino al join');
  }
  return { ij, groups, allSegs, nodes: app.nodes() };
}

// ---- Casi 1/2: rami con un blocco ----
const buildPop = (a)=>{
  a.ins('ff.type==="normal"','if');
  a.ins('ff.type==="if_true"','output');
  a.ins('ff.type==="if_false"','output');
};
// dopo build: start(0) if(1) outputTrue(?) outputFalse(?) end(?). Indici via nodes().
let r1 = (function(){
  const app = makeApp(); app.run('draw(nodi);'); buildPop(app);
  const nodes = app.nodes(); console.log('\n[setup popolato] nodi:', JSON.stringify(nodes));
  return null;
})();

testCase('1) ramo TRUE con blocco: lastTrue(2) -> join   [branch null]', buildPop, 2, 4, null);
testCase('2) ramo FALSE con blocco: lastFalse(3) -> join [branch null]', buildPop, 3, 4, null);

// ---- Casi 3/4: rami VUOTI ----
const buildEmpty = (a)=>{ a.ins('ff.type==="normal"','if'); };
testCase('3) ramo TRUE VUOTO: if(1) -> join(2) [branch true]', buildEmpty, 1, 2, 'true');
testCase('4) ramo FALSE VUOTO: if(1) -> join(2) [branch false]', buildEmpty, 1, 2, 'false');

// ---- Caso 5: join = nodo NORMALE (output) con un successore, non 'end' ----
// start(0) if(1) T-out(2) F-out(3) join-out(4) end(5)
const buildNormalJoin = (a)=>{
  a.ins('ff.type==="normal"&&ff.fromNodeIndex===0','output'); // start->output (diventa il join)
  a.ins('ff.type==="normal"&&ff.fromNodeIndex===0','if');     // start->if, prima del join
  a.ins('ff.type==="if_true"','output');
  a.ins('ff.type==="if_false"','output');
};
testCase('5) join = nodo NORMALE: lastTrue -> join(4) [branch null]', buildNormalJoin, 2, 4, null);

// ---- Caso 6: IF ANNIDATO nel ramo true di un IF esterno ----
// L'IF interno ha il proprio join; la sua transizione ramo-interno -> join-interno deve
// includere la discesa if_join INTERNA.
const buildNested = (a)=>{
  a.ins('ff.type==="normal"','if');                              // outer if: start(0) if(1) end(2)
  a.ins('ff.type==="if_true"&&ff.fromNodeIndex===1','if');       // inner if nel ramo true dell'outer
  a.ins('ff.type==="if_true"&&ff.fromNodeIndex===2','output');   // blocco nel ramo true dell'inner
};
(function(){
  const app = makeApp(); app.run('draw(nodi);'); buildNested(app);
  console.log('\n[setup annidato] nodi:', JSON.stringify(app.nodes()));
  const fr = app.frecce();
  console.log('  if_join arcs:', JSON.stringify(fr.filter(f=>f.type==='if_join')));
})();
// output(3), unico nodo del ramo true dell'IF interno; ramo false interno vuoto; l'IF interno e'
// unico membro del ramo true dell'IF esterno => join interno = join esterno = end(4). Transizione
// reale: output(3) -> join(4). Deve includere la discesa if_join INTERNA (from=2,to=4).
testCase('6) IF annidato: blocco(3) -> join comune(4) [branch null]', buildNested, 3, 4, null);

console.log('\n=== ESITO WP-D1 (if-join highlight) ===');
console.log(fails===0 ? 'PASS (la discesa e\' gia\' inclusa)' : `FAIL (${fails}) — manca la discesa in almeno un caso`);
process.exit(fails===0?0:1);

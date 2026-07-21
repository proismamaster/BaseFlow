// ROUND-15F WP-E3 (Sonnet, correzione dopo il primo fix sbagliato — Ismail: "voglio che l'arco
// verticale non sia cliccabile ne' con hover ne' per inserimento blocchi, si deve SOLO illuminare
// in esecuzione"). Il primo tentativo agganciava lo stelo rombo->forkY come `visualExtra`
// dell'arco if_true/if_false: siccome arcHitTest (interaction.js) e l'overlay hover/drag
// (rendering.js draw() punti 5/6) leggono ANCHE visualExtra, lo stelo diventava (in parte)
// cliccabile per inserire un blocco e si accendeva in rosso al semplice hover -- comportamento
// non voluto. Fix corretto: proprieta' separata `execOnlyExtra`, letta SOLO da _segsOfArc (quindi
// da computeEdgeGroups/_bfsSegPath, la pipeline di evidenziazione ESECUZIONE), mai da arcHitTest
// ne' dall'overlay hover/drag.
//
// Questo harness verifica ENTRAMBI i lati:
// 1) la transizione if->ramo, in ESECUZIONE, include lo stelo verticale (comportamento outdated
//    dal primo giro, deve restare vero).
// 2) lo stelo NON e' in frecce[].visualExtra (quindi arcHitTest/hover/drag non lo vedono) --
//    verificato sia leggendo direttamente `ve` (visualExtra) sia chiamando arcHitTest con un
//    punto sul tratto dello stelo e controllando che NESSUN arco lo colpisca li'.
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1000, H = 1000;
function makeApp() {
  const styleMock=()=>({setProperty(){},removeProperty(){},getPropertyValue:()=>'',setAttribute(){}});
  const ctxMock = { strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',globalAlpha:1,beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){} };
  const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:styleMock(),clientWidth:W,scrollWidth:W};
  const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:styleMock(),value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,clientWidth:W,scrollWidth:W,offsetWidth:W});
  const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
  const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sb]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','settings','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n});
  vm.runInContext('window.onload();', context);
  const run=(c)=>vm.runInContext(c,context);
  const ins=(f,t)=>{ run(`frecceSelected=frecce.findIndex(ff=>${f});`); run(`inserisciNodo(${JSON.stringify(t)});`); run('draw(nodi);'); };
  return { run, ins,
    consts:()=>JSON.parse(run('JSON.stringify({IF_FORK_STEM_PX})')),
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))')),
    nodi:()=>JSON.parse(run('JSON.stringify(nodi.map(v=>({relX:v.relX,relY:v.relY,height:v.height})))')),
    frecce:()=>JSON.parse(run('JSON.stringify(frecce.map((f,i)=>({i,from:f.fromNodeIndex,to:f.toNodeIndex,type:f.type,a:!!f.hasArrow,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY),ve:(f.visualExtra||[]).map(s=>[Math.round(s[0]),Math.round(s[1]),Math.round(s[2]),Math.round(s[3]),!!s[4]]),eoe:(f.execOnlyExtra||[]).map(s=>[Math.round(s[0]),Math.round(s[1]),Math.round(s[2]),Math.round(s[3]),!!s[4]])})))')),
    groups:(from,to,branch)=>JSON.parse(run(`JSON.stringify(computeEdgeGroups(${from},${to},${JSON.stringify(branch)}, true))`)),
    hitTestPoint:(x,y,tol)=>JSON.parse(run(`JSON.stringify(frecce.map((f,i)=>i).filter(i=>arcHitTest(frecce[i], ${x}, ${y}, ${tol})))`)) };
}

let failures = 0;
function check(cond, msg) {
  if (cond) { console.log('  OK   ' + msg); }
  else { console.log('  FAIL ' + msg); failures++; }
}

const app = makeApp();
app.ins('ff.type==="normal"', 'while');
app.ins('ff.type==="normal"&&ff.fromNodeIndex===0', 'if');

const { IF_FORK_STEM_PX } = app.consts();
const nodes = app.nodes();
const ifIdx = nodes.findIndex(n => n.t === 'if');
const whIdx = nodes.findIndex(n => n.t === 'while');
const ifNode = app.nodi()[ifIdx];
const cx = Math.round(ifNode.relX * W);
const diaBottom = Math.round(ifNode.relY * H + ifNode.height / 2);
const forkY = diaBottom + IF_FORK_STEM_PX;
console.log(`if=${ifIdx} while=${whIdx}  cx=${cx} diaBottom=${diaBottom} forkY=${forkY}`);

// ---- 1) In ESECUZIONE lo stelo deve accendersi (comportamento gia' verificato in precedenza) ----
console.log('\n=== 1) esecuzione: lo stelo deve essere fra i segmenti accesi ===');
for (const br of ['true', 'false']) {
  const gs = app.groups(ifIdx, whIdx, br);
  const all = [].concat(...gs.map(g => g.segs));
  const hasStem = all.some(s => s.x1 === s.x2 && s.x1 === cx &&
    Math.min(s.y1, s.y2) <= diaBottom + 1 && Math.max(s.y1, s.y2) >= forkY - 1);
  check(hasStem, `branch=${br}: lo stelo x=${cx} fra ${diaBottom} e ${forkY} e' fra i segmenti ACCESI in esecuzione`);
}

// ---- 2) FUORI esecuzione: lo stelo NON deve essere in visualExtra (hover/drag/hit-test) ----
console.log('\n=== 2) fuori esecuzione: lo stelo NON deve stare in visualExtra ne' + "'" + ' essere cliccabile/hoverabile ===');
const frecce = app.frecce();
const ifTrue = frecce.find(f => f.type === 'if_true' && f.from === ifIdx);
const ifFalse = frecce.find(f => f.type === 'if_false' && f.from === ifIdx);
function veHasStem(f) {
  return (f.ve || []).some(s => s[0] === s[2] && s[0] === cx &&
    Math.min(s[1], s[3]) <= diaBottom + 1 && Math.max(s[1], s[3]) >= forkY - 1);
}
check(ifTrue && !veHasStem(ifTrue), 'if_true: visualExtra NON contiene lo stelo (hover/drag non lo evidenziano)');
check(ifFalse && !veHasStem(ifFalse), 'if_false: visualExtra NON contiene lo stelo (hover/drag non lo evidenziano)');
check(ifTrue && (ifTrue.eoe || []).length > 0, 'if_true: execOnlyExtra contiene lo stelo (canale separato, solo esecuzione)');
check(ifFalse && (ifFalse.eoe || []).length > 0, 'if_false: execOnlyExtra contiene lo stelo (canale separato, solo esecuzione)');

// arcHitTest diretto: un punto sullo stelo, in cima (accanto al rombo, lontano dall'estremo
// CONDIVISO col ponte orizzontale a forkY -- quel punto e' legittimamente cliccabile perche' e'
// anche l'inizio del ponte, non c'entra con lo stelo) non deve colpire NESSUN arco. ARC_TOL reale
// e' 8-14px (interaction.js): diaBottom e' 10px (IF_FORK_STEM_PX) sopra forkY, ben oltre tol=8.
const topY = diaBottom;
const hits = app.hitTestPoint(cx, topY, 8);
console.log(`  hitTestPoint(${cx},${topY}) -> archi colpiti: ${JSON.stringify(hits)}`);
check(hits.length === 0, `nessun arco cliccabile in cima allo stelo (${cx},${topY}) -- non e' un'area cliccabile/hoverabile`);

console.log('\n=== ESITO repro-e3-if-stem-exec-only ===');
if (failures === 0) { console.log('PASS'); process.exit(0); }
else { console.log(`FAIL (${failures} assert falliti)`); process.exit(1); }

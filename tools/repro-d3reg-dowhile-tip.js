// Indagine #1 (Ismail 2026-07-17): quando l'arco che ENTRA nel do-while si illumina in esecuzione,
// sparisce la punta dell'arco di RICONGIUNZIONE/risalita del do-while. Ipotesi: la soppressione
// WP-D3 (_bfTipMatchesLit) e' troppo larga -- sopprime la punta NERA di QUALSIASI arco il cui
// vertice coincide (3px) con un vertice acceso, non solo dell'arco eseguito. Il do-while rientra
// (risalita) nello STESSO punto d'ingresso -> stessa coordinata -> punta soppressa per errore.
// Questo harness registra i fill (punte) e verifica se, con l'arco entrante acceso, la punta di
// un ALTRO arco del do-while che condivide quel vertice sparisce.
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1000, H = 1000;
function makeApp() {
  const ops = [];
  let cur = { fillStyle:'#000', strokeStyle:'#000', globalAlpha:1, lineWidth:1, font:'', textAlign:'', textBaseline:'' };
  const pathPts = [];
  const ctxMock = {
    set fillStyle(v){cur.fillStyle=v;}, get fillStyle(){return cur.fillStyle;},
    set strokeStyle(v){cur.strokeStyle=v;}, get strokeStyle(){return cur.strokeStyle;},
    set globalAlpha(v){cur.globalAlpha=v;}, get globalAlpha(){return cur.globalAlpha;},
    set lineWidth(v){cur.lineWidth=v;}, get lineWidth(){return cur.lineWidth;},
    set font(v){cur.font=v;}, get font(){return cur.font;},
    set textAlign(v){cur.textAlign=v;}, get textAlign(){return cur.textAlign;},
    set textBaseline(v){cur.textBaseline=v;}, get textBaseline(){return cur.textBaseline;},
    beginPath(){ pathPts.length=0; }, moveTo(x,y){ pathPts.push([x,y]); }, lineTo(x,y){ pathPts.push([x,y]); },
    quadraticCurveTo(){}, rect(){}, closePath(){},
    stroke(){ ops.push({op:'stroke', alpha:cur.globalAlpha, color:cur.strokeStyle, pts:pathPts.slice()}); },
    fill(){ ops.push({op:'fill', color:cur.fillStyle, tip:pathPts.length?pathPts[0].slice():null}); },
    clearRect(){}, fillText(){}, measureText(t){return{width:(t||'').length*8};},
    save(){}, restore(){ cur.globalAlpha=1; }, setLineDash(){}, setTransform(){}, arc(){}
  };
  const styleMock=()=>({setProperty(){},removeProperty(){},getPropertyValue:()=>'',setAttribute(){}});
  const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:styleMock(),clientWidth:W,scrollWidth:W};
  const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:styleMock(),value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,clientWidth:W,scrollWidth:W,offsetWidth:W});
  const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
  const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sb]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','settings','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n});
  vm.runInContext('window.onload();', context);
  const run=(c)=>vm.runInContext(c,context);
  const ins=(f,t)=>{ run(`frecceSelected=frecce.findIndex(ff=>${f});`); run(`inserisciNodo(${JSON.stringify(t)});`); run('draw(nodi);'); };
  return { run, ins, ops, clearOps:()=>{ ops.length=0; },
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type})))')),
    frecce:()=>JSON.parse(run('JSON.stringify(frecce.map((f,i)=>({i,from:f.fromNodeIndex,to:f.toNodeIndex,type:f.type,hasArrow:!!f.hasArrow,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))')),
    groups:(from,to,branch)=>JSON.parse(run(`JSON.stringify(computeEdgeGroups(${from},${to},${JSON.stringify(branch)}, true))`)) };
}
let fails=0; const check=(c,m)=>{ console.log((c?'  OK  ':'  FAIL')+' '+m); if(!c) fails++; };
const isBlack=(c)=>{ const s=String(c).toLowerCase().trim(); return s==='black'||s==='#000'||s==='#000000'; };
const near=(a,b,tol)=>Math.abs(a-b)<=(tol||3);

console.log('### do-while con nodo prima: arco entrante acceso -> la risalita perde la punta?');
const app = makeApp();
app.ins('ff.type==="normal"','do');        // start(0) -> do(1) -> end(2)
app.ins('ff.type==="loop_body"','output'); // corpo del do: output
console.log('  nodi:', JSON.stringify(app.nodes()));
const fr = app.frecce();
fr.forEach(f=>console.log(`   freccia#${f.i} ${f.type} from=${f.from} to=${f.to} arrow=${f.hasArrow} (${f.x1},${f.y1})->(${f.x2},${f.y2})`));

// Baseline: NESSUNA esecuzione -> conta le punte NERE totali (tutte le frecce con hasArrow).
app.run('executingEdge = null;');
app.clearOps(); app.run('draw(nodi);');
const blackBase = app.ops.filter(o=>o.op==='fill' && isBlack(o.color) && o.tip);
console.log('  punte nere (baseline, no exec):', blackBase.length, blackBase.map(o=>`(${o.tip})`).join(' '));

// Trova la transizione che ENTRA nel do-while (start(0)->do(1)) e accendila.
const g01 = app.groups(0,1,null);
const lit = [].concat(...g01.map(x=>x.segs));
const litTips = lit.filter(s=>s.a).map(s=>[s.x2,s.y2]);
console.log('  litGroup 0->1 tips accesi:', JSON.stringify(litTips));
const giArrow = g01.map((x,i)=>({i,a:x.segs.some(s=>s.a)})).filter(o=>o.a).map(o=>o.i).pop();
app.run(`executingEdge = { from:0, to:1, branch:null, litGroup: computeEdgeGroups(0,1,null,true)[${giArrow}].segs, _grp:{from:0,to:1,branch:null,showRis:true,gi:${giArrow}} };`);
app.clearOps(); app.run('draw(nodi);');
const blackExec = app.ops.filter(o=>o.op==='fill' && isBlack(o.color) && o.tip);
console.log('  punte nere (arco 0->1 acceso):', blackExec.length, blackExec.map(o=>`(${o.tip})`).join(' '));

// DIAGNOSI: quante punte nere sono SPARITE rispetto alla baseline, e coincidono con un vertice acceso?
const missing = blackBase.filter(b=> !blackExec.some(e=> e.tip && b.tip && near(e.tip[0],b.tip[0]) && near(e.tip[1],b.tip[1])));
console.log('  punte nere SPARITE con l\'esecuzione:', missing.length, missing.map(o=>`(${o.tip})`).join(' '));
const missingOnLitTip = missing.filter(m=> litTips.some(t=> near(t[0],m.tip[0]) && near(t[1],m.tip[1])));
// La punta dell'arco ACCESO stesso e' giustamente sostituita dall'arancione (1 sparizione legittima).
// Il BUG e' se sparisce ANCHE una punta di un ALTRO arco (la risalita) sullo stesso vertice.
console.log('  di cui su un vertice acceso:', missingOnLitTip.length);
check(missing.length <= 1, `al massimo 1 punta nera sparisce (quella dell'arco acceso stesso). Trovate sparite: ${missing.length}`);
if (missing.length > 1) {
  console.log('  >>> REGRESSIONE CONFERMATA: la soppressione per coincidenza-vertice cancella anche la punta di archi NON eseguiti (es. la risalita del do-while) che condividono lo stesso punto d\'ingresso.');
}

console.log('\n=== ESITO indagine #1 ===');
console.log(fails===0 ? 'PASS (nessuna regressione)' : `FAIL (${fails}) — regressione confermata`);
process.exit(fails===0?0:1);

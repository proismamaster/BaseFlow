// Harness WP-D3 (2o giro) + WP-D9. Instrumenta il ctx per registrare le operazioni di disegno
// (punte = fill di un triangolo, con colore; linee = stroke, con globalAlpha) e verifica:
//  D3: durante l'esecuzione, NESSUNA punta NERA viene disegnata sul vertice dove l'overlay
//      disegna la punta ARANCIONE (prima "spuntava un pixel nero"). Deve esserci >=1 fill
//      ARANCIONE al vertice e ZERO fill NERI a quel vertice.
//  D9: con viewSettings.showGrid=true draw() traccia linee-griglia (globalAlpha 0.08); con false, 0.
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1000, H = 1000;
function makeApp() {
  const ops = []; // log delle operazioni di disegno
  let cur = { fillStyle:'#000', strokeStyle:'#000', globalAlpha:1, font:'', textAlign:'', textBaseline:'', lineWidth:1 };
  const pathPts = []; // punti dell'ultimo path (moveTo/lineTo) per identificare il vertice delle punte
  const ctxMock = {
    set fillStyle(v){cur.fillStyle=v;}, get fillStyle(){return cur.fillStyle;},
    set strokeStyle(v){cur.strokeStyle=v;}, get strokeStyle(){return cur.strokeStyle;},
    set globalAlpha(v){cur.globalAlpha=v;}, get globalAlpha(){return cur.globalAlpha;},
    set lineWidth(v){cur.lineWidth=v;}, get lineWidth(){return cur.lineWidth;},
    set font(v){cur.font=v;}, get font(){return cur.font;},
    set textAlign(v){cur.textAlign=v;}, get textAlign(){return cur.textAlign;},
    set textBaseline(v){cur.textBaseline=v;}, get textBaseline(){return cur.textBaseline;},
    beginPath(){ pathPts.length = 0; },
    moveTo(x,y){ pathPts.push([x,y]); },
    lineTo(x,y){ pathPts.push([x,y]); },
    quadraticCurveTo(){}, rect(){}, closePath(){},
    stroke(){ ops.push({op:'stroke', alpha:cur.globalAlpha, color:cur.strokeStyle, pts:pathPts.slice()}); },
    fill(){ ops.push({op:'fill', alpha:cur.globalAlpha, color:cur.fillStyle, tip:pathPts.length?pathPts[0].slice():null, pts:pathPts.slice()}); },
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
  return { run, ins, ops,
    clearOps:()=>{ ops.length=0; },
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type})))')),
    groups:(from,to,branch)=>JSON.parse(run(`JSON.stringify(computeEdgeGroups(${from},${to},${JSON.stringify(branch)}, true))`)) };
}
let fails=0; const check=(c,m)=>{ console.log((c?'  OK  ':'  FAIL')+' '+m); if(!c) fails++; };
const isOrange=(c)=>/ff9800|#ff9800/i.test(String(c));
const isBlack=(c)=>{ const s=String(c).toLowerCase().trim(); return s==='black'||s==='#000'||s==='#000000'||s==='rgb(0,0,0)'; };
const near=(a,b,tol)=>Math.abs(a-b)<=(tol||3);

// ---------- WP-D3 ----------
console.log('\n### WP-D3: nessuna punta NERA sotto la punta arancione accesa');
const app = makeApp();
app.ins('ff.type==="normal"','output');   // start(0) -> output(1) -> end(2)
// Transizione start(0)->output(1): l'arco 'normal' con la punta che atterra su output.
const groups = app.groups(0,1,null);
const litSegs = [].concat(...groups.map(g=>g.segs));
const litTip = litSegs.filter(s=>s.a).map(s=>[s.x2,s.y2])[0];
console.log('  litGroup segs:', litSegs.map(s=>`(${s.x1},${s.y1})->(${s.x2},${s.y2})${s.a?'*':''}`).join(' '), ' tip=', JSON.stringify(litTip));
check(!!litTip, 'la transizione ha una punta accesa (segmento a=true)');
// Imposta executingEdge come farebbe animateExecEdge (litGroup = ultimo gruppo, quello con la punta).
const giWithArrow = groups.map((g,i)=>({i,a:g.segs.some(s=>s.a)})).filter(o=>o.a).map(o=>o.i).pop();
app.run(`executingEdge = { from:0, to:1, branch:null, litGroup: computeEdgeGroups(0,1,null,true)[${giWithArrow}].segs, _grp:{from:0,to:1,branch:null,showRis:true,gi:${giWithArrow}} };`);
app.clearOps();
app.run('draw(nodi);');
const fillsAtTip = app.ops.filter(o=>o.op==='fill' && o.tip && litTip && near(o.tip[0],litTip[0]) && near(o.tip[1],litTip[1]));
const orangeAtTip = fillsAtTip.filter(o=>isOrange(o.color));
const blackAtTip  = fillsAtTip.filter(o=>isBlack(o.color));
console.log('  fill al vertice acceso:', fillsAtTip.map(o=>o.color).join(', ') || '(nessuno)');
check(orangeAtTip.length >= 1, 'c\'e\' >=1 punta ARANCIONE al vertice acceso');
check(blackAtTip.length === 0, 'ZERO punte NERE al vertice acceso (niente pixel nero che spunta)');
// Controprova: le ALTRE frecce (non accese) devono conservare la loro punta nera.
const allBlackFills = app.ops.filter(o=>o.op==='fill' && isBlack(o.color));
check(allBlackFills.length >= 1, 'le altre frecce mantengono la punta nera (soppressione mirata, non globale)');

// ---------- WP-D9 ----------
console.log('\n### WP-D9: griglia sul canvas (toggle)');
const app2 = makeApp();
app2.run('viewSettings.showGrid = false;');
app2.clearOps(); app2.run('draw(nodi);');
const gridOff = app2.ops.filter(o=>o.op==='stroke' && near(o.alpha,0.08,0.001)).length;
check(gridOff === 0, 'griglia OFF: nessuna linea-griglia (alpha 0.08)');
app2.run('viewSettings.showGrid = true;');
app2.clearOps(); app2.run('draw(nodi);');
// La griglia e' UN solo stroke() con molti sub-path (moveTo/lineTo per ogni linea): conto i PUNTI.
const gridStroke = app2.ops.find(o=>o.op==='stroke' && near(o.alpha,0.08,0.001));
const gridPts = gridStroke ? gridStroke.pts.length : 0;
console.log('  punti nel path griglia (ON):', gridPts);
check(gridPts > 40, 'griglia ON: molte linee-griglia disegnate (path con molti punti)');

console.log('\n=== ESITO D3+D9 ===');
console.log(fails===0 ? 'PASS' : `FAIL (${fails})`);
process.exit(fails===0?0:1);

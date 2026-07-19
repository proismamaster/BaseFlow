// WP-E1 (Ismail 2026-07-17): hover su un arco -> la linea rossa NON deve arrivare al vertice della
// punta (sborda), ma fermarsi alla BASE (come drawLine/overlay via _strokeExecSeg). Registra gli
// stroke del ctx: con hoverArc impostato su un arco con punta, la linea rossa piu' lunga deve avere
// lunghezza ~ len - cut (cut = min(9, len)), NON len.
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..'); const W = 1000, H = 1000;
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
    stroke(){ if(pathPts.length>=2) ops.push({op:'stroke', color:cur.strokeStyle, a:pathPts[0].slice(), b:pathPts[pathPts.length-1].slice()}); },
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
    frecce:()=>JSON.parse(run('JSON.stringify(frecce.map(f=>({from:f.fromNodeIndex,to:f.toNodeIndex,type:f.type,hasArrow:!!f.hasArrow,x1:f.inzioX,y1:f.inzioY,x2:f.fineX,y2:f.fineY})))')) };
}
let fails=0; const check=(c,m)=>{ console.log((c?'  OK  ':'  FAIL')+' '+m); if(!c) fails++; };
const isRed=(c)=>/e53935|#e53935|red/i.test(String(c));
const len=(a,b)=>Math.hypot(b[0]-a[0], b[1]-a[1]);

const app = makeApp();
app.ins('ff.type==="normal"','output'); // start(0)->output(1)->end(2); arco 0->1 con punta
const fr = app.frecce();
const arc = fr.find(f=>f.hasArrow && f.type==='normal');
console.log('arco su cui fare hover:', JSON.stringify(arc));
const fullLen = len([arc.x1,arc.y1],[arc.x2,arc.y2]);
const cut = Math.min(9, fullLen);
// Imposta hoverArc (kind 'arc') sull'arco.
app.run(`hoverArc = { kind:'seg', ax:${arc.x1}, ay:${arc.y1}, bx:${arc.x2}, by:${arc.y2} };`);
app.clearOps(); app.run('draw(nodi);');
// La linea rossa dell'hover per QUESTO arco: stroke rosso che parte da (x1,y1).
const redStrokes = app.ops.filter(o=>o.op==='stroke' && isRed(o.color) && Math.abs(o.a[0]-arc.x1)<=2 && Math.abs(o.a[1]-arc.y1)<=2);
console.log('  stroke rossi dall\'inizio arco:', redStrokes.map(o=>`(${o.a})->(${o.b}) len=${len(o.a,o.b).toFixed(1)}`).join(' '));
const redArrow = app.ops.filter(o=>o.op==='fill' && isRed(o.color) && o.tip && Math.abs(o.tip[0]-arc.x2)<=2 && Math.abs(o.tip[1]-arc.y2)<=2);
check(redStrokes.length >= 1, 'la linea rossa dell\'hover viene disegnata');
if (redStrokes.length) {
  const L = len(redStrokes[0].a, redStrokes[0].b);
  console.log(`  lunghezza linea rossa = ${L.toFixed(1)} (arco pieno=${fullLen.toFixed(1)}, atteso base=${(fullLen-cut).toFixed(1)})`);
  check(Math.abs(L - (fullLen - cut)) <= 1.5, 'la linea rossa si ferma alla BASE della punta (non al vertice)');
  check(L < fullLen - 1, 'la linea rossa NON arriva al vertice (niente sbavatura oltre la punta)');
}
check(redArrow.length >= 1, 'la punta rossa e\' disegnata al vertice');

console.log('\n=== ESITO WP-E1 (hover overshoot) ===');
console.log(fails===0 ? 'PASS' : `FAIL (${fails})`);
process.exit(fails===0?0:1);

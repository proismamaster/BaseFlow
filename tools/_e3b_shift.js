// Diagnosi WP-E3 problema 2 BIS (Ismail: "la freccia della discesa nella while viene RIDISEGNATA
// TRASLATA verso sinistra"). Cattura le punte ARANCIONI disegnate durante l'evidenziazione della
// transizione if->while, e le confronta col vertice NERO reale dell'arco if_join. Se l'arancione e'
// a x minore del nero -> shift a sinistra confermato + di quanto.
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
    stroke(){ if(pathPts.length>=2) ops.push({op:'stroke', color:cur.strokeStyle, pts:pathPts.slice()}); },
    fill(){ ops.push({op:'fill', color:cur.fillStyle, pts:pathPts.slice()}); },
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
  return { run, ins, ops, clearOps:()=>{ops.length=0;},
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type})))')),
    frecce:()=>JSON.parse(run('JSON.stringify(frecce.map((f,i)=>({i,type:f.type,from:f.fromNodeIndex,to:f.toNodeIndex,a:!!f.hasArrow,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY),ve:(f.visualExtra||[]).map(s=>[Math.round(s[0]),Math.round(s[1]),Math.round(s[2]),Math.round(s[3]),!!s[4]])})))')) };
}
const isOrange=(c)=>/ff9800/i.test(String(c));
const app = makeApp();
// IF DENTRO il corpo della WHILE: i due rami dell'if RIENTRANO nell'header (back-edge). Match screenshot.
app.ins('ff.type==="normal"','while');        // start(0) while(1) end(2)
app.ins('ff.type==="loop_body"','if');        // corpo della while = if(2); rami -> back alla while(1)
const nodes = app.nodes();
const ifIdx = nodes.findIndex(n=>n.t==='if'), whIdx = nodes.findIndex(n=>n.t==='while');
console.log('nodi:', JSON.stringify(nodes), ' if=',ifIdx,'while=',whIdx);
const fr = app.frecce();
console.log('frecce:');
fr.forEach(f=>console.log(`  #${f.i} ${f.type} ${f.from}->${f.to} a=${f.a} (${f.x1},${f.y1})->(${f.x2},${f.y2})`+(f.ve.length?` ve=${JSON.stringify(f.ve)}`:'')));
// Punte NERE reali: main con a=true, + ogni visualExtra con flag punta (s[4]).
const blackTips = [];
fr.forEach(f=>{ if(f.a) blackTips.push({src:f.type+'#main', tip:[f.x2,f.y2]}); f.ve.forEach(s=>{ if(s[4]) blackTips.push({src:f.type+'#ve', tip:[s[2],s[3]]}); }); });
console.log('TUTTE le punte NERE (main+visualExtra):', JSON.stringify(blackTips));
// L'arco che RIENTRA nella while dopo l'if (back-edge/if_join verso l'header).
const intoWh = fr.filter(f=>f.to===whIdx && f.a && f.from!==whIdx);
console.log('archi (neri) che rientrano nella while con punta:', JSON.stringify(intoWh.map(f=>({type:f.type,tip:[f.x2,f.y2]}))));

// Transizione if->while(true): back-edge (from>to) -> NON merge. Accendo tutti i gruppi per vedere le punte.
app.run(`
  _execBranch='true';
  var _g = computeEdgeGroups(${ifIdx}, ${whIdx}, 'true', true);
  var _all=[]; for (var k=0;k<_g.length;k++) _all=_all.concat(_g[k].segs);
  globalThis.__lit=_all; globalThis.__groups=_g;
  executingEdge = { from:${ifIdx}, to:${whIdx}, branch:'true', litGroup:_all, _grp:{from:${ifIdx},to:${whIdx},branch:'true',showRis:true,gi:'all'} };
`);
const groupsInfo = JSON.parse(app.run('JSON.stringify(__groups.map(g=>({type:g.type,segs:g.segs.map(s=>[s.x1,s.y1,s.x2,s.y2,!!s.a])})))'));
console.log('\ngruppi della transizione if->while(true):');
groupsInfo.forEach((g,i)=>console.log(`  ${i} ${g.type}: `+g.segs.map(s=>`(${s[0]},${s[1]})->(${s[2]},${s[3]})${s[4]?'*':''}`).join(' ')));
app.clearOps(); app.run('draw(nodi);');
const isBlk=(c)=>{const s=String(c).toLowerCase().trim();return s==='black'||s==='#000'||s==='#000000';};
const blackDrawn = app.ops.filter(o=>o.op==='fill' && isBlk(o.color) && o.pts.length>=3).map(o=>o.pts[0]);
console.log('\npunte NERE EFFETTIVAMENTE disegnate durante l\'esecuzione:', JSON.stringify(blackDrawn));
const orangeTips = app.ops.filter(o=>o.op==='fill' && isOrange(o.color) && o.pts.length>=3).map(o=>o.pts[0]);
console.log('\nvertici punte ARANCIONI disegnate durante l\'evidenziazione:', JSON.stringify(orangeTips));
// Per ogni punta arancione, la punta NERA piu' vicina in Y e il delta X (shift).
console.log('\nconfronto arancione vs nero (a parita\' di Y ~):');
orangeTips.forEach(p=>{
  const cand = blackTips.filter(b=>Math.abs(b.tip[1]-p[1])<=10).sort((a,b)=>Math.abs(a.tip[0]-p[0])-Math.abs(b.tip[0]-p[0]))[0];
  if (cand){ const dx=p[0]-cand.tip[0]; console.log(`  arancione (${p[0]},${p[1]}) vs nero ${cand.src} (${cand.tip[0]},${cand.tip[1]}) -> ${dx===0?'ALLINEATA':('shift '+(dx<0?'SINISTRA':'DESTRA')+' di '+Math.abs(dx)+'px')}`); }
  else console.log(`  arancione (${p[0]},${p[1]}) -> nessuna punta nera vicina in Y`);
});

// Diagnosi WP-E3 (Ismail 2026-07-17, screenshot): un IF i cui DUE rami vanno alla WHILE (la while
// e' il join dell'if). Due difetti riportati: (1) lo STELO verticale sotto l'if -- da cui partono i
// due archi orizzontali -- non si illumina; (2) l'arco verticale che scende nella while e' colorato
// male. Qui dumpo frecce[] + i gruppi/lit della transizione if.true -> while, per capire cosa manca.
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
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))')),
    frecce:()=>JSON.parse(run('JSON.stringify(frecce.map((f,i)=>({i,from:f.fromNodeIndex,to:f.toNodeIndex,type:f.type,a:!!f.hasArrow,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY),ve:(f.visualExtra||[]).map(s=>[Math.round(s[0]),Math.round(s[1]),Math.round(s[2]),Math.round(s[3]),!!s[4]])})))')),
    groups:(from,to,branch)=>JSON.parse(run(`JSON.stringify(computeEdgeGroups(${from},${to},${JSON.stringify(branch)}, true))`)) };
}
const app = makeApp();
// start(0) -> end(1); metti una while; poi un if PRIMA della while, rami vuoti -> la while e' il join.
app.ins('ff.type==="normal"','while');   // start(0) while(1) end(2)
app.ins('ff.type==="normal"&&ff.fromNodeIndex===0','if'); // start->if davanti alla while
console.log('nodi:', JSON.stringify(app.nodes()));
console.log('\nfrecce:');
app.frecce().forEach(f=>console.log(`  #${f.i} ${f.type} ${f.from}->${f.to} a=${f.a} (${f.x1},${f.y1})->(${f.x2},${f.y2})`+(f.ve.length?` ve=${JSON.stringify(f.ve)}`:'')));

const nodes = app.nodes();
const ifIdx = nodes.findIndex(n=>n.t==='if');
const whIdx = nodes.findIndex(n=>n.t==='while');
console.log(`\nif=${ifIdx} while=${whIdx}`);
for (const br of ['true','false']) {
  console.log(`\n== transizione if(${ifIdx}) -> while(${whIdx}) branch=${br} ==`);
  const gs = app.groups(ifIdx, whIdx, br);
  gs.forEach((g,i)=>console.log(`  gruppo ${i} type=${g.type}: ${g.segs.map(s=>`(${s.x1},${s.y1})->(${s.x2},${s.y2})${s.a?'*':''}`).join(' ')}`));
  const all = [].concat(...gs.map(g=>g.segs));
  console.log('  TUTTI i segmenti accesi:', all.map(s=>`(${s.x1},${s.y1})->(${s.x2},${s.y2})`).join(' '));
}

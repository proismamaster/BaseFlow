// Harness P5.5 (Ismail 2026-07-14, "voglio un arco alla volta, anche coi rami vuoti").
// While{If{}} con ENTRAMBI i rami dell'IF vuoti che rientrano nel while. Eseguendo la
// transizione if(2)->while(1) prendendo il ramo TRUE, l'highlight deve accendere:
//   - if_true (ramo preso)            -> ARANCIO
//   - back-edge del ciclo (ritorno)   -> ARANCIO  (il "while dopo l'if" che Ismail vuole vedere)
//   - if_false (ramo NON preso)       -> NERO     (il bug: prima si accendeva la sua verticale)
// Il mock del canvas registra ogni STROKE col colore corrente al momento dello stroke()
// (drawLine imposta strokeStyle DOPO lineTo, prima di stroke()).
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const REPO = path.join(__dirname, '..');
const W = 1000, H = 1000;
let strokes = []; // {x1,y1,x2,y2,c}
const ctxMock = {
  strokeStyle:'#000', fillStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle',
  _path:[],
  beginPath(){ this._path=[]; },
  moveTo(x,y){ this._path.push(['M',x,y]); },
  lineTo(x,y){ this._path.push(['L',x,y]); },
  quadraticCurveTo(){}, rect(){}, closePath(){},
  stroke(){ // emette i segmenti del path col colore CORRENTE
    for (let i=1;i<this._path.length;i++){ const a=this._path[i-1], b=this._path[i]; if(b[0]==='L') strokes.push({x1:Math.round(a[1]),y1:Math.round(a[2]),x2:Math.round(b[1]),y2:Math.round(b[2]),c:(''+this.strokeStyle).toLowerCase()}); }
  },
  fill(){}, clearRect(){ strokes=[]; }, fillText(){}, measureText(t){return{width:(t||'').length*8};},
  save(){}, restore(){}, setLineDash(){}, setTransform(){}, arc(){}
};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sandbox]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(context);
for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'), context, {filename:'execute.js'});
vm.runInContext('window.onload();', context);
const run=(c)=>vm.runInContext(c,context);
const ins=(f,t)=>{run(`frecceSelected=frecce.findIndex(ff=>${f});`); run(`inserisciNodo(${JSON.stringify(t)});`); run('draw(nodi);');};

run('draw(nodi);');
ins('ff.type==="normal"','while');
ins('ff.type==="loop_body"','if');
run('draw(nodi);');
const nodes = JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))'));
console.log('NODI:', JSON.stringify(nodes));

const arcs = JSON.parse(run('JSON.stringify(frecce.map(f=>({t:f.type,from:f.fromNodeIndex,to:f.toNodeIndex,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))'));
const ifTrue  = arcs.find(a=>a.t==='if_true'  && a.from===2 && a.to===1);
const ifFalse = arcs.find(a=>a.t==='if_false' && a.from===2 && a.to===1);
console.log('if_true :', JSON.stringify(ifTrue));
console.log('if_false:', JSON.stringify(ifFalse));

// transizione if(2)->while(1) ramo TRUE. NB: `strokes` e' la closure Node del mock,
// popolata da ctxMock durante il draw interno di highlightExecEdge (clearRect la resetta).
// NON leggerla via run(): quello leggerebbe una variabile OMONIMA del contesto VM.
run("_execBranch='true'; highlightExecEdge(2,1);");
const captured = strokes;
const ORANGE='#ff9800';
const isOrange=s=>s.c===ORANGE;
const near=(a,b)=>Math.abs(a-b)<=3;
const matches=(s,seg)=>(near(s.x1,seg.x1)&&near(s.y1,seg.y1)&&near(s.x2,seg.x2)&&near(s.y2,seg.y2))||(near(s.x1,seg.x2)&&near(s.y1,seg.y2)&&near(s.x2,seg.x1)&&near(s.y2,seg.y1));
const orange=captured.filter(isOrange);
const ifTrueLit  = orange.some(s=>matches(s,ifTrue));
const ifFalseLit = orange.some(s=>matches(s,ifFalse));
// back-edge: stroke arancione verticale su una colonna DIVERSA da if_true/if_false (il ritorno al while)
const backedgeLit = orange.some(s=> s.x1===s.x2 && Math.abs(s.x1-ifTrue.x1)>50 && Math.abs(s.x1-ifFalse.x1)>50 && Math.abs(s.y2-s.y1)>25);

console.log('\nARANCIONI:', JSON.stringify(orange));
console.log(`\nif_true acceso  (ATTESO true):  ${ifTrueLit}`);
console.log(`if_false acceso (ATTESO false): ${ifFalseLit}`);
console.log(`back-edge acceso(ATTESO true):  ${backedgeLit}`);

const pass = ifTrueLit===true && ifFalseLit===false && backedgeLit===true;
console.log('\n=== ESITO P5.5 (if->while ramo true: accende ramo giusto + ritorno, NON l\'altro ramo) ===');
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass?0:1);

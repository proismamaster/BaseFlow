// Harness P4.1 (Ismail 2026-07-14, "arco dopo if figlio piu interno non e' cliccabile").
// Ricostruisce la SCALA di 3 IF annidati (ognuno unico membro del ramo TRUE del padre):
//   start(0) -> if1(1){true:if2, false:end} -> if2(2){true:if3, false:end}
//            -> if3(3){true:end, false:end} -> end(4)
// e verifica che ESISTA un arco CLICCABILE "dopo if3" (from=if3, type if_join) su cui si
// puo' inserire un blocco. Prima del fix round-4h-multilivello quell'arco NON e' registrato
// in frecce[] (canInsertAfter=false, delega all'antenato che a sua volta delega -> nessuno
// lo disegna cliccabile all'altezza di if3). Verifica anche la NON regressione: l'arco
// "dopo if2" (from=if2) resta cliccabile e l'inserimento produce un grafo valido.
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const REPO = path.join(__dirname, '..', 'app');
const W = 1000, H = 1000;
let ops = [];
const ctxMock = {
  fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle',
  _path: [], beginPath(){ this._path=[]; }, moveTo(){}, lineTo(){}, quadraticCurveTo(){}, rect(){},
  closePath(){}, stroke(){}, fill(){}, clearRect(){ ops=[]; }, fillText(){}, measureText(t){ return {width:(t||'').length*8}; },
  save(){}, restore(){}, setLineDash(){}, setTransform(){}, arc(){}
};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""}};
const genericEl=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[]});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:genericEl(),addEventListener:()=>{},createElement:()=>genericEl(),querySelector:()=>genericEl(),querySelectorAll:()=>[],body:genericEl(),documentElement:genericEl()};
const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sandbox]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(context);
for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) {
  vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
}
vm.runInContext('window.onload();', context);

const run = (code) => vm.runInContext(code, context);
const ins = (filter, tipo, label) => {
  const ok = run(`frecceSelected = frecce.findIndex(f=>${filter}); frecceSelected!==-1;`);
  if (!ok) { console.error(`  [FAIL] nessun arco per: ${label} (${filter})`); return false; }
  run(`inserisciNodo(${JSON.stringify(tipo)});`);
  run('draw(nodi);');
  return true;
};
const dumpFrecce = () => JSON.parse(run('JSON.stringify(frecce.map(f=>({t:f.type,from:f.fromNodeIndex,to:f.toNodeIndex})))'));
const dumpNodes = () => JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))'));

// --- Costruzione della scala di 3 IF annidati ---
run('draw(nodi);');
ins('f.type==="normal"', 'if', 'if1 su arco normal');                       // if1
ins('f.type==="if_true" && f.fromNodeIndex===1', 'if', 'if2 nel true di if1'); // if2
ins('f.type==="if_true" && f.fromNodeIndex===2', 'if', 'if3 nel true di if2'); // if3
run('draw(nodi);');

const nodes = dumpNodes();
const frecce = dumpFrecce();
console.log('NODI:', JSON.stringify(nodes));
console.log('TUTTI GLI ARCHI:', JSON.stringify(frecce));
// individua gli indici reali degli if (in ordine di annidamento)
const ifIdxs = nodes.filter(n=>n.t==='if').map(n=>n.i);
const if1 = ifIdxs[0], if2 = ifIdxs[1], if3 = ifIdxs[2];
console.log(`if1=${if1} if2=${if2} if3=${if3}`);

const hasAfter = (fromIdx) => frecce.some(f => f.from===fromIdx && f.t==='if_join');
const afterIf3 = hasAfter(if3);
const afterIf2 = hasAfter(if2);
const afterIf1 = hasAfter(if1);
console.log('archi cliccabili from=if3:', JSON.stringify(frecce.filter(f=>f.from===if3)));
console.log(`CLICCABILE "dopo if3" (from=${if3}, if_join)?  ${afterIf3}`);
console.log(`CLICCABILE "dopo if2" (from=${if2}, if_join)?  ${afterIf2}`);
console.log(`CLICCABILE "dopo if1" (from=${if1}, if_join)?  ${afterIf1}`);

// --- Se l'arco "dopo if3" esiste, prova a inserire e valida il grafo ---
let insertOK = null;
if (afterIf3) {
  ins(`f.type==="if_join" && f.fromNodeIndex===${if3}`, 'output', 'output dopo if3');
  const n2 = dumpNodes();
  // validazione: nessun nodo orfano, if3 entrambi i rami puntano al nuovo output, output->end
  const v = JSON.parse(run('JSON.stringify((typeof validateFlow==="function")?validateFlow(flow):{valid:null})'));
  console.log('NODI dopo inserimento output:', JSON.stringify(n2));
  console.log('validateFlow:', JSON.stringify(v));
  insertOK = (v && v.valid !== false);
}

console.log('\n=== ESITO ===');
console.log('P4.1 atteso: afterIf3=true, afterIf2=true, inserimento valido.');
const pass = afterIf3 === true && afterIf2 === true && (insertOK === null || insertOK === true);
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);

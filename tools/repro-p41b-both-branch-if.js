// Harness P4.1-b (regressione round-4h). Costruisce il caso che round-4h temeva davvero:
// un IF "X" che e' UNICO membro del ramo TRUE di un antenato "A", e i cui DUE rami finiscono
// entrambi in un IF annidato (Yt nel true, Yf nel false). round-4h disabilitava le code
// per-ramo di X per paura dei "3 bersagli sovrapposti" (after-Yt, after-Yf, after-X). Con il
// fix P4.1 tutte e tre tornano cliccabili: qui si verifica che inserire su CIASCUNA rediriga
// SOLO l'IF corretto (entrambi i suoi rami) senza corrompere -> nessun "un ramo si allunga,
// l'altro no". Ogni scenario gira in un contesto VM FRESCO (reset pulito e totale).
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const REPO = path.join(__dirname, '..');
const W = 1000, H = 1000;

function freshApp() {
  let ops = [];
  const ctxMock = { fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle', _path:[], beginPath(){this._path=[];}, moveTo(){}, lineTo(){}, quadraticCurveTo(){}, rect(){}, closePath(){}, stroke(){}, fill(){}, clearRect(){ops=[];}, fillText(){}, measureText(t){return{width:(t||'').length*8};}, save(){}, restore(){}, setLineDash(){}, setTransform(){}, arc(){} };
  const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""}};
  const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[]});
  const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
  const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sandbox]',...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
  vm.runInContext('window.onload();', context);
  const run = (c) => vm.runInContext(c, context);
  const ins = (filter, tipo) => { const ok = run(`frecceSelected = frecce.findIndex(f=>${filter}); frecceSelected!==-1;`); if(!ok){console.error('  NO ARC:', filter); return false;} run(`inserisciNodo(${JSON.stringify(tipo)});`); run('draw(nodi);'); return true; };
  const nodes = () => JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))'));
  const validate = () => JSON.parse(run('JSON.stringify(validateFlow(flow))'));
  const arcs = () => JSON.parse(run('JSON.stringify(frecce.map(f=>({t:f.type,from:f.fromNodeIndex,to:f.toNodeIndex})))'));
  // Costruzione: A(true:X), X(true:Yt, false:Yf)
  run('draw(nodi);');
  ins('f.type==="normal"', 'if');                          // A
  ins('f.type==="if_true" && f.fromNodeIndex===1', 'if');  // X (unico membro true di A)
  ins('f.type==="if_true" && f.fromNodeIndex===2', 'if');  // Yt (true di X)
  ins('f.type==="if_false" && f.fromNodeIndex===2', 'if'); // Yf (false di X)
  run('draw(nodi);');
  const base = nodes();
  const ids = base.filter(n=>n.t==='if').map(n=>n.i);
  return { run, ins, nodes, validate, arcs, base, A:ids[0], X:ids[1], Yt:ids[2], Yf:ids[3] };
}

let fails = 0;
const check = (cond, msg) => { console.log((cond?'  OK  ':'  FAIL') + ' ' + msg); if(!cond) fails++; };

const b0 = freshApp();
console.log('BASE:', JSON.stringify(b0.base));
console.log(`A=${b0.A} X=${b0.X} Yt=${b0.Yt} Yf=${b0.Yf}`);
const a = b0.arcs();
check(a.some(f=>f.from===b0.Yt && f.t==='if_join'), `after-Yt (from=${b0.Yt}) cliccabile`);
check(a.some(f=>f.from===b0.Yf && f.t==='if_join'), `after-Yf (from=${b0.Yf}) cliccabile`);
check(a.some(f=>f.from===b0.X  && f.t==='if_join'), `after-X  (from=${b0.X}) cliccabile`);

// 1) Inserisci DOPO Yt -> ENTRAMBI i rami di Yt sul nuovo nodo, resto valido
const b1 = freshApp();
b1.ins(`f.type==="if_join" && f.fromNodeIndex===${b1.Yt}`, 'output');
let n1 = b1.nodes(); let v1 = b1.validate();
const newIdx1 = n1.findIndex(n=>n.t==='output');
check(v1.valid, 'dopo-Yt: grafo valido');
check(newIdx1>=0 && n1[b1.Yt] && n1[b1.Yt].next.true===String(newIdx1) && n1[b1.Yt].next.false===String(newIdx1), 'dopo-Yt: ENTRAMBI i rami di Yt -> nuovo nodo');
console.log('    ', JSON.stringify(n1));

// 2) Inserisci DOPO X -> ENTRAMBI i rami di X sul nuovo nodo
const b2 = freshApp();
b2.ins(`f.type==="if_join" && f.fromNodeIndex===${b2.X}`, 'output');
let n2 = b2.nodes(); let v2 = b2.validate();
const newIdx2 = n2.findIndex(n=>n.t==='output');
const endIdx2 = n2.findIndex(n=>n.t==='end');
// "Dopo X" con rami popolati: il nodo va DOPO l'intera struttura -> le uscite dei rami
// (Yt,Yf) convergono sull'output, output->end, e i rami PROPRI di X restano invariati
// (puntano ancora agli IF interni, NON all'output: e' "dopo X", non "dentro X").
const xUnchanged = n2[b2.X] && n2[b2.X].next.true!==String(newIdx2) && n2[b2.X].next.false!==String(newIdx2);
const outToEnd = newIdx2>=0 && n2[newIdx2].next===String(endIdx2);
const tailsConverge = n2.filter(n=>n.t==='if' && n.next && n.next.true===String(newIdx2) && n.next.false===String(newIdx2)).length >= 2;
check(v2.valid, 'dopo-X: grafo valido');
check(xUnchanged && outToEnd && tailsConverge, 'dopo-X: output DOPO tutto X (X intatto, code Yt/Yf -> output -> end)');
console.log('    ', JSON.stringify(n2));

console.log('\n=== ESITO P4.1-b (regressione round-4h) ===');
console.log(fails===0 ? 'PASS' : `FAIL (${fails})`);
process.exit(fails===0 ? 0 : 1);

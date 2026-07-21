#!/usr/bin/env node
// tools/repro-wp7-loop-body-arc.js — WP-7 (piano gravi P9.4+P9.3, 2026-07-19).
// Misura la LUNGHEZZA dell'arco d'ingresso al corpo di un ciclo (l'arco cliccabile
// 'loop_body' che va dal centro dell'esagono, cy, fino al bordo superiore del primo nodo
// del corpo). BUG: quella lunghezza cresce con l'ALTEZZA dell'esagono (condizione lunga) =
//   hexH/2 + LOOP_BODY_START_Y_OFFSET_PX
// -> con una condizione lunga il primo figlio finisce spinto in basso, con molto vuoto
// sopra (P9.4); in un while-in-while entrambi lunghi, l'arco del figlio è "alto quanto il
// padre" (P9.3). ATTESO DOPO IL FIX: lunghezza COSTANTE (~30px) indipendente dall'altezza.
// Uso: node tools/repro-wp7-loop-body-arc.js
const fs = require('fs'); const vm = require('vm');
const REPO = __dirname + '/../app';
const W = 1400, H = 2400;
let ops = [];
const ctxMock = {
  fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle', lineCap:'butt', lineJoin:'miter',
  _path: [], save(){}, restore(){}, setLineDash(){}, arc(){}, beginPath(){ this._path=[]; },
  moveTo(x,y){ this._path.push(['M',x,y]); }, lineTo(x,y){ this._path.push(['L',x,y]); },
  quadraticCurveTo(cx,cy,x,y){ this._path.push(['L',x,y]); },
  rect(x,y,w,h){ this._path.push(['M',x,y]); }, closePath(){}, stroke(){}, fill(){}, clearRect(){ ops=[]; }, fillText(){}, measureText(t){ return {width:(t||'').length*8}; }
};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""}};
const genericEl=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},removeChild:()=>{},remove:()=>{},setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,innerHTML:'',textContent:'',dataset:{},rows:[],getBoundingClientRect:()=>({width:0,height:0,left:0,top:0})});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0,clientWidth:W,clientHeight:H}:id==='tabVariabili'?{rows:[]}:genericEl(),addEventListener:()=>{},createElement:()=>genericEl(),querySelector:()=>genericEl(),querySelectorAll:()=>[],body:genericEl(),documentElement:{getAttribute:()=>null,style:{setProperty:()=>{}}}};
const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},getComputedStyle:()=>({getPropertyValue:()=>''}),Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(context);
for (const n of ['theme','state','safeEval','utils','variables','layout','rendering','popups','interaction','fileIO','init']) {
  vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
}
vm.runInContext('window.onload();', context);
const run = (code) => vm.runInContext(code, context);
// Costruisce il flow DIRETTAMENTE (bypassa il path UI di inserimento, i cui quirk sui
// self-loop vuoti non c'entrano con ciò che misuriamo qui) + ricostruisce `nodi` come fa
// fileIO, poi layout+draw. `nodes` è l'array logico; info opzionale per condizione lunga.
function build(nodes){
  run('flow=' + JSON.stringify({ nodes }) + ';');
  // valida che il grafo sia coerente (evita di misurare su un grafo malformato)
  const v = run('validateFlow(flow)');
  if (!v.valid) throw new Error('flow non valido: ' + JSON.stringify(v.errors));
  run('nodi=flow.nodes.map(function(n){return {relX:0.35,relY:0.05,width:100,height:40,color:"white",text:(n.type||"")};}); calcoloY(nodi); draw(nodi);');
}
function redraw(){ run('calcoloY(nodi); draw(nodi);'); }
// Lunghezza dell'arco 'loop_body' che entra nel corpo del ciclo di indice loopIdx.
function loopBodyArcLen(loopIdx){
  return run(`(function(){var a=frecce.find(f=>f.type==='loop_body'&&f.fromNodeIndex===${loopIdx}); if(!a)return null; return Math.round(Math.abs(a.fineY-a.inzioY));})()`);
}
function hexH(idx){ return run(`Math.round(nodi[${idx}].height)`); }

let pass=0, fail=0; const fails=[];
function check(name, cond, extra){ if(cond){pass++;console.log('  OK   '+name);} else {fail++;fails.push(name+(extra?' -- '+extra:''));console.log('  FAIL '+name+(extra?' -- '+extra:''));} }

const LONG = 'contatoreMoltoLungo < limiteSuperiore && altraCondizione != 0 && ancoraUnaltra > 123';

// while (idx1) con 1 nodo nel corpo (assign idx2), uscita = end (idx3).
const WHILE_1BODY = [
  { type:'start', next:'1' },
  { type:'while', next:{ true:'2', false:'3' } },
  { type:'assign', info:'x = x + 1', next:'1' },
  { type:'end', next:null }
];
// --- Caso A: condizione CORTA ---
build(WHILE_1BODY);
const shortLen = loopBodyArcLen(1); const shortH = hexH(1);

// --- Caso B: STESSA topologia, condizione LUNGA (esagono alto) ---
const WHILE_1BODY_LONG = JSON.parse(JSON.stringify(WHILE_1BODY)); WHILE_1BODY_LONG[1].info = LONG;
build(WHILE_1BODY_LONG);
const longLen = loopBodyArcLen(1); const longH = hexH(1);

console.log('=== A/B: arco corpo vs altezza esagono ===');
console.log('  corto: hexH='+shortH+' arcoLen='+shortLen+'  |  lungo: hexH='+longH+' arcoLen='+longLen);
check('B: la condizione lunga ALZA davvero l\'esagono (setup valido)', longH > shortH + 20, 'shortH='+shortH+' longH='+longH);
// IL FIX: l'arco NON deve crescere con l'altezza -> lunghezza ~costante fra corto e lungo.
check('arco corpo COSTANTE fra esagono corto e alto (|diff|<=4)', Math.abs(longLen - shortLen) <= 4, 'short='+shortLen+' long='+longLen+' diff='+Math.abs(longLen-shortLen));
check('arco corpo piccolo anche con esagono alto (<=40px)', longLen <= 40, 'longLen='+longLen);

// --- Caso C: while-in-while, ENTRAMBI condizione lunga (P9.3) ---
// 0 start -> 1 whileEsterno{true:2,false:4} -> 2 whileInterno{true:3,false:1} -> 3 assign(next:2) -> 4 end
build([
  { type:'start', next:'1' },
  { type:'while', info:LONG, next:{ true:'2', false:'4' } },
  { type:'while', info:LONG, next:{ true:'3', false:'1' } },
  { type:'assign', info:'x = x + 1', next:'2' },
  { type:'end', next:null }
]);
const outerLen = loopBodyArcLen(1), innerLen = loopBodyArcLen(2);
console.log('=== C: while-in-while entrambi lunghi ===');
console.log('  esterno arcoLen='+outerLen+'  interno arcoLen='+innerLen);
check('C: arco del figlio NON "alto quanto il padre" (interno piccolo, <=40)', innerLen != null && innerLen <= 40, 'inner='+innerLen);
check('C: arco esterno anch\'esso piccolo (<=40)', outerLen != null && outerLen <= 40, 'outer='+outerLen);

// --- Caso D: anti-overlap con esagono ALTO e più nodi nel corpo (P9.4 "in cima" + sicurezza) ---
// 0 start -> 1 while(cond lunga){true:2,false:5} -> 2 assign -> 3 print -> 4 assign(next:1) -> 5 end
build([
  { type:'start', next:'1' },
  { type:'while', info:LONG, next:{ true:'2', false:'5' } },
  { type:'assign', info:'x = x + 1', next:'3' },
  { type:'print', info:'"riga"', next:'4' },
  { type:'assign', info:'y = y - 1', next:'1' },
  { type:'end', next:null }
]);
const box = (i)=>run(`(function(){var v=nodi[${i}];return {cx:v.relX*w,cy:v.relY*h,l:v.relX*w-v.width/2,r:v.relX*w+v.width/2,t:v.relY*h-v.height/2,b:v.relY*h+v.height/2};})()`);
const hex = box(1), first = box(2), exit = box(5);
function overlap(a,b){ return !(a.r<=b.l||a.l>=b.r||a.b<=b.t||a.t>=b.b); }
console.log('=== D: esagono alto + corpo multiplo ===');
console.log('  hex.cy='+Math.round(hex.cy)+' hex.b='+Math.round(hex.b)+' | first.t='+Math.round(first.t)+' | exit.t='+Math.round(exit.t));
check('D: primo figlio IN CIMA (top a ~arco costante da cy, non spinto al fondo dell\'esagono)', first.t < hex.cy + 40 && first.t < hex.b, 'first.t='+Math.round(first.t)+' hex.cy='+Math.round(hex.cy)+' hex.b='+Math.round(hex.b));
check('D: primo figlio NON si sovrappone all\'esagono', !overlap(hex, first));
check('D: uscita del ciclo SOTTO l\'esagono (nessun overlap)', exit.t > hex.b && !overlap(hex, exit), 'exit.t='+Math.round(exit.t)+' hex.b='+Math.round(hex.b));

console.log('\n=== TOTALE: '+pass+'/'+(pass+fail)+' PASS ===');
if (fail){ console.error('FALLITI:'); fails.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('=== repro-wp7-loop-body-arc: OK ===');

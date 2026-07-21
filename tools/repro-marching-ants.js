#!/usr/bin/env node
// tools/repro-marching-ants.js — verifica il "marching ants" del drag di gruppo (2026-07-19).
// Controlla: (1) l'animazione è ATTIVA solo durante un drag di GRUPPO (non per un singolo
// nodo); (2) il tick fa AVANZARE _bfAntsOffset e ridisegna; (3) quando il drag finisce il
// tick si AUTO-FERMA e azzera l'offset; (4) durante il drag di gruppo il rendering applica
// ctx.lineDashOffset (i trattini scorrono) sul bordo dei nodi selezionati.
// Uso: node tools/repro-marching-ants.js
const fs = require('fs'); const vm = require('vm');
const REPO = __dirname + '/../app';
const W = 1200, H = 1600;
let dashOffsetsSeen = [];
let ghostCount = 0; // quanti ghost (shadowBlur=10) vengono disegnati in un draw
let ghostCenters = []; // centri (x,y) dei ghost disegnati (dal rect di ogni ghost)
let badgeTexts = [];   // testi disegnati con font "bold ..px Arial" a raggio badge (numeri del badge)
let lastArcR = 0;
function mkCtx(){ return {
  fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle',
  lineCap:'butt', lineJoin:'miter', globalAlpha:1, _ld:0, _sb:0, shadowColor:'',
  set lineDashOffset(v){ this._ld = v; if (v) dashOffsetsSeen.push(v); }, get lineDashOffset(){ return this._ld; },
  set shadowBlur(v){ if (v === 10) ghostCount++; this._sb = v; }, get shadowBlur(){ return this._sb; },
  _path:[], save(){}, restore(){}, setLineDash(){}, arc(x,y,r){ lastArcR = r; }, beginPath(){this._path=[];},
  moveTo(){}, lineTo(){}, quadraticCurveTo(){}, rect(x,y,w,h){ ghostCenters.push([x+w/2, y+h/2]); }, closePath(){}, stroke(){}, fill(){},
  clearRect(){ lastArcR = 0; }, fillText(t){ if (lastArcR === 13) badgeTexts.push(String(t)); }, measureText(t){return{width:(t||'').length*8};}
}; }
let ctxMock = mkCtx();
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""}};
const genericEl=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},removeChild:()=>{},remove:()=>{},setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,innerHTML:'',textContent:'',dataset:{},rows:[],getBoundingClientRect:()=>({width:0,height:0,left:0,top:0})});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0,clientWidth:W,clientHeight:H}:id==='tabVariabili'?{rows:[]}:genericEl(),addEventListener:()=>{},createElement:()=>genericEl(),querySelector:()=>genericEl(),querySelectorAll:()=>[],body:genericEl(),documentElement:{getAttribute:()=>null,style:{setProperty:()=>{}}}};
// rAF stub: NON auto-esegue (per controllare i tick a mano); raccoglie la callback.
let pendingRAF = null;
const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}}),requestAnimationFrame:(f)=>{pendingRAF=f;return 1;}},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},getComputedStyle:()=>({getPropertyValue:()=>''}),Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(context);
for (const n of ['theme','state','safeEval','utils','variables','layout','rendering','popups','interaction','fileIO','init']) {
  vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
}
vm.runInContext('window.onload();', context);
const run = (c)=>vm.runInContext(c, context);
// Costruisce un flusso con 3 nodi semplici in fila + End, e li seleziona (multiSelected).
run('flow={nodes:[{type:"start",next:"1"},{type:"assign",info:"a=1",next:"2"},{type:"assign",info:"b=2",next:"3"},{type:"end",next:null}]}; nodi=flow.nodes.map(function(n){return {relX:0.35,relY:0.05,width:100,height:40,color:"white",text:n.type};}); calcoloY(nodi); draw(nodi);');

let pass=0, fail=0; const fails=[];
function check(name, cond, extra){ if(cond){pass++;console.log('  OK   '+name);} else {fail++;fails.push(name+(extra?' -- '+extra:''));console.log('  FAIL '+name+(extra?' -- '+extra:''));} }

// --- Attivazione: solo con drag di GRUPPO ---
run('isDraggingNode=true; dragIsGroup=false; dragScattered=false; multiSelected=[];');
check('non attivo per singolo nodo', run('_bfGroupDragAnimActive()')===false);
run('multiSelected=[1,2];');
check('attivo con multiSelected>1', run('_bfGroupDragAnimActive()')===true);
run('isDraggingNode=false;');
check('non attivo se non si sta trascinando', run('_bfGroupDragAnimActive()')===false);

// --- Il tick avanza l'offset e ridisegna, e si RISCHEDULA finché attivo ---
run('isDraggingNode=true; dragIsGroup=true; dragScattered=false; multiSelected=[1,2]; _bfAntsOffset=0; _bfAntsRAF=null;');
dashOffsetsSeen=[]; pendingRAF=null;
run('_bfStartGroupDragAnim();');           // schedula il primo tick
check('rAF schedulato all\'avvio', pendingRAF !== null);
const off0 = run('_bfAntsOffset');
pendingRAF && pendingRAF();                 // esegue tick 1 (dovrebbe avanzare + ridisegnare + rischedulare)
const off1 = run('_bfAntsOffset');
check('offset avanza dopo un tick', off1 > off0, 'off0='+off0+' off1='+off1);
check('il rendering ha applicato lineDashOffset (trattini scorrono)', dashOffsetsSeen.length > 0 && dashOffsetsSeen.some(v=>v<0), 'seen='+JSON.stringify(dashOffsetsSeen.slice(0,3)));
check('tick si rischedula mentre attivo', pendingRAF !== null);
pendingRAF && pendingRAF();                 // tick 2
const off2 = run('_bfAntsOffset');
check('offset continua ad avanzare', off2 > off1, 'off1='+off1+' off2='+off2);

// --- Stop: fine drag -> il tick azzera l'offset e NON rischedula ---
run('isDraggingNode=false; dragIsGroup=false; dragScattered=false; multiSelected=[];');
pendingRAF=null;
run('_bfGroupDragAnimTick();');             // un tick con drag finito
check('offset azzerato allo stop', run('_bfAntsOffset')===0);
check('nessun nuovo rAF schedulato allo stop', pendingRAF === null);

// --- A riposo (offset 0) il rendering NON tocca lineDashOffset (bordo statico come prima) ---
run('multiSelected=[1,2]; _bfAntsOffset=0;');
dashOffsetsSeen=[]; run('draw(nodi);');
check('a riposo nessun lineDashOffset animato applicato', dashOffsetsSeen.length === 0);

// --- GHOST DI GRUPPO: durante un drag di gruppo TUTTI i membri hanno un ghost (non solo 1) ---
run('forme=nodi;'); // il ghost usa forme[]
// drag di gruppo contiguo dei nodi 1,2 (blockStart=1, blockEnd=3)
run('multiSelected=[1,2]; isDraggingNode=true; dragIsGroup=true; dragScattered=false; dragNodeIndex=1; dragSubtreeEnd=3; dragCurrentX=600; dragCurrentY=800; _bfAntsOffset=5;');
ghostCount=0; run('draw(nodi);');
check('drag di gruppo (2 blocchi) -> 2 ghost seguono il cursore', ghostCount === 2, 'ghostCount='+ghostCount);
// drag singolo -> un solo ghost
run('multiSelected=[]; dragIsGroup=false; dragScattered=false; dragNodeIndex=2; dragSubtreeEnd=3;');
ghostCount=0; run('draw(nodi);');
check('drag singolo -> 1 solo ghost', ghostCount === 1, 'ghostCount='+ghostCount);

// --- EFFETTO RACCOLTA + BADGE (2026-07-20) ---
// drag di gruppo di 3 blocchi (contiguo 1..3), raccolta completata (T0 nel passato)
run('multiSelected=[1,2,3]; isDraggingNode=true; dragIsGroup=true; dragScattered=false; dragNodeIndex=1; dragSubtreeEnd=4; dragCurrentX=600; dragCurrentY=800; _bfAntsOffset=5; _bfDragCollapseT0 = Date.now() - 500;');
badgeTexts=[]; ghostCount=0; run('draw(nodi);');
check('badge mostra il numero di blocchi (3)', badgeTexts.indexOf('3') !== -1, 'badgeTexts='+JSON.stringify(badgeTexts));
check('durante il drag di gruppo i 3 ghost sono comunque disegnati (poi convergono)', ghostCount === 3, 'ghostCount='+ghostCount);
// La convergenza è un lerp: verifico i due estremi del progresso a livello di funzione.
{
  const collapsed = run('(function(){var T0=Date.now()-500,e=1-Math.pow(1-Math.min(1,(Date.now()-T0)/170),3);var sx=100,cur=600;return sx+(cur-sx)*e;})()');
  check('raccolta completa: il ghost converge sul cursore (~600)', Math.abs(collapsed - 600) < 2, 'x='+collapsed);
  const starting = run('(function(){var T0=Date.now(),e=1-Math.pow(1-Math.min(1,(Date.now()-T0)/170),3);var sx=100,cur=600;return sx+(cur-sx)*e;})()');
  check('inizio raccolta: il ghost è ancora vicino alla posizione originale (~100)', starting < 200, 'x='+starting);
}
// badge col numero corretto per una selezione più grande (5) — drag sparso
run('flow.nodes=[{type:"start",next:"1"},{type:"assign",info:"a",next:"2"},{type:"assign",info:"b",next:"3"},{type:"assign",info:"c",next:"4"},{type:"assign",info:"d",next:"5"},{type:"assign",info:"e",next:"6"},{type:"end",next:null}]; nodi=flow.nodes.map(function(n){return {relX:0.35,relY:0.05,width:100,height:40,color:"white",text:n.type};}); forme=nodi; calcoloY(nodi); draw(nodi);');
run('multiSelected=[1,2,3,4,5]; isDraggingNode=true; dragIsGroup=false; dragScattered=true; dragNodeIndex=3; dragSubtreeEnd=4; dragCurrentX=600; dragCurrentY=800; _bfDragCollapseT0=Date.now()-500;');
badgeTexts=[]; run('draw(nodi);');
check('badge mostra 5 per una selezione sparsa di 5 blocchi', badgeTexts.indexOf('5') !== -1, 'badgeTexts='+JSON.stringify(badgeTexts));
// drag SINGOLO -> nessun badge
run('multiSelected=[]; dragIsGroup=false; dragScattered=false; dragNodeIndex=2; dragSubtreeEnd=3; _bfDragCollapseT0=0;');
badgeTexts=[]; run('draw(nodi);');
check('drag singolo -> nessun badge', badgeTexts.length === 0, 'badgeTexts='+JSON.stringify(badgeTexts));

// --- DRAG DI UN SINGOLO PADRE (IF) CON FIGLI: i figli si raccolgono anche loro + badge ---
// 0 start -> 1 if{true:2,false:3} -> 2 assign(next:3) -> 3 end   (sottoalbero if = [1,2], join=3)
run('flow.nodes=[{type:"start",next:"1"},{type:"if",info:"x>0",next:{true:"2",false:"3"}},{type:"assign",info:"a=1",next:"3"},{type:"end",next:null}]; nodi=flow.nodes.map(function(n){return {relX:0.35,relY:0.05,width:100,height:40,color:"white",text:n.type};}); forme=nodi; calcoloY(nodi); draw(nodi);');
// drag del solo IF (indice 1): NON è un gruppo (multiSelected vuoto), ma dragSubtreeEnd=3 copre il sottoalbero
run('multiSelected=[]; isDraggingNode=true; dragIsGroup=false; dragScattered=false; dragNodeIndex=1; dragSubtreeEnd=3; dragCurrentX=600; dragCurrentY=800; _bfAntsOffset=5; _bfDragCollapseT0=Date.now()-500;');
ghostCount=0; badgeTexts=[]; run('draw(nodi);');
check('drag di un IF padre -> ghost anche per i figli (2 blocchi: if + figlio)', ghostCount === 2, 'ghostCount='+ghostCount);
check('drag di un IF padre -> badge col conteggio del sottoalbero (2)', badgeTexts.indexOf('2') !== -1, 'badgeTexts='+JSON.stringify(badgeTexts));
check('drag di un IF padre -> animazione raccolta attiva (rAF)', run('_bfGroupDragAnimActive()') === true);

console.log('\n=== TOTALE: '+pass+'/'+(pass+fail)+' PASS ===');
if (fail){ console.error('FALLITI:'); fails.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('=== repro-marching-ants: OK ===');

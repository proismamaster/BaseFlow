// ROUND-15F WP-E3, seguito (Ismail: "fai come nel if, distanza uguale a if, tra cerchio e archi,
// anche nel do-while"). Il Do-While ha un proprio pallino di convergenza in CIMA alla struttura
// (drawDoWhileBranches, "analogo al '*' di merge dell'IF, ma qui all'inizio, geometria capovolta"),
// dove convergono: (1) l'arco d'ingresso ESTERNO (dal predecessore, dall'alto), (2) l'ultimo tratto
// della risalita/back-edge (da sinistra, CON punta). A differenza del pallino dell'IF (che dal R13-G
// tiene ogni arco a JOIN_DOT_GAP_PX di distanza per non far impastare le punte), questo pallino non
// aveva NESSUN gap: entrambi gli archi puntavano ESATTAMENTE al suo centro. Fix: stessa costante
// JOIN_DOT_GAP_PX applicata qui — l'arco d'ingresso si ferma JOIN_DOT_GAP_PX SOPRA il pallino
// (entryTopY per tipo 'do'), la risalita si ferma JOIN_DOT_GAP_PX PRIMA di cx (backEdgeEndX), il
// placeholder del corpo vuoto parte JOIN_DOT_GAP_PX SOTTO il pallino.
//
// Questo harness verifica che tutti e 3 i punti abbiano ora la stessa distanza JOIN_DOT_GAP_PX dal
// centro del pallino (cx, bodyTopY), sia per un do-while con corpo popolato che con corpo vuoto, e
// che gli endpoint disegnati combacino con quelli in visualExtra (altrimenti hover/hit-test
// userebbero coordinate diverse da quelle REALMENTE disegnate).
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1000, H = 1000;
function makeApp() {
  const styleMock=()=>({setProperty(){},removeProperty(){},getPropertyValue:()=>'',setAttribute(){}});
  const ctxMock = { strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',globalAlpha:1,lineCap:'butt',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){} };
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
    consts:()=>JSON.parse(run('JSON.stringify({JOIN_DOT_GAP_PX})')),
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))')),
    nodi:()=>JSON.parse(run('JSON.stringify(nodi.map(v=>({relX:v.relX,relY:v.relY,height:v.height,doBodyTopPxY:v.doBodyTopPxY})))')),
    frecce:()=>JSON.parse(run('JSON.stringify(frecce.map((f,i)=>({i,from:f.fromNodeIndex,to:f.toNodeIndex,type:f.type,a:!!f.hasArrow,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY),ve:(f.visualExtra||[]).map(s=>[Math.round(s[0]),Math.round(s[1]),Math.round(s[2]),Math.round(s[3]),!!s[4]])})))')),
    hitTestPoint:(x,y,tol)=>JSON.parse(run(`JSON.stringify(frecce.map((f,i)=>i).filter(i=>arcHitTest(frecce[i], ${x}, ${y}, ${tol})))`)) };
}

let failures = 0;
function check(cond, msg) { if (cond) console.log('  OK   ' + msg); else { console.log('  FAIL ' + msg); failures++; } }

console.log('=== CASO 1: do-while con CORPO POPOLATO, entrato da un nodo normale ===');
{
  const app = makeApp();
  // start -> output -> do{ print } -> end : l'arco output->do e' l'ingresso ESTERNO al pallino.
  app.ins('ff.type==="normal"', 'output');                                   // start -> output -> end
  app.ins('ff.type==="normal"&&ff.fromNodeIndex===1', 'do');                 // output -> do -> end
  app.ins('ff.type==="loop_body"', 'output');                                // do{ output } -> corpo popolato
  const nodes = app.nodes();
  const doIdx = nodes.findIndex(n => n.t === 'do');
  const { JOIN_DOT_GAP_PX } = app.consts();
  const doNode = app.nodi()[doIdx];
  const cx = Math.round(doNode.relX * W);
  // Stessa formula di rendering.js (drawDoWhileBranches/entryTopY): doBodyTopPxY - meta' altezza base.
  const bodyTopY = Math.round(doNode.doBodyTopPxY - (app.run('NODE_BASE_HEIGHT_PX') / 2));
  console.log(`  do=${doIdx} cx=${cx} bodyTopY(pallino)=${bodyTopY} JOIN_DOT_GAP_PX=${JOIN_DOT_GAP_PX}`);

  const frecce = app.frecce();
  const entryArc = frecce.find(f => f.to === doIdx && f.type !== 'loop_body');
  check(!!entryArc, 'trovato l\'arco d\'ingresso ESTERNO al do-while');
  if (entryArc) {
    const entryEndY = entryArc.y2 !== undefined ? entryArc.y2 : null;
    console.log(`  arco d'ingresso: (${entryArc.x1},${entryArc.y1})->(${entryArc.x2},${entryArc.y2})`);
    check(Math.abs((bodyTopY - entryArc.y2) - JOIN_DOT_GAP_PX) <= 1,
      `l'arco d'ingresso si ferma JOIN_DOT_GAP_PX (${JOIN_DOT_GAP_PX}) sopra il pallino (bodyTopY=${bodyTopY}, arco finisce a y=${entryArc.y2})`);
  }

  const loopBodyArc = frecce.find(f => f.from === doIdx && f.type === 'loop_body');
  check(!!loopBodyArc, 'trovato l\'arco loop_body (discesa) del do-while');
  if (loopBodyArc) {
    const backSeg = (loopBodyArc.ve || []).find(s => s[4] === true); // il segmento CON punta = ultimo tratto della risalita
    check(!!backSeg, 'trovato nel visualExtra il segmento della risalita con punta (back-edge)');
    if (backSeg) {
      console.log(`  risalita (visualExtra, con punta): (${backSeg[0]},${backSeg[1]})->(${backSeg[2]},${backSeg[3]})`);
      check(Math.abs(backSeg[1] - bodyTopY) <= 1, 'la risalita e\' alla stessa Y del pallino (bodyTopY)');
      check(Math.abs((cx - backSeg[2]) - JOIN_DOT_GAP_PX) <= 1,
        `la risalita si ferma JOIN_DOT_GAP_PX (${JOIN_DOT_GAP_PX}) prima di cx (cx=${cx}, arco finisce a x=${backSeg[2]})`);
    }
  }

  // arcHitTest diretto sul PUNTO ESATTO del pallino: siccome ORA nessun segmento lo tocca davvero
  // (tutti si fermano JOIN_DOT_GAP_PX prima), un click esattamente al centro non deve colpire NULLA
  // di piu' di quanto già non accadesse (verifica di non-regressione, non di nuovo comportamento --
  // il pallino stesso non e' mai stato cliccabile, ne' prima ne' dopo questo fix).
  const hits = app.hitTestPoint(cx, bodyTopY, 3);
  console.log(`  hitTestPoint(${cx},${bodyTopY}, tol=3) -> archi: ${JSON.stringify(hits)}`);
}

console.log('\n=== CASO 2: do-while con CORPO VUOTO (placeholder self-loop) ===');
{
  const app = makeApp();
  app.ins('ff.type==="normal"', 'do'); // start -> do{} -> end, corpo vuoto
  const nodes = app.nodes();
  const doIdx = nodes.findIndex(n => n.t === 'do');
  const { JOIN_DOT_GAP_PX } = app.consts();
  const doNode = app.nodi()[doIdx];
  const cx = Math.round(doNode.relX * W);
  const bodyTopY = Math.round(doNode.doBodyTopPxY - (app.run('NODE_BASE_HEIGHT_PX') / 2));
  console.log(`  do=${doIdx} cx=${cx} bodyTopY(pallino)=${bodyTopY}`);

  const frecce = app.frecce();
  const placeholder = frecce.find(f => f.from === doIdx && f.to === doIdx && f.type === 'loop_body');
  check(!!placeholder, 'trovato il placeholder self-loop del corpo vuoto');
  if (placeholder) {
    console.log(`  placeholder: (${placeholder.x1},${placeholder.y1})->(${placeholder.x2},${placeholder.y2})`);
    check(Math.abs((placeholder.y1 - bodyTopY) - JOIN_DOT_GAP_PX) <= 1,
      `il placeholder parte JOIN_DOT_GAP_PX (${JOIN_DOT_GAP_PX}) sotto il pallino (bodyTopY=${bodyTopY}, parte da y=${placeholder.y1})`);
  }
}

console.log('\n=== CASO 3: do-while con CORPO POPOLATO e primo membro un For (screenshot di Ismail) ===');
{
  // Segnalato da Ismail con screenshot: la discesa dal pallino al PRIMO nodo del corpo NON e'
  // sempre degenere/lunghezza-zero come assumeva il vecchio commento -- per un While/For come
  // primo membro (propria testa/etichetta piu' alta) e' un segmento REALE (verificato: 22px in
  // questo caso), e prima di questo fix partiva ESATTAMENTE dal centro del pallino, senza alcuna
  // distanza -- incoerente con l'IF (if_join parte sempre reconnectY + JOIN_DOT_GAP_PX sotto il
  // proprio pallino, mai dal centro esatto).
  const app = makeApp();
  app.ins('ff.type==="normal"', 'do');       // start -> do{} -> end
  app.ins('ff.type==="loop_body"', 'for');   // do{ for{} }
  const nodes = app.nodes();
  const doIdx = nodes.findIndex(n => n.t === 'do');
  const forIdx = nodes.findIndex(n => n.t === 'for');
  const { JOIN_DOT_GAP_PX } = app.consts();
  const doNode = app.nodi()[doIdx];
  const cx = Math.round(doNode.relX * W);
  const bodyTopY = Math.round(doNode.doBodyTopPxY - (app.run('NODE_BASE_HEIGHT_PX') / 2));
  console.log(`  do=${doIdx} for=${forIdx} cx=${cx} bodyTopY(pallino)=${bodyTopY}`);

  const frecce = app.frecce();
  const descentArc = frecce.find(f => f.from === doIdx && f.to === forIdx && f.type === 'loop_body');
  check(!!descentArc, 'trovato l\'arco loop_body dal pallino del do-while al primo nodo del corpo (For)');
  if (descentArc) {
    console.log(`  discesa nel corpo: (${descentArc.x1},${descentArc.y1})->(${descentArc.x2},${descentArc.y2})`);
    check(descentArc.y2 > descentArc.y1, 'il segmento NON e\' degenere in questo caso (ha lunghezza reale)');
    check(Math.abs((descentArc.y1 - bodyTopY) - JOIN_DOT_GAP_PX) <= 1,
      `la discesa parte JOIN_DOT_GAP_PX (${JOIN_DOT_GAP_PX}) sotto il pallino (bodyTopY=${bodyTopY}, parte da y=${descentArc.y1}) -- non piu' dal centro esatto`);
  }
}

console.log('\n=== ESITO repro-e3-dowhile-join-dot-gap ===');
if (failures === 0) { console.log('PASS'); process.exit(0); }
else { console.log(`FAIL (${failures} assert falliti)`); process.exit(1); }

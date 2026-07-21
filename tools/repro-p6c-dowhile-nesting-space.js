// Harness P6.2 (round 15-B S6, Ismail 2026-07-15, screenshot 170939 "do-while annidati: archi
// False sovrapposti"). Verifica che il back-edge (arco di ritorno, lato sinistro) di un
// Do-While riservi SEMPRE spazio sufficiente quando contiene un Do-While annidato -- non solo
// quando il Do-While esterno sta nel flusso principale, ma anche quando e' lui stesso annidato
// dentro il corpo di un While o dentro il ramo di un If (la domanda di Ismail: "lo spazio deve
// essere garantito anche quando lo fai annidato in un ciclo o in un altro if").
//
// Metodo: per ogni scenario, individua via frecce[] (visualExtra dell'arco 'loop_body' di
// ciascun Do-While, primo segmento = [diaLeft, cy, backEdgeX, cy, false]) la X del back-edge
// di OGNI Do-While presente, e la bbox reale di ogni nodo/forma disegnata (dal mock ctx, come
// render-headless.js). Controlla che: (1) nessun back-edge X coincida/si sovrapponga a un
// altro back-edge X entro BACKEDGE_SEP_PX (i due archi False non si accavallano); (2) nessuna
// bbox di nodo REALE (non del sottoalbero del proprio Do-While) invada la fascia [backEdgeX-4,
// backEdgeX+4] alla stessa quota Y del back-edge (nessuna sovrapposizione con contenuto
// estraneo, non solo fra i due Do-While).
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1200, H = 1200;
let ops = [];
function col(c){ if(!c || typeof c!=='string' || c.startsWith('var(')) return '#000'; return c; }
const ctxMock = {
  fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle',
  _path: [],
  beginPath(){ this._path=[]; },
  moveTo(x,y){ this._path.push(['M',x,y]); },
  lineTo(x,y){ this._path.push(['L',x,y]); },
  quadraticCurveTo(cx,cy,x,y){ this._path.push(['Q',cx,cy,x,y]); },
  rect(x,y,w,h){ this._path.push(['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']); },
  closePath(){ this._path.push(['Z']); },
  stroke(){ if(this._path.length) ops.push({t:'stroke', d:[...this._path], c:col(this.strokeStyle), w:this.lineWidth}); },
  fill(){ if(this._path.length) ops.push({t:'fill', d:[...this._path], c:col(this.fillStyle)}); },
  clearRect(){ ops=[]; },
  fillText(){},
  measureText(t){ return {width: (t||'').length*8}; },
  save(){}, restore(){}, setLineDash(){}, setTransform(){},
  arc(x,y,r){ this._path.push(['M',x-r,y-r],['L',x+r,y-r],['L',x+r,y+r],['L',x-r,y+r]); }
};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""}};
const genericEl=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:genericEl(),addEventListener:()=>{},createElement:()=>genericEl(),querySelector:()=>genericEl(),querySelectorAll:()=>[],body:genericEl(),documentElement:genericEl()};
function makeApp() {
  ops = [];
  const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sandbox]', ...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) {
    vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
  }
  vm.runInContext('window.onload();', context);
  const run = (c) => vm.runInContext(c, context);
  const ins = (filter, tipo) => { run(`frecceSelected = frecce.findIndex(f=>${filter}); if(frecceSelected===-1) console.error("NO ARC ${tipo} (${filter})"); else inserisciNodo(${JSON.stringify(tipo)});`); run('draw(nodi);'); };
  return { run, ins };
}
let fails = 0;
const check = (c, m) => { console.log((c ? '  OK  ' : '  FAIL ') + m); if (!c) fails++; };

function analyze(app, label) {
  // Ogni Do-While: X del back-edge, letta dal PRIMO segmento visualExtra dell'arco 'loop_body'
  // (from===idx), coerente col drawLine in rendering.js/drawDoWhileBranches:
  //   [diaLeft, cy, backEdgeX, cy, false]  <- indice [1] del secondo punto = backEdgeX.
  const doInfo = app.run(`
    JSON.stringify(flow.nodes.map(function (n, i) {
      if (!n || n.type !== 'do') return null;
      var arc = frecce.find(function (f) { return f.fromNodeIndex === i && f.type === 'loop_body'; });
      if (!arc || !arc.visualExtra || !arc.visualExtra.length) return null;
      var backEdgeX = Math.round(arc.visualExtra[0][2]);
      var v = nodi[i];
      return { i: i, backEdgeX: backEdgeX, cx: Math.round(v.relX * w), cy: Math.round(v.relY * h), top: Math.round(v.relY * h - v.height / 2), bottom: Math.round(v.relY * h + v.height / 2) };
    }).filter(Boolean))
  `);
  const dos = JSON.parse(doInfo);
  console.log('\n### ' + label);
  console.log('  Do-While trovati: ' + dos.map(d => 'idx' + d.i + '@x=' + d.backEdgeX).join(', '));
  check(dos.length >= 2, 'almeno 2 Do-While rilevati (annidati)');

  // (1) Nessuna coppia di back-edge X entro BACKEDGE_SEP_PX l'una dall'altra.
  const SEP = app.run('BACKEDGE_SEP_PX');
  let minGap = Infinity;
  for (let i = 0; i < dos.length; i++) {
    for (let j = i + 1; j < dos.length; j++) {
      const gap = Math.abs(dos[i].backEdgeX - dos[j].backEdgeX);
      if (gap < minGap) minGap = gap;
    }
  }
  check(dos.length < 2 || minGap >= SEP, 'back-edge di livelli diversi separati di almeno BACKEDGE_SEP_PX (' + SEP + 'px); minGap=' + minGap);

  // (2) Nessuna forma REALE (fill, cioe' box di un nodo disegnato) invade la colonna del
  // back-edge PIU' esterno (il piu' a sinistra) alla sua fascia Y, escludendo i box dei
  // Do-While stessi (attesi: il loro corpo/esagono sta A DESTRA del proprio back-edge, mai
  // sopra di esso per costruzione, quindi qualunque bbox che la tocchi e' davvero estranea).
  function bbox(pathOps) {
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (const seg of pathOps) { for (let k=1;k<seg.length;k+=2) { const x=seg[k], y=seg[k+1]; if (typeof x==='number') { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); } } }
    return {minX,minY,maxX,maxY};
  }
  const fillBoxes = ops.filter(o => o.t === 'fill' && o.d.length >= 4).map(o => bbox(o.d));
  const outer = dos.reduce((a, b) => (a.backEdgeX < b.backEdgeX ? a : b)); // il piu' a sinistra
  let intrusions = 0;
  for (const b of fillBoxes) {
    // La colonna del back-edge piu' esterno, fascia Y fra top e bottom del Do-While outer.
    if (b.maxX < outer.backEdgeX - 4 || b.minX > outer.backEdgeX + 4) continue; // non tocca la colonna
    if (b.maxY < outer.top || b.minY > outer.bottom + 40) continue; // non nella fascia Y del back-edge
    intrusions++;
  }
  check(intrusions === 0, 'nessuna forma estranea invade la colonna del back-edge piu\' esterno (intrusioni=' + intrusions + ')');
}

// Scenario 1: Do-While(esterno) { Do-While(interno) { print } } nel FLUSSO PRINCIPALE.
{
  const app = makeApp(); app.run('draw(nodi);');
  app.ins('f.type==="normal"', 'do');                                                   // do esterno
  app.ins('f.type==="loop_body"', 'do');                                                // do interno nel corpo dell'esterno
  analyze(app, 'Scenario 1: do{ do{ } } nel flusso principale');
}

// Scenario 2: While { Do-While(esterno) { Do-While(interno) } } -- il Do-While esterno e'
// annidato nel CORPO di un While (non nel flusso principale).
{
  const app = makeApp(); app.run('draw(nodi);');
  app.ins('f.type==="normal"', 'while');                                                // while contenitore
  app.ins('f.type==="loop_body"', 'do');                                                 // do esterno nel corpo del while
  app.ins('f.type==="loop_body" && flow.nodes[f.fromNodeIndex] && flow.nodes[f.fromNodeIndex].type==="do"', 'do'); // do interno nel corpo del do esterno
  analyze(app, 'Scenario 2: while{ do{ do{ } } } -- do esterno annidato in un ciclo');
}

// Scenario 3: If { true: Do-While(esterno) { Do-While(interno) } } -- il Do-While esterno e'
// annidato nel RAMO di un If.
{
  const app = makeApp(); app.run('draw(nodi);');
  app.ins('f.type==="normal"', 'if');                                                    // if contenitore
  app.ins('f.type==="if_true"', 'do');                                                   // do esterno nel ramo true
  app.ins('f.type==="loop_body" && flow.nodes[f.fromNodeIndex] && flow.nodes[f.fromNodeIndex].type==="do"', 'do'); // do interno nel corpo del do esterno
  analyze(app, 'Scenario 3: if{ true: do{ do{ } } } -- do esterno annidato in un If');
}

console.log('\n' + (fails === 0 ? 'TUTTI I CONTROLLI OK' : (fails + ' CONTROLLI FALLITI')));
process.exit(fails === 0 ? 0 : 1);

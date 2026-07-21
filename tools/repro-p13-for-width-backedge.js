// Harness P13 (Ismail 2026-07-19, "For con testo lungo: gli archi si sovrappongono", file
// reale fornito: problemaaa.json — While{ Do-While{ For{ If{ While } } } }).
//
// CAUSA: il back-edge (risalita) di un Do-While (drawDoWhileBranches, rendering.js) si
// scosta SEMPRE di BACKEDGE_SEP_PX oltre il bordo sinistro REALE del proprio corpo
// (leftMostBodyLeft - BACKEDGE_SEP_PX) -- qualunque sia il contenuto del corpo, non solo se
// contiene un Do-While annidato. `subtreePxExtent` (layout.js), che un ANTENATO (qui il
// While esterno) usa per decidere quanto scostare a destra la colonna del corpo, riservava
// pero' quell'extra SOLO quando `_hasNestedDo` rilevava un Do-While annidato (fix
// 2026-07-15, per non spostare inutilmente l'etichetta True di un IF antenato in un caso
// cosmetico) -- sotto-riserva di 22px nel caso "un solo blocco LARGO nel corpo" (qui: For
// con un testo lungo). Con un For abbastanza largo il gap fra la colonna FISSA dell'uscita
// del While esterno e il back-edge del Do-While interno si annulla: le due linee si
// incrociano visivamente (confermato via SVG headless + rendering reale a occhio).
//
// FIX: `subtreePxExtent` (layout.js, ramo 'do') ora somma SEMPRE BACKEDGE_SEP_PX a beP.L
// (non solo quando c'e' un Do-While annidato) -- equivalente a
// `Math.max(half, beP.L) + BACKEDGE_SEP_PX`, la stessa formula usata dal back-edge reale.
//
// Questo harness verifica, con la topologia ESATTA di problemaaa.json: (1) nessun incrocio
// segmento-segmento fra archi/back-edge DIVERSI, con For a testo vuoto E col testo reale
// del file; (2) nessuna sovrapposizione di bounding-box fra nodi diversi; (3) regressione
// del caso gia' coperto da P6.2 (repro-p6c-dowhile-nesting-space.js, Do-in-Do annidato,
// NON toccato da questo fix) resta verde (eseguito separatamente).
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1400, H = 1400;
let ops = [];
function col(c) { if (!c || typeof c !== 'string' || c.startsWith('var(')) return '#000'; return c; }
function makeCtxMock() {
  return {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'center', textBaseline: 'middle',
    _path: [],
    beginPath() { this._path = []; },
    moveTo(x, y) { this._path.push(['M', x, y]); },
    lineTo(x, y) { this._path.push(['L', x, y]); },
    quadraticCurveTo(cx, cy, x, y) { this._path.push(['Q', cx, cy, x, y]); },
    rect(x, y, w, h) { this._path.push(['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']); },
    closePath() { this._path.push(['Z']); },
    stroke() { if (this._path.length) ops.push({ t: 'stroke', d: [...this._path], c: col(this.strokeStyle), w: this.lineWidth }); },
    fill() { if (this._path.length) ops.push({ t: 'fill', d: [...this._path], c: col(this.fillStyle) }); },
    clearRect() { ops = []; },
    fillText(txt, x, y) { ops.push({ t: 'text', txt, x, y }); },
    measureText(t) { return { width: String(t || '').length * 8 }; },
    save() {}, restore() {}, setLineDash() {}, setTransform() {},
    arc(x, y, r) { this._path.push(['M', x - r, y - r], ['L', x + r, y - r], ['L', x + r, y + r], ['L', x - r, y + r]); }
  };
}
function makeContext() {
  ops = [];
  const ctxMock = makeCtxMock();
  const canvasMock = { width: W, height: H, getContext: () => ctxMock, getBoundingClientRect: () => ({ left: 0, top: 0 }), addEventListener: () => {}, style: {} };
  const genericEl = () => ({ addEventListener: () => {}, classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} }, style: {}, value: '', querySelector: () => ({ value: '' }), querySelectorAll: () => [], appendChild: () => {}, innerHTML: '', textContent: '', dataset: {}, rows: [] });
  const documentMock = { getElementById: (id) => id === 'canvas' ? canvasMock : id === 'canvas-container' ? { offsetWidth: W, offsetHeight: H, addEventListener: () => {}, scrollLeft: 0, scrollTop: 0 } : id === 'tabVariabili' ? { rows: [] } : genericEl(), addEventListener: () => {}, createElement: () => genericEl(), querySelector: () => genericEl(), querySelectorAll: () => [], body: genericEl(), documentElement: genericEl() };
  const context = { document: documentMock, window: { addEventListener: () => {}, innerWidth: W, innerHeight: H, matchMedia: () => ({ matches: false, addEventListener: () => {} }) }, localStorage: { getItem: () => null, setItem: () => {} }, MutationObserver: function () { this.observe = () => {}; }, console: { log: () => {}, error: (...a) => console.error('[sandbox]', ...a), warn: () => {} }, Math, JSON, parseInt, parseFloat, isNaN, Set, Array, Object, String, Number, RegExp, Promise, setTimeout, clearTimeout, Date, eval, alert: () => {}, confirm: () => true, location: {} };
  vm.createContext(context);
  for (const n of ['theme', 'state', 'utils', 'variables', 'layout', 'rendering', 'popups', 'interaction', 'fileIO', 'init']) {
    vm.runInContext(fs.readFileSync(path.join(REPO, 'js/core/' + n + '.js'), 'utf8'), context, { filename: n + '.js' });
  }
  context.__ops = () => ops;
  return context;
}
function run(ctx, js) { return vm.runInContext(js, ctx); }

// Topologia esatta di problemaaa.json (Ismail 2026-07-19): Start->While{ Do-While{ For{
// If{ While(i%2==0){ Assign } } } } }->End.
function scenario(forInfo) {
  return [
    { type: 'start', info: '', next: '1' },
    { type: 'while', info: '', next: { true: '2', false: '7' } },
    { type: 'do', info: 'true', next: { true: '3', false: '1' } },
    { type: 'for', info: forInfo, next: { true: '4', false: '2' } },
    { type: 'if', info: 'true', next: { true: '5', false: '3' } },
    { type: 'while', info: 'i  % 2 == 0', next: { true: '6', false: '3' } },
    { type: 'assign', info: 'i = i + 1', next: '5' },
    { type: 'end', info: '', next: null },
  ];
}

function setFlowAndRender(ctx, nodesSpec) {
  run(ctx, `
    flow = { nodes: ${JSON.stringify(nodesSpec)}, variables: [{name:'i',type:'int',value:0,uninit:true}] };
    nodi = flow.nodes.map(function () { return { relX: 0.5, relY: 0, width: 100, height: 40, color: 'white', text: '' }; });
    frecce = []; undoStack = []; redoStack = []; nodoSelected = -1; frecceSelected = -1; selectedNodeIdx = -1; multiSelected = []; _multiSelAnchor = null;
    zoom = 1;
    calcoloY(nodi);
    draw(nodi);
  `);
  const val = JSON.parse(run(ctx, 'JSON.stringify(validateFlow(flow))'));
  const nodiOut = JSON.parse(run(ctx, 'JSON.stringify(nodi.map((v,i)=>({i, type:flow.nodes[i].type, relX:v.relX, relY:v.relY, width:v.width, height:v.height})))'));
  const wh = JSON.parse(run(ctx, 'JSON.stringify({w:w,h:h})'));
  return { val, nodiOut, wh, ops: ctx.__ops() };
}

function bboxOf(n, wh) {
  const cx = n.relX * wh.w, cy = n.relY * wh.h;
  return { i: n.i, type: n.type, x0: cx - n.width / 2, x1: cx + n.width / 2, y0: cy - n.height / 2, y1: cy + n.height / 2 };
}
function segSegIntersect(a, b) {
  const [x1, y1, x2, y2] = a, [x3, y3, x4, y4] = b;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / d;
  if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98) return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  return null;
}
function findArcArcCrossings(res) {
  const segs = [];
  res.ops.forEach(function (op, opIdx) {
    if (op.t !== 'stroke') return;
    for (let k = 0; k < op.d.length - 1; k++) {
      const s = op.d[k], e = op.d[k + 1];
      if (s[0] === 'Z' || e[0] === 'Z') continue;
      const x0 = s[1], y0 = s[2], x1 = e[1], y1 = e[2];
      if (x0 === undefined || x1 === undefined) continue;
      if (Math.hypot(x1 - x0, y1 - y0) < 45) continue; // scarta i contorni delle forme (esagono/rombo)
      segs.push({ opIdx, x0, y0, x1, y1 });
    }
  });
  const crossings = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (segs[i].opIdx === segs[j].opIdx) continue;
      const pt = segSegIntersect([segs[i].x0, segs[i].y0, segs[i].x1, segs[i].y1], [segs[j].x0, segs[j].y0, segs[j].x1, segs[j].y1]);
      if (pt) crossings.push({ a: segs[i], b: segs[j], at: pt });
    }
  }
  return crossings;
}
function findNodeOverlaps(res) {
  const boxes = res.nodiOut.map(n => bboxOf(n, res.wh));
  const problems = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > 2 && oy > 2) problems.push({ a: a.i + ':' + a.type, b: b.i + ':' + b.type });
    }
  }
  return problems;
}

let fails = 0;
function check(name, cond, extra) { if (cond) { console.log('  OK   ' + name); } else { console.log('  FAIL ' + name + (extra ? ' -- ' + JSON.stringify(extra) : '')); fails++; } }

console.log('=== P13: For a testo VUOTO (baseline) ===');
{
  const ctx = makeContext();
  const res = setFlowAndRender(ctx, scenario(''));
  check('validateFlow valido', res.val.valid === true);
  check('nessun incrocio arco-arco', findArcArcCrossings(res).length === 0);
  check('nessuna sovrapposizione bbox fra nodi', findNodeOverlaps(res).length === 0);
}

console.log('');
console.log('=== P13: For col testo REALE del file di Ismail ("i = 0; i <= 1; i += 1") ===');
{
  const ctx = makeContext();
  const res = setFlowAndRender(ctx, scenario('i = 0; i <= 1; i += 1'));
  check('validateFlow valido', res.val.valid === true);
  const crossings = findArcArcCrossings(res);
  check('nessun incrocio arco-arco (il bug originale)', crossings.length === 0, crossings[0]);
  check('nessuna sovrapposizione bbox fra nodi', findNodeOverlaps(res).length === 0);
}

console.log('');
console.log('=== P13: For con testo MOLTO piu\' lungo (stress test, forza piu\' larghezza) ===');
{
  const ctx = makeContext();
  const res = setFlowAndRender(ctx, scenario('contatoreDiIterazioni = 0; contatoreDiIterazioni <= 1000; contatoreDiIterazioni += 1'));
  check('validateFlow valido', res.val.valid === true);
  const crossings = findArcArcCrossings(res);
  check('nessun incrocio arco-arco', crossings.length === 0, crossings[0]);
  check('nessuna sovrapposizione bbox fra nodi', findNodeOverlaps(res).length === 0);
}

console.log('');
console.log(fails === 0 ? 'TUTTI I CONTROLLI OK' : (fails + ' CONTROLLI FALLITI'));
process.exit(fails === 0 ? 0 : 1);

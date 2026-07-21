#!/usr/bin/env node
// tools/repro-r15b-range-select.js — S5/P4.2 (round 15-B, Ismail 2026-07-15), harness
// PERMANENTE, scritto PRIMA dell'implementazione (come richiesto dal piano: "E' la logica
// piu' sottile. Prima harness... Poi implementa.").
//
// Copre la nuova semantica di rangeSelectTo (Shift+click sinistro, sostituisce Ctrl+Shift):
//   (1) Trigger: Shift SEMPLICE (senza Ctrl) in clickNodo.
//   (2) Cammina da ancora ad arrivo per UNITA'. Se i due estremi restano nello STESSO
//       genitore diretto (stesso ramo di un if, stesso corpo di un ciclo, o entrambi nel
//       flusso principale), la selezione resta INTERNA — non deve mai includere l'intero
//       genitore (l'IF/ciclo contenitore) ne' l'altro ramo.
//   (3) Se i due estremi sono a livelli diversi (un estremo dentro un'unita' composta,
//       l'altro fuori), l'unita' composta va presa INTERA (entrambi i rami per un if) SOLO
//       perche' il range la deve attraversare per uscirne — MAI un pezzo a meta'.
//   (4) Scenario reale di Ismail: assign -> while[input] -> if[output] (in sequenza nel
//       flusso principale). Shift da "output" (dentro l'if) a "input" (dentro il while)
//       deve selezionare if+while INTERI, in ordine (while poi if).
//   (5) Un ciclo il cui corpo si "chiude" col back-edge deve comportarsi come un IF quando
//       il range esce dal suo corpo verso il resto del flusso (nessun caso speciale).
//
// Uso:  node tools/repro-r15b-range-select.js
// Exit: 0 se tutti i controlli passano, 1 altrimenti.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..', 'app');
const W = 1400, H = 1400;

const ctxMockFactory = () => ({
  fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'center', textBaseline: 'middle',
  _path: [],
  save() {}, restore() {}, setLineDash() {}, setTransform() {}, arc() {},
  beginPath() { this._path = []; },
  moveTo(x, y) { this._path.push(['M', x, y]); },
  lineTo(x, y) { this._path.push(['L', x, y]); },
  quadraticCurveTo(cx, cy, x, y) { this._path.push(['Q', cx, cy, x, y]); },
  rect(x, y, w, h) { this._path.push(['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']); },
  closePath() { this._path.push(['Z']); },
  stroke() {}, fill() {}, clearRect() {}, fillText() {},
  measureText(t) { return { width: (t || '').length * 8 }; },
});

function makeContext() {
  const canvasMock = { width: W, height: H, getContext: () => ctxMockFactory(), getBoundingClientRect: () => ({ left: 0, top: 0 }), addEventListener: () => {}, style: {} };
  const genericEl = () => ({ addEventListener: () => {}, classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} }, style: {}, value: '', querySelector: () => ({ value: '' }), querySelectorAll: () => [], appendChild: () => {}, innerHTML: '', textContent: '', dataset: {}, rows: [] });
  const documentMock = { getElementById: (id) => id === 'canvas' ? canvasMock : id === 'canvas-container' ? { offsetWidth: W, offsetHeight: H, addEventListener: () => {}, scrollLeft: 0, scrollTop: 0 } : id === 'tabVariabili' ? { rows: [] } : genericEl(), addEventListener: () => {}, createElement: () => genericEl(), querySelector: () => genericEl(), querySelectorAll: () => [], body: genericEl(), documentElement: genericEl() };
  const context = {
    document: documentMock,
    window: { addEventListener: () => {}, innerWidth: W, innerHeight: H, matchMedia: () => ({ matches: false, addEventListener: () => {} }) },
    localStorage: { getItem: () => null, setItem: () => {} },
    MutationObserver: function () { this.observe = () => {}; },
    console: { log: () => {}, error: (...a) => console.error(...a), warn: () => {} },
    Math, JSON, parseInt, parseFloat, isNaN, Set, Array, Object, String, Number, RegExp, Promise, setTimeout, clearTimeout, Date, eval,
    alert: () => {}, confirm: () => true, location: {},
  };
  vm.createContext(context);
  for (const n of ['theme', 'state', 'utils', 'variables', 'layout', 'rendering', 'popups', 'interaction', 'fileIO', 'init']) {
    vm.runInContext(fs.readFileSync(path.join(REPO, 'js/core/' + n + '.js'), 'utf8'), context, { filename: n + '.js' });
  }
  return context;
}
function run(ctx, js) { return vm.runInContext(js, ctx); }
function setFlow(ctx, nodesSpec) {
  run(ctx, `
    flow = { nodes: ${JSON.stringify(nodesSpec)}, variables: [] };
    nodi = flow.nodes.map(function (n) { return { relX: 0.5, relY: 0, width: 100, height: 40, color: 'white', text: n.type }; });
    frecce = [];
    undoStack = []; redoStack = []; nodoSelected = -1; frecceSelected = -1; selectedNodeIdx = -1; multiSelected = []; _multiSelAnchor = null;
  `);
}
function multi(ctx) { return JSON.parse(run(ctx, 'JSON.stringify(multiSelected)')).slice().sort((a, b) => a - b); }

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' -- ' + extra : '')); }
}
function shiftClick(ctx, anchorIdx, targetIdx) {
  // Simula: click semplice sull'ancora (imposta _multiSelAnchor, come clickNodo), poi
  // Shift+click sul target -> rangeSelectTo (chiamata diretta: e' il vero punto di
  // ingresso invocato da clickNodo dopo il fix del trigger, testato qui direttamente
  // per isolare la LOGICA dal parsing dell'evento mouse/tastiera).
  run(ctx, `selectedNodeIdx = ${anchorIdx}; _multiSelAnchor = ${anchorIdx};`);
  run(ctx, `rangeSelectTo(${targetIdx});`);
}

// =====================================================================================
// Scenario A (Ismail, reale): assign -> while[input] -> if[true:output, false:diretto al
// join] -> end. Shift da "output"(5) a "input"(3) deve prendere while(2)+if(4) INTERI.
// =====================================================================================
function scenarioA() {
  return [
    { type: 'start', info: '', next: '1' },                              // 0
    { type: 'assign', info: 'x=0', next: '2' },                          // 1
    { type: 'while', info: 'W', next: { true: '3', false: '4' } },       // 2
    { type: 'input', info: 'input', next: '2' },                        // 3  <- corpo del while (back-edge a 2)
    { type: 'if', info: 'F', next: { true: '5', false: '6' } },          // 4
    { type: 'output', info: 'output', next: '6' },                       // 5  <- ramo true dell'if
    { type: 'end', info: '', next: null },                               // 6  <- join dell'if (ramo false ci arriva diretto)
  ];
}
console.log('=== Scenario A (Ismail): Shift da output(5) a input(3) -> while(2)+if(4) interi ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioA());
  shiftClick(ctx, 5, 3);
  const m = multi(ctx);
  check('A: seleziona ESATTAMENTE while(2) e if(4)', m.length === 2 && m[0] === 2 && m[1] === 4, JSON.stringify(m));
}
console.log('=== Scenario A-bis: direzione opposta, Shift da input(3) a output(5) -> stesso risultato ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioA());
  shiftClick(ctx, 3, 5);
  const m = multi(ctx);
  check('A-bis: seleziona ESATTAMENTE while(2) e if(4)', m.length === 2 && m[0] === 2 && m[1] === 4, JSON.stringify(m));
}

// =====================================================================================
// Scenario B: selezione che resta INTERNA a un ramo (non deve MAI tirare dentro l'intero
// IF ne' l'altro ramo). If con ramo true = [A, B, C] in sequenza, ramo false = [D].
// Shift da A a C -> {A,B,C}, MAI l'indice dell'if ne' D.
// =====================================================================================
function scenarioB() {
  return [
    { type: 'start', info: '', next: '1' },                              // 0
    { type: 'if', info: 'F', next: { true: '2', false: '5' } },          // 1
    { type: 'print', info: 'A', next: '3' },                             // 2
    { type: 'print', info: 'B', next: '4' },                             // 3
    { type: 'print', info: 'C', next: '6' },                             // 4
    { type: 'print', info: 'D', next: '6' },                             // 5  <- ramo false
    { type: 'end', info: '', next: null },                               // 6  <- join
  ];
}
console.log('=== Scenario B: Shift dentro lo stesso ramo (A(2)->C(4)) resta INTERNO ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioB());
  shiftClick(ctx, 2, 4);
  const m = multi(ctx);
  check('B: seleziona ESATTAMENTE {2,3,4}, MAI l\'if(1) ne\' D(5)', m.length === 3 && m.join(',') === '2,3,4', JSON.stringify(m));
}

// =====================================================================================
// Scenario C: un IF annidato IN MEZZO allo stesso ramo va preso INTERO (entrambi i rami)
// quando il range lo attraversa, ma il ramo resta comunque "interno" al padre esterno.
// Ramo true del padre: [A, G(if annidato: true=[X], false=[Y]), Z].
// Shift da A a Z deve dare {A, G, Z} (G intero, coi suoi membri interni impliciti dentro
// l'unita' G — multiSelected contiene la RADICE G, non X/Y separatamente).
// =====================================================================================
function scenarioC() {
  return [
    { type: 'start', info: '', next: '1' },                              // 0
    { type: 'if', info: 'PADRE', next: { true: '2', false: '7' } },      // 1
    { type: 'print', info: 'A', next: '3' },                             // 2
    { type: 'if', info: 'G', next: { true: '4', false: '5' } },          // 3  <- annidato, stesso ramo
    { type: 'print', info: 'X', next: '6' },                             // 4
    { type: 'print', info: 'Y', next: '6' },                             // 5
    { type: 'print', info: 'Z', next: '8' },                             // 6
    { type: 'print', info: 'D_padre_false', next: '8' },                 // 7
    { type: 'end', info: '', next: null },                               // 8
  ];
}
console.log('=== Scenario C: if annidato IN MEZZO allo stesso ramo va preso intero, il padre NO ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioC());
  shiftClick(ctx, 2, 6);
  const m = multi(ctx);
  check('C: seleziona ESATTAMENTE {A(2), G(3), Z(6)}, MAI il padre(1) ne\' D(7)', m.length === 3 && m.join(',') === '2,3,6', JSON.stringify(m));
}

// =====================================================================================
// Scenario D: rami DIVERSI dello STESSO if (uno in true, uno in false) -> deve prendere
// l'INTERO if (entrambi i rami), non e' un caso "interno".
// =====================================================================================
console.log('=== Scenario D: estremi in rami DIVERSI dello stesso if -> if intero ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioB()); // A(2)/B(3)/C(4) in true, D(5) in false
  shiftClick(ctx, 2, 5); // A (true) -> D (false)
  const m = multi(ctx);
  check('D: seleziona ESATTAMENTE l\'if(1) intero (entrambi i rami assorbiti)', m.length === 1 && m[0] === 1, JSON.stringify(m));
}

// =====================================================================================
// Scenario E: back-edge di un ciclo. While con corpo [P, Q] in sequenza, poi altro nodo
// R dopo il while. Shift da P (dentro il corpo) a R (dopo il while) deve prendere
// l'INTERO while (2), non il pezzo del corpo a meta'.
// =====================================================================================
function scenarioE() {
  return [
    { type: 'start', info: '', next: '1' },                              // 0
    { type: 'assign', info: 'i=0', next: '2' },                          // 1
    { type: 'while', info: 'W', next: { true: '3', false: '5' } },       // 2
    { type: 'print', info: 'P', next: '4' },                             // 3  <- corpo
    { type: 'print', info: 'Q', next: '2' },                             // 4  <- corpo, back-edge a 2
    { type: 'print', info: 'R', next: '6' },                             // 5  <- dopo il while
    { type: 'end', info: '', next: null },                               // 6
  ];
}
console.log('=== Scenario E: Shift da dentro il corpo del while(P=3) a dopo il while(R=5) -> while(2) intero ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioE());
  shiftClick(ctx, 3, 5);
  const m = multi(ctx);
  check('E: seleziona ESATTAMENTE {while(2), R(5)}', m.length === 2 && m.join(',') === '2,5', JSON.stringify(m));
}
console.log('=== Scenario E-bis: resta interno se entrambi gli estremi sono nel corpo (P(3)->Q(4)) ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioE());
  shiftClick(ctx, 3, 4);
  const m = multi(ctx);
  check('E-bis: seleziona ESATTAMENTE {P(3), Q(4)}, MAI il while(2)', m.length === 2 && m.join(',') === '3,4', JSON.stringify(m));
}

// =====================================================================================
// Scenario F: nessuna ancora precedente -> Shift+click su un singolo nodo si comporta
// come un toggle semplice (nessun range possibile).
// =====================================================================================
console.log('=== Scenario F: Shift+click senza ancora precedente -> selezione singola ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioB());
  run(ctx, '_multiSelAnchor = null; multiSelected = [];');
  run(ctx, 'rangeSelectTo(2);');
  const m = multi(ctx);
  check('F: seleziona solo {2}', m.length === 1 && m[0] === 2, JSON.stringify(m));
}

// =====================================================================================
// Scenario G: Start/End non devono MAI comparire nella selezione, nemmeno indirettamente
// tramite un allargamento che li attraverserebbe (rifiuto pulito se il range punta a
// un'unita' irraggiungibile senza passare per Start/End in un punto senza sbocco).
// =====================================================================================
console.log('=== Scenario G: Start/End mai inclusi in multiSelected dopo un range ===');
{
  const ctx = makeContext();
  setFlow(ctx, scenarioA());
  shiftClick(ctx, 5, 3);
  const m = multi(ctx);
  const hasStartOrEnd = m.some((i) => ['start', 'end'].includes(scenarioA()[i].type));
  check('G: nessun indice start/end in multiSelected', !hasStartOrEnd, JSON.stringify(m));
}

console.log('');
console.log(`=== TOTALE: ${pass}/${pass + fail} PASS ===`);
if (fail) { console.log('FALLITI:'); failures.forEach((f) => console.log('  - ' + f)); }
console.log(fail ? '=== repro-r15b-range-select: FALLITO ===' : '=== repro-r15b-range-select: OK ===');
process.exit(fail ? 1 : 0);

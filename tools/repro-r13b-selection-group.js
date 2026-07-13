#!/usr/bin/env node
// tools/repro-r13b-selection-group.js — R13-B (2026-07-12/13), harness PERMANENTE.
//
// Copre due cose, entrambe da rilanciare a ogni round futuro che tocca moveRange/
// moveSelectionGroup/copySelectionGroup/getSelectionUnits/toggleMultiSelect:
//
//  1) Bug "spostamento di gruppo con annidati corrompe il grafo" (Ismail 2026-07-12).
//     Causa radice: moveSelectionGroup/copySelectionGroup/onCanvasMouseDown validavano
//     la contiguita' di una selezione multi-unita' solo con
//     `cur.blockEnd===nxt.blockStart && cur.exit===nxt.blockStart` — un controllo che
//     un IF/ciclo ULTIMO membro di un ramo puo' soddisfare per PURA COINCIDENZA
//     NUMERICA anche quando il suo `exit` e' in realta' il join CONDIVISO di un
//     antenato (es. l'altro ramo dello stesso IF padre), non un nodo "privato" del suo
//     ramo. In quel caso moveRange rimuove l'intero range come blocco unico e un
//     puntatore ESTERNO che convergeva sullo stesso join condiviso (es. l'altro ramo del
//     padre) non viene redirect correttamente -> corruzione silenziosa (nessun errore,
//     nessun warning, il grafo risultante e' semplicemente sbagliato).
//     Fix: validateSelectionUnitsSameLevel() (interaction.js) rifiuta la selezione se il
//     punto di convergenza fra due unita' consecutive ha un predecessore ESTERNO al
//     prefisso di selezione accumulato fin li' (vedi commento nella funzione).
//     Scenario 1/2 sotto riproducono i DUE target di Ismail (l'altro ramo del padre,
//     dentro il while successivo) sulla STESSA selezione cross-annidamento: prima del
//     fix corrompevano, ora vengono rifiutati puliti. Scenario 3 e' un controllo
//     NEGATIVO: la STESSA selezione ma senza cross-annidamento (join privato del ramo)
//     deve continuare a funzionare (nessuna regressione sul caso legittimo).
//
//  2) Equivalenza comportamentale moveIfBlock/moveLoopBlock (chiamata diretta) vs
//     moveSelectionGroup con selezione a UNA sola unita' — devono produrre l'IDENTICO
//     risultato per ognuno dei 7 tipi di arco supportati da moveRange (normal, if_true,
//     if_false, if_join, loop_body, loop_exit, loop_body_end), sia per un IF sia per un
//     ciclo (14 confronti totali — generalizza la "equivalenza 7/7" del round 12, che
//     verificava lo stesso invariante ma senza un harness permanente salvato nel repo).
//
//  3) R13-B2: Ctrl+click deve UNIRE la selezione singola esistente (selectedNodeIdx)
//     nel gruppo al primo Ctrl+click successivo, invece di ripartire da zero.
//
// Uso:  node tools/repro-r13b-selection-group.js
// Exit: 0 se tutti i controlli passano, 1 altrimenti.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const W = 1400, H = 1400;

function col(c) { if (!c || typeof c !== 'string' || c.startsWith('var(')) return '#000'; return c; }
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
  const warnLog = [];
  const context = {
    document: documentMock,
    window: { addEventListener: () => {}, innerWidth: W, innerHeight: H, matchMedia: () => ({ matches: false, addEventListener: () => {} }) },
    localStorage: { getItem: () => null, setItem: () => {} },
    MutationObserver: function () { this.observe = () => {}; },
    console: { log: () => {}, error: (...a) => console.error(...a), warn: (...a) => { warnLog.push(a.map(String).join(' ')); } },
    Math, JSON, parseInt, parseFloat, isNaN, Set, Array, Object, String, Number, RegExp, Promise, setTimeout, clearTimeout, Date, eval,
    alert: () => {}, confirm: () => true, location: {},
  };
  context._warnLogRef = warnLog;
  vm.createContext(context);
  for (const n of ['theme', 'state', 'utils', 'variables', 'layout', 'rendering', 'popups', 'interaction', 'fileIO', 'init']) {
    vm.runInContext(fs.readFileSync(path.join(REPO, 'js/core/' + n + '.js'), 'utf8'), context, { filename: n + '.js' });
  }
  return context;
}

function run(ctx, js) { return vm.runInContext(js, ctx); }

// arcsSpec costruiti A MANO per ogni fixture (deterministici dalla struttura che
// definiamo noi stessi) invece di ricalcolarli con draw(): piu' diretto e trasparente
// per un harness di regressione mirato, stesso principio di repro-round2-harness.js che
// invece usa draw() perche' gli serve anche l'SVG.
function setFlow(ctx, nodesSpec, arcsSpec) {
  run(ctx, `
    flow = { nodes: ${JSON.stringify(nodesSpec)}, variables: [] };
    nodi = flow.nodes.map(function (n) { return { relX: 0.5, relY: 0, width: 100, height: 40, color: 'white', text: n.type }; });
    frecce = ${JSON.stringify(arcsSpec)}.map(function (a, i) { a.id = i; return a; });
    undoStack = []; redoStack = []; nodoSelected = -1; frecceSelected = -1; selectedNodeIdx = -1; multiSelected = [];
  `);
}
function dumpNodes(ctx) { return JSON.parse(run(ctx, 'JSON.stringify(flow.nodes)')); }
function nodesSummary(nodes) {
  return nodes.map((n, i) => { let nx = n.next; if (nx && typeof nx === 'object') nx = `T:${nx.true} F:${nx.false}`; return `${i}:${n.type}->${nx}`; }).join(' | ');
}

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' -- ' + extra : '')); }
}

// ---------------------------------------------------------------------------
// 1) Bug di corruzione cross-annidamento (join condiviso)
// ---------------------------------------------------------------------------
function sharedJoinNodes() {
  return [
    { type: 'start', info: '', next: '1' },                                   // 0
    { type: 'if', info: 'PADRE', next: { true: '2', false: '6' } },            // 1
    { type: 'if', info: 'FIGLIO', next: { true: '3', false: '4' } },           // 2
    { type: 'print', info: 'A', next: '5' },                                   // 3
    { type: 'print', info: 'B', next: '5' },                                   // 4
    { type: 'print', info: 'C_dopo_figlio', next: '7' },                       // 5  <- JOIN CONDIVISO di PADRE
    { type: 'print', info: 'D_padre_false', next: '5' },                       // 6  <- ramo false converge DIRETTAMENTE sul join
    { type: 'while', info: 'W', next: { true: '8', false: '9' } },             // 7
    { type: 'print', info: 'E_body_while', next: '7' },                        // 8
    { type: 'end', info: '', next: null },                                     // 9
  ];
}
function legitNodes() {
  return [
    { type: 'start', info: '', next: '1' },                                   // 0
    { type: 'if', info: 'PADRE', next: { true: '2', false: '6' } },            // 1
    { type: 'if', info: 'FIGLIO', next: { true: '3', false: '4' } },           // 2
    { type: 'print', info: 'A', next: '5' },                                   // 3
    { type: 'print', info: 'B', next: '5' },                                   // 4
    { type: 'print', info: 'C_dopo_figlio', next: '7' },                       // 5  <- join PRIVATO di FIGLIO
    { type: 'print', info: 'D_padre_false', next: '7' },                       // 6  <- NON coincide col join di FIGLIO
    { type: 'while', info: 'W', next: { true: '8', false: '9' } },             // 7
    { type: 'print', info: 'E_body_while', next: '7' },                        // 8
    { type: 'end', info: '', next: null },                                     // 9
  ];
}
const arcIfFalse = [{ fromNodeIndex: 1, toNodeIndex: 6, type: 'if_false' }];
const arcLoopBody = [{ fromNodeIndex: 7, toNodeIndex: 8, type: 'loop_body' }];

// R14 (Ismail 2026-07-13): le selezioni cross-annidamento NON vengono piu' rifiutate --
// moveSelectionGroup instrada verso moveScatteredSelection (catena di mosse singole con
// rollback totale). Gli scenari 1/2 quindi ora si aspettano il SUCCESSO con grafo VALIDO
// (l'invariante originale del bug -- "mai corruzione" -- resta verificato via validateFlow).
console.log('=== R13-B/R14 / Scenario 1: selezione cross-annidamento -> altro ramo del PADRE (ora DEVE SPOSTARE, grafo valido) ===');
{
  const ctx = makeContext();
  setFlow(ctx, sharedJoinNodes(), arcIfFalse);
  run(ctx, 'multiSelected = [2, 5];');
  const ok = run(ctx, 'moveSelectionGroup(0)');
  const after = dumpNodes(ctx);
  const val = run(ctx, 'JSON.stringify(validateFlow(flow))');
  check('scenario1: spostamento accettato (R14)', ok === true, 'ok=' + ok);
  check('scenario1: nessun nodo perso/aggiunto', after.length === 10, 'trovati ' + after.length);
  check('scenario1: grafo VALIDO dopo lo spostamento (mai corruzione)', JSON.parse(val).valid === true, val);
  check('scenario1: nessun tag _gmOrder residuo', !JSON.stringify(after).includes('_gmOrder'));
}

console.log('=== R13-B/R14 / Scenario 2: selezione cross-annidamento -> dentro il while successivo (ora DEVE SPOSTARE, grafo valido) ===');
{
  const ctx = makeContext();
  setFlow(ctx, sharedJoinNodes(), arcLoopBody);
  run(ctx, 'multiSelected = [2, 5];');
  const ok = run(ctx, 'moveSelectionGroup(0)');
  const after = dumpNodes(ctx);
  const val = run(ctx, 'JSON.stringify(validateFlow(flow))');
  check('scenario2: spostamento accettato (R14)', ok === true, 'ok=' + ok);
  check('scenario2: nessun nodo perso/aggiunto', after.length === 10, 'trovati ' + after.length);
  check('scenario2: grafo VALIDO dopo lo spostamento (mai corruzione)', JSON.parse(val).valid === true, val);
  check('scenario2: il while NON e\' stato assorbito nell\'if (bug originale)', after.filter(n => n.type === 'while').length === 1 && JSON.parse(val).valid === true);
}

console.log('=== R13-B / Scenario 3 (controllo negativo): selezione LEGITTIMA stesso ramo -> altro ramo del padre (deve FUNZIONARE) ===');
{
  const ctx = makeContext();
  setFlow(ctx, legitNodes(), arcIfFalse);
  run(ctx, 'multiSelected = [2, 5];');
  const ok = run(ctx, 'moveSelectionGroup(0)');
  const after = dumpNodes(ctx);
  check('scenario3: accettato (selezione legittima)', ok === true, 'ok=' + ok);
  check('scenario3: nessun nodo perso/aggiunto', after.length === 10, 'trovati ' + after.length);
}

// ---------------------------------------------------------------------------
// 2) Equivalenza moveIfBlock/moveLoopBlock diretto vs moveSelectionGroup (unita' singola)
// ---------------------------------------------------------------------------
function nodesWithIf() {
  return [
    { type: 'start', info: '', next: '1' },                          // 0
    { type: 'if', info: 'X', next: { true: '2', false: '3' } },       // 1
    { type: 'print', info: 'T', next: '4' },                          // 2
    { type: 'print', info: 'F', next: '4' },                          // 3
    { type: 'while', info: 'W', next: { true: '5', false: '6' } },    // 4
    { type: 'print', info: 'BODY', next: '4' },                       // 5
    { type: 'end', info: '', next: null },                            // 6
  ];
}
const equivArcs = [
  { fromNodeIndex: 0, toNodeIndex: 1, type: 'normal' },
  { fromNodeIndex: 1, toNodeIndex: 2, type: 'if_true' },
  { fromNodeIndex: 1, toNodeIndex: 3, type: 'if_false' },
  { fromNodeIndex: 1, toNodeIndex: 4, type: 'if_join' },
  { fromNodeIndex: 4, toNodeIndex: 5, type: 'loop_body' },
  { fromNodeIndex: 5, toNodeIndex: 4, type: 'loop_body_end' },
  { fromNodeIndex: 4, toNodeIndex: 6, type: 'loop_exit' },
];

console.log('=== R13-B / Equivalenza: moveIfBlock diretto vs moveSelectionGroup (7 tipi di arco) ===');
for (let i = 0; i < equivArcs.length; i++) {
  const a = equivArcs[i];
  const ctxA = makeContext(); setFlow(ctxA, nodesWithIf(), equivArcs); run(ctxA, `moveIfBlock(1, ${i})`);
  const ctxB = makeContext(); setFlow(ctxB, nodesWithIf(), equivArcs); run(ctxB, 'multiSelected = [1];'); run(ctxB, `moveSelectionGroup(${i})`);
  const same = nodesSummary(dumpNodes(ctxA)) === nodesSummary(dumpNodes(ctxB));
  check(`equiv IF arc#${i} type=${a.type}`, same);
}

console.log('=== R13-B / Equivalenza: moveLoopBlock diretto vs moveSelectionGroup (7 tipi di arco) ===');
for (let i = 0; i < equivArcs.length; i++) {
  const a = equivArcs[i];
  const ctxA = makeContext(); setFlow(ctxA, nodesWithIf(), equivArcs); run(ctxA, `moveLoopBlock(4, ${i})`);
  const ctxB = makeContext(); setFlow(ctxB, nodesWithIf(), equivArcs); run(ctxB, 'multiSelected = [4];'); run(ctxB, `moveSelectionGroup(${i})`);
  const same = nodesSummary(dumpNodes(ctxA)) === nodesSummary(dumpNodes(ctxB));
  check(`equiv LOOP arc#${i} type=${a.type}`, same);
}

// ---------------------------------------------------------------------------
// 3) R13-B2: Ctrl+click unisce la selezione singola esistente
// ---------------------------------------------------------------------------
function simpleChain() {
  return [
    { type: 'start', info: '', next: '1' },
    { type: 'print', info: 'A', next: '2' },
    { type: 'print', info: 'B', next: '3' },
    { type: 'print', info: 'C', next: '4' },
    { type: 'end', info: '', next: null },
  ];
}
console.log('=== R13-B2: click semplice + Ctrl+click deve unire (non ripartire da zero) ===');
{
  const ctx = makeContext();
  setFlow(ctx, simpleChain(), []);
  run(ctx, 'selectedNodeIdx = 1;'); // click semplice su A
  run(ctx, 'toggleMultiSelect(3);'); // Ctrl+click su C
  const multi = JSON.parse(run(ctx, 'JSON.stringify(multiSelected)'));
  const selIdx = run(ctx, 'selectedNodeIdx');
  check('B2: A(1) e C(3) entrambi nel gruppo', multi.slice().sort().join(',') === '1,3', JSON.stringify(multi));
  check('B2: selectedNodeIdx azzerato', selIdx === -1);
}
{
  const ctx = makeContext();
  setFlow(ctx, simpleChain(), []);
  run(ctx, 'multiSelected = [1, 2];');
  run(ctx, 'toggleMultiSelect(1);'); // ri-click su unita' gia' nel gruppo: la rimuove (invariato)
  const multi = JSON.parse(run(ctx, 'JSON.stringify(multiSelected)'));
  check('B2: toggle di un\'unita\' gia\' nel gruppo la rimuove', multi.join(',') === '2', JSON.stringify(multi));
}

console.log('');
console.log(`=== TOTALE: ${pass}/${pass + fail} PASS ===`);
if (fail) { console.log('FALLITI:'); failures.forEach((f) => console.log('  - ' + f)); }
console.log(fail ? '=== repro-r13b-selection-group: FALLITO ===' : '=== repro-r13b-selection-group: OK ===');
process.exit(fail ? 1 : 0);

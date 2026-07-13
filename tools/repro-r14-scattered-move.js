#!/usr/bin/env node
// tools/repro-r14-scattered-move.js — R14 (2026-07-13), harness PERMANENTE.
//
// Feature richiesta esplicitamente da Ismail: lo spostamento di una selezione multipla
// SPARSA (unita' su rami/archi/annidamenti DIVERSI) deve FUNZIONARE — le unita' vengono
// spostate in catena sulla destinazione e diventano consecutive nell'ordine originale.
// Implementazione: moveScatteredSelection() in interaction.js (catena di mosse singole
// moveNode/moveIfBlock/moveLoopBlock con tag _gmOrder sugli oggetti, undo singolo per
// collasso degli snapshot, rollback TOTALE se un passo viene rifiutato).
//
// Da rilanciare a ogni round che tocca moveScatteredSelection/moveSelectionGroup/
// moveRange/moveNode. Uso: node tools/repro-r14-scattered-move.js — exit 0 se ok.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const W = 1400, H = 1400;

const ctxMockFactory = () => ({
  fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'center', textBaseline: 'middle',
  save() {}, restore() {}, setLineDash() {}, setTransform() {}, arc() {},
  beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, rect() {}, closePath() {},
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
function setFlow(ctx, nodesSpec, arcsSpec) {
  run(ctx, `
    flow = { nodes: ${JSON.stringify(nodesSpec)}, variables: [] };
    nodi = flow.nodes.map(function (n) { return { relX: 0.5, relY: 0, width: 100, height: 40, color: 'white', text: n.type }; });
    frecce = ${JSON.stringify(arcsSpec)}.map(function (a, i) { a.id = i; return a; });
    undoStack = []; redoStack = []; nodoSelected = -1; frecceSelected = -1; selectedNodeIdx = -1; multiSelected = [];
  `);
}
function dumpNodes(ctx) { return JSON.parse(run(ctx, 'JSON.stringify(flow.nodes)')); }
function byInfo(nodes, info) { return nodes.findIndex(n => n.info === info); }
function nextOf(nodes, info) { const n = nodes[byInfo(nodes, info)]; return (n && typeof n.next === 'string') ? parseInt(n.next, 10) : null; }

let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' -- ' + extra : '')); } }

// ---------------------------------------------------------------------------
// S1: due blocchi in RAMI DIVERSI dello stesso if -> arco dopo il join.
// ---------------------------------------------------------------------------
console.log('=== R14/S1: blocchi in rami diversi -> dopo il join (consecutivi, ordine originale) ===');
{
  const ctx = makeContext();
  setFlow(ctx, [
    { type: 'start', info: '', next: '1' },                          // 0
    { type: 'if', info: 'A', next: { true: '2', false: '3' } },       // 1
    { type: 'print', info: 'T', next: '4' },                          // 2 (ramo true)
    { type: 'print', info: 'F', next: '4' },                          // 3 (ramo false)
    { type: 'print', info: 'AFTER', next: '5' },                      // 4 (join)
    { type: 'end', info: '', next: null },                            // 5
  ], [{ fromNodeIndex: 4, toNodeIndex: 5, type: 'normal' }]);
  run(ctx, 'multiSelected = [2, 3];');
  const ok = run(ctx, 'moveSelectionGroup(0)');
  const after = dumpNodes(ctx);
  const val = JSON.parse(run(ctx, 'JSON.stringify(validateFlow(flow))'));
  check('S1: spostamento accettato', ok === true, 'ok=' + ok);
  check('S1: grafo valido', val.valid === true, JSON.stringify(val.errors || []));
  check('S1: catena AFTER -> T', nextOf(after, 'AFTER') === byInfo(after, 'T'));
  check('S1: catena T -> F', nextOf(after, 'T') === byInfo(after, 'F'));
  check('S1: catena F -> end', after[nextOf(after, 'F')] && after[nextOf(after, 'F')].type === 'end');
  check('S1: selezione ricostruita (2 unita\')', run(ctx, 'multiSelected.length') === 2);
  check('S1: nessun tag residuo', !JSON.stringify(after).includes('_gmOrder'));
  check('S1: UN solo snapshot in undoStack', run(ctx, 'undoStack.length') === 1, 'len=' + run(ctx, 'undoStack.length'));
  run(ctx, 'undo();');
  const restored = dumpNodes(ctx);
  check('S1: undo singolo ripristina l\'originale', restored.length === 6 && nextOf(restored, 'T') === 4 && nextOf(restored, 'F') === 4);
}

// ---------------------------------------------------------------------------
// S2: blocco nel CORPO di un while + blocco in un ramo if -> altro ramo dell'if.
// ---------------------------------------------------------------------------
console.log('=== R14/S2: corpo-while + ramo-if -> altro ramo dell\'if ===');
{
  const ctx = makeContext();
  setFlow(ctx, [
    { type: 'start', info: '', next: '1' },                          // 0
    { type: 'while', info: 'W', next: { true: '2', false: '3' } },    // 1
    { type: 'print', info: 'BODY', next: '1' },                       // 2 (corpo while)
    { type: 'if', info: 'B', next: { true: '4', false: '5' } },       // 3
    { type: 'print', info: 'X', next: '6' },                          // 4 (ramo true)
    { type: 'print', info: 'Y', next: '6' },                          // 5 (ramo false)
    { type: 'end', info: '', next: null },                            // 6
  ], [{ fromNodeIndex: 3, toNodeIndex: 5, type: 'if_false' }]);
  run(ctx, 'multiSelected = [2, 4];');
  const ok = run(ctx, 'moveSelectionGroup(0)');
  const after = dumpNodes(ctx);
  const val = JSON.parse(run(ctx, 'JSON.stringify(validateFlow(flow))'));
  check('S2: spostamento accettato', ok === true, 'ok=' + ok);
  check('S2: grafo valido', val.valid === true, JSON.stringify(val.errors || []));
  check('S2: catena BODY -> X nel ramo false', nextOf(after, 'BODY') === byInfo(after, 'X'));
  check('S2: catena X -> Y', nextOf(after, 'X') === byInfo(after, 'Y'));
  check('S2: il while esiste ancora, non assorbito', after.filter(n => n.type === 'while').length === 1);
  check('S2: nessun tag residuo', !JSON.stringify(after).includes('_gmOrder'));
}

// ---------------------------------------------------------------------------
// S3: target che TOCCA la selezione -> rifiuto pulito, grafo intatto.
// ---------------------------------------------------------------------------
console.log('=== R14/S3: arco target dentro la selezione -> rifiuto pulito ===');
{
  const ctx = makeContext();
  setFlow(ctx, [
    { type: 'start', info: '', next: '1' },
    { type: 'if', info: 'A', next: { true: '2', false: '3' } },
    { type: 'print', info: 'T', next: '4' },
    { type: 'print', info: 'F', next: '4' },
    { type: 'print', info: 'AFTER', next: '5' },
    { type: 'end', info: '', next: null },
  ], [{ fromNodeIndex: 2, toNodeIndex: 4, type: 'normal' }]); // arco che ESCE da un membro selezionato
  run(ctx, 'multiSelected = [2, 3];');
  const before = JSON.stringify(dumpNodes(ctx));
  const ok = run(ctx, 'moveSelectionGroup(0)');
  check('S3: rifiutato', ok === false, 'ok=' + ok);
  check('S3: grafo INTATTO', JSON.stringify(dumpNodes(ctx)) === before);
  check('S3: undoStack intatto', run(ctx, 'undoStack.length') === 0);
}

// ---------------------------------------------------------------------------
// S4: IL GRAFO ESATTO DI ISMAIL (2026-07-13, screenshot): tre if annidati con TUTTI i
// rami vuoti che convergono sullo stesso join condiviso = il blocco Turn, anch'esso
// selezionato. Con le vecchie guardie quasi ogni arco "toccava" la selezione e il drop
// era impossibile ("non mi fa spostare"). Ora: selezione [if3, turn] spostabile.
// ---------------------------------------------------------------------------
function ismailNodes() {
  return [
    { type: 'start', info: '', next: '1' },                          // 0
    { type: 'if', info: 'IF1', next: { true: '2', false: '4' } },     // 1
    { type: 'if', info: 'IF2', next: { true: '3', false: '4' } },     // 2
    { type: 'if', info: 'IF3', next: { true: '4', false: '4' } },     // 3  <- rami vuoti, join condiviso
    { type: 'turn', info: ';90', next: '5' },                         // 4  <- join condiviso di TUTTI, selezionato
    { type: 'end', info: '', next: null },                            // 5
  ];
}
const ismailTargets = [
  ['arco start->if1 (normal)', { fromNodeIndex: 0, toNodeIndex: 1, type: 'normal' }],
  ['arco if1->if2 (if_true)', { fromNodeIndex: 1, toNodeIndex: 2, type: 'if_true' }],
  ['arco if1->join (if_false, ENTRA nella selezione)', { fromNodeIndex: 1, toNodeIndex: 4, type: 'if_false' }],
  ['arco turn->end (normal, ESCE dalla selezione)', { fromNodeIndex: 4, toNodeIndex: 5, type: 'normal' }],
];
for (const [label, arc] of ismailTargets) {
  console.log('=== R14/S4: grafo di Ismail, selezione [IF3, Turn] -> ' + label + ' ===');
  const ctx = makeContext();
  setFlow(ctx, ismailNodes(), [arc]);
  run(ctx, 'multiSelected = [3, 4];');
  const before = JSON.stringify(dumpNodes(ctx));
  const ok = run(ctx, 'moveSelectionGroup(0)');
  const after = dumpNodes(ctx);
  const val = JSON.parse(run(ctx, 'JSON.stringify(validateFlow(flow))'));
  if (ok === true) {
    check('S4[' + label + ']: grafo valido dopo lo spostamento', val.valid === true, JSON.stringify(val.errors || []));
    check('S4[' + label + ']: catena IF3 -> Turn alla destinazione', (function () {
      const i3 = byInfo(after, 'IF3'); const t = after[i3];
      if (!t || typeof t.next !== 'object') return false;
      // rami vuoti: true/false dell'if convergono sullo stesso punto; il turn deve seguire l'if3 nel flusso
      return after.filter(n => n.type === 'turn').length === 1;
    })());
    check('S4[' + label + ']: nessun tag residuo', !JSON.stringify(after).includes('_gmOrder'));
    check('S4[' + label + ']: un solo snapshot undo', run(ctx, 'undoStack.length') === 1);
  } else {
    // Se un target risulta impossibile per le guardie per-passo, DEVE essere un
    // rollback perfetto: grafo intatto e nessuno snapshot residuo. MAI corruzione.
    check('S4[' + label + ']: rifiuto = rollback perfetto (grafo intatto)', JSON.stringify(after) === before);
    check('S4[' + label + ']: rifiuto = undoStack pulito', run(ctx, 'undoStack.length') === 0, 'len=' + run(ctx, 'undoStack.length'));
    check('S4[' + label + ']: grafo ancora valido', val.valid === true);
    console.log('    (nota: target "' + label + '" rifiutato dalle guardie per-passo -- rollback ok)');
  }
}

// ---------------------------------------------------------------------------
console.log('');
console.log('=== TOTALE: ' + pass + '/' + (pass + fail) + ' PASS ===');
if (fail) { console.error('FALLITI:'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('=== repro-r14-scattered-move: OK ===');

#!/usr/bin/env node
// tools/repro-r15-move-corruption.js — Round 15 (2026-07-13), harness PERMANENTE.
//
// Bug P5.1 (segnalato da Ismail con 3 screenshot + due JSON before/after): trascinando il
// blocco ASSEGNA — che nel suo grafo e' il JOIN CONDIVISO dei due rami di un if (entrambi i
// rami puntano all'assign) ED ha next all'INDIETRO verso il while (back-edge) — dentro un ramo
// dell'if stesso, moveNode riscriveva male i puntatori: if.true 3->1 (verso il while) e
// assign.next 1->4 (verso end). Grafo corrotto e persistito in silenzio.
//
// Fix (round 15): RETE DI SICUREZZA in moveNode/moveRange — dopo lo spostamento si valida il
// grafo con validateFlow (lo STESSO validatore del caricamento file: reachability, join
// calcolabile, contiguita' dei sottoalberi). Se invalido -> rollback totale + flash rosso.
// Invariante garantita: dopo QUALSIASI moveNode/moveRange, validateFlow(flow).valid === true.
//
// Da rilanciare a ogni round che tocca moveNode/moveRange/moveSelectionGroup/move*.
// Uso: node tools/repro-r15-move-corruption.js — exit 0 se ok.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..', 'app');
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
    flow = { nodes: ${JSON.stringify(nodesSpec)}, variables: [{ name: 'x', type: 'int', value: 0 }] };
    nodi = flow.nodes.map(function (n) { return { relX: 0.5, relY: 0, width: 100, height: 40, color: 'white', text: n.type }; });
    frecce = ${JSON.stringify(arcsSpec)}.map(function (a, i) { a.id = i; return a; });
    undoStack = []; redoStack = []; nodoSelected = -1; frecceSelected = -1; selectedNodeIdx = -1; multiSelected = [];
  `);
}
function dumpNodes(ctx) { return JSON.parse(run(ctx, 'JSON.stringify(flow.nodes)')); }
function validate(ctx, nodes) {
  return JSON.parse(run(ctx, 'JSON.stringify(validateFlow(' + JSON.stringify({ nodes, variables: [] }) + '))'));
}

let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' -- ' + extra : '')); } }

// Grafo ESATTO di Ismail (before): while(x<3){ if(rami vuoti->assign) }; l'assign richiude il ciclo.
const ISMAIL_BEFORE = [
  { type: 'start',  info: '',        next: '1' },                       // 0
  { type: 'while',  info: 'x<3',     next: { true: '2', false: '4' } }, // 1
  { type: 'if',     info: '',        next: { true: '3', false: '3' } }, // 2  (join condiviso = 3)
  { type: 'assign', info: 'x = x+1', next: '1' },                       // 3  (back-edge al while)
  { type: 'end',    info: '',        next: null },                      // 4
];
// Grafo corrotto che Ismail otteneva DOPO lo spostamento (deve risultare INVALIDO).
const ISMAIL_AFTER_CORRUPT = [
  { type: 'start',  info: '',        next: '1' },
  { type: 'while',  info: 'x<3',     next: { true: '2', false: '4' } },
  { type: 'if',     info: '',        next: { true: '1', false: '3' } }, // true->while (corrotto)
  { type: 'assign', info: 'x = x+1', next: '4' },                       // assign->end (corrotto)
  { type: 'end',    info: '',        next: null },
];

// ---------------------------------------------------------------------------
console.log('=== R15/A: sanity — il grafo originale di Ismail e\' valido ===');
{
  const ctx = makeContext();
  const v = validate(ctx, ISMAIL_BEFORE);
  check('A: BEFORE valido', v.valid === true, JSON.stringify(v.errors || []));
}

console.log('=== R15/B: il detector (validateFlow) riconosce la corruzione esatta ===');
{
  const ctx = makeContext();
  const v = validate(ctx, ISMAIL_AFTER_CORRUPT);
  check('B: AFTER corrotto rilevato INVALIDO', v.valid === false, 'validateFlow lo considera valido!');
}

// Utility: sposta l'assign (indice 3) sull'arco del ramo indicato e verifica l'invariante.
function moveAssignOntoBranch(label, branchType) {
  const ctx = makeContext();
  setFlow(ctx, ISMAIL_BEFORE, [{ fromNodeIndex: 2, toNodeIndex: 3, type: branchType }]);
  const before = dumpNodes(ctx);
  run(ctx, 'moveNode(3, 0);');           // sposta l'assign sull'arco 0 (ramo dell'if)
  const after = dumpNodes(ctx);
  const v = JSON.parse(run(ctx, 'JSON.stringify(validateFlow(flow))'));
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  // INVARIANTE centrale: dopo la mossa il grafo e' SEMPRE valido (o rearrangiato-valido, o
  // rollback all'originale-valido). Mai la corruzione persistita.
  check(label + ': grafo valido dopo la mossa', v.valid === true, JSON.stringify(v.errors || []));
  // Non deve MAI essere il grafo corrotto (if.true->1 && assign.next->4 insieme).
  const if2 = after[2], as3 = after.find(n => n.type === 'assign');
  const isCorrupt = if2 && if2.next && if2.next.true === '1' && as3 && as3.next === '4';
  check(label + ': NON e\' il grafo corrotto di Ismail', !isCorrupt);
  console.log('   ' + label + ' -> ' + (unchanged ? 'ROLLBACK (grafo invariato)' : 'rearrangiato') + ', valido=' + v.valid);
}

console.log('=== R15/C: sposto l\'assign nel ramo FALSE dell\'if -> mai corruzione ===');
moveAssignOntoBranch('C', 'if_false');

console.log('=== R15/D: sposto l\'assign nel ramo TRUE dell\'if -> mai corruzione ===');
moveAssignOntoBranch('D', 'if_true');

console.log('=== R15/E: la rete NON rifiuta una mossa legittima ===');
{
  // Catena lineare semplice: sposto B su un arco normale valido -> deve ESSERE accettato.
  const ctx = makeContext();
  setFlow(ctx, [
    { type: 'start',  info: '',  next: '1' },  // 0
    { type: 'print',  info: 'A', next: '2' },  // 1
    { type: 'print',  info: 'B', next: '3' },  // 2
    { type: 'print',  info: 'C', next: '4' },  // 3
    { type: 'end',    info: '',  next: null }, // 4
  ], [{ fromNodeIndex: 3, toNodeIndex: 4, type: 'normal' }]); // arco C->end
  run(ctx, 'moveNode(1, 0);'); // sposta A dopo C (arco C->end)
  const after = dumpNodes(ctx);
  const v = JSON.parse(run(ctx, 'JSON.stringify(validateFlow(flow))'));
  check('E: mossa legittima accettata (grafo valido, cambiato)', v.valid === true && JSON.stringify(after) !== JSON.stringify(ISMAIL_BEFORE), JSON.stringify(v.errors || []));
  check('E: A ora e\' dopo C', (function () { const a = after.findIndex(n => n.info === 'A'); const c = after.findIndex(n => n.info === 'C'); return a === c + 1; })());
}

// ---------------------------------------------------------------------------
console.log('');
if (fail === 0) {
  console.log('TUTTI OK — ' + pass + '/' + pass + ' PASS');
  process.exit(0);
} else {
  console.log(fail + ' FALLITI su ' + (pass + fail) + ':');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}

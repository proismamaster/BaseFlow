/*
 * repro-array-blocks.js — WP-M5 (audit richiesto da Ismail 2026-07-21):
 * "assicurati che gli array funzionino in TUTTI i blocchi (in/out ecc), che ogni campo sia
 *  accessibile, che ogni blocco lo possa usare e generi gli errori principali relativi".
 *
 * Verifica l'ESECUTORE VERO (app/js/execute.js + core/safeEval.js + core/draw.js) contro un
 * DOM finto minimo, blocco per blocco: Assegna, Output, Ingresso, If, While, Do-While, For e
 * i blocchi grafici (Move/Draw, Turn). Per ciascuno: uso corretto + errori attesi.
 * In coda: validazione VISIVA (nodeHasError -> blocco rosso) per le forme indicizzate.
 *
 * Perche' un fake-DOM su misura e non jsdom: jsdom non e' installabile in questa sandbox
 * (rete bloccata, verificato 2026-07-20) e qui servono solo 4-5 API DOM reali.
 *
 * NB: executeNode e' ASYNC -- ogni test attende davvero la promise (senza await i risultati
 * si leggerebbero prima che il nodo abbia finito, e tutto "sembrerebbe" non fare nulla).
 *
 * Uso: node tools/repro-array-blocks.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
const results = [];
async function T(name, fn) {
  try { await fn(); pass++; results.push('  OK   ' + name); }
  catch (e) { fail++; results.push('  FAIL ' + name + ' -> ' + e.message); }
}
const eq = (a, b, what) => {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((what || '') + ' atteso ' + jb + ', avuto ' + ja);
};

// ---------------------------------------------------------------- fake DOM minimo
function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(), children: [], style: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    value: '', textContent: '', innerHTML: '', hidden: false, disabled: false,
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 200, height: 20, left: 0, top: 0, right: 200, bottom: 20 }; },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    closest() { return null; }, focus() {}, remove() {}, scrollIntoView() {}
  };
}
function buildSandbox() {
  const els = {};
  const get = id => (els[id] || (els[id] = makeEl('div')));
  const doc = {
    getElementById: id => get(id),
    createElement: tag => makeEl(tag),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, body: makeEl('body'), documentElement: makeEl('html'),
    activeElement: null, readyState: 'complete'
  };
  const sandbox = {
    document: doc, console, Math, JSON, Date, parseInt, parseFloat, isNaN, Number, String,
    Array, Object, RegExp, Error, Set, Map, Promise,
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0; }, clearTimeout() {},
    requestAnimationFrame: (fn) => { if (typeof fn === 'function') fn(0); return 0; },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    performance: { now: () => 0 },
    getComputedStyle: () => ({ getPropertyValue: () => '', backgroundColor: '', color: '' }),
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
    Blob: function () {}, FileReader: function () {},
    ResizeObserver: function () { return { observe() {} }; },
    MutationObserver: function () { return { observe() {} }; },
    alert() {}, confirm: () => true,
    // execute.js/draw.js registrano listener su window (beforeunload, resize, load).
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const load = f => {
    const src = fs.readFileSync(path.join(APP, f), 'utf8');
    try { vm.runInContext(src, sandbox, { filename: f }); }
    catch (e) { throw new Error('caricamento ' + f + ': ' + e.message); }
  };
  load('js/core/safeEval.js');
  // Stub minimi. NON si dichiarano qui le variabili che execute.js dichiara gia' con
  // let/var (currentNode, prevNode, runSpeed, stopRequested, pauseRequested, _execBranch,
  // consoleSettings): una seconda dichiarazione `let` fa fallire il caricamento.
  vm.runInContext(`
    var flow = { nodes: [], variables: [] };
    var nodi = []; var tabVariabili = { rows: [] };
    var executingNodeIndex = -1, executingEdge = null;
    var _paused = false, saved = true, darkMode = false, zoom = 1;
    function draw() {} function calcoloY() {} function resizeCanvas() {}
    function markSaved() {} function syncUnsavedIndicator() {} function updateProjectIdentity() {}
    function pushHistory() {} function collectLoopBody() { return { bodyList: [] }; }
    function showTurtlePanel() { return null; } function redrawTurtleMarker() {}
    function _tgRecomputeBounds() {} function _tgApplyZoom() {} function _tgScrollToTurtle() {}
    function _tgResizeCanvases() {} function ensureTurtlePanel() { return null; }
    function refreshVariablesWatch() {} function restoreVariablesTable() {}
    function _bfRenderArrayCells() {} function i18nText(k) { return k; }
    function i18nFormat(k, p) { return k + ':' + JSON.stringify(p || {}); }
    // errMsg vive in i18n.js (non caricato: tirerebbe dentro tutta la UI). Lo stub
    // restituisce la CHIAVE, che e' proprio cio' che i test verificano.
    function errMsg(k, p) { return k + ':' + JSON.stringify(p || {}); }
    var perfSettings = { consoleMax: false };
  `, sandbox);
  load('js/execute.js');
  load('js/core/draw.js'); // dopo execute.js: usa _varValueForExpr/_bfUninitUsedIn
  vm.runInContext(`
    var __errors = [];
    throwError = function (m) { __errors.push(String(m)); };
    var __printed = [];
    printMessage = function (msg) { __printed.push(String(msg)); };
  `, sandbox);
  return sandbox;
}

async function runNode(node, variables) {
  const S = buildSandbox();
  S.flow = { nodes: [node, { type: 'end', info: '', next: null }], variables };
  const p = vm.runInContext(`
    (async () => {
      try { await executeNode(flow.nodes[0], 0, flow.variables, null); } catch (e) { __errors.push('THROW:' + (e && e.message)); }
    })();
  `, S);
  await p;
  return { errors: S.__errors, printed: S.__printed, vars: S.flow.variables };
}
async function runInput(nodeInfo, variables, answer) {
  const S = buildSandbox();
  S.flow = { nodes: [{ type: 'input', info: nodeInfo, next: '1' }, { type: 'end', info: '', next: null }], variables };
  vm.runInContext(`askUserInput = function () { return Promise.resolve(${JSON.stringify(answer)}); };`, S);
  const p = vm.runInContext(`
    (async () => {
      try { await executeNode(flow.nodes[0], 0, flow.variables, null); } catch (e) { __errors.push('THROW:' + (e && e.message)); }
    })();
  `, S);
  await p;
  return { errors: S.__errors, vars: S.flow.variables };
}
function tgEval(expr, vars) {
  const S = buildSandbox();
  return JSON.parse(vm.runInContext(`
    __errors.length = 0;
    var __v = _tgEval(${JSON.stringify(expr)}, ${JSON.stringify(vars)}, 0);
    JSON.stringify({ v: __v, errs: __errors });
  `, S));
}
const arr = (name, type, value) => ({ name, type: 'array:' + type, value: value.slice() });
const scal = (name, type, value) => ({ name, type, value });
const hasErr = (r, frag) => r.errors.some(e => e.indexOf(frag) !== -1);
const mustErr = (r, frag) => { if (!hasErr(r, frag)) throw new Error('atteso ' + frag + ', avuto ' + JSON.stringify(r.errors)); };

(async function main() {
  console.log('--- WP-M5: array in TUTTI i blocchi ---');

  // ============================ ASSEGNA ============================
  await T('Assegna: scrittura su cella a[1] = 99', async () => {
    const r = await runNode({ type: 'assign', info: 'a[1] = 99', next: '1' }, [arr('a', 'int', [1, 2, 3])]);
    eq(r.errors, []); eq(r.vars[0].value, [1, 99, 3]);
  });
  await T('Assegna: indice da espressione a[i+1]', async () => {
    const r = await runNode({ type: 'assign', info: 'a[i+1] = 7', next: '1' }, [arr('a', 'int', [1, 2, 3]), scal('i', 'int', 1)]);
    eq(r.vars[0].value, [1, 2, 7]);
  });
  await T('Assegna: lettura da cella b = a[2]', async () => {
    const r = await runNode({ type: 'assign', info: 'b = a[2]', next: '1' }, [arr('a', 'int', [5, 6, 7]), scal('b', 'int', 0)]);
    eq(r.errors, []); eq(r.vars[1].value, 7);
  });
  await T('Assegna: a.length utilizzabile', async () => {
    const r = await runNode({ type: 'assign', info: 'n = a.length', next: '1' }, [arr('a', 'int', [1, 2, 3, 4]), scal('n', 'int', 0)]);
    eq(r.vars[1].value, 4);
  });
  await T('Assegna: copia array intero b = a', async () => {
    const r = await runNode({ type: 'assign', info: 'b = a', next: '1' }, [arr('a', 'int', [1, 2]), arr('b', 'int', [0, 0])]);
    eq(r.errors, []); eq(r.vars[1].value, [1, 2]);
  });
  await T('Assegna: cella in espressione aritmetica', async () => {
    const r = await runNode({ type: 'assign', info: 'a[0] = a[1] + a[2] * 2', next: '1' }, [arr('a', 'int', [0, 3, 4])]);
    eq(r.errors, []); eq(r.vars[0].value, [11, 3, 4]);
  });
  await T('Assegna ERRORE: indice fuori range', async () => {
    mustErr(await runNode({ type: 'assign', info: 'a[9] = 1', next: '1' }, [arr('a', 'int', [1, 2])]), 'err_index_range');
  });
  await T('Assegna ERRORE: indice negativo', async () => {
    mustErr(await runNode({ type: 'assign', info: 'a[0-1] = 1', next: '1' }, [arr('a', 'int', [1, 2])]), 'err_index_range');
  });
  await T('Assegna ERRORE: indice non intero', async () => {
    mustErr(await runNode({ type: 'assign', info: 'a[0.5] = 1', next: '1' }, [arr('a', 'int', [1, 2])]), 'err_index_int');
  });
  await T('Assegna ERRORE: indicizzare uno scalare', async () => {
    mustErr(await runNode({ type: 'assign', info: 'x[0] = 1', next: '1' }, [scal('x', 'int', 5)]), 'err_not_array');
  });
  await T('Assegna ERRORE: tipo elemento sbagliato', async () => {
    mustErr(await runNode({ type: 'assign', info: "a[0] = 'ciao'", next: '1' }, [arr('a', 'int', [1, 2])]), 'err_type_mismatch');
  });
  await T('Assegna ERRORE: scalare = array', async () => {
    mustErr(await runNode({ type: 'assign', info: 'x = a', next: '1' }, [arr('a', 'int', [1, 2]), scal('x', 'int', 0)]), 'err_type_mismatch');
  });

  // ============================ OUTPUT ============================
  await T('Output: stampa una cella', async () => {
    const r = await runNode({ type: 'print', info: 'a[0]', next: '1' }, [arr('a', 'int', [42, 7])]);
    eq(r.errors, []); eq(r.printed[0], '42');
  });
  await T('Output: stampa array intero formattato', async () => {
    const r = await runNode({ type: 'print', info: 'a', next: '1' }, [arr('a', 'int', [1, 2, 3])]);
    eq(r.printed[0], '[1, 2, 3]');
  });
  await T('Output: stampa a.length', async () => {
    const r = await runNode({ type: 'print', info: 'a.length', next: '1' }, [arr('a', 'int', [1, 2, 3])]);
    eq(r.printed[0], '3');
  });
  await T('Output: testo + cella', async () => {
    const r = await runNode({ type: 'print', info: "'val: ' + a[1]", next: '1' }, [arr('a', 'int', [1, 9])]);
    eq(r.printed[0], 'val: 9');
  });
  await T('Output: array di stringhe', async () => {
    const r = await runNode({ type: 'print', info: 's[1]', next: '1' }, [arr('s', 'string', ['x', 'ciao'])]);
    eq(r.printed[0], 'ciao');
  });
  await T('Output ERRORE: indice fuori range', async () => {
    mustErr(await runNode({ type: 'print', info: 'a[5]', next: '1' }, [arr('a', 'int', [1])]), 'err_index_range');
  });

  // ============================ CONDIZIONI (If / While / Do) ============================
  for (const tipo of ['if', 'while', 'do']) {
    await T(tipo + ': condizione su una cella a[0] > 5', async () => {
      const r = await runNode({ type: tipo, info: 'a[0] > 5', next: { true: '1', false: '1' } }, [arr('a', 'int', [10])]);
      eq(r.errors, []);
    });
    await T(tipo + ': condizione su a.length', async () => {
      const r = await runNode({ type: tipo, info: 'a.length == 3', next: { true: '1', false: '1' } }, [arr('a', 'int', [1, 2, 3])]);
      eq(r.errors, []);
    });
    await T(tipo + ' ERRORE: indice fuori range in condizione', async () => {
      const r = await runNode({ type: tipo, info: 'a[7] > 0', next: { true: '1', false: '1' } }, [arr('a', 'int', [1])]);
      if (!r.errors.length) throw new Error('doveva segnalare un errore');
    });
  }

  // ============================ FOR ============================
  await T('For: condizione con a.length', async () => {
    const r = await runNode({ type: 'for', info: 'i = 0; i < a.length; i += 1', next: { true: '1', false: '1' } },
      [arr('a', 'int', [1, 2, 3]), scal('i', 'int', 0)]);
    eq(r.errors, []);
  });
  await T('For: incremento con valore da cella', async () => {
    const r = await runNode({ type: 'for', info: 'i = 0; i < 10; i += a[0]', next: { true: '1', false: '1' } },
      [arr('a', 'int', [2]), scal('i', 'int', 0)]);
    eq(r.errors, []);
  });
  await T('For: init da cella', async () => {
    const r = await runNode({ type: 'for', info: 'i = a[0]; i < 10; i += 1', next: { true: '1', false: '1' } },
      [arr('a', 'int', [3]), scal('i', 'int', 0)]);
    eq(r.errors, []); eq(r.vars[1].value, 3);
  });

  // ============================ INGRESSO ============================
  await T('Ingresso: su una cella a[1]', async () => {
    const r = await runInput('a[1]', [arr('a', 'int', [0, 0, 0])], '77');
    eq(r.errors, []); eq(r.vars[0].value, [0, 77, 0]);
  });
  await T('Ingresso: array intero (conteggio esatto)', async () => {
    const r = await runInput('a', [arr('a', 'int', [0, 0, 0])], '4, 5, 6');
    eq(r.errors, []); eq(r.vars[0].value, [4, 5, 6]);
  });
  await T('Ingresso: array di stringhe', async () => {
    const r = await runInput('s', [arr('s', 'string', ['', ''])], 'ciao, mondo');
    eq(r.errors, []); eq(r.vars[0].value, ['ciao', 'mondo']);
  });
  await T('Ingresso ERRORE: cella fuori range', async () => {
    mustErr(await runInput('a[9]', [arr('a', 'int', [0])], '1'), 'err_index_range');
  });

  // ============================ BLOCCHI GRAFICI (tartaruga) ============================
  // WP-M5: qui c'era un BUG REALE -- _tgEval sostituiva con v.value.toString(), quindi un
  // array diventava "1,2,3" e `a[0]` si rompeva (e le stringhe restavano non quotate).
  await T('Move/Draw: distanza da una cella a[0]', () => {
    const o = tgEval('a[0]', [{ name: 'a', type: 'array:int', value: [40, 5] }]);
    eq(o.errs, [], 'errori:'); eq(o.v, 40, 'distanza:');
  });
  await T('Turn: angolo da a.length', () => {
    const o = tgEval('a.length * 30', [{ name: 'a', type: 'array:int', value: [1, 2, 3] }]);
    eq(o.errs, []); eq(o.v, 90);
  });
  await T('Grafica ERRORE: indice fuori range segnalato', () => {
    const o = tgEval('a[8]', [{ name: 'a', type: 'array:int', value: [1] }]);
    if (!o.errs.length) throw new Error('doveva segnalare un errore');
    if (o.errs.join().indexOf('err_index_range') === -1) throw new Error('messaggio generico invece di err_index_range: ' + o.errs.join());
  });
  await T('Grafica: stringa ora quotata (regressione R13-M)', () => {
    const o = tgEval('s.length', [{ name: 's', type: 'string', value: 'ciao' }]);
    eq(o.errs, []); eq(o.v, 4);
  });

  // ============================ VALIDAZIONE VISIVA (nodo rosso) ============================
  const layoutSrc = fs.readFileSync(path.join(APP, 'js/core/layout.js'), 'utf8');
  const sb2 = { console, Math, JSON, String, Number, RegExp, Error, parseFloat, parseInt, isNaN, Array, Object };
  sb2.window = sb2; vm.createContext(sb2);
  vm.runInContext(fs.readFileSync(path.join(APP, 'js/core/safeEval.js'), 'utf8'), sb2);
  vm.runInContext(
    layoutSrc.match(/function _bfExprSyntaxOk\(expr\) \{[\s\S]*?\n\}/)[0] + '\n' +
    layoutSrc.match(/function nodeHasError\(n\) \{[\s\S]*?\n\}/)[0], sb2);
  const nodeErr = (t, info) => vm.runInContext(`nodeHasError(${JSON.stringify({ type: t, info })})`, sb2);
  await T('Rosso: Assegna con indice valido NON e in errore', () => eq(nodeErr('assign', 'a[i+1] = 5'), false));
  await T('Rosso: Assegna con indice malformato E in errore', () => eq(nodeErr('assign', 'a[2+] = 5'), true));
  await T('Rosso: Assegna con indice vuoto E in errore', () => eq(nodeErr('assign', 'a[] = 5'), true));
  await T('Rosso: Ingresso a[i] valido NON e in errore', () => eq(nodeErr('input', 'a[i]'), false));
  await T('Rosso: Ingresso con indice malformato E in errore', () => eq(nodeErr('input', 'a[(]'), true));
  await T('Rosso: condizione con a.length NON e in errore', () => eq(nodeErr('if', 'i < a.length'), false));
  await T('Rosso: For con a.length NON e in errore', () => eq(nodeErr('for', 'i = 0; i < a.length; i += 1'), false));
  await T('Rosso: Output con cella NON e in errore', () => eq(nodeErr('print', 'a[0]'), false));

  console.log(results.join('\n'));
  console.log('\n=== TOTALE: ' + pass + '/' + (pass + fail) + ' PASS ===');
  console.log(fail ? '=== repro-array-blocks: FALLITO ===' : '=== repro-array-blocks: OK ===');
  process.exit(fail ? 1 : 0);
})();

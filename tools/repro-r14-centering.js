#!/usr/bin/env node
// tools/repro-r14-centering.js — harness PERMANENTE per la centratura del canvas.
//
// STORIA: nato per R14-E (ordine del tick). RISCRITTO 2026-07-19 (WP-6 v2, Fable) perche'
// lo stub PRECEDENTE modellava il DOM in modo SBAGLIATO: il container veniva simulato come
// {left:S, right:viewport}, cioe' NON ristretto dalla console — mentre nel browser reale
// #canvas-container ha margin-right/left: var(--console-cover-width) (style.css) e il suo
// rect finisce AL BORDO della console. Su quel modello irreale, la vecchia centerGraph()
// (che sottraeva SEMPRE l'intera larghezza console dal rect) risultava "giusta" — in
// produzione invece sottraeva la console DUE volte e il grafo finiva spinto di mezza
// console (a sinistra in LTR, a destra in RTL). Questo file ora modella il browser
// fedelmente (container gia' ristretto dalla var CSS) e include un CONTROLLO che dimostra
// il bug della vecchia matematica su questo stub corretto.
//
// COSA VERIFICA: centro del grafo == centro dell'area REALMENTE visibile fra sidebar
// Variabili e console agganciata: |centro_grafo - centro_visibile| <= 2, dove l'area
// visibile attesa e' [S, viewport-C] in LTR e [C, viewport-S] in RTL (S/C = larghezze
// REALI di sidebar/console). Scenari: solo sidebar, solo console, entrambe medie,
// entrambe al massimo (tetto console dipendente da --sidebar-width), grafo piu' largo
// (scroll), RTL, variabile CSS del cover IN RITARDO di un frame (LTR e RTL), sequenza di
// drag live della console.
//
// MANUTENZIONE: syncLayoutVars/updateZoomOffset/centerGraph/_bfSidebarLiveResizeTick sono
// COPIATE VERBATIM da init.js/execute.js/layout.js (mount bash storicamente inaffidabile
// su questi file). Se cambiano li', aggiornare ANCHE qui.
//
// Uso: node tools/repro-r14-centering.js — exit 0 se tutti gli scenari passano.

const viewport = 1600;

// ---------------------------------------------------------------------------
// DOM stub FEDELE: container ristretto dalla var --console-cover-width (margin CSS),
// console/sidebar con rect fisici completi (left/right), mirror automatico in RTL.
// ---------------------------------------------------------------------------
const mainClasses = new Set();
const consoleClasses = new Set();
const bodyVars = new Map();

let sidebarWidthVar = 300;
let consoleOpenFlag = false;
let consoleWidthFixed = 0;
let ceilingModelFlag = false;   // console max-width dipende da --sidebar-width (come style.css ~1337)
let currentGVar = 500;
let coverVarFrozenPx = null;    // se non-null: il MARGINE del container usa QUESTO valore
                                // (simula la var CSS in ritardo di un frame sul valore vero)

function isRtl() { return documentElementMock._dir === 'rtl'; }
function currentS() { return mainClasses.has('sidebar-collapsed') ? 0 : sidebarWidthVar; }
function currentG() { return currentGVar; }
function currentConsoleWidth() {
  if (!consoleOpenFlag) return 0;
  if (!ceilingModelFlag) return consoleWidthFixed;
  const sidebarVarPx = parseFloat(bodyVars.get('--sidebar-width')) || 0;
  return Math.min(2000, 700 - sidebarVarPx);
}
// Il margine effettivamente applicato al container in questo istante (var CSS).
function appliedCover() {
  if (coverVarFrozenPx != null) return coverVarFrozenPx;
  return parseFloat(bodyVars.get('--console-cover-width')) || 0;
}
function containerBounds() {
  const S = currentS(), M = appliedCover();
  return isRtl() ? { left: M, right: viewport - S } : { left: S, right: viewport - M };
}

const sidebarEl = {
  get offsetWidth() { return sidebarWidthVar; },
  getBoundingClientRect: () => {
    const S = currentS();
    return isRtl() ? { left: viewport - S, right: viewport, width: S, top: 0, bottom: 900 }
                   : { left: 0, right: S, width: S, top: 0, bottom: 900 };
  },
};
const mainEl = { classList: { contains: (c) => mainClasses.has(c) } };
const toolbarEl = { offsetHeight: 50 };
const consoleEl = {
  classList: { contains: (c) => consoleClasses.has(c) },
  getBoundingClientRect: () => {
    const C = currentConsoleWidth();
    return isRtl() ? { left: 0, right: C, width: C, top: 0, bottom: 900 }
                   : { left: viewport - C, right: viewport, width: C, top: 0, bottom: 900 };
  },
};
const containerEl = {
  scrollLeft: 0,
  get clientWidth() { const b = containerBounds(); return b.right - b.left; },
  get scrollWidth() { return Math.max(this.clientWidth, currentG()); },
  getBoundingClientRect: () => {
    const b = containerBounds();
    return { left: b.left, right: b.right, width: b.right - b.left, top: 0, bottom: 900, height: 900 };
  },
};
const canvasEl = {
  style: { marginLeft: '', marginRight: '' },
  getBoundingClientRect: () => {
    const b = containerBounds();
    const clientW = b.right - b.left, G = currentG();
    const scrollLeft = containerEl.scrollLeft;
    const marginLeft = parseFloat(canvasEl.style.marginLeft) || 0;
    // margin:0 auto dentro al container (direction:ltr forzata dal CSS, Punto 8):
    // centrato se entra, altrimenti allineato all'origine dello scroll.
    const naturalLeft = G <= clientW ? (b.left + (clientW - G) / 2) : b.left;
    const left = naturalLeft - scrollLeft + marginLeft;
    return { left, right: left + G, width: G, top: 0, bottom: 50, height: 50 };
  },
};
const documentElementMock = {
  _dir: 'ltr',
  getAttribute: (k) => (k === 'dir' ? documentElementMock._dir : null),
  setAttribute: (k, v) => { if (k === 'dir') documentElementMock._dir = v; },
};
const bodyEl = {
  style: {
    setProperty: (k, v) => bodyVars.set(k, v),
    getPropertyValue: (k) => bodyVars.get(k) || '',
  },
};
const document = {
  getElementById(id) {
    if (id === 'sidebar') return sidebarEl;
    if (id === 'main') return mainEl;
    if (id === 'toolbar') return toolbarEl;
    if (id === 'console-popup') return consoleEl;
    if (id === 'canvas') return canvasEl;
    if (id === 'canvas-container') return containerEl;
    return null;
  },
  body: bodyEl,
  documentElement: documentElementMock,
};
const window = {
  requestAnimationFrame: (fn) => fn(),
  getComputedStyle: (el) => ({ marginLeft: (el.style && el.style.marginLeft) || '0px' }),
};

const canvas = document.getElementById('canvas');
const container = document.getElementById('canvas-container');

// ---------------------------------------------------------------------------
// VERBATIM: js/core/init.js, corpo di window.syncLayoutVars.
// ---------------------------------------------------------------------------
function syncLayoutVars() {
  if (!(document.body && document.body.style && document.body.style.setProperty)) return;
  const tb = document.getElementById('toolbar');
  if (tb) document.body.style.setProperty('--toolbar-height', tb.offsetHeight + 'px');
  const main = document.getElementById('main');
  const sb = document.getElementById('sidebar');
  const collapsed = main && main.classList && main.classList.contains('sidebar-collapsed');
  const wpx = collapsed ? 44 : (sb ? sb.offsetWidth : 0);
  document.body.style.setProperty('--sidebar-width', (wpx || 240) + 'px');
}
window.syncLayoutVars = syncLayoutVars;

// ---------------------------------------------------------------------------
// VERBATIM: js/execute.js, updateZoomOffset().
// ---------------------------------------------------------------------------
function updateZoomOffset() {
  const c = document.getElementById('console-popup');
  const open = c && c.classList.contains('active') && c.classList.contains('docked');
  const coverW = open ? Math.round(c.getBoundingClientRect().width) : 0;
  const px = open ? coverW + 18 : 18;
  document.body.style.setProperty('--zoom-right', px + 'px');
  document.body.style.setProperty('--console-cover-width', coverW + 'px');
}

// ---------------------------------------------------------------------------
// VERBATIM: js/core/layout.js, centerGraph() (WP-6 v2, 2026-07-19).
// ---------------------------------------------------------------------------
function centerGraph() {
  if (typeof container === 'undefined' || !container || !canvas) return;
  if (typeof container.getBoundingClientRect !== 'function' || typeof canvas.getBoundingClientRect !== 'function') return;
  canvas.style.marginLeft = '';
  canvas.style.marginRight = '';

  const cRect = container.getBoundingClientRect();
  let visibleLeft = cRect.left, visibleRight = cRect.right;
  const _bfShaveOverlap = function (el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const r = el.getBoundingClientRect();
    if (!r || !(r.width > 0) || !(visibleRight > visibleLeft)) return;
    if (r.right <= visibleLeft || r.left >= visibleRight) return;
    const fromLeft = r.right - visibleLeft;
    const fromRight = visibleRight - r.left;
    if (fromLeft <= fromRight) visibleLeft += fromLeft; else visibleRight -= fromRight;
  };
  const cons = (typeof document !== 'undefined') ? document.getElementById('console-popup') : null;
  if (cons && cons.classList && typeof cons.classList.contains === 'function' && cons.classList.contains('active') && cons.classList.contains('docked')) {
    _bfShaveOverlap(cons);
  }
  const _sb = (typeof document !== 'undefined') ? document.getElementById('sidebar') : null;
  const _mainEl = (typeof document !== 'undefined') ? document.getElementById('main') : null;
  const _sbCollapsed = _mainEl && _mainEl.classList && typeof _mainEl.classList.contains === 'function' && _mainEl.classList.contains('sidebar-collapsed');
  if (_sb && !_sbCollapsed) _bfShaveOverlap(_sb);

  const visibleW = Math.max(60, visibleRight - visibleLeft);
  const targetCenter = visibleLeft + visibleW / 2;

  const canRect = canvas.getBoundingClientRect();
  const canvasCenter = canRect.left + canRect.width / 2;
  let delta = canvasCenter - targetCenter;

  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  const prevScrollLeft = container.scrollLeft;
  let newScrollLeft = prevScrollLeft + delta;
  newScrollLeft = Math.max(0, Math.min(maxScroll, newScrollLeft));
  container.scrollLeft = newScrollLeft;
  delta -= (newScrollLeft - prevScrollLeft);

  if (Math.abs(delta) > 0.5) {
    const cs = (typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(canvas) : null;
    const curML = cs ? (parseFloat(cs.marginLeft) || 0) : 0;
    canvas.style.marginLeft = (curML - delta) + 'px';
    canvas.style.marginRight = '0px';
  }
}

// ---------------------------------------------------------------------------
// VERBATIM: js/core/init.js, _bfSidebarRafPending + _bfSidebarLiveResizeTick()
// (rAF stubbato sincrono; _bfPlaceSidebarHandle/_bfFitToolbar assenti nello stub: il
// tick reale le chiama con guardia typeof, qui semplicemente non esistono).
// ---------------------------------------------------------------------------
let _bfSidebarRafPending = false;
function _bfSidebarLiveResizeTick() {
  if (_bfSidebarRafPending) return;
  _bfSidebarRafPending = true;
  (window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); })(function () {
    _bfSidebarRafPending = false;
    if (typeof window.syncLayoutVars === 'function') window.syncLayoutVars();
    if (typeof updateZoomOffset === 'function') updateZoomOffset();
    if (typeof centerGraph === 'function') centerGraph();
  });
}

// ---------------------------------------------------------------------------
// Scenari + runner
// ---------------------------------------------------------------------------
function resetCommon() {
  containerEl.scrollLeft = 0;
  canvasEl.style.marginLeft = '';
  canvasEl.style.marginRight = '';
  _bfSidebarRafPending = false;
  coverVarFrozenPx = null;
  bodyVars.delete('--console-cover-width');
}
function setScenario(cfg) {
  resetCommon();
  mainClasses.clear();
  if (cfg.sidebarCollapsed) mainClasses.add('sidebar-collapsed');
  sidebarWidthVar = cfg.sidebarWidth != null ? cfg.sidebarWidth : 300;
  consoleOpenFlag = !!cfg.consoleOpen;
  consoleClasses.clear();
  if (consoleOpenFlag) { consoleClasses.add('active'); consoleClasses.add('docked'); }
  consoleWidthFixed = cfg.consoleWidth || 0;
  ceilingModelFlag = !!cfg.ceilingModel;
  currentGVar = cfg.G != null ? cfg.G : 500;
  documentElementMock._dir = cfg.rtl ? 'rtl' : 'ltr';
  if (cfg.staleSidebarVarPx != null) bodyVars.set('--sidebar-width', cfg.staleSidebarVarPx + 'px');
  if (cfg.frozenCoverPx != null) coverVarFrozenPx = cfg.frozenCoverPx;
}
// Bersaglio ATTESO, indipendente dalla matematica di centerGraph: centro dell'area
// [S, viewport-C] (LTR) / [C, viewport-S] (RTL), con S/C larghezze REALI in questo istante.
function expectedTargetCenter() {
  const S = currentS(), C = currentConsoleWidth();
  const visibleLeft = isRtl() ? C : S;
  const visibleRight = isRtl() ? (viewport - S) : (viewport - C);
  const visibleW = Math.max(60, visibleRight - visibleLeft);
  return visibleLeft + visibleW / 2;
}
function measureCenter() {
  const r = canvasEl.getBoundingClientRect();
  return r.left + r.width / 2;
}

let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra) { if (cond) { pass++; console.log('  OK   ' + name); } else { fail++; failures.push(name + (extra ? ' -- ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' -- ' + extra : '')); } }

function runScenario(name, cfg) {
  console.log('=== ' + name + ' ===');
  setScenario(cfg);
  _bfSidebarLiveResizeTick();
  const got = measureCenter();
  const want = expectedTargetCenter();
  const diff = Math.abs(got - want);
  check(name + ': centro grafo entro 2px dal bersaglio', diff <= 2, 'got=' + got.toFixed(2) + ' want=' + want.toFixed(2) + ' diff=' + diff.toFixed(2));
  return { got, want };
}

// S0 — CONTROLLO STORICO: la VECCHIA matematica (sottrazione cieca dell'intera console dal
// rect del container) su questo stub FEDELE sbaglia di ~C/2. Se questo controllo smette di
// fallire, lo stub non modella piu' il margine CSS e l'intero harness va rivisto.
console.log('=== S0 CONTROLLO: la vecchia matematica (doppia sottrazione) sbaglia sul DOM fedele ===');
{
  setScenario({ sidebarWidth: 300, consoleOpen: true, consoleWidth: 400, G: 500 });
  syncLayoutVars(); updateZoomOffset(); // var applicata: container GIA' ristretto
  // vecchia formula, verbatim dal centerGraph pre-2026-07-19:
  const rightCover = consoleEl.getBoundingClientRect().width || 0;
  const cRect = containerEl.getBoundingClientRect();
  const oldTarget = cRect.left + Math.max(60, (cRect.right - rightCover) - cRect.left) / 2;
  const trueTarget = expectedTargetCenter();
  check('S0: bersaglio vecchio fuori tolleranza (bug riprodotto, atteso ~C/2=' + (rightCover / 2) + 'px)', Math.abs(oldTarget - trueTarget) > 2, 'old=' + oldTarget.toFixed(2) + ' true=' + trueTarget.toFixed(2));
}

// S1: sidebar espansa, console chiusa.
runScenario('S1 sidebar-only (S=300, console chiusa)', { sidebarWidth: 300, consoleOpen: false, G: 500 });

// S2: sidebar collassata, console aperta (media).
runScenario('S2 console-only (sidebar collassata, C=250)', { sidebarCollapsed: true, consoleOpen: true, consoleWidth: 250, G: 500 });

// S3: entrambe presenti, valori medi.
runScenario('S3 both-medium (S=300, C=250)', { sidebarWidth: 300, consoleOpen: true, consoleWidth: 250, G: 500 });

// S4: sidebar E console al MASSIMO, tetto console dipendente da --sidebar-width (stale
// all'ingresso): il tick unificato (sync -> zoom -> center) deve comunque centrare.
runScenario('S4 both-maximum (tetto console da --sidebar-width, var stale in ingresso)', { sidebarWidth: 300, consoleOpen: true, ceilingModel: true, G: 500, staleSidebarVarPx: 44 });

// S5: grafo piu' largo dello spazio visibile E dell'intero container -> scroll.
{
  runScenario('S5 G>W_avail, scroll-centering (S=300, C=400, G=1400)', { sidebarWidth: 300, consoleOpen: true, consoleWidth: 400, G: 1400 });
  check('S5: lo scroll e\' stato usato (overflow reale)', containerEl.scrollLeft > 0, 'scrollLeft=' + containerEl.scrollLeft);
}

// S6: RTL — la console sta fisicamente a SINISTRA, il ritaglio deve invertirsi da solo.
runScenario('S6 RTL (S=300, C=400, dir=rtl)', { sidebarWidth: 300, consoleOpen: true, consoleWidth: 400, rtl: true, G: 500 });
check('S6: nessuno scroll usato quando G <= W_avail', containerEl.scrollLeft === 0, 'scrollLeft=' + containerEl.scrollLeft);

// S7: la var del cover e' IN RITARDO (margine ancora a 0, console gia' aperta e larga):
// la console SI SOVRAPPONE al container e il ritaglio per overlap deve compensare.
// NB: qui si chiama SOLO centerGraph() (la fase del tick che gira col margine vecchio).
console.log('=== S7 cover-var in ritardo (LTR, margine=0, C=300) ===');
{
  setScenario({ sidebarWidth: 300, consoleOpen: true, consoleWidth: 300, G: 500, frozenCoverPx: 0 });
  syncLayoutVars(); // --sidebar-width ok, ma il margine del container resta congelato a 0
  centerGraph();
  const got = measureCenter(), want = expectedTargetCenter();
  check('S7: centrato anche col margine in ritardo', Math.abs(got - want) <= 2, 'got=' + got.toFixed(2) + ' want=' + want.toFixed(2));
}

// S8: come S7 ma in RTL (console a sinistra, margin-left in ritardo).
console.log('=== S8 cover-var in ritardo (RTL, margine=0, C=300) ===');
{
  setScenario({ sidebarWidth: 300, consoleOpen: true, consoleWidth: 300, G: 500, rtl: true, frozenCoverPx: 0 });
  syncLayoutVars();
  centerGraph();
  const got = measureCenter(), want = expectedTargetCenter();
  check('S8: centrato anche col margine in ritardo (RTL)', Math.abs(got - want) <= 2, 'got=' + got.toFixed(2) + ' want=' + want.toFixed(2));
}

// S9: DRAG LIVE della console (LTR e RTL): larghezza che cresce a passi, un tick per
// "frame" (transizioni spente da bf-live-drag nel browser: la var segue subito) — il
// centro deve essere giusto AD OGNI passo, non solo alla fine.
for (const rtl of [false, true]) {
  const label = 'S9 drag live console ' + (rtl ? '(RTL)' : '(LTR)');
  console.log('=== ' + label + ' ===');
  setScenario({ sidebarWidth: 300, consoleOpen: true, consoleWidth: 250, G: 500, rtl });
  let allOk = true, detail = '';
  for (const cw of [250, 300, 350, 420, 500]) {
    consoleWidthFixed = cw;
    _bfSidebarRafPending = false;
    _bfSidebarLiveResizeTick();
    const got = measureCenter(), want = expectedTargetCenter();
    if (Math.abs(got - want) > 2) { allOk = false; detail = 'C=' + cw + ' got=' + got.toFixed(2) + ' want=' + want.toFixed(2); break; }
  }
  check(label + ': centrato ad ogni passo del drag', allOk, detail);
}

console.log('');
console.log('=== TOTALE: ' + pass + '/' + (pass + fail) + ' PASS ===');
if (fail) { console.error('FALLITI:'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('=== repro-r14-centering: OK ===');

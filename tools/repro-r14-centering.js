#!/usr/bin/env node
// tools/repro-r14-centering.js — R14-E (Ismail 2026-07-13), harness PERMANENTE, RICHIESTO
// esplicitamente da Ismail ("scrivi più nel dettaglio cosa deve fare... il test deve
// asserire numericamente, non a occhio").
//
// COSA VERIFICA: la centratura orizzontale del canvas (centerGraph(), layout.js) nello
// spazio residuo fra sidebar Variabili e console agganciata, per OGNI combinazione di
// stato che il piano round-14 elenca esplicitamente, incluso il caso segnalato rotto da
// Ismail (sidebar E console entrambe al MASSIMO). Assertion (dal piano, verbatim):
//   |centro_grafo - (S + W_avail/2)| <= 2      [LTR; in RTL il bersaglio e' mirror-ato,
//                                                vedi expectedTargetCenter() sotto]
// dove S = larghezza REALE della sidebar (0/44 se collassata), C = larghezza REALE della
// console (0 se chiusa/non agganciata), W_avail = viewport - S - C.
//
// PERCHE' QUESTO FILE NON CARICA layout.js/execute.js/init.js VIA vm (a differenza di
// tools/repro-r14-scattered-move.js e affini): in QUESTA sessione Cowork il mount bash
// risultava sistematicamente STALE/troncato proprio sui 3 file toccati da R14-E (layout.js,
// execute.js, init.js — confermato con Grep/Read, autoritativi, contro wc -l/node --check
// via bash, che mostravano meno righe / errori di sintassi a fine file). Caricare quei file
// per intero via vm in questo momento avrebbe quindi verificato una versione VECCHIA senza
// che node --check se ne accorgesse. Le 4 funzioni sotto (syncLayoutVars, updateZoomOffset,
// centerGraph, _bfSidebarLiveResizeTick) sono percio' COPIATE LETTERALMENTE (verbatim, non
// riscritte/reinterpretate) dal contenuto autoritativo letto in quella sessione:
//   - syncLayoutVars    <- js/core/init.js  (corpo della chiusura dentro window.onload)
//   - updateZoomOffset  <- js/execute.js
//   - centerGraph       <- js/core/layout.js
//   - _bfSidebarLiveResizeTick + _bfSidebarRafPending <- js/core/init.js
// MANUTENZIONE: se una di queste 4 funzioni cambia, aggiorna ANCHE la copia qui sotto (o,
// meglio, converti questo harness a un vero vm-load come repro-r14-scattered-move.js non
// appena il mount e' verificato fresco) — altrimenti questo harness torna verde contro
// codice ormai superato, dando falsa sicurezza. La MATEMATICA di centraggio (scroll+margine,
// RTL) qui sotto NON e' reimplementata a parte: e' la stessa, testuale, che gira in
// produzione — solo il DOM che la circonda e' uno stub.
//
// Uso: node tools/repro-r14-centering.js — exit 0 se tutti gli scenari passano.

const viewport = 1600; // larghezza finestra simulata, fissa per tutti gli scenari

// ---------------------------------------------------------------------------
// DOM stub minimale: solo cio' che syncLayoutVars/updateZoomOffset/centerGraph leggono.
// ---------------------------------------------------------------------------
const mainClasses = new Set();
const consoleClasses = new Set();
const bodyVars = new Map();

let sidebarWidthVar = 300;   // sidebarEl.offsetWidth "vero" (live)
let consoleOpenFlag = false;
let consoleWidthFixed = 0;   // usato quando ceilingModelFlag=false
let ceilingModelFlag = false; // true SOLO nello scenario "both-maximum" (dipendenza reale da --sidebar-width)
let currentGVar = 500;       // larghezza "naturale" del canvas/bbox del grafo

function currentS() { return mainClasses.has('sidebar-collapsed') ? 44 : sidebarWidthVar; }
function currentG() { return currentGVar; }
// Modello della regola CSS reale "#console-popup.docked { max-width: calc(100vw -
// var(--sidebar-width) - 320px) }" (style.css ~1266): qui la costante e' scelta (700, non
// 320) solo per ottenere numeri comodi (C=400 quando S=300, come l'esempio del piano), la
// RELAZIONE (la larghezza della console dipende dalla var CSS --sidebar-width, che resta
// stale finche' syncLayoutVars() non gira) e' quella che conta per il test.
function currentConsoleWidth() {
  if (!consoleOpenFlag) return 0;
  if (!ceilingModelFlag) return consoleWidthFixed;
  const sidebarVarPx = parseFloat(bodyVars.get('--sidebar-width')) || 0;
  return Math.min(2000, 700 - sidebarVarPx);
}

const sidebarEl = { get offsetWidth() { return sidebarWidthVar; } };
const mainEl = { classList: { contains: (c) => mainClasses.has(c) } };
const toolbarEl = { offsetHeight: 50 };
const consoleEl = {
  classList: { contains: (c) => consoleClasses.has(c) },
  getBoundingClientRect: () => ({ width: currentConsoleWidth() }),
};
const containerEl = {
  scrollLeft: 0,
  get clientWidth() { return viewport - currentS(); },
  get scrollWidth() { return Math.max(viewport - currentS(), currentG()); },
  getBoundingClientRect: () => {
    const S = currentS();
    return { left: S, right: viewport, width: viewport - S, top: 0, bottom: 900, height: 900 };
  },
};
const canvasEl = {
  style: { marginLeft: '', marginRight: '' },
  getBoundingClientRect: () => {
    const S = currentS(), G = currentG();
    const clientW = viewport - S;
    const scrollLeft = containerEl.scrollLeft;
    const marginLeft = parseFloat(canvasEl.style.marginLeft) || 0;
    // Centratura CSS "naturale" (margin:auto) del canvas DENTRO al container, ignorando
    // (come nella realta') la console -- e' overlay/fixed, il container non la conosce.
    // Se il canvas eccede il container, gli auto-margin collassano a 0 (allineato a
    // sinistra, cioe' all'origine dello scroll) -- stesso comportamento di un browser reale.
    const naturalLeft = G <= clientW ? (S + (clientW - G) / 2) : S;
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
  requestAnimationFrame: (fn) => fn(), // sincrono: il tick gira subito, niente attesa asincrona nel test
  getComputedStyle: (el) => ({ marginLeft: (el.style && el.style.marginLeft) || '0px' }),
};

// stesse identiche righe di state.js (canvas/container = getElementById('canvas'/'canvas-container'))
const canvas = document.getElementById('canvas');
const container = document.getElementById('canvas-container');

// ---------------------------------------------------------------------------
// VERBATIM: js/core/init.js, corpo di window.syncLayoutVars (dentro window.onload).
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
// VERBATIM: js/core/layout.js, centerGraph() (righe 122-171 al momento della lettura).
// ---------------------------------------------------------------------------
function centerGraph() {
  if (typeof container === 'undefined' || !container || !canvas) return;
  if (typeof container.getBoundingClientRect !== 'function' || typeof canvas.getBoundingClientRect !== 'function') return;
  canvas.style.marginLeft = '';
  canvas.style.marginRight = '';

  let rightCover = 0;
  const cons = (typeof document !== 'undefined') ? document.getElementById('console-popup') : null;
  if (cons && cons.classList && typeof cons.classList.contains === 'function' && cons.classList.contains('active') && cons.classList.contains('docked') && typeof cons.getBoundingClientRect === 'function') {
    rightCover = cons.getBoundingClientRect().width || 0;
  }
  const _rtl = (typeof document !== 'undefined') && document.documentElement && typeof document.documentElement.getAttribute === 'function' && document.documentElement.getAttribute('dir') === 'rtl';

  const cRect = container.getBoundingClientRect();
  const visibleLeft = _rtl ? (cRect.left + rightCover) : cRect.left;
  const visibleRight = _rtl ? cRect.right : (cRect.right - rightCover);
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
// VERBATIM: js/core/init.js, _bfSidebarRafPending + _bfSidebarLiveResizeTick().
// requestAnimationFrame e' stubbato SINCRONO sopra (window.requestAnimationFrame), quindi
// il tick esegue subito la callback -- niente attesa asincrona necessaria nel test.
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
}
// Bersaglio ATTESO indipendente (stessa formula del piano: S + W_avail/2 in LTR, mirror-ato
// in RTL) -- NON e' la matematica di centerGraph() riscritta: e' il valore di riferimento
// contro cui l'output REALE di centerGraph() viene confrontato.
function expectedTargetCenter() {
  const S = currentS();
  const C = currentConsoleWidth();
  const rtl = documentElementMock._dir === 'rtl';
  const cLeft = S, cRight = viewport;
  const visibleLeft = rtl ? (cLeft + C) : cLeft;
  const visibleRight = rtl ? cRight : (cRight - C);
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
  _bfSidebarLiveResizeTick(); // il percorso UNIFICATO (R14-E): sync -> zoom -> center
  const got = measureCenter();
  const want = expectedTargetCenter();
  const diff = Math.abs(got - want);
  check(name + ': centro grafo entro 2px dal bersaglio', diff <= 2, 'got=' + got.toFixed(2) + ' want=' + want.toFixed(2) + ' diff=' + diff.toFixed(2));
  return { got, want };
}

// S1: sidebar espansa, console chiusa.
runScenario('S1 sidebar-only (S=300, console chiusa)', { sidebarWidth: 300, consoleOpen: false, G: 500 });

// S2: sidebar collassata, console aperta (medium).
runScenario('S2 console-only (sidebar collassata, C=250)', { sidebarCollapsed: true, consoleOpen: true, consoleWidth: 250, G: 500 });

// S3: entrambe presenti, valori medi.
runScenario('S3 both-medium (S=300, C=250)', { sidebarWidth: 300, consoleOpen: true, consoleWidth: 250, G: 500 });

// S4: IL CASO SEGNALATO ROTTO DA ISMAIL -- sidebar E console ENTRAMBE al MASSIMO. La
// larghezza REALE della console dipende (ceilingModel) dalla var CSS --sidebar-width, che
// resta STALE finche' syncLayoutVars() non gira -- questo e' esattamente il meccanismo del
// bug storico (vedi commento in init.js: "causa piu' probabile del centraggio sbagliato").
console.log('=== S4 both-maximum (S=300, tetto console dipendente da --sidebar-width) ===');
{
  // 4a: CONTROLLO -- riproduce il bug storico chiamando updateZoomOffset()+centerGraph()
  // DIRETTAMENTE (come facevano toggleVariables/run/closeConsole/toggleConsoleDock PRIMA
  // del fix R14-E), senza sincronizzare prima --sidebar-width: la console viene misurata
  // con un tetto calcolato sul valore VECCHIO (44, collassato) invece di quello vero (300).
  // Questo blocco DEVE restare fuori tolleranza: se non lo fosse, il "controllo" non
  // starebbe piu' dimostrando nulla (o il modello dello stub e' cambiato, o il bug non
  // esisteva mai) -- vedi l'assert dedicato sotto.
  setScenario({ sidebarWidth: 300, consoleOpen: true, ceilingModel: true, G: 500, staleSidebarVarPx: 44 });
  updateZoomOffset(); centerGraph(); // NIENTE syncLayoutVars() prima -- pattern pre-fix
  const gotBuggy = measureCenter();
  const wantTrue = (function () { const savedVar = bodyVars.get('--sidebar-width'); bodyVars.set('--sidebar-width', '300px'); const w = expectedTargetCenter(); bodyVars.set('--sidebar-width', savedVar); return w; })();
  check('S4 CONTROLLO: senza syncLayoutVars() prima, il centraggio sbaglia (bug storico riprodotto)', Math.abs(gotBuggy - wantTrue) > 2, 'got=' + gotBuggy.toFixed(2) + ' vero_target=' + wantTrue.toFixed(2));

  // 4b: percorso FISSATO (R14-E) -- stesso scenario, ma passando dal tick unificato, che
  // chiama syncLayoutVars() PRIMA di misurare la console: --sidebar-width riflette il
  // valore vero (300) quando updateZoomOffset()/centerGraph() leggono la console.
  runScenario('S4 both-maximum (percorso unificato R14-E, atteso entro tolleranza)', { sidebarWidth: 300, consoleOpen: true, ceilingModel: true, G: 500, staleSidebarVarPx: 44 });
}

// S5: grafo piu' largo dello spazio visibile (G > W_avail) -- E piu' largo dell'INTERO
// container (assorbimento via SCROLL, non solo margine): verifica requisito 2 del piano.
{
  const r = runScenario('S5 G>W_avail, scroll-centering (S=300, C=400, G=1400)', { sidebarWidth: 300, consoleOpen: true, consoleWidth: 400, G: 1400 });
  check('S5: lo scroll e\' stato usato (non solo margine, c\'era overflow reale)', containerEl.scrollLeft > 0, 'scrollLeft=' + containerEl.scrollLeft);
}

// S6: RTL -- console/sidebar "si specchiano" (requisito 3 del piano).
runScenario('S6 RTL (S=300, C=400, dir=rtl)', { sidebarWidth: 300, consoleOpen: true, consoleWidth: 400, rtl: true, G: 500 });

// Sanity aggiuntiva: nei casi SENZA overflow (G <= W_avail, S1/S2/S3/S6) niente scrollbar
// orizzontale (requisito 1 del piano) -- si verifica su S6 (l'ultimo eseguito) che lo
// scroll sia rimasto a 0 e la correzione sia passata dal margine.
check('S6: nessuno scroll usato quando G <= W_avail (niente scrollbar)', containerEl.scrollLeft === 0, 'scrollLeft=' + containerEl.scrollLeft);

console.log('');
console.log('=== TOTALE: ' + pass + '/' + (pass + fail) + ' PASS ===');
if (fail) { console.error('FALLITI:'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('=== repro-r14-centering: OK ===');

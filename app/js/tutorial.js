
window.addEventListener('load', () => {
    isInTutorial = false;
});

// Tutorial multilingua (Ismail 2026-07-07): i tour Shepherd vengono RICOSTRUITI a ogni
// avvio, cosi' testi E pulsanti sono nella lingua correntemente selezionata (i18n).
function tut(k) { return (typeof i18nText === 'function' && i18nText(k)) || ''; }
const TOUR_OPTS = {
  useModalOverlay: true,
  defaultStepOptions: {
    cancelIcon: { enabled: true },
    scrollTo: { behavior: 'smooth', block: 'center' },
    classes: 'shadow-md bg-purple-200',
  }
};

// ---------------- Tour principale ----------------
// WP-M (Ismail 2026-07-20, "il tutorial del ? non funziona da mobile"): due difese.
// 1) _stepSafe: se il bersaglio di uno step non ESISTE o non e' VISIBILE in questo istante
//    (es. sidebar Variabili collassata, pulsante dentro il menu More chiuso), l'attachTo
//    viene rimosso e lo step diventa centrato -- Shepherd non resta mai bloccato/invisibile
//    su un target mancante (era la causa piu' probabile del "non funziona" da telefono,
//    insieme al vecchio step su #new-btn, pulsante oggi RIMOSSO).
// 2) startTutorial: guard esplicito se Shepherd (CDN) non e' caricato + su mobile apre il
//    menu More cosi' i pulsanti secondari del tour sono visibili.
function _stepVisible(sel) {
  try {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  } catch (e) { return false; }
}
function _stepSafe(opts) {
  if (opts.attachTo && typeof opts.attachTo.element === 'string' && !_stepVisible(opts.attachTo.element)) {
    delete opts.attachTo;
  }
  return opts;
}
let tour = null;
function buildMainTour() {
  tour = new Shepherd.Tour(TOUR_OPTS);
  const next = () => tour.next();
  const back = () => tour.back();
  const bNext = () => ({ text: tut('tut_next'), action: next });
  const bBack = () => ({ text: tut('tut_back'), action: back });

  tour.addStep(_stepSafe({ id: 'start', text: tut('tut_start'), buttons: [bNext()] }));
  tour.addStep(_stepSafe({ id: 'table-info', text: tut('tut_table'), attachTo: { element: 'table', on: 'right' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({ id: 'new-var', text: tut('tut_name'), attachTo: { element: '[data-tour-id="step-insert-name"]', on: 'bottom' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({ id: 'select-type', text: tut('tut_type'), attachTo: { element: '[data-tour-id="step-insert-type"]', on: 'bottom' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({ id: 'value-info', text: tut('tut_value'), attachTo: { element: '[data-tour-id="step-insert-value"]', on: 'right' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({ id: 'canvas-zone', text: tut('tut_canvas'), attachTo: { element: '#canvas' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({
    id: 'arrows-use', text: tut('tut_arrows'),
    when: { show: () => { resizeCanvas(); pulsingFreccia(0, 7000); }, hide: () => { resizeCanvas(); pulseActive = false; } },
    attachTo: { element: '#canvas', on: 'center' }, buttons: [bBack(), bNext()]
  }));
  // Descrizione di TUTTI i blocchi (incluse le categorie e i nuovi Comment/Pause).
  tour.addStep(_stepSafe({ id: 'blocks-info', text: tut('tut_blocks'), attachTo: { element: '#canvas', on: 'center' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({
    id: 'nodes-use', text: tut('tut_nodes'),
    when: { show: () => { resizeCanvas(); pulsingNodo(1, 5000); }, hide: () => { resizeCanvas(); pulseNodoActive = false; } },
    attachTo: { element: '#canvas' }, buttons: [bBack(), bNext()]
  }));
  tour.addStep(_stepSafe({ id: 'navbar', text: tut('tut_toolbar'), attachTo: { element: '#toolbar', on: 'bottom' }, buttons: [bBack(), bNext()] }));
  // WP-M: #new-btn rimosso (doppione di Svuota) -- lo step punta ora a #clear-btn.
  tour.addStep(_stepSafe({ id: 'new', text: tut('tut_new'), attachTo: { element: '#clear-btn', on: 'bottom' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({ id: 'open', text: tut('tut_open'), attachTo: { element: '#open-btn', on: 'bottom' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({ id: 'save', text: tut('tut_savebtn'), attachTo: { element: '#save-file-btn', on: 'bottom' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({ id: 'run', text: tut('tut_terminal'), attachTo: { element: '#terminal-reopen', on: 'left' }, buttons: [bBack(), bNext()] }));
  tour.addStep(_stepSafe({ id: 'export', text: tut('tut_export'), attachTo: { element: '#export-btn', on: 'bottom-start' }, buttons: [bBack(), { text: tut('tut_done'), action: () => { tour.complete(); } }] }));
}

function startTutorial() {
  // WP-M: Shepherd arriva da CDN -- se offline/bloccato, avvisa invece di fallire in silenzio
  // (da mobile sembrava "il tutorial non funziona" senza alcun feedback).
  if (typeof Shepherd === 'undefined') {
    const msg = (typeof i18nText === 'function' && i18nText('tut_unavailable')) ||
      'Tutorial non disponibile (libreria non caricata): controlla la connessione e riprova.';
    if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: false }); else alert(msg);
    return;
  }
  if (tour && tour.isActive()) return;
  // WP-M: su mobile i pulsanti secondari vivono nel menu More -- aprilo prima del tour,
  // cosi' gli step che li puntano (svuota/esporta) trovano il bersaglio visibile.
  try { if (typeof window._bfSetMoreExpanded === 'function') window._bfSetMoreExpanded(true); } catch (e) {}
  buildMainTour();
  tour.start();
}

// ---------------- Animazioni di evidenziazione (invariate) ----------------
function evidenziaFreccia(index) {
  if (frecce.length === 0 || !frecce[index]) return;
  const freccia = frecce[index];
  ctx.beginPath();
  ctx.moveTo(freccia.inzioX, freccia.inzioY);
  ctx.lineTo(freccia.fineX, freccia.fineY);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 5;
  ctx.setLineDash([10, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

let pulseActive = false;
function pulsingFreccia(index, duration = 3000) {
  if (frecce.length === 0 || !frecce[index]) return;
  const freccia = frecce[index];
  const startTime = performance.now();
  pulseActive = true;
  function animate(time) {
    if (!pulseActive) return;
    const elapsed = time - startTime;
    if (elapsed > duration) { pulseActive = false; resizeCanvas(); return; }
    resizeCanvas();
    const thickness = 2 + Math.abs(Math.sin(elapsed / 200)) * 4;
    ctx.beginPath();
    ctx.moveTo(freccia.inzioX, freccia.inzioY);
    ctx.lineTo(freccia.fineX, freccia.fineY);
    ctx.strokeStyle = "red";
    ctx.lineWidth = thickness;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

let pulseNodoActive = true;
function pulsingNodo(index, duration = 3000) {
  if (nodi.length === 0 || !nodi[index]) return;
  if (nodi[index].text === 'Start' || nodi[index].text === 'End') return;
  const nodo = nodi[index];
  const originalColor = nodo.color || "white";
  const highlightColor = "orange";
  const startTime = performance.now();
  let active = true;
  pulseNodoActive = true;
  function animate(time) {
    if (!active || !pulseNodoActive) { nodo.color = originalColor; resizeCanvas(); return; }
    const elapsed = time - startTime;
    if (elapsed > duration) { nodo.color = originalColor; resizeCanvas(); return; }
    const t = Math.abs(Math.sin(elapsed / 200));
    nodo.color = t > 0.5 ? highlightColor : originalColor;
    resizeCanvas();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  return () => { active = false; nodo.color = originalColor; resizeCanvas(); };
}

// ---------------- Tour di modifica nodo ----------------
let editNodeTour = null;
function editNodeDescription() {
  const generic = tut('tut_edit_generic');
  const type = (typeof nodoSelected !== 'undefined' && flow.nodes[nodoSelected]) ? flow.nodes[nodoSelected].type : null;
  const map = {
    input: 'tut_edit_input', read: 'tut_edit_input',
    print: 'tut_edit_print', output: 'tut_edit_print', write: 'tut_edit_print',
    assign: 'tut_edit_assign', assignment: 'tut_edit_assign',
    if: 'tut_edit_if', while: 'tut_edit_while', for: 'tut_edit_for', do: 'tut_edit_do',
    comment: 'tut_edit_comment', pause: 'tut_edit_pause'
  };
  const key = type && map[type];
  return key ? (generic + '\n' + tut(key)) : generic;
}
function buildEditTour() {
  editNodeTour = new Shepherd.Tour(TOUR_OPTS);
  editNodeTour.addStep({ id: 'explain', text: tut('tut_edit_explain'), attachTo: { element: '#edit-node-popup', on: 'left' }, buttons: [{ text: tut('tut_next'), action: () => editNodeTour.next() }] });
  editNodeTour.addStep({ id: 'input', text: () => editNodeDescription(), attachTo: { element: '#edit-node-input', on: 'bottom' }, buttons: [{ text: tut('tut_back'), action: () => editNodeTour.back() }, { text: tut('tut_next'), action: () => editNodeTour.next() }] });
  editNodeTour.addStep({ id: 'save', text: tut('tut_edit_save'), attachTo: { element: '#edit-node-popup button:not(#close-edit-popup)', on: 'bottom' }, buttons: [{ text: tut('tut_back'), action: () => editNodeTour.back() }, { text: tut('tut_next'), action: () => editNodeTour.next() }] });
  editNodeTour.addStep({ id: 'close', text: tut('tut_edit_close'), attachTo: { element: '#close-edit-popup', on: 'bottom' }, buttons: [{ text: tut('tut_back'), action: () => editNodeTour.back() }, { text: tut('tut_done'), action: () => editNodeTour.complete() }] });
}
function startEditTour() {
  if (editNodeTour && editNodeTour.isActive()) return;
  buildEditTour();
  editNodeTour.start();
}

// ---------------- Tour del terminale ----------------
let consoleTour = null;
function buildConsoleTour() {
  consoleTour = new Shepherd.Tour(TOUR_OPTS);
  consoleTour.addStep({ id: 'console-popup-intro', text: tut('tut_con_intro'), attachTo: { element: '#console-popup', on: 'top' }, buttons: [{ text: tut('tut_next'), action: () => consoleTour.next() }] });
  consoleTour.addStep({ id: 'console-output', text: tut('tut_con_output'), attachTo: { element: '#console-output', on: 'top' }, buttons: [{ text: tut('tut_back'), action: () => consoleTour.back() }, { text: tut('tut_next'), action: () => consoleTour.next() }] });
  consoleTour.addStep({ id: 'console-input', text: tut('tut_con_input'), attachTo: { element: '#console-input-section', on: 'left' }, buttons: [{ text: tut('tut_back'), action: () => consoleTour.back() }, { text: tut('tut_next'), action: () => consoleTour.next() }] });
  consoleTour.addStep({ id: 'console-buttons', text: tut('tut_con_buttons'), attachTo: { element: '#console-bottombar', on: 'top' }, buttons: [{ text: tut('tut_back'), action: () => consoleTour.back() }, { text: tut('tut_done'), action: () => consoleTour.complete() }] });
}
function startConsoleTour() {
  if (consoleTour && consoleTour.isActive()) return;
  const popup = document.getElementById('console-popup');
  if (popup && !popup.classList.contains('active')) popup.classList.add('active');
  buildConsoleTour();
  consoleTour.start();
}

// ---------------- Tutorial del singolo BLOCCO (rilievo 31) ----------------
// Usa la STESSA libreria (Shepherd), stessa metodologia e stile degli altri tutorial.
// Ogni tipo di blocco (compresi i blocchi della tartaruga) ha la propria descrizione.
let blockTour = null;
const BLOCK_TUT_KEY = {
  input: 'tut_edit_input', print: 'tut_edit_print', output: 'tut_edit_print', read: 'tut_edit_input',
  assign: 'tut_edit_assign', if: 'tut_edit_if', while: 'tut_edit_while', for: 'tut_edit_for',
  do: 'tut_edit_do', comment: 'tut_edit_comment', pause: 'tut_edit_pause',
  forward: 'tut_edit_forward', turn: 'tut_edit_turn', home: 'tut_edit_home', pen: 'tut_edit_pen', gclear: 'tut_edit_gclear',
  start: 'tut_edit_generic', end: 'tut_edit_generic'
};
function startBlockTutorial(type) {
  if (typeof Shepherd === 'undefined') return false;
  if (blockTour && blockTour.isActive()) return true;
  blockTour = new Shepherd.Tour(TOUR_OPTS);
  const label = (typeof nodeDisplayLabel === 'function') ? nodeDisplayLabel(type) : (type || '');
  const desc = tut(BLOCK_TUT_KEY[type] || 'tut_edit_generic');
  const step = {
    id: 'block-help',
    title: label ? String(label) : undefined,
    text: desc,
    buttons: [{ text: tut('tut_done') || 'Fine', action: () => blockTour.complete() }]
  };
  // Se e' aperta una finestra di modifica del blocco, ancora il tooltip ad essa; altrimenti centro schermo.
  // A2 (round 11): 'on' FISSO a 'right' finiva stretto/tagliato o sovrapposto quando il popup
  // e' largo o vicino al bordo (caso tipico: #draw-popup dei blocchi Disegno). Omettendo 'on',
  // Shepherd/Popper sceglie da solo il lato con piu' spazio (stesso pattern gia' usato altrove
  // in questo file, es. lo step 'canvas-zone' sopra, che non specifica 'on').
  const openPop = ['edit-node-popup', 'for-popup', 'draw-popup'].map(function (id) { return document.getElementById(id); })
    .find(function (e) { return e && e.classList && e.classList.contains('active'); });
  if (openPop) step.attachTo = { element: '#' + openPop.id };
  blockTour.addStep(step);
  blockTour.start();
  return true;
}
if (typeof window !== 'undefined') window.startBlockTutorial = startBlockTutorial;

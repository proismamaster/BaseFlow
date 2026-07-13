
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
let tour = null;
function buildMainTour() {
  tour = new Shepherd.Tour(TOUR_OPTS);
  const next = () => tour.next();
  const back = () => tour.back();
  const bNext = () => ({ text: tut('tut_next'), action: next });
  const bBack = () => ({ text: tut('tut_back'), action: back });

  tour.addStep({ id: 'start', text: tut('tut_start'), buttons: [bNext()] });
  tour.addStep({ id: 'table-info', text: tut('tut_table'), attachTo: { element: 'table', on: 'right' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'new-var', text: tut('tut_name'), attachTo: { element: '[data-tour-id="step-insert-name"]', on: 'bottom' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'select-type', text: tut('tut_type'), attachTo: { element: '[data-tour-id="step-insert-type"]', on: 'bottom' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'value-info', text: tut('tut_value'), attachTo: { element: '[data-tour-id="step-insert-value"]', on: 'right' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'canvas-zone', text: tut('tut_canvas'), attachTo: { element: '#canvas' }, buttons: [bBack(), bNext()] });
  tour.addStep({
    id: 'arrows-use', text: tut('tut_arrows'),
    when: { show: () => { resizeCanvas(); pulsingFreccia(0, 7000); }, hide: () => { resizeCanvas(); pulseActive = false; } },
    attachTo: { element: '#canvas', on: 'center' }, buttons: [bBack(), bNext()]
  });
  // Descrizione di TUTTI i blocchi (incluse le categorie e i nuovi Comment/Pause).
  tour.addStep({ id: 'blocks-info', text: tut('tut_blocks'), attachTo: { element: '#canvas', on: 'center' }, buttons: [bBack(), bNext()] });
  tour.addStep({
    id: 'nodes-use', text: tut('tut_nodes'),
    when: { show: () => { resizeCanvas(); pulsingNodo(1, 5000); }, hide: () => { resizeCanvas(); pulseNodoActive = false; } },
    attachTo: { element: '#canvas' }, buttons: [bBack(), bNext()]
  });
  tour.addStep({ id: 'navbar', text: tut('tut_toolbar'), attachTo: { element: '#toolbar', on: 'bottom' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'new', text: tut('tut_new'), attachTo: { element: '#new-btn', on: 'bottom' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'open', text: tut('tut_open'), attachTo: { element: '#open-btn', on: 'bottom' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'save', text: tut('tut_savebtn'), attachTo: { element: '#save-file-btn', on: 'bottom' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'run', text: tut('tut_terminal'), attachTo: { element: '#terminal-reopen', on: 'left' }, buttons: [bBack(), bNext()] });
  tour.addStep({ id: 'export', text: tut('tut_export'), attachTo: { element: '#export-btn', on: 'bottom-start' }, buttons: [bBack(), { text: tut('tut_done'), action: () => { tour.complete(); } }] });
}

function startTutorial() {
  if (tour && tour.isActive()) return;
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

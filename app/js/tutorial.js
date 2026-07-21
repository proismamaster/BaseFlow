
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
// WP-M6k (Ismail: "quando fa start ti apre subito il popup dei blocchi, ma dovrebbe farlo solo
// quando si parla di quello"). Il tentativo precedente apriva la palette PRIMA di costruire il
// tour, per far sopravvivere gli ancoraggi -- ma cosi' il popup compariva subito all'avvio.
// Il problema vero e' che _stepSafe valuta la VISIBILITA' al momento della COSTRUZIONE: per un
// elemento che sara' visibile piu' tardi (la palette la apre un passo del tour stesso) toglie
// l'ancoraggio a torto. Per quei passi basta un criterio diverso: l'ancoraggio si tiene se
// l'elemento ESISTE nel documento, indipendentemente dal fatto che ora sia nascosto.
function _stepLater(opts) {
  if (opts.attachTo && typeof opts.attachTo.element === 'string') {
    try { if (!document.querySelector(opts.attachTo.element)) delete opts.attachTo; }
    catch (e) { delete opts.attachTo; }
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
  tour.addStep(_stepSafe({ id: 'canvas-zone', text: tut('tut_canvas'), classes: 'bf-no-arrow', attachTo: { element: '#canvas' }, buttons: [bBack(), bNext()] }));
  // WP-M6i (Ismail 2026-07-21, "non si capisce bene dove porta" + "non punta giusto"):
  // il passo delle frecce restava ancorato al centro del canvas mentre il testo diceva
  // "clicca una freccia", senza mostrarne nessuna in particolare. Ora la freccia pulsa E il
  // riquadro si ancora alla freccia stessa (l'evidenziazione la fa pulsingFreccia sul canvas,
  // che non ha elementi DOM: il bersaglio resta il canvas, ma centrato sulla freccia accesa).
  tour.addStep(_stepSafe({
    id: 'arrows-use', text: tut('tut_arrows'), classes: 'bf-no-arrow',
    when: { show: () => { resizeCanvas(); pulsingFreccia(0, 7000); }, hide: () => { resizeCanvas(); pulseActive = false; } },
    attachTo: { element: '#canvas', on: 'center' }, buttons: [bBack(), bNext()]
  }));
  // WP-M6i: "dovrebbe poi aprire da solo il popup di spiegazione". Il passo successivo APRE
  // la palette: cosi' i passi sui blocchi hanno bersagli visibili e si vede subito il nesso
  // fra "clicco una freccia" e "si apre questa finestra".
  tour.addStep(_stepLater({
    id: 'palette-open', text: tut('tut_palette_open'),
    when: { show: () => { try { const pw = document.getElementById('popup-window'); if (pw) pw.classList.add('active'); } catch (e) {} } },
    attachTo: { element: '#popup-window', on: 'right' }, buttons: [bBack(), bNext()]
  }));
  // WP-M6i (Ismail: il paragrafo che elencava TUTTI i blocchi "non va bene, deve solo far
  // vedere i comandi"): quel muro di testo e' stato tolto dal tour principale. La spiegazione
  // blocco per blocco vive dove serve davvero -- il pulsante "?" della palette
  // (startAllBlocksTutorial) -- e qui si dice solo che esiste.
  tour.addStep(_stepLater({ id: 'blocks-info', text: tut('tut_blocks_short'), attachTo: { element: '#palette-help', on: 'right' }, buttons: [bBack(), bNext()] }));
  // WP-M6f (Ismail 2026-07-21, "rendi piu' coerente il tutorial, punti giusti, ordinato, deve
  // essere per tutti i blocchi"): prima c'era UN SOLO passo che elencava tutte le famiglie in
  // un paragrafo, ancorato al canvas -- quindi senza mai indicare il blocco di cui parlava.
  // Ora un passo per SEZIONE della palette, ancorato alla sezione vera e NELL'ORDINE in cui
  // compaiono nel DOM: chi segue il tutorial vede evidenziato esattamente cio' che legge.
  // La palette e' un popup che puo' essere chiuso: _stepSafe toglie da solo l'ancoraggio se
  // l'elemento non e' visibile, quindi il passo resta (col suo testo) invece di sparire.
  var SEZIONI_PALETTE = [
    ['pal-io',     '#io-section',        'tut_pal_io'],
    ['pal-math',   '#variables-section', 'tut_pal_math'],
    ['pal-sel',    '#control-section',   'tut_pal_sel'],
    ['pal-loops',  '#loops-section',     'tut_pal_loops'],
    ['pal-tools',  '#tools-section',     'tut_pal_tools'],
    ['pal-gfx',    '#graphics-section',  'tut_pal_gfx']
  ];
  SEZIONI_PALETTE.forEach(function (sz) {
    tour.addStep(_stepLater({ id: sz[0], text: tut(sz[2]), attachTo: { element: sz[1], on: 'right' }, buttons: [bBack(), bNext()] }));
  });
  tour.addStep(_stepSafe({
    id: 'nodes-use', text: tut('tut_nodes'), classes: 'bf-no-arrow',
    when: { show: () => { resizeCanvas(); pulsingNodo(1, 5000); }, hide: () => { resizeCanvas(); pulseNodoActive = false; } },
    attachTo: { element: '#canvas' }, buttons: [bBack(), bNext()]
  }));
  tour.addStep(_stepSafe({ id: 'navbar', text: tut('tut_toolbar'), attachTo: { element: '#toolbar', on: 'bottom' }, buttons: [bBack(), bNext()] }));
  // WP-M6f: i passi della toolbar seguono ora l'ORDINE REALE dei pulsanti nel DOM e li coprono
  // TUTTI. Prima erano 5 su 16 e in ordine sparso (Svuota veniva prima di Apri, il terminale
  // puntava a #terminal-reopen che non e' nemmeno in toolbar): chi seguiva il tutorial vedeva
  // il riquadro saltare avanti e indietro lungo la barra, e non sentiva mai parlare di
  // undo/redo, dei comandi di esecuzione, della velocita', delle impostazioni e del manuale.
  // L'elenco e' una tabella cosi' l'ordine e' verificabile a colpo d'occhio e resta allineato
  // al markup: se un domani un pulsante si sposta, si sposta la riga corrispondente.
  var PASSI_TOOLBAR = [
    ['open',      '#open-btn',       'tut_open',      'bottom'],
    ['save',      '#save-file-btn',  'tut_savebtn',   'bottom'],
    ['save-as',   '#save-as-btn',    'tut_saveas',    'bottom'],
    ['undo-redo', '#undo-btn',       'tut_undoredo',  'bottom'],
    ['clear',     '#clear-btn',      'tut_new',       'bottom'],
    ['export',    '#export-btn',     'tut_export',    'bottom'],
    // WP-M6i (Ismail: "voglio che mostri ogni blocco con una frase, non tutto il gruppo"):
    // i cinque comandi di esecuzione hanno un passo ciascuno, ancorato al proprio pulsante.
    ['run',       '#console-exe',    'tut_btn_run',   'bottom'],
    ['step',      '#console-step',   'tut_btn_step',  'bottom'],
    ['pause',     '#exec-pause',     'tut_btn_pause', 'bottom'],
    ['stop',      '#console-stop',   'tut_btn_stop',  'bottom'],
    ['reset',     '#console-reset',  'tut_btn_reset', 'bottom'],
    ['speed',     '#run-speed',      'tut_speed',     'bottom'],
    ['settings',  '#settings-btn',   'tut_settings',  'bottom'],
    ['manual',    '#manual-btn',     'tut_manualbtn', 'bottom-end']
  ];
  PASSI_TOOLBAR.forEach(function (ps, i) {
    var ultimo = (i === PASSI_TOOLBAR.length - 1);
    tour.addStep(_stepSafe({
      id: ps[0], text: tut(ps[2]), attachTo: { element: ps[1], on: ps[3] },
      buttons: ultimo
        ? [bBack(), { text: tut('tut_done'), action: function () { tour.complete(); } }]
        : [bBack(), bNext()]
    }));
  });
  // Il terminale ha un tour dedicato (consoleTour): qui basta il passo sui comandi di
  // esecuzione qui sopra, che e' dove il terminale si apre davvero.
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
  // WP-M6f: il pulsante di chiusura di questo popup NON ha un id (e' `<button class="x-close">`),
  // quindi il vecchio ancoraggio `#close-edit-popup` puntava nel vuoto e il riquadro del tutorial
  // finiva a caso; anche il `:not(#close-edit-popup)` del passo precedente non escludeva nulla.
  // Ora si usano i selettori REALI. Trovato dal test che confronta gli ancoraggi col markup.
  editNodeTour.addStep({ id: 'save', text: tut('tut_edit_save'), attachTo: { element: '#edit-node-popup button:not(.x-close)', on: 'bottom' }, buttons: [{ text: tut('tut_back'), action: () => editNodeTour.back() }, { text: tut('tut_next'), action: () => editNodeTour.next() }] });
  editNodeTour.addStep({ id: 'close', text: tut('tut_edit_close'), attachTo: { element: '#edit-node-popup .x-close', on: 'bottom' }, buttons: [{ text: tut('tut_back'), action: () => editNodeTour.back() }, { text: tut('tut_done'), action: () => editNodeTour.complete() }] });
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
  if (_bfTutorialPopupBloccato()) return false; // WP-M6n: non su mobile
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


// WP-M6n (Ismail 2026-07-21, "va disattivato il tutorial da tutti i popup su mobile che da
// problemi"): sotto i 760px i tour ANCORATI AI POPUP non sono usabili -- overlay modale e
// popup si contendono lo schermo e i bersagli finiscono coperti. I pulsanti spariscono via
// CSS, ma un pulsante nascosto non e' una garanzia: la funzione resta chiamabile da tastiera,
// da un handler residuo o da un tour precedente. La guardia sta qui, dove l'effetto nasce.
// NON riguarda il tour PRINCIPALE (startTutorial), che su mobile e' gia' stato adattato
// (menu More aperto, _stepSafe sui bersagli invisibili) e continua a funzionare.
function _bfTutorialPopupBloccato() {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 760px)').matches;
  } catch (e) { return false; }
}

// ---------------- WP-M6h: tour "tutti i blocchi, uno a uno" (pulsante ? della palette) ----
// Ismail: "dentro il popup dei blocchi ci deve essere un punto di domanda che mostra tutti i
// blocchi uno a uno utilizzando la spiegazione del manuale".
// Non si duplica nessun testo: si riusano le STESSE chiavi gia' usate dall'aiuto del singolo
// blocco (BLOCK_TUT_KEY) -- le stesse frasi del manuale -- e i nomi tradotti da
// nodeDisplayLabel. Cosi' una correzione a quelle descrizioni si propaga ovunque da sola.
// L'ORDINE e i pulsanti su cui si ancora sono quelli REALI della palette: ogni passo evidenzia
// il pulsante di cui sta parlando, invece di un paragrafo unico ancorato al canvas.
let allBlocksTour = null;
const PALETTE_BLOCKS = [
  ['#input-btn', 'input'], ['#output-btn', 'print'],
  ['#assign-btn', 'assign'],
  ['#if-btn', 'if'],
  ['#do-while-btn', 'do'], ['#while-btn', 'while'], ['#for-btn', 'for'],
  ['#comment-btn', 'comment'], ['#pause-btn', 'pause'],
  ['#forward-btn', 'forward'], ['#turn-btn', 'turn'], ['#home-btn', 'home'],
  ['#pen-btn', 'pen'], ['#clearscreen-btn', 'gclear']
];
function startAllBlocksTutorial() {
  if (_bfTutorialPopupBloccato()) return; // WP-M6n: non su mobile
  if (typeof Shepherd === 'undefined') {
    const msg = (typeof i18nText === 'function' && i18nText('tut_unavailable')) || 'Tutorial non disponibile.';
    if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: false }); else alert(msg);
    return;
  }
  if (allBlocksTour && allBlocksTour.isActive()) return;
  // La palette DEVE essere aperta: e' li' che stanno i bersagli.
  try { const pw = document.getElementById('popup-window'); if (pw) pw.classList.add('active'); } catch (e) {}
  allBlocksTour = new Shepherd.Tour(TOUR_OPTS);
  const nx = () => allBlocksTour.next(), bk = () => allBlocksTour.back();
  PALETTE_BLOCKS.forEach(function (b, i) {
    const ultimo = (i === PALETTE_BLOCKS.length - 1);
    const label = (typeof nodeDisplayLabel === 'function') ? nodeDisplayLabel(b[1]) : b[1];
    allBlocksTour.addStep(_stepSafe({
      id: 'blk-' + b[1],
      title: label ? String(label) : undefined,
      text: tut(BLOCK_TUT_KEY[b[1]] || 'tut_edit_generic'),
      attachTo: { element: b[0], on: 'right' },
      buttons: [].concat(
        i > 0 ? [{ text: tut('tut_back'), action: bk }] : [],
        [ultimo ? { text: tut('tut_done'), action: () => allBlocksTour.complete() } : { text: tut('tut_next'), action: nx }]
      )
    }));
  });
  allBlocksTour.start();
}

// ---------------- WP-M6h: tour delle IMPOSTAZIONI (pulsante ? del popup impostazioni) ------
// Ismail: "anche nelle impostazioni un ? opposto alla x che mostri cosa faccia ogni
// impostazione e a cosa serva". Un passo per controllo, ancorato al controllo vero,
// nell'ordine in cui compaiono nel popup.
let settingsTour = null;
// WP-M6j (Ismail 2026-07-21): tolto il passo sulla VELOCITA' -- `#run-speed` sta nella
// toolbar, non in questo popup, quindi il riquadro finiva "a caso" su un elemento fuori
// contesto. Aggiunti invece i quattro MESSAGGI DEL TERMINALE, che il popup ha davvero e di
// cui il tour non parlava: l'ordine qui sotto e' quello reale del markup.
const SETTINGS_STEPS = [
  ['#lang-select',      'tut_set_lang'],
  ['#theme-select',     'tut_set_theme'],
  ['#view-grid',        'tut_set_grid'],
  ['#cset-output',      'tut_set_msg_output'],
  ['#cset-cond',        'tut_set_msg_cond'],
  ['#cset-loop',        'tut_set_msg_loop'],
  ['#cset-debug',       'tut_set_msg_debug'],
  ['#perf-anim',        'tut_set_anim'],
  ['#perf-hover',       'tut_set_hover'],
  ['#perf-lowres',      'tut_set_lowres'],
  ['#perf-conmax',      'tut_set_conmax'],
  ['#perf-turbo',       'tut_set_turbo'],
  ['#perf-loopguard',   'tut_set_loopguard'],
  ['#perf-fps',         'tut_set_fps']
];
function startSettingsTutorial() {
  if (_bfTutorialPopupBloccato()) return; // WP-M6n: non su mobile
  if (typeof Shepherd === 'undefined') return;
  if (settingsTour && settingsTour.isActive()) return;
  try { const sp = document.getElementById('settings-popup'); if (sp) sp.classList.add('active'); } catch (e) {}
  settingsTour = new Shepherd.Tour(TOUR_OPTS);
  const nx = () => settingsTour.next(), bk = () => settingsTour.back();
  SETTINGS_STEPS.forEach(function (st, i) {
    const ultimo = (i === SETTINGS_STEPS.length - 1);
    settingsTour.addStep(_stepSafe({
      id: 'set-' + i, text: tut(st[1]), attachTo: { element: st[0], on: 'right' },
      buttons: [].concat(
        i > 0 ? [{ text: tut('tut_back'), action: bk }] : [],
        [ultimo ? { text: tut('tut_done'), action: () => settingsTour.complete() } : { text: tut('tut_next'), action: nx }]
      )
    }));
  });
  settingsTour.start();
}
if (typeof window !== 'undefined') {
  window.startAllBlocksTutorial = startAllBlocksTutorial;
  window.startSettingsTutorial = startSettingsTutorial;
}

// ---------------- WP-M6p: INVIO = passo successivo -------------------------------------
// Ismail 2026-07-21: "fai che nel tutorial con Enter vai al next step".
// Un listener SOLO, su document, invece di uno per tour: i tour vengono ricostruiti a ogni
// avvio (per la lingua), quindi agganciarlo ai singoli tour significherebbe ricrearlo e
// rischiare doppioni. Shepherd espone il tour attivo in Shepherd.activeTour: si chiede a lui
// qual e' il passo corrente, quindi la scorciatoia funziona per TUTTI i tour -- principale,
// blocchi, impostazioni, terminale -- senza aggiungere niente a ciascuno.
// Regole:
//  - se il passo ha un pulsante "avanti", si preme quello (cosi' esegue anche la sua azione,
//    es. aprire la palette); se e' l'ultimo, si completa il tour;
//  - Invio dentro un campo di testo NON viene intercettato: li' significa "conferma", e il
//    tutorial puo' essere aperto mentre si scrive in un input (nome variabile, valore...);
//  - Esc lo gestisce gia' Shepherd (cancel), non si tocca.
(function () {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  function inCampoDiTesto(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (typeof Shepherd === 'undefined' || !Shepherd.activeTour) return;
    if (inCampoDiTesto(e.target)) return;
    const step = Shepherd.activeTour.getCurrentStep && Shepherd.activeTour.getCurrentStep();
    if (!step) return;
    e.preventDefault();
    // Il pulsante "avanti" e' l'ULTIMO del piede: nei nostri passi e' Avanti oppure Fine.
    let btn = null;
    try {
      const el = step.getElement && step.getElement();
      const btns = el ? el.querySelectorAll('.shepherd-footer .shepherd-button') : null;
      if (btns && btns.length) btn = btns[btns.length - 1];
    } catch (err) {}
    if (btn) { btn.click(); return; }
    // Nessun pulsante (passo senza piede): si avanza comunque.
    try { Shepherd.activeTour.next(); } catch (err) {}
  });
})();

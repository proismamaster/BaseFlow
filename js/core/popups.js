
// ============================================================================
// Modale STILIZZATA (conferma / avviso), coerente col tema (Ismail 2026-07-08).
// Sostituisce confirm()/alert() del browser nelle operazioni dell'editor (es. la
// cancellazione di un blocco con nodi interni). Backdrop e box propri, z-index alto
// (sopra qualunque popup e sopra il terminale mobile).
// ============================================================================
// Icone SVG coerenti per la modale (Ismail 2026-07-09d): triangolo di avviso (danger),
// cerchio-info (avviso), punto interrogativo (conferma). Sostituiscono i vecchi caratteri
// testuali ('!'/'?'/'i') che risultavano poco curati e incoerenti fra loro.
// R14-B.3 (Ismail 2026-07-13): nome file lungo che sborda nei dialog (es. showUnsavedDialog
// con un nome di 100+ caratteri). Troncamento "…" riusabile ovunque un {file}/nome entri in
// un testo di dialog -- vedi showUnsavedDialog (messaggio) e saveFileAs (sottotitolo).
function truncateName(name, maxLen) {
  maxLen = maxLen || 40;
  if (typeof name !== 'string' || name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '…';
}
if (typeof window !== 'undefined') window.truncateName = truncateName;

function _bfIconSvg(kind) {
  var head = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">';
  if (kind === 'danger') return head + '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  if (kind === 'ask')    return head + '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  return head + '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
}
function _bfEnsureModal() {
  let m = document.getElementById('bf-modal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'bf-modal';
  m.className = 'bf-modal';
  m.hidden = true;
  m.innerHTML =
    '<div class="bf-modal-box" role="dialog" aria-modal="true">' +
      // R12-B (Ismail 2026-07-11): X di chiusura -- creata qui (nodo condiviso, riusato da
      // TUTTE le bf-modal) ma hidden di default: solo showUnsavedDialog la mostra, le altre
      // due funzioni la nascondono esplicitamente a ogni apertura (stesso nodo persistente,
      // stato da azzerare sempre -- vedi commento in showStyledConfirm/showStyledAlert).
      // Stesso pattern .x-close gia' usato ovunque nell'app: resta fissa in alto a DESTRA
      // anche in RTL (mai specchiata, verificato in WP-D6 per tutti gli altri popup).
      '<button type="button" class="x-close" id="bf-modal-xclose" hidden data-i18n-title="close" title="Chiudi" aria-label="Chiudi">&times;</button>' +
      '<div class="bf-modal-icon" id="bf-modal-icon"></div>' +
      '<div class="bf-modal-title" id="bf-modal-title"></div>' +
      '<div class="bf-modal-msg" id="bf-modal-msg"></div>' +
      '<div class="bf-modal-actions" id="bf-modal-actions"></div>' +
    '</div>';
  document.body.appendChild(m);
  m.addEventListener('mousedown', function (e) { if (e.target === m) _bfCloseModal(); });
  return m;
}
function _bfCloseModal() {
  const m = document.getElementById('bf-modal'); if (m) m.hidden = true;
  if (document.body && document.body.classList) document.body.classList.remove('no-scroll');
  _bfPopOverlay('bf-modal');
}
// R12-B: cosa deve fare il tasto Esc mentre il bf-modal e' aperto. Di default niente di
// speciale (le bf-modal "semplici" chiudono silenziose, stessa identica semantica gia'
// esistente del click sul backdrop qui sopra -- nessun comportamento NUOVO per loro).
// showUnsavedDialog imposta questa variabile alla stessa callback del pulsante Annulla,
// cosi' X/Esc/pulsante ghost fanno ESATTAMENTE la stessa cosa. Azzerata da showStyledConfirm/
// showStyledAlert a ogni apertura (nodo #bf-modal condiviso, stato da resettare sempre).
var _bfModalEscHandler = null;
// R13-F (Ismail 2026-07-12): registro CONDIVISO degli overlay aperti, in ordine di apertura --
// prima Esc chiudeva TUTTI i popup in un colpo solo (init.js), rompendo lo scenario "apro
// Impostazioni, sopra apro l'errore runtime: Esc deve chiudere SOLO l'errore". Ogni overlay
// coperto (bf-modal, edit-node-popup, for-popup, draw-popup, settings-popup, export-popup,
// save-popup, block-help-popup, popup-window/palette) si registra qui alla propria apertura/
// chiusura con _bfPushOverlay/_bfPopOverlay; il listener Escape UNICO (init.js) chiude solo la
// cima dello stack, mai piu' "tutto insieme". La vecchia listener bf-modal-only qui sotto e'
// stata rimossa: bf-modal ora passa dallo stesso registro (vedi showStyledConfirm/Alert/
// showUnsavedDialog e _bfCloseOverlayById sotto).
var _bfOverlayStack = [];
function _bfPushOverlay(id) {
  const i = _bfOverlayStack.indexOf(id);
  if (i !== -1) _bfOverlayStack.splice(i, 1); // evita doppioni se riaperto senza passare dalla chiusura
  _bfOverlayStack.push(id);
}
function _bfPopOverlay(id) {
  const i = _bfOverlayStack.indexOf(id);
  if (i !== -1) _bfOverlayStack.splice(i, 1);
}
// Chiude l'overlay `id` riusando la SUA funzione di chiusura gia' testata (mai un semplice
// classList.remove qui: ognuna ha side-effect propri, es. gestione condivisa di #overlay con
// block-help in closeBlockHelp/closeSettingsPopup). Chiamata SOLO con la cima dello stack.
function _bfCloseOverlayById(id) {
  if (id === 'bf-modal') { if (typeof _bfModalEscHandler === 'function') _bfModalEscHandler(); else _bfCloseModal(); return; }
  if (id === 'export-popup' && typeof closeExportPopup === 'function') { closeExportPopup(); return; }
  if (id === 'block-help-popup' && typeof closeBlockHelp === 'function') { closeBlockHelp(); return; }
  if (id === 'popup-window' && typeof chiudiPopup === 'function') { chiudiPopup(); return; }
  if (id === 'edit-node-popup' && typeof chiudiEditPopup === 'function') { chiudiEditPopup(); return; }
  if (id === 'save-popup' && typeof closeSavePopup === 'function') { closeSavePopup(); return; }
  if (id === 'for-popup' && typeof closeForPopup === 'function') { closeForPopup(); return; }
  if (id === 'settings-popup' && typeof closeSettingsPopup === 'function') { closeSettingsPopup(); return; }
  if (id === 'draw-popup' && typeof closeTurtleDialog === 'function') { closeTurtleDialog(); return; }
  // P (round 15, Ismail): editor "crea tema" -- ora Esc lo chiude come gli altri popup.
  if (id === 'theme-editor' && typeof cancelThemeEditor === 'function') { cancelThemeEditor(); return; }
  // R14-D (Ismail 2026-07-13): manuale in-app (overlay + iframe verso manual.html).
  if (id === 'manual-overlay' && typeof closeManualOverlay === 'function') { closeManualOverlay(); return; }
  // R13-L (Ismail 2026-07-12): popover valori lunghi (variables.js) -- registrato qui per
  // coerenza col registro condiviso, anche se il vero tasto Esc sulla sua textarea passa da
  // un listener LOCALE dedicato (il listener globale di init.js ignora input/textarea/select).
  if (id === 'var-value-popover' && typeof closeVarValuePopover === 'function') { closeVarValuePopover(false); return; }
  // Difesa: id non mappato finito nello stack per errore -- lo rimuove comunque cosi' non
  // blocca per sempre la chiusura degli overlay sotto di lui.
  _bfPopOverlay(id);
  const el = (typeof document !== 'undefined') ? document.getElementById(id) : null;
  if (el && el.classList) el.classList.remove('active');
}
function showStyledConfirm(message, onOk, opts) {
  opts = opts || {};
  const m = _bfEnsureModal();
  const msg = m.querySelector('#bf-modal-msg'); if (msg) msg.textContent = message;
  // R12-E/E4 (Ismail 2026-07-11): .bf-modal-title era SEMPRE rossa via CSS (bug trovato
  // nell'audit: pensata solo per showRuntimeError, ma il nodo e' condiviso -- vedi sotto in
  // showUnsavedDialog). Ora il rosso e' condizionato alla classe .danger, azzerata qui a ogni
  // apertura come il resto dello stato del nodo condiviso.
  const ttl = m.querySelector('#bf-modal-title'); if (ttl) { ttl.textContent = opts.title || ''; ttl.style.display = opts.title ? '' : 'none'; ttl.classList.toggle('danger', !!opts.danger); }
  const ico = m.querySelector('#bf-modal-icon');
  if (ico) { ico.innerHTML = _bfIconSvg(opts.danger ? 'danger' : 'ask'); ico.className = 'bf-modal-icon' + (opts.danger ? ' danger' : ''); }
  const acts = m.querySelector('#bf-modal-actions'); acts.className = 'bf-modal-actions'; acts.innerHTML = '';
  const cancelLabel = (typeof i18nText === 'function' && i18nText('cancel')) || 'Cancel';
  const okLabel = opts.okLabel || (typeof i18nText === 'function' && i18nText('ok')) || 'OK';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bf-modal-btn bf-modal-cancel'; cancelBtn.textContent = cancelLabel;
  const doCancel = function () { _bfCloseModal(); if (typeof opts.onCancel === 'function') opts.onCancel(); };
  cancelBtn.onclick = doCancel;
  const okBtn = document.createElement('button');
  okBtn.className = 'bf-modal-btn ' + (opts.danger ? 'bf-modal-danger' : 'bf-modal-ok'); okBtn.textContent = okLabel;
  okBtn.onclick = function () { _bfCloseModal(); if (typeof onOk === 'function') onOk(); };
  acts.appendChild(cancelBtn); acts.appendChild(okBtn);
  // R13-F (Ismail 2026-07-12, decisione approvata): la X e' utile ovunque -- ora VISIBILE e
  // FUNZIONANTE su OGNI bf-modal (prima solo showUnsavedDialog la mostrava, qui restava
  // sempre nascosta con handler nullo: su showStyledAlert e' esattamente il bug "la X del
  // popup di errore runtime non funziona", perche' showRuntimeError chiama proprio questa
  // funzione). Su un confirm la X equivale ad Annulla (stessa callback doCancel, un solo
  // punto di verita', come gia' per showUnsavedDialog).
  _bfModalEscHandler = doCancel;
  const xClose = m.querySelector('#bf-modal-xclose'); if (xClose) { xClose.hidden = false; xClose.onclick = doCancel; }
  m.hidden = false;
  _bfPushOverlay('bf-modal');
  if (document.body && document.body.classList) document.body.classList.add('no-scroll');
  setTimeout(function () { try { okBtn.focus(); } catch (e) {} }, 0);
}
function showStyledAlert(message, opts) {
  opts = opts || {};
  const m = _bfEnsureModal();
  const msg = m.querySelector('#bf-modal-msg'); if (msg) msg.textContent = message;
  // R12-E/E4: stesso reset di showStyledConfirm sopra.
  const ttl = m.querySelector('#bf-modal-title'); if (ttl) { ttl.textContent = opts.title || ''; ttl.style.display = opts.title ? '' : 'none'; ttl.classList.toggle('danger', !!opts.danger); }
  const ico = m.querySelector('#bf-modal-icon');
  if (ico) { ico.innerHTML = _bfIconSvg(opts.danger ? 'danger' : 'info'); ico.className = 'bf-modal-icon' + (opts.danger ? ' danger' : ''); }
  const acts = m.querySelector('#bf-modal-actions'); acts.className = 'bf-modal-actions'; acts.innerHTML = '';
  const okBtn = document.createElement('button');
  okBtn.className = 'bf-modal-btn bf-modal-ok';
  okBtn.textContent = (typeof i18nText === 'function' && i18nText('ok')) || 'OK';
  const doOk = function () { _bfCloseModal(); if (typeof opts.onOk === 'function') opts.onOk(); };
  okBtn.onclick = doOk;
  acts.appendChild(okBtn);
  // R13-F (Ismail 2026-07-12): X visibile e funzionante -- vedi commento gemello in
  // showStyledConfirm. Qui e' il fix diretto di "la X del popup di errore runtime non
  // funziona" (showRuntimeError -> showStyledAlert): equivale a OK (unico pulsante).
  _bfModalEscHandler = doOk;
  const xClose = m.querySelector('#bf-modal-xclose'); if (xClose) { xClose.hidden = false; xClose.onclick = doOk; }
  m.hidden = false;
  _bfPushOverlay('bf-modal');
  if (document.body && document.body.classList) document.body.classList.add('no-scroll');
  setTimeout(function () { try { okBtn.focus(); } catch (e) {} }, 0);
}

// Rilievo 34 + R12-B (redesign Ismail 2026-07-11): dialog UNIFICATO "modifiche non salvate",
// sulla STESSA modale stilizzata di showStyledConfirm. Usato da Nuovo, Ricarica (Ctrl+R) e
// Apri, cosi' i tre avvisi hanno aspetto moderno e identico. onSave/onDiscard/onCancel sono
// callback (FIRMA INVARIATA). Gerarchia verticale (pattern VS Code/macOS): Salva primario a
// tutta larghezza (azione sicura, focus di default, Enter = Salva), sotto Non salvare (rosso,
// subordinato). P2.1 (round 15-B S1, Ismail 2026-07-15): tolto il pulsante "Annulla" -- la X
// in alto a destra (ed Esc) fanno gia' da annulla con la STESSA identica callback (doCancel),
// un pulsante ridondante in meno = pattern piu' pulito e uniforme con gli altri popup di
// salvataggio (2 soli pulsanti, niente "Annulla" testuale in nessuno).
function showUnsavedDialog(opts) {
  opts = opts || {};
  const t = function (k, fb) { return (typeof i18nText === 'function' && i18nText(k)) || fb; };
  const m = _bfEnsureModal();
  // R12-B: messaggio CONTESTUALE che nomina il file quando noto (currentFileName, state.js);
  // senza nome noto (flow nuovo, mai salvato) resta il messaggio generico invariato.
  const msg = m.querySelector('#bf-modal-msg');
  if (msg) {
    if (opts.message) {
      msg.textContent = opts.message;
    } else if (typeof currentFileName !== 'undefined' && currentFileName) {
      // R14-B.3: nome troncato a 40 caratteri -- un nome lunghissimo non deve far sborda il
      // dialog (in aggiunta a .bf-modal-msg { overflow-wrap: anywhere } in style.css, che
      // resta comunque come rete di sicurezza per l'eventualita' non troncata).
      const shownName = truncateName(currentFileName, 40);
      msg.textContent = (typeof i18nFormat === 'function' && i18nFormat('unsaved_msg_named', { file: shownName }))
        || ('Vuoi salvare le modifiche a ' + shownName + ' prima di continuare?');
    } else {
      msg.textContent = t('unsaved', 'Ci sono modifiche non salvate.');
    }
  }
  // R12-E/E4: azzera .danger sul titolo condiviso -- questo dialog e' un "ask", mai un
  // pericolo, ma il nodo #bf-modal-title e' lo STESSO riusato da showStyledConfirm/Alert
  // (che potrebbero averlo lasciato .danger da un'apertura precedente).
  const ttl = m.querySelector('#bf-modal-title'); if (ttl) { ttl.textContent = t('unsaved_title', 'Modifiche non salvate'); ttl.style.display = ''; ttl.classList.remove('danger'); }
  const ico = m.querySelector('#bf-modal-icon');
  if (ico) { ico.innerHTML = _bfIconSvg('ask'); ico.className = 'bf-modal-icon'; }

  // Annulla: STESSA callback per X, Esc e pulsante ghost (un solo punto di verita').
  const doCancel = function () { _bfCloseModal(); if (typeof opts.onCancel === 'function') opts.onCancel(); };
  _bfModalEscHandler = doCancel;
  const xClose = m.querySelector('#bf-modal-xclose');
  if (xClose) { xClose.hidden = false; xClose.onclick = doCancel; }

  const acts = m.querySelector('#bf-modal-actions'); acts.className = 'bf-modal-actions-stack'; acts.innerHTML = '';

  // Primario, a tutta larghezza: Salva (icona floppy inline, stesso path di #save-file-btn).
  const saveBtn = document.createElement('button');
  saveBtn.className = 'bf-modal-btn bf-modal-ok bf-modal-btn-primary';
  saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span>' + t('save', 'Salva') + '</span>';
  saveBtn.onclick = function () { _bfCloseModal(); if (typeof opts.onSave === 'function') opts.onSave(); };

  // Riga secondaria "ghost", subordinata: SOLO Non salvare (danger) -- P2.1: niente piu'
  // pulsante "Annulla" qui, X/Esc coprono gia' esattamente la stessa azione (doCancel).
  const ghostRow = document.createElement('div'); ghostRow.className = 'bf-modal-ghost-row';
  const discardBtn = document.createElement('button');
  discardBtn.className = 'bf-modal-btn bf-modal-btn-ghost-danger'; discardBtn.textContent = t('dont_save', 'Non salvare');
  discardBtn.onclick = function () { _bfCloseModal(); if (typeof opts.onDiscard === 'function') opts.onDiscard(); };
  ghostRow.appendChild(discardBtn);

  acts.appendChild(saveBtn); acts.appendChild(ghostRow);
  m.hidden = false;
  _bfPushOverlay('bf-modal'); // R13-F: stesso registro condiviso di showStyledConfirm/Alert
  if (document.body && document.body.classList) document.body.classList.add('no-scroll');
  setTimeout(function () { try { saveBtn.focus(); } catch (e) {} }, 0);
}
if (typeof window !== 'undefined') window.showUnsavedDialog = showUnsavedDialog;

// Popup di ERRORE A RUNTIME (stile Flowgorithm): titolo + spiegazione esatta del problema.
function showRuntimeError(message, idx) {
  const title = (typeof i18nText === 'function' && i18nText('runtime_error')) || 'Errore di esecuzione';
  const full = (idx !== null && idx !== undefined && !isNaN(idx)) ? (title + ' \u2014 ' + ((typeof i18nText === 'function' && i18nText('rt_block')) || 'blocco') + ' ' + idx) : title;
  showStyledAlert(String(message), { danger: true, title: full });
}

// ---- Guida per singolo BLOCCO (Ismail 2026-07-09d) ----
// Ogni finestra di modifica (edit-node/for/turtle) ha un pulsante "?" che apre questo popup:
// spiega COSA fa il blocco, COME funziona e il significato delle impostazioni. Anche i blocchi
// SENZA impostazioni (Home/Clear) aprono questo popup direttamente (solo ?, X e descrizione).
// Le descrizioni riusano le chiavi tut_edit_* gia' localizzate in 4 lingue.
var BLOCK_HELP_KEY = {
  input: 'tut_edit_input', print: 'tut_edit_print', output: 'tut_edit_print', read: 'tut_edit_input',
  assign: 'tut_edit_assign', if: 'tut_edit_if', while: 'tut_edit_while', for: 'tut_edit_for',
  do: 'tut_edit_do', comment: 'tut_edit_comment', pause: 'tut_edit_pause',
  forward: 'tut_edit_turtle', turn: 'tut_edit_turtle', home: 'tut_edit_turtle', pen: 'tut_edit_turtle', gclear: 'tut_edit_turtle',
  start: 'tut_edit_generic', end: 'tut_edit_generic'
};
function openBlockHelp(type) {
  // Rilievo 31: usa il tutorial Shepherd (coerente con gli altri); fallback al popup custom.
  if (typeof startBlockTutorial === 'function' && startBlockTutorial(type)) return;
  const pop = document.getElementById('block-help-popup'); if (!pop) return;
  const title = document.getElementById('block-help-title');
  const desc = document.getElementById('block-help-desc');
  const label = (typeof nodeDisplayLabel === 'function') ? nodeDisplayLabel(type) : (type || '');
  if (title) title.textContent = label || '';
  const key = BLOCK_HELP_KEY[type] || 'tut_edit_generic';
  const txt = (typeof i18nText === 'function' && i18nText(key)) || '';
  if (desc) desc.textContent = txt;
  pop.classList.add('active');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.add('active');
  _bfPushOverlay('block-help-popup'); // R13-F: registro condiviso Esc
  // P2.4 (round 15-B S1): apertura = sempre in primo piano (ux.js) -- il "?" apre SOPRA
  // l'host (edit-node/for/turtle/settings) gia' aperto, coerente col raise-on-click.
  if (typeof bfBringToFrontPopup === 'function') bfBringToFrontPopup(pop);
}
function closeBlockHelp() {
  const pop = document.getElementById('block-help-popup'); if (pop) pop.classList.remove('active');
  _bfPopOverlay('block-help-popup');
  // Mantieni l'overlay se sotto c'e' ancora un altro popup aperto (edit/for/turtle/settings).
  const anyOpen = ['edit-node-popup','for-popup','draw-popup','settings-popup'].some(function (id) {
    const e = document.getElementById(id); return e && e.classList && e.classList.contains('active');
  });
  if (!anyOpen) { const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active'); }
}

// R14-D (Ismail 2026-07-13): manuale IN-APP -- apre #manual-overlay con un iframe same-origin
// verso manual.html (prima: window.open in una nuova scheda, #manual-btn in index.html). Usa
// un overlay/registro TUTTO SUO (#manual-overlay, non il generico #overlay condiviso dagli
// altri popup) perche' va sopra le "finestre" (console/palette/disegno) invece che sotto
// (vedi z-index dedicato in style.css) -- coerente comunque con lo STESSO stack Esc condiviso
// R13-F (_bfPushOverlay/_bfPopOverlay/_bfCloseOverlayById sopra).
// P10.1 (round 15-B S10, Ismail 2026-07-15): da qui in poi #manual-overlay e' una FINESTRA
// vera (ridimensionabile/spostabile, raise-on-click), non piu' un overlay a schermo intero
// con sfondo scurito -- tolto quindi il "click fuori chiude" (i popup a finestra, es.
// console/palette, non lo fanno: si chiude solo con X/Esc). bfBringToFront la porta subito
// sopra le altre finestre gia' aperte all'apertura, non solo al click successivo (stesso
// pattern di showTurtlePanel() in draw.js).
function openManualOverlay() {
  const ov = document.getElementById('manual-overlay');
  const ifr = document.getElementById('manual-iframe');
  // Carica l'iframe SOLO alla prima apertura: dopo resta in memoria (nessun ricaricamento),
  // cosi' riaprendo il manuale si ritrova lo stesso capitolo/scroll di prima nella sessione.
  if (ifr && !ifr.getAttribute('src')) ifr.setAttribute('src', 'manual.html');
  // NB: flag DIVERSO da _bfWired -- quello e' gia' usato da wireWindows() (ux.js) sullo
  // stesso elemento per il raise-on-click (WINDOW_IDS), che gira al window.onload PRIMA che
  // l'utente apra mai il manuale: riusare _bfWired qui l'avrebbe trovato gia' true al primo
  // openManualOverlay() e il wiring sotto (drag/resize/rotella) non sarebbe MAI partito.
  if (ov && !ov._bfManualWired) {
    ov._bfManualWired = true;
    _manualSetupDragResize(ov);
    // P10.2: rotella confinata al manuale mentre e' aperto -- stopPropagation impedisce a un
    // eventuale listener 'wheel' sul documento/canvas (nessuno oggi, ma protezione a prova di
    // futuro) di far scorrere/zoomare il canvas sotto mentre si scrolla dentro la finestra del
    // manuale. overscroll-behavior:contain in CSS copre anche lo scroll-chaining nativo.
    ov.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
  }
  if (ov) ov.classList.add('active');
  if (typeof bfBringToFront === 'function') bfBringToFront(ov);
  _bfPushOverlay('manual-overlay'); // R13-F: registro condiviso Esc
}
if (typeof window !== 'undefined') window.openManualOverlay = openManualOverlay;

// P10.1 (round 15-B S10, Ismail 2026-07-15): drag (dalla barra #manual-overlay-bar) + resize
// a 8 maniglie (.tg-rz, stessa classe gia' condivisa da pannello tartaruga e terminale
// mobile) per la finestra del manuale. Stesso schema di _tgSetupDragResize (draw.js) e del
// resize/drag del terminale mobile (execute.js) ma scritto qui, non condiviso/richiamato
// direttamente: entrambi i template sono legati a un ID di header o a comportamenti (zoom
// tela, stato "docked") specifici del loro pannello, non riusabili as-is su #manual-overlay.
function _manualSetupDragResize(ov) {
  const bar = document.getElementById('manual-overlay-bar');
  const MIN_W = 420, MIN_H = 320, MAX_W = 1600, MAX_H = 1200;
  let dragging = false, dx = 0, dy = 0, ox = 0, oy = 0;
  if (bar) bar.addEventListener('mousedown', function (e) {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const r = ov.getBoundingClientRect();
    dragging = true; ox = r.left; oy = r.top; dx = e.clientX; dy = e.clientY;
    ov.style.left = ox + 'px'; ov.style.top = oy + 'px'; ov.style.transform = 'none'; ov.style.margin = '0';
    if (document.body && document.body.style) document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  let rz = false, rdir = '', rx = 0, ry = 0, rw = 0, rh = 0, rl = 0, rt = 0;
  const handles = ov.querySelectorAll('.tg-rz');
  for (let i = 0; i < handles.length; i++) {
    handles[i].addEventListener('mousedown', function (e) {
      const r = ov.getBoundingClientRect();
      rz = true; rdir = this.getAttribute('data-dir') || 'se';
      rx = e.clientX; ry = e.clientY; rw = r.width; rh = r.height; rl = r.left; rt = r.top;
      ov.style.left = rl + 'px'; ov.style.top = rt + 'px'; ov.style.transform = 'none'; ov.style.margin = '0';
      if (document.body && document.body.style) document.body.style.userSelect = 'none';
      e.preventDefault(); e.stopPropagation();
    });
  }
  window.addEventListener('mousemove', function (e) {
    if (dragging) {
      let nx = ox + (e.clientX - dx), ny = oy + (e.clientY - dy);
      ov.style.left = nx + 'px'; ov.style.top = ny + 'px';
    } else if (rz) {
      const ddx = e.clientX - rx, ddy = e.clientY - ry;
      let nw = rw, nh = rh, nl = rl, nt = rt;
      if (rdir.indexOf('e') !== -1) nw = rw + ddx;
      if (rdir.indexOf('w') !== -1) { nw = rw - ddx; nl = rl + ddx; }
      if (rdir.indexOf('s') !== -1) nh = rh + ddy;
      if (rdir.indexOf('n') !== -1) { nh = rh - ddy; nt = rt + ddy; }
      nw = Math.max(MIN_W, Math.min(MAX_W, nw)); nh = Math.max(MIN_H, Math.min(MAX_H, nh));
      if (rdir.indexOf('w') !== -1) nl = rl + (rw - nw);
      if (rdir.indexOf('n') !== -1) nt = rt + (rh - nh);
      ov.style.width = nw + 'px'; ov.style.height = nh + 'px';
      ov.style.left = nl + 'px'; ov.style.top = nt + 'px';
    }
  });
  window.addEventListener('mouseup', function () {
    if (dragging || rz) { dragging = false; rz = false; if (document.body && document.body.style) document.body.style.userSelect = ''; }
  });
}

function closeManualOverlay() {
  const ov = document.getElementById('manual-overlay');
  if (ov) ov.classList.remove('active');
  _bfPopOverlay('manual-overlay');
}
if (typeof window !== 'undefined') window.closeManualOverlay = closeManualOverlay;

// Nasconde la finestra popup utilizzata per selezionare il tipo di nodo da inserire.
function chiudiPopup() {
  document.getElementById("popup-window").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
  _bfPopOverlay('popup-window'); // R13-F: registro condiviso Esc
}

  // A1+A4 (round 11): imposta i campi di #edit-node-popup in base al TIPO di nodo. Il popup e'
  // condiviso da TUTTI i tipi, quindi lo stato va azzerato ad OGNI apertura (stessa lezione del
  // terminale round 10): assign mostra 2 righe (Variabile/Valore) al posto dell'input unico,
  // print mostra anche la checkbox "a capo dopo la stampa" (newline, assente = true). Riusato
  // da clickNodo() e openNodeEditor() in interaction.js.
  function _bfSetupEditFields(node) {
    const input = document.getElementById('edit-node-input');
    const assignFields = document.getElementById('assign-fields');
    const varInput = document.getElementById('assign-var-input');
    const valInput = document.getElementById('assign-val-input');
    const newlineRow = document.getElementById('out-newline-row');
    const newlineCheck = document.getElementById('out-newline-check');
    const isAssign = node.type === 'assign';
    const isPrint = node.type === 'print';
    if (assignFields) assignFields.hidden = !isAssign;
    if (input) input.hidden = isAssign;
    if (newlineRow) newlineRow.hidden = !isPrint;
    if (isAssign) {
      // FIX #37-style: parsing TOLLERANTE, non perde MAI l'input utente. Spezza sul PRIMO '='.
      const info = String(node.info || '');
      const m = info.split(/=(.+)/);
      if (varInput) varInput.value = (m[0] || '').trim();
      if (valInput) valInput.value = (m[1] || '').trim();
    } else if (input) {
      input.value = node.info || '';
      // FIX B1 (review Fable, 2026-07-05, piano Do-While/For): hint di sintassi per il For.
      // WP-D1 esteso: prefisso "es./e.g." tradotto -- la sintassi i=0;i<10;i++ resta invariata
      // (codice, non contenuto linguistico).
      input.placeholder = (node.type === 'for') ? ((typeof i18nText === 'function' && i18nText('for_edit_ph')) || 'es. i=0;i<10;i++') : '';
    }
    if (isPrint && newlineCheck) newlineCheck.checked = (node.newline !== false);
  }

  // Salva le informazioni inserite nel popup di modifica del nodo
  function salvaInfo() {
    if (nodoSelected !== -1 && flow.nodes[nodoSelected]) { // Assicura che un nodo sia selezionato
        pushHistory(); // snapshot per Undo (prima della modifica info)
        const node = flow.nodes[nodoSelected];
        const assignFields = document.getElementById('assign-fields');
        if (node.type === 'assign' && assignFields && !assignFields.hidden) {
          // A1 (round 11): componi "Variabile = Valore" dai due campi separati (formato atteso
          // dall'executor e dalle traduzioni, che spezzano su '=': vedi touchedVarName in execute.js).
          const v = (document.getElementById('assign-var-input').value || '').trim();
          const val = (document.getElementById('assign-val-input').value || '').trim();
          node.info = v + ' = ' + val;
        } else {
          node.info = document.getElementById("edit-node-input").value;
        }
        // A4 (round 11): checkbox "a capo dopo la stampa", scritta SOLO per i print.
        if (node.type === 'print') {
          const nc = document.getElementById('out-newline-check');
          node.newline = nc ? !!nc.checked : true;
        }
    }
    chiudiEditPopup(); // Chiude il popup di modifica
    // FIX (Ismail 2026-07-08): dopo aver modificato il testo di un nodo bisogna RICALCOLARE il
    // layout (calcoloY), non solo ridisegnare: se il testo cresce, il blocco diventa piu' alto
    // e i nodi collegati vanno riposizionati. Prima si chiamava solo draw() -> il blocco
    // cresceva restando nella vecchia posizione e si sovrapponeva a Start/End finche' non si
    // inseriva un altro nodo (che richiamava calcoloY).
    if (typeof calcoloY === 'function' && typeof nodi !== 'undefined') calcoloY(nodi);
    draw(nodi); // Ridisegna il flowchart
  }



  // Nasconde il popup utilizzato per modificare le informazioni di un nodo esistente.
  function chiudiEditPopup() {
    document.getElementById("edit-node-popup").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
    _bfPopOverlay('edit-node-popup'); // R13-F: registro condiviso Esc
  }

   // B3 (round 11): "Salva" e' ora smart -- riusa nome/handle del file gia' aperto/salvato in
   // questa sessione (saveToCurrentFile, js/saveOpen.js) e chiede il nome SOLO al primo
   // salvataggio di un flow nuovo (in quel caso saveToCurrentFile apre il popup da sola). Per
   // forzare la richiesta del nome usa "Salva con nome" (saveFileAs, pulsante dedicato).
   function saveFile(){
    if (typeof saveToCurrentFile === 'function') { saveToCurrentFile(); return; }
    if (typeof saveFileAs === 'function') saveFileAs(); // fallback estremo se saveOpen.js non fosse caricato
  }

  // Apre il popup "Salva con nome": chiede SEMPRE il nome, precompilato con l'ultimo noto.
  function saveFileAs(){
    const inp = document.getElementById('filename-input');
    if (inp) {
      const base = (typeof currentFileName === 'string' && currentFileName) ? currentFileName.replace(/\.json$/i, '') : '';
      inp.value = base;
    }
    // R13-D (Ismail 2026-07-12): precompila l'autore da currentAuthor (progetto gia' aperto/
    // salvato con un autore) oppure, se non noto, dall'ultimo autore usato in QUESTO browser
    // (localStorage['baseflow-author']) -- default per i progetti futuri, non solo per questo.
    const authInp = document.getElementById('save-author-input');
    if (authInp) {
      let defAuthor = (typeof currentAuthor === 'string' && currentAuthor) ? currentAuthor : '';
      if (!defAuthor) { try { defAuthor = (typeof localStorage !== 'undefined' && localStorage.getItem('baseflow-author')) || ''; } catch (e) {} }
      authInp.value = defAuthor;
    }
    // R13-D punto 4: sottotitolo col progetto ATTUALE (se noto) -- chiarisce che "Salva con nome"
    // su un progetto gia' aperto puo' anche solo rinominare/cambiare autore dello stesso file.
    const curEl = document.getElementById('save-popup-current');
    if (curEl) {
      if (typeof currentFileName === 'string' && currentFileName) {
        const tmpl = (typeof i18nText === 'function' && i18nText('save_current_project')) || 'Currently: {name}';
        curEl.textContent = tmpl.replace('{name}', truncateName(currentFileName, 40)); // R14-B.3
        curEl.hidden = false;
      } else {
        curEl.hidden = true;
      }
    }
    const _savePop = document.getElementById("save-popup");
    _savePop.classList.add("active"); // Mostra il popup di salvataggio
    document.getElementById('overlay').classList.add('active'); // Attiva l'overlay
    _bfPushOverlay('save-popup'); // R13-F: registro condiviso Esc
    // P2.4 (round 15-B S1): apertura = sempre in primo piano (ux.js), coerente col raise-on-click.
    if (typeof bfBringToFrontPopup === 'function') bfBringToFrontPopup(_savePop);
  }

  // Chiude il popup di salvataggio.
  function closeSavePopup(){
   document.getElementById("save-popup").classList.remove('active');
   document.getElementById("overlay").classList.remove('active');
   _bfPopOverlay('save-popup');
  }

  // R13-D (Ismail 2026-07-12): confermato dal bottone Salva del save-popup -- legge nome E
  // autore (prima solo il nome, l'autore non esisteva), aggiorna currentAuthor/localStorage
  // (ricordato come default per i PROSSIMI progetti nuovi, non solo questo), poi chiama save()
  // con l'oggetto flow ESTESO col campo author (senza mutare l'oggetto flow live -- vedi
  // saveOpen.js per lo stesso pattern nel "Salva" silenzioso).
  function confirmSaveFromPopup() {
    const nameInp = document.getElementById('filename-input');
    const authInp = document.getElementById('save-author-input');
    const name = nameInp ? nameInp.value : '';
    const author = (authInp && authInp.value.trim()) ? authInp.value.trim() : null;
    currentAuthor = author;
    try { if (author && typeof localStorage !== 'undefined') localStorage.setItem('baseflow-author', author); } catch (e) {}
    if (typeof save === 'function') save(Object.assign({}, flow, { author: currentAuthor }), name);
  }
  if (typeof window !== 'undefined') window.confirmSaveFromPopup = confirmSaveFromPopup;


// ---- Dialog dedicato del ciclo FOR (Ismail 2026-07-07) ----
// Invece di scrivere a mano "i=0;i<10;i++", il For ha un dialog con Variabile / Valore
// iniziale / Valore finale / Direzione (Incrementa|Decrementa) / Passo, e ne costruisce
// l'info nel formato a 3 parti che l'executor gia' esegue:
//   "<var> = <init>; <var> <=|>= <final>; <var> +=|-= <step>"
let forNodeIndex = -1;

function parseForInfo(info) {
  const def = { varName: 'i', init: '0', final: '10', step: '1', dir: 'inc' };
  if (!info) return def;
  const parts = String(info).split(';');
  // FIX #37 (Ismail 2026-07-08): parsing TOLLERANTE. Anche se il contenuto e' sbagliato (es.
  // nome con spazi, parti mancanti) NON si torna ai default 'i': si preserva il RAW inserito
  // dall'utente cosi' riaprendo il dialog ritrova quello che aveva scritto e puo' correggerlo.
  if (parts.length !== 3) {
    return { varName: String(info).trim(), init: '', final: '', step: '', dir: 'inc' };
  }
  const initP = parts[0].trim(), condP = parts[1].trim(), incrP = parts[2].trim();
  let varName = def.varName, init = def.init;
  const eq = initP.indexOf('=');
  if (eq >= 0) { varName = initP.slice(0, eq).trim() || def.varName; init = initP.slice(eq + 1).trim(); }
  else if (initP) { varName = initP; init = ''; }
  let dir = /(>=|>)/.test(condP) ? 'dec' : 'inc';
  let final = def.final;
  const mc = condP.match(/(?:<=|>=|<|>)\s*(.+)$/);
  if (mc) final = mc[1].trim(); else if (condP) final = condP;
  let step = '1';
  const ms = incrP.match(/(?:\+=|-=)\s*(.+)$/);
  if (ms) step = ms[1].trim();
  else if (/--\s*$/.test(incrP)) { step = '1'; dir = 'dec'; }
  else if (/\+\+\s*$/.test(incrP)) { step = '1'; }
  else if (incrP) step = incrP;
  return { varName, init, final, step, dir };
}

function openForDialog(i) {
  if (typeof flow === 'undefined' || !flow.nodes[i]) return;
  forNodeIndex = i;
  const d = parseForInfo(flow.nodes[i].info || '');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('for-var', d.varName); set('for-init', d.init); set('for-final', d.final); set('for-step', d.step);
  const radios = document.getElementsByName('for-dir');
  for (let r = 0; r < radios.length; r++) radios[r].checked = (radios[r].value === d.dir);
  const _fe = document.getElementById('for-error'); if (_fe) _fe.hidden = true;
  const _forPop = document.getElementById('for-popup');
  _forPop.classList.add('active');
  document.getElementById('overlay').classList.add('active');
  _bfPushOverlay('for-popup'); // R13-F: registro condiviso Esc
  // P2.4 (round 15-B S1): apertura = sempre in primo piano (ux.js), coerente col raise-on-click.
  if (typeof bfBringToFrontPopup === 'function') bfBringToFrontPopup(_forPop);
}

function closeForPopup() {
  const p = document.getElementById('for-popup'); if (p) p.classList.remove('active');
  const o = document.getElementById('overlay'); if (o) o.classList.remove('active');
  _bfPopOverlay('for-popup');
}

function _forErrEl(){ return document.getElementById('for-error'); }
function saveForNode() {
  if (forNodeIndex < 0 || typeof flow === 'undefined' || !flow.nodes[forNodeIndex]) { closeForPopup(); return; }
  const val = (id, dflt) => { const el = document.getElementById(id); return ((el && el.value) || dflt).toString().trim(); };
  const v = val('for-var', 'i');
  const init = val('for-init', '0');
  const final = val('for-final', '0');
  const step = val('for-step', '1');
  // FIX #36 (Ismail 2026-07-08): valida il NOME della variabile del For. Prima un nome con
  // spazio (o non-identificatore) veniva accettato ma parseForInfo poi non lo riconosceva e
  // il For "ripartiva da i" silenziosamente. Ora si BLOCCA il salvataggio e si segnala.
  // FIX #37 (Ismail 2026-07-08): NON si blocca piu' il salvataggio se il contenuto e' invalido.
  // Si salva comunque cio' che l'utente ha inserito (non si perde nulla) e il blocco viene
  // segnalato in ROSSO sul canvas (nodeHasError per il 'for'); cosi' l'utente vede l'errore
  // quando chiude e puo' correggerlo riaprendo il dialog, ritrovando il suo input.
  if (_forErrEl()) _forErrEl().hidden = true;
  let dir = 'inc';
  const radios = document.getElementsByName('for-dir');
  for (let r = 0; r < radios.length; r++) if (radios[r].checked) dir = radios[r].value;
  const cond = (dir === 'dec') ? (v + ' >= ' + final) : (v + ' <= ' + final);
  const incr = (dir === 'dec') ? (v + ' -= ' + step) : (v + ' += ' + step);
  if (typeof pushHistory === 'function') pushHistory();
  flow.nodes[forNodeIndex].info = v + ' = ' + init + '; ' + cond + '; ' + incr;
  if (typeof saved !== 'undefined') saved = false;
  closeForPopup();
  if (typeof calcoloY === 'function' && typeof nodi !== 'undefined') calcoloY(nodi);
  if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
}

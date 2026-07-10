
// ============================================================================
// Modale STILIZZATA (conferma / avviso), coerente col tema (Ismail 2026-07-08).
// Sostituisce confirm()/alert() del browser nelle operazioni dell'editor (es. la
// cancellazione di un blocco con nodi interni). Backdrop e box propri, z-index alto
// (sopra qualunque popup e sopra il terminale mobile).
// ============================================================================
// Icone SVG coerenti per la modale (Ismail 2026-07-09d): triangolo di avviso (danger),
// cerchio-info (avviso), punto interrogativo (conferma). Sostituiscono i vecchi caratteri
// testuali ('!'/'?'/'i') che risultavano poco curati e incoerenti fra loro.
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
}
function showStyledConfirm(message, onOk, opts) {
  opts = opts || {};
  const m = _bfEnsureModal();
  const msg = m.querySelector('#bf-modal-msg'); if (msg) msg.textContent = message;
  const ttl = m.querySelector('#bf-modal-title'); if (ttl) { ttl.textContent = opts.title || ''; ttl.style.display = opts.title ? '' : 'none'; }
  const ico = m.querySelector('#bf-modal-icon');
  if (ico) { ico.innerHTML = _bfIconSvg(opts.danger ? 'danger' : 'ask'); ico.className = 'bf-modal-icon' + (opts.danger ? ' danger' : ''); }
  const acts = m.querySelector('#bf-modal-actions'); acts.innerHTML = '';
  const cancelLabel = (typeof i18nText === 'function' && i18nText('cancel')) || 'Cancel';
  const okLabel = opts.okLabel || (typeof i18nText === 'function' && i18nText('ok')) || 'OK';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bf-modal-btn bf-modal-cancel'; cancelBtn.textContent = cancelLabel;
  cancelBtn.onclick = function () { _bfCloseModal(); if (typeof opts.onCancel === 'function') opts.onCancel(); };
  const okBtn = document.createElement('button');
  okBtn.className = 'bf-modal-btn ' + (opts.danger ? 'bf-modal-danger' : 'bf-modal-ok'); okBtn.textContent = okLabel;
  okBtn.onclick = function () { _bfCloseModal(); if (typeof onOk === 'function') onOk(); };
  acts.appendChild(cancelBtn); acts.appendChild(okBtn);
  m.hidden = false;
  if (document.body && document.body.classList) document.body.classList.add('no-scroll');
  setTimeout(function () { try { okBtn.focus(); } catch (e) {} }, 0);
}
function showStyledAlert(message, opts) {
  opts = opts || {};
  const m = _bfEnsureModal();
  const msg = m.querySelector('#bf-modal-msg'); if (msg) msg.textContent = message;
  const ttl = m.querySelector('#bf-modal-title'); if (ttl) { ttl.textContent = opts.title || ''; ttl.style.display = opts.title ? '' : 'none'; }
  const ico = m.querySelector('#bf-modal-icon');
  if (ico) { ico.innerHTML = _bfIconSvg(opts.danger ? 'danger' : 'info'); ico.className = 'bf-modal-icon' + (opts.danger ? ' danger' : ''); }
  const acts = m.querySelector('#bf-modal-actions'); acts.innerHTML = '';
  const okBtn = document.createElement('button');
  okBtn.className = 'bf-modal-btn bf-modal-ok';
  okBtn.textContent = (typeof i18nText === 'function' && i18nText('ok')) || 'OK';
  okBtn.onclick = function () { _bfCloseModal(); if (typeof opts.onOk === 'function') opts.onOk(); };
  acts.appendChild(okBtn);
  m.hidden = false;
  if (document.body && document.body.classList) document.body.classList.add('no-scroll');
  setTimeout(function () { try { okBtn.focus(); } catch (e) {} }, 0);
}

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
}
function closeBlockHelp() {
  const pop = document.getElementById('block-help-popup'); if (pop) pop.classList.remove('active');
  // Mantieni l'overlay se sotto c'e' ancora un altro popup aperto (edit/for/turtle/settings).
  const anyOpen = ['edit-node-popup','for-popup','draw-popup','settings-popup'].some(function (id) {
    const e = document.getElementById(id); return e && e.classList && e.classList.contains('active');
  });
  if (!anyOpen) { const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active'); }
}

// Nasconde la finestra popup utilizzata per selezionare il tipo di nodo da inserire.
function chiudiPopup() {
  document.getElementById("popup-window").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
}

  // Salva le informazioni inserite nel popup di modifica del nodo
  function salvaInfo() {
    if (nodoSelected !== -1 && flow.nodes[nodoSelected]) { // Assicura che un nodo sia selezionato
        pushHistory(); // snapshot per Undo (prima della modifica info)
        flow.nodes[nodoSelected].info = document.getElementById("edit-node-input").value; 
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
  }

   // Apre il popup per il salvataggio del file del flowchart.
   function saveFile(){
    document.getElementById("save-popup").classList.add("active"); // Mostra il popup di salvataggio
    document.getElementById('overlay').classList.add('active'); // Attiva l'overlay
  }

  // Chiude il popup di salvataggio.
  function closeSavePopup(){
   document.getElementById("save-popup").classList.remove('active');
   document.getElementById("overlay").classList.remove('active');
  }


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
  document.getElementById('for-popup').classList.add('active');
  document.getElementById('overlay').classList.add('active');
}

function closeForPopup() {
  const p = document.getElementById('for-popup'); if (p) p.classList.remove('active');
  const o = document.getElementById('overlay'); if (o) o.classList.remove('active');
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


  // Gestisce l'aggiunta o la modifica di una variabile nella tabella HTML delle variabili.
  // Viene attivata quando l'utente modifica i campi di input/select in una riga della tabella.
  function aggiungiVaribile(event) {
    let target = event.target; // Elemento che ha scatenato l'evento (input o select)
    while (target && target.tagName !== "TR") target = target.parentElement; 
    if (!target) return; // Esce se non trova la riga

    let isUltimaRiga = (target.rowIndex === tabVariabili.rows.length - 1);
    let val1 = target.cells[0].querySelector("input").value.trim(); 
    let tipo = target.cells[1].querySelector("select").value;    
    let val3 = (target.cells[2].querySelector("input.value-input") || target.cells[2].querySelector("input")).value.trim(); 
    // FIX (Ismail 2026-07-07): checkbox "Assign" per riga. Se NON selezionata, la variabile
    // si DICHIARA senza assegnare un valore (valore di default per tipo) e la riga si sblocca
    // per la successiva senza richiedere il campo valore.
    let assignChecked = true;
    { const _c = target.cells[2].querySelector('.assign-check'); if (_c) assignChecked = !!_c.checked; }

    // Rimuove eventuali messaggi di errore visualizzati precedentemente per questa riga
    let oldError = target.nextSibling; // Possibile riga di errore sottostante
    if (oldError && oldError.classList && oldError.classList.contains("error-message-row")) {
      oldError.remove();
    }

    // Se non è l'ultima riga e i campi nome e valore sono entrambi vuoti, interpreta come eliminazione della variabile.
    if (!isUltimaRiga && val1 === "" && (val3 === "" || !assignChecked)) {
      flow.variables.splice(target.rowIndex - 1, 1); // Rimuove la variabile dall'array logico (-1 perché l'indice della riga include l'header)
      tabVariabili.deleteRow(target.rowIndex); // Rimuove la riga dalla tabella HTML
      return;
    }

    // Nome sempre richiesto; il valore SOLO se "Assign" e' selezionata.
    if (val1 === "") return;
    if (assignChecked && val3 === "") return;

    let fValid = false;
    let valoreConvertito; 
    let errMsg = ""; 
    if (lettereENumeri(val1) && !assignChecked) {
      // Dichiarazione senza valore: valore di default per tipo.
      fValid = true;
      valoreConvertito = (tipo === "int") ? 0 : (tipo === "float" ? 0 : "");
    } else if (lettereENumeri(val1)) { 
      switch (tipo) { 
        case "int":
          if (/^-?\d+$/.test(val3)) { fValid = true; valoreConvertito = parseInt(val3); } // Valido intero
          else { errMsg = (typeof i18nText === 'function' && i18nText('var_err_int')) || "Il valore deve essere un intero valido."; }
          break;
        case "float":
          if (/^-?\d*\.\d+$/.test(val3) || /^-?\d+\.?\d*$/.test(val3)) { fValid = true; valoreConvertito = parseFloat(val3); } // Valido float
          else { errMsg = (typeof i18nText === 'function' && i18nText('var_err_float')) || "Il valore deve essere un numero decimale valido."; }
          break;
        case "string":
          fValid = true; valoreConvertito = val3; // Le stringhe sono sempre valide (se non vuote, gestito sopra)
          break;
      }
    } else {
      errMsg = (typeof i18nText === 'function' && i18nText('var_err_name')) || "Nome variabile non valido (deve iniziare con una lettera e contenere solo lettere e numeri).";
    }

    // Rilievo 14: rifiuta un nome di variabile GIA' esistente (in un'altra riga).
    if (fValid) {
      const _self = isUltimaRiga ? -1 : (target.rowIndex - 1);
      const _dup = Array.isArray(flow.variables) && flow.variables.some(function (v, idx) { return v && v.name === val1 && idx !== _self; });
      if (_dup) { fValid = false; errMsg = (typeof i18nText === 'function' && i18nText('var_dup')) || 'Esiste gia\' una variabile con questo nome.'; }
    }
    // Se i dati sono validi, aggiorna o aggiunge la variabile logica e gestisce la tabella.
    if (fValid) {
      if (!isUltimaRiga) { // Modifica di una variabile esistente
        flow.variables[target.rowIndex - 1] = Object.assign({ name: val1, type: tipo, value: valoreConvertito }, assignChecked ? {} : { uninit: true });
      } else { // Aggiunta di una nuova variabile (era l'ultima riga, quella vuota)
        if (target.getAttribute("data-inserito") === "1") return; 
        target.setAttribute("data-inserito", "1"); // Marca temporaneamente come inserito
        flow.variables.push(Object.assign({ name: val1, type: tipo, value: valoreConvertito }, assignChecked ? {} : { uninit: true })); // Aggiunge all'array logico
        inserisciRiga(); // Aggiunge una nuova riga vuota in fondo alla tabella per il prossimo input
        // Associa l'handler eventi alla nuova ultima riga (quella appena aggiunta)
        tabVariabili.rows[tabVariabili.rows.length - 1].addEventListener("change", aggiungiVaribile);
        target.removeAttribute("data-inserito"); // Rimuove il marcatore
      }

    } else {
      let errorRow = tabVariabili.insertRow(target.rowIndex + 1); // Inserisce una nuova riga per l'errore
      errorRow.classList.add("error-message-row"); // Classe per lo stile
      let errorCell = errorRow.insertCell(); // Cella che occupa tutta la larghezza
      errorCell.colSpan = 3; // Occupa 3 colonne
      errorCell.className = "error-message"; // Classe per lo stile del messaggio
      errorCell.textContent = ((typeof i18nText === 'function' && i18nText('var_err_invalid_data')) || "Dati non validi.") + " " + errMsg; // Testo dell'errore
      // Rimuove il messaggio di errore al prossimo input nella riga problematica
      target.addEventListener("input", () => { if (errorRow.parentNode) errorRow.remove(); }, { once: true });
    }
  }

  // Inserisce una nuova riga vuota (con campi input e select) nella tabella delle variabili HTML.
  function inserisciRiga() {
    let nuovaRiga = tabVariabili.insertRow(); // Crea un nuovo elemento TR
    let cell1 = nuovaRiga.insertCell(); // Cella per il nome
    let cell2 = nuovaRiga.insertCell(); // Cella per il tipo
    let cell3 = nuovaRiga.insertCell(); // Cella per il valore

    // Input per il nome della variabile
    let inputNome = document.createElement("input");
    inputNome.type = "text"; inputNome.classList.add("inputVariable");
    cell1.appendChild(inputNome);

    // Select per il tipo di variabile
    let selectTipo = document.createElement("select");
    selectTipo.classList.add("inputVariable");
    // WP-D1 esteso: testo iniziale ora coerente con _varTypeLabel/i18n (era "Integer" fisso
    // in inglese) -- in pratica ridondante perche' updateVarTypeOptions() qui sotto lo
    // riscrive SUBITO nella lingua corrente, ma niente testo hardcoded come fallback iniziale.
    ["int", "float", "string"].forEach(val => {
      let option = document.createElement("option");
      const _key = { int: 'var_type_int', float: 'var_type_float', string: 'var_type_string' }[val];
      option.value = val;
      option.textContent = (typeof i18nText === 'function' && i18nText(_key)) || (val.charAt(0).toUpperCase() + val.slice(1));
      selectTipo.appendChild(option);
    });
    cell2.appendChild(selectTipo);
    try { updateVarTypeOptions(); } catch (e) {}

    // Input per il valore della variabile. FIX (Ismail 2026-07-07): il valore e' BLOCCATO
    // (readonly) di default e si sblocca con un piccolo pulsante lucchetto accanto, per
    // evitare modifiche accidentali. Input + pulsante stanno in un wrapper flex DENTRO la
    // stessa cella (nessuna colonna aggiuntiva: layout invariato).
    // FIX (Ismail 2026-07-07): niente lucchetto -- casella semplice con un tooltip tradotto
    // al passaggio del mouse (data-i18n-title="assign_hint", aggiornato al cambio lingua).
    let assignChk = document.createElement("input");
    // FIX #10 (Ismail 2026-07-08): default della checkbox = false (variabile dichiarata
    // SENZA valore, campo valore disabilitato finche' l'utente non spunta "Assegna").
    assignChk.type = "checkbox"; assignChk.className = "assign-check"; assignChk.checked = false;
    assignChk.setAttribute("data-i18n-title", "blk_assign");
    assignChk.title = (typeof i18nText === "function" && i18nText("blk_assign")) || "Assegna";
    assignChk.setAttribute("onchange", "toggleAssign(this)");
    let inputValore = document.createElement("input");
    inputValore.type = "text"; inputValore.classList.add("inputVariable", "value-input");
    inputValore.disabled = true; // coerente col default non spuntato
    let wrapV = document.createElement("div"); wrapV.className = "value-cell";
    wrapV.appendChild(assignChk); wrapV.appendChild(inputValore);
    // Rilievo 14: pulsante per eliminare la variabile direttamente dalla tabella.
    let delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.className = "var-del"; delBtn.innerHTML = "&times;";
    delBtn.setAttribute("data-i18n-title", "var_delete");
    delBtn.title = (typeof i18nText === "function" && i18nText("var_delete")) || "Elimina variabile";
    delBtn.setAttribute("onclick", "deleteVariableRow(this)");
    wrapV.appendChild(delBtn);
    cell3.appendChild(wrapV);
  }

// Rilievo 14: elimina la variabile della riga direttamente dalla tabella; le altre traslano
// automaticamente (il <table> ricompatta le righe) senza lasciare buchi.
function deleteVariableRow(btn) {
  let tr = btn; while (tr && tr.tagName !== 'TR') tr = tr.parentElement;
  const tab = document.getElementById('tabVariabili');
  if (!tr || !tab) return;
  if (tr.rowIndex >= tab.rows.length - 1) return; // ultima riga = template vuoto: non si elimina
  // R13-L: se il popover valori era ancorato proprio a questa riga, chiudilo SENZA
  // committare -- la riga (e il suo input) stanno per sparire dal DOM.
  if (typeof closeVarValuePopover === 'function') {
    const pop = document.getElementById('var-value-popover');
    if (pop && !pop.hidden && pop._targetInput && tr.contains(pop._targetInput)) closeVarValuePopover(false);
  }
  const varIdx = tr.rowIndex - 1;
  if (Array.isArray(flow.variables) && varIdx >= 0 && varIdx < flow.variables.length) flow.variables.splice(varIdx, 1);
  tab.deleteRow(tr.rowIndex);
  if (typeof saved !== 'undefined') saved = false;
  if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
}

// Rilievi 24+30 (v3, Ismail 2026-07-10): il TIPO variabile normalmente resta ESTESO
// e tradotto (Intero/Decimale/Stringa...) e si abbrevia (Int/Flo/Str) SOLO quando la
// sidebar si restringe sotto una certa soglia. Quando abbreviato, la colonna Tipo si
// restringe e cede spazio alla colonna Valore (classe .tab-narrow su #tabVariabili,
// vedi CSS), cosi' il campo valore + il pulsante elimina restano sempre visibili.
function _varTypeLabel(val, abbrev) {
  const key = { int: 'var_type_int', float: 'var_type_float', string: 'var_type_string' }[val];
  const full = (typeof i18nText === 'function' && i18nText(key)) || { int: 'Integer', float: 'Float', string: 'String' }[val] || val;
  if (!abbrev) return full;
  // R12-A3 (Ismail 2026-07-11): PRIMA LETTERA della label TRADOTTA nella lingua corrente
  // (non piu' 'Int'/'Flo'/'Str' fissi in inglese, insensati in AR/ZH). Array.from invece di
  // charAt/[0]: al sicuro anche se la label iniziasse con un carattere fuori dal BMP (coppia
  // surrogata), che charAt spezzerebbe a meta'.
  const ch = Array.from(full)[0];
  return ch || full;
}
// R12-A3: le <option> di una <select> nativa mostrano il loro textContent per esteso quando
// il menu e' APERTO, anche se il valore selezionato (a menu chiuso) resta quello scritto per
// ultimo -- quindi basta riscrivere le option per esteso quando l'utente apre il menu
// (mousedown/focus, il piu' presto possibile) e tornare ad abbreviare alla chiusura
// (change/blur) SE la sidebar e' ancora stretta. Un solo attach per <select> (guardia
// data-var-expand-bound sull'elemento), cosi' updateVarTypeOptions() -- che gira spesso, a
// ogni resize/drag della sidebar -- puo' richiamarla ad ogni giro senza duplicare i listener.
function attachVarTypeExpand(sel) {
  if (!sel || !sel.getAttribute || sel.getAttribute('data-var-expand-bound') === '1') return;
  sel.setAttribute('data-var-expand-bound', '1');
  const expand = function () {
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _varTypeLabel(o.value, false); });
  };
  const collapse = function () {
    const sb = document.getElementById('sidebar');
    const narrow = (sb && sb.getBoundingClientRect) ? (sb.getBoundingClientRect().width < 260) : false;
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _varTypeLabel(o.value, narrow); });
  };
  sel.addEventListener('mousedown', expand);
  sel.addEventListener('focus', expand);
  sel.addEventListener('change', collapse);
  sel.addEventListener('blur', collapse);
}
function updateVarTypeOptions() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const sb = document.getElementById('sidebar');
  const tab = document.getElementById('tabVariabili');
  const narrow = (sb && sb.getBoundingClientRect) ? (sb.getBoundingClientRect().width < 260) : false;
  if (tab && tab.classList) tab.classList.toggle('tab-narrow', narrow);
  document.querySelectorAll('#tabVariabili select.inputVariable').forEach(function (sel) {
    // R12-A3: copre anche la riga TEMPLATE statica di index.html (gia' nel DOM al load,
    // mai passata da inserisciRiga) -- updateVarTypeOptions gira su window 'load' qui sotto.
    attachVarTypeExpand(sel);
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _varTypeLabel(o.value, narrow); });
  });
}
if (typeof window !== 'undefined') {
  window.updateVarTypeOptions = updateVarTypeOptions;
  window.attachVarTypeExpand = attachVarTypeExpand;
  window.addEventListener('resize', function () { try { updateVarTypeOptions(); } catch (e) {} });
  window.addEventListener('load', function () { try { updateVarTypeOptions(); } catch (e) {} });
}

// Abilita/disabilita il campo valore in base alla checkbox "Assign" della riga.
function toggleAssign(chk) {
  const wrap = chk && chk.parentElement;
  const input = wrap ? wrap.querySelector("input.value-input") : null;
  if (!input) return;
  input.disabled = !chk.checked;
  if (!chk.checked) input.value = "";
}

// Sblocca/blocca il campo VALORE della riga variabile (readonly toggle). Il lucchetto
// cambia icona; allo sblocco il focus va sull'input per digitare subito.
function toggleValueLock(btn) {
  const wrap = btn && btn.parentElement;
  const input = wrap ? wrap.querySelector("input") : null;
  if (!input) return;
  input.readOnly = !input.readOnly;
  btn.textContent = input.readOnly ? "\uD83D\uDD12" : "\uD83D\uDD13"; // chiuso / aperto
  btn.title = input.readOnly ? "Sblocca per modificare il valore" : "Blocca il valore";
  if (!input.readOnly) input.focus();
}

// Mostra/nasconde COMPLETAMENTE la sidebar variabili (classe su #main).
// Da chiusa resta un pulsante laterale (#sidebar-reopen) per riaprirla.
function toggleVariables() {
  const main = document.getElementById('main');
  if (!main) return;
  main.classList.toggle('sidebar-collapsed');
  if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
  // R14-E (Ismail 2026-07-13): PRIMA queste 3 chiamate erano in ordine SBAGLIATO --
  // updateZoomOffset()/centerGraph() giravano PRIMA di syncLayoutVars(), quindi misuravano
  // la console usando ancora il VECCHIO --sidebar-width (il tetto max-width della console
  // agganciata dipende da questa var, style.css). Con sidebar E console entrambe aperte al
  // massimo, questo produceva il centraggio sbagliato segnalato da Ismail. Ora si passa dal
  // tick condiviso _bfSidebarLiveResizeTick() (init.js), che garantisce l'ordine corretto
  // (syncLayoutVars -> updateZoomOffset -> centerGraph) ed e' lo STESSO punto di ricalcolo
  // usato da drag sidebar/console, resize finestra, zoom, cambio lingua -- un solo posto,
  // niente piu' ordini diversi a seconda di chi lo chiama. Il richiamo a 240ms resta (fine
  // della transizione CSS di apertura/chiusura, offsetWidth definitivo).
  if (typeof _bfSidebarLiveResizeTick === 'function') {
    _bfSidebarLiveResizeTick();
    setTimeout(_bfSidebarLiveResizeTick, 240);
  } else if (typeof window !== 'undefined') {
    // Fallback estremo se init.js non fosse ancora caricato (non dovrebbe capitare: script
    // caricati in ordine fisso in index.html) -- stesso ordine corretto, ripetuto a mano.
    if (typeof window.syncLayoutVars === 'function') window.syncLayoutVars();
    if (typeof updateZoomOffset === 'function') updateZoomOffset();
    if (typeof centerGraph === 'function') centerGraph();
  }
}

// ============================================================================
// R13-L (Ismail 2026-07-12): valori LUNGHI (pensato per String, ma vale per ogni tipo) --
// doppio binario, per TUTTI i campi valore, costo zero quando non serve:
// (1) tooltip nativo (title) SEMPRE sincronizzato col valore corrente -- vedi il listener
//     'input' delegato sotto (digitazione manuale) + il sync esplicito in
//     refreshVariablesWatch/restoreVariablesTable (execute.js, gia' toccano l'input giusto
//     dal fix A0, ora aggiornano anche .title li').
// (2) doppio click sulla cella valore apre un popover con textarea grande (auto-height,
//     wrap) per editare comodamente. Invio o click fuori -> chiude e COMMITTA (stesso
//     percorso di validazione di aggiungiVaribile, via evento 'change' sulla riga, gia'
//     agganciato su ogni riga statica/dinamica). Esc -> chiude SENZA salvare.
// Durante l'esecuzione il campo mostra il valore RUNTIME (classe .live-value, aggiunta/
// rimossa da refreshVariablesWatch/restoreVariablesTable) -- STESSO segnale gia' esistente,
// nessuno stato "sto eseguendo" duplicato: il popover si apre in sola lettura in quel caso
// (coerenza gia' stabilita per C7, i runtime non si editano).
// ============================================================================
function _varSyncValueTitle(input) {
  if (input) input.title = input.value;
}
function _varPopoverAutoHeight() {
  const ta = document.getElementById('var-value-popover-textarea');
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(240, Math.max(38, ta.scrollHeight + 2)) + 'px';
}
function openVarValuePopover(input) {
  if (!input) return;
  const pop = document.getElementById('var-value-popover');
  const ta = document.getElementById('var-value-popover-textarea');
  const hint = document.getElementById('var-value-popover-hint');
  if (!pop || !ta) return;
  const readonly = !!(input.classList && input.classList.contains('live-value'));
  ta.value = input.value;
  ta.readOnly = readonly;
  if (pop.classList) pop.classList.toggle('var-popover-readonly', readonly);
  if (hint) hint.style.display = readonly ? 'none' : '';
  pop._targetInput = input;
  const tr = input.closest ? input.closest('tr') : null;
  const container = document.getElementById('tableContainer');
  if (tr && container && container.getBoundingClientRect && tr.getBoundingClientRect) {
    const contRect = container.getBoundingClientRect();
    const rowRect = tr.getBoundingClientRect();
    pop.style.top = (rowRect.top - contRect.top + container.scrollTop) + 'px';
  }
  pop.hidden = false;
  if (typeof _bfPushOverlay === 'function') _bfPushOverlay('var-value-popover');
  _varPopoverAutoHeight();
  ta.focus();
  if (!readonly) ta.select();
}
function closeVarValuePopover(commit) {
  const pop = document.getElementById('var-value-popover');
  if (!pop || pop.hidden) return;
  const ta = document.getElementById('var-value-popover-textarea');
  const input = pop._targetInput;
  if (commit && input && ta && !ta.readOnly) {
    input.value = ta.value;
    _varSyncValueTitle(input);
    // Stesso percorso di validazione di aggiungiVaribile: un 'change' sulla riga (gia'
    // agganciato da init.js/inserisciRiga su ogni riga, statica o dinamica).
    const tr = input.closest ? input.closest('tr') : null;
    if (tr && typeof Event === 'function') tr.dispatchEvent(new Event('change', { bubbles: true }));
  }
  pop.hidden = true;
  pop._targetInput = null;
  if (typeof _bfPopOverlay === 'function') _bfPopOverlay('var-value-popover');
}
if (typeof document !== 'undefined') {
  // Delega su #tabVariabili: UN solo listener copre sia le righe dinamiche (inserisciRiga)
  // sia la riga template gia' presente nel DOM al caricamento (index.html) -- nessun bind
  // per-riga da ricordarsi di ripetere a ogni inserisciRiga().
  document.addEventListener('DOMContentLoaded', function () {
    const tab = document.getElementById('tabVariabili');
    if (tab) {
      tab.addEventListener('dblclick', function (e) {
        const input = e.target && e.target.closest ? e.target.closest('input.value-input') : null;
        if (input) openVarValuePopover(input);
      });
    }
  });
  document.addEventListener('input', function (e) {
    const t = e.target;
    if (!t) return;
    if (t.classList && t.classList.contains('value-input')) _varSyncValueTitle(t);
    else if (t.id === 'var-value-popover-textarea') _varPopoverAutoHeight();
  });
  // R13-L: la textarea NON passa dal listener 'keydown' globale di init.js (che ignora
  // volutamente input/textarea/select, vedi WP-D6/round-11) -- serve un handler locale
  // dedicato per Invio (commit) ed Esc (annulla), altrimenti nessuno dei due farebbe nulla.
  document.addEventListener('keydown', function (e) {
    if (!e.target || e.target.id !== 'var-value-popover-textarea') return;
    if (e.key === 'Escape') { e.stopPropagation(); closeVarValuePopover(false); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeVarValuePopover(true); }
  });
  // Click fuori dal popover -> chiude e committa (come da piano).
  document.addEventListener('mousedown', function (e) {
    const pop = document.getElementById('var-value-popover');
    if (!pop || pop.hidden) return;
    if (!pop.contains(e.target)) closeVarValuePopover(true);
  });
}
if (typeof window !== 'undefined') {
  window.openVarValuePopover = openVarValuePopover;
  window.closeVarValuePopover = closeVarValuePopover;
}

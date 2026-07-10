
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
          else { errMsg = "Il valore deve essere un intero valido."; }
          break;
        case "float":
          if (/^-?\d*\.\d+$/.test(val3) || /^-?\d+\.?\d*$/.test(val3)) { fValid = true; valoreConvertito = parseFloat(val3); } // Valido float
          else { errMsg = "Il valore deve essere un numero decimale valido."; }
          break;
        case "string":
          fValid = true; valoreConvertito = val3; // Le stringhe sono sempre valide (se non vuote, gestito sopra)
          break;
      }
    } else {
      errMsg = "Nome variabile non valido (deve iniziare con una lettera e contenere solo lettere e numeri).";
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
        flow.variables[target.rowIndex - 1] = { name: val1, type: tipo, value: valoreConvertito };
      } else { // Aggiunta di una nuova variabile (era l'ultima riga, quella vuota)
        if (target.getAttribute("data-inserito") === "1") return; 
        target.setAttribute("data-inserito", "1"); // Marca temporaneamente come inserito
        flow.variables.push({ name: val1, type: tipo, value: valoreConvertito }); // Aggiunge all'array logico
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
      errorCell.textContent = "Dati non validi. " + errMsg; // Testo dell'errore
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
    ["int", "float", "string"].forEach(val => {
      let option = document.createElement("option");
      option.value = val; option.textContent = val.charAt(0).toUpperCase() + val.slice(1);
      if(val=="int"){ // Personalizzazione testo per "Integer"
        option.textContent = "Integer"
      }
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
  const varIdx = tr.rowIndex - 1;
  if (Array.isArray(flow.variables) && varIdx >= 0 && varIdx < flow.variables.length) flow.variables.splice(varIdx, 1);
  tab.deleteRow(tr.rowIndex);
  if (typeof saved !== 'undefined') saved = false;
  if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
}

// Rilievi 24+30: etichette del TIPO variabile — tradotte, e abbreviate quando la tabella e'
// stretta (Int/Flo/Str) cosi' non deformano il layout.
function _varTypeLabel(val, abbrev) {
  if (abbrev) return { int: 'Int', float: 'Flo', string: 'Str' }[val] || val;
  const key = { int: 'var_type_int', float: 'var_type_float', string: 'var_type_string' }[val];
  return (typeof i18nText === 'function' && i18nText(key)) || { int: 'Integer', float: 'Float', string: 'String' }[val] || val;
}
function updateVarTypeOptions() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const sb = document.getElementById('sidebar');
  const narrow = (sb && sb.getBoundingClientRect) ? (sb.getBoundingClientRect().width < 215) : false;
  document.querySelectorAll('#tabVariabili select.inputVariable').forEach(function (sel) {
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _varTypeLabel(o.value, narrow); });
  });
}
if (typeof window !== 'undefined') {
  window.updateVarTypeOptions = updateVarTypeOptions;
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
  if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 240); } // ora e a fine animazione
  // FIX (Ismail 2026-07-07): aggiorna --sidebar-width cosi' il tetto di larghezza della
  // console agganciata segue apertura/chiusura della tabella variabili (subito + a fine
  // animazione, quando offsetWidth e' definitivo).
  if (typeof window !== 'undefined' && typeof window.syncLayoutVars === 'function') {
    window.syncLayoutVars(); setTimeout(window.syncLayoutVars, 240);
  }
}

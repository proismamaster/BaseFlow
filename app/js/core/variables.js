
  // WP-M4t (Ismail 2026-07-21): le righe di ERRORE sono <tr> a tutti gli effetti, quindi
  // entrano nel conteggio di `rowIndex`. Finche' l'errore compariva sull'ULTIMA riga il
  // problema non si vedeva, ma un errore su una riga in mezzo sfasava di uno tutte le righe
  // sotto: `flow.variables[tr.rowIndex - 1]` puntava alla variabile SBAGLIATA e modificarne
  // una ne sovrascriveva un'altra. Qui l'indice logico si ricava CONTANDO le righe vere che
  // precedono, ignorando header e righe di errore -- non dalla posizione fisica nel DOM.
  function _bfVarIndexOf(tr) {
    if (!tr || !tr.parentNode) return -1;
    let idx = -1;
    const rows = tr.parentNode.rows || tr.parentNode.children;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.classList && r.classList.contains('error-message-row')) continue;
      if (r.cells && r.cells.length && r.cells[0].tagName === 'TH') continue; // header
      idx++;
      if (r === tr) return idx;
    }
    return -1;
  }
  // Idem per "sono l'ultima riga (il template vuoto)?": una riga di errore appesa sotto la
  // riga template la faceva sembrare NON ultima, e il template finiva a scrivere dentro
  // flow.variables invece di creare una nuova variabile.
  function _bfIsTemplateRow(tr) {
    let nxt = tr && tr.nextElementSibling;
    while (nxt && nxt.classList && nxt.classList.contains('error-message-row')) nxt = nxt.nextElementSibling;
    return !nxt;
  }
  // WP-M5g (Ismail 2026-07-21): un letterale stringa nella dichiarazione deve stare fra
  // virgolette, doppie o singole. Ritorna il CONTENUTO (con gli escape risolti) oppure null
  // se il testo non e' un letterale stringa ben formato. Le virgolette devono aprire e
  // chiudere l'intero campo: `"a" + "b"` non e' un letterale e va rifiutato (nella
  // dichiarazione non si valutano espressioni, solo valori).
  function _bfParseStringLiteral(s) {
    const t = String(s).trim();
    if (t.length < 2) return null;
    const q = t[0];
    if ((q !== '"' && q !== "'") || t[t.length - 1] !== q) return null;
    let out = '';
    for (let i = 1; i < t.length - 1; i++) {
      const c = t[i];
      if (c === '\\' && i + 1 < t.length - 1) { out += t[i + 1]; i++; continue; }
      if (c === q) return null; // virgoletta non escapata a meta' campo: due letterali attaccati
      out += c;
    }
    return out;
  }
  // WP-M5g: riconosce un RIFERIMENTO a un'altra variabile, cioe' un nome nudo (nessuna
  // virgoletta, nessun operatore). `true`/`false` sono esclusi: restano letterali booleani.
  function _bfParseVarRef(s) {
    const t = String(s).trim();
    if (!/^[A-Za-z_]\w*$/.test(t)) return null;
    if (t === 'true' || t === 'false' || t === 'null') return null;
    return t;
  }
  if (typeof window !== 'undefined') { window._bfParseStringLiteral = _bfParseStringLiteral; window._bfParseVarRef = _bfParseVarRef; }
  // Gestisce l'aggiunta o la modifica di una variabile nella tabella HTML delle variabili.
  // Viene attivata quando l'utente modifica i campi di input/select in una riga della tabella.
  function aggiungiVaribile(event) {
    let target = event.target; // Elemento che ha scatenato l'evento (input o select)
    while (target && target.tagName !== "TR") target = target.parentElement; 
    if (!target) return; // Esce se non trova la riga

    let isUltimaRiga = _bfIsTemplateRow(target); // WP-M4t: robusto alle righe di errore
    let val1 = target.cells[0].querySelector("input").value.trim();
    let tipo = target.cells[1].querySelector("select").value;
    // WP-M2 (Ismail 2026-07-20, tipo Array): richiesta esplicita "prima chiediamo se array,
    // poi eventualmente il tipo di array" -- la select TIPO ha la voce 'array' e, quando
    // scelta, compare una SECONDA select col tipo degli elementi (_bfSyncElemTypeControl).
    // Il tipo memorizzato e' la stringa composta 'array:<elem>' (vedi isArrayType, execute.js).
    if (tipo === 'array') {
      const _es = target.cells[1].querySelector('select.array-elem-select');
      // WP-M4n: NIENTE default silenzioso qui (prima: `|| 'int'`). Se il tipo degli
      // elementi non e' stato scelto, `tipo` resta 'array:' -- forma incompleta che la
      // validazione sotto riconosce e rifiuta con un messaggio dedicato.
      tipo = 'array:' + ((_es && _es.value) || '');
    }
    // Ismail 2026-07-20: il campo valore puo' ora essere un <select> (tipo bool, vedi
    // _bfSyncValueControl) invece di un <input> -- ".value-input" senza vincolo di tag copre
    // entrambi i casi (.value funziona identico su input e select).
    let val3 = (target.cells[2].querySelector(".value-input") || target.cells[2].querySelector("input")).value.trim();
    // FIX (Ismail 2026-07-07): checkbox "Assign" per riga. Se NON selezionata, la variabile
    // si DICHIARA senza assegnare un valore (valore di default per tipo) e la riga si sblocca
    // per la successiva senza richiedere il campo valore.
    let assignChecked = true;
    { const _c = target.cells[2].querySelector('.assign-check'); if (_c) assignChecked = !!_c.checked; }

    // Rimuove eventuali messaggi di errore visualizzati precedentemente per questa riga.
    // WP-M4t (Ismail 2026-07-21, "quando c'e' un errore, es. legato alla dimensione array ma
    // anche altro, quando correggi deve sparire"): questo blocco C'ERA gia' ma non funzionava,
    // per un motivo preciso. Usava `nextSibling`, che restituisce QUALSIASI nodo, compresi i
    // nodi di TESTO. Le righe scritte a mano in index.html (la riga template) sono separate da
    // ritorni a capo, quindi fra <tr> e <tr> c'e' un nodo di testo: `nextSibling` restituiva
    // quello, `.classList` era undefined, il controllo falliva in silenzio e la riga di errore
    // NON veniva mai rimossa -- restava li' anche dopo aver corretto il valore.
    // `nextElementSibling` salta i nodi di testo. Il `while` invece del solo `if` ripulisce
    // anche gli errori eventualmente accumulati da giri precedenti.
    let oldError = target.nextElementSibling;
    while (oldError && oldError.classList && oldError.classList.contains("error-message-row")) {
      const _nxt = oldError.nextElementSibling;
      oldError.remove();
      oldError = _nxt;
    }

    // Se non è l'ultima riga e i campi nome e valore sono entrambi vuoti, interpreta come eliminazione della variabile.
    if (!isUltimaRiga && val1 === "" && (val3 === "" || !assignChecked)) {
      flow.variables.splice(_bfVarIndexOf(target), 1); // WP-M4t: indice logico, non rowIndex
      // WP-M5n: la tabella cambia -> i risultati dell'ultima run non valgono piu'.
      if (typeof _bfInvalidateRunResults === 'function') _bfInvalidateRunResults();
      tabVariabili.deleteRow(target.rowIndex); // Rimuove la riga dalla tabella HTML
      return;
    }

    // Nome sempre richiesto; il valore SOLO se "Assign" e' selezionata.
    if (val1 === "") return;
    if (assignChecked && val3 === "") return;

    let fValid = false;
    let valoreConvertito;
    let errMsg = "";
    let _pendingRef = null; // WP-M5g: nome della variabile referenziata, se il valore e' un riferimento
    // WP-M4n (Ismail 2026-07-21): gli ARRAY non passano mai dal ramo "dichiarazione senza
    // valore" qui sotto -- prima ci finivano quando "Assegna" era spento e diventavano
    // valide con un [] vuoto, cioe' SENZA che dimensione e tipo elementi fossero stati
    // scelti. Ora vanno sempre nel ramo array dedicato, che li pretende entrambi.
    const _isArrayType = (tipo.indexOf('array:') === 0);
    if (lettereENumeri(val1) && !assignChecked && !_isArrayType) {
      // Dichiarazione senza valore: valore di default per tipo.
      fValid = true;
      valoreConvertito = (tipo === "int") ? 0 : (tipo === "float") ? 0 : (tipo === "bool") ? false : "";
    } else if (lettereENumeri(val1) && tipo.indexOf('array:') === 0) {
      // WP-M4 (mockup di Ismail 2026-07-20 sera, sostituisce il modello WP-M3 della stessa
      // giornata): la DIMENSIONE si dichiara nella colonna TIPO ("Intero ▼ × 3"); il campo
      // VALORE accetta due forme, entrambe validate col tipo degli elementi:
      //   - UN solo valore -> applicato a TUTTE le celle (richiesta del giro precedente);
      //   - la LISTA completa "1,2,3" (come nel mockup) -> una cella per elemento; se il
      //     conteggio non combacia con la dimensione dichiarata, errore chiaro. Con la
      //     dimensione vuota, la lista la determina da sola (e il campo si auto-compila).
      // Senza "Assegna": celle dichiarate ma non inizializzate (default + flag uninit).
      const _et = tipo.slice(6);
      const _sizeInp = target.cells[1].querySelector('.array-size-input');
      const _sizeRaw = _sizeInp ? String(_sizeInp.value).trim() : '';
      const BF_ARRAY_MAX_SIZE = 1000; // WP-M4i (Ismail 2026-07-21): tetto abbassato da 10000 a 1000
      let _size = -1; // -1 = non specificata/invalida
      if (/^\d+$/.test(_sizeRaw)) _size = parseInt(_sizeRaw, 10);
      if (_size > BF_ARRAY_MAX_SIZE) _size = -1;
      const _validateElem = function (p) {
        if (_et === 'int') { if (/^-?\d+$/.test(p)) return { ok: true, v: parseInt(p, 10) }; return { ok: false, msg: (typeof i18nText === 'function' && i18nText('var_err_int')) || 'Il valore deve essere un intero valido.' }; }
        if (_et === 'float') { if (/^-?\d*\.\d+$/.test(p) || /^-?\d+\.?\d*$/.test(p)) return { ok: true, v: parseFloat(p) }; return { ok: false, msg: (typeof i18nText === 'function' && i18nText('var_err_float')) || 'Il valore deve essere un numero decimale valido.' }; }
        if (_et === 'bool') { const _b = p.toLowerCase(); if (_b === 'true' || _b === 'false') return { ok: true, v: _b === 'true' }; return { ok: false, msg: (typeof i18nText === 'function' && i18nText('var_err_bool')) || 'Il valore deve essere true o false.' }; }
        // WP-M5g: anche gli ELEMENTI stringa di un array seguono la regola nuova -- fra
        // virgolette. Senza questa riga la tabella avrebbe avuto due sintassi diverse per la
        // stessa cosa: `"a"` per una variabile stringa e `a` per una cella di array di stringhe.
        {
          const _lit = (typeof _bfParseStringLiteral === 'function') ? _bfParseStringLiteral(p) : null;
          if (_lit !== null) return { ok: true, v: _lit };
          return { ok: false, msg: (typeof i18nText === 'function' && i18nText('var_err_string_quotes')) || 'Le stringhe vanno fra virgolette: "testo".' };
        }
      };
      // WP-M4p (Ismail 2026-07-21, "non lascia tempo all'utente di finire prima di dare
      // errore: non deve dare errore se non ha compilato, deve darlo se i parametri sono
      // sbagliati; se non c'e' tutto semplicemente non crea la prossima riga"):
      // si distingue INCOMPLETO da SBAGLIATO.
      //   - incompleto (tipo elementi non ancora scelto, dimensione ancora vuota) -> USCITA
      //     SILENZIOSA: nessun messaggio rosso, la riga semplicemente non viene confermata
      //     e la riga successiva non compare;
      //   - sbagliato (dimensione non numerica o fuori range, valore del tipo errato,
      //     numero di elementi diverso dalla dimensione) -> errore visibile, come prima.
      if (!_et) return;                       // tipo elementi non ancora scelto
      if (_sizeRaw === '') return;            // dimensione non ancora inserita
      if (_size < 0) {
        // Qui la dimensione E' stata scritta ma non e' valida (non numerica o > 1000):
        // questo si', e' un errore da mostrare.
        errMsg = (typeof i18nText === 'function' && i18nText('var_err_array_size')) || 'La dimensione deve essere un numero intero tra 0 e 1000.';
      } else if (!assignChecked) {
        fValid = true;
        const _def = (_et === 'int' || _et === 'float') ? 0 : (_et === 'bool') ? false : '';
        valoreConvertito = new Array(_size).fill(_def);
      } else {
        let _raw = val3.trim();
        if (_raw.startsWith('[') && _raw.endsWith(']')) _raw = _raw.slice(1, -1).trim();
        const _parts = _raw.split(',').map(function (p) { return p.trim(); });
        const _out = [];
        let _bad = null;
        for (let _i = 0; _i < _parts.length; _i++) {
          const _r = _validateElem(_parts[_i]);
          if (!_r.ok) { _bad = _r.msg; break; }
          _out.push(_r.v);
        }
        if (_bad) {
          errMsg = _bad;
        } else if (_out.length === 1) {
          // Un solo valore: vale per tutte le celle (la dimensione e' gia' stata validata sopra).
          fValid = true; valoreConvertito = new Array(_size).fill(_out[0]);
        } else if (_out.length === _size) {
          // WP-M4n: la lista deve combaciare ESATTAMENTE con la dimensione dichiarata --
          // niente piu' "dimensione dedotta dalla lista" (rendeva valido un array senza
          // dimensione, contro la richiesta).
          fValid = true; valoreConvertito = _out;
        } else {
          const _tmpl = (typeof i18nText === 'function' && i18nText('var_err_array_count')) || 'Hai scritto {got} elementi ma la dimensione è {want}: usa un solo valore (per tutte le celle) o esattamente {want} elementi.';
          errMsg = _tmpl.replace(/\{got\}/g, String(_out.length)).replace(/\{want\}/g, String(_size));
        }
      }
      // Dopo un commit valido: dimensione mostrata sempre allineata a value.length.
      if (fValid && _sizeInp) _sizeInp.value = String(valoreConvertito.length);
    } else if (lettereENumeri(val1)) {
      // WP-M5g (Ismail 2026-07-21): il campo VALORE della dichiarazione puo' ora essere un
      // RIFERIMENTO a un'altra variabile (`b` invece di un letterale), anche a una dichiarata
      // PIU' SOTTO nella tabella. Il riferimento non si risolve qui -- qui la variabile citata
      // potrebbe non esistere ancora -- ma all'avvio dell'esecuzione, quando la tabella e'
      // completa (vedi _bfResolveVarRefs in execute.js). Si memorizza `ref` e si lascia il
      // default di tipo come valore segnaposto.
      const _refName = _bfParseVarRef(val3);
      if (_refName) {
        fValid = true;
        valoreConvertito = (tipo === 'int' || tipo === 'float') ? 0 : (tipo === 'bool') ? false : '';
        _pendingRef = _refName;
      } else
      switch (tipo) {
        case "int":
          if (/^-?\d+$/.test(val3)) { fValid = true; valoreConvertito = parseInt(val3); } // Valido intero
          else { errMsg = (typeof i18nText === 'function' && i18nText('var_err_int')) || "Il valore deve essere un intero valido."; }
          break;
        case "float":
          if (/^-?\d*\.\d+$/.test(val3) || /^-?\d+\.?\d*$/.test(val3)) { fValid = true; valoreConvertito = parseFloat(val3); } // Valido float
          else { errMsg = (typeof i18nText === 'function' && i18nText('var_err_float')) || "Il valore deve essere un numero decimale valido."; }
          break;
        // WP-M5g (Ismail 2026-07-21, "nelle stringhe bisogna usare le \"\" per assegnarle
        // dappertutto, perche' uno potrebbe assegnare come valore di una variabile un'altra"):
        // prima QUALSIASI testo era una stringa valida, quindi scrivere `b` non poteva
        // significare "il valore di b" -- era la stringa "b" e basta. Ora la regola e' quella
        // del resto del linguaggio: fra virgolette = testo letterale, nome nudo = variabile.
        // Un testo senza virgolette che non e' nemmeno un nome valido e' un errore esplicito,
        // non un'interpretazione a caso.
        case "string": {
          const _lit = _bfParseStringLiteral(val3);
          if (_lit !== null) { fValid = true; valoreConvertito = _lit; }
          else { errMsg = (typeof i18nText === 'function' && i18nText('var_err_string_quotes')) || 'Le stringhe vanno fra virgolette: "testo". Un nome senza virgolette indica un\'altra variabile.'; }
          break;
        }
        // Ismail 2026-07-20: tipo Boolean -- il valore digitato deve essere ESATTAMENTE
        // "true" o "false" (case-insensitive, spazi ai lati tollerati), coerente con
        // l'unico modo in cui un booleano si scrive nel resto del linguaggio (safeEval.js
        // riconosce solo i letterali true/false, non "1"/"0"/"vero"/"si"). Il valore
        // memorizzato e' un vero JS boolean (non una stringa "true"), cosi' _assertVarType
        // (execute.js) e il resto dell'interprete lo trattano esattamente come il risultato
        // di un confronto (x > 5).
        case "bool": {
          const _b = val3.trim().toLowerCase();
          if (_b === "true" || _b === "false") { fValid = true; valoreConvertito = (_b === "true"); }
          else { errMsg = (typeof i18nText === 'function' && i18nText('var_err_bool')) || "Il valore deve essere true o false."; }
          break;
        }
      }
    } else {
      errMsg = (typeof i18nText === 'function' && i18nText('var_err_name')) || "Nome variabile non valido (deve iniziare con una lettera e contenere solo lettere e numeri).";
    }

    // Rilievo 14: rifiuta un nome di variabile GIA' esistente (in un'altra riga).
    if (fValid) {
      const _self = isUltimaRiga ? -1 : _bfVarIndexOf(target);
      const _dup = Array.isArray(flow.variables) && flow.variables.some(function (v, idx) { return v && v.name === val1 && idx !== _self; });
      if (_dup) { fValid = false; errMsg = (typeof i18nText === 'function' && i18nText('var_dup')) || 'Esiste gia\' una variabile con questo nome.'; }
    }
    // Se i dati sono validi, aggiorna o aggiunge la variabile logica e gestisce la tabella.
    if (fValid) {
      if (!isUltimaRiga) { // Modifica di una variabile esistente
        flow.variables[_bfVarIndexOf(target)] = Object.assign({ name: val1, type: tipo, value: valoreConvertito },
          assignChecked ? {} : { uninit: true },
          // WP-M5g: il riferimento si porta dietro il nome citato; il valore vero lo
          // scrive _bfResolveVarRefs all'avvio dell'esecuzione, quando la tabella e'
          // completa e quindi anche una variabile dichiarata PIU' SOTTO esiste.
          _pendingRef ? { ref: _pendingRef, src: val3 } : { ref: undefined, src: undefined });
      } else { // Aggiunta di una nuova variabile (era l'ultima riga, quella vuota)
        if (target.getAttribute("data-inserito") === "1") return;
        target.setAttribute("data-inserito", "1"); // Marca temporaneamente come inserito
        flow.variables.push(Object.assign({ name: val1, type: tipo, value: valoreConvertito },
          assignChecked ? {} : { uninit: true },
          // WP-M5g: il riferimento si porta dietro il nome citato; il valore vero lo
          // scrive _bfResolveVarRefs all'avvio dell'esecuzione, quando la tabella e'
          // completa e quindi anche una variabile dichiarata PIU' SOTTO esiste.
          _pendingRef ? { ref: _pendingRef, src: val3 } : { ref: undefined, src: undefined })); // Aggiunge all'array logico
        inserisciRiga(); // Aggiunge una nuova riga vuota in fondo alla tabella per il prossimo input
        // Associa l'handler eventi alla nuova ultima riga (quella appena aggiunta)
        tabVariabili.rows[tabVariabili.rows.length - 1].addEventListener("change", aggiungiVaribile);
        target.removeAttribute("data-inserito"); // Rimuove il marcatore
      }
      // WP-M3: per gli array (ri)disegna la griglia delle CELLE (indice -> valore) dentro
      // la cella valore; per gli altri tipi rimuove un'eventuale griglia residua.
      if (typeof _bfRenderArrayCells === 'function') {
        if (tipo.indexOf('array:') === 0) _bfRenderArrayCells(target, valoreConvertito, false, !assignChecked);
        else _bfRenderArrayCells(target, null);
      }
      // WP-M5n: una variabile aggiunta o modificata cambia il programma -- le altre righe
      // devono smettere di mostrare i risultati dell'ultima esecuzione e tornare alle
      // dichiarazioni. restoreVariablesTable salta il campo che ha il fuoco, quindi non
      // interferisce con quello che l'utente sta scrivendo in questo momento.
      if (typeof _bfInvalidateRunResults === 'function') _bfInvalidateRunResults();

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
    // WP-M2 (Ismail 2026-07-20): + voce 'array' -- alla selezione compare una seconda select
    // col tipo degli elementi (vedi _bfSyncElemTypeControl, agganciata via attachVarTypeExpand).
    ["int", "float", "string", "bool", "array"].forEach(val => {
      let option = document.createElement("option");
      const _key = { int: 'var_type_int', float: 'var_type_float', string: 'var_type_string', bool: 'var_type_bool', array: 'var_type_array' }[val];
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
  // WP-M4t: indice logico (le righe di errore non contano) + rimozione dell'eventuale
  // messaggio di errore appeso a questa riga, che altrimenti resterebbe orfano nella tabella
  // riferito a una variabile che non esiste piu'.
  const varIdx = _bfVarIndexOf(tr);
  if (Array.isArray(flow.variables) && varIdx >= 0 && varIdx < flow.variables.length) flow.variables.splice(varIdx, 1);
  let _err = tr.nextElementSibling;
  while (_err && _err.classList && _err.classList.contains('error-message-row')) {
    const _n = _err.nextElementSibling; _err.remove(); _err = _n;
  }
  tab.deleteRow(tr.rowIndex);
  // WP-M5n: eliminare una variabile cambia il programma -> via i risultati della run passata.
  if (typeof _bfInvalidateRunResults === 'function') _bfInvalidateRunResults();
  if (typeof saved !== 'undefined') saved = false;
  if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
}

// WP-M4t (Ismail 2026-07-21): la soglia "sidebar stretta" era 260px, ma il floor della
// sidebar e' salito a 290px (WP-M4s) -- 260 non era piu' raggiungibile e il tipo non si
// abbreviava MAI, per nessuna larghezza. La soglia si alza di conseguenza e resta in UNA
// costante sola: se il floor cambia ancora, si aggiorna qui e non in tre punti diversi.
var BF_VAR_NARROW_PX = 330;
// WP-M4u (Ismail 2026-07-21, "si poteva vedere molto prima la stringa completa, ma la fa
// vedere dopo"): finora la decisione "parola intera o prima lettera" si prendeva con soglie
// in pixel scelte a occhio (larghezza sidebar, oppure ELEM_FULL_WORD_MIN_PX). Una soglia
// fissa e' per forza sbagliata: la parola piu' lunga cambia con la LINGUA ("Decimale" vs
// "Float" vs "小数"), col font e con lo zoom del browser, quindi il numero va tarato sul caso
// peggiore e in tutti gli altri casi abbrevia molto prima del necessario -- esattamente il
// difetto segnalato. Qui si misura invece la larghezza REALE del testo con il font REALE
// della <select> (canvas.measureText) e la si confronta con lo spazio che la select occupa
// davvero: si abbrevia solo quando la parola non ci sta per davvero, mai un pixel prima.
var _bfMeasureCanvas = null;
function _bfTextWidth(text, el) {
  try {
    if (!_bfMeasureCanvas) _bfMeasureCanvas = document.createElement('canvas');
    const ctx = _bfMeasureCanvas.getContext('2d');
    if (!ctx) return 0;
    const cs = getComputedStyle(el);
    // Forma breve della shorthand `font`: stile, peso, corpo e famiglia presi dall'elemento
    // vero, cosi' la misura e' quella che il browser disegnera' davvero.
    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    return ctx.measureText(text).width;
  } catch (e) { return 0; }
}
// Larghezza (px) che `sel` dovrebbe avere per mostrare per intero l'etichetta piu' lunga fra
// quelle passate. Oltre al testo si tiene conto di cio' che la select consuma da sola:
// padding, bordi e lo spazio della freccina (riservato via padding quando appearance:none,
// altrimenti disegnata dal sistema sopra il testo e quindi da scontare a mano).
function _bfSelectNeededWidth(sel, labels) {
  if (!sel) return 0;
  let chrome = 0, appearanceNone = false;
  try {
    const cs = getComputedStyle(sel);
    chrome = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) +
             (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    appearanceNone = (cs.appearance === 'none' || cs.webkitAppearance === 'none');
  } catch (e) {}
  if (!appearanceNone) chrome += 18; // freccina nativa, non riservata dal padding
  let widest = 0;
  for (let i = 0; i < labels.length; i++) {
    const w = _bfTextWidth(labels[i], sel);
    if (w > widest) widest = w;
  }
  return widest ? (widest + chrome + 2) : 0; // +2px: margine anti-arrotondamenti
}
// true se le etichette ci stanno per intero alla larghezza ATTUALE della select.
function _bfSelectFitsFullLabels(sel, labels) {
  if (!sel || !sel.getBoundingClientRect) return true;
  const box = sel.getBoundingClientRect().width;
  if (!box) return true; // non ancora renderizzata: non abbreviare alla cieca
  const need = _bfSelectNeededWidth(sel, labels);
  return !need || need <= box;
}
// Rilievi 24+30 (v3, Ismail 2026-07-10): il TIPO variabile normalmente resta ESTESO
// e tradotto (Intero/Decimale/Stringa...) e si abbrevia (Int/Flo/Str) SOLO quando la
// sidebar si restringe sotto una certa soglia. Quando abbreviato, la colonna Tipo si
// restringe e cede spazio alla colonna Valore (classe .tab-narrow su #tabVariabili,
// vedi CSS), cosi' il campo valore + il pulsante elimina restano sempre visibili.
function _varTypeLabel(val, abbrev) {
  const key = { int: 'var_type_int', float: 'var_type_float', string: 'var_type_string', bool: 'var_type_bool', array: 'var_type_array' }[val];
  const full = (typeof i18nText === 'function' && i18nText(key)) || { int: 'Integer', float: 'Float', string: 'String', bool: 'Boolean', array: 'Array' }[val] || val;
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
  // WP-M4u: alla chiusura si ri-decide con la MISURA (vedi _bfSelectFitsFullLabels), non piu'
  // con la soglia di larghezza della sidebar: se la parola intera ci sta, resta intera.
  const collapse = function () {
    const labels = Array.prototype.map.call(sel.options, function (o) { return _varTypeLabel(o.value, false); });
    const narrow = !_bfSelectFitsFullLabels(sel, labels);
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _varTypeLabel(o.value, narrow); });
  };
  sel.addEventListener('mousedown', expand);
  sel.addEventListener('focus', expand);
  sel.addEventListener('change', collapse);
  sel.addEventListener('blur', collapse);
  // Ismail 2026-07-20: oltre ad abbreviare/espandere il testo del TIPO, il cambio tipo deve
  // anche far comparire/sparire la select true/false nel campo VALORE (_bfSyncValueControl
  // piu' sotto) -- un solo listener 'change' aggiuntivo sullo stesso <select>, protetto dalla
  // stessa guardia data-var-expand-bound quindi un solo bind per elemento.
  // WP-M2: idem per la seconda select del TIPO DEGLI ELEMENTI quando il tipo e' 'array'.
  // WP-M3: + campo dimensione ed espansore celle nella cella valore.
  sel.addEventListener('change', function () {
    if (typeof _bfSyncValueControl === 'function') _bfSyncValueControl(sel);
    if (typeof _bfSyncElemTypeControl === 'function') _bfSyncElemTypeControl(sel);
    if (typeof _bfSyncArrayValueControl === 'function') _bfSyncArrayValueControl(sel);
  });
}
function updateVarTypeOptions() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const sb = document.getElementById('sidebar');
  const tab = document.getElementById('tabVariabili');
  const narrow = (sb && sb.getBoundingClientRect) ? (sb.getBoundingClientRect().width < BF_VAR_NARROW_PX) : false;
  if (tab && tab.classList) tab.classList.toggle('tab-narrow', narrow);
  document.querySelectorAll('#tabVariabili select.inputVariable').forEach(function (sel) {
    // WP-M2: la select del TIPO DEGLI ELEMENTI (array) ha etichette proprie (gestite da
    // updateArrayElemOptions sotto) -- va saltata qui come la bool-value-select.
    if (sel.classList && sel.classList.contains('array-elem-select')) return;
    // Ismail 2026-07-20: la select true/false del campo VALORE (bool-value-select) condivide
    // la classe "inputVariable" con la select TIPO -- serve per ereditare lo STESSO tema/
    // dimensione CSS (#tabVariabili select.inputVariable in style.css), ma questo la fa
    // combaciare ANCHE con questo selettore, pensato solo per la select TIPO. Senza questo
    // controllo, attachVarTypeExpand() e _varTypeLabel() verrebbero applicati per errore alla
    // select valore: le sue opzioni true/false diventerebbero "t"/"f" (letterale abbreviato
    // alla cieca, nessuna chiave i18n per "true"/"bool") invece di Vero/Falso, e il listener
    // 'change' aggiunto da attachVarTypeExpand richiamerebbe _bfSyncValueControl passandogli
    // per sbaglio la select VALORE al posto della select TIPO, facendola ri-scambiare in un
    // <input> di testo ogni volta che l'utente sceglie true/false (bug riprodotto e verificato
    // con un harness DOM dedicato prima di questo fix).
    if (sel.classList && sel.classList.contains('bool-value-select')) return;
    // R12-A3: copre anche la riga TEMPLATE statica di index.html (gia' nel DOM al load,
    // mai passata da inserisciRiga) -- updateVarTypeOptions gira su window 'load' qui sotto.
    attachVarTypeExpand(sel);
    // WP-M4u: `narrow` (larghezza sidebar) decide solo la classe .tab-narrow, cioe' come il
    // CSS ripartisce le colonne. L'ABBREVIAZIONE del testo si decide invece misurando questa
    // select: e' l'unico modo per tenere la parola intera fin quando ci sta davvero.
    const _labels = Array.prototype.map.call(sel.options, function (o) { return _varTypeLabel(o.value, false); });
    const _abbrev = !_bfSelectFitsFullLabels(sel, _labels);
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _varTypeLabel(o.value, _abbrev); });
  });
  // WP-M4t: anche la select del TIPO ELEMENTI va ri-valutata qui. Prima veniva aggiornata
  // solo su 'resize' della finestra, quindi trascinando la maniglia della sidebar (che NON
  // emette resize) restava con l'etichetta della larghezza precedente.
  if (typeof updateArrayElemOptions === 'function') { try { updateArrayElemOptions(); } catch (e) {} }
  // WP-M4f: questa funzione gira anche DURANTE il drag della maniglia della sidebar
  // (init.js) -- e' quindi il punto giusto per tenere allineati i pannelli celle aperti,
  // che devono seguire la larghezza reale delle colonne mentre cambia.
  if (typeof _bfPlaceArrayCells === 'function' && document.querySelectorAll) {
    try { document.querySelectorAll('#tabVariabili tr.cells-open').forEach(function (r) { _bfPlaceArrayCells(r); }); } catch (e) {}
  }
}
if (typeof window !== 'undefined') {
  window.updateVarTypeOptions = updateVarTypeOptions;
  window.attachVarTypeExpand = attachVarTypeExpand;
  window.addEventListener('resize', function () { try { updateVarTypeOptions(); } catch (e) {} });
  window.addEventListener('load', function () { try { updateVarTypeOptions(); } catch (e) {} });
}

// ============================================================================
// Ismail 2026-07-20 (round successivo al tipo Boolean): quando il tipo di una riga e'
// "bool" il campo VALORE non deve piu' essere un input di testo libero (dove si scopre
// l'errore solo al commit, vedi var_err_bool) ma una <select> con le uniche due opzioni
// valide, true/false -- stessa idea gia' usata per il tipo variabile stesso (selectTipo).
// Il VALORE dell'<option> resta SEMPRE il letterale "true"/"false" (mai tradotto: e' quello
// che aggiungiVaribile legge e converte in un vero JS boolean); solo il TESTO mostrato e'
// localizzato (Vero/Falso, True/False, bool_true/bool_false in i18n.js) e si abbrevia alla
// prima lettera tradotta. Nessuna regola CSS nuova: la select eredita automaticamente la
// stessa dimensione/tema dell'input che sostituisce tramite le classi condivise
// (inputVariable, value-input -- vedi #tabVariabili select.inputVariable e .value-cell
// .value-input in style.css, gia' theme/dimension-aware per QUALSIASI tag).
//
// FIX (Ismail 2026-07-20, "deve diventare una lettera molto prima, non deve aspettare che si
// sovrapponga, dev'essere l'intera parola solo se c'e' spazio per tutto"): la PRIMA versione
// riusava lo stesso breakpoint della select TIPO (larghezza SIDEBAR < 260px) -- ma quel
// numero era tarato sulla cella TIPO, che contiene solo la select. La cella VALORE ha MENO
// margine a parita' di larghezza sidebar: ospita ANCHE la checkbox Assegna e il pulsante
// elimina, quindi il testo pieno si tagliava/sovrapponeva GIA' ben prima che la sidebar
// scendesse sotto 260px. Fix: non si usa piu' un proxy indiretto (larghezza sidebar) ma lo
// spazio REALMENTE disponibile per QUESTA select -- larghezza della cella meno le larghezze
// REALI (misurate, non stimate) dei fratelli (checkbox + pulsante elimina) meno un margine
// per i gap flex. La soglia (BOOL_FULL_WORD_MIN_PX) e' volutamente abbondante (spazio per la
// parola piu' lunga fra le 4 lingue, il padding/bordo/freccina nativi della <select>, PIU' un
// margine di sicurezza) cosi' si abbrevia MOLTO PRIMA di un vero sovrapporsi/tagliarsi, mai
// "appena in tempo" -- e torna alla parola intera SOLO quando c'e' davvero spazio per tutto.
var BOOL_FULL_WORD_MIN_PX = 92;
function _bfBoolSelectAvailableWidth(sel) {
  const wrap = sel && sel.closest ? sel.closest('.value-cell') : null;
  if (!wrap || !wrap.getBoundingClientRect) return Infinity; // nessuna misura possibile: non abbreviare alla cieca
  const total = wrap.getBoundingClientRect().width;
  if (!total) return Infinity; // cella non ancora renderizzata (width 0): non decidere sul nulla
  let used = 0;
  Array.prototype.forEach.call(wrap.children, function (child) {
    if (child === sel) return; // la select stessa non si sottrae a se stessa
    const r = child.getBoundingClientRect ? child.getBoundingClientRect() : null;
    used += (r ? r.width : (child.offsetWidth || 0));
  });
  used += 10; // margine per i gap flex fra i 3 elementi della cella (checkbox/select/elimina)
  return Math.max(0, total - used);
}
function _bfBoolShouldAbbreviate(sel) {
  return _bfBoolSelectAvailableWidth(sel) < BOOL_FULL_WORD_MIN_PX;
}
function _boolValueLabel(val, abbrev) {
  const key = (val === 'true') ? 'bool_true' : 'bool_false';
  const full = (typeof i18nText === 'function' && i18nText(key)) || (val === 'true' ? 'True' : 'False');
  if (!abbrev) return full;
  // Prima lettera della label TRADOTTA (Array.from invece di charAt/[0]: al sicuro anche se
  // la label iniziasse con un carattere fuori dal BMP, coppia surrogata).
  const ch = Array.from(full)[0];
  return ch || full;
}
function attachBoolValueExpand(sel) {
  if (!sel || !sel.getAttribute || sel.getAttribute('data-bool-expand-bound') === '1') return;
  sel.setAttribute('data-bool-expand-bound', '1');
  const expand = function () {
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _boolValueLabel(o.value, false); });
  };
  const collapse = function () {
    const abbrev = _bfBoolShouldAbbreviate(sel);
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _boolValueLabel(o.value, abbrev); });
  };
  sel.addEventListener('mousedown', expand);
  sel.addEventListener('focus', expand);
  sel.addEventListener('change', collapse);
  sel.addEventListener('blur', collapse);
}
function updateBoolValueOptions() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  document.querySelectorAll('#tabVariabili select.bool-value-select').forEach(function (sel) {
    attachBoolValueExpand(sel);
    const abbrev = _bfBoolShouldAbbreviate(sel);
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = _boolValueLabel(o.value, abbrev); });
  });
}
// Crea la <select> true/false per il campo valore di una riga bool -- stesse classi
// (inputVariable, value-input) dell'input di testo che sostituisce, cosi' eredita IDENTICA
// dimensione/tema dal CSS esistente senza nessuna regola nuova.
function _bfCreateBoolValueSelect() {
  const sel = document.createElement('select');
  sel.classList.add('inputVariable', 'value-input', 'bool-value-select');
  ['true', 'false'].forEach(function (v) {
    const o = document.createElement('option');
    o.value = v;
    sel.appendChild(o);
  });
  return sel;
}
// Tenuto in sync col select TIPO della riga (change, agganciato da attachVarTypeExpand): se
// il tipo diventa "bool" il campo valore si trasforma in select true/false; se torna a un
// altro tipo ridiventa un normale input di testo (il valore testuale precedente resta,
// come gia' avviene passando fra int/float/string -- si ri-valida al prossimo commit).
// Gira PRIMA che l'evento 'change' risalga fino alla riga (dove e' agganciato
// aggiungiVaribile) perche' e' collegato direttamente sul <select> tipo: la fase "at
// target" si esaurisce prima che l'evento risalga in bubbling, quindi aggiungiVaribile
// legge sempre il controllo valore GIA' aggiornato -- nessuna corsa fra i due listener.
function _bfSyncValueControl(selectTipo) {
  const tr = selectTipo && selectTipo.closest ? selectTipo.closest('tr') : null;
  if (!tr) return;
  const wrap = tr.cells[2] ? tr.cells[2].querySelector('.value-cell') : null;
  if (!wrap) return;
  const oldField = wrap.querySelector('.value-input');
  if (!oldField) return;
  const wantBool = (selectTipo.value === 'bool');
  const isSelect = (oldField.tagName === 'SELECT');
  if (wantBool === isSelect) {
    if (wantBool) updateBoolValueOptions(); // riallinea le etichette (es. cambio lingua nel frattempo)
    return;
  }
  const wasDisabled = oldField.disabled;
  let newField;
  if (wantBool) {
    newField = _bfCreateBoolValueSelect();
    const prev = String(oldField.value || '').trim().toLowerCase();
    newField.value = (prev === 'true' || prev === 'false') ? prev : 'true';
  } else {
    newField = document.createElement('input');
    newField.type = 'text';
    newField.classList.add('inputVariable', 'value-input');
    newField.value = oldField.value || '';
  }
  newField.disabled = wasDisabled;
  wrap.replaceChild(newField, oldField);
  if (wantBool) updateBoolValueOptions();
}
if (typeof window !== 'undefined') {
  window._boolValueLabel = _boolValueLabel;
  window.attachBoolValueExpand = attachBoolValueExpand;
  window.updateBoolValueOptions = updateBoolValueOptions;
  window._bfCreateBoolValueSelect = _bfCreateBoolValueSelect;
  window._bfSyncValueControl = _bfSyncValueControl;
  window._bfBoolSelectAvailableWidth = _bfBoolSelectAvailableWidth;
  window._bfBoolShouldAbbreviate = _bfBoolShouldAbbreviate;
  // Ismail 2026-07-20: stesso motivo di updateVarTypeOptions() sopra -- resize/drag della
  // sidebar deve riabbreviare/riespandere ANCHE le option Vero/Falso gia' presenti nelle
  // righe bool esistenti (non solo quella appena creata da _bfSyncValueControl).
  window.addEventListener('resize', function () { try { updateBoolValueOptions(); } catch (e) {} });
  window.addEventListener('load', function () { try { updateBoolValueOptions(); } catch (e) {} });
}

// ============================================================================
// WP-M2 (Ismail 2026-07-20): tipo ARRAY nella tabella variabili -- "prima chiediamo se
// array, poi eventualmente il tipo di array". Quando la select TIPO vale 'array', nella
// stessa cella compare una SECONDA select (.array-elem-select) col tipo degli elementi
// (int/float/string/bool, etichette localizzate via _varTypeLabel, abbreviate in modalita'
// narrow come la select tipo). Il tipo composto 'array:<elem>' viene ricomposto da
// aggiungiVaribile alla validazione. Stesse classi CSS della select tipo (inputVariable)
// per ereditare tema/dimensioni; skip esplicito in updateVarTypeOptions (vedi sopra).
// ============================================================================
function _bfCreateArrayElemSelect() {
  const sel = document.createElement('select');
  sel.classList.add('inputVariable', 'array-elem-select');
  // WP-M4n (Ismail 2026-07-21, "array non deve essere considerato valido come variabile
  // finche' non metti anche la dimensione e il tipo dell'array"): la prima voce e' un
  // SEGNAPOSTO vuoto, selezionato di default. Prima la select nasceva gia' su "int" e la
  // variabile risultava valida senza che l'utente avesse scelto nulla -- un default
  // silenzioso proprio dove serve una scelta esplicita. Con value="" la validazione
  // (aggiungiVaribile) rifiuta la riga finche' non si sceglie davvero.
  const ph = document.createElement('option');
  ph.value = '';
  ph.setAttribute('data-ac-ph', '1');
  sel.appendChild(ph);
  ['int', 'float', 'string', 'bool'].forEach(function (v) {
    const o = document.createElement('option');
    o.value = v;
    sel.appendChild(o);
  });
  sel.value = '';
  return sel;
}
// WP-M4t (Ismail 2026-07-21, "quando metti piccola la barra variabili devi fare in modo che
// come sopra, quando non ci sta piu' Integer ecc, diventi i o f, e la lettera iniziale nella
// varia lingua come sopra"): la select del tipo ELEMENTI mostrava "S..." invece di "S".
// Causa: si abbreviava solo con sidebar < 260px, ma il floor della sidebar e' salito a 290px
// (WP-M4s) -- quella condizione non era piu' raggiungibile e l'abbreviazione non scattava MAI.
// Invece di rincorrere la soglia si adotta la stessa tecnica gia' usata per la select bool
// (_bfBoolSelectAvailableWidth): si misura lo spazio REALMENTE disponibile per QUESTA select
// dentro .array-dims -- larghezza del contenitore meno le larghezze reali dei fratelli
// ("×" e campo dimensione) e dei gap. Cosi' e' corretta a qualunque larghezza, con qualunque
// numero di cifre nella dimensione e in qualunque lingua.
// WP-M4u: ELEM_FULL_WORD_MIN_PX (soglia fissa in px) e' stato rimosso -- vedi
// _bfSelectFitsFullLabels: si misura il testo vero contro la larghezza vera.
// WP-M4u: al CLICK la select degli elementi deve mostrare le voci PER ESTESO anche se a menu
// chiuso e' abbreviata ("i", "f"...). Una <select> nativa disegna il menu aperto con il
// textContent delle <option>, quindi basta riscriverle per intero appena l'utente la apre
// (mousedown/focus) e ri-decidere alla chiusura (change/blur). E' la stessa tecnica gia' in
// uso per la select del TIPO (attachVarTypeExpand), che pero' non si poteva riusare tale e
// quale: qui c'e' anche il segnaposto (value="") con un'etichetta propria.
function attachElemTypeExpand(sel) {
  if (!sel || !sel.getAttribute || sel.getAttribute('data-elem-expand-bound') === '1') return;
  sel.setAttribute('data-elem-expand-bound', '1');
  const expand = function () {
    const ph = (typeof i18nText === 'function' && i18nText('var_type_choose')) || 'Tipo…';
    Array.prototype.forEach.call(sel.options, function (o) {
      o.textContent = (o.value === '') ? ph : _varTypeLabel(o.value, false);
    });
  };
  sel.addEventListener('mousedown', expand);
  sel.addEventListener('focus', expand);
  sel.addEventListener('change', function () { try { updateArrayElemOptions(); } catch (e) {} });
  sel.addEventListener('blur', function () { try { updateArrayElemOptions(); } catch (e) {} });
}
function updateArrayElemOptions() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const phLabel = (typeof i18nText === 'function' && i18nText('var_type_choose')) || 'Tipo…';
  document.querySelectorAll('#tabVariabili select.array-elem-select').forEach(function (sel) {
    attachElemTypeExpand(sel);
    // WP-M4u: il segnaposto entra nella misura come le altre voci -- se "Tipo…" non ci sta,
    // non ci sta, e va abbreviato insieme al resto.
    const _full = Array.prototype.map.call(sel.options, function (o) {
      return (o.value === '') ? phLabel : _varTypeLabel(o.value, false);
    });
    // WP-M4x (Ismail 2026-07-21, "quando abbiamo abbastanza spazio per il tipo piu' lungo per
    // esteso, non ingrandire piu' quello con l'allargarsi della colonna ma allargare piuttosto
    // il form dell'input"): la select aveva `flex: 1 1 0`, cioe' si prendeva TUTTO lo spazio
    // che avanzava nella riga -- allargando la sidebar cresceva lei e il campo dimensione
    // restava piccolo, anche quando la select era gia' larga il doppio del necessario.
    // Qui le si assegna come base la larghezza che le serve DAVVERO (parola piu' lunga fra le
    // opzioni, misurata) e le si toglie la capacita' di crescere (flex-grow 0): da quel punto
    // in poi tutto lo spazio in piu' va al campo dimensione, che nel CSS e' l'unico che cresce.
    // Resta invece comprimibile (flex-shrink 1): quando lo spazio manca si stringe e le
    // etichette si abbreviano da sole, come prima.
    const _need = _bfSelectNeededWidth(sel, _full);
    if (_need > 0) { sel.style.flexGrow = '0'; sel.style.flexBasis = Math.ceil(_need) + 'px'; }
    // La decisione "parola intera o prima lettera" si prende DOPO aver applicato la base:
    // e' la larghezza risultante (che il flex puo' aver ridotto) a dire cosa ci sta davvero.
    const narrow = !_bfSelectFitsFullLabels(sel, _full);
    Array.prototype.forEach.call(sel.options, function (o) {
      // WP-M4n: il segnaposto ha un'etichetta propria ("Tipo…"), non va passato a
      // _varTypeLabel (che con value="" restituirebbe la stringa vuota).
      // WP-M4t: da stretto anche il segnaposto si riduce -- resta il solo "…", che e' gia'
      // il segnale "devi ancora scegliere" e non ha bisogno di spazio.
      o.textContent = (o.value === '') ? (narrow ? '…' : phLabel) : _varTypeLabel(o.value, narrow);
    });
  });
}
// ============================================================================
// WP-M3 (Ismail 2026-07-20, screenshot stile Flowgorithm "Real[12] -> celle 0..11"):
// controlli DIMENSIONE + griglia CELLE per le righe array.
// - Nella cella VALORE compaiono: [checkbox Assegna][dimensione][valore uniforme][▾][x]
//   -- l'ordine racconta la dichiarazione: "quante celle" e "con quale valore".
// - Il pulsante ▾ espande una GRIGLIA indice->valore DENTRO la stessa cella (mai una
//   riga <tr> aggiuntiva: gli indici di riga della tabella sono il mapping 1:1 con
//   flow.variables usato da aggiungiVaribile/refreshVariablesWatch -- una riga extra
//   persistente li falserebbe tutti; il layout a 3 colonne resta intatto, la riga
//   cresce solo in altezza).
// - Durante l'esecuzione refreshVariablesWatch (execute.js) aggiorna la griglia cella
//   per cella (classe .live), cosi' si vede il valore RUNTIME di ogni posizione.
// ============================================================================
// WP-M4s (Ismail 2026-07-21, "non devi mettere .... quando ci sono tante celle, continua
// piuttosto a farle scorrere fino alla fine"): il pannello e' gia' scrollabile, quindi il
// troncamento a 200 con la cella "…" era una limitazione inutile -- si scorre fino in fondo.
// Resta un tetto MOLTO alto come rete di sicurezza: ogni cella e' un nodo DOM, e un array
// generato per errore con centinaia di migliaia di elementi bloccherebbe la pagina mentre
// la si sta usando (il pannello si ridisegna ad OGNI passo dell'esecuzione, non una volta).
var BF_ARRAY_CELLS_MAX_SHOWN = 5000;
// WP-M4h (2026-07-21): escapate ANCHE le virgolette. Prima bastavano &/</> perche' il
// valore finiva solo come TESTO fra due tag; da questo giro va anche dentro un ATTRIBUTO
// (title="..." sulla cella), dove un valore contenente " chiuderebbe l'attributo e
// permetterebbe di iniettarne altri (es. onmouseover=...). Escapare entrambe le virgolette
// rende la funzione sicura in tutti e due i contesti, che e' il modo giusto di tenerla.
function _bfEscapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// WP-M5i: ridipinge SOLO le celle il cui testo e' cambiato rispetto all'ultima volta.
// Il confronto avviene contro `grid._bfShown` (vettore di stringhe tenuto in memoria) e non
// leggendo il DOM: in un ciclo che tocca una cella per volta questo significa UNA scrittura
// per passo invece di mille letture.
function _bfPaintArrayCells(grid, values, uninit, shown) {
  const cells = grid.children;
  let prev = grid._bfShown;
  if (!prev || prev.length !== shown) { prev = new Array(shown); grid._bfShown = prev; }
  for (let i = 0; i < shown; i++) {
    const v = uninit ? '' : String(values[i]);
    if (prev[i] === v) continue;
    const c = cells[i];
    if (!c || !c.lastChild) break;
    c.lastChild.textContent = v;
    c.title = v;
    prev[i] = v;
  }
}
// WP-M5w: forza SUBITO le ripitture rimaste in sospeso. Durante l'esecuzione i pannelli celle
// si ridipingono al massimo una volta per frame (coalescenza, WP-M5i): a fine run puo' restare
// un'ultima ripittura in coda che non verrebbe mai eseguita -- il pannello mostrerebbe lo stato
// di qualche passo prima, non quello finale.
function _bfFlushArrayCellsNow() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  try {
    document.querySelectorAll('#tabVariabili .array-cells').forEach(function (g) {
      if (g._bfRaf) {
        try { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(g._bfRaf); } catch (e) {}
        try { clearTimeout(g._bfRaf); } catch (e) {}
        g._bfRaf = 0;
      }
      const p = g._bfNext;
      if (p) { _bfPaintArrayCells(g, p.values, p.uninit, p.shown); g._bfNext = null; }
    });
  } catch (e) {}
}
if (typeof window !== 'undefined') window._bfFlushArrayCellsNow = _bfFlushArrayCellsNow;
// Costruisce/aggiorna (o rimuove, values===null) la griglia celle della riga `tr`.
// `live` = valori runtime (classe .live); `uninit` = celle dichiarate senza valore (vuote).
// WP-M4 (mockup di Ismail): il contatore celle vive nell'espansore "▾ celle [n]" della
// cella valore; la dimensione editabile sta invece nella colonna TIPO (".array-dims").
function _bfRenderArrayCells(tr, values, live, uninit) {
  if (!tr || !tr.cells || !tr.cells[2]) return;
  const cell = tr.cells[2];
  let grid = cell.querySelector('.array-cells');
  if (values === null || values === undefined) { if (grid) grid.remove(); return; }
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'array-cells';
    grid.hidden = true; // parte chiusa: si apre col pulsante ▾
    cell.appendChild(grid);
  }
  if (grid.classList) grid.classList.toggle('live', !!live);
  const n = values.length;
  // Il contatore sul pulsante ("celle [n]") si aggiorna SEMPRE: e' l'unica informazione
  // visibile quando il pannello e' chiuso, e costa un solo textContent.
  { const _e = cell.querySelector('.array-expand'); if (_e) { const c = _e.querySelector('.ae-n'); if (c) c.textContent = String(n); } }
  // WP-M5c (Ismail 2026-07-21, "questo programma è crashato" -- for 0..1000 che scrive in un
  // array da 1000 celle): questa funzione viene richiamata da refreshVariablesWatch a OGNI
  // PASSO dell'esecuzione, e ricostruiva ogni volta l'intero innerHTML del pannello. Con 1000
  // celle e 1000 iterazioni sono un milione di nodi DOM creati e distrutti, piu' un reflow
  // forzato per giro (_bfPlaceArrayCells): la pagina si blocca. E' una regressione introdotta
  // da WP-M4s alzando il tetto da 200 a 5000 celle -- a 200 il costo era 25 volte minore e
  // non si notava. Due difese, nell'ordine in cui conviene:
  //   1. pannello CHIUSO -> zero lavoro sul DOM. I valori si parcheggiano e si disegnano solo
  //      all'apertura (vedi il click sull'espansore). E' il caso piu' comune di gran lunga.
  //   2. pannello APERTO -> aggiornamento INCREMENTALE: se la struttura non e' cambiata
  //      (stesso numero di celle) si riscrive solo il testo cambiato, senza toccare i nodi.
  // WP-M5m (Ismail 2026-07-21, "al cambio del valore di una variabile array il popup si deve
  // aprire per mostrare i valori anche se chiuso"): durante l'esecuzione (live) un array che
  // cambia apre da solo il suo pannello -- altrimenti l'unica cosa visibile sarebbe il
  // contatore "celle [n]", che non dice nulla su cosa sta succedendo.
  // Con UN limite: se l'utente lo richiude a mano, resta chiuso (flag _bfUserClosed, azzerato
  // all'avvio di ogni esecuzione). Riaprirlo ad ogni cella scritta significherebbe litigare
  // con chi lo ha appena chiuso, e in un ciclo lungo sarebbe anche costoso.
  if (grid.hidden && live && !grid._bfUserClosed) {
    const _exp = cell.querySelector('.array-expand');
    grid.hidden = false;
    if (_exp) { const _c = _exp.querySelector('.ae-caret'); if (_c) _c.textContent = '▴'; }
    if (tr.classList) tr.classList.add('cells-open');
    grid._bfLen = -1; // struttura mai disegnata: ricostruzione completa
    if (typeof _bfPlaceArrayCells === 'function') { try { _bfPlaceArrayCells(tr); } catch (e) {} }
  }
  if (grid.hidden) { grid._bfPending = { values: values, uninit: !!uninit }; return; }
  grid._bfPending = null;
  const shown = Math.min(n, BF_ARRAY_CELLS_MAX_SHOWN);
  // WP-M4i (Ismail 2026-07-21, "fai in modo che gli index occupino tutti la stessa larghezza,
  // 1 o 2 o 3 cifre"): la colonna degli indici ha una larghezza UNICA per tutto il pannello,
  // pari al numero di cifre dell'indice piu' grande (999 -> 3). Senza, ogni cella dimensionava
  // il proprio indice sul contenuto e i valori risultavano disallineati fra le righe.
  // L'unita' `ch` e' la larghezza di uno zero nel font corrente: e' esattamente la misura
  // giusta per contare cifre, e resta corretta se il font della tabella scala con la sidebar.
  const digits = String(Math.max(0, n - 1)).length;
  grid.style.setProperty('--ac-idx-w', digits + 'ch');
  // WP-M5c, difesa 2: aggiornamento incrementale. La struttura (numero e ordine delle celle)
  // dipende SOLO dalla lunghezza dell'array; se non e' cambiata, i nodi esistenti vanno bene
  // e basta riscrivere i testi diversi da quelli gia' a schermo. Durante un'esecuzione la
  // lunghezza e' fissa (un array si ridimensiona solo riassegnandolo intero), quindi questo
  // e' il ramo che si prende praticamente sempre: da O(n) nodi ricreati a O(celle cambiate)
  // assegnazioni di testo. Non si chiama nemmeno _bfPlaceArrayCells, perche' senza cambi di
  // struttura le colonne non possono essersi spostate.
  if (grid._bfLen === n && grid.children.length) {
    // WP-M5i: due accorgimenti che tolgono il grosso del costo residuo.
    //   (a) OMBRA in memoria (grid._bfShown): si confronta col vettore di stringhe gia'
    //       mostrate invece di LEGGERE textContent da 1000 nodi. Leggere dal DOM e' l'unica
    //       parte davvero cara qui; il confronto fra stringhe JS non costa quasi nulla.
    //   (b) COALESCENZA per frame durante l'esecuzione (live): a velocita' "Istantanea" il
    //       motore fa molti passi per frame, e ridipingere ad ogni passo e' lavoro buttato --
    //       l'occhio vede comunque un solo fotogramma. Si tiene l'ultimo valore e si dipinge
    //       una volta per frame. Fuori esecuzione si dipinge subito (nessun frame da attendere).
    if (live) {
      grid._bfNext = { values: values, uninit: !!uninit, shown: shown };
      if (!grid._bfRaf) {
        const _raf = (typeof window !== 'undefined' && window.requestAnimationFrame)
          ? window.requestAnimationFrame.bind(window)
          : function (fn) { return setTimeout(fn, 16); };
        grid._bfRaf = _raf(function () {
          grid._bfRaf = 0;
          const p = grid._bfNext;
          if (p) _bfPaintArrayCells(grid, p.values, p.uninit, p.shown);
        });
      }
      return;
    }
    _bfPaintArrayCells(grid, values, uninit, shown);
    return;
  }
  grid._bfLen = n;
  grid._bfShown = null; // struttura cambiata: l'ombra non e' piu' confrontabile
  // WP-M5i: `html` si dichiara QUI, dove inizia davvero la costruzione. Nella versione
  // precedente stava piu' in alto, dentro un blocco poi riscritto da WP-M5c: la dichiarazione
  // si e' persa e la funzione lanciava "html is not defined" ad ogni ricostruzione -- il
  // pannello restava vuoto (il sintomo segnalato da Ismail). `node --check` non poteva
  // accorgersene: e' un errore di RUNTIME, non di sintassi. Da qui il test con jsdom.
  let html = '';
  // WP-M4h (Ismail 2026-07-21): ogni cella e' ORA un contenitore unico (.ac-cell) con dentro
  // indice e valore, non piu' due <span> sciolti nella griglia. Serve per due cose che con
  // gli span separati non erano possibili: (a) allineare ESATTAMENTE ogni cella a una delle
  // 3 colonne della tabella (una colonna grid = una cella, larghezza presa dalle <td> vere);
  // (b) il doppio click che "ingrandisce" UNA cella a tutta riga (grid-column: 1/-1), che
  // richiede un singolo elemento da far crescere. I separatori diventano anche piu' semplici:
  // con 3 colonne fisse il primo di ogni riga e' sempre nth-child(3n+1).
  for (let i = 0; i < shown; i++) {
    const v = uninit ? '' : values[i];
    html += '<div class="ac-cell" tabindex="0" title="' + _bfEscapeHtml(v) + '">' +
              '<span class="ac-i">' + i + '</span>' +
              '<span class="ac-v">' + _bfEscapeHtml(v) + '</span>' +
            '</div>';
  }
  let rendered = shown;
  if (n > shown) {
    html += '<div class="ac-cell ac-more"><span class="ac-i">…</span><span class="ac-v">+' + (n - shown) + '</span></div>';
    rendered += 1;
  }
  if (!n) { html = '<div class="ac-cell ac-empty"><span class="ac-dash">–</span></div>'; rendered = 1; }
  // WP-M4m (Ismail 2026-07-21, "se uno ha una sola cella nell'array o 2, le altre celle della
  // riga devono avere scritto in mezzo un -, non lasciarle vuote"): si completa l'ULTIMA riga
  // con celle segnaposto fino al multiplo di 3. Sono celle vere (.ac-cell), quindi ereditano
  // bordi e divisori come le altre: la griglia resta un rettangolo pieno invece di finire a
  // gradino, e la formula nth-child(3n+1) dei separatori continua a valere.
  const missing = (3 - (rendered % 3)) % 3;
  for (let k = 0; k < missing; k++) html += '<div class="ac-cell ac-pad"><span class="ac-dash">–</span></div>';
  grid.innerHTML = html;
  // WP-M5i: allinea l'ombra a cio' che e' appena stato disegnato, altrimenti il primo
  // aggiornamento incrementale successivo riscriverebbe tutte le celle (ombra vuota).
  { const _sh = new Array(shown); for (let i = 0; i < shown; i++) _sh[i] = uninit ? '' : String(values[i]); grid._bfShown = _sh; }
  // WP-M4s: se il pannello e' APERTO si ri-misurano le colonne. Serve perche' durante
  // l'esecuzione l'array puo' CRESCERE fino a far comparire la scrollbar verticale: da quel
  // momento l'ultima colonna e' piu' stretta di quanto calcolato, e senza questa chiamata
  // resterebbe disallineata fino al primo resize della finestra.
  if (!grid.hidden && typeof _bfPlaceArrayCells === 'function') { try { _bfPlaceArrayCells(tr); } catch (e) {} }
}
// WP-M4 (mockup di Ismail, screenshot 2026-07-20 sera): nella cella VALORE l'unica
// aggiunta per gli array e' l'ESPANSORE "▾ celle [n]" -- una riga a se' A TUTTA LARGHEZZA
// sotto la riga checkbox/valore/x (flex-basis 100% via CSS .array-expand). La riga base
// checkbox+valore+x resta IDENTICA a quella degli scalari (la regressione del layout
// default segnalata da Ismail veniva dal flex-wrap messo su TUTTE le .value-cell: ora il
// wrap e' solo sulla variante .value-cell-array). La dimensione NON sta piu' qui: vive
// nella colonna TIPO accanto al tipo elementi ("Intero ▼ × 3", _bfSyncElemTypeControl).
function _bfSyncArrayValueControl(selectTipo) {
  const tr = selectTipo && selectTipo.closest ? selectTipo.closest('tr') : null;
  if (!tr || !tr.cells || !tr.cells[2]) return;
  const wrap = tr.cells[2].querySelector('.value-cell');
  if (!wrap) return;
  let exp = wrap.querySelector('.array-expand');
  const want = (selectTipo.value === 'array');
  if (want && !exp) {
    wrap.classList.add('value-cell-array');
    exp = document.createElement('button');
    exp.type = 'button';
    exp.className = 'array-expand';
    const _lbl = (typeof i18nText === 'function' && i18nText('var_cells')) || 'celle';
    // data-i18n sull'etichetta: applyLanguage (i18n.js) la ri-traduce al cambio lingua
    // senza toccare caret/conteggio, che vivono in <span> fratelli.
    exp.innerHTML = '<span class="ae-caret">▾</span> <span class="ae-lbl" data-i18n="var_cells">' + _lbl + '</span> [<span class="ae-n">0</span>]';
    exp.setAttribute('data-i18n-title', 'tip_array_cells');
    exp.title = (typeof i18nText === 'function' && i18nText('tip_array_cells')) || 'Mostra/nascondi le celle';
    exp.addEventListener('click', function () {
      const grid = tr.cells[2].querySelector('.array-cells');
      if (!grid) return;
      grid.hidden = !grid.hidden;
      // WP-M5m: chiusura MANUALE -- da qui in poi l'apertura automatica (array che cambia
      // durante l'esecuzione) non riapre piu' questo pannello, fino alla prossima run.
      grid._bfUserClosed = grid.hidden;
      const caret = exp.querySelector('.ae-caret');
      if (caret) caret.textContent = grid.hidden ? '▾' : '▴';
      // WP-M5c: da chiuso il pannello non viene piu' aggiornato (costava un milione di nodi
      // DOM in un ciclo lungo, vedi _bfRenderArrayCells): i valori restano parcheggiati in
      // grid._bfPending. All'apertura vanno disegnati subito, altrimenti si vedrebbe lo stato
      // di quando e' stato chiuso -- o niente del tutto se non e' mai stato aperto.
      if (!grid.hidden && grid._bfPending) {
        const _p = grid._bfPending;
        grid._bfLen = -1; // forza la ricostruzione completa, non l'aggiornamento incrementale
        _bfRenderArrayCells(tr, _p.values, grid.classList && grid.classList.contains('live'), _p.uninit);
      }
      // WP-M4f (Ismail 2026-07-21): da aperto il pannello si estende SOTTO tutte e tre le
      // colonne, restando agganciato al pulsante "celle" (vedi _bfPlaceArrayCells).
      _bfPlaceArrayCells(tr);
    });
    wrap.appendChild(exp); // ultimo figlio: con .value-cell-array (wrap) va su una riga sua
  } else if (!want && exp) {
    exp.remove();
    wrap.classList.remove('value-cell-array');
    _bfRenderArrayCells(tr, null);
  }
}
// WP-M4f (Ismail 2026-07-21, schizzo): il pannello delle celle, quando e' APERTO, deve
// leggersi come un riquadro unico appeso al pulsante "celle [n]" ma LARGO QUANTO TUTTA LA
// RIGA (quindi anche sotto NOME e TIPO), non confinato nella terza colonna.
// Come: il pannello resta nel FLUSSO dentro la sua <td> -- cosi' allunga la riga invece di
// coprire quelle sotto (una position:absolute avrebbe richiesto di riservare l'altezza a
// mano, e sbaglierebbe ad ogni cambio di dimensione) -- e lo si "sfonda" verso sinistra con
// un margine negativo pari alla distanza fra il bordo interno della tabella e la sua cella,
// piu' una larghezza pari a quella dell'intera tabella. I due numeri si misurano a runtime
// (le colonne sono elastiche: nessun valore fisso reggerebbe al resize della sidebar) e si
// ricalcolano ad ogni apertura e ad ogni ridimensionamento.
// La classe .cells-open sulla riga toglie il clipping orizzontale dalle celle SOLO per
// quella riga (WP-M4c aveva messo overflow-x:clip su tutte le td per evitare sbordamenti).
function _bfPlaceArrayCells(tr) {
  if (!tr || !tr.cells || !tr.cells[2]) return;
  const grid = tr.cells[2].querySelector('.array-cells');
  const tab = document.getElementById('tabVariabili');
  if (!grid || !tab || !tab.getBoundingClientRect) return;
  const open = !grid.hidden;
  if (tr.classList) tr.classList.toggle('cells-open', open);
  if (!open) { grid.style.marginInlineStart = ''; grid.style.width = ''; return; }
  const tabR = tab.getBoundingClientRect();
  const cellR = tr.cells[2].getBoundingClientRect();
  if (!tabR.width || !cellR.width) return;
  const rtl = (typeof document !== 'undefined' && document.documentElement && document.documentElement.dir === 'rtl');
  // WP-M4p (Ismail 2026-07-21, screenshot con le linee di allineamento): il riferimento NON
  // e' il bordo esterno della tabella ma il suo CONTENT BOX. La tabella ha un bordo proprio
  // (1px per lato) e le sue colonne sono 33.333% del content box: allineare il pannello al
  // bordo esterno lo rendeva 2px piu' largo, e la differenza si accumulava sulle colonne
  // (i divisori del pannello cadevano leggermente spostati rispetto a quelli sopra).
  let bl = 0, br = 0;
  try {
    const cs = getComputedStyle(tab);
    bl = parseFloat(cs.borderLeftWidth) || 0;
    br = parseFloat(cs.borderRightWidth) || 0;
  } catch (e) {}
  const innerLeft = tabR.left + bl;
  const innerRight = tabR.right - br;
  const innerW = innerRight - innerLeft;
  // Distanza dal bordo INTERNO iniziale della tabella al bordo iniziale della cella valore
  // (in RTL "iniziale" e' destra: si misura dal lato opposto, cosi' vale per entrambe).
  const shift = rtl ? (innerRight - cellR.right) : (cellR.left - innerLeft);
  // WP-M4q (Ismail 2026-07-21, screenshot con le linee tracciate a mano sui divisori):
  // il pannello e' figlio della <td>, quindi il suo margine parte dal CONTENT BOX della
  // cella, non dal suo bordo. La <td> ha `padding: 0.22rem` (~3.5px per lato): con il solo
  // `-shift` il pannello nasceva 3.5px PIU' A DESTRA del bordo interno della tabella e
  // finiva 3.5px oltre a destra -- tutti e tre i divisori della griglia cadevano fuori
  // asse rispetto a quelli della tabella sopra, ed e' esattamente il difetto segnalato.
  // Il padding si MISURA (cambia con la media query stretta a 0.2rem, e con il tema):
  // qualsiasi costante si sfaserebbe di nuovo al primo restringimento della sidebar.
  let padStart = 0;
  try {
    const cs2 = getComputedStyle(tr.cells[2]);
    padStart = parseFloat(rtl ? cs2.paddingRight : cs2.paddingLeft) || 0;
  } catch (e) {}
  // WP-M4r (Ismail 2026-07-21, "avevo arrotondato i bordi a destra e fatto leggermente piu'
  // piccolo a sinistra e a destra, cosi' sembrava un popup e non parte della tabella"):
  // il pannello NON arriva ai bordi della tabella ma rientra di --ac-inset per lato. Il
  // valore si legge dal CSS (`.array-cells { --ac-inset }`), cosi' l'estetica resta nel
  // foglio di stile e qui c'e' solo la matematica.
  let inset = 0;
  try { inset = parseFloat(getComputedStyle(grid).getPropertyValue('--ac-inset')) || 0; } catch (e) {}
  grid.style.marginInlineStart = '-' + Math.round(shift + padStart - inset) + 'px';
  grid.style.width = Math.round(innerW - 2 * inset) + 'px'; // provvisoria: raffinata sotto con la scrollbar
  // WP-M4h (Ismail 2026-07-21, "falle sempre su 3 colonne che siano allineate con le colonne
  // tracciate"): le colonne del pannello sono SEMPRE 3 e larghe ESATTAMENTE quanto le tre
  // colonne della tabella (NOME / TIPO / VALORE), cosi' i divisori del pannello cadono in
  // continuita' con quelli della tabella sopra. Le larghezze si misurano dalle <td> reali,
  // non si stimano: le colonne sono elastiche e cambiano col resize della sidebar.
  // L'ordine di riempimento resta per RIGHE (0,1,2 sulla prima riga; 3,4,5 sulla seconda):
  // e' il flusso naturale della grid, reso esplicito da grid-auto-flow: row nel CSS.
  // WP-M4s (Ismail 2026-07-21, "le righe di ogni colonna risultano ancora disallineate dalle
  // colonne -- falle allineare anche se so che quella centrale risulterebbe leggermente piu'
  // larga, va bene"): tre colonne `1fr` NON possono cadere sui divisori della tabella, perche'
  // il pannello e' rientrato di --ac-inset per lato: dividendo in tre parti uguali uno spazio
  // piu' stretto, i due divisori interni finiscono per forza spostati verso il centro.
  // La soluzione e' esattamente quella che Ismail ha anticipato: le colonne NON sono piu'
  // uguali fra loro. Si misurano i divisori REALI della tabella (il bordo iniziale delle <td>
  // TIPO e VALORE) e si assegnano larghezze esplicite, in px:
  //   - la prima colonna perde il rientro a sinistra,
  //   - l'ultima perde il rientro a destra (piu' la scrollbar, se c'e'),
  //   - la centrale resta piena -- quindi leggermente piu' larga delle altre due.
  // La scrollbar va misurata DOPO aver fissato width/margin: prima non esiste ancora.
  let gbl = 0, gbr = 0;
  try {
    const gcs = getComputedStyle(grid);
    gbl = parseFloat(gcs.borderLeftWidth) || 0;
    gbr = parseFloat(gcs.borderRightWidth) || 0;
  } catch (e) {}
  const sbw = Math.max(0, grid.offsetWidth - grid.clientWidth - gbl - gbr); // 0 se non scrolla
  const gR = grid.getBoundingClientRect();
  // Bordo INIZIALE delle colonne TIPO e VALORE = la linea verticale disegnata da `td + td`.
  const r1 = tr.cells[1].getBoundingClientRect();
  const r2 = tr.cells[2].getBoundingClientRect();
  let w1, w2, w3;
  if (rtl) {
    const cStart = gR.right - gbr;              // in RTL l'asse inline parte da destra
    const cEnd = gR.left + gbl + sbw;
    w1 = cStart - r1.right; w2 = r1.right - r2.right; w3 = r2.right - cEnd;
  } else {
    const cStart = gR.left + gbl;
    const cEnd = gR.right - gbr - sbw;
    w1 = r1.left - cStart; w2 = r2.left - r1.left; w3 = cEnd - r2.left;
  }
  // Se una misura non torna (tabella nascosta, layout non ancora calcolato) si ricade sulle
  // tre colonne uguali: meglio leggermente disallineato che una griglia collassata.
  if (w1 > 0 && w2 > 0 && w3 > 0) {
    grid.style.gridTemplateColumns = Math.round(w1) + 'px ' + Math.round(w2) + 'px ' + Math.round(w3) + 'px';
  } else {
    grid.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
  }
}
// WP-M4h (Ismail 2026-07-21): DOPPIO CLICK su una cella = "zoom" -- la cella si allarga a
// tutta la riga del pannello (3 colonne) per leggere per intero un valore lungo, e ci resta
// finche' non si clicca/tocca altrove. Una sola cella zoomata alla volta in tutta la pagina
// (riclicandone un'altra la prima si richiude), coerente con "finche' non clicchi altrove".
// Delega su document: le celle vengono RIGENERATE ad ogni refresh durante l'esecuzione
// (_bfRenderArrayCells riscrive innerHTML), quindi un listener per-cella andrebbe perso.
function _bfClearArrayCellZoom(except) {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  try {
    document.querySelectorAll('#tabVariabili .ac-cell.ac-zoom').forEach(function (c) {
      if (c !== except) c.classList.remove('ac-zoom');
    });
  } catch (e) {}
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('dblclick', function (e) {
    const cell = e.target && e.target.closest ? e.target.closest('#tabVariabili .ac-cell') : null;
    // WP-M4m: le celle segnaposto ("–", riempimento dell'ultima riga) e quelle di servizio
    // non contengono un valore da leggere: niente zoom.
    if (!cell || (cell.classList && (cell.classList.contains('ac-more') || cell.classList.contains('ac-empty') || cell.classList.contains('ac-pad')))) return;
    e.preventDefault();
    const wasZoom = cell.classList.contains('ac-zoom');
    _bfClearArrayCellZoom(cell);
    cell.classList.toggle('ac-zoom', !wasZoom);
  });
  // Click/tocco ALTROVE (anche fuori dal pannello) -> si richiude. `capture` per intercettare
  // il gesto prima che altri handler lo fermino; il doppio click sulla cella stessa non passa
  // di qui perche' il target e' dentro .ac-cell.
  document.addEventListener('pointerdown', function (e) {
    const inCell = e.target && e.target.closest ? e.target.closest('#tabVariabili .ac-cell.ac-zoom') : null;
    if (!inCell) _bfClearArrayCellZoom(null);
  }, true);
}
if (typeof window !== 'undefined') {
  window._bfRenderArrayCells = _bfRenderArrayCells;
  window._bfSyncArrayValueControl = _bfSyncArrayValueControl;
  window._bfPlaceArrayCells = _bfPlaceArrayCells;
  window._bfClearArrayCellZoom = _bfClearArrayCellZoom;
  // Le colonne sono elastiche (la sidebar si ridimensiona): riposiziona i pannelli aperti.
  window.addEventListener('resize', function () {
    try {
      document.querySelectorAll('#tabVariabili tr.cells-open').forEach(function (r) { _bfPlaceArrayCells(r); });
    } catch (e) {}
  });
}

// Mostra/nasconde la RIGA DIMENSIONI nella colonna TIPO quando il tipo e'/non e' array.
// WP-M4 (mockup di Ismail): "Intero ▼ × 3" -- tipo elementi, segno ×, campo dimensione,
// tutti su una seconda riga DENTRO la cella TIPO (div.array-dims). `preset` (opzionale):
// tipo elementi da preselezionare (usato dal caricamento file).
function _bfSyncElemTypeControl(selectTipo, preset) {
  const cell = selectTipo && selectTipo.closest ? selectTipo.closest('td') : null;
  if (!cell) return;
  let dims = cell.querySelector('.array-dims');
  const want = (selectTipo.value === 'array');
  if (want && !dims) {
    dims = document.createElement('div');
    dims.className = 'array-dims';
    const es = _bfCreateArrayElemSelect();
    const x = document.createElement('span');
    x.className = 'array-dims-x';
    x.setAttribute('aria-hidden', 'true');
    x.textContent = '×';
    // WP-M4e (Ismail 2026-07-21, "togli le frecce dei numeri e rendilo un normale form di
    // input"): era <input type="number">, che in ogni browser aggiunge gli spinner su/giu'.
    // In una cella larga poche decine di pixel quelle due frecce rubavano quasi tutto lo
    // spazio al testo e coprivano la select del tipo accanto. Ora e' un normale campo di
    // testo: `inputmode="numeric"` fa comunque comparire il tastierino numerico su telefono,
    // e la validazione resta quella di aggiungiVaribile (regex /^\d+$/ + tetto 1000), che
    // non e' mai dipesa dal tipo dell'input.
    const size = document.createElement('input');
    size.type = 'text';
    size.setAttribute('inputmode', 'numeric');
    size.setAttribute('maxlength', '4'); // WP-M4i: 1000 = 4 cifre, il tetto di BF_ARRAY_MAX_SIZE
    size.classList.add('inputVariable', 'array-size-input');
    size.placeholder = 'n';
    size.setAttribute('data-i18n-title', 'var_size');
    size.title = (typeof i18nText === 'function' && i18nText('var_size')) || 'Dimensione (numero di celle)';
    dims.appendChild(es); dims.appendChild(x); dims.appendChild(size);
    cell.appendChild(dims);
  } else if (!want && dims) {
    dims.remove();
    dims = null;
  }
  const es2 = dims ? dims.querySelector('select.array-elem-select') : null;
  if (es2 && preset && ['int', 'float', 'string', 'bool'].indexOf(preset) !== -1) es2.value = preset;
  updateArrayElemOptions();
}
if (typeof window !== 'undefined') {
  window._bfSyncElemTypeControl = _bfSyncElemTypeControl;
  window.updateArrayElemOptions = updateArrayElemOptions;
  window._bfCreateArrayElemSelect = _bfCreateArrayElemSelect;
  window.addEventListener('resize', function () { try { updateArrayElemOptions(); } catch (e) {} });
}

// Abilita/disabilita il campo valore in base alla checkbox "Assign" della riga.
// Ismail 2026-07-20: ".value-input" (senza vincolo di tag) invece di "input.value-input" --
// il campo puo' ora essere anche una <select> (tipo bool, vedi _bfSyncValueControl). Lo
// svuotamento a "" quando si de-seleziona Assign si applica SOLO a un input di testo: su una
// <select> non esiste un'opzione vuota (solo true/false), quindi si lascia il valore com'e' --
// e' comunque ignorato dalla validazione finche' "Assign" resta deselezionato (aggiungiVaribile).
function toggleAssign(chk) {
  const wrap = chk && chk.parentElement;
  const input = wrap ? wrap.querySelector(".value-input") : null;
  if (!input) return;
  input.disabled = !chk.checked;
  if (!chk.checked && input.tagName !== "SELECT") input.value = "";
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
// ============================================================================
// WP-M11 (Ismail 2026-07-21): su TELEFONO la barra Variabili e il terminale AGGANCIATO non
// possono stare aperti insieme -- sono due pannelli laterali che si spartiscono una larghezza
// che su un telefono non c'e', e il canvas in mezzo sparisce. Aprendo uno si chiude l'altro,
// in entrambi i versi. Il terminale in modalita' MOBILE (flottante, .docked assente) e'
// escluso apposta: e' una finestrella sopra il canvas, non ruba larghezza -- richiesta
// esplicita di Ismail ("se mette terminale mobile ok").
// Le due funzioni stanno qui e non in execute.js perche' variables.js e' caricato prima e
// deve poterle usare anche il terminale (window.*, sotto).
// ============================================================================
function _bfPhoneLayout() {
  try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 760px)').matches); }
  catch (e) { return false; }
}
// Chiude la barra Variabili se aperta. Ritorna true se ha davvero chiuso qualcosa.
function _bfCollapseVariables() {
  const main = document.getElementById('main');
  if (!main || main.classList.contains('sidebar-collapsed')) return false;
  main.classList.add('sidebar-collapsed');
  if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
  return true;
}
// Chiude il terminale se e' aperto E agganciato (quello mobile/flottante resta).
function _bfCloseDockedTerminal() {
  const c = document.getElementById('console-popup');
  if (!c || !c.classList.contains('active') || !c.classList.contains('docked')) return false;
  if (typeof closeConsole === 'function') closeConsole();
  else c.classList.remove('active');
  if (typeof updateTerminalTab === 'function') updateTerminalTab();
  return true;
}
if (typeof window !== 'undefined') {
  window._bfPhoneLayout = _bfPhoneLayout;
  window._bfCollapseVariables = _bfCollapseVariables;
  window._bfCloseDockedTerminal = _bfCloseDockedTerminal;
}

function toggleVariables() {
  const main = document.getElementById('main');
  if (!main) return;
  main.classList.toggle('sidebar-collapsed');
  // WP-M11: se si sta APRENDO la barra su telefono, il terminale agganciato lascia il posto.
  if (!main.classList.contains('sidebar-collapsed') && _bfPhoneLayout()) _bfCloseDockedTerminal();
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
        // WP-M4e (Ismail 2026-07-21): il doppio click apre l'editor esteso anche sul campo
        // DIMENSIONE dell'array, non solo sul campo valore -- si comporta come "un normale
        // form di input" come gli altri, con lo stesso gesto per aprirlo comodamente.
        const input = e.target && e.target.closest
          ? e.target.closest('input.value-input, input.array-size-input') : null;
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
  // Ismail 2026-07-20: la select true/false del campo valore bool non e' garantito che
  // scateni 'input' in ogni browser quando l'utente sceglie un'opzione (a differenza di un
  // <input> di testo) -- 'change' invece scatta sempre. Sincronizza qui il tooltip nativo
  // anche per quel caso (per un <input> di testo il listener 'input' sopra ha gia' fatto
  // tutto: nessun doppio lavoro dannoso, _varSyncValueTitle e' idempotente).
  document.addEventListener('change', function (e) {
    const t = e.target;
    if (t && t.tagName === 'SELECT' && t.classList && t.classList.contains('value-input')) _varSyncValueTitle(t);
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

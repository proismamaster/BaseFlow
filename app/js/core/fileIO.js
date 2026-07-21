
// Rilievo 34: prima di aprire un file, se ci sono modifiche non salvate chiedi conferma.
// WP (Ismail 2026-07-22, packaging desktop): nell'app Electron "Apri" usa il dialog nativo
// via IPC (_bfOpenFileDesktop) invece dell'<input type=file> del browser -- serve per avere
// un PATH vero (l'API browser non lo espone mai, per privacy), cosi' il prossimo "Salva"
// scrive silenziosamente sullo stesso file invece di riaprire un picker che chiede di
// sovrascrivere (vedi saveOpen.js, currentFilePath).
function openFileWithGuard() {
  const isDesktop = !!(window.BaseFlowDesktop && window.BaseFlowDesktop.isDesktop);
  const doOpen = isDesktop ? _bfOpenFileDesktop : function () {
    const inp = document.getElementById('fileInput');
    if (inp) inp.click();
  };
  const dirty = (typeof saved !== 'undefined' && !saved) && !(typeof isEmpty === 'function' && isEmpty());
  if (dirty && typeof showUnsavedDialog === 'function') {
    // FIX #34: stesso dialog unificato "modifiche non salvate" di Nuovo/Ricarica (Salva / Non salvare=apri / Annulla).
    showUnsavedDialog({ onSave: function () { if (typeof saveFile === 'function') saveFile(); }, onDiscard: doOpen });
    return;
  }
  doOpen();
}
if (typeof window !== 'undefined') window.openFileWithGuard = openFileWithGuard;

// Apertura nativa via Electron (dialog.showOpenDialog + fs.readFile nel main, vedi preload.js).
async function _bfOpenFileDesktop() {
  if (!(window.BaseFlowDesktop && window.BaseFlowDesktop.isDesktop && window.BaseFlowDesktop.openFile)) return;
  try {
    const res = await window.BaseFlowDesktop.openFile();
    if (!res) return; // dialog annullato
    if (!res.ok) {
      const title = (typeof i18nText === 'function' && i18nText('load_invalid_title')) || 'File non valido';
      const msg = res.error || title;
      if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true, title: title });
      else if (typeof alert === 'function') alert(msg);
      return;
    }
    const displayName = res.path.replace(/^.*[\\/]/, '');
    _bfLoadFlowFromContent(res.content, displayName, res.path, function () {});
  } catch (err) {
    console.error('Apertura file desktop fallita:', err);
  }
}
if (typeof window !== 'undefined') window._bfOpenFileDesktop = _bfOpenFileDesktop;

  // Listener per l'evento 'change' sull'input di tipo file (per caricare un flowchart, browser/PWA).
  document.getElementById('fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0]; // File selezionato dall'utente
  if (file) {
    const reader = new FileReader(); // Oggetto per leggere il contenuto del file
    reader.onload = (e) => { // Callback eseguita al termine della lettura del file
      // filePath = null: il browser non espone mai un path reale (privacy) -- solo il
      // NOME viene ricordato, come sempre; il prossimo Salva riapre il picker (saveOpen.js).
      _bfLoadFlowFromContent(e.target.result, file.name, null, function () { event.target.value = ''; });
    };
    reader.readAsText(file); // Avvia la lettura del file come testo
  }
});

// Logica di caricamento condivisa fra l'<input type=file> (browser/PWA) e il dialog nativo
// desktop (_bfOpenFileDesktop): stesse validazioni, stesso aggiornamento di stato. `resetInput`
// e' il modo per permettere di ri-selezionare subito lo stesso file dall'<input> in caso di
// errore -- no-op per il flusso desktop, che non ha un <input> da resettare.
function _bfLoadFlowFromContent(content, displayName, filePath, resetInput) {
  resetInput = resetInput || function () {};
  // AUDIT 2026-07-19 (falla #4, DoS): niente piu' dump dell'INTERO contenuto in console
  // (un file da MB congelava DevTools) e tetto dimensioni PRIMA del parse -- un file
  // enorme/ostile mandava JSON.parse + validateFlow + layout in blocco totale della tab.
  const BF_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB: ordini di grandezza sopra ogni flowchart reale
  const BF_MAX_NODES = 10000, BF_MAX_VARS = 1000;
  try {
    if (typeof content === 'string' && content.length > BF_MAX_FILE_BYTES) {
      resetInput();
      const msg = (typeof i18nText === 'function' && i18nText('load_too_big'))
        || 'File troppo grande per essere un flowchart BaseFlow: caricamento rifiutato.';
      const title = (typeof i18nText === 'function' && i18nText('load_invalid_title')) || 'File non valido';
      if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true, title: title });
      else if (typeof alert === 'function') alert(msg);
      return;
    }
    // 2026-07-19 (formato .bflow: checksum d'integrità + contenuto OPACO). Un unico
    // entry point (bfParseLoadedText) gestisce i 3 formati: v2 opaco (magic BFLOW1 +
    // payload offuscato), v1 involucro JSON, legacy .json puro. Verifica il checksum e
    // de-offusca PRIMA di toccare lo stato corrente: file corrotto/troncato -> rifiutato
    // con messaggio dedicato, progetto aperto intatto. Se il modulo non fosse caricato,
    // fallback al vecchio JSON.parse grezzo (nessun crash).
    let json;
    if (typeof bfParseLoadedText === 'function') {
      const res = bfParseLoadedText(content);
      if (!res.ok) {
        resetInput(); // permette di ri-selezionare lo stesso file
        let msg, title;
        if (res.reason === 'version') {
          title = (typeof i18nText === 'function' && i18nText('load_corrupt_title')) || 'File non apribile';
          msg = (typeof i18nFormat === 'function' && i18nFormat('load_newer_version', { v: res.detail }))
            || ('File creato con una versione più recente (formato v' + res.detail + ').');
        } else if (res.reason === 'parse') {
          title = (typeof i18nText === 'function' && i18nText('load_invalid_title')) || 'File non valido';
          msg = (typeof i18nFormat === 'function' && i18nFormat('load_parse_err', { msg: res.detail }))
            || ('Errore nel file: ' + res.detail);
        } else {
          // checksum | corrupt | structure -> tutti "file danneggiato/incompleto".
          title = (typeof i18nText === 'function' && i18nText('load_corrupt_title')) || 'File corrotto';
          msg = (typeof i18nText === 'function' && i18nText('load_corrupt_checksum'))
            || 'Il file è danneggiato o incompleto (controllo di integrità fallito).';
        }
        if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true, title: title });
        else if (typeof alert === 'function') alert(msg);
        return;
      }
      json = res.flow;
    } else {
      json = JSON.parse(content); // fallback estremo: modulo formato non caricato
    }

    // AUDIT 2026-07-19 (falla #4, DoS): tetti su numero di nodi/variabili PRIMA di
    // validateFlow -- i suoi walker (sottoalberi/reachability) su un file con centinaia
    // di migliaia di nodi bloccherebbero la tab ancora prima del rifiuto.
    // AUDIT ARRAY 2026-07-21 (WP-M5, richiesta di Ismail "fai anche controlli di sicurezza
    // per assicurarti che l'utente non faccia casini"): le VARIABILI di un file non erano
    // mai validate nel contenuto -- validateFlow controlla solo la topologia dei nodi.
    // Con il tipo Array un file ostile (o solo corrotto) poteva contenere: array da
    // milioni di celle (freeze della tab al render della griglia/watch), elementi che non
    // sono scalari (oggetti/annidati -> l'esecutore e gli export producono garbage), tipi
    // inventati, o `value` di tipo incoerente col `type` dichiarato. Qui si RIFIUTA il
    // file invece di ripararlo in silenzio: come per la struttura dei nodi (FIX A1),
    // l'intento di un file rotto e' ambiguo e il progetto aperto non va toccato.
    const BF_ARRAY_MAX_CELLS = 1000; // WP-M4i: stesso tetto della UI (variables.js)
    const _SCALAR_TYPES = ['int', 'float', 'string', 'bool', 'boolean'];
    function _bfValidateVariables(vars) {
      if (!Array.isArray(vars)) return null; // assente: gestito altrove
      for (let i = 0; i < vars.length; i++) {
        const v = vars[i];
        if (!v || typeof v !== 'object') return 'variabile #' + i + ': non è un oggetto valido';
        // Il nome deve rispettare la STESSA regola della UI (lettereENumeri, utils.js:
        // inizia con una lettera, poi solo lettere/cifre) -- una regex piu' permissiva qui
        // avrebbe fatto passare da file nomi che l'utente non puo' nemmeno digitare.
        // In particolare `__proto__`/`constructor`/`prototype`: i valori delle variabili
        // vengono cercati per NOME e finiscono in strutture indicizzate per nome, quindi
        // un nome del genere e' un vettore di prototype pollution. La lettera iniziale
        // obbligatoria li esclude gia' tutti; la blacklist esplicita resta come promemoria
        // e come rete se un giorno si ammettesse l'underscore iniziale.
        const _BAD_NAMES = ['__proto__', 'constructor', 'prototype'];
        if (typeof v.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(v.name) || _BAD_NAMES.indexOf(v.name) !== -1) {
          return 'variabile #' + i + ': nome non valido';
        }
        const t = v.type;
        if (typeof t !== 'string') return 'variabile "' + v.name + '": tipo mancante';
        const isArr = t.indexOf('array:') === 0;
        const base = isArr ? t.slice(6) : t;
        if (_SCALAR_TYPES.indexOf(base) === -1) return 'variabile "' + v.name + '": tipo sconosciuto (' + t + ')';
        if (isArr) {
          if (!Array.isArray(v.value)) return 'variabile "' + v.name + '": è dichiarata array ma il valore non lo è';
          if (v.value.length > BF_ARRAY_MAX_CELLS) return 'variabile "' + v.name + '": array troppo grande (' + v.value.length + ' celle, massimo ' + BF_ARRAY_MAX_CELLS + ')';
          for (let k = 0; k < v.value.length; k++) {
            const el = v.value[k];
            const ok = (base === 'int') ? (typeof el === 'number' && Number.isInteger(el))
              : (base === 'float') ? (typeof el === 'number' && isFinite(el))
              : (base === 'string') ? (typeof el === 'string')
              : (typeof el === 'boolean');
            if (!ok) return 'variabile "' + v.name + '": la cella ' + k + ' non è del tipo dichiarato (' + base + ')';
          }
        } else {
          if (v.value !== null && typeof v.value === 'object') return 'variabile "' + v.name + '": valore non ammesso (oggetto/array su un tipo semplice)';
          if (base === 'float' && typeof v.value === 'number' && !isFinite(v.value)) return 'variabile "' + v.name + '": valore numerico non finito';
          if (typeof v.value === 'string' && v.value.length > 100000) return 'variabile "' + v.name + '": testo troppo lungo';
        }
      }
      return null;
    }
    if (json && typeof json === 'object') {
      const _varErr = _bfValidateVariables(json.variables);
      if (_varErr) {
        resetInput();
        const title = (typeof i18nText === 'function' && i18nText('load_invalid_title')) || 'File non valido';
        const msg = ((typeof i18nText === 'function' && i18nText('load_bad_variables')) || 'Il file contiene variabili non valide e non è stato caricato.') + '\n\n- ' + _varErr;
        if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true, title: title });
        else if (typeof alert === 'function') alert(msg);
        return;
      }
    }
    if (json && typeof json === 'object') {
      const _nNodes = Array.isArray(json.nodes) ? json.nodes.length : 0;
      const _nVars = Array.isArray(json.variables) ? json.variables.length : 0;
      if (_nNodes > BF_MAX_NODES || _nVars > BF_MAX_VARS) {
        resetInput();
        const msg = (typeof i18nText === 'function' && i18nText('load_too_big'))
          || 'File troppo grande per essere un flowchart BaseFlow: caricamento rifiutato.';
        const title = (typeof i18nText === 'function' && i18nText('load_invalid_title')) || 'File non valido';
        if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true, title: title });
        else if (typeof alert === 'function') alert(msg);
        return;
      }
    }

    // FIX A1 (review Fable, 2026-07-05): PRIMA di toccare lo stato corrente, si
    // valida il file appena parsato. Un file salvato durante le settimane dei
    // vecchi bug di corruzione (o comunque semanticamente rotto) veniva prima
    // assegnato direttamente a `flow` e renderizzato senza alcun controllo --
    // garbage silenzioso (nodi "reclamati" per errore da un ciclo il cui corpo
    // non torna mai al ciclo, join non calcolabili, nodi irraggiungibili...). Se
    // la validazione fallisce: alert con l'elenco leggibile dei problemi e
    // caricamento RIFIUTATO, lo stato corrente resta intatto (nessuna riparazione
    // automatica: l'intento originale di un file corrotto e' ambiguo).
    if (typeof validateFlow === "function") {
      const validation = validateFlow(json);
      if (!validation.valid) {
        const msg =
          "Impossibile caricare il file: la struttura del flowchart non e' valida.\n\n" +
          validation.errors.map((e) => "- " + e).join("\n") +
          "\n\nIl flowchart attualmente aperto non e' stato modificato.";
        // B1 (round 11): showStyledAlert e' non-bloccante -> reset del value PRIMA di aprirla,
        // cosi' l'utente puo' ri-selezionare lo stesso file anche mentre la modale e' aperta.
        resetInput(); // permette di ri-selezionare lo stesso file
        const title = (typeof i18nText === 'function' && i18nText('load_invalid_title')) || 'File non valido';
        if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true, title: title });
        else if (typeof alert === 'function') alert(msg);
        return;
      }
    }

    if (typeof clearHistory === 'function') clearHistory(); // reset Undo/Redo al caricamento
    // WP-N2 (round 15-C, problema #3, Ismail 2026-07-15): aprire un file MENTRE
    // un'esecuzione e' in corso o in pausa lasciava lo stato di esecuzione (currentNode/
    // prevNode/_runtimeVars/executingEdge/executingNodeIndex) agganciato al VECCHIO grafo:
    // col nuovo grafo caricato l'esecuzione "riprendeva" su indici stantii invece di
    // fermarsi. Abort completo PRIMA di sostituire flow/nodi -- la prossima esecuzione
    // riparte da Start (gate "if(currentNode==null)" in executeFlow/executeStep).
    if (typeof _bfAbortExecOnEdit === 'function') _bfAbortExecOnEdit();
    if (typeof _paused !== 'undefined') _paused = false;
    if (typeof currentNode !== 'undefined') currentNode = null;
    if (typeof prevNode !== 'undefined') prevNode = null;
    flow = json; // Aggiorna la struttura logica 'flow' con quella caricata
    // R13-D (Ismail 2026-07-12): campo `author` top-level, opzionale -- i file salvati
    // PRIMA di questo round non ce l'hanno (validateFlow valida solo nodes/variables, lo
    // ignora): null -> l'header mostra il default localizzato "Autore sconosciuto".
    currentAuthor = (typeof json.author === 'string' && json.author.trim()) ? json.author.trim() : null;
    // C4 (round 11): il file caricato ricostruisce 'nodi' da zero -- azzera anche il
    // bordo di selezione visiva, altrimenti punterebbe a un indice/nodo stantio.
    if (typeof selectedNodeIdx !== 'undefined') selectedNodeIdx = -1;
    // R12-G/Fase1: idem per la selezione multipla.
    if (typeof multiSelected !== 'undefined') multiSelected = [];

    // Ricostruisce l'array dei nodi visuali 'nodi' basandosi su flow.nodes
    nodi = []; // Resetta l'array dei nodi visuali
    for (let i = 0; i < flow.nodes.length; i++) {
      let tipo = flow.nodes[i].type; // Tipo del nodo
      nodi.push({ // Aggiunge un nuovo oggetto nodo visuale
        relX: 0.35, // Posizione X relativa di default (verrà ricalcolata)
        relY: 0.05 + i * 0.1, // Posizione Y relativa di default (verrà ricalcolata)
        width: 100, // Larghezza standard
        height: NODE_BASE_HEIGHT_PX, // Altezza standard
        color: "white", // Colore di default
        text: (typeof nodeText === 'function' ? nodeText(tipo) : tipo.charAt(0).toUpperCase() + tipo.slice(1)) // etichetta corretta (Move/Draw, Pen, ...)
      });
    }

    // Ricostruisce la tabella delle variabili HTML
    while (tabVariabili.rows.length > 1) { // Rimuove tutte le righe tranne l'header
      tabVariabili.deleteRow(1);
    }
    for (let i = 0; i < flow.variables.length; i++) { // Per ogni variabile nel flow caricato
      inserisciRiga(); // Aggiunge una nuova riga alla tabella
      let riga = tabVariabili.rows[i + 1]; // Riga appena inserita
      let varObj = flow.variables[i]; // Oggetto variabile corrente
      // Popola i campi della riga con i dati della variabile
      let cella1 = riga.cells[0].querySelector("input"); // Input nome
      let cella2 = riga.cells[1].querySelector("select"); // Select tipo
      if (cella1) cella1.value = varObj.name;
      // WP-M2 (Ismail 2026-07-20, tipo Array): il tipo composto 'array:<elem>' non e' una
      // voce della select -- si imposta 'array' e si preseleziona il tipo elementi nella
      // seconda select (creata da _bfSyncElemTypeControl col preset).
      const _isArr = (typeof varObj.type === 'string' && varObj.type.indexOf('array:') === 0);
      if (cella2) cella2.value = _isArr ? 'array' : varObj.type;
      if (cella2 && _isArr && typeof _bfSyncElemTypeControl === 'function') { try { _bfSyncElemTypeControl(cella2, varObj.type.slice(6)); } catch (e) {} }
      // Ismail 2026-07-20: impostare .value su una <select> a mano NON scatena 'change',
      // quindi il campo valore non si trasformerebbe mai da solo in select true/false per
      // una variabile bool caricata da file -- lo si sincronizza esplicitamente qui, PRIMA
      // di leggere/scrivere il campo valore (che _bfSyncValueControl puo' aver sostituito).
      if (cella2 && typeof _bfSyncValueControl === 'function') { try { _bfSyncValueControl(cella2); } catch (e) {} }
      // WP-M3: crea anche dimensione + espansore celle per le righe array.
      if (cella2 && _isArr && typeof _bfSyncArrayValueControl === 'function') { try { _bfSyncArrayValueControl(cella2); } catch (e) {} }
      let cella3 = riga.cells[2].querySelector(".value-input") || riga.cells[2].querySelector("input"); // Campo valore (input o select bool)
      if (_isArr && Array.isArray(varObj.value)) {
        // WP-M4 (mockup di Ismail): dimensione (colonna TIPO, "× n") = value.length;
        // campo valore = valore UNIFORME se tutte le celle coincidono, altrimenti la
        // LISTA completa "1, 2, 3" (entrambe le forme sono ri-accettate al commit);
        // vuoto se uninit. Checkbox "Assegna" e abilitazione coerenti col flag uninit.
        const _sz = riga.cells[1].querySelector('.array-size-input');
        if (_sz) _sz.value = String(varObj.value.length);
        const _uniform = varObj.value.length > 0 && varObj.value.every(function (el) { return el === varObj.value[0]; });
        if (cella3) cella3.value = varObj.uninit ? '' : (_uniform ? String(varObj.value[0]) : varObj.value.join(', '));
        const _chk = riga.cells[2].querySelector('.assign-check');
        if (_chk) _chk.checked = !varObj.uninit;
        if (cella3) cella3.disabled = !!varObj.uninit;
        if (typeof _bfRenderArrayCells === 'function') { try { _bfRenderArrayCells(riga, varObj.value, false, !!varObj.uninit); } catch (e) {} }
      } else if (cella3) {
        cella3.value = (typeof varObj.value === 'boolean') ? (varObj.value ? 'true' : 'false') : varObj.value;
      }
      riga.addEventListener("change", aggiungiVaribile); // Aggiunge listener per modifiche
    }
    // Assicura che ci sia sempre una riga vuota alla fine per un nuovo input
    if (tabVariabili.rows.length === flow.variables.length + 1 || flow.variables.length === 0) {
        if (flow.variables.length > 0 || tabVariabili.rows.length === 1) { // Se ci sono variabili o la tabella è vuota (solo header)
             inserisciRiga(); // Aggiunge la riga vuota
        }
        // L'ultima riga (quella per nuovo input) deve avere il listener
        let ultimaRiga = tabVariabili.rows[tabVariabili.rows.length - 1];
        if (ultimaRiga) ultimaRiga.addEventListener("change", aggiungiVaribile);
    }


    // WP-N4 (round 15-C, QA zoom, Ismail 2026-07-15): un file aperto dopo aver zoomato il
    // progetto precedente ereditava lo stesso livello di zoom -- il nuovo progetto partiva
    // ingrandito/rimpicciolito a caso invece che alla vista normale. "Nuovo" gia' lo fa
    // gratis (location.reload()); qui serve esplicito perche' Apri sostituisce flow/nodi
    // SENZA ricaricare la pagina. Solo la variabile (non zoomReset(), che farebbe gia' un
    // giro di calcoloY/draw/centerGraph ridondante con le righe subito sotto): il
    // calcoloY/draw che segue applica direttamente lo zoom azzerato.
    if (typeof zoom !== 'undefined') zoom = 1;
    calcoloY(nodi); // Ricalcola le posizioni Y
    draw(nodi);     // Ridisegna il flowchart
    // FIX (Ismail 2026-07-08): centra il grafo caricato nell'area visibile.
    if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 120); }
    saved = true;   // Considera il flowchart caricato come "salvato"
    // B3 (round 11): <input type=file> non da' un handle riscrivibile -- solo il NOME. Il
    // prossimo "Salva" lo riusera' (picker precompilato o download diretto, vedi saveOpen.js).
    currentFileName = displayName;
    currentFileHandle = null;
    // WP (Ismail 2026-07-22): solo il flusso desktop passa un path reale (filePath non-null) --
    // il prossimo "Salva" scrive silenziosamente li' via IPC invece di riaprire un dialog che
    // chiede di sovrascrivere (vedi saveOpen.js). Il browser/PWA non ha mai un path: resta null,
    // comportamento invariato (il picker/download si riapre, come sempre).
    currentFilePath = filePath || null;
    if (typeof markSaved === 'function') markSaved(); // P (round 15): l'hash di riferimento e' il file appena aperto
    if (typeof updateProjectIdentity === 'function') updateProjectIdentity(); // R13-D
  } catch (err) {
    // B1 (round 11): modale stilizzata invece di alert() nativo.
    const msg = (typeof i18nFormat === 'function' && i18nFormat('load_parse_err', { msg: err.message })) || ("Errore nel file JSON: " + err.message);
    if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true });
    else if (typeof alert === 'function') alert(msg);
  }
}
if (typeof window !== 'undefined') window._bfLoadFlowFromContent = _bfLoadFlowFromContent;

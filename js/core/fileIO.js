
// Rilievo 34: prima di aprire un file, se ci sono modifiche non salvate chiedi conferma.
function openFileWithGuard() {
  const inp = document.getElementById('fileInput');
  if (!inp) return;
  const dirty = (typeof saved !== 'undefined' && !saved) && !(typeof isEmpty === 'function' && isEmpty());
  if (dirty && typeof showUnsavedDialog === 'function') {
    // FIX #34: stesso dialog unificato "modifiche non salvate" di Nuovo/Ricarica (Salva / Non salvare=apri / Annulla).
    showUnsavedDialog({ onSave: function () { if (typeof saveFile === 'function') saveFile(); }, onDiscard: function () { inp.click(); } });
    return;
  }
  inp.click();
}
if (typeof window !== 'undefined') window.openFileWithGuard = openFileWithGuard;

  // Listener per l'evento 'change' sull'input di tipo file (per caricare un flowchart).
  document.getElementById('fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0]; // File selezionato dall'utente
  if (file) {
    const reader = new FileReader(); // Oggetto per leggere il contenuto del file
    reader.onload = (e) => { // Callback eseguita al termine della lettura del file
      const content = e.target.result; // Contenuto testuale del file (JSON atteso)
      console.log("Contenuto file:", content);
      try {
        const json = JSON.parse(content); // Parsing del contenuto JSON

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
            event.target.value = ""; // permette di ri-selezionare lo stesso file
            const title = (typeof i18nText === 'function' && i18nText('load_invalid_title')) || 'File non valido';
            if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true, title: title });
            else if (typeof alert === 'function') alert(msg);
            return;
          }
        }

        if (typeof clearHistory === 'function') clearHistory(); // reset Undo/Redo al caricamento
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
          let cella3 = riga.cells[2].querySelector("input"); // Input valore
          if (cella1) cella1.value = varObj.name;
          if (cella2) cella2.value = varObj.type;
          if (cella3) cella3.value = varObj.value;
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


        calcoloY(nodi); // Ricalcola le posizioni Y
        draw(nodi);     // Ridisegna il flowchart
        // FIX (Ismail 2026-07-08): centra il grafo caricato nell'area visibile.
        if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 120); }
        saved = true;   // Considera il flowchart caricato come "salvato"
        // B3 (round 11): <input type=file> non da' un handle riscrivibile -- solo il NOME. Il
        // prossimo "Salva" lo riusera' (picker precompilato o download diretto, vedi saveOpen.js).
        currentFileName = file.name;
        currentFileHandle = null;
        if (typeof updateProjectIdentity === 'function') updateProjectIdentity(); // R13-D
      } catch (err) {
        // B1 (round 11): modale stilizzata invece di alert() nativo.
        const msg = (typeof i18nFormat === 'function' && i18nFormat('load_parse_err', { msg: err.message })) || ("Errore nel file JSON: " + err.message);
        if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true });
        else if (typeof alert === 'function') alert(msg);
      }
    };
    reader.readAsText(file); // Avvia la lettura del file come testo
  }
});

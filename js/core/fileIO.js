
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
        flow = json; // Aggiorna la struttura logica 'flow' con quella caricata

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
            text: tipo.charAt(0).toUpperCase() + tipo.slice(1) // Testo (es. "Start", "If")
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
        saved = true;   // Considera il flowchart caricato come "salvato"
      } catch (err) {
        alert("Errore nel parsing del file JSON: " + err.message); // Gestione errore parsing
      }
    };
    reader.readAsText(file); // Avvia la lettura del file come testo
  }
});

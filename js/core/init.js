
  window.onload = function () {
    saved=true; // Inizialmente, si considera il flowchart "salvato" (nessuna modifica)
    window.addEventListener("resize", resizeCanvas); // Listener per ridimensionare il canvas

    // Creazione dei nodi visuali iniziali (Start e End)
    nodi.push({ relX: 0.35, relY: 0.05, width: 100, height: 40, color: "white", text: "Start" });
    nodi.push({ relX: 0.35, relY: 0.4, width: 100, height: 40, color: "white", text: "End" });
    calcoloY(nodi); // Calcola le posizioni Y corrette per i nodi
    draw(nodi);     // Disegna il flowchart iniziale

    canvas.addEventListener("click", checkClick); // Listener per click su nodi/frecce sul canvas

    // Imposta il listener per la prima riga dati (se esiste) della tabella variabili
    if (tabVariabili.rows[1]) { // La riga 0 è l'header
      tabVariabili.rows[1].addEventListener("change", aggiungiVaribile);
      tabVariabili.rows[1].cells[0].querySelector("input").value = "";
      tabVariabili.rows[1].cells[2].querySelector("input").value = "";
    }
  }

 // Listener per la scorciatoia da tastiera Ctrl+R (o Cmd+R su Mac).
 // Previene il ricaricamento della pagina se ci sono modifiche non salvate, chiedendo conferma.
 window.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') { // Se premuto Ctrl/Cmd + R
      if(!isEmpty() && !saved){ // Se il flowchart non è vuoto e ci sono modifiche non salvate
        event.preventDefault(); // Impedisce il ricaricamento di default
        if (confirm("There are unsaved changes. Do you really want to reload the page?")) { // Chiede conferma
          location.reload(); // Ricarica la pagina se confermato
        }
      }
      // Altrimenti (se salvato o vuoto), permette il ricaricamento di default
    }
  });

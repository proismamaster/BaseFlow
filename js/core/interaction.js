
// Verifica se il click è avvenuto su un nodo o su una freccia.
function checkClick(event) {
  clickNodo(event);
  clickFreccia(event);
}

// Gestisce il click su una freccia.
// Se una freccia viene cliccata, apre il popup per l'inserimento di un nuovo nodo.
function clickFreccia(event) {
  // Blocco 1: Calcola le coordinate del click relative al canvas
  let rect = canvas.getBoundingClientRect(); 
  let clickX = event.clientX - rect.left; // Coordinata X del click relativa al canvas
  let clickY = event.clientY - rect.top; // Coordinata Y del click relativa al canvas

  // Blocco 2: Itera sulle frecce disegnate e verifica se qualcuna è stata cliccata
  for (let i = 0; i < frecce.length; i++) {
    const freccia = frecce[i]; 
    if (isPointNearLine(clickX, clickY, freccia.inzioX, freccia.inzioY, freccia.fineX, freccia.fineY, 8)) { // 8 è la distanza di tolleranza
      console.log("Hai cliccato la freccia", freccia.id);
      document.getElementById("popup-window").classList.add("active"); 
      document.getElementById("overlay").classList.add("active"); 
      frecceSelected = freccia.id; // Memorizza l'ID della freccia selezionata
      return;
    }
  }
}

// Inserisce un nuovo nodo logico e visuale nel flowchart quando l'utente clicca su una freccia.
// Il 'tipo' specifica il tipo di nodo da inserire (es. "input", "print", "if").
// La funzione gestisce l'aggiornamento degli indici e dei puntatori 'next' dei nodi esistenti,
// e calcola la posizione del nuovo nodo visuale.
function inserisciNodo(tipo) {
  saved = false; 
  if (frecceSelected === -1 || !frecce[frecceSelected]) { 
    console.error("inserisciNodo ERRORE: Nessuna freccia selezionata o freccia non valida.");
    chiudiPopup();
    return;
  }

  const clickedArrow = frecce[frecceSelected]; 
  const arrowType = clickedArrow.type; 
  const parentNodeIndex = clickedArrow.fromNodeIndex; //nodo da cui parte la freccia
  const originalTargetNodeIndex = clickedArrow.toNodeIndex; // nodo a cui la freccia puntava originariamente
  // L'indice a cui verrà inserito il nuovo nodo logico. Solitamente coincide con originalTargetNodeIndex, il target originale (e successivi) slittano.
  const newActualNodeIndex = originalTargetNodeIndex;

  console.log(`inserisciNodo INFO: Tipo Nodo="${tipo}", ID Freccia=${clickedArrow.id}, Tipo Freccia="${arrowType}"`);
  console.log(`  parentNodeIndex=${parentNodeIndex}, originalTargetNodeIndex=${originalTargetNodeIndex}`);

  // Blocca inserimenti circolari o problematici all'interno dello stesso ramo IF
  if (
    parentNodeIndex === originalTargetNodeIndex &&
    (arrowType === 'if_true' || arrowType === 'if_false' || arrowType === 'if_join')
  ) {
    console.error("inserisciNodo ERRORE: Tentativo di inserimento circolare in IF.");
    chiudiPopup();
    frecceSelected = -1; // Deseleziona la freccia
    return;
  }

  // 1) Creazione del nuovo nodo logico
  let newNodeLogic; // Oggetto per il nuovo nodo logico
  const nextForNew = (newActualNodeIndex + 1).toString(); // Il nuovo nodo punterà al nodo che era originariamente in newActualNodeIndex+1 (ora slittato)
  if (tipo === "if") { // Se il nuovo nodo è un IF
    newNodeLogic = {
      type: "if",
      info: "",
      next: { true: nextForNew, false: nextForNew } 
    };
  } else { // Per tutti gli altri tipi di nodo
    newNodeLogic = { type: tipo, info: "", next: nextForNew };
  }

  // 2) Inserimento del nuovo nodo logico in flow.nodes e aggiornamento degli indici 'next' dei nodi successivi
  flow.nodes.splice(newActualNodeIndex, 0, newNodeLogic); 
  console.log(`inserisciNodo INFO: Inserito nodo logico "${tipo}" in indice ${newActualNodeIndex}. Ora flow.nodes.length=${flow.nodes.length}`);

  // Aggiorna tutti i puntatori 'next' che puntavano a un indice >= newActualNodeIndex, incrementandoli di 1
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i]; // Nodo corrente in analisi
    if (n === newNodeLogic) continue; // Salta il nodo appena inserito

    if (n.type === "if" && typeof n.next === "object" && n.next !== null) { // Se il nodo 'n' è un IF
      // Ramo true
      if (typeof n.next.true === "string") {
        const oldT = parseInt(n.next.true, 10); 
        if (!isNaN(oldT) && oldT >= newActualNodeIndex) {
          n.next.true = (oldT + 1).toString();
        }
      }
      // Ramo false
      if (typeof n.next.false === "string") {
        const oldF = parseInt(n.next.false, 10); // Vecchio indice del ramo false
        if (!isNaN(oldF) && oldF >= newActualNodeIndex) {
          n.next.false = (oldF + 1).toString(); // Incrementa
        }
      }
    }
    else if (typeof n.next === "string" && n.next !== null) { 
      const oldN = parseInt(n.next, 10); 
      if (!isNaN(oldN) && oldN >= newActualNodeIndex) {
        n.next = (oldN + 1).toString();
      }
    }
  }
  console.log("inserisciNodo INFO: Puntatori 'next' di tutti i nodi aggiornati.");

  // 3) Aggiornamento del puntatore 'next' del nodo genitore (parentNodeIndex) per puntare al nuovo nodo inserito (newActualNodeIndex)
  const parentLogic = flow.nodes[parentNodeIndex]; // Nodo logico genitore
  if (parentLogic && parentLogic.type === "if") { // Se il genitore è un IF
    const newTargetStr = newActualNodeIndex.toString(); // Indice del nuovo nodo come stringa

    // A seconda del tipo di freccia cliccata, si aggiorna il ramo corretto dell'IF genitore
    if (arrowType === "if_join") { 
      parentLogic.next.true  = newTargetStr;
      parentLogic.next.false = newTargetStr;
      console.log(`inserisciNodo INFO: JOIN sotto IF → next.true e next.false = ${newTargetStr}`);
    }
    else if (arrowType === "if_true") { // Inserimento nel ramo true
      parentLogic.next.true = newTargetStr;
      console.log(`inserisciNodo INFO: Inserimento in ramo TRUE → next.true = ${newTargetStr}`);
    }
    else if (arrowType === "if_false") { // Inserimento nel ramo false
      parentLogic.next.false = newTargetStr;
      console.log(`inserisciNodo INFO: Inserimento in ramo FALSE → next.false = ${newTargetStr}`);
    }
    else { // Caso di freccia 'normal' che parte da un IF (raro) o segmenti intermedi ('if_*_h_in', etc.)
           // In questi casi, non si modificano i next.true/false diretti dell'IF genitore,
           // perché l'inserimento avviene "dopo" un ramo già definito.
      console.log(`inserisciNodo INFO: Freccia '${arrowType}' da IF → non modifico next.true/false di IF genitore ${parentNodeIndex}. Il next del nodo precedente al nuovo nodo (${newActualNodeIndex-1} se esiste) dovrebbe puntare a ${newActualNodeIndex}.`);
      // Potrebbe essere necessario un aggiustamento più fine qui se l'inserimento avviene
      // su segmenti di freccia che non sono il primo segmento in uscita da un IF.
      // L'attuale logica di aggiornamento dei next al punto 2) dovrebbe già gestire
      // il fatto che il nodo *prima* di newActualNodeIndex (se non è parentNodeIndex stesso)
      // ora punti a newActualNodeIndex+1, e deve essere corretto a newActualNodeIndex.
      // Questa parte è complessa; la logica attuale del parentLogic.next = ... è più robusta.
      // La correzione del next del nodo *immediatamente precedente* al newActualNodeIndex è cruciale.
      // Se parentNodeIndex è l'immediato predecessore, il suo next viene aggiornato.
      // Se c'è un altro nodo tra parentNodeIndex e il punto di inserzione logica,
      // il suo 'next' viene gestito dal ciclo al punto 2, ma bisogna assicurare che punti
      // al nuovo nodo inserito, non a quello slittato.
      // L'aggiornamento del next del nodo *effettivamente* precedente al nuovo nodo inserito:
      if (flow.nodes[newActualNodeIndex-1] && flow.nodes[newActualNodeIndex-1] !== parentLogic ) {
         // Questo scenario è complesso. Se la freccia cliccata non parte direttamente
         // dal parentNodeIndex che definisce il ramo (es. clic su un segmento orizzontale
         // di un gomito), allora il 'fromNodeIndex' della freccia potrebbe essere diverso
         // dal nodo IF che ha originato quel ramo.
         // La logica principale di aggiornamento del 'next' del *nodo che deve puntare al nuovo nodo*
         // è quella che modifica parentLogic.next o n.next.
         // Se parentNodeIndex è il nodo logico che deve puntare al nuovo nodo, allora la sua proprietà .next (o .next.true/.next.false)
         // deve essere newActualNodeIndex.toString().
         // Il ciclo al punto 2) si occupa di far slittare i puntatori dei nodi *successivi*.
         // Il puntatore del nodo *precedente* al nuovo nodo (che è flow.nodes[parentNodeIndex])
         // DEVE essere aggiornato per puntare a newActualNodeIndex.

         // Se arrowType non è if_join, if_true, if_false, significa che l'inserimento è su un
         // collegamento 'normal' o su un segmento secondario di un IF.
         // In questo caso, è il nodo logico all'indice `parentNodeIndex` (quello da cui parte la freccia cliccata)
         // che deve avere il suo `next` (o `next.true`/`next.false` se `parentNodeIndex` è un IF e
         // `arrowType` identifica un ramo specifico) aggiornato a `newActualNodeIndex`.
         // Questo viene già fatto sotto.
    }
  }
  // Se il genitore non è un IF (inserimento "normale" dopo un nodo qualsiasi)
  }else if (parentLogic) {
    parentLogic.next = newActualNodeIndex.toString(); // Il genitore punta al nuovo nodo
    console.log(`inserisciNodo INFO: Genitore non-IF → next = ${newActualNodeIndex}`);
  }


  // 4) Calcolo della posizione X relativa (relX) del nuovo nodo visuale
  const parentVis = nodi[parentNodeIndex]; // Nodo visuale genitore
  let newRelX; // Posizione X relativa del nuovo nodo
  const elbowOffset = 40; // Offset in pixel per i "gomiti" delle frecce IF

  if (parentLogic && parentLogic.type === "if") { // Se il genitore è un IF
    if (arrowType === "if_join" && parentVis) { // Inserimento su un join sotto l'IF
      newRelX = parentVis.relX; // Allinea con l'IF genitore
    }
    else if (arrowType === "if_true" && parentVis) { // Inserimento nel ramo true
      const prX = parentVis.relX * w + parentVis.width / 2; // Bordo destro del genitore
      newRelX = (prX + elbowOffset) / w; // Posiziona a destra, considerando il gomito
    }
    else if (arrowType === "if_false" && parentVis) { // Inserimento nel ramo false
      const plX = parentVis.relX * w - parentVis.width / 2; // Bordo sinistro del genitore
      newRelX = (plX - elbowOffset) / w; // Posiziona a sinistra, considerando il gomito
    }
    else { // Inserimento su un collegamento che non è un ramo diretto (es. esterno o segmento mancante)
      newRelX = parentVis ? parentVis.relX : 0.5; // Allinea al centro dell'IF o default a 0.5 se genitore visuale non trovato
    }
  }
  else if (parentVis && arrowType === "normal") { // Inserimento normale dopo un nodo non-IF
    newRelX = parentVis.relX; // Allinea con il genitore
  }
  else { // Caso di fallback o se non c'è un genitore visuale chiaro (es. inserimento dopo lo start iniziale in una lista vuota)
    newRelX = 0.5; // Posizione di default al centro
  }

  // Clamp (limita) newRelX per evitare che il nodo esca dai margini laterali del canvas
  const nodeWidth = 100; // Larghezza di default del nuovo nodo
  const minRX = (nodeWidth / 2) / w + 0.01; // Minima relX consentita
  const maxRX = 1 - ((nodeWidth / 2) / w) - 0.01; // Massima relX consentita
  if (newRelX < minRX) newRelX = minRX;
  if (newRelX > maxRX) newRelX = maxRX;

  console.log(`inserisciNodo INFO: newRelX = ${newRelX.toFixed(3)}`);

  // 5) Inserimento del nuovo nodo visuale nell'array 'nodi' e ridisegno del flowchart
  nodi.splice(newActualNodeIndex, 0, { // Inserisce il nuovo oggetto nodo visuale
    relX: newRelX, // Posizione X relativa calcolata
    relY: 0, // La relY verrà calcolata da calcoloY()
    width: nodeWidth, // Larghezza standard
    height: NODE_BASE_HEIGHT_PX, // Altezza standard
    color: "white", // Colore di default
    text: tipo.charAt(0).toUpperCase() + tipo.slice(1) // Testo del nodo (es. "Input", "Print")
  });
  console.log(`inserisciNodo INFO: Nodo visivo inserito in indice ${newActualNodeIndex}.`);

  calcoloY(nodi); // Ricalcola le posizioni Y di tutti i nodi
  draw(nodi);     // Ridisegna l'intero flowchart

  chiudiPopup(); // Chiude il popup di selezione del tipo di nodo
  frecceSelected = -1; // Deseleziona la freccia
}

  // Gestisce il click su un nodo.
  // Se il nodo non è 'start' o 'end', apre il popup per modificarne le informazioni.
  function clickNodo(event) {
    // Calcola le coordinate del click relative al canvas
    let rect = canvas.getBoundingClientRect();
    let clickX = event.clientX - rect.left;
    let clickY = event.clientY - rect.top;

    // Itera sui nodi visuali per verificare se uno è stato cliccato
    for (let i = 0; i < nodi.length; i++) {
      const node = nodi[i]; // Nodo visuale corrente
      const x0 = node.relX * w - node.width / 2;
      const y0 = node.relY * h - node.height / 2;
      const x1 = x0 + node.width;
      const y1 = y0 + node.height;

      // Controlla se il click è all'interno del nodo
      if (clickX >= x0 && clickX <= x1 && clickY >= y0 && clickY <= y1) {
        console.log("Hai cliccato il nodo", i);
        // Apre il popup di modifica solo per nodi che non siano 'start' o 'end'
        if (flow.nodes[i].type != "start" && flow.nodes[i].type != "end") {
          document.getElementById("edit-node-popup").classList.add("active");
          document.getElementById("overlay").classList.add("active"); 
          document.getElementById("edit-node-title").innerHTML = "Edit " + flow.nodes[i].type +" node"; 
          document.getElementById("edit-node-input").value = flow.nodes[i].info || ""; 
        }
        nodoSelected = i;
        return;
      }
    }
  }

  // Elimina il nodo attualmente selezionato (nodoSelected) dal flowchart.
  // Aggiorna gli indici 'next' dei nodi rimanenti e ridisegna.
  function deleteNode(){
    if (nodoSelected === -1 || nodoSelected >= flow.nodes.length) return; // Nessun nodo selezionato o indice non valido

    flow.nodes.splice(nodoSelected,1); 
    for(let i = 0; i < flow.nodes.length; i++) {
        const n = flow.nodes[i];
        if (n.type === "if" && typeof n.next === "object" && n.next !== null) {
            let trueNext = parseInt(n.next.true, 10);
            let falseNext = parseInt(n.next.false, 10);
            if (!isNaN(trueNext) && trueNext > nodoSelected) {
                n.next.true = (trueNext - 1).toString();
            }
            if (!isNaN(falseNext) && falseNext > nodoSelected) {
                n.next.false = (falseNext - 1).toString();
            }
        } else if (typeof n.next === "string" && n.next !== null) {
            let normalNext = parseInt(n.next, 10);
            if (!isNaN(normalNext) && normalNext > nodoSelected) {
                n.next = (normalNext - 1).toString();
            }
        }
    }


    nodi.splice(nodoSelected,1); // Rimuove il nodo visuale
    nodoSelected = -1; // Deseleziona
    calcoloY(nodi); // Ricalcola le Y
    draw(nodi); // Ridisegna
    chiudiEditPopup(); // Chiude l'eventuale popup di modifica
  }

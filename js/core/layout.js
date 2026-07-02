
// Ridimensiona il canvas per adattarsi dinamicamente al contenuto dei nodi.
function resizeCanvasToFitNodes(nodi) {
  const margin = 100;        // Spazio extra in pixel intorno ai nodi
  const scrollPadding = 300; // Spazio aggiuntivo in pixel per consentire sempre lo scorrimento

  let maxX = 0, maxY = 0; // Coordinate massime (in pixel) raggiunte dai nodi

  for (const node of nodi) {
    const nodeX = node.relX * canvas.width; // Posizione X assoluta del nodo
    const nodeY = node.relY * canvas.height; // Posizione Y assoluta del nodo
    if (nodeX > maxX) maxX = nodeX;
    if (nodeY > maxY) maxY = nodeY;
  }

  // Calcola la larghezza e l'altezza necessarie per contenere tutti i nodi più i margini e lo spazio per lo scorrimento
  const requiredWidth = Math.max(container.offsetWidth, maxX + margin + scrollPadding);
  const requiredHeight = Math.max(container.offsetHeight, maxY + margin + scrollPadding);

  // Ridimensiona il canvas solo se le dimensioni calcolate sono diverse da quelle attuali
  if (canvas.width !== requiredWidth || canvas.height !== requiredHeight) {
    canvas.width = requiredWidth;
    canvas.height = requiredHeight;
    w = canvas.width; // Aggiorna la larghezza globale
    h = canvas.height; // Aggiorna l'altezza globale
  }
}

function calcoloY(nodiVisualArray) {
  if (!flow.nodes.length || !nodiVisualArray.length || !h) {
    console.warn("calcoloY: Dati mancanti o canvas non inizializzato correttamente.");
    return;
  }

  // 1) Reset di tutte le Y
  for (let node of nodiVisualArray) {
    node.relY = 0;
  }

  // 2) Per evitare sovrapposizioni orizzontali, teniamo traccia
  //    del massimo Y già assegnato per ciascuna “colonna” relX
  const maxYAtColumn = {};

  /**
   * Funzione ricorsiva che assegna la relY a currentNodeIndex.
   * * @param {number} currentNodeIndex          – Indice nell’array flow.nodes / nodiVisualArray
   * @param {number} predecessorBottomY        – Punto di partenza (in relY) sotto cui posizionare questo nodo
   * @param {Set<number>} visitedInPath       – Set di nodi già visti lungo questo percorso (evita cicli)
   * @returns {number}                        – Y “massima” (bottom) raggiunta da questo percorso ricorsivo
   */
  function calculateNodeYRecursive(currentNodeIndex, predecessorBottomY, visitedInPath) {
    if (
      currentNodeIndex === null ||
      currentNodeIndex === undefined ||
      visitedInPath.has(currentNodeIndex)
    ) {
      // Se non c’è nodo valido o abbiamo già visitato questo indice → esco restituendo la Y passata
      return predecessorBottomY;
    }
    visitedInPath.add(currentNodeIndex);

    const visualNode  = nodiVisualArray[currentNodeIndex];
    const logicalNode = flow.nodes[currentNodeIndex];
    if (!visualNode || !logicalNode) {
      return predecessorBottomY;
    }

    // Calcolo altezza del nodo (relativa al canvas)
    const nodeHeightRel = (visualNode.height || NODE_BASE_HEIGHT_PX) / h;
    const columnKey     = visualNode.relX.toFixed(2);

    // 2.a) Decido la Y “top” di questo nodo:
    //      deve essere almeno predecessorBottomY,  
    //      ma non deve sovrapporsi a un nodo già in quella stessa colonna.
    let proposedTopY = predecessorBottomY;
    if (maxYAtColumn[columnKey] !== undefined && maxYAtColumn[columnKey] > proposedTopY) {
      proposedTopY = maxYAtColumn[columnKey];
    }
    if (visualNode.relY > proposedTopY) {
      proposedTopY = visualNode.relY;
    }

    // Assegno relY
    visualNode.relY = proposedTopY;

    // Calcolo bottomY (top + altezza + spacing)
    const bottomY = visualNode.relY + nodeHeightRel + NODE_VERTICAL_SPACING_BASE_REL;
    if (!maxYAtColumn[columnKey] || bottomY > maxYAtColumn[columnKey]) {
      maxYAtColumn[columnKey] = bottomY;
    }

    // Per default, il “massimo percorso” inizia come questo bottomY
    let maxPathYReached = bottomY;

    // 3) Se è un IF, devo decidere se trattarlo “lineare” o “ramificato”
    if (logicalNode.type === "if" && typeof logicalNode.next === "object" && logicalNode.next !== null) {
      const trueNextIdx  = parseInt(logicalNode.next.true, 10);
      const falseNextIdx = parseInt(logicalNode.next.false, 10);

      // Se next.true === next.false, NON è stato ancora creato un ramo
      // → comportiamoci come se fosse un collegamento “normale” a quell’unico nodo
      if (!isNaN(trueNextIdx) && trueNextIdx === falseNextIdx) {
        // scendo direttamente, senza ramificare
        const yDown = calculateNodeYRecursive(
          trueNextIdx,
          bottomY,
          new Set(visitedInPath)
        );
        maxPathYReached = Math.max(maxPathYReached, yDown);
      }
      // Altrimenti (trueNextIdx !== falseNextIdx), è un IF veramente ramificato:
      // disegno i due sub‐rami a partire da un “branch start Y”
      else {
        const branchStartY = visualNode.relY + nodeHeightRel + IF_BRANCH_START_Y_OFFSET_REL;

        // 3.a) Ramo TRUE
        if (!isNaN(trueNextIdx)) {
          const yTrue = calculateNodeYRecursive(
            trueNextIdx,
            branchStartY,
            visitedInPath
          );
          if (yTrue > maxPathYReached) maxPathYReached = yTrue;
        }
        // 3.b) Ramo FALSE
        if (!isNaN(falseNextIdx)) {
          const yFalse = calculateNodeYRecursive(
          falseNextIdx,
          branchStartY,
          visitedInPath
        );
          if (yFalse > maxPathYReached) maxPathYReached = yFalse;
        }

        // 3.c) Se i due rami confluiscono su uno stesso nodo (join),
        //       lo posiziono subito sotto il massimo dei due.
        if (trueNextIdx === falseNextIdx && !isNaN(trueNextIdx)) {
          const joinIdx    = trueNextIdx;
          const joinNode   = nodiVisualArray[joinIdx];
          const joinTopY   = maxPathYReached + NODE_VERTICAL_SPACING_BASE_REL;
          if (joinNode && (joinNode.relY < joinTopY)) {
            joinNode.relY = joinTopY;
            const joinBottomY = joinNode.relY + (joinNode.height / h) + NODE_VERTICAL_SPACING_BASE_REL;
            const ck = joinNode.relX.toFixed(2);
            if (!maxYAtColumn[ck] || joinBottomY > maxYAtColumn[ck]) {
              maxYAtColumn[ck] = joinBottomY;
            }
            // 3.c.i) Dopodiché, lavoro sul nodo successivo al join (se esiste)
            const nextOfJoin = flow.nodes[joinIdx].next;
            if (typeof nextOfJoin === "string") {
              const postIdx = parseInt(nextOfJoin, 10);
              if (!isNaN(postIdx)) {
                const yAfterJoin = calculateNodeYRecursive(
                  postIdx,
                  joinBottomY,
                  new Set(visitedInPath)
                );
                if (yAfterJoin > joinBottomY) {
                  maxPathYReached = yAfterJoin;
                }
              }
            }
            // Se non ci sono ulteriori nodi, il maxPathYReached rimane joinBottomY
            maxPathYReached = Math.max(maxPathYReached, joinBottomY);
          }
        }
      }

      return maxPathYReached;
    }

    // 4) Se NON è un IF ma ha un next “normale”
    if (typeof logicalNode.next === "string" && logicalNode.next !== null) {
      const nextIdx = parseInt(logicalNode.next, 10);
      if (!isNaN(nextIdx)) {
        const yNext = calculateNodeYRecursive(
          nextIdx,
          bottomY,
          new Set(visitedInPath)
        );
        if (yNext > maxPathYReached) maxPathYReached = yNext;
      }
    }

    return maxPathYReached;
  }

  // 5) Trovo “start” (o indice 0 se non c’è) e do il via alla ricorsione
  let startIndex = flow.nodes.findIndex(nd => nd.type === "start");
  if (startIndex < 0 && flow.nodes.length > 0) startIndex = 0;

  if (startIndex >= 0 && nodiVisualArray[startIndex]) {
    const startNode    = nodiVisualArray[startIndex];
    startNode.relY     = NODE_VERTICAL_SPACING_BASE_REL / 2; // un po’ di margine su Y=0
    const startHeight  = (startNode.height || NODE_BASE_HEIGHT_PX) / h;
    const startBotY    = startNode.relY + startHeight + NODE_VERTICAL_SPACING_BASE_REL;
    const col0         = startNode.relX.toFixed(2);
    maxYAtColumn[col0] = startBotY;

    const logicStart   = flow.nodes[startIndex];
    // Se è IF, controllo se next.true===next.false per elaborarlo di conseguenza
    if (logicStart.type === "if" && typeof logicStart.next === "object" && logicStart.next !== null) {
      const t0 = parseInt(logicStart.next.true, 10);
      const f0 = parseInt(logicStart.next.false, 10);

      if (!isNaN(t0) && t0 === f0) {
        // IF lineare: trattalo come un normale “next”
        calculateNodeYRecursive(t0, startBotY, new Set([startIndex]));
      } else {
        // IF ramificato: faccio i due rami sotto
        const branchY = startNode.relY + startHeight + IF_BRANCH_START_Y_OFFSET_REL;
        if (!isNaN(t0)) {
          calculateNodeYRecursive(t0, branchY, new Set([startIndex]));
        }
        if (!isNaN(f0)) {
          calculateNodeYRecursive(f0, branchY, new Set([startIndex]));
        }
        // Se confluiscono sullo stesso nodo (join iniziale)
        if (t0 === f0 && !isNaN(t0)) {
          const joinIdx   = t0;
          const joinNode  = nodiVisualArray[joinIdx];
          const joinTopY  = branchY; // max dei due rami è branchY, perché erano allo stesso livello
          if (joinNode && (joinNode.relY < joinTopY)) {
            joinNode.relY = joinTopY;
            const joinBotY = joinNode.relY + ((joinNode.height || NODE_BASE_HEIGHT_PX) / h) + NODE_VERTICAL_SPACING_BASE_REL;
            const colJ     = joinNode.relX.toFixed(2);
            if (!maxYAtColumn[colJ] || joinBotY > maxYAtColumn[colJ]) {
              maxYAtColumn[colJ] = joinBotY;
            }
            // Poi eventuale next dopo merge
            const post = flow.nodes[joinIdx].next;
            if (typeof post === "string") {
              const postIdx = parseInt(post, 10);
              if (!isNaN(postIdx)) {
                calculateNodeYRecursive(postIdx, joinBotY, new Set([startIndex, joinIdx]));
              }
            }
          }
        }
      }
    }
    // Se “start” non è IF ma ha un next normale
    else if (typeof logicStart.next === "string") {
      const nxt0 = parseInt(logicStart.next, 10);
      if (!isNaN(nxt0)) {
        calculateNodeYRecursive(nxt0, startBotY, new Set([startIndex]));
      }
    }
  } else {
    console.warn("calcoloY: nodo di start non trovato o non valido.");
  }
}

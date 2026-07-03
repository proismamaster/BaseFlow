
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

  // Reset di tutte le Y
  for (const node of nodiVisualArray) {
    node.relY = 0;
  }

  // Per ogni colonna relativa, traccia la Y più bassa già occupata
  const maxYAtColumn = {};

  function placeNode(idx, topRel, col) {
    const v = nodiVisualArray[idx];
    const n = flow.nodes[idx];
    if (!v || !n) return null;
    const nodeH = (v.height || NODE_BASE_HEIGHT_PX) / h;
    const colKey = col.toFixed(2);
    let proposedTop = topRel;
    if (maxYAtColumn[colKey] !== undefined && maxYAtColumn[colKey] > proposedTop) {
      proposedTop = maxYAtColumn[colKey];
    }
    if (v.relY > proposedTop) {
      proposedTop = v.relY;
    }
    v.relY = proposedTop;
    v.relX = 0.5 + col * IF_BRANCH_X_OFFSET_REL;
    const bottom = v.relY + nodeH;
    const bottomWithGap = bottom + NODE_VERTICAL_SPACING_BASE_REL;
    if (!maxYAtColumn[colKey] || bottomWithGap > maxYAtColumn[colKey]) {
      maxYAtColumn[colKey] = bottomWithGap;
    }
    return bottom;
  }

  function layoutNode(idx, topRel, col, visited, stopIdx) {
    if (idx === null || idx === undefined || visited.has(idx) || idx === stopIdx) {
      return topRel;
    }
    visited.add(idx);
    const v = nodiVisualArray[idx];
    const n = flow.nodes[idx];
    if (!v || !n) return topRel;

    const bottom = placeNode(idx, topRel, col);

    if (n.type === "if" && typeof n.next === "object" && n.next !== null) {
      const sub = collectBranchNodes(idx);
      const branchTop = bottom + IF_BRANCH_START_Y_OFFSET_REL;

      let trueDepth = branchTop;
      if (sub.trueList.length > 0) {
        let curTop = branchTop;
        for (const nodeIdx of sub.trueList) {
          curTop = layoutNode(nodeIdx, curTop, col + 1, visited, sub.joinIndex);
        }
        const lastV = nodiVisualArray[sub.trueList[sub.trueList.length - 1]];
        trueDepth = lastV.relY + (lastV.height || NODE_BASE_HEIGHT_PX) / h;
      }

      let falseDepth = branchTop;
      if (sub.falseList.length > 0) {
        let curTop = branchTop;
        for (const nodeIdx of sub.falseList) {
          curTop = layoutNode(nodeIdx, curTop, col - 1, visited, sub.joinIndex);
        }
        const lastV = nodiVisualArray[sub.falseList[sub.falseList.length - 1]];
        falseDepth = lastV.relY + (lastV.height || NODE_BASE_HEIGHT_PX) / h;
      }

      const reconnectRelY = Math.max(trueDepth, falseDepth) + IF_RECONNECT_GAP_REL;

      if (sub.joinIndex !== null && !visited.has(sub.joinIndex)) {
        // Gap FISSO in px (convertito in relativo con l'h corrente): l'arco finale
        // dell'IF resta di lunghezza costante e non si allunga quando i rami crescono.
        // NB: il join viene piazzato una sola volta dentro layoutNode (che chiama placeNode).
        // Un placeNode esplicito qui lo piazzerebbe due volte, gonfiando maxYAtColumn e
        // spingendo il join giu' di (altezza + spacing) -> arco che cresce con h. Rimosso.
        const joinTop = reconnectRelY + IF_JOIN_GAP_PX / h;
        return layoutNode(sub.joinIndex, joinTop, col, visited, stopIdx);
      }
      return reconnectRelY;
    }

    if (typeof n.next === "string" && n.next !== null) {
      const nextIdx = parseInt(n.next, 10);
      if (!isNaN(nextIdx)) {
        if (nextIdx === stopIdx) return bottom;
        return layoutNode(nextIdx, bottom + NODE_VERTICAL_SPACING_BASE_REL, col, visited, stopIdx);
      }
    }

    return bottom + NODE_VERTICAL_SPACING_BASE_REL;
  }

  const startIndex = flow.nodes.findIndex(nd => nd && nd.type === "start");
  if (startIndex >= 0 && nodiVisualArray[startIndex]) {
    layoutNode(startIndex, NODE_VERTICAL_SPACING_BASE_REL / 2, 0, new Set(), null);
  } else if (nodiVisualArray.length > 0) {
    layoutNode(0, NODE_VERTICAL_SPACING_BASE_REL / 2, 0, new Set(), null);
  }
}

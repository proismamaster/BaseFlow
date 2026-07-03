
// Adapta le dimensioni del canvas quando la finestra del browser viene ridimensionata e ridisegna l'intero flowchart.
function resizeCanvas() {
  canvas.width = window.innerWidth - 10; // Imposta la larghezza del canvas quasi come la finestra
  canvas.height = window.innerHeight - 10; // Imposta l'altezza del canvas quasi come la finestra
  ctx = canvas.getContext("2d");
  w = canvas.width; // Aggiorna la larghezza globale
  h = canvas.height; // Aggiorna l'altezza globale
  draw(nodi); // Ridisegna tutto
}

// Disegna una linea e, se salva=true, la registra nell'array frecce[].
// Disegna una linea tra due punti.
// Se 'salva' è true, la linea viene aggiunta all'array 'frecce' per la rilevazione dei click,
// includendo informazioni sul nodo di partenza, di destinazione e il tipo di freccia.
function drawLine(x1, y1, x2, y2, salva, fromNodeIndex, toNodeIndex, arrowType) {
  if (salva) {
    frecce.push({
      inzioX: x1, inzioY: y1, fineX: x2, fineY: y2, // Coordinate della freccia
      id: frecce.length,
      fromNodeIndex: fromNodeIndex, // Indice del nodo di partenza nella logica flow.nodes
      toNodeIndex: toNodeIndex,
      type: arrowType         // Tipo di freccia: 'normal', 'if_true', 'if_false'
    });
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.stroke();
}


// FUNZIONE PRINCIPALE draw(forme):
//  Calcola quanti collegamenti in entrata (incoming) ha ciascun nodo logico (flow.nodes).
//  Costruisce joinSet = un insieme di indici di nodi che hanno almeno 2 collegamenti in entrata.
//  Disegna i nodi (considerando colori, forme specifiche per tipo, e testo interno).
//  Per ogni collegamento “next” definito in flow.nodes:
//      Se il collegamento proviene da un nodo IF (distinguendo ramo true e false),
//       utilizza le funzioni drawArrowFromRight o drawArrowFromLeft.
//      Altrimenti (collegamento “normale”), se il nodo di destinazione è in joinSet (cioè ha multipli ingressi),
//       disegna una connessione spezzata (verticale, orizzontale, verticale).
//      Se non è un IF e non va a un join node, disegna una linea retta semplice usando drawLine
function draw(forme) {
  // 1) Calcolo incomingCount e joinSet
  const incomingCount = Array(flow.nodes.length).fill(0); //per contare gli ingressi per ogni nodo
  for (let i = 0; i < flow.nodes.length; i++) {
    const nd = flow.nodes[i];
    if (!nd) continue;
    if (nd.type === "if" && typeof nd.next === "object" && nd.next !== null) {
      const t = parseInt(nd.next.true, 10); // Indice del nodo successivo per il ramo true
      const f = parseInt(nd.next.false, 10); // Indice del nodo successivo per il ramo false
      if (!isNaN(t) && t < incomingCount.length) incomingCount[t]++;
      if (!isNaN(f) && f < incomingCount.length) incomingCount[f]++;
    } else if (typeof nd.next === "string" && nd.next !== null) {
      const n = parseInt(nd.next, 10); // Indice del nodo successivo normale
      if (!isNaN(n) && n < incomingCount.length) incomingCount[n]++;
    }
  }
  const joinSet = new Set(); // Insieme degli indici dei nodi che sono punti di join
  for (let k = 0; k < incomingCount.length; k++) {
    if (incomingCount[k] >= 2) joinSet.add(k);
  }
  console.log("joinSet:", Array.from(joinSet));

  // 2) Resize e pulizia del canvas
  resizeCanvasToFitNodes(forme); // Adatta le dimensioni del canvas ai nodi
  ctx.clearRect(0, 0, w, h); // Pulisce il canvas
  frecce = []; // Resetta l'array delle frecce visuali

   // 3) DISEGNO DI TUTTI I NODI
  for (let i = 0; i < forme.length; i++) {
    const node = forme[i]; // Nodo visuale corrente
    if (!node) continue;

    const tipo = flow.nodes[i].type; // Tipo del nodo logico corrispondente
    let coloreNodo;
    switch (tipo) {
      case "start":       coloreNodo = "green";      break;
      case "end":         coloreNodo = "red";        break;
      case "read": case "input":     coloreNodo = "gray";       break;
      case "write": case "output": case "print":     coloreNodo = "lightblue";  break;
      case "assign": case "assignment": coloreNodo = "yellow";    break;
      case "if":          coloreNodo = "orange";     break;
      default:            coloreNodo = node.color;   break; // Colore di default se non specificato
    }

    let x0 = node.relX * w - node.width / 2;
    const y0 = node.relY * h - node.height / 2;
    const cx = x0 + node.width / 2;
    const cy = y0 + node.height / 2;

    // Disegno della forma (rettangolo arrotondato, parallelogramma, rombo, o rettangolo normale)
    ctx.fillStyle   = coloreNodo; // Imposta il colore di riempimento
    ctx.strokeStyle = "black"; // Imposta il colore del bordo

    let toWrite = node.text; // Testo base del nodo
      if (flow.nodes[i] && !["start", "end"].includes(flow.nodes[i].type)) {
        toWrite += ":" + (flow.nodes[i].info || ""); // Aggiunge le informazioni specifiche del nodo se non è start/end
    }
    const textMeasure = ctx.measureText(toWrite);

    // Adattamento larghezza nodo al testo
    let difference = node.width  - textMeasure.width + 20;
    if(difference>100){ // Limita la riduzione della larghezza
      node.width = 100;
      x0 = node.relX * w - node.width / 2;
    }
    if(node.width<(textMeasure.width+20)){ // Se il nodo è troppo stretto per il testo
      difference = textMeasure.width+20 - node.width;
      x0 -= difference/2;
      node.width = textMeasure.width+20;
    }

    switch (tipo) { // Disegna la forma specifica in base al tipo di nodo
      case "start":
      case "end":
        drawRoundedRect(x0, y0, node.width, node.height, 10); // 10 è il raggio degli angoli
        break;
      case "read": case "input":
      case "write": case "output": case "print":
      case "assign": case "assignment":
        drawParallelogram(x0, y0, node.width, node.height, 20); // 20 è l'inclinazione
        break;
      case "if":
        drawDiamond(x0, y0, node.width, node.height);
        break;
      default: // Nodo di tipo non riconosciuto o generico
        ctx.beginPath();
        ctx.rect(x0, y0, node.width, node.height);
        ctx.closePath();
        break;
    }
    ctx.fill(); // Riempie la forma
    ctx.stroke(); // Disegna il bordo

    if (node.text) {
      ctx.font = `bold 16px Arial`;
      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(toWrite, cx, cy);
    }
  }

  // 4) DISEGNO DEI COLLEGAMENTI
  // Raccoglie i nodi che fanno parte di un ramo IF: i loro collegamenti sono gestiti dal genitore IF.
  const branchNodes = new Set();
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i];
    if (n && n.type === "if" && typeof n.next === "object" && n.next !== null) {
      const sub = collectBranchNodes(i);
      sub.trueList.forEach(idx => branchNodes.add(idx));
      sub.falseList.forEach(idx => branchNodes.add(idx));
    }
  }

  for (let i = 0; i < forme.length; i++) {
    const node = forme[i]; // Nodo visuale di partenza
    const logicNode = flow.nodes[i]; // Nodo logico di partenza
    if (!logicNode || !node) continue;

    const xMid = node.relX * w; // Coordinata X del centro del nodo di partenza
    const yMid = node.relY * h; // Coordinata Y del centro del nodo di partenza
    const nodeHeight = node.height; // Altezza del nodo di partenza

    // 4.a) Se è IF, disegno i rami con la nuova logica
    if (logicNode.type === "if" && typeof logicNode.next === "object" && logicNode.next !== null) {
      drawIfBranches(i, node);
      continue;
    }

    // 4.b) Collegamento “normale” (next è una stringa che indica l'indice del prossimo nodo)
    if (typeof logicNode.next === "string" && logicNode.next !== null) {
      const nextIndex = parseInt(logicNode.next, 10); // Indice del prossimo nodo
      if (isNaN(nextIndex) || !forme[nextIndex]) continue; // Salta se l'indice non è valido o il nodo visuale non esiste

      // Se il nodo corrente fa parte di un ramo IF, il suo collegamento è gestito dal genitore IF
      if (branchNodes.has(i)) continue;

      const targetNodeVisual = forme[nextIndex]; // Nodo visuale di destinazione
      drawLine(
        xMid, // Dal centro X del nodo di partenza
        yMid + nodeHeight / 2, // Dal bordo inferiore del nodo di partenza
        targetNodeVisual.relX * w, // Al centro X del nodo di destinazione
        targetNodeVisual.relY * h - targetNodeVisual.height / 2, // Al bordo superiore del nodo di destinazione
        true,
        i,
        nextIndex,
        'normal'
      );
    }
  }
}

// Disegna i rami di un IF secondo la nuova logica:
// - stelo e biforcazione NON cliccabili;
// - archi verticali di ingresso ai rami CLICCABILI;
// - archi orizzontali di ricongiunzione NON cliccabili;
// - arco verticale di uscita dall'IF CLICCABILE.
function drawIfBranches(ifIdx, node) {
  const sub = collectBranchNodes(ifIdx);
  const cx = node.relX * w;
  const cy = node.relY * h;
  const diaBottom = cy + node.height / 2;
  // La biforcazione si ferma a metà dell'offset: la metà restante è l'arco
  // verticale di ingresso al ramo, che deve avere lunghezza > 0 per essere cliccabile.
  const forkY = diaBottom + (IF_BRANCH_START_Y_OFFSET_REL * h) / 2;
  const trueX = cx + IF_BRANCH_X_OFFSET_REL * w;
  const falseX = cx - IF_BRANCH_X_OFFSET_REL * w;

  // Stelo verticale non cliccabile sotto il rombo
  drawLine(cx, diaBottom, cx, forkY, false);

  // Biforcazione orizzontale non cliccabile
  drawLine(cx, forkY, trueX, forkY, false);
  drawLine(cx, forkY, falseX, forkY, false);

  // Profondità dei due rami (in pixel)
  const trueBottomY = sub.trueList.length > 0
    ? nodi[sub.trueList[sub.trueList.length - 1]].relY * h + nodi[sub.trueList[sub.trueList.length - 1]].height / 2
    : forkY;
  const falseBottomY = sub.falseList.length > 0
    ? nodi[sub.falseList[sub.falseList.length - 1]].relY * h + nodi[sub.falseList[sub.falseList.length - 1]].height / 2
    : forkY;
  const reconnectY = Math.max(trueBottomY, falseBottomY) + IF_RECONNECT_GAP_REL * h;

  // Archi verticali cliccabili dalle colonne dei rami verso il basso
  if (sub.trueList.length === 0) {
    drawLine(trueX, forkY, trueX, reconnectY, true, ifIdx, sub.joinIndex, 'if_true');
  } else {
    const first = nodi[sub.trueList[0]];
    drawLine(trueX, forkY, trueX, first.relY * h - first.height / 2, true, ifIdx, sub.trueList[0], 'if_true');
  }

  if (sub.falseList.length === 0) {
    drawLine(falseX, forkY, falseX, reconnectY, true, ifIdx, sub.joinIndex, 'if_false');
  } else {
    const first = nodi[sub.falseList[0]];
    drawLine(falseX, forkY, falseX, first.relY * h - first.height / 2, true, ifIdx, sub.falseList[0], 'if_false');
  }

  // Collegamenti interni ai rami e archi di ricongiunzione
  function drawBranchConnections(list, sideX) {
    for (let i = 0; i < list.length - 1; i++) {
      const fromNode = nodi[list[i]];
      const toNode = nodi[list[i + 1]];
      drawLine(
        fromNode.relX * w,
        fromNode.relY * h + fromNode.height / 2,
        toNode.relX * w,
        toNode.relY * h - toNode.height / 2,
        true,
        list[i],
        list[i + 1],
        'normal'
      );
    }
    if (list.length > 0) {
      const last = nodi[list[list.length - 1]];
      drawLine(last.relX * w, last.relY * h + last.height / 2, sideX, reconnectY, false);
    }
    drawLine(sideX, reconnectY, cx, reconnectY, false);
  }

  drawBranchConnections(sub.trueList, trueX);
  drawBranchConnections(sub.falseList, falseX);

  // Arco verticale cliccabile dal punto di ricongiunzione al nodo successivo
  if (sub.joinIndex !== null && nodi[sub.joinIndex]) {
    const joinNode = nodi[sub.joinIndex];
    drawLine(cx, reconnectY, cx, joinNode.relY * h - joinNode.height / 2, true, ifIdx, sub.joinIndex, 'if_join');
  }

  // Etichette T/F sopra la biforcazione
  ctx.fillStyle = "black";
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("T", (cx + trueX) / 2, forkY - 10);
  ctx.fillText("F", (cx + falseX) / 2, forkY - 10);
}

// Disegna il collegamento a forma di Lda:
//   l’ultimo nodo di un ramo IF (lastNode)
//   al bordo superiore del nodo esterno a cui si ricongiunge (joinNode)
//   1) una linea verticale dal centro del bordo inferiore di lastNode fino
//      alla coordinata Y del bordo superiore di joinNode,
//   2) una linea orizzontale da (startX, targetY) a (targetX, targetY).
function drawJoinConnectionFromLast(lastNode, joinNode, fromNodeIndex, toNodeIndex) {
  // 1) Calcolo coordinate del fondo di lastNode (punto di partenza della connessione)
  const startX = lastNode.relX * w; // X del centro di lastNode
  const startY = lastNode.relY * h + lastNode.height / 2; // Y del bordo inferiore di lastNode

  // 2) Calcolo coordinate del bordo superiore di joinNode (punto Y di destinazione)
  const targetX = joinNode.relX * w; // X del centro di joinNode
  const targetY = joinNode.relY * h - joinNode.height / 2; // Y del bordo superiore di joinNode

  // 3) Traccio il primo spezzone verticale (da startY fino a targetY, mantenendo startX)
  drawLine(
    startX,
    startY,
    startX,
    targetY,
    true,
    fromNodeIndex,
    toNodeIndex,
    'normal'
  );

  // 4) Traccio il secondo spezzone orizzontale (da startX a targetX, mantenendo targetY)
  drawLine(
    startX,
    targetY,
    targetX,
    targetY,
    false,
    fromNodeIndex,
    toNodeIndex,
    'normal' // Tipo di freccia
  );
}

// Disegna il collegamento “da IF al prossimo nodo esterno” come:
//   1) Spezzone verticale cliccabile (dal centro-inferiore di if fino a un punto di join Y)
//   2) Spezzone orizzontale cliccabile (dal punto di join X,Y fino all’X di next sul medesimo Y)
//   3) Spezzone verticale (dal punto di join X,Y fino al bordo superiore di next)
function drawJoinConnection(fromNode, toNode, fromIndex, toIndex) {
  const fromX = fromNode.relX * w; // X del nodo di partenza
  const fromY = fromNode.relY * h + fromNode.height / 2; // Y del bordo inferiore del nodo di partenza
  const toX = toNode.relX * w; // X del nodo di arrivo
  const toY = toNode.relY * h - toNode.height / 2; // Y del bordo superiore del nodo di arrivo

  // Calcola una coordinata Y intermedia per il segmento orizzontale del "ponte"
  const joinY = Math.max(fromY, toY) + 80; // 80px sotto il più basso tra fromY e toY (o sopra se toY è molto in alto)

  // Linea verticale dal nodo 'from' al punto di joinY (non salvata come cliccabile individualmente)
  drawLine(fromX, fromY, fromX, joinY, false);

  // Linea orizzontale di join (salvata come cliccabile, rappresenta il "ponte")
  drawLine(fromX, joinY, toX, joinY, true, fromIndex, toIndex, 'join'); // 'join' come tipo

  // Linea verticale dal punto di joinY al nodo 'to' (non salvata come cliccabile individualmente)
  drawLine(toX, joinY, toX, toY, false);
}

// Disegna un rettangolo con angoli arrotondati (START E END)
function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Disegna un rettangolo (in,out,assing)
function drawParallelogram(x, y, width, height, skew) {
  ctx.beginPath();
  ctx.rect(x, y, width, height); // Disegna un semplice rettangolo
  ctx.closePath();
}

// Disegna un rombo centrato rispetto al rettangolo(if)
function drawDiamond(x, y, w, h) {
  const cx = x + w/2; // Centro X del rombo
  const cy = y + h/2; // Centro Y del rombo
  ctx.beginPath();
  ctx.moveTo(cx, y);      // Vertice superiore
  ctx.lineTo(x + w, cy);  // Vertice destro
  ctx.lineTo(cx, y + h);  // Vertice inferiore
  ctx.lineTo(x, cy);      // Vertice sinistro
  ctx.closePath();
}

// Disegna la freccia per il ramo TRUE di un nodo IF (esce dal lato destro del nodo IF).
function drawArrowFromRight(from, to, label, fromNodeIndex, toNodeIndex) {
  const verticalGapBeforeNode = 25; // Spazio verticale in px prima di entrare nel nodo target
  const startX_abs = from.relX * w + from.width / 2; // X del bordo destro del nodo
  const startY_abs = from.relY * h; // Y del centro del nodo 'from' (IF)
  const elbowColumnX_abs = startX_abs + 40; // X della colonna verticale del "gomito" (40px a destra di 'from')
  const targetX = to.relX * w; // X del centro del nodo 'to' (target del ramo true)
  const targetY = to.relY * h - to.height / 2; // Y del bordo superiore del nodo 'to'
  const turnY = targetY - verticalGapBeforeNode; // Y del segmento orizzontale del "gomito"

  // 1) Segmento orizzontale in uscita dal nodo IF (puramente visivo, non cliccabile individualmente)
  drawLine(
    startX_abs, startY_abs,
    elbowColumnX_abs, startY_abs,
    false, fromNodeIndex, toNodeIndex, 'if_true_h_out'
  );

  // 2) Caso “nodi allineati verticalmente sotto il gomito” → discesa verticale diretta dal gomito al nodo 'to'
  if (Math.abs(elbowColumnX_abs - targetX) < 0.5) { // Se la X del gomito e del target sono (quasi) uguali
    drawLine(
      elbowColumnX_abs, startY_abs,
      elbowColumnX_abs, targetY,
      true, fromNodeIndex, toNodeIndex, 'if_true'
    );
    // Etichetta “T” (True) a metà del segmento verticale
    const midY_for_label = (startY_abs + targetY) / 2;
    ctx.fillStyle = "black";
    ctx.font       = "12px Arial";
    ctx.textAlign  = "center";
    ctx.fillText(label, elbowColumnX_abs + 20, midY_for_label);
    return targetY;
  }

  // 3) Caso “nodi non allineati verticalmente” → disegnare un gomito interno (V1 + H + V2)
  drawLine(
    elbowColumnX_abs, startY_abs,
    elbowColumnX_abs, turnY,
    true, fromNodeIndex, toNodeIndex, 'if_true'
  );
  //   3.b) H: Segmento orizzontale visivo da X del gomito a X del target, alla quota 'turnY'
  drawLine(
    elbowColumnX_abs, turnY,
    targetX, turnY,
    false, fromNodeIndex, toNodeIndex, 'if_true_h_in'
  );
  //   3.c) V2: Segmento verticale visivo finale da 'turnY' fino al bordo superiore di 'to'
  drawLine(
    targetX, turnY,
    targetX, targetY,
    false, fromNodeIndex, toNodeIndex, 'if_true_v_to_target'
  );
  // Etichetta “T” (True) a metà del primo segmento verticale (V1)
  const midY_for_label = (startY_abs + turnY) / 2;
  ctx.fillStyle = "black";
  ctx.font       = "12px Arial";
  ctx.textAlign  = "center";
  ctx.fillText(label, elbowColumnX_abs + 20, midY_for_label);
  return turnY;
}

// Disegna il “ramo false” di un IF fino al nodo di destinazione.
function drawArrowFromLeft(from, to, label, fromNodeIndex, toNodeIndex) {
  const verticalGapBeforeNode = 25; // Spazio verticale in px
  const startX_abs       = from.relX * w - from.width / 2; // X del bordo sinistro di 'from'
  const startY_abs       = from.relY * h; // Y del centro di 'from'
  const elbowColumnX_abs = startX_abs - 40; // X della colonna del gomito (40px a sinistra di 'from')
  const targetX          = to.relX * w; // X del centro di 'to'
  const targetY          = to.relY * h - to.height / 2; // Y del bordo superiore di 'to'
  const turnY            = targetY - verticalGapBeforeNode; // Y del segmento orizzontale del gomito

  // 1) Segmento orizzontale in uscita da 'from' (visivo)
  drawLine(
    startX_abs, startY_abs,
    elbowColumnX_abs, startY_abs,
    false, fromNodeIndex, toNodeIndex, 'if_false_h_out'
  );

  // 2) Caso “nodi allineati X” → discesa verticale diretta
  if (Math.abs(elbowColumnX_abs - targetX) < 0.5) {
    // Segmento verticale cliccabile
    drawLine(
      elbowColumnX_abs, startY_abs,
      elbowColumnX_abs, targetY,
      true, fromNodeIndex, toNodeIndex, 'if_false'
    );
    // Etichetta “F” (False)
    const midY_for_label = (startY_abs + targetY) / 2;
    ctx.fillStyle = "red"; // Colore distintivo per il ramo False
    ctx.font       = "12px Arial";
    ctx.textAlign  = "center";
    ctx.fillText(label, elbowColumnX_abs - 20, midY_for_label); // 20px a sinistra del gomito
    return targetY; // Ritorna Y di arrivo
  }

  // 3) Caso “nodi non allineati X” → gomito interno (V1 + H + V2)
  drawLine(
    elbowColumnX_abs, startY_abs,
    elbowColumnX_abs, turnY,
    true, fromNodeIndex, toNodeIndex, 'if_false'
  );
  drawLine(
    elbowColumnX_abs, turnY,
    targetX, turnY,
    false, fromNodeIndex, toNodeIndex, 'if_false_h_in'
  );
  drawLine(
    targetX, turnY,
    targetX, targetY,
    false, fromNodeIndex, toNodeIndex, 'if_false_v_to_target'
  );
  // Etichetta “F” (False)
  const midY_for_label = (startY_abs + turnY) / 2;
  ctx.fillStyle = "red";
  ctx.font       = "12px Arial";
  ctx.textAlign  = "center";
  ctx.fillText(label, elbowColumnX_abs - 20, midY_for_label);
  return turnY; // Ritorna Y del gomito
}

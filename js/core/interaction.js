
// Verifica se il click è avvenuto su un nodo o su una freccia.
function checkClick(event) {
  // Se il click e' la coda di un vero drag&drop (gestito su mouseup), lo ignora:
  // altrimenti il rilascio del drag aprirebbe anche il popup di modifica del nodo.
  if (typeof suppressNextClick !== 'undefined' && suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  // FIX (Ismail 2026-07-09): un click deve aprire UN SOLO popup. Se sotto il cursore c'e' un
  // NODO -> solo il popup di modifica (clickNodo); altrimenti, se c'e' un ARCO -> solo il popup
  // di inserimento (clickFreccia). Prima venivano chiamati ENTRAMBI, quindi cliccando vicino a
  // un blocco E a una freccia si aprivano tutti e due i popup.
  const _c = canvasCoordsFromEvent(event);
  if (hitTestNode(_c.x, _c.y) !== -1) clickNodo(event);
  else clickFreccia(event);
}

// Calcola le coordinate canvas (scale-aware, coerenti con zoom) di un evento mouse.
function canvasCoordsFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const _rw = rect.width || w, _rh = rect.height || h;
  return {
    x: (event.clientX - rect.left) * (w / _rw),
    y: (event.clientY - rect.top) * (h / _rh)
  };
}

// Restituisce l'indice del nodo visuale sotto le coordinate (mx,my), o -1.
// Itera in ORDINE INVERSO: se due box si toccano (nodi molto vicini, es. il primo
// nodo di un ramo IF appena sotto il rombo), vince il nodo con indice piu' alto
// invece del primo dell'array — evita di "afferrare" per sbaglio l'IF (non
// trascinabile) quando si vuole prendere il nodo subito sotto di lui.
function hitTestNode(mx, my) {
  for (let i = nodi.length - 1; i >= 0; i--) {
    const node = nodi[i];
    if (!node) continue;
    const x0 = node.relX * w - node.width / 2;
    const y0 = node.relY * h - node.height / 2;
    const x1 = x0 + node.width;
    const y1 = y0 + node.height;
    if (mx >= x0 && mx <= x1 && my >= y0 && my <= y1) return i;
  }
  return -1;
}

// Tipi di nodo trascinabili col Drag & Drop: solo nodi "lineari" (un solo next).
// IF/While/For/Do-While/Start/End restano esclusi in questa prima versione: spostare
// un nodo di controllo richiederebbe portare con se' l'intero sottoalbero dei rami,
// molto piu' rischioso da reindicizzare correttamente (vedi PROBLEMS.md).
function isDraggableNodeType(type) {
  return ["input", "output", "print", "write", "read", "assign", "assignment", "comment", "pause", "forward", "turn", "home", "pen", "gclear"].includes(type);
}

// Un IF e' trascinabile come BLOCCO: lui stesso + tutto il contenuto dei suoi rami
// (che siano semplici o contengano a loro volta IF annidati). Verificato che il
// sottoalbero di un IF occupa SEMPRE un range di indici CONTIGUO in flow.nodes
// ([ifIdx, joinIndex)), quindi si puo' estrarre/reinserire come un blocco unico
// riusando la stessa aritmetica di indici di moveNode, generalizzata a N nodi.
function isDraggableRootType(type) {
  // N6 (review Fable, 2026-07-04 notte-4): generalizzato da "solo if" a qualunque tipo
  // a diramazione (isBranchingNodeType) -- un While/For/Do e' trascinabile come blocco
  // esattamente come un IF (vedi moveLoopBlock), stessa idea di isDraggableRootType.
  return isBranchingNodeType(type) || isDraggableNodeType(type);
}

// Tipi di nodo "a diramazione" (next = {true, false} invece di una stringa singola):
// IF (join in avanti) e i cicli While/For/Do-While (back-edge verso se' stessi).
// Usato per generalizzare la logica di re-indicizzazione dei puntatori quando si
// inserisce/cancella un nodo altrove nel flusso, cosi' i puntatori .next.true/.next.false
// di un while/for/do vengono shiftati correttamente anche se non e' lui il nodo toccato
// direttamente dall'operazione (bug reale: prima di questa generalizzazione solo "if"
// veniva considerato, e i puntatori di un while altrove nel flusso restavano non aggiornati).
function isBranchingNodeType(type) {
  return type === "if" || type === "while" || type === "for" || type === "do";
}

const DRAG_THRESHOLD_PX = 6; // soglia di movimento oltre la quale un mousedown diventa un drag

// Mousedown su un nodo trascinabile: memorizza il nodo "afferrato" e il punto di partenza.
// Non impedisce il click normale: se il mouse non si sposta abbastanza, sara' un click.
function onCanvasMouseDown(event) {
  const { x: mx, y: my } = canvasCoordsFromEvent(event);
  const idx = hitTestNode(mx, my);
  if (idx === -1 || !flow.nodes[idx]) return;
  const nodeType = flow.nodes[idx].type;
  if (nodeType === "if") {
    // dragSubtreeEnd deve riflettere il confine VERO del sottoalbero (blockEnd),
    // NON semplicemente joinIndex: i due possono differire quando l'IF converge
    // direttamente sullo stesso nodo lontano di un antenato senza join separato
    // (vedi bug in moveIfBlock/PROBLEMS.md) — usare joinIndex qui escluderebbe
    // dal drag anche archi che toccano un fratello estraneo, non il sottoalbero.
    const info = (typeof collectFullIfSubtreeMembers === "function") ? collectFullIfSubtreeMembers(idx) : null;
    // FIX (Ismail 2026-07-07, "se metti due cicli annidati poi un if annidato dentro non
    // va il drag&drop sull'if"): il vecchio guard rifiutava il drag quando
    // info.joinIndex < info.blockEnd. Ma per un IF annidato nel corpo di un ciclo, i suoi
    // rami convergono spesso su un ANTENATO (il ciclo genitore, indice < dell'if): join
    // che punta ALL'INDIETRO e' il caso NORMALE, non una corruzione -- esattamente lo
    // stesso pattern gia' corretto per i cicli (vedi ramo isBranchingNodeType sotto).
    // Ora si rifiuta SOLO se il join cade DENTRO il blocco stesso (corruzione vera),
    // coerente con moveIfBlock che gia' accetta questo caso.
    if (!info || !info.contiguous || info.joinIndex === null || info.joinIndex === undefined ||
        (info.joinIndex >= info.blockStart && info.joinIndex < info.blockEnd)) return;
    dragNodeIndex = idx;
    dragSubtreeEnd = info.blockEnd;
    isDraggingNode = false;
    dragStartX = mx;
    dragStartY = my;
  } else if (isBranchingNodeType(nodeType)) {
    // N6 (review Fable, 2026-07-04 notte-4): un ciclo (While/For/Do) e' trascinabile
    // come BLOCCO, stessa idea dell'IF sopra ma coi confini calcolati da
    // collectFullLoopSubtreeMembers (exitIndex al posto di joinIndex -- vedi
    // moveLoopBlock per il perche' non e' un semplice range [loopIdx, ultimo del corpo)).
    const infoLoop = (typeof collectFullLoopSubtreeMembers === "function") ? collectFullLoopSubtreeMembers(idx) : null;
    // FIX BUG 3 (segnalato da Ismail 2026-07-05 sera insieme al bug 2, "non fa
    // spostare, nel caso di while annidati, il while figlio"): questo guard usava
    // ANCORA "exitIndex < blockEnd" per rifiutare il drag -- lo stesso pattern
    // sbagliato che M2 (2026-07-05 mattina) aveva corretto, ma SOLO dentro
    // moveLoopBlock (che esegue lo spostamento), non qui in onCanvasMouseDown (che
    // decide se FAR PARTIRE il drag). Risultato: un ciclo annidato come ultimo/unico
    // membro del corpo di un altro ciclo ha SEMPRE next.false (exitIndex) che punta
    // ALL'INDIETRO all'antenato (< blockStart, quindi anche < blockEnd) -- questo e'
    // il caso NORMALE (back-edge dell'antenato), non una corruzione -- ma il guard
    // qui rifiutava il mousedown stesso, quindi dragNodeIndex non veniva mai
    // impostato e mousemove/mouseup non facevano nulla: il drag non partiva
    // proprio, indipendentemente da moveLoopBlock (mai raggiunto). Riprodotto con un
    // vero mousedown/mousemove/mouseup (Test 63 in test-if.js) su un while annidato
    // nel corpo di un while esterno. Stesso identico criterio ora usato da
    // moveLoopBlock: rifiuta SOLO se l'uscita cade DENTRO il blocco stesso
    // (corruzione vera), non se punta semplicemente indietro a un antenato.
    if (!infoLoop || !infoLoop.contiguous || infoLoop.exitIndex === null || infoLoop.exitIndex === undefined ||
        (infoLoop.exitIndex >= infoLoop.blockStart && infoLoop.exitIndex < infoLoop.blockEnd)) return;
    dragNodeIndex = idx;
    dragSubtreeEnd = infoLoop.blockEnd;
    isDraggingNode = false;
    dragStartX = mx;
    dragStartY = my;
  } else if (isDraggableNodeType(nodeType)) {
    dragNodeIndex = idx;
    dragSubtreeEnd = idx + 1;
    isDraggingNode = false;
    dragStartX = mx;
    dragStartY = my;
  }
}

// Mousemove durante un possibile drag: attiva il drag oltre soglia ed evidenzia
// l'arco più vicino al cursore come destinazione del drop (esclusi gli archi che
// toccano il nodo trascinato stesso).
function onCanvasMouseMove(event) {
  if (typeof dragNodeIndex === 'undefined' || dragNodeIndex === -1) return;
  const { x: mx, y: my } = canvasCoordsFromEvent(event);
  if (!isDraggingNode) {
    const dist = Math.hypot(mx - dragStartX, my - dragStartY);
    if (dist < DRAG_THRESHOLD_PX) return;
    isDraggingNode = true;
  }
  dragCurrentX = mx;
  dragCurrentY = my;
  let best = -1;
  // Tolleranza maggiore (14px, invece degli 8-10 usati per hover/click) perche'
  // durante il drag la mano e' meno precisa: rende il drop piu' "perdonante".
  // NB: escludiamo solo l'arco USCENTE dal nodo trascinato (fromNodeIndex), non
  // quello ENTRANTE. Un nodo che e' gia' il join di un IF a rami vuoti e' il
  // target SIA di if_true SIA di if_false (stesso indice): escludere per
  // toNodeIndex avrebbe reso IMPOSSIBILE spostarlo dentro uno dei due rami
  // (bug segnalato da Ismail: "il blocco subito dopo l'if non lo fa inserire
  // nel ramo"). moveNode() gestisce correttamente anche il caso limite in cui
  // l'arco target e' quello che gia' punta al nodo stesso (diventa un no-op sicuro).
  // dragSubtreeEnd = dragNodeIndex+1 per un nodo semplice (equivalente al vecchio
  // controllo puntuale), oppure joinIndex del sottoalbero per un blocco IF: in
  // entrambi i casi si esclude qualunque arco che entri o esca dal blocco stesso
  // (non si puo' droppare un blocco dentro se stesso). I bordi (fromNodeIndex/
  // toNodeIndex ESATTAMENTE uguali a dragNodeIndex o dragSubtreeEnd, cioe' gli
  // archi che gia' toccano il blocco dall'ESTERNO) restano validi come target.
  for (let i = 0; i < frecce.length; i++) {
    const f = frecce[i];
    if (f.fromNodeIndex >= dragNodeIndex && f.fromNodeIndex < dragSubtreeEnd) continue;
    if (f.toNodeIndex !== null && f.toNodeIndex !== undefined && f.toNodeIndex > dragNodeIndex && f.toNodeIndex < dragSubtreeEnd) continue;
    if (isPointNearAnyLineSegment(mx, my, f.inzioX, f.inzioY, f.fineX, f.fineY, 14)) { best = i; break; }
  }
  dragOverIndex = best;
  if (canvas && canvas.style) canvas.style.cursor = 'grabbing';
  draw(nodi);
}

// Mouseup: se e' stato un vero drag con un arco target valido, esegue lo spostamento.
// Altrimenti rilascia lo stato senza fare nulla (il click normale seguira' come sempre).
function onCanvasMouseUp(event) {
  if (typeof dragNodeIndex === 'undefined' || dragNodeIndex === -1) return;
  const wasDragging = isDraggingNode;
  const nodeIdx = dragNodeIndex;
  const targetArrow = dragOverIndex;
  dragNodeIndex = -1;
  dragSubtreeEnd = -1;
  isDraggingNode = false;
  dragOverIndex = -1;
  if (canvas && canvas.style) canvas.style.cursor = 'default';
  if (wasDragging) {
    suppressNextClick = true;
    if (targetArrow !== -1) {
      const draggedType = flow.nodes[nodeIdx] && flow.nodes[nodeIdx].type;
      if (draggedType === "if") {
        moveIfBlock(nodeIdx, targetArrow);
      } else if (isBranchingNodeType(draggedType)) {
        // N6: While/For/Do trascinato come blocco (vedi moveLoopBlock).
        moveLoopBlock(nodeIdx, targetArrow);
      } else {
        moveNode(nodeIdx, targetArrow);
      }
    } else {
      draw(nodi);
    }
  }
}

// M6 (review Fable, 2026-07-05 mattina): tutti i rifiuti di moveNode/moveIfBlock/
// moveLoopBlock erano SILENZIOSI (un semplice `return`) -- l'utente trascinava un
// blocco, lo rilasciava, e non succedeva nulla senza alcun indizio del perche'. Prima
// battuta minima (per esplicita indicazione del piano): un console.warn strutturato su
// OGNI ramo di rifiuto, cosi' almeno in console si capisce quale guardia ha bloccato la
// mossa. Un feedback visivo (flash rosso / cursor not-allowed) e' rimandato a un
// prossimo giro: richiede agganciare l'esito al codice di drag&drop in eventi UI, che
// oggi non propaga alcun valore di ritorno da queste funzioni.
function warnMoveRejected(fnName, reason, details) {
  console.warn("[move rejected] " + fnName + ": " + reason, details || {});
}

// Sposta il nodo logico+visuale in nodeIndex sull'arco arrowId (drag&drop, riordino
// nel flusso). Riusa la stessa aritmetica di indici di deleteNode (rimozione) e di
// inserisciNodo (reinserimento), gia' verificata dai test: rimuove il nodo dalla sua
// posizione (i puntatori 'next' che lo puntavano restano numericamente invariati e,
// dopo lo splice, puntano correttamente al nodo che lo seguiva), poi lo reinserisce
// nel punto dell'arco target esattamente come un nuovo inserimento.
function moveNode(nodeIndex, arrowId) {
  if (nodeIndex < 0 || nodeIndex >= flow.nodes.length) { warnMoveRejected("moveNode", "indice nodo fuori range", { nodeIndex }); return; }
  const nodeLogic = flow.nodes[nodeIndex];
  if (!nodeLogic || !isDraggableNodeType(nodeLogic.type)) { warnMoveRejected("moveNode", "nodo mancante o non trascinabile", { nodeIndex, type: nodeLogic && nodeLogic.type }); return; }
  const arrow = frecce[arrowId];
  if (!arrow) { warnMoveRejected("moveNode", "arco target mancante", { arrowId }); return; }
  let targetFrom = arrow.fromNodeIndex;
  let targetTo = arrow.toNodeIndex;
  const targetType = arrow.type;
  // Escludiamo solo targetFrom === nodeIndex (dopo la rimozione del nodo in STEP A,
  // quell'indice non lo rappresenterebbe piu': userlo come "genitore" corromperebbe
  // la struttura). targetTo === nodeIndex e' invece un caso VALIDO e comune (il nodo
  // e' gia' il join/target di uno o entrambi i rami di un IF): gestito correttamente
  // sotto, al piu' e' un no-op sicuro se il ramo scelto e' quello in cui si trova gia'.
  if (targetFrom === nodeIndex) { warnMoveRejected("moveNode", "il genitore dell'arco target e' il nodo stesso", { nodeIndex, targetFrom }); return; }
  // M3 (review Fable, 2026-07-04 notte-6): whitelist estesa a loop_body/loop_exit/
  // loop_body_end -- prima impossibile trascinare QUALUNQUE nodo dentro/dopo il corpo
  // di un ciclo, anche se l'inserimento equivalente dal popup (inserisciNodo) era gia'
  // supportato e sicuro. I redirect replicano quelli gia' testati di inserisciNodo.
  if (!["normal", "if_true", "if_false", "if_join", "loop_body", "loop_exit", "loop_body_end"].includes(targetType)) { warnMoveRejected("moveNode", "tipo di arco target non supportato", { targetType }); return; }

  pushHistory(); // snapshot per Undo (prima dello spostamento)

  const nodeVisual = nodi[nodeIndex];

  // STEP A — rimozione dalla posizione attuale.
  // BUG storico (trovato da Ismail su un IF annidato, vedi PROBLEMS.md): un puntatore
  // che punta ESATTAMENTE a nodeIndex NON puo' essere lasciato invariato assumendo che
  // lo shift dell'array lo faccia atterrare sul nodo giusto. Quel trucco funziona SOLO
  // quando il vero successore del nodo rimosso (nodeLogic.next) e' fisicamente proprio
  // lo slot successivo (nodeIndex+1) — vero in una catena lineare semplice, FALSO
  // quando il nodo rimosso e' l'ultimo di un ramo IF seguito, nell'array, dal contenuto
  // di un ALTRO ramo (es. fine del ramo TRUE seguita dal ramo FALSE): in quel caso lo
  // slot liberato viene occupato dal primo nodo del ramo FALSE (un fratello a caso),
  // non dal vero successore del nodo rimosso. Fix: si calcola esplicitamente il vero
  // successore (ownNext, gia' adattato per lo shift) e si redirige a QUELLO qualunque
  // puntatore che puntava esattamente a nodeIndex, invece di lasciarlo invariato.
  const ownNextRaw = (typeof nodeLogic.next === "string") ? parseInt(nodeLogic.next, 10) : NaN;
  const adjustForRemoval = (v) => (v > nodeIndex ? v - 1 : v);
  const ownNextAdjusted = isNaN(ownNextRaw) ? null : adjustForRemoval(ownNextRaw);

  flow.nodes.splice(nodeIndex, 1);
  nodi.splice(nodeIndex, 1);
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i];
    // BUG B2 (review Fable, 2026-07-04 notte-2): generalizzato da "solo if" a
    // isBranchingNodeType (IF+While/For/Do), altrimenti un ciclo gia' presente
    // altrove nel flusso non riceveva lo shift dei suoi next.true/next.false quando
    // si spostava (drag&drop) un nodo NON legato a lui — corruzione silenziosa
    // della stessa classe gia' fixata per inserisciNodo/deleteNode nella sessione
    // precedente, ma dimenticata qui in moveNode.
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
      const t = parseInt(n.next.true, 10);
      const f = parseInt(n.next.false, 10);
      if (!isNaN(t)) n.next.true = (t === nodeIndex && ownNextAdjusted !== null ? ownNextAdjusted : adjustForRemoval(t)).toString();
      if (!isNaN(f)) n.next.false = (f === nodeIndex && ownNextAdjusted !== null ? ownNextAdjusted : adjustForRemoval(f)).toString();
    } else if (typeof n.next === "string" && n.next !== null) {
      const nx = parseInt(n.next, 10);
      if (!isNaN(nx)) n.next = (nx === nodeIndex && ownNextAdjusted !== null ? ownNextAdjusted : adjustForRemoval(nx)).toString();
    }
  }
  if (targetFrom > nodeIndex) targetFrom -= 1;
  if (targetTo !== null && targetTo !== undefined && targetTo > nodeIndex) targetTo -= 1;

  // STEP B — reinserimento nel punto dell'arco target (stessa logica di inserisciNodo).
  // P1 FIX (review Fable, 2026-07-05 pomeriggio): regola UNICA per ogni arco che punta
  // all'indietro (targetTo <= targetFrom), non solo i due casi storici (self-loop del
  // corpo vuoto, loop_body_end) -- generalizza anche a un IF annidato nel corpo con
  // rami vuoti che convergono DIRETTAMENTE sul back-edge del ciclo (if_true/if_false/
  // if_join con targetTo = indice del ciclo, prima di targetFrom = indice dell'IF).
  // Vedi inserisciNodo per la spiegazione completa e PLANS/2026-07-05-nested-while-visuals.md P1.
  const isBackwardMove = (targetTo !== null && targetTo !== undefined && targetTo <= targetFrom);
  const newActualNodeIndex = isBackwardMove ? (targetFrom + 1) : targetTo;
  // Il "next" del nodo reinserito punta a dove finisce targetTo dopo lo shift: se
  // targetTo >= newActualNodeIndex verra' spostato in avanti di 1 (caso generico,
  // forward); se targetTo < newActualNodeIndex (caso all'indietro sopra) resta
  // INVARIATO -- e' esattamente il back-edge verso il ciclo, che sta prima del nuovo
  // nodo e non viene toccato dallo shift.
  nodeLogic.next = (targetTo >= newActualNodeIndex ? targetTo + 1 : targetTo).toString();

  flow.nodes.splice(newActualNodeIndex, 0, nodeLogic);
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i];
    if (n === nodeLogic) continue;
    // BUG B2: stessa generalizzazione di cui sopra, per lo shift in avanti dovuto
    // al reinserimento nella nuova posizione.
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
      const t = parseInt(n.next.true, 10);
      const f = parseInt(n.next.false, 10);
      if (!isNaN(t) && t >= newActualNodeIndex) n.next.true = (t + 1).toString();
      if (!isNaN(f) && f >= newActualNodeIndex) n.next.false = (f + 1).toString();
    } else if (typeof n.next === "string" && n.next !== null) {
      const nx = parseInt(n.next, 10);
      if (!isNaN(nx) && nx >= newActualNodeIndex) n.next = (nx + 1).toString();
    }
  }

  const parentLogic = flow.nodes[targetFrom];
  const newTargetStr = newActualNodeIndex.toString();
  if (parentLogic && parentLogic.type === "if") {
    if (targetType === "if_join") {
      const shiftedJoin = newActualNodeIndex + 1;
      const redirectBranchToNew = (branchStartStr, sideKey) => {
        const start = parseInt(branchStartStr, 10);
        if (isNaN(start)) return;
        if (start === shiftedJoin) {
          if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next[sideKey] = newTargetStr;
        } else {
          redirectJoinRefs(start, shiftedJoin, newTargetStr, new Set());
        }
      };
      if (parentLogic.next && typeof parentLogic.next === "object") {
        redirectBranchToNew(parentLogic.next.true, "true");
        redirectBranchToNew(parentLogic.next.false, "false");
      }
    } else if (targetType === "if_true") {
      parentLogic.next.true = newTargetStr;
    } else if (targetType === "if_false") {
      parentLogic.next.false = newTargetStr;
    } else if (targetType === "loop_body_end") {
      // M3: parentLogic (IF) e' l'ultimo nodo del corpo di un ciclo ESTERNO -- stesso
      // pattern di if_join (i rami che convergono sul vecchio target del ciclo ora
      // convergono sul nodo appena spostato), ma senza shift in avanti (il target,
      // targetTo, e' gia' stato adattato per la rimozione ed e' un riferimento
      // ALL'INDIETRO rispetto al nuovo nodo, non slitta con l'inserimento).
      const oldLoopTarget = targetTo;
      const redirectBranchToNewLoop = (branchStartStr, sideKey) => {
        const start = parseInt(branchStartStr, 10);
        if (isNaN(start)) return;
        if (start === oldLoopTarget) {
          if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next[sideKey] = newTargetStr;
        } else {
          redirectJoinRefs(start, oldLoopTarget, newTargetStr, new Set());
        }
      };
      if (parentLogic.next && typeof parentLogic.next === "object") {
        redirectBranchToNewLoop(parentLogic.next.true, "true");
        redirectBranchToNewLoop(parentLogic.next.false, "false");
      }
    }
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_body") {
    // M3: dentro il corpo (vuoto o come nuovo primo nodo) di un ciclo -- stesso pattern
    // di inserisciNodo (mai sovrascrivere next con una stringa, B1).
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.true = newTargetStr;
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_exit") {
    // M3: subito dopo l'uscita di un ciclo.
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.false = newTargetStr;
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_body_end") {
    // M3: parentLogic e' un ciclo che e' esso stesso l'ultimo nodo del corpo di un
    // ciclo ESTERNO (nesting di cicli) -- stesso pattern next.false.
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.false = newTargetStr;
  } else if (parentLogic) {
    parentLogic.next = newTargetStr;
  }

  // Nodo visuale: relX ricalcolato con la stessa logica di inserisciNodo
  const parentVis = nodi[targetFrom];
  let newRelX;
  const elbowOffset = 40;
  if (parentLogic && parentLogic.type === "if") {
    if (targetType === "if_join" && parentVis) {
      newRelX = parentVis.relX;
    } else if (targetType === "if_true" && parentVis) {
      const prX = parentVis.relX * w + parentVis.width / 2;
      newRelX = (prX + elbowOffset) / w;
    } else if (targetType === "if_false" && parentVis) {
      const plX = parentVis.relX * w - parentVis.width / 2;
      newRelX = (plX - elbowOffset) / w;
    } else {
      newRelX = parentVis ? parentVis.relX : 0.5;
    }
  } else if (parentVis && (targetType === "normal" || targetType === "loop_body" || targetType === "loop_exit" || targetType === "loop_body_end")) {
    // M3: stesso allineamento provvisorio di inserisciNodo per gli archi di un ciclo
    // (il layout definitivo riposiziona tutto in calcoloY() poco sotto).
    newRelX = parentVis.relX;
  } else {
    newRelX = 0.5;
  }
  const nodeWidth = nodeVisual.width || 100;
  const minRX = (nodeWidth / 2) / w + 0.01;
  const maxRX = 1 - (nodeWidth / 2) / w - 0.01;
  if (newRelX < minRX) newRelX = minRX;
  if (newRelX > maxRX) newRelX = maxRX;
  nodeVisual.relX = newRelX;

  nodi.splice(newActualNodeIndex, 0, nodeVisual);

  saved = false;
  calcoloY(nodi);
  draw(nodi);
}

// Sposta un intero BLOCCO IF (se stesso + tutto il contenuto dei suoi rami, inclusi
// eventuali IF annidati con le proprie ricongiunzioni interne) su un nuovo punto del
// flusso. Generalizza la stessa aritmetica a indici di moveNode: invece di 1 nodo si
// estrae/reinserisce un blocco di N nodi.
//
// BUG STORICO (segnalato da Ismail con 3 screenshot, vedi PROBLEMS.md): la prima
// versione assumeva che il sottoalbero occupasse SEMPRE l'intervallo [ifIdx,
// joinIndex). Falso quando un IF annidato converge DIRETTAMENTE sullo stesso nodo
// lontano a cui converge anche un suo antenato (nessun nodo di join separato in
// mezzo): un fratello dell'antenato, fisicamente posizionato fra il sottoalbero e
// il join condiviso, veniva erroneamente incluso nell'intervallo — causando sia
// mosse valide rifiutate per errore (il fratello "sembrava" dentro il sottoalbero)
// sia, quando il target cadeva fuori dall'intervallo sbagliato, corruzione vera
// (il blocco estratto si portava dietro per errore il fratello). Fix: si usano i
// confini VERI (`collectFullIfSubtreeMembers`, espansione ricorsiva + verifica di
// contiguita'), non l'intervallo ifIdx..joinIndex.
function moveIfBlock(ifIdx, arrowId) {
  if (ifIdx < 0 || ifIdx >= flow.nodes.length) { warnMoveRejected("moveIfBlock", "indice IF fuori range", { ifIdx }); return; }
  const ifLogic = flow.nodes[ifIdx];
  if (!ifLogic || ifLogic.type !== "if") { warnMoveRejected("moveIfBlock", "nodo non e' un IF", { ifIdx, type: ifLogic && ifLogic.type }); return; }

  const info = collectFullIfSubtreeMembers(ifIdx);
  if (!info || !info.contiguous) { warnMoveRejected("moveIfBlock", "sottoalbero non contiguo (topologia inattesa)", { ifIdx }); return; } // topologia inattesa: non rischiare
  const blockStart = info.blockStart; // atteso === ifIdx, ma si usa il valore calcolato
  const blockEnd = info.blockEnd;     // fine VERA del blocco (puo' essere < joinIndex)
  const blockSize = blockEnd - blockStart;
  const joinIdxOrig = info.joinIndex; // punto di uscita LOGICO (puo' essere oltre blockEnd)
  // FIX (Ismail 2026-07-07, "lo fa spostare ma se rilascio su arco non si sposta"): il
  // guard rifiutava OGNI join < blockEnd. Ma un IF annidato come corpo (o ultimo membro)
  // di un ciclo ha i rami che convergono ALL'INDIETRO sul ciclo genitore (joinIdxOrig <
  // blockStart): non e' corruzione -- dopo la rimozione del blocco il puntatore del corpo
  // del ciclo torna a puntare a se stesso (loopIdx===next.true), che e' la rappresentazione
  // VALIDA di un ciclo a corpo vuoto. Come per moveLoopBlock, si rifiuta SOLO se il join
  // cade STRETTAMENTE DENTRO il blocco (>= blockStart && < blockEnd), cioe' corruzione vera.
  if (joinIdxOrig === null || joinIdxOrig === undefined ||
      (joinIdxOrig >= blockStart && joinIdxOrig < blockEnd)) { warnMoveRejected("moveIfBlock", "join del blocco assente o incoerente (dentro il blocco)", { ifIdx, joinIdxOrig, blockStart, blockEnd }); return; }

  const arrow = frecce[arrowId];
  if (!arrow) { warnMoveRejected("moveIfBlock", "arco target mancante", { arrowId }); return; }
  let targetFrom = arrow.fromNodeIndex;
  let targetTo = arrow.toNodeIndex;
  const targetType = arrow.type;
  // M3 (review Fable, 2026-07-04 notte-6): whitelist estesa a loop_body/loop_exit/
  // loop_body_end -- vedi moveNode per la spiegazione completa (stessi redirect di
  // inserisciNodo, gia' testati e sicuri).
  if (!["normal", "if_true", "if_false", "if_join", "loop_body", "loop_exit", "loop_body_end"].includes(targetType)) { warnMoveRejected("moveIfBlock", "tipo di arco target non supportato", { targetType }); return; }

  // Non si puo' partire da un genitore che sta DENTRO il blocco VERO, ne' droppare
  // STRETTAMENTE dentro (i bordi blockStart/blockEnd, cioe' gli archi che gia'
  // toccano il blocco dall'esterno, restano validi: no-op sicuro come in moveNode).
  if (targetFrom >= blockStart && targetFrom < blockEnd) { warnMoveRejected("moveIfBlock", "genitore dell'arco target dentro il blocco spostato", { targetFrom, blockStart, blockEnd }); return; }
  if (targetTo !== null && targetTo !== undefined && targetTo > blockStart && targetTo < blockEnd) { warnMoveRejected("moveIfBlock", "target dell'arco strettamente dentro il blocco spostato", { targetTo, blockStart, blockEnd }); return; }

  pushHistory(); // snapshot per Undo (prima dello spostamento)

  const blockLogic = flow.nodes.slice(blockStart, blockEnd);
  const blockVisual = nodi.slice(blockStart, blockEnd);

  // STEP A — rimozione. Come per moveNode/deleteNode: un puntatore ESTERNO che
  // punta esattamente a blockStart (l'ingresso del blocco) va rediretto al vero
  // successore (joinIdxOrig, adattato per lo shift), non lasciato invariato
  // sperando che lo shift lo faccia atterrare li' per coincidenza — falso quando
  // c'e' un "buco" fra blockEnd e joinIdxOrig occupato da contenuto estraneo.
  const adjustForRemoval = (v) => (v >= blockEnd ? v - blockSize : v);
  const ownExitAdjusted = adjustForRemoval(joinIdxOrig);

  flow.nodes.splice(blockStart, blockSize);
  nodi.splice(blockStart, blockSize);
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i];
    // BUG B2 (review Fable): generalizzato da "solo if" a isBranchingNodeType, stesso
    // motivo del fix in moveNode -- un ciclo altrove nel flusso non veniva ri-shiftato
    // quando si sposta un blocco IF che non lo contiene.
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
      const t = parseInt(n.next.true, 10);
      const f = parseInt(n.next.false, 10);
      if (!isNaN(t)) n.next.true = (t === blockStart ? ownExitAdjusted : adjustForRemoval(t)).toString();
      if (!isNaN(f)) n.next.false = (f === blockStart ? ownExitAdjusted : adjustForRemoval(f)).toString();
    } else if (typeof n.next === "string" && n.next !== null) {
      const nx = parseInt(n.next, 10);
      if (!isNaN(nx)) n.next = (nx === blockStart ? ownExitAdjusted : adjustForRemoval(nx)).toString();
    }
  }
  if (targetFrom >= blockEnd) targetFrom -= blockSize;
  if (targetTo !== null && targetTo !== undefined) {
    if (targetTo >= blockEnd) targetTo -= blockSize;
    else if (targetTo === blockStart) targetTo = ownExitAdjusted;
  }

  // STEP B — ricalcolo dei riferimenti INTERNI del blocco sulla nuova base, PRIMA
  // di reinserirlo (dipende solo dai valori numerici, non dalla posizione in array).
  // P1 FIX (review Fable, 2026-07-05 pomeriggio): regola UNICA per ogni arco che punta
  // all'indietro (targetTo <= targetFrom) -- vedi moveNode per la spiegazione completa
  // e PLANS/2026-07-05-nested-while-visuals.md P1. Il blocco va inserito SUBITO DOPO
  // il genitore, non al posto del target (che qui e' indietro rispetto al blocco).
  const isBackwardMove = (targetTo !== null && targetTo !== undefined && targetTo <= targetFrom);
  const newActualNodeIndex = isBackwardMove ? (targetFrom + 1) : targetTo;
  // L'uscita del blocco (newExitRef) normalmente e' in AVANTI (subito dopo il blocco
  // stesso, caso generico); nel caso all'indietro sopra il vecchio target
  // (targetTo, gia' adattato per la rimozione) resta invariato -- e' il back-edge
  // verso il ciclo, che sta prima del blocco spostato e non viene toccato dallo shift.
  const newExitRef = (targetTo >= newActualNodeIndex ? newActualNodeIndex + blockSize : targetTo);
  function remapPointer(oldStr) {
    const v = parseInt(oldStr, 10);
    if (isNaN(v)) return oldStr;
    if (v === joinIdxOrig) return newExitRef.toString();
    if (v >= blockStart && v < blockEnd) return (newActualNodeIndex + (v - blockStart)).toString();
    return oldStr; // non dovrebbe succedere per un blocco ben formato; per sicurezza non tocca
  }
  for (const n of blockLogic) {
    // Generalizzato a isBranchingNodeType: un ciclo PUO' far parte del sottoalbero
    // spostato (es. un While dentro un ramo dell'IF trascinato) e i suoi puntatori
    // interni vanno rimappati come quelli di un IF interno.
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
      n.next.true = remapPointer(n.next.true);
      n.next.false = remapPointer(n.next.false);
    } else if (typeof n.next === "string" && n.next !== null) {
      n.next = remapPointer(n.next);
    }
  }

  // Fa spazio per il blocco: incrementa di blockSize tutti i puntatori ESTERNI >= newActualNodeIndex
  // (fatto PRIMA dello splice, cosi' il blocco stesso — non ancora nell'array — non serve escluderlo).
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i];
    // BUG B2: stessa generalizzazione, per lo shift in avanti dovuto al reinserimento.
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
      const t = parseInt(n.next.true, 10);
      const f = parseInt(n.next.false, 10);
      if (!isNaN(t) && t >= newActualNodeIndex) n.next.true = (t + blockSize).toString();
      if (!isNaN(f) && f >= newActualNodeIndex) n.next.false = (f + blockSize).toString();
    } else if (typeof n.next === "string" && n.next !== null) {
      const nx = parseInt(n.next, 10);
      if (!isNaN(nx) && nx >= newActualNodeIndex) n.next = (nx + blockSize).toString();
    }
  }

  flow.nodes.splice(newActualNodeIndex, 0, ...blockLogic);
  nodi.splice(newActualNodeIndex, 0, ...blockVisual);

  const parentLogic = flow.nodes[targetFrom];
  const newTargetStr = newActualNodeIndex.toString();
  if (parentLogic && parentLogic.type === "if") {
    if (targetType === "if_join") {
      const shiftedJoin = newActualNodeIndex + blockSize;
      const redirectBranchToNew = (branchStartStr, sideKey) => {
        const start = parseInt(branchStartStr, 10);
        if (isNaN(start)) return;
        if (start === shiftedJoin) {
          if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next[sideKey] = newTargetStr;
        } else {
          redirectJoinRefs(start, shiftedJoin, newTargetStr, new Set());
        }
      };
      if (parentLogic.next && typeof parentLogic.next === "object") {
        redirectBranchToNew(parentLogic.next.true, "true");
        redirectBranchToNew(parentLogic.next.false, "false");
      }
    } else if (targetType === "if_true") {
      parentLogic.next.true = newTargetStr;
    } else if (targetType === "if_false") {
      parentLogic.next.false = newTargetStr;
    } else if (targetType === "loop_body_end") {
      // M3: vedi moveNode -- parentLogic (IF) e' l'ultimo nodo del corpo di un ciclo
      // ESTERNO, redirect identico a if_join ma senza shift in avanti (backward).
      const oldLoopTarget = targetTo;
      const redirectBranchToNewLoop = (branchStartStr, sideKey) => {
        const start = parseInt(branchStartStr, 10);
        if (isNaN(start)) return;
        if (start === oldLoopTarget) {
          if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next[sideKey] = newTargetStr;
        } else {
          redirectJoinRefs(start, oldLoopTarget, newTargetStr, new Set());
        }
      };
      if (parentLogic.next && typeof parentLogic.next === "object") {
        redirectBranchToNewLoop(parentLogic.next.true, "true");
        redirectBranchToNewLoop(parentLogic.next.false, "false");
      }
    }
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_body") {
    // M3: vedi moveNode -- dentro il corpo di un ciclo.
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.true = newTargetStr;
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_exit") {
    // M3: vedi moveNode -- subito dopo l'uscita di un ciclo.
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.false = newTargetStr;
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_body_end") {
    // M3: vedi moveNode -- parentLogic e' un ciclo, esso stesso ultimo del corpo di
    // un ciclo ESTERNO (nesting di cicli).
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.false = newTargetStr;
  } else if (parentLogic) {
    parentLogic.next = newTargetStr;
  }

  // Nodo visuale IF (relX): stessa logica di posizionamento di moveNode/inserisciNodo,
  // applicata solo al rombo dell'IF (i figli interni mantengono le relX gia' calcolate
  // dal layout precedente; calcoloY() qui sotto le ricalcola comunque tutte da zero
  // in base alla struttura logica, quindi non serve propagare offset ai figli).
  const ifVisual = blockVisual[0];
  const parentVis = nodi[targetFrom];
  let newRelX;
  const elbowOffset = 40;
  if (parentLogic && parentLogic.type === "if") {
    if (targetType === "if_join" && parentVis) {
      newRelX = parentVis.relX;
    } else if (targetType === "if_true" && parentVis) {
      const prX = parentVis.relX * w + parentVis.width / 2;
      newRelX = (prX + elbowOffset) / w;
    } else if (targetType === "if_false" && parentVis) {
      const plX = parentVis.relX * w - parentVis.width / 2;
      newRelX = (plX - elbowOffset) / w;
    } else {
      newRelX = parentVis ? parentVis.relX : 0.5;
    }
  } else if (parentVis && (targetType === "normal" || targetType === "loop_body" || targetType === "loop_exit" || targetType === "loop_body_end")) {
    newRelX = parentVis.relX;
  } else {
    newRelX = 0.5;
  }
  if (ifVisual) {
    const nodeWidth = ifVisual.width || 100;
    const minRX = (nodeWidth / 2) / w + 0.01;
    const maxRX = 1 - (nodeWidth / 2) / w - 0.01;
    if (newRelX < minRX) newRelX = minRX;
    if (newRelX > maxRX) newRelX = maxRX;
    ifVisual.relX = newRelX;
  }

  saved = false;
  calcoloY(nodi);
  draw(nodi);
}


// Sposta un intero BLOCCO CICLO (While/For/Do): se stesso + tutto il contenuto del suo
// corpo (inclusi eventuali IF/cicli annidati con i propri confini interni), su un nuovo
// punto del flusso. N6 (review Fable, 2026-07-04 notte-4, richiesta esplicita di
// Ismail). Generalizza la STESSA aritmetica a indici di moveIfBlock: invece del
// joinIndex (uscita in AVANTI di un IF) qui si usa exitIndex (next.false del ciclo,
// analogo concettualmente ma semanticamente diverso: il corpo del ciclo torna su se'
// stesso con un back-edge INTERNO al blocco, non ha bisogno di redirect esterni per
// quello). Confini VERI del blocco calcolati con collectFullLoopSubtreeMembers (mai
// l'intervallo [loopIdx, ultimo di bodyList): un IF o ciclo annidato nel corpo, se NON
// e' l'ultimo membro, "nasconde" fisicamente dei nodi fra il proprio indice e la
// propria uscita che vanno comunque inclusi nel blocco -- stesso bug-pattern gia'
// fixato per moveIfBlock).
//
// Target di drop supportati: normal/if_true/if_false/if_join (come moveIfBlock) PIU'
// loop_body/loop_exit/loop_body_end (M3, review Fable 2026-07-04 notte-6, richiesta
// esplicita di Ismail -- prima era una decisione di prodotto rimandata: ora un intero
// blocco ciclo si puo' droppare anche DENTRO/DOPO il corpo di un altro ciclo, stessi
// redirect gia' testati di inserisciNodo/moveNode).
function moveLoopBlock(loopIdx, arrowId) {
  if (loopIdx < 0 || loopIdx >= flow.nodes.length) { warnMoveRejected("moveLoopBlock", "indice ciclo fuori range", { loopIdx }); return; }
  const loopLogic = flow.nodes[loopIdx];
  if (!loopLogic || !isBranchingNodeType(loopLogic.type) || loopLogic.type === "if") { warnMoveRejected("moveLoopBlock", "nodo non e' un ciclo", { loopIdx, type: loopLogic && loopLogic.type }); return; }

  const info = collectFullLoopSubtreeMembers(loopIdx);
  if (!info || !info.contiguous) { warnMoveRejected("moveLoopBlock", "sottoalbero non contiguo (topologia inattesa)", { loopIdx }); return; } // topologia inattesa: non rischiare
  const blockStart = info.blockStart; // atteso === loopIdx
  const blockEnd = info.blockEnd;
  const blockSize = blockEnd - blockStart;
  const exitIdxOrig = info.exitIndex; // punto di uscita LOGICO (next.false del ciclo)
  if (exitIdxOrig === null || exitIdxOrig === undefined) { warnMoveRejected("moveLoopBlock", "uscita del blocco assente", { loopIdx }); return; }
  // FIX M2 (review Fable, 2026-07-04 notte-6): a differenza di un IF (che non ha
  // semantica di back-edge, quindi il suo joinIndex deve SEMPRE essere >= blockEnd),
  // l'uscita di un CICLO puo' legittimamente puntare ALL'INDIETRO (< blockStart)
  // quando il blocco e' l'ultimo/unico membro del corpo di un ciclo o ramo antenato:
  // il suo "next dopo di se'" e' allora il back-edge dell'antenato (es. un while
  // annidato come intero corpo di un while esterno -> next.false dell'interno punta
  // all'indice dell'esterno, che sta PRIMA del blocco spostato). Il guard originale
  // (`exitIdxOrig < blockEnd`) rifiutava SEMPRE questo caso normale, impedendo di
  // spostare qualunque ciclo annidato. Resta invece un caso INATTESO (corruzione) se
  // l'uscita cade dentro il blocco stesso (>= blockStart e < blockEnd): quello si
  // rifiuta ancora, per sicurezza.
  if (exitIdxOrig >= blockStart && exitIdxOrig < blockEnd) { warnMoveRejected("moveLoopBlock", "uscita del blocco cade dentro il blocco stesso (corruzione)", { exitIdxOrig, blockStart, blockEnd }); return; }

  const arrow = frecce[arrowId];
  if (!arrow) { warnMoveRejected("moveLoopBlock", "arco target mancante", { arrowId }); return; }
  let targetFrom = arrow.fromNodeIndex;
  let targetTo = arrow.toNodeIndex;
  const targetType = arrow.type;
  // M3: whitelist estesa a loop_body/loop_exit/loop_body_end -- vedi moveNode.
  if (!["normal", "if_true", "if_false", "if_join", "loop_body", "loop_exit", "loop_body_end"].includes(targetType)) { warnMoveRejected("moveLoopBlock", "tipo di arco target non supportato", { targetType }); return; }

  // Non si puo' partire da un genitore DENTRO il blocco, ne' droppare STRETTAMENTE
  // dentro (i bordi, cioe' gli archi che gia' toccano il blocco dall'esterno, restano
  // validi: no-op sicuro come in moveIfBlock/moveNode).
  if (targetFrom >= blockStart && targetFrom < blockEnd) { warnMoveRejected("moveLoopBlock", "genitore dell'arco target dentro il blocco spostato", { targetFrom, blockStart, blockEnd }); return; }
  if (targetTo !== null && targetTo !== undefined && targetTo > blockStart && targetTo < blockEnd) { warnMoveRejected("moveLoopBlock", "target dell'arco strettamente dentro il blocco spostato", { targetTo, blockStart, blockEnd }); return; }

  pushHistory(); // snapshot per Undo (prima dello spostamento)

  const blockLogic = flow.nodes.slice(blockStart, blockEnd);
  const blockVisual = nodi.slice(blockStart, blockEnd);

  // STEP A — rimozione. Un puntatore ESTERNO che punta esattamente a blockStart
  // (l'ingresso del blocco, cioe' il ciclo stesso) va rediretto al vero successore
  // (exitIdxOrig, adattato per lo shift), non lasciato invariato.
  const adjustForRemoval = (v) => (v >= blockEnd ? v - blockSize : v);
  const ownExitAdjusted = adjustForRemoval(exitIdxOrig);

  flow.nodes.splice(blockStart, blockSize);
  nodi.splice(blockStart, blockSize);
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i];
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
      const t = parseInt(n.next.true, 10);
      const f = parseInt(n.next.false, 10);
      if (!isNaN(t)) n.next.true = (t === blockStart ? ownExitAdjusted : adjustForRemoval(t)).toString();
      if (!isNaN(f)) n.next.false = (f === blockStart ? ownExitAdjusted : adjustForRemoval(f)).toString();
    } else if (typeof n.next === "string" && n.next !== null) {
      const nx = parseInt(n.next, 10);
      if (!isNaN(nx)) n.next = (nx === blockStart ? ownExitAdjusted : adjustForRemoval(nx)).toString();
    }
  }
  if (targetFrom >= blockEnd) targetFrom -= blockSize;
  if (targetTo !== null && targetTo !== undefined) {
    if (targetTo >= blockEnd) targetTo -= blockSize;
    else if (targetTo === blockStart) targetTo = ownExitAdjusted;
  }

  // STEP B — ricalcolo dei riferimenti INTERNI del blocco sulla nuova base, PRIMA di
  // reinserirlo. Il back-edge (che punta a loopIdx stesso, cioe' blockStart) e la
  // exitIdxOrig (se referenziata da un nodo interno, es. un ciclo annidato la cui
  // uscita punta OLTRE se' stesso ma ANCORA dentro/appena fuori questo blocco) vengono
  // rimappati con la stessa remapPointer generalizzata di moveIfBlock.
  // P1 FIX (review Fable, 2026-07-05 pomeriggio): regola UNICA per ogni arco che punta
  // all'indietro (targetTo <= targetFrom), stessa di moveNode/moveIfBlock -- vedi
  // moveNode per la spiegazione completa e PLANS/2026-07-05-nested-while-visuals.md P1.
  const isBackwardMove = (targetTo !== null && targetTo !== undefined && targetTo <= targetFrom);
  const newActualNodeIndex = isBackwardMove ? (targetFrom + 1) : targetTo;
  const newExitRef = (targetTo >= newActualNodeIndex ? newActualNodeIndex + blockSize : targetTo);
  function remapPointer(oldStr) {
    const v = parseInt(oldStr, 10);
    if (isNaN(v)) return oldStr;
    if (v === exitIdxOrig) return newExitRef.toString();
    if (v >= blockStart && v < blockEnd) return (newActualNodeIndex + (v - blockStart)).toString();
    return oldStr;
  }
  for (const n of blockLogic) {
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
      n.next.true = remapPointer(n.next.true);
      n.next.false = remapPointer(n.next.false);
    } else if (typeof n.next === "string" && n.next !== null) {
      n.next = remapPointer(n.next);
    }
  }

  // Fa spazio per il blocco: incrementa di blockSize tutti i puntatori ESTERNI >= newActualNodeIndex.
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i];
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
      const t = parseInt(n.next.true, 10);
      const f = parseInt(n.next.false, 10);
      if (!isNaN(t) && t >= newActualNodeIndex) n.next.true = (t + blockSize).toString();
      if (!isNaN(f) && f >= newActualNodeIndex) n.next.false = (f + blockSize).toString();
    } else if (typeof n.next === "string" && n.next !== null) {
      const nx = parseInt(n.next, 10);
      if (!isNaN(nx) && nx >= newActualNodeIndex) n.next = (nx + blockSize).toString();
    }
  }

  flow.nodes.splice(newActualNodeIndex, 0, ...blockLogic);
  nodi.splice(newActualNodeIndex, 0, ...blockVisual);

  const parentLogic = flow.nodes[targetFrom];
  const newTargetStr = newActualNodeIndex.toString();
  if (parentLogic && parentLogic.type === "if") {
    if (targetType === "if_join") {
      const shiftedJoin = newActualNodeIndex + blockSize;
      const redirectBranchToNew = (branchStartStr, sideKey) => {
        const start = parseInt(branchStartStr, 10);
        if (isNaN(start)) return;
        if (start === shiftedJoin) {
          if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next[sideKey] = newTargetStr;
        } else {
          redirectJoinRefs(start, shiftedJoin, newTargetStr, new Set());
        }
      };
      if (parentLogic.next && typeof parentLogic.next === "object") {
        redirectBranchToNew(parentLogic.next.true, "true");
        redirectBranchToNew(parentLogic.next.false, "false");
      }
    } else if (targetType === "if_true") {
      parentLogic.next.true = newTargetStr;
    } else if (targetType === "if_false") {
      parentLogic.next.false = newTargetStr;
    } else if (targetType === "loop_body_end") {
      // M3: vedi moveNode -- parentLogic (IF) e' l'ultimo nodo del corpo di un ciclo
      // ESTERNO, redirect identico a if_join ma senza shift in avanti (backward).
      const oldLoopTarget = targetTo;
      const redirectBranchToNewLoop = (branchStartStr, sideKey) => {
        const start = parseInt(branchStartStr, 10);
        if (isNaN(start)) return;
        if (start === oldLoopTarget) {
          if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next[sideKey] = newTargetStr;
        } else {
          redirectJoinRefs(start, oldLoopTarget, newTargetStr, new Set());
        }
      };
      if (parentLogic.next && typeof parentLogic.next === "object") {
        redirectBranchToNewLoop(parentLogic.next.true, "true");
        redirectBranchToNewLoop(parentLogic.next.false, "false");
      }
    }
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_body") {
    // M3: vedi moveNode -- dentro il corpo di un ciclo.
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.true = newTargetStr;
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_exit") {
    // M3: vedi moveNode -- subito dopo l'uscita di un ciclo.
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.false = newTargetStr;
  } else if (parentLogic && isBranchingNodeType(parentLogic.type) && targetType === "loop_body_end") {
    // M3: vedi moveNode -- parentLogic e' un ciclo, esso stesso ultimo del corpo di
    // un ciclo ESTERNO (nesting di cicli).
    if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next.false = newTargetStr;
  } else if (parentLogic) {
    parentLogic.next = newTargetStr;
  }

  // Nodo visuale del ciclo (relX): stessa logica di posizionamento di moveIfBlock.
  const loopVisual = blockVisual[0];
  const parentVis = nodi[targetFrom];
  let newRelX;
  const elbowOffset = 40;
  if (parentLogic && parentLogic.type === "if") {
    if (targetType === "if_join" && parentVis) {
      newRelX = parentVis.relX;
    } else if (targetType === "if_true" && parentVis) {
      const prX = parentVis.relX * w + parentVis.width / 2;
      newRelX = (prX + elbowOffset) / w;
    } else if (targetType === "if_false" && parentVis) {
      const plX = parentVis.relX * w - parentVis.width / 2;
      newRelX = (plX - elbowOffset) / w;
    } else {
      newRelX = parentVis ? parentVis.relX : 0.5;
    }
  } else if (parentVis && (targetType === "normal" || targetType === "loop_body" || targetType === "loop_exit" || targetType === "loop_body_end")) {
    newRelX = parentVis.relX;
  } else {
    newRelX = 0.5;
  }
  if (loopVisual) {
    const nodeWidth = loopVisual.width || 100;
    const minRX = (nodeWidth / 2) / w + 0.01;
    const maxRX = 1 - (nodeWidth / 2) / w - 0.01;
    if (newRelX < minRX) newRelX = minRX;
    if (newRelX > maxRX) newRelX = maxRX;
    loopVisual.relX = newRelX;
  }

  saved = false;
  calcoloY(nodi);
  draw(nodi);
}
// Evidenzia il ramo/arco del flowchart sotto il cursore (hover). Per gli IF
// evidenzia solo il ramo specifico (T o F) su cui si trova il mouse.
function onCanvasHover(event) {
  if (typeof frecce === 'undefined' || !frecce) return;
  const rect = canvas.getBoundingClientRect();
  const _rw = rect.width || w, _rh = rect.height || h;
  const mx = (event.clientX - rect.left) * (w / _rw);
  const my = (event.clientY - rect.top) * (h / _rh);
  // FIX P1 (piano 2026-07-06-nested-loops-round2): stesso ordine inverso di
  // clickFreccia, cosi' l'evidenziazione hover combacia sempre con l'arco che un
  // click nello stesso punto selezionerebbe davvero.
  let best = -1;
  for (let i = frecce.length - 1; i >= 0; i--) {
    const f = frecce[i];
    if (arcHitTest(f, mx, my, 8)) { best = i; break; }
  }
  let desc = null;
  if (best >= 0) {
    const f = frecce[best];
    desc = { kind: 'arc', ax: f.inzioX, ay: f.inzioY, bx: f.fineX, by: f.fineY };
  }
  if (canvas && canvas.style) canvas.style.cursor = best >= 0 ? 'pointer' : 'default';
  if (JSON.stringify(desc) !== JSON.stringify(hoverArc)) {
    hoverArc = desc;
    draw(nodi);
  }
}

// Gestisce il click su una freccia.
// Se una freccia viene cliccata, apre il popup per l'inserimento di un nuovo nodo.
// FIX (Ismail 2026-07-07, "se clicchi anche l'arco orizzontale ti fa mettere il blocco"):
// un arco cliccabile e' colpito se il punto e' vicino al suo segmento principale OPPURE a
// uno dei suoi segmenti visualExtra (la biforcazione orizzontale in alto / il ponte di
// ricongiunzione in basso). Cosi' cliccando/hoverando la parte orizzontale che si illumina
// si inserisce sullo STESSO arco. La "divisione" fra archi resta corretta perche' ogni
// orizzontale appartiene al proprio arco (fork -> arco d'ingresso; ponte -> arco "dopo
// l'ultimo"), e l'iterazione in ordine inverso risolve eventuali sovrapposizioni.
function arcHitTest(f, x, y, tol) {
  // isPointNearAnyLineSegment: distanza punto-segmento REALE (funziona per segmenti di
  // qualunque orientamento, inclusi gli orizzontali come fork/ponte -- isPointNearLine
  // invece assume segmenti verticali e non li rileverebbe).
  if (isPointNearAnyLineSegment(x, y, f.inzioX, f.inzioY, f.fineX, f.fineY, tol)) return true;
  if (f.visualExtra) {
    for (let k = 0; k < f.visualExtra.length; k++) {
      const seg = f.visualExtra[k];
      if (isPointNearAnyLineSegment(x, y, seg[0], seg[1], seg[2], seg[3], tol)) return true;
    }
  }
  return false;
}

function clickFreccia(event) {
  // Blocco 1: Calcola le coordinate del click relative al canvas
  let rect = canvas.getBoundingClientRect();
  const _rw = rect.width || w, _rh = rect.height || h;
  let clickX = (event.clientX - rect.left) * (w / _rw); // scala-aware (zoom canvas)
  let clickY = (event.clientY - rect.top) * (h / _rh);

  // Blocco 2: Itera sulle frecce disegnate e verifica se qualcuna è stata cliccata.
  // FIX P1 (piano 2026-07-06-nested-loops-round2): itera in ORDINE INVERSO, stesso
  // principio gia' in uso in hitTestNode per i nodi -- quando due archi coincidono
  // esattamente (es. un Do-While col corpo non vuoto: l'arco 'loop_body' che entra nel
  // PRIMO nodo del suo corpo e' un segmento degenere di lunghezza zero che condivide il
  // punto esatto con l'arco 'normal' che entra nel Do-While dall'esterno, disegnato
  // PRIMA nell'array perche' appartiene al nodo precedente processato dal draw-loop),
  // il primo match in ordine FORWARD e' sempre quello "piu' esterno"/meno specifico,
  // rendendo impossibile raggiungere l'arco interno con un click. L'arco disegnato per
  // ULTIMO e' quello visivamente "sopra" (stesso ordine di ctx.fill/stroke, pittura),
  // quindi e' anche quello che l'utente si aspetta di colpire cliccando in quel punto.
  for (let i = frecce.length - 1; i >= 0; i--) {
    const freccia = frecce[i];
    if (arcHitTest(freccia, clickX, clickY, 8)) { // include i segmenti visualExtra (orizzontali)
      console.log("Hai cliccato la freccia", freccia.id);
      document.getElementById("popup-window").classList.add("active");
      // FINESTRA non-modale (stile Windows): niente overlay, cosi' il terminale resta aperto e
      // cliccabile sullo sfondo; il click porta la finestra cliccata in primo piano (bfBringToFront).
      // (Il popup resta comunque centrato: position:fixed, indipendente dallo scroll.)
      if (typeof bfBringToFront === "function") bfBringToFront(document.getElementById("popup-window"));
      frecceSelected = freccia.id; // Memorizza l'ID della freccia selezionata
      return;
    }
  }
}

// Inserisce un nuovo nodo logico e visuale nel flowchart quando l'utente clicca su una freccia.
// Il 'tipo' specifica il tipo di nodo da inserire (es. "input", "print", "if").
// La funzione gestisce l'aggiornamento degli indici e dei puntatori 'next' dei nodi esistenti,
// e calcola la posizione del nuovo nodo visuale.
// Ridirige verso newStr tutti i puntatori 'next' che, nel sottoalbero a partire da idx,
// puntano a oldJoin. Si ferma al join e non entra in cicli. Gestisce sia nodi normali
// (next stringa) sia IF (next.true/next.false), SENZA mai sovrascrivere l'oggetto next
// di un IF (bug: inserendo dopo un IF si corrompeva l'IF figlio annidato).
function redirectJoinRefs(idx, oldJoin, newStr, visited) {
  if (idx === oldJoin || idx === null || idx === undefined || visited.has(idx)) return;
  visited.add(idx);
  const n = flow.nodes[idx];
  if (!n) return;
  // Generalizzato a isBranchingNodeType: un ciclo incontrato durante la risalita verso
  // il vecchio join deve poter avere i propri next.true/next.false redirette, come un IF.
  if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
    const t = parseInt(n.next.true, 10);
    const f = parseInt(n.next.false, 10);
    if (t === oldJoin) n.next.true = newStr; else redirectJoinRefs(t, oldJoin, newStr, visited);
    if (f === oldJoin) n.next.false = newStr; else redirectJoinRefs(f, oldJoin, newStr, visited);
  } else if (typeof n.next === "string" && n.next !== null) {
    const t = parseInt(n.next, 10);
    if (t === oldJoin) n.next = newStr; else redirectJoinRefs(t, oldJoin, newStr, visited);
  }
}

// ---- Undo / Redo ----
const HISTORY_LIMIT = 100;
function snapshotState() {
  return { flow: JSON.parse(JSON.stringify(flow)), nodi: JSON.parse(JSON.stringify(nodi)) };
}
function pushHistory() {
  undoStack.push(snapshotState());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
}
function restoreState(state) {
  flow = JSON.parse(JSON.stringify(state.flow));
  nodi = JSON.parse(JSON.stringify(state.nodi));
  nodoSelected = -1;
  frecceSelected = -1;
  saved = false;
  calcoloY(nodi);
  draw(nodi);
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshotState());
  restoreState(undoStack.pop());
  updateUndoRedoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshotState());
  restoreState(redoStack.pop());
  updateUndoRedoButtons();
}
function clearHistory() { undoStack = []; redoStack = []; updateUndoRedoButtons(); }
function updateUndoRedoButtons() {
  const u = document.getElementById('undo-btn');
  const r = document.getElementById('redo-btn');
  if (u) u.disabled = undoStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}

function inserisciNodo(tipo) {
  saved = false; 
  if (frecceSelected === -1 || !frecce[frecceSelected]) { 
    console.error("inserisciNodo ERRORE: Nessuna freccia selezionata o freccia non valida.");
    chiudiPopup();
    return;
  }

  pushHistory(); // snapshot per Undo (prima dell'inserimento)
  const clickedArrow = frecce[frecceSelected]; 
  const arrowType = clickedArrow.type; 
  const parentNodeIndex = clickedArrow.fromNodeIndex; //nodo da cui parte la freccia
  const originalTargetNodeIndex = clickedArrow.toNodeIndex; // nodo a cui la freccia puntava originariamente
  // L'indice a cui verrà inserito il nuovo nodo logico. Solitamente coincide con originalTargetNodeIndex, il target originale (e successivi) slittano.
  let newActualNodeIndex = originalTargetNodeIndex;

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

  // P1 FIX (review Fable, 2026-07-05 pomeriggio, piano nested-while-visuals): regola
  // UNICA per QUALUNQUE arco che punta all'indietro (originalTargetNodeIndex <=
  // parentNodeIndex), non solo i due casi storici gestiti finora (self-loop del corpo
  // vuoto di un ciclo, coda del corpo via loop_body_end). BUG scoperto: un IF annidato
  // nel corpo di un ciclo puo' avere rami VUOTI che convergono DIRETTAMENTE sul
  // back-edge del ciclo (target = indice del ciclo, che sta PRIMA dell'IF in
  // flow.nodes) -- arrowType e' allora 'if_true'/'if_false'/'if_join', non gestito
  // dai due casi speciali di prima, quindi cadeva nel ramo "avanti" di default:
  // newActualNodeIndex restava = originalTargetNodeIndex (l'indice del CICLO, prima
  // del genitore/IF) -- lo splice a quell'indice invalidava anche `parentNodeIndex`
  // stesso (il lookup di `flow.nodes[parentNodeIndex]` dopo lo splice ritornava un
  // nodo diverso, quello appena shiftato), corrompendo il grafo (nodo orfano, start
  // scollegato, si veda PLANS/2026-07-05-nested-while-visuals.md P1). Fix: se il
  // target e' <= il genitore (arco all'indietro, qualunque tipo), il nuovo nodo va
  // SEMPRE inserito SUBITO DOPO il genitore (parentNodeIndex+1) -- mai al posto del
  // target, che resta invariato e non shifta. Questo assorbe anche i due casi
  // speciali di prima (self-loop: parentNodeIndex===originalTargetNodeIndex; coda
  // del corpo: originalTargetNodeIndex=loopIdx < parentNodeIndex=lastBodyIdx) come
  // casi particolari della stessa regola, invece di un terzo caso speciale a parte.
  const isBackwardInsert = originalTargetNodeIndex <= parentNodeIndex;
  if (isBackwardInsert) {
    newActualNodeIndex = parentNodeIndex + 1;
  }

  // 1) Creazione del nuovo nodo logico
  let newNodeLogic; // Oggetto per il nuovo nodo logico
  // Il nuovo nodo punta a "dove finisce il vecchio target originale dopo lo shift".
  // Caso normale: originalTargetNodeIndex === newActualNodeIndex -> shifta a +1 (comportamento storico).
  // Caso self-loop di un ciclo: originalTargetNodeIndex (== loopIdx) resta PRIMA del punto di
  // inserimento (loopIdx+1), quindi non shifta: il nuovo nodo deve chiudere il back-edge
  // tornando a loopIdx invariato, non a "newActualNodeIndex+1" (che sarebbe oltre il ciclo).
  const nextForNew = (originalTargetNodeIndex >= newActualNodeIndex
    ? originalTargetNodeIndex + 1
    : originalTargetNodeIndex
  ).toString();
  if (tipo === "if") { // Se il nuovo nodo è un IF
    newNodeLogic = {
      type: "if",
      info: "",
      next: { true: nextForNew, false: nextForNew } 
    };
  } else if (isBranchingNodeType(tipo) && tipo !== "if") {
    // FIX B1 (review Fable, 2026-07-05, piano Do-While/For): generalizzato da "solo
    // while" a qualunque ciclo (While/For/Do-While) -- stessa creazione a corpo vuoto
    // self-loop, l'unica differenza fra i tre tipi e' etichette/colore (LOOP_LABELS/
    // NODE_COLORS, gia' centralizzati) e la semantica di esecuzione (execute.js), non
    // la struttura dati creata qui.
    newNodeLogic = {
      type: tipo,
      info: "",
      next: { true: newActualNodeIndex.toString(), false: nextForNew }
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

    // isBranchingNodeType: IF + While/For/Do (tutti hanno next={true,false}). Generalizzato
    // da "solo if" perche' altrimenti i puntatori di un while/for/do gia' presente altrove
    // nel flusso non venivano shiftati quando si inserisce un nodo NON legato a lui.
    if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) { // Se il nodo 'n' è a diramazione
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
      // Il nuovo nodo diventa il punto di ricongiunzione: gli EXIT dei rami che puntavano
      // al vecchio join (ora slittato a newActualNodeIndex+1) devono puntare al nuovo nodo.
      // Si redirigono le diramazioni SENZA sovrascrivere il .next oggetto di un IF interno.
      const shiftedJoin = newActualNodeIndex + 1;
      const redirectBranchToNew = (branchStartStr, sideKey) => {
        const start = parseInt(branchStartStr, 10);
        if (isNaN(start)) return;
        if (start === shiftedJoin) {
          // Ramo VUOTO: puntava direttamente al join -> ora al nuovo nodo.
          if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next[sideKey] = newTargetStr;
        } else {
          redirectJoinRefs(start, shiftedJoin, newTargetStr, new Set());
        }
      };
      if (parentLogic.next && typeof parentLogic.next === "object") {
        redirectBranchToNew(parentLogic.next.true, "true");
        redirectBranchToNew(parentLogic.next.false, "false");
      }
      console.log(`inserisciNodo INFO: JOIN sotto IF → rami convergono su ${newTargetStr}`);
    }
    else if (arrowType === "if_true") { // Inserimento nel ramo true
      parentLogic.next.true = newTargetStr;
      console.log(`inserisciNodo INFO: Inserimento in ramo TRUE → next.true = ${newTargetStr}`);
    }
    else if (arrowType === "if_false") { // Inserimento nel ramo false
      parentLogic.next.false = newTargetStr;
      console.log(`inserisciNodo INFO: Inserimento in ramo FALSE → next.false = ${newTargetStr}`);
    }
    else if (arrowType === "loop_body_end") {
      // N1 (review Fable, 2026-07-04 notte-4): l'IF e' l'ULTIMO nodo del corpo di un
      // ciclo esterno (While/For/Do). Stessa logica del ramo 'if_join' sopra (i rami
      // che puntavano al "vecchio join" ora convergono sul nuovo nodo), ma qui il
      // "vecchio join" dal punto di vista dell'IF e' il ciclo stesso (il back-edge,
      // originalTargetNodeIndex === loopIdx) e NON shifta con l'inserimento: a
      // differenza di if_join (dove il nuovo nodo si inserisce IN AVANTI e il vecchio
      // join slitta di +1), qui l'inserimento e' ALL'INDIETRO rispetto a loopIdx (che
      // resta prima del nuovo nodo, invariato) -- quindi nessun +1.
      const oldJoinForLoop = originalTargetNodeIndex; // === loopIdx, invariato
      const redirectBranchToNewLoop = (branchStartStr, sideKey) => {
        const start = parseInt(branchStartStr, 10);
        if (isNaN(start)) return;
        if (start === oldJoinForLoop) {
          if (parentLogic.next && typeof parentLogic.next === "object") parentLogic.next[sideKey] = newTargetStr;
        } else {
          redirectJoinRefs(start, oldJoinForLoop, newTargetStr, new Set());
        }
      };
      if (parentLogic.next && typeof parentLogic.next === "object") {
        redirectBranchToNewLoop(parentLogic.next.true, "true");
        redirectBranchToNewLoop(parentLogic.next.false, "false");
      }
      console.log(`inserisciNodo INFO: Fine corpo ciclo (genitore IF) → rami convergono su ${newTargetStr}`);
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
  }
  // Genitore = ciclo (While/For/Do) e freccia = corpo del ciclo: il nuovo nodo diventa
  // il primo (o un nuovo) nodo del corpo, quindi next.true del ciclo deve puntare a lui.
  // Copre sia il primo inserimento nel corpo vuoto (self-loop, vedi isLoopSelfBodyInsert
  // sopra) sia un futuro inserimento in un punto intermedio del corpo.
  else if (parentLogic && isBranchingNodeType(parentLogic.type) && arrowType === "loop_body") {
    const newTargetStr = newActualNodeIndex.toString();
    if (parentLogic.next && typeof parentLogic.next === "object") {
      parentLogic.next.true = newTargetStr;
    }
    console.log(`inserisciNodo INFO: Corpo ciclo → next.true = ${newTargetStr}`);
  }
  // BUG B1 (trovato dalla review di Fable, 2026-07-04 notte-2): un click sull'arco
  // 'loop_exit' (genitore = ciclo, uscita) cadeva nell'else generico sotto, che
  // assegna una STRINGA a parentLogic.next — per un while/for/do questo distrugge
  // l'oggetto {true,false}, corrompendo il ciclo (il corpo resta con un back-edge
  // verso un nodo che non è più un ciclo). Ramo esplicito per l'uscita del ciclo.
  else if (parentLogic && isBranchingNodeType(parentLogic.type) && arrowType === "loop_exit") {
    const newTargetStr = newActualNodeIndex.toString();
    if (parentLogic.next && typeof parentLogic.next === "object") {
      parentLogic.next.false = newTargetStr;
    }
    console.log(`inserisciNodo INFO: Uscita ciclo → next.false = ${newTargetStr}`);
  }
  // N1 (review Fable, 2026-07-04 notte-4): genitore = ciclo/IF annidato che e' l'ULTIMO
  // nodo del corpo di un ciclo esterno (freccia 'loop_body_end'). Stesso principio di
  // B1/loop_exit: il genitore ha un next A OGGETTO, quindi va aggiornato next.false (la
  // sua "uscita", che nel corpo del ciclo esterno chiude verso il back-edge), MAI
  // sovrascritto con una stringa. Il caso comune (genitore = nodo lineare semplice, es.
  // un assign qualsiasi come ultimo del corpo) cade invece nel ramo generico sotto,
  // dove sovrascrivere .next con una stringa e' corretto (non e' a diramazione).
  else if (parentLogic && isBranchingNodeType(parentLogic.type) && arrowType === "loop_body_end") {
    const newTargetStr = newActualNodeIndex.toString();
    if (parentLogic.next && typeof parentLogic.next === "object") {
      parentLogic.next.false = newTargetStr;
    }
    console.log(`inserisciNodo INFO: Fine corpo ciclo (genitore a diramazione) → next.false = ${newTargetStr}`);
  }
  // Se il genitore non è un IF ne' un ciclo (inserimento "normale" dopo un nodo qualsiasi).
  // Guardia difensiva (B1): se il genitore ha comunque un next A OGGETTO (es. un tipo di
  // arco futuro non ancora mappato esplicitamente sopra), NON sovrascriverlo mai con una
  // stringa — logga l'errore e si ferma, invece di corrompere silenziosamente i dati.
  else if (parentLogic) {
    if (parentLogic.next && typeof parentLogic.next === "object") {
      console.error(`inserisciNodo ERRORE: arrowType '${arrowType}' non gestito per un genitore a diramazione (tipo ${parentLogic.type}). Nessuna modifica per evitare di corrompere next.true/next.false.`);
    } else {
      parentLogic.next = newActualNodeIndex.toString(); // Il genitore punta al nuovo nodo
      console.log(`inserisciNodo INFO: Genitore non-IF → next = ${newActualNodeIndex}`);
    }
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
  else if (arrowType === "loop_body_end" && parentVis) {
    // N1: fine del corpo -- il genitore (ultimo nodo del corpo) e' GIA' nella colonna
    // del corpo: il nuovo nodo si allinea con lui (il layout definitivo lo riposiziona
    // comunque in calcoloY() piu' sotto).
    newRelX = parentVis.relX;
  }
  else if (parentLogic && isBranchingNodeType(parentLogic.type) && arrowType === "loop_body" && parentVis) {
    // Corpo del ciclo: esce dal basso del rombo, quindi si allinea in verticale col genitore
    // (posizionamento provvisorio; il layout definitivo arriva con collectLoopBody/Fase 2).
    newRelX = parentVis.relX;
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
    text: (typeof nodeText === 'function' ? nodeText(tipo) : tipo.charAt(0).toUpperCase() + tipo.slice(1)) // Testo del nodo
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
    const _rw = rect.width || w, _rh = rect.height || h;
    let clickX = (event.clientX - rect.left) * (w / _rw); // scala-aware (zoom canvas)
    let clickY = (event.clientY - rect.top) * (h / _rh);

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
        if (flow.nodes[i].type === "for" && typeof openForDialog === "function") {
          // FIX (Ismail 2026-07-07): il For si modifica con un dialog dedicato (Variabile/
          // Iniziale/Finale/Direzione/Passo), non scrivendo a mano la sintassi.
          openForDialog(i);
          nodoSelected = i;
          return;
        }
        if (typeof TURTLE_TYPES !== "undefined" && TURTLE_TYPES.indexOf(flow.nodes[i].type) !== -1) {
          // Blocchi GRAFICA (turtle): forward/turn/pen aprono un dialog dedicato; home/gclear
          // non hanno parametri (openTurtleDialog non mostra nulla per loro).
          if (typeof openTurtleDialog === "function") openTurtleDialog(i);
          nodoSelected = i;
          return;
        }
        if (flow.nodes[i].type != "start" && flow.nodes[i].type != "end") {
          document.getElementById("edit-node-popup").classList.add("active");
          document.getElementById("overlay").classList.add("active"); 
          document.getElementById("edit-node-title").innerHTML = (typeof i18nText === "function" && i18nText("edit_title")) || ("Edit " + flow.nodes[i].type + " node");
          document.getElementById("edit-node-input").value = flow.nodes[i].info || "";
          // FIX B1 (review Fable, 2026-07-05, piano Do-While/For): il For richiede la
          // sintassi a 3 parti "init;condizione;incremento" (l'executor -- applyForIncrement
          // in execute.js -- la spacca sui ";" e da' un errore leggibile se manca un pezzo).
          // Un hint nel placeholder evita di scoprirlo solo in fase di esecuzione.
          const editInput = document.getElementById("edit-node-input");
          if (editInput) editInput.placeholder = (flow.nodes[i].type === "for") ? "es. i=0;i<10;i++" : "";
        }
        nodoSelected = i;
        return;
      }
    }
  }
  // FIX BUG 1 (segnalato da Ismail 2026-07-05 sera, "quando elimini un if si devono
  // eliminare a cascata tutti i nodi interni, stessa roba per i cicli"): cancella un
  // intero BLOCCO branching (IF o ciclo) -- se stesso + tutto il contenuto dei suoi
  // rami/corpo, ricorsivamente (IF/cicli annidati inclusi) -- invece di lasciare i
  // nodi interni orfani nell'array (comportamento precedente per l'IF, documentato
  // esplicitamente nel commento storico sotto rimosso: "i suoi due rami restano
  // orfani come da comportamento preesistente") o rifiutare del tutto la
  // cancellazione (comportamento precedente per un ciclo, alert() rimosso sotto).
  // Riusa gli stessi confini VERI del sottoalbero gia' calcolati e testati per il
  // drag&drop (collectFullIfSubtreeMembers/collectFullLoopSubtreeMembers) e la
  // STESSA "STEP A" di rimozione di moveIfBlock/moveLoopBlock (redirect del vero
  // successore ESTERNO, poi splice dell'intero range e ri-shift di tutti i puntatori
  // rimanenti) -- senza pero' una fase di reinserimento: qui il blocco sparisce per
  // sempre, non torna da nessuna parte.
  function deleteBlock(rootIdx, opts) {
    opts = opts || {};
    const rootLogic = flow.nodes[rootIdx];
    if (!rootLogic || !isBranchingNodeType(rootLogic.type)) return false;
    const isIf = rootLogic.type === "if";
    const info = isIf ? collectFullIfSubtreeMembers(rootIdx) : collectFullLoopSubtreeMembers(rootIdx);
    if (!info || !info.contiguous) {
      showStyledAlert((typeof i18nText === 'function' && i18nText('del_err_struct')) || "Struttura interna del blocco non valida.", { danger: true });
      return false;
    }
    const blockStart = info.blockStart, blockEnd = info.blockEnd;
    const exitIdxOrig = isIf ? info.joinIndex : info.exitIndex;
    if (exitIdxOrig === null || exitIdxOrig === undefined) {
      showStyledAlert((typeof i18nText === 'function' && i18nText('del_err_exit')) || "Punto di uscita del blocco non calcolabile.", { danger: true });
      return false;
    }
    // Per un IF il join deve essere sempre "in avanti" (>= blockEnd, nessuna
    // semantica di back-edge). Per un ciclo, invece, l'uscita PUO' legittimamente
    // puntare ALL'INDIETRO a un antenato (stesso criterio gia' corretto in
    // moveLoopBlock/onCanvasMouseDown per il bug 3, vedi FIX BUG 3 sopra) -- si
    // rifiuta solo il vero caso di corruzione (uscita dentro il blocco stesso).
    // FIX (Ismail 2026-07-08): un IF/ciclo che e' l'ULTIMO membro del corpo di un ciclo
    // (o di un ramo che si ricongiunge al ciclo) ha l'uscita/ricongiunzione che punta
    // LEGITTIMAMENTE all'INDIETRO (indice del ciclo antenato, < blockStart), tramite il
    // back-edge. Prima l'IF rifiutava QUALSIASI join < blockEnd -> errore spurio nel
    // ramo False di un IF padre annidato nei cicli (bug segnalato con screenshot). Ora,
    // come gia' per i cicli, si rifiuta SOLO il vero caso di corruzione: uscita DENTRO
    // il blocco [blockStart, blockEnd).
    if (exitIdxOrig >= blockStart && exitIdxOrig < blockEnd) {
      showStyledAlert((typeof i18nText === 'function' && i18nText(isIf ? 'del_err_join' : 'del_err_loopexit')) || "Struttura del blocco inattesa.", { danger: true });
      return false;
    }

    // Conferma esplicita se il blocco contiene piu' di un nodo (cancellazione
    // estesa): nicety UX, Undo/Redo restano comunque disponibili in ogni caso.
    const blockSize = blockEnd - blockStart;
    const performDelete = function () {
    pushHistory(); // snapshot per Undo (prima della cancellazione)

    // STEP A (identica a moveIfBlock/moveLoopBlock, senza fase di reinserimento):
    // qualunque puntatore ESTERNO che punta esattamente a blockStart (l'ingresso del
    // blocco) va rediretto al vero successore esterno (exitIdxOrig, adattato per lo
    // shift), non lasciato invariato sperando che lo shift lo faccia atterrare li'.
    const adjustForRemoval = (v) => (v >= blockEnd ? v - blockSize : v);
    const ownExitAdjusted = adjustForRemoval(exitIdxOrig);

    flow.nodes.splice(blockStart, blockSize);
    nodi.splice(blockStart, blockSize);
    for (let i = 0; i < flow.nodes.length; i++) {
      const n = flow.nodes[i];
      if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
        const t = parseInt(n.next.true, 10);
        const f = parseInt(n.next.false, 10);
        if (!isNaN(t)) n.next.true = (t === blockStart ? ownExitAdjusted : adjustForRemoval(t)).toString();
        if (!isNaN(f)) n.next.false = (f === blockStart ? ownExitAdjusted : adjustForRemoval(f)).toString();
      } else if (typeof n.next === "string" && n.next !== null) {
        const nx = parseInt(n.next, 10);
        if (!isNaN(nx)) n.next = (nx === blockStart ? ownExitAdjusted : adjustForRemoval(nx)).toString();
      }
    }

    nodoSelected = -1;
    saved = false;
    calcoloY(nodi);
    draw(nodi);
    chiudiEditPopup();
    };
    // Il taglio e le cancellazioni programmatiche saltano la conferma (skipConfirm=true):
    // il taglio deve solo spostare il blocco negli appunti, senza avviso. Per una
    // cancellazione VERA con nodi interni si mostra una modale STILIZZATA (coerente col
    // tema), non piu' il confirm() del browser.
    if (!opts.skipConfirm && blockSize > 1) {
      const inner = blockSize - 1;
      const tmpl = (typeof i18nText === 'function' && i18nText('del_block_confirm')) || 'Eliminare questo blocco e i suoi {n} nodi interni?';
      const msg = tmpl.replace('{n}', inner);
      if (typeof showStyledConfirm === 'function') {
        showStyledConfirm(msg, performDelete, { danger: true, okLabel: (typeof i18nText === 'function' ? i18nText('delete') : 'Delete') });
        return true;
      }
    }
    performDelete();
    return true;
  }

  function deleteNode(opts){
    opts = opts || {};
    if (nodoSelected === -1 || nodoSelected >= flow.nodes.length) return; // Nessun nodo selezionato o indice non valido

    // FIX BUG 1: un IF o un ciclo (While/For/Do) vengono ora cancellati a CASCATA
    // (se stessi + l'intero sottoalbero di rami/corpo) tramite deleteBlock() sopra,
    // invece di lasciare i rami orfani (IF, comportamento precedente) o rifiutare
    // del tutto (ciclo, comportamento precedente).
    if (isBranchingNodeType(flow.nodes[nodoSelected].type)) {
      deleteBlock(nodoSelected, opts);
      return;
    }

    pushHistory(); // snapshot per Undo (prima della cancellazione)

    // BUG storico (trovato da Ismail: cancellare l'ultimo nodo di un ramo IF quando
    // un ALTRO ramo/contenuto lo segue subito nell'array corrompeva la struttura,
    // vedi PROBLEMS.md e lo stesso fix in moveNode). Un puntatore che punta
    // ESATTAMENTE al nodo cancellato non puo' essere lasciato invariato assumendo
    // che lo shift dell'array lo faccia atterrare sul nodo giusto: funziona solo se
    // il vero successore del nodo cancellato e' fisicamente lo slot successivo, falso
    // se dopo di lui c'e' un fratello di un altro ramo. Si calcola quindi il vero
    // successore (solo per nodi "semplici" con next stringa; per un IF cancellato i
    // suoi due rami restano orfani come da comportamento preesistente, invariato).
    const deletedLogic = flow.nodes[nodoSelected];
    const deletedOwnNextRaw = (deletedLogic && typeof deletedLogic.next === "string") ? parseInt(deletedLogic.next, 10) : NaN;
    const adjustForDelete = (v) => (v > nodoSelected ? v - 1 : v);
    const deletedOwnNextAdjusted = isNaN(deletedOwnNextRaw) ? null : adjustForDelete(deletedOwnNextRaw);

    flow.nodes.splice(nodoSelected,1); 
    for(let i = 0; i < flow.nodes.length; i++) {
        const n = flow.nodes[i];
        // isBranchingNodeType (IF + While/For/Do): stesso motivo della generalizzazione
        // in inserisciNodo, altrimenti cancellare un nodo qualsiasi non aggiorna i
        // puntatori .true/.false di un while/for/do gia' presente altrove nel flusso.
        if (isBranchingNodeType(n.type) && typeof n.next === "object" && n.next !== null) {
            let trueNext = parseInt(n.next.true, 10);
            let falseNext = parseInt(n.next.false, 10);
            if (!isNaN(trueNext)) {
                n.next.true = (trueNext === nodoSelected && deletedOwnNextAdjusted !== null ? deletedOwnNextAdjusted : adjustForDelete(trueNext)).toString();
            }
            if (!isNaN(falseNext)) {
                n.next.false = (falseNext === nodoSelected && deletedOwnNextAdjusted !== null ? deletedOwnNextAdjusted : adjustForDelete(falseNext)).toString();
            }
        } else if (typeof n.next === "string" && n.next !== null) {
            let normalNext = parseInt(n.next, 10);
            if (!isNaN(normalNext)) {
                n.next = (normalNext === nodoSelected && deletedOwnNextAdjusted !== null ? deletedOwnNextAdjusted : adjustForDelete(normalNext)).toString();
            }
        }
    }


    nodi.splice(nodoSelected,1); // Rimuove il nodo visuale
    nodoSelected = -1; // Deseleziona
    calcoloY(nodi); // Ricalcola le Y
    draw(nodi); // Ridisegna
    chiudiEditPopup(); // Chiude l'eventuale popup di modifica
  }

// ============================================================================
// MIGLIORIA #44 (Ismail 2026-07-08): DUPLICA blocco. Clona tipo+contenuto di un nodo e lo
// inserisce SUBITO DOPO, riusando inserisciNodo() (che gestisce gia' in modo sicuro lo shift
// degli indici e i puntatori next). Per i nodi SEMPLICI (next stringa) il clone e' completo;
// per i blocchi ramificati (if/while/for/do) il clone profondo del sottoalbero richiede un
// remap dedicato -> per ora si avvisa (evita di corrompere il grafo).
function duplicaNodo(idx) {
  if (typeof flow === 'undefined' || !flow.nodes || !flow.nodes[idx]) return false;
  const n = flow.nodes[idx];
  if (n.type === 'start' || n.type === 'end') return false;
  if (typeof n.next !== 'string') {
    if (typeof printMessage === 'function') printMessage('Duplica: i blocchi con rami (if/cicli) non sono ancora duplicabili in profondità.', 'debug');
    else if (typeof alert === 'function') alert('I blocchi con rami (if/cicli) non sono ancora duplicabili in profondità.');
    return false;
  }
  // trova l'arco uscente CLICCABILE del nodo (verso il nodo successivo)
  const arc = (typeof frecce !== 'undefined') ? frecce.find(function (f) {
    return f && f.fromNodeIndex === idx && (f.type === 'normal' || f.type === 'loop_body_end' || f.type === 'if_join');
  }) : null;
  if (!arc) return false;
  const info = n.info, type = n.type;
  frecceSelected = arc.id;
  inserisciNodo(type); // inserisce un nodo VUOTO dello stesso tipo dopo idx (idx non shifta: insert in avanti)
  // il nuovo nodo e' ora il next di idx: ne copiamo il contenuto
  const nn = flow.nodes[idx] ? parseInt(flow.nodes[idx].next, 10) : NaN;
  if (!isNaN(nn) && flow.nodes[nn]) {
    flow.nodes[nn].info = info;
    if (typeof calcoloY === 'function' && typeof nodi !== 'undefined') calcoloY(nodi);
    if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
    return true;
  }
  return false;
}

// ============================================================================
// Menu contestuale (click destro su blocco O arco) + Appunti dei blocchi
// (copia/taglia/incolla, ANCHE annidati) + scorciatoie Ctrl+C/X/V (Ismail 2026-07-08).
// Undo/Redo (Ctrl+Z/Y) sono in init.js.
//
// clipboard = { kind:'simple', type, info }
//           | { kind:'tree', size, rootType, nodes:[ {type,info,next} ...] } dove next e':
//               - per un nodo semplice: un OFFSET numerico interno al blocco, oppure 'EXIT'
//               - per un nodo a rami:   { true:<offset|'EXIT'>, false:<offset|'EXIT'> }
//               - null (solo teoricamente per end, mai copiato)
// L'offset e' relativo a blockStart; 'EXIT' = il successore del blocco (dove punta l'uscita).
// ============================================================================
let blockClipboard = null;
let ctxMenuNodeIdx = -1;   // nodo su cui e' aperto il menu (-1 se il menu e' su un arco)
let ctxMenuArcId = -1;     // arco su cui e' aperto il menu (-1 se il menu e' su un nodo)

function _clipMsg(msg, cat) { if (typeof printMessage === 'function') { try { printMessage(msg, cat || 'debug'); } catch (e) {} } }

function nodeIndexAtEvent(event) {
  if (typeof canvas === 'undefined' || !canvas || typeof nodi === 'undefined') return -1;
  const rect = canvas.getBoundingClientRect();
  const _rw = rect.width || w, _rh = rect.height || h;
  const cx = (event.clientX - rect.left) * (w / _rw);
  const cy = (event.clientY - rect.top) * (h / _rh);
  for (let i = 0; i < nodi.length; i++) {
    const node = nodi[i]; if (!node) continue;
    const x0 = node.relX * w - node.width / 2, y0 = node.relY * h - node.height / 2;
    if (cx >= x0 && cx <= x0 + node.width && cy >= y0 && cy <= y0 + node.height) return i;
  }
  return -1;
}
// Id (=indice) dell'arco cliccabile sotto il puntatore, o -1.
function arcIdAtEvent(event) {
  if (typeof canvas === 'undefined' || !canvas || typeof frecce === 'undefined') return -1;
  const rect = canvas.getBoundingClientRect();
  const _rw = rect.width || w, _rh = rect.height || h;
  const cx = (event.clientX - rect.left) * (w / _rw);
  const cy = (event.clientY - rect.top) * (h / _rh);
  for (let i = frecce.length - 1; i >= 0; i--) {
    const f = frecce[i]; if (!f) continue;
    if (typeof arcHitTest === 'function' ? arcHitTest(f, cx, cy, 8)
        : isPointNearAnyLineSegment(cx, cy, f.inzioX, f.inzioY, f.fineX, f.fineY, 10)) return f.id;
  }
  return -1;
}

function openNodeEditor(idx) {
  const n = flow.nodes[idx]; if (!n) return;
  nodoSelected = idx;
  if (n.type === 'for' && typeof openForDialog === 'function') { openForDialog(idx); return; }
  if (typeof TURTLE_TYPES !== 'undefined' && TURTLE_TYPES.indexOf(n.type) !== -1) { if (typeof openTurtleDialog === 'function') openTurtleDialog(idx); return; }
  if (n.type !== 'start' && n.type !== 'end') {
    const pop = document.getElementById('edit-node-popup'); const ov = document.getElementById('overlay');
    if (pop) pop.classList.add('active'); if (ov) ov.classList.add('active');
    const title = document.getElementById('edit-node-title'); if (title) title.innerHTML = (typeof i18nText === 'function' && i18nText('edit_title')) || ('Edit ' + n.type + ' node');
    const inp = document.getElementById('edit-node-input');
    if (inp) { inp.value = n.info || ''; inp.placeholder = (n.type === 'for') ? 'es. i=0;i<10;i++' : ''; }
  }
}

// --- Serializzazione di un blocco (semplice o a rami, con sottoalbero completo) ---
function copyNode(idx) {
  const n = flow.nodes && flow.nodes[idx]; if (!n) return false;
  if (n.type === 'start' || n.type === 'end') { _clipMsg('Start/End non si copiano.'); return false; }
  if (typeof n.next === 'string') { blockClipboard = { kind: 'simple', type: n.type, info: n.info }; _clipMsg('Copiato: ' + n.type); return true; }
  // blocco a rami (if/ciclo): copia PROFONDA del sottoalbero
  return copySubtree(idx);
}
function copySubtree(idx) {
  const root = flow.nodes[idx];
  if (!root || !isBranchingNodeType(root.type)) return false;
  const isIf = root.type === 'if';
  const info = isIf ? collectFullIfSubtreeMembers(idx) : collectFullLoopSubtreeMembers(idx);
  if (!info || !info.contiguous) { _clipMsg('Copia: struttura del blocco non riconosciuta.'); return false; }
  const bs = info.blockStart, be = info.blockEnd;
  const exit = isIf ? info.joinIndex : info.exitIndex;
  const size = be - bs;
  const relOf = (pStr) => {
    if (pStr === null || pStr === undefined) return null;
    const pi = parseInt(pStr, 10); if (isNaN(pi)) return null;
    if (pi >= bs && pi < be) return pi - bs;   // interno -> offset
    if (pi === exit) return 'EXIT';            // uscita del blocco
    return '__EXT__';                          // riferimento esterno non gestito
  };
  const nodesRel = [];
  for (let k = bs; k < be; k++) {
    const nd = flow.nodes[k]; let next;
    if (typeof nd.next === 'object' && nd.next !== null) {
      const t = relOf(nd.next.true), f = relOf(nd.next.false);
      if (t === '__EXT__' || f === '__EXT__') { _clipMsg('Copia: il blocco ha collegamenti esterni non gestiti.'); return false; }
      next = { true: t, false: f };
    } else {
      const p = relOf(nd.next);
      if (p === '__EXT__') { _clipMsg('Copia: il blocco ha collegamenti esterni non gestiti.'); return false; }
      next = p;
    }
    nodesRel.push({ type: nd.type, info: nd.info, next: next });
  }
  blockClipboard = { kind: 'tree', size: size, rootType: root.type, nodes: nodesRel };
  _clipMsg('Copiato blocco ' + root.type + ' (' + size + ' nodi)');
  return true;
}
function cutNode(idx) {
  if (!copyNode(idx)) return false;
  nodoSelected = idx;
  if (typeof deleteNode === 'function') deleteNode({ skipConfirm: true });
  return true;
}

function _shiftNextPtrs(n, threshold, delta) {
  if (!n) return;
  if (typeof n.next === 'object' && n.next !== null) {
    ['true', 'false'].forEach(function (k) { const p = parseInt(n.next[k], 10); if (!isNaN(p) && p >= threshold) n.next[k] = (p + delta).toString(); });
  } else if (typeof n.next === 'string' && n.next !== null) {
    const p = parseInt(n.next, 10); if (!isNaN(p) && p >= threshold) n.next = (p + delta).toString();
  }
}

// Incolla il contenuto degli appunti sull'arco attualmente selezionato (frecceSelected).
function pasteAtSelectedArc() {
  if (!blockClipboard) { _clipMsg('Niente da incollare.'); return false; }
  if (frecceSelected < 0 || !frecce[frecceSelected]) { _clipMsg('Seleziona un arco/blocco dove incollare.'); return false; }
  if (blockClipboard.kind === 'simple') {
    const arc = frecce[frecceSelected];
    const parent = arc.fromNodeIndex, target = arc.toNodeIndex;
    const R = (target <= parent) ? parent + 1 : target;
    inserisciNodo(blockClipboard.type);
    if (flow.nodes[R]) { flow.nodes[R].info = blockClipboard.info; if (typeof calcoloY === 'function') calcoloY(nodi); if (typeof draw === 'function') draw(nodi); nodoSelected = R; return true; }
    return false;
  }
  // kind === 'tree'
  return pasteTreeAtSelectedArc();
}
function pasteTreeAtSelectedArc() {
  const clip = blockClipboard;
  const arc = frecce[frecceSelected];
  const parent = arc.fromNodeIndex, target = arc.toNodeIndex;
  const R = (target <= parent) ? parent + 1 : target;   // indice di inserimento della radice (come inserisciNodo)
  inserisciNodo(clip.rootType);                          // inserisce la radice VUOTA, gia' cablata al successore
  const root = flow.nodes[R];
  if (!root || root.type !== clip.rootType || typeof root.next !== 'object') { _clipMsg('Incolla: inserimento della radice fallito.'); return false; }
  // Successore del blocco appena creato (dove punta l'uscita della radice vuota).
  const S = (clip.rootType === 'if') ? parseInt(root.next.true, 10) : parseInt(root.next.false, 10);
  root.info = clip.nodes[0].info;
  const d = clip.size - 1;
  if (d > 0) {
    for (let i = 0; i < flow.nodes.length; i++) _shiftNextPtrs(flow.nodes[i], R + 1, d); // fai spazio ai discendenti
    const Sp = (S >= R + 1) ? S + d : S;
    const mapRel = function (rel) { return rel === 'EXIT' ? Sp : (R + rel); };
    // Rami della radice, dai puntatori relativi del clip
    const cr = clip.nodes[0];
    root.next = { true: String(mapRel(cr.next.true)), false: String(mapRel(cr.next.false)) };
    // Discendenti (clip 1..size-1) -> indici assoluti R+1..R+size-1
    const newLogic = [], newVis = [];
    for (let ci = 1; ci < clip.size; ci++) {
      const cn = clip.nodes[ci]; let next;
      if (typeof cn.next === 'object' && cn.next !== null) next = { true: String(mapRel(cn.next.true)), false: String(mapRel(cn.next.false)) };
      else next = (cn.next === null || cn.next === undefined) ? null : String(mapRel(cn.next));
      newLogic.push({ type: cn.type, info: cn.info, next: next });
      newVis.push({ relX: 0.5, relY: 0, width: 100, height: NODE_BASE_HEIGHT_PX, color: 'white', text: (typeof nodeText === 'function' ? nodeText(cn.type) : cn.type.charAt(0).toUpperCase() + cn.type.slice(1)) });
    }
    flow.nodes.splice(R + 1, 0, ...newLogic);
    nodi.splice(R + 1, 0, ...newVis);
  }
  saved = false;
  if (typeof calcoloY === 'function') calcoloY(nodi);
  if (typeof draw === 'function') draw(nodi);
  nodoSelected = R;
  return true;
}

// Incolla DOPO un nodo (usato dal menu contestuale sul nodo e da Ctrl+V): trova un arco
// uscente adatto e delega a pasteAtSelectedArc.
function pasteNode(targetIdx) {
  if (!blockClipboard) { _clipMsg('Niente da incollare.'); return false; }
  const idx = (typeof targetIdx === 'number' && targetIdx >= 0) ? targetIdx : nodoSelected;
  if (idx < 0 || !flow.nodes[idx]) { _clipMsg('Seleziona un blocco dopo cui incollare.'); return false; }
  const arc = (typeof frecce !== 'undefined') ? frecce.find(function (f) {
    return f && f.fromNodeIndex === idx && (f.type === 'normal' || f.type === 'loop_body_end' || f.type === 'if_join' || f.type === 'loop_exit');
  }) : null;
  if (!arc) { _clipMsg('Impossibile incollare qui.'); return false; }
  frecceSelected = arc.id;
  return pasteAtSelectedArc();
}

// --- Menu contestuale ---
function showContextMenu(event) {
  const menu = document.getElementById('ctx-menu'); if (!menu) return;
  const idx = nodeIndexAtEvent(event);
  ctxMenuNodeIdx = -1; ctxMenuArcId = -1;
  let onNode = false, onArc = false;
  if (idx >= 0) {
    const t = flow.nodes[idx] && flow.nodes[idx].type;
    if (t === 'start' || t === 'end') { hideContextMenu(); return; }
    ctxMenuNodeIdx = idx; nodoSelected = idx; onNode = true;
  } else {
    const aid = arcIdAtEvent(event);
    if (aid >= 0) { ctxMenuArcId = aid; onArc = true; }
    else { hideContextMenu(); return; } // spazio vuoto: menu nativo del browser
  }
  event.preventDefault();
  // Mostra/nasconde le voci a seconda del contesto (nodo: tutte; arco: solo Incolla).
  const setShown = function (act, on) { const b = menu.querySelector('[data-act="' + act + '"]'); if (b) b.style.display = on ? '' : 'none'; };
  const hasClip = !!blockClipboard;
  setShown('edit', onNode); setShown('cut', onNode); setShown('copy', onNode);
  setShown('paste', hasClip); // incolla disponibile sia su nodo sia su arco, se c'e' qualcosa
  setShown('delete', onNode);
  const sep = menu.querySelector('.ctx-sep'); if (sep) sep.style.display = onNode ? '' : 'none';
  menu.hidden = false;
  const mw = menu.offsetWidth || 160, mh = menu.offsetHeight || 200;
  const vw = (typeof window !== 'undefined' ? window.innerWidth : 1200), vh = (typeof window !== 'undefined' ? window.innerHeight : 800);
  let x = event.clientX, y = event.clientY;
  if (x + mw > vw) x = vw - mw - 6; if (y + mh > vh) y = vh - mh - 6;
  menu.style.left = Math.max(4, x) + 'px'; menu.style.top = Math.max(4, y) + 'px';
}
function hideContextMenu() { const m = document.getElementById('ctx-menu'); if (m) m.hidden = true; ctxMenuNodeIdx = -1; ctxMenuArcId = -1; }
function ctxAction(action) {
  const nodeIdx = ctxMenuNodeIdx, arcId = ctxMenuArcId;
  hideContextMenu();
  if (action === 'paste') {
    if (arcId >= 0) { frecceSelected = arcId; pasteAtSelectedArc(); }
    else if (nodeIdx >= 0) pasteNode(nodeIdx);
    return;
  }
  if (nodeIdx < 0 || !flow.nodes[nodeIdx]) return;
  if (action === 'edit') openNodeEditor(nodeIdx);
  else if (action === 'copy') copyNode(nodeIdx);
  else if (action === 'cut') cutNode(nodeIdx);
  else if (action === 'delete') { nodoSelected = nodeIdx; if (typeof deleteNode === 'function') deleteNode(); }
}

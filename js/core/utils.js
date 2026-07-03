
// Verifica se un punto (px, py) è vicino a un segmento di linea (x1,y1)-(x2,y2) entro una distanza d.
function isPointNearAnyLineSegment(px, py, x1, y1, x2, y2, d) {
  const A = { x: x1, y: y1 }; // Punto iniziale del segmento
  const B = { x: x2, y: y2 }; // Punto finale del segmento
  const P = { x: px, y: py }; // Punto da controllare

  const ABx = B.x - A.x, ABy = B.y - A.y;  //lunghzza linea
  const APx = P.x - A.x, APy = P.y - A.y;  //spostamento verticale necessario per andare da A a P
  const magAB2 = ABx * ABx + ABy * ABy;
  let t = (APx * ABx + APy * ABy) / magAB2;
  if (t < 0) t = 0;
  if (t > 1) t = 1;

  const closest = { x: A.x + ABx * t, y: A.y + ABy * t };
  const dx = P.x - closest.x, dy = P.y - closest.y;
  return (dx * dx + dy * dy) <= (d * d);
}

// Per un nodo IF, restituisce il nodo di join calcolato dinamicamente.
// Per un nodo normale, restituisce il suo next come numero.
function effectiveNext(idx) {
  const node = flow.nodes[idx];
  if (!node) return null;
  if (node.type === "if" && typeof node.next === "object" && node.next !== null) {
    const sub = collectBranchNodes(idx);
    return sub.joinIndex;
  }
  if (typeof node.next === "string") {
    const n = parseInt(node.next, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

// Raccoglie i nodi dei due rami di un IF e calcola il join.
// Restituisce { trueList, falseList, joinIndex }.
function collectBranchNodes(ifIdx) {
  const ifNode = flow.nodes[ifIdx];
  if (!ifNode || typeof ifNode.next !== "object" || ifNode.next === null) {
    return { trueList: [], falseList: [], joinIndex: null };
  }
  const tStart = parseInt(ifNode.next.true, 10);
  const fStart = parseInt(ifNode.next.false, 10);
  if (isNaN(tStart) || isNaN(fStart)) {
    return { trueList: [], falseList: [], joinIndex: null };
  }
  if (tStart === fStart) {
    return { trueList: [], falseList: [], joinIndex: tStart };
  }

  const trueList = [];
  const seenT = new Set();
  let cur = tStart;
  while (cur !== null && !seenT.has(cur)) {
    const node = flow.nodes[cur];
    if (!node) break;
    seenT.add(cur);
    trueList.push(cur);
    if (node.type === "if" && typeof node.next === "object" && node.next !== null) {
      cur = collectBranchNodes(cur).joinIndex;
    } else if (typeof node.next === "string" && node.next !== null) {
      cur = parseInt(node.next, 10);
      if (isNaN(cur)) cur = null;
    } else {
      cur = null;
    }
  }

  const falseList = [];
  const seenF = new Set();
  let join = null;
  cur = fStart;
  while (cur !== null && !seenF.has(cur)) {
    if (seenT.has(cur)) {
      join = cur;
      break;
    }
    const node = flow.nodes[cur];
    if (!node) break;
    seenF.add(cur);
    falseList.push(cur);
    if (node.type === "if" && typeof node.next === "object" && node.next !== null) {
      cur = collectBranchNodes(cur).joinIndex;
    } else if (typeof node.next === "string" && node.next !== null) {
      cur = parseInt(node.next, 10);
      if (isNaN(cur)) cur = null;
    } else {
      cur = null;
    }
  }
  if (join === null && cur !== null && seenT.has(cur)) {
    join = cur;
  }

  // Il walk del ramo true prosegue fino a fine catena: rimuove il nodo di join
  // e tutti i successivi, che non fanno parte del ramo.
  if (join !== null) {
    const cut = trueList.indexOf(join);
    if (cut !== -1) trueList.length = cut;
  }

  return { trueList, falseList, joinIndex: join };
}

// Trova l'indice del nodo di join a cui convergono i rami di un nodo IF.
// Restituisce null se non è un IF valido, i nodi dei rami non esistono o non c'è un join comune.
function findJoinNode(ifNodeIndex) {
    const ifNode = flow.nodes[ifNodeIndex]; //Nodo IF logico
    if (!ifNode || !ifNode.next) return null; // Controllo

    let truePathEnd = parseInt(ifNode.next.true); // Indice del nodo target del ramo true
    let falsePathEnd = parseInt(ifNode.next.false); // Indice del nodo target del ramo false

    // Controllo per assicurare che i nodi dei rami esistano
    if (!flow.nodes[truePathEnd] || !flow.nodes[falsePathEnd]) return null;

    // Trova l'ultimo nodo del ramo true che punta al join node (ifNode.join)
    while (flow.nodes[truePathEnd] && flow.nodes[truePathEnd].next !== ifNode.join) {
        truePathEnd = parseInt(flow.nodes[truePathEnd].next);
        if (isNaN(truePathEnd)) break; // Previene loop infiniti se la struttura è malformata
    }

    // Trova l'ultimo nodo del ramo false che punta al join node (ifNode.join)
    while (flow.nodes[falsePathEnd] && flow.nodes[falsePathEnd].next !== ifNode.join) {
        falsePathEnd = parseInt(flow.nodes[falsePathEnd].next);
        if (isNaN(falsePathEnd)) break;
    }

    // Controlla se i nodi finali dei percorsi sono validi
    if (!flow.nodes[truePathEnd] || !flow.nodes[falsePathEnd]) return null;

    // Il nodo di join è il successivo comune; se puntano allo stesso nodo, quello è il join.
    return flow.nodes[truePathEnd].next === flow.nodes[falsePathEnd].next ?
        parseInt(flow.nodes[truePathEnd].next) : null;
}

// Trova l'indice del nodo IF genitore più vicino, risalendo la catena dei nodi.
function findParentIf(nodeIndex) {
  let currentIndex = nodeIndex; // Inizia dal nodo corrente
  while (currentIndex >= 0) { // Scorre all'indietro finché l'indice è valido
    if (flow.nodes[currentIndex]?.type === "if") { // Se il nodo corrente è di tipo "if"
      return currentIndex; // Restituisce l'indice dell'IF trovato
    }
    currentIndex--; // Passa al nodo precedente
  }
  return -1; // Nessun IF genitore trovato
}

  // Verifica se un punto (clickX, clickY) è "vicino" a un segmento di linea (x1,y1)-(x2,y2).
  function isPointNearLine(clickX, clickY, x1, y1, x2, y2, distanza) {
    let f = false; // Flag: true se il punto è vicino alla linea
    if (clickX <= x1 + distanza && clickX >= x1 - distanza) { // Controllo sulla coordinata X
      if ((clickY >= y1 && clickY <= y2) || (clickY >= y2 && clickY <= y1)) { // Controllo sulla coordinata Y (tra gli estremi del segmento)
        f = true;
      }
    }
    return f;
  }

  // Controlla se una stringa è un nome di variabile valido (inizia con lettera, seguita da lettere o numeri).
  function lettereENumeri(str) {
    return /^[a-zA-Z][a-zA-Z0-9]*$/.test(str);
  }

// Verifica se il flowchart è "vuoto" (contiene solo i nodi Start e End di default).
function isEmpty(){
    if(flow.nodes.length==2){ // Se ci sono solo 2 nodi (tipicamente Start e End)
      return true;
    }else{
      return false;
    }
  }
  function isLastNodeOfIf(index){
    let lastIndex=[]; // Array usato per tracciare (presumibilmente) i nodi di fine ramo o IF
    for(let i=0; i<flow.nodes.length; i++){ // Scansiona tutti i nodi
        // La condizione seguente è difficile da interpretare senza contesto preciso
        // su come `lastIndex` dovrebbe funzionare.
        if(lastIndex.length > 0 && (lastIndex[lastIndex.length-1] == i || flow.nodes[lastIndex[lastIndex.length-1]] - 1 == i)){
          // Se il nodo corrente `i` corrisponde all'ultimo `lastIndex` registrato
          // O (condizione ancora più oscura) flow.nodes[indice] - 1 == i
          if(i==index){ // Se il nodo corrente è quello che stiamo cercando
            return true; // Allora è considerato "last node of if"
          }else{
            lastIndex.pop(); // Altrimenti rimuove l'ultimo elemento da lastIndex
          }
        }
        if(flow.nodes[i] && flow.nodes[i].type == "if"){ // Se il nodo corrente è un IF
          if(flow.nodes[i].next.true != flow.nodes[i].next.false){ // Se i rami dell'IF divergono
            // Aggiunge l'indice del nodo precedente al target del ramo 'false' a lastIndex.
            // Questo è un approccio specifico e potrebbe non coprire tutti i casi di "ultimo nodo di un ramo IF".
            lastIndex.push(parseInt(flow.nodes[i].next.false)-1)
          }else{ // Se i rami dell'IF convergono immediatamente (IF lineare)
            lastIndex.push(i); // Aggiunge l'indice dell'IF stesso
          }
        }
    }
    return false; // Se non trovato secondo la logica sopra
  }

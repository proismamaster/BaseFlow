
// Verifica se un punto (px, py) è vicino a un segmento di linea (x1,y1)-(x2,y2) entro una distanza d.
function isPointNearAnyLineSegment(px, py, x1, y1, x2, y2, d) {
  const A = { x: x1, y: y1 }; // Punto iniziale del segmento
  const B = { x: x2, y: y2 }; // Punto finale del segmento
  const P = { x: px, y: py }; // Punto da controllare

  const ABx = B.x - A.x, ABy = B.y - A.y;  //lunghzza linea
  const APx = P.x - A.x, APy = P.y - A.y;  //spostamento verticale necessario per andare da A a P
  const magAB2 = ABx * ABx + ABy * ABy;
  // FIX round-2 P1 (piano 2026-07-06-nested-loops-round2, trovato dal Test 25 di
  // test-if.js): un segmento DEGENERE (lunghezza zero, es. l'arco 'loop_body' di un
  // Do-While col corpo gia' non vuoto, vedi rendering.js drawDoWhileBranches) ha
  // magAB2=0 -- la proiezione "t = .../magAB2" diventa 0/0 = NaN, che si propaga fino
  // al confronto finale (NaN <= d*d e' sempre false), quindi questa funzione NON
  // rilevava MAI un click/hover esattamente su un arco degenere, a differenza di
  // isPointNearLine (usata da clickFreccia) che non soffre dello stesso problema.
  // Per un segmento degenere la distanza e' semplicemente quella dal punto A (=B).
  if (magAB2 === 0) {
    const dx0 = P.x - A.x, dy0 = P.y - A.y;
    return (dx0 * dx0 + dy0 * dy0) <= (d * d);
  }
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

  // BUG B4 (review Fable, 2026-07-04 notte-2): quando un ciclo (While/For/Do) e'
  // membro di un ramo, il walk deve "vederci attraverso" fino alla sua uscita reale
  // (next.false) per trovare il vero join -- esattamente come gia' fa per un IF
  // annidato tramite il suo joinIndex. Senza questo, un ciclo veniva trattato come
  // un vicolo cieco (il ramo "else { cur = null }" scattava perche' next e' un
  // oggetto ma il tipo non e' "if"), la ricerca del join falliva silenziosamente:
  // join sbagliato/fuori colonna, arco mancante dopo il ciclo, diagonali spurie.
  function nextAfterBranchMember(node, curIdx) {
    if (node.type === "if" && typeof node.next === "object" && node.next !== null) {
      return collectBranchNodes(curIdx).joinIndex;
    }
    if (isBranchingNodeType(node.type) && typeof node.next === "object" && node.next !== null) {
      const exit = parseInt(node.next.false, 10);
      return isNaN(exit) ? null : exit;
    }
    if (typeof node.next === "string" && node.next !== null) {
      const n = parseInt(node.next, 10);
      return isNaN(n) ? null : n;
    }
    return null;
  }

  const trueList = [];
  const seenT = new Set();
  let cur = tStart;
  while (cur !== null && !seenT.has(cur)) {
    const node = flow.nodes[cur];
    if (!node) break;
    seenT.add(cur);
    trueList.push(cur);
    cur = nextAfterBranchMember(node, cur);
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
    cur = nextAfterBranchMember(node, cur);
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

// Restituisce i confini VERI del sottoalbero di un IF (per drag&drop di un intero
// blocco, moveIfBlock). NON si puo' assumere che il sottoalbero occupi esattamente
// l'intervallo [ifIdx, joinIndex): questo e' falso quando un IF annidato converge
// direttamente sullo STESSO nodo lontano a cui converge anche un suo antenato
// (nessun nodo di join separato in mezzo) — in quel caso un fratello dell'antenato,
// posizionato fisicamente fra il sottoalbero e il join condiviso, verrebbe
// erroneamente incluso in un taglio "a intervallo". Bug reale (screenshot di Ismail,
// vedi PROBLEMS.md): un IF annidato senza contenuto dopo di se' nel proprio ramo,
// il cui `joinIndex` coincide con quello di un antenato, "catturava" per errore un
// fratello dell'antenato fisicamente adiacente. Fix: si espande RICORSIVAMENTE
// l'appartenenza reale (trueList+falseList, con gli IF annidati espansi a loro
// volta), si calcola min/max dell'insieme risultante, e si verifica che sia
// effettivamente contiguo (nessun buco) prima di fidarsene.
function collectFullIfSubtreeMembers(ifIdx) {
  const node = flow.nodes[ifIdx];
  if (!node || node.type !== "if") return null;
  const members = new Set([ifIdx]);
  function expand(list) {
    for (const idx of list) {
      members.add(idx);
      const n = flow.nodes[idx];
      if (n && n.type === "if") {
        const inner = collectFullIfSubtreeMembers(idx);
        if (inner) for (const m of inner.sorted) members.add(m);
      } else if (n && isBranchingNodeType(n.type) && n.type !== "if") {
        // FIX M1 (review Fable, 2026-07-04 notte-6): un ciclo in un ramo contribuiva
        // solo con se stesso, mai col suo corpo -- a differenza del gemello
        // collectFullLoopSubtreeMembers che espande ENTRAMBI (IF e cicli). Senza
        // questo, il corpo del ciclo restava fuori dai membri del blocco IF: con
        // rami pieni i membri risultavano non-contigui (move rifiutato in silenzio),
        // con ramo vuoto risultavano "contigui" ma sbagliati (move corrompeva il
        // grafo, screenshot Ismail: while.next.true puntava all'IF stesso, End
        // arruolato nel corpo del loop, corpo orfano a y=0).
        const innerLoop = collectFullLoopSubtreeMembers(idx);
        if (innerLoop) for (const m of innerLoop.sorted) members.add(m);
      }
    }
  }
  const sub = collectBranchNodes(ifIdx);
  expand(sub.trueList);
  expand(sub.falseList);
  const sorted = [...members].sort((a, b) => a - b);
  const contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  return { sorted, blockStart: sorted[0], blockEnd: sorted[sorted.length - 1] + 1, contiguous, joinIndex: sub.joinIndex };
}

// Raccoglie i nodi del CORPO di un ciclo (While/For/Do): a differenza di collectBranchNodes
// (join in AVANTI di un IF), un ciclo ha un BACK-EDGE che torna alla condizione stessa
// (loopIdx), non un nodo di join successivo. Cammina lungo next.true dal nodo di corpo
// finche' non incontra di nuovo loopIdx (fine del corpo) o un vicolo cieco. Un ciclo
// annidato dentro il corpo viene trattato come unita' opaca (si esce dal suo next.false),
// analogamente a come un IF annidato viene trattato tramite il suo joinIndex.
// Restituisce { bodyList, exitIndex }: bodyList = indici del corpo in ordine di esecuzione
// (vuoto per un corpo ancora self-loop), exitIndex = indice del nodo dopo il ciclo (next.false).
// FIX A2 (review Fable, 2026-07-05): il piano cicli originale prevedeva un flag
// `hasBackEdge`/`backEdgeFound` per distinguere un corpo che chiude regolarmente sul
// ciclo da un corpo che finisce in un vicolo cieco (struttura corrotta) -- perso per
// strada nell'implementazione. Senza di esso, un flow corrotto (es. il corpo del while
// che finisce dritto su End invece di tornare al while) veniva accettato in silenzio:
// il walk si fermava al vicolo cieco e restituiva comunque `bodyList`/`exitIndex` come
// se fosse tutto normale, "reclamando" nodi come End dentro il corpo del ciclo (arco
// cliccabile disegnato da End, diagonale spuria attraverso il canvas). Ripristinato:
// `hasBackEdge` e' true SOLO se il walk e' terminato incontrando di nuovo `loopIdx`
// (o se il corpo e' vuoto, self-loop diretto -- il back-edge degenere e' immediato).
function collectLoopBody(loopIdx) {
  const loopNode = flow.nodes[loopIdx];
  if (!loopNode || !isBranchingNodeType(loopNode.type) || typeof loopNode.next !== "object" || loopNode.next === null) {
    return { bodyList: [], exitIndex: null, hasBackEdge: false };
  }
  const bodyStart = parseInt(loopNode.next.true, 10);
  const exitStartRaw = parseInt(loopNode.next.false, 10);
  const exitIndex = isNaN(exitStartRaw) ? null : exitStartRaw;

  if (isNaN(bodyStart) || bodyStart === loopIdx) {
    // Corpo vuoto: self-loop diretto sul nodo ciclo stesso -- back-edge banale, presente.
    return { bodyList: [], exitIndex, hasBackEdge: true };
  }

  const bodyList = [];
  const seen = new Set();
  let cur = bodyStart;
  while (cur !== null && cur !== loopIdx && !seen.has(cur)) {
    const node = flow.nodes[cur];
    if (!node) break;
    seen.add(cur);
    bodyList.push(cur);
    if (node.type === "if" && typeof node.next === "object" && node.next !== null) {
      // IF annidato nel corpo: entra ed esce dal suo joinIndex (unita' opaca, come nel resto del codice).
      cur = collectBranchNodes(cur).joinIndex;
    } else if (isBranchingNodeType(node.type) && typeof node.next === "object" && node.next !== null) {
      // Ciclo annidato nel corpo: unita' opaca, si prosegue dalla sua uscita (next.false).
      const inner = parseInt(node.next.false, 10);
      cur = isNaN(inner) ? null : inner;
    } else if (typeof node.next === "string" && node.next !== null) {
      const nxt = parseInt(node.next, 10);
      cur = isNaN(nxt) ? null : nxt;
    } else {
      cur = null;
    }
  }

  // Il back-edge e' presente SOLO se il walk si e' fermato ritrovando esattamente
  // `loopIdx` -- un vicolo cieco (`cur === null`, es. corpo che finisce su End) o un
  // ciclo che rientra su se stesso senza mai toccare `loopIdx` (`seen.has(cur)`, un
  // altro tipo di struttura corrotta) NON sono un back-edge valido.
  const hasBackEdge = (cur === loopIdx);

  return { bodyList, exitIndex, hasBackEdge };
}

// Restituisce i confini VERI del sottoalbero di un ciclo (While/For/Do), per il futuro
// drag&drop di un intero blocco While (N6, review Fable 2026-07-04 notte-4, sul modello
// di collectFullIfSubtreeMembers per l'IF). NON si puo' assumere che [loopIdx, ultimo
// indice del bodyList] sia un intervallo contiguo: collectLoopBody tratta un IF o un
// ciclo annidato nel corpo come unita' OPACA (salta dal suo indice al suo joinIndex/
// uscita), quindi se quell'unita' NON e' l'ultimo membro del corpo, i nodi FISICAMENTE
// posizionati fra il suo indice e la sua uscita (es. i due rami di un IF interno)
// restano fuori da bodyList pur facendo parte a tutti gli effetti del blocco -- stesso
// identico bug-pattern gia' fixato per moveIfBlock (fratelli "catturati" o esclusi per
// errore da un taglio a intervallo). Fix: si espande RICORSIVAMENTE l'appartenenza reale
// (bodyList, con IF annidati espansi via collectFullIfSubtreeMembers e cicli annidati
// espansi ricorsivamente via questa stessa funzione), si calcola min/max dell'insieme
// risultante, e si verifica che sia effettivamente contiguo prima di fidarsene.
function collectFullLoopSubtreeMembers(loopIdx) {
  const node = flow.nodes[loopIdx];
  if (!node || !isBranchingNodeType(node.type) || node.type === "if") return null;
  const members = new Set([loopIdx]);
  function expand(list) {
    for (const idx of list) {
      members.add(idx);
      const n = flow.nodes[idx];
      if (n && n.type === "if") {
        const inner = collectFullIfSubtreeMembers(idx);
        if (inner) for (const m of inner.sorted) members.add(m);
      } else if (n && isBranchingNodeType(n.type) && n.type !== "if") {
        const innerLoop = collectFullLoopSubtreeMembers(idx);
        if (innerLoop) for (const m of innerLoop.sorted) members.add(m);
      }
    }
  }
  const body = collectLoopBody(loopIdx);
  expand(body.bodyList);
  const sorted = [...members].sort((a, b) => a - b);
  const contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  return { sorted, blockStart: sorted[0], blockEnd: sorted[sorted.length - 1] + 1, contiguous, exitIndex: body.exitIndex };
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

// FIX A1 (review Fable, 2026-07-05): il caricamento file non validava NULLA -- un file
// salvato durante le settimane dei vecchi bug di corruzione (o comunque semanticamente
// rotto) veniva assegnato direttamente a `flow` e renderizzato senza battere ciglio
// (garbage silenzioso: nodi "reclamati" per errore da un ciclo il cui corpo non torna
// mai indietro, join non calcolabili, nodi irraggiungibili...). Riprodotto col file
// esatto di Ismail: un while il cui corpo (a causa di un vecchio bug ormai fixato)
// finisce dritto su End invece di tornare al while -- vedi test-fixtures/
// corrupted-while-no-backedge.json. `validateFlow(parsed)` va chiamata PRIMA di
// assegnare `parsed` a `flow`: se il risultato non e' valido, il caricamento va
// rifiutato (alert con l'elenco leggibile dei problemi) e lo stato corrente lasciato
// intatto -- nessuna riparazione automatica in questa fase (l'intento originale di un
// file corrotto e' ambiguo: nel file di Ismail, il corpo doveva tornare al while? o
// l'uscita era quella? meglio un rifiuto spiegato che un "repair" indovinato male).
//
// Restituisce { valid: bool, errors: string[] }. Le funzioni esistenti
// (collectLoopBody/collectBranchNodes) operano sulla variabile globale `flow`: per
// riusarle su un `parsed` non ancora commesso, si scambia temporaneamente lo stato
// globale, poi lo si ripristina SEMPRE (try/finally) prima di restituire il risultato
// -- il chiamante decide se committare `parsed` solo dopo aver visto un esito valido,
// questa funzione non lascia mai lo stato globale alterato quando ritorna.
const VALID_NODE_TYPES = ["start", "end", "input", "output", "print", "write", "read", "assign", "assignment", "if", "while", "for", "do", "comment", "pause", "forward", "turn", "home", "pen", "gclear"];

function validateFlow(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.nodes)) {
    return { valid: false, errors: ["struttura non valida: \"nodes\" deve essere un array"] };
  }
  const nodes = parsed.nodes;
  const n = nodes.length;
  if (n === 0) {
    return { valid: false, errors: ["il flowchart non contiene nessun nodo"] };
  }

  // 1) Struttura per-nodo: tipo noto, next della forma giusta, indici in range.
  nodes.forEach((node, i) => {
    if (!node || typeof node !== "object") { errors.push(`nodo ${i}: non e' un oggetto valido`); return; }
    if (!VALID_NODE_TYPES.includes(node.type)) { errors.push(`nodo ${i}: tipo sconosciuto "${node.type}"`); return; }
    if (isBranchingNodeType(node.type)) {
      if (typeof node.next !== "object" || node.next === null || !("true" in node.next) || !("false" in node.next)) {
        errors.push(`nodo ${i} (${node.type}): "next" deve essere un oggetto {true,false}`);
        return;
      }
      const t = parseInt(node.next.true, 10), f = parseInt(node.next.false, 10);
      if (isNaN(t) || t < 0 || t >= n) errors.push(`nodo ${i} (${node.type}): next.true fuori range o non numerico`);
      if (isNaN(f) || f < 0 || f >= n) errors.push(`nodo ${i} (${node.type}): next.false fuori range o non numerico`);
    } else if (node.type === "end") {
      // next puo' legittimamente essere null: nodo terminale.
    } else {
      if (typeof node.next !== "string") { errors.push(`nodo ${i} (${node.type}): "next" deve essere una stringa`); return; }
      const nx = parseInt(node.next, 10);
      if (isNaN(nx) || nx < 0 || nx >= n) errors.push(`nodo ${i} (${node.type}): next fuori range o non numerico`);
    }
  });
  if (errors.length) return { valid: false, errors };

  // 2) Esattamente un "start", almeno un "end".
  const startIdxs = [], endIdxs = [];
  nodes.forEach((node, i) => {
    if (node.type === "start") startIdxs.push(i);
    if (node.type === "end") endIdxs.push(i);
  });
  if (startIdxs.length !== 1) errors.push(`atteso esattamente un nodo "start", trovati ${startIdxs.length}`);
  if (endIdxs.length < 1) errors.push("nessun nodo \"end\" trovato");
  if (errors.length) return { valid: false, errors };

  const savedFlow = (typeof flow !== "undefined") ? flow : undefined;
  try {
    flow = { nodes, variables: Array.isArray(parsed.variables) ? parsed.variables : [] };

    const endSet = new Set(endIdxs);
    const startSet = new Set(startIdxs);

    // 3) Ogni ciclo: il corpo deve chiudersi col back-edge (A2) e non contenere start/end.
    // 5) Ogni IF: il join deve essere calcolabile (i rami riconvergono).
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      if (isBranchingNodeType(node.type) && node.type !== "if") {
        const body = collectLoopBody(i);
        if (!body.hasBackEdge) {
          errors.push(`ciclo ${node.type}(${i}): corpo senza back-edge (non torna al ciclo)`);
        } else {
          for (const bi of body.bodyList) {
            if (endSet.has(bi)) errors.push(`ciclo ${node.type}(${i}): il corpo contiene il nodo "end" (indice ${bi})`);
            if (startSet.has(bi)) errors.push(`ciclo ${node.type}(${i}): il corpo contiene il nodo "start" (indice ${bi})`);
          }
        }
      } else if (node.type === "if") {
        const sub = collectBranchNodes(i);
        if (sub.joinIndex === null || sub.joinIndex === undefined) {
          errors.push(`if(${i}): join non calcolabile (i rami non riconvergono)`);
        }
      }
    }

    // 4) Reachability: ogni nodo deve essere raggiungibile dallo start.
    const reached = new Set();
    const stack = [startIdxs[0]];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === null || cur === undefined || cur < 0 || cur >= n || reached.has(cur)) continue;
      reached.add(cur);
      const node = nodes[cur];
      if (!node) continue;
      if (isBranchingNodeType(node.type)) {
        const t = parseInt(node.next.true, 10), f = parseInt(node.next.false, 10);
        if (!isNaN(t)) stack.push(t);
        if (!isNaN(f)) stack.push(f);
      } else if (typeof node.next === "string") {
        const nx = parseInt(node.next, 10);
        if (!isNaN(nx)) stack.push(nx);
      }
    }
    for (let i = 0; i < n; i++) {
      if (!reached.has(i)) errors.push(`nodo ${i} (${nodes[i].type}): irraggiungibile dallo start`);
    }

    // 6) Invarianti di layout (R12-C, Ismail 2026-07-11): i controlli 1-4 sopra non
    // bastano -- un file puo' passarli e comunque rompere il layout (drag&drop,
    // cascade-delete, calcoloY, vedi collectFullIfSubtreeMembers/
    // collectFullLoopSubtreeMembers in questo stesso file), perche' NON verificano
    // CONTIGUITA'/DISGIUNZIONE dei sottoalberi. Caso reale: test-fixtures/
    // 2026-07-11-if-rami-condivisi.json (fornita da Ismail) -- due if il cui ramo
    // false punta allo STESSO nodo condiviso, che l'UI (inserisciNodo) non puo' MAI
    // produrre (ogni inserimento shifta contiguamente gli indici e aggiorna un SOLO
    // puntatore per volta). Riusa le STESSE funzioni di cui si fidano drag&drop e
    // cascade-delete (nessun nuovo walker): un file che le viola farebbe danni ovunque
    // in-app, non solo qui. Ogni chiamata e' avvolta in try/catch: un'eccezione (file
    // davvero malformato, profondita' inattesa) e' un errore di validazione, MAI un
    // crash. NESSUNA riparazione automatica (decisione storica, vedi commento FIX A1
    // sopra): il caricamento si rifiuta e basta, l'intento originale di un file rotto
    // e' ambiguo.
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      if (node.type === "if") {
        let info = null;
        try { info = collectFullIfSubtreeMembers(i); } catch (e) { info = null; }
        if (!info || !info.contiguous) {
          errors.push(`if(${i}): sottoalbero non contiguo — file non prodotto da BaseFlow o corrotto`);
        } else {
          for (const ei of endIdxs) {
            if (ei >= info.blockStart && ei < info.blockEnd) {
              errors.push(`if(${i}): il nodo "end" (indice ${ei}) cade dentro l'intervallo del blocco if [${info.blockStart},${info.blockEnd})`);
            }
          }
        }
        let branch = null;
        try { branch = collectBranchNodes(i); } catch (e) { branch = null; }
        if (branch) {
          const trueSet = new Set(branch.trueList);
          const shared = branch.falseList.filter((idx) => trueSet.has(idx));
          if (shared.length) {
            errors.push(`if(${i}): i rami condividono nodi (indici ${shared.join(", ")})`);
          }
        } else {
          errors.push(`if(${i}): impossibile calcolare i rami (errore interno)`);
        }
      } else if (isBranchingNodeType(node.type)) {
        let info = null;
        try { info = collectFullLoopSubtreeMembers(i); } catch (e) { info = null; }
        if (!info || !info.contiguous) {
          errors.push(`ciclo ${node.type}(${i}): sottoalbero non contiguo — file non prodotto da BaseFlow o corrotto`);
        }
      }
    }
  } finally {
    flow = savedFlow;
  }

  return { valid: errors.length === 0, errors };
}


// Colore di linee/testo del canvas, adattivo al tema (Dark mode): nero su sfondo
// chiaro, grigio chiaro su sfondo scuro. Le evidenziazioni (hover/exec/drag) usano
// gia' colori propri (rosso/arancio/blu) che restano leggibili su entrambi i temi.
function themeCanvasLineColor() {
  return cssVar('--canvas-line-color', (typeof darkMode !== 'undefined' && darkMode) ? '#e6e6e6' : 'black');
}

// Legge una CSS custom property dal <body> (tema attivo) con fallback. Usata per far
// seguire ai colori disegnati sul canvas (etichette True/False, evidenziazione) il tema
// scelto. In ambienti senza CSS reale (test) getComputedStyle non risolve -> fallback.
function cssVar(name, fallback) {
  try {
    if (typeof getComputedStyle !== 'function' || typeof document === 'undefined' || !document.body) return fallback;
    const v = getComputedStyle(document.body).getPropertyValue(name);
    return (v && v.trim()) ? v.trim() : fallback;
  } catch (e) { return fallback; }
}
function arcHoverColor() { return cssVar('--arc-hover-color', '#e53935'); }
function arcDragColor()  { return cssVar('--arc-drag-color', '#1e88e5'); }

// Adapta le dimensioni del canvas quando la finestra del browser viene ridimensionata e ridisegna l'intero flowchart.
function resizeCanvas() {
  // Il dimensionamento effettivo lo fa resizeCanvasToFitNodes() (dentro draw),
  // usando il contenitore come minimo. Le posizioni px dei nodi non cambiano:
  // la forma del grafo resta identica, cambia solo la viewport.
  ctx = canvas.getContext("2d");
  draw(nodi);
}

// Disegna una linea e, se salva=true, la registra nell'array frecce[].
// Disegna una linea tra due punti.
// Se 'salva' è true, la linea viene aggiunta all'array 'frecce' per la rilevazione dei click,
// includendo informazioni sul nodo di partenza, di destinazione e il tipo di freccia.
// FIX round-4j (Ismail 2026-07-06, "nei while quando vai sopra un arco vuoto interno
// questo colora di rosso solo la parte alta dell'arco e non tutto l'arco"): il
// placeholder cliccabile di un corpo VUOTO di While/For e' un singolo segmento
// verticale (vedi sotto, 'loop_body' da cy a bodyBottomY) MA il "ritorno" visivo che
// da' l'impressione di un anello chiuso (giu' - a sinistra - su fino all'esagono,
// vedi righe 832-836 sotto) e' disegnato con drawLine(salva=false): non finisce mai
// in frecce[], quindi l'evidenziazione hover (che confronta le coordinate esatte di
// un singolo elemento di frecce[], vedi punto 5 di draw()) non lo tocca -- resta
// nero anche quando il mouse e' sopra la parte cliccabile, dando l'impressione che
// "solo la parte alta" si colori. extraSegments e' un array opzionale di segmenti
// [x1,y1,x2,y2] puramente VISIVI (mai cliccabili, non influenzano l'hit-test) che
// viaggiano insieme all'arco cliccabile in frecce[].visualExtra: l'evidenziazione
// hover (punto 5 di draw(), sotto) li ridisegna in rosso insieme al segmento
// principale quando quell'arco e' quello sotto il cursore, cosi' l'intero anello
// visivo del placeholder si illumina come un'unita' sola, coerente con quello che
// l'utente vede (un solo arco, cliccabile ovunque appaia).
// FIX round-4l (Ismail 2026-07-06, "la punta delle frecce deve esserci ogni volta
// che si mette un blocco... arco-punta-blocco-arco-punta"): fino a questo fix
// nessuna freccia disegnata da BaseFlow aveva una vera punta (triangolo) -- ogni
// "arco" (frecce[]) era una linea semplice, la punta era solo un modo di dire
// (il nome della struttura dati). drawArrowhead disegna un piccolo triangolo pieno
// con la punta ESATTAMENTE in (x2,y2) (il bordo del nodo di destinazione), orientato
// SEMPRE nella direzione (x1,y1)->(x2,y2) -- calcolata dal vettore del segmento
// stesso, mai passata a mano: cosi' non si puo' sbagliare il "senso" dell'arco (se
// un segmento e' disegnato al contrario rispetto al vero flusso logico, la punta
// erediterebbe lo stesso errore, rendendolo IMMEDIATAMENTE visibile invece che latente
// come lo era finora). Va richiamata SOLO su segmenti che toccano davvero un bordo di
// un nodo/forma reale (vedi i singoli commenti "FIX round-4l" sparsi sui call-site
// scelti sotto) -- MAI su tratti "di servizio" (steli, gomiti, ponti orizzontali fra
// colonne) che sono solo instradamento e non entrano mai in un blocco.
// FIX round-4o (Ismail, "vorrei che anche la punta si illuminasse al click dell'arco"):
// parametro `color` opzionale aggiunto per permettere all'evidenziazione hover/drag
// (punto 5/6 di draw(), sotto) di ridisegnare la STESSA identica punta in rosso/blu
// sopra quella nera di base, invece di lasciarla nera anche quando l'arco e' evidenziato
// -- default a themeCanvasLineColor() per non cambiare nessuna chiamata esistente.
function drawArrowhead(x1, y1, x2, y2, color, scale) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return; // segmento degenere (lunghezza ~0), nessuna direzione da disegnare
  const ux = dx / len, uy = dy / len; // versore nella direzione di percorrenza
  const sc = (typeof scale === 'number' && scale > 0) ? scale : 1;
  const ARROW_LEN = 9 * sc, ARROW_WIDTH = 7 * sc;
  const baseX = x2 - ux * ARROW_LEN, baseY = y2 - uy * ARROW_LEN;
  const px = -uy, py = ux; // versore perpendicolare, per i due angoli della base
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(baseX + px * ARROW_WIDTH / 2, baseY + py * ARROW_WIDTH / 2);
  ctx.lineTo(baseX - px * ARROW_WIDTH / 2, baseY - py * ARROW_WIDTH / 2);
  ctx.closePath();
  ctx.fillStyle = color || themeCanvasLineColor();
  ctx.fill();
  ctx.restore();
}

function drawLine(x1, y1, x2, y2, salva, fromNodeIndex, toNodeIndex, arrowType, extraSegments, arrow) {
  // FIX A3 (review Fable, 2026-07-05): difesa in profondita' contro flow corrotti che
  // riescono comunque a entrare (undo-stack vecchi, un bug futuro non ancora noto...):
  // un arco CLICCABILE non ha mai senso logico se parte da un nodo "end" (non ha un
  // vero "dopo": inserire/spostare qualcosa li' e' sempre un errore di bookkeeping) o
  // se arriva a un nodo "start" (nessun predecessore legittimo). Costa un if, intercetta
  // qualunque variante futura di questa classe di bug (es. il caso del file corrotto di
  // Ismail, dove End veniva "reclamato" come corpo di un ciclo e riceveva un arco
  // cliccabile in uscita verso il ciclo stesso).
  if (salva) {
    const fromNode = (typeof flow !== "undefined" && flow.nodes) ? flow.nodes[fromNodeIndex] : null;
    const toNode = (typeof flow !== "undefined" && flow.nodes) ? flow.nodes[toNodeIndex] : null;
    if ((fromNode && fromNode.type === "end") || (toNode && toNode.type === "start")) {
      console.warn("[render guard] arco cliccabile scartato: from=end o to=start", { fromNodeIndex, toNodeIndex, arrowType });
      salva = false;
    }
  }
  if (salva) {
    frecce.push({
      inzioX: x1, inzioY: y1, fineX: x2, fineY: y2, // Coordinate della freccia
      id: frecce.length,
      fromNodeIndex: fromNodeIndex, // Indice del nodo di partenza nella logica flow.nodes
      toNodeIndex: toNodeIndex,
      type: arrowType,        // Tipo di freccia: 'normal', 'if_true', 'if_false'
      // visualExtra (round-4j): segmenti SOLO visivi associati (mai cliccabili, vedi
      // nota sopra la funzione) -- undefined per la stragrande maggioranza degli archi.
      visualExtra: extraSegments || null,
      // hasArrow (round-4o): memorizza se QUESTO arco disegna una punta, cosi'
      // l'evidenziazione hover/drag (punto 5/6 di draw()) sa se deve ridisegnarla nel
      // colore di evidenziazione sopra quella nera di base.
      hasArrow: !!arrow
    });
  }
  // FIX #12 (Ismail 2026-07-08): se questo arco e' quello appena PERCORSO durante
  // l'esecuzione (nodo precedente -> nodo corrente) lo evidenzia con --exec-edge-color.
  // R12-F (Ismail 2026-07-12): execEdgeFrom+executingNodeIndex sostituiti da executingEdge
  // (state.js, {from,to}|null) -- stesso identico ruolo, ora nel modello a due fasi separate
  // (fase-nodo vs fase-arco, mai attive insieme). Questo e' l'UNICO aggancio che evidenzia i
  // back-edge dei cicli (non in frecce[]: drawLoopBranches/drawDoWhileBranches passano
  // lastBodyIdx/loopIdx come fromNodeIndex/toNodeIndex proprio per intercettare questo check).
  var _execHl = (typeof executingEdge !== "undefined" && executingEdge && !executingEdge.litGroup
    && fromNodeIndex === executingEdge.from && toNodeIndex === executingEdge.to);
  // P5.5 (round 15, Ismail 2026-07-14 "voglio un arco alla volta, anche coi rami vuoti"):
  // questo check _execHl per-segmento (FIX #12) ignorava il RAMO preso. Con i due rami di un
  // IF ENTRAMBI VUOTI che rientrano nello stesso header di ciclo, if_true / if_false / back-edge
  // condividono TUTTI (from=IF, to=WHILE): prendere il ramo 'true' accendeva anche la verticale
  // del ramo 'false' (bug confermato a pixel). Si spegne quindi SOLO l'arco del ramo NON preso
  // (l'altro ramo dell'if/ciclo). ATTENZIONE (Ismail 2026-07-14, secondo giro: "ora non si colora
  // piu' nemmeno l'arco del while dopo l'if"): il ramo PRESO e soprattutto il BACK-EDGE del ciclo
  // (arrowType null o 'loop_body_end' -- il "ritorno al while") DEVONO restare accesi: la
  // transizione if.ramo->while illumina il ramo giusto + il ritorno al while, mai l'altro ramo.
  // Percio' qui si NEGA solo l'arco del ramo opposto, senza toccare back-edge/ramo-preso.
  if (_execHl && executingEdge.branch) {
    if (executingEdge.branch === 'true'  && (arrowType === 'if_false' || arrowType === 'loop_exit')) _execHl = false;
    if (executingEdge.branch === 'false' && (arrowType === 'if_true'  || arrowType === 'loop_body')) _execHl = false;
  }
  // P5.6 (round 15, Ismail 2026-07-14 "PRIMA l'arco dell'if POI il while, mai insieme; per TUTTI
  // gli annidamenti"): una transizione che RIENTRA in un header di ciclo (back-edge) e' animata
  // in DUE fasi da animateExecEdge (execute.js): executingEdge.phase='out' (l'arco che ESCE dal
  // nodo, in giu') e poi 'back' (il RITORNO all'header: orizzontale in basso + risalita). Il
  // ritorno e' fatto dai segmenti disegnati con arrowType null e from>to (i due drawLine di
  // continuazione del back-edge, piu' in basso). Fase 'out' => tutto TRANNE quei segmenti; fase
  // 'back' => SOLO quei segmenti. Classificazione per-segmento (indipendente dagli indici) =>
  // vale a qualunque profondita' di annidamento di if/cicli.
  if (_execHl && executingEdge.phase) {
    var _fromIsBranch = !!(typeof flow !== "undefined" && flow.nodes && flow.nodes[executingEdge.from]
      && typeof isBranchingNodeType === "function" && isBranchingNodeType(flow.nodes[executingEdge.from].type));
    var _isReturnSeg;
    if (arrowType === 'loop_body_end') {
      // FIX (Ismail 2026-07-14, "viene colorato insieme all'if la parte verticale del while"):
      // il MAIN del back-edge (loop_body_end, lo stelo verticale) e' "uscita in giu'" (fase out)
      // SOLO quando e' l'uscita DIRETTA di un blocco semplice ultimo del corpo (il nodo eseguito e'
      // quel blocco, non un nodo di diramazione). Se il nodo eseguito e' un IF/ciclo, quello stelo
      // sta SOTTO la ricongiunzione dei rami => e' gia' "ritorno al while" e va in fase 'back',
      // cosi' non si accende insieme all'arco del ramo.
      _isReturnSeg = _fromIsBranch;
    } else {
      _isReturnSeg = (arrowType == null) && (fromNodeIndex > toNodeIndex);
    }
    _execHl = (executingEdge.phase === 'back') ? _isReturnSeg : !_isReturnSeg;
  }
  var _execEdgeCol = (typeof cssVar === "function") ? cssVar('--exec-edge-color', '#ff9800') : '#ff9800';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = _execHl ? _execEdgeCol : themeCanvasLineColor();
  // C1 (round 11): spessore uniformato a 3 con la nuova evidenziazione "arco intero"
  // (punto 7 di draw(), sotto) -- prima era 4 solo qui (FIX #12), disallineato.
  ctx.lineWidth = _execHl ? 3 : 2;
  ctx.stroke();
  if (arrow) drawArrowhead(x1, y1, x2, y2, _execHl ? _execEdgeCol : undefined);
}

// ============================================================================
// P6 (round 15, Ismail 2026-07-14) — EVIDENZIAZIONE PER PERCORSO (Strategia A).
// Invece di INDOVINARE quali archi appartengono a una transizione confrontando
// (from,to)+branch+fase (che si rompe con gli annidamenti: back-edge condivisi
// attribuiti all'ultimo membro del corpo, geometrie invertite, molti-a-molti),
// si COSTRUISCE la polilinea visiva ORDINATA F->T e la si evidenzia un tratto
// alla volta seguendo il flusso. Vedi PLANS/2026-07-14-analisi-highlight-esecuzione.md.
//
// computeEdgePath(from,to,branch) -> [ {x1,y1,x2,y2,a}... ] ordinati dal punto di
// USCITA di F fino all'INGRESSO di T. Sorgente: frecce[] (main + visualExtra), piu'
// il back-edge CONDIVISO dell'header quando la transizione rientra in un ciclo
// (indipendentemente dall'indice `from` a cui il layout ha attribuito quel back-edge).
function _segsOfArc(f) {
  const out = [{ x1: Math.round(f.inzioX), y1: Math.round(f.inzioY), x2: Math.round(f.fineX), y2: Math.round(f.fineY), a: !!f.hasArrow }];
  if (f.visualExtra) for (const s of f.visualExtra) out.push({ x1: Math.round(s[0]), y1: Math.round(s[1]), x2: Math.round(s[2]), y2: Math.round(s[3]), a: !!s[4] });
  return out;
}
function _segKey(s) { return (s.x1 < s.x2 || (s.x1 === s.x2 && s.y1 <= s.y2)) ? (s.x1 + ',' + s.y1 + ',' + s.x2 + ',' + s.y2) : (s.x2 + ',' + s.y2 + ',' + s.x1 + ',' + s.y1); }
function _dedupeSegs(segs) { const seen = new Set(); const out = []; for (const s of segs) { if (s.x1 === s.x2 && s.y1 === s.y2) continue; const k = _segKey(s); if (seen.has(k)) continue; seen.add(k); out.push(s); } return out; }
// Ordina i segmenti in una polilinea connessa, partendo dal punto piu' vicino al nodo F.
function _orderSegsFromNode(segs, fromIdx) {
  if (segs.length <= 1) return segs.slice();
  const near = (a, b) => Math.abs(a - b) <= 3;
  const fn = (typeof nodi !== "undefined" && nodi[fromIdx]) ? nodi[fromIdx] : null;
  const _fromType = (typeof flow !== "undefined" && flow.nodes && flow.nodes[fromIdx]) ? flow.nodes[fromIdx].type : null;
  let fx, fy;
  if (fn && _fromType === 'do') {
    // D2 (do-while): la transizione ESCE dal vertice SINISTRO dell'esagono (inizio della risalita),
    // non dal fondo -- geometria capovolta. Ancorando qui l'ordine e' risalita -> rientro nel corpo,
    // non discesa-al-contrario. (Ismail: "prima freccia sinistra, poi tratto verticale verso il figlio".)
    fx = Math.round(fn.relX * w - (fn.width || 0) / 2); fy = Math.round(fn.relY * h);
  } else {
    fx = fn ? Math.round(fn.relX * w) : (segs[0].x1);
    fy = fn ? Math.round(fn.relY * h + fn.height / 2) : (segs[0].y1);
  }
  // punto di partenza: l'estremo di un segmento piu' vicino a (fx,fy)
  let best = null, bestD = Infinity;
  for (const s of segs) { for (const p of [[s.x1, s.y1], [s.x2, s.y2]]) { const d = Math.abs(p[0] - fx) + Math.abs(p[1] - fy); if (d < bestD) { bestD = d; best = p; } } }
  const used = new Array(segs.length).fill(false);
  const out = []; let cur = best;
  for (let n = 0; n < segs.length; n++) {
    let pick = -1, orient = null;
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; const s = segs[i];
      if (near(s.x1, cur[0]) && near(s.y1, cur[1])) { pick = i; orient = s; break; }
      if (near(s.x2, cur[0]) && near(s.y2, cur[1])) { pick = i; orient = { x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1, a: s.a }; break; }
    }
    if (pick === -1) { // catena spezzata: aggiungi i restanti nell'ordine dato (robustezza)
      for (let i = 0; i < segs.length; i++) if (!used[i]) { out.push(segs[i]); used[i] = true; }
      break;
    }
    used[pick] = true; out.push(orient); cur = [orient.x2, orient.y2];
  }
  return out;
}
// P6 (Ismail 2026-07-14, "deve essere solida la logica non forzata, prevedere tutti i casi"):
// path-finder GEOMETRICO GENERALE. Costruisce il grafo degli estremi di TUTTI i segmenti disegnati
// (frecce main+visualExtra, con tolleranza per il JOIN_DOT_GAP), e trova col BFS il percorso piu'
// corto dal punto startPt all'INGRESSO del nodo goalPt. Ritorna i segmenti ORDINATI in avanti, con
// l'arcId di provenienza. Indipendente da tipo/attribuzione degli archi -> vale a QUALSIASI caso di
// ricongiunzione/annidamento (if_join, loop_exit, back-edge...), non solo quelli previsti a mano.
function _bfsSegPath(startPt, goalPt, excludeArcIds) {
  if (typeof frecce === "undefined" || !Array.isArray(frecce)) return [];
  const TOL = 8; // > JOIN_DOT_GAP (5px): i ponti si fermano poco prima del pallino di ricongiunzione
  const segs = [];
  for (const f of frecce) {
    const aid = f.id != null ? f.id : (f.fromNodeIndex + '-' + f.toNodeIndex + '-' + f.type);
    if (excludeArcIds && excludeArcIds.has(aid)) continue;
    for (const s of _segsOfArc(f)) segs.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, a: s.a, arcId: aid });
  }
  if (!segs.length) return [];
  // Estremi come indici 2k / 2k+1, poi UNION-FIND per unire i punti entro TOL in modo TRANSITIVO
  // (il merge point-a-point non transitivo spezzava il percorso quando tre punti erano a catena
  // sotto tolleranza ma i due estremi oltre: es. 273/268/263 con TOL 8).
  const pts = [];
  for (const s of segs) { pts.push([s.x1, s.y1]); pts.push([s.x2, s.y2]); }
  const parent = pts.map((_, i) => i);
  const find = (i) => { let r = i; while (parent[r] !== r) r = parent[r]; while (parent[i] !== r) { const n = parent[i]; parent[i] = r; i = n; } return r; };
  const union = (i, j) => { const a = find(i), b = find(j); if (a !== b) parent[a] = b; };
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.abs(pts[i][0] - pts[j][0]) <= TOL && Math.abs(pts[i][1] - pts[j][1]) <= TOL) union(i, j);
  const adj = {};
  for (let k = 0; k < segs.length; k++) { const a = find(2 * k), b = find(2 * k + 1); if (a === b) continue; (adj[a] = adj[a] || []).push({ to: b, seg: segs[k], dir: 1 }); (adj[b] = adj[b] || []).push({ to: a, seg: segs[k], dir: -1 }); }
  const roots = Object.keys(adj).map(Number);
  const nearest = (pt) => { let br = -1, bd = Infinity; for (const r of roots) { const d = Math.abs(pts[r][0] - pt[0]) + Math.abs(pts[r][1] - pt[1]); if (d < bd) { bd = d; br = r; } } return br; };
  const start = nearest(startPt), goal = nearest(goalPt);
  if (start < 0 || goal < 0 || start === goal) return [];
  const prev = {}; const seen = new Set([start]); const q = [start];
  while (q.length) { const u = q.shift(); if (u === goal) break; for (const e of (adj[u] || [])) { if (seen.has(e.to)) continue; seen.add(e.to); prev[e.to] = { from: u, edge: e }; q.push(e.to); } }
  if (!(goal in prev)) return [];
  const path = []; let cur = goal;
  while (cur !== start && (cur in prev)) { const p = prev[cur]; const s = p.edge.seg; path.push(p.edge.dir === 1 ? { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, a: s.a, arcId: s.arcId } : { x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1, a: s.a, arcId: s.arcId }); cur = p.from; }
  path.reverse();
  return path;
}
// Ritorna i GRUPPI ordinati della transizione: un gruppo = un arco sorgente (i suoi segmenti
// main+visualExtra, ordinati), da illuminare INSIEME come un'unica unita' ("uno alla volta" =
// un arco alla volta). Ordine: arco d'uscita di F, poi il back-edge condiviso dell'header.
// Cosi' un blocco->while e' UN solo gesto (niente verticale|orizzontale, S1), mentre
// while.false->for esterno e' "uscita while" poi "back-edge del for" (S2, back-edge incluso).
function computeEdgeGroups(from, to, branch, showRisalita) {
  if (typeof frecce === "undefined" || !Array.isArray(frecce)) return [];
  if (showRisalita === undefined) showRisalita = true; // default: mostra la risalita (compat/harness)
  const typeOkForBranch = (t) => {
    if (branch === 'true') return t === 'if_true' || t === 'loop_body';
    if (branch === 'false') return t === 'if_false' || t === 'loop_exit';
    return t === 'normal' || t === 'loop_body_end' || t === 'if_join' || t === 'loop_exit'; // branch null: blocco/ritorno
  };
  const groups = []; const usedArc = new Set();
  const _fromNode = (typeof flow !== "undefined" && flow.nodes) ? flow.nodes[from] : null;
  const addArc = (f, order) => {
    const id = f.id != null ? f.id : (f.fromNodeIndex + '-' + f.toNodeIndex + '-' + f.type); if (usedArc.has(id)) return; usedArc.add(id);
    // DW-1 (Ismail 2026-07-14, "do-while: le frecce si accendono tutte insieme"): per una transizione
    // da un `do`, la RISALITA (freccia sinistra, agganciata come visualExtra dell'arco di discesa) e
    // la DISCESA (main) sono DUE archi visivi distinti -> DUE gruppi separati, animati uno alla volta
    // (prima la risalita, poi la discesa). Senza questo erano un gruppo solo = tutto insieme.
    if (_fromNode && _fromNode.type === 'do' && f.type === 'loop_body' && f.visualExtra && f.visualExtra.length) {
      const risalita = f.visualExtra.map(s => ({ x1: Math.round(s[0]), y1: Math.round(s[1]), x2: Math.round(s[2]), y2: Math.round(s[3]), a: !!s[4] }));
      const discesa = [{ x1: Math.round(f.inzioX), y1: Math.round(f.inzioY), x2: Math.round(f.fineX), y2: Math.round(f.fineY), a: !!f.hasArrow }];
      // La RISALITA si mostra solo sui RITORNI (condizione valutata dopo il corpo), NON alla prima
      // entrata: showRisalita=false (passato da animateExecEdge quando e' la prima visita del do-while).
      if (showRisalita !== false) groups.push({ order: order, from: f.fromNodeIndex, to: f.toNodeIndex, type: 'do_risalita', segs: _orderSegsFromNode(_dedupeSegs(risalita), from) });
      groups.push({ order: order + 0.5, from: f.fromNodeIndex, to: f.toNodeIndex, type: 'do_discesa', segs: _dedupeSegs(discesa) });
      return;
    }
    groups.push({ order: order, from: f.fromNodeIndex, to: f.toNodeIndex, type: f.type, segs: _orderSegsFromNode(_dedupeSegs(_segsOfArc(f)), from) });
  };
  // 1) arco d'USCITA di F verso T (specifico del ramo preso)
  for (const f of frecce) if (f.fromNodeIndex === from && f.toNodeIndex === to && typeOkForBranch(f.type)) addArc(f, 0);
  const tNode = (typeof flow !== "undefined" && flow.nodes) ? flow.nodes[to] : null;
  // (Il vecchio blocco "back-edge condiviso" e' stato rimosso: il BFS generale al punto 4 copre
  //  sia i ritorni in un header di ciclo sia le uscite forward da strutture annidate, in modo
  //  unificato e senza casi speciali per tipo d'arco.)
  // 3) INGRESSO in un do-while dall'esterno (to = do, from != to): l'arco d'ingresso arriva alla CIMA
  //    del corpo, ma l'esagono e' in FONDO. Si aggiunge la DISCESA (cima corpo -> esagono, il MAIN del
  //    loop_body, NON la risalita) come gruppo dopo l'ingresso, cosi' la sequenza e'
  //    "arco d'ingresso -> discesa -> esagono" invece di saltare la verticale (Ismail: "la prima volta
  //    che entra dentro deve essere discesa, esagono, risalita").
  const _doIsEmpty = tNode && tNode.type === 'do' && tNode.next && parseInt(tNode.next.true, 10) === to; // self-loop = corpo vuoto
  if (tNode && tNode.type === 'do' && from !== to && _doIsEmpty) {
    for (const f of frecce) {
      if (f.fromNodeIndex === to && f.type === 'loop_body') {
        const id = 'do-entry-descent-' + to;
        if (!usedArc.has(id)) { usedArc.add(id);
          groups.push({ order: 2, from: to, to: to, type: 'do_discesa', segs: [{ x1: Math.round(f.inzioX), y1: Math.round(f.inzioY), x2: Math.round(f.fineX), y2: Math.round(f.fineY), a: !!f.hasArrow }] });
        }
      }
    }
  }
  // 4) CONTINUAZIONE GENERALE (BFS geometrico). Se l'arco d'uscita di F non arriva da solo a T
  //    (tipico uscendo da IF/cicli ANNIDATI: il percorso passa per ricongiunzioni attribuite ad altri
  //    nodi), si trova il resto del percorso F->T col path-finder su TUTTI i segmenti e lo si aggiunge
  //    raggruppato per arco, un arco alla volta. Non per il do-while (la sua geometria capovolta e la
  //    risalita sono gia' gestite sopra) e non sui rientri in ciclo (gestiti dal back-edge condiviso).
  if (tNode && !(_fromNode && _fromNode.type === 'do') && groups.length &&
      typeof nodi !== "undefined" && nodi[to]) {
    const last = groups[groups.length - 1].segs;
    const startPt = last.length ? [last[last.length - 1].x2, last[last.length - 1].y2] : null;
    // GOAL del BFS. Forward: la CIMA di T (unico punto d'ingresso). RITORNO in un header di ciclo
    // (to<=from): l'header ha PIU' archi entranti (ingresso da fuori, back-edge, entrata nel corpo)
    // -> agganciare la "cima di T" e' ambiguo e il BFS puo' prendere l'arco sbagliato. Si usa allora
    // l'estremo del BACK-EDGE (loop_body_end, to=T) piu' vicino all'header: cosi' il BFS include per
    // forza il back-edge condiviso + le eventuali ricongiunzioni annidate in mezzo, fino all'header.
    const _hx = Math.round(nodi[to].relX * w), _hy = Math.round(nodi[to].relY * h);
    let goalPt = [_hx, Math.round(nodi[to].relY * h - (nodi[to].height || 0) / 2)];
    const _isReturn = tNode && typeof isBranchingNodeType === "function" && isBranchingNodeType(tNode.type) && tNode.type !== 'if' && to <= from;
    if (_isReturn) {
      const be = frecce.find(f => f.toNodeIndex === to && f.type === 'loop_body_end');
      if (be) {
        const ss = _segsOfArc(be); const ends = [[ss[0].x1, ss[0].y1], [ss[ss.length - 1].x2, ss[ss.length - 1].y2]];
        goalPt = ends.reduce((b, e) => (Math.abs(e[0] - _hx) + Math.abs(e[1] - _hy) < Math.abs(b[0] - _hx) + Math.abs(b[1] - _hy)) ? e : b);
        goalPt = [Math.round(goalPt[0]), Math.round(goalPt[1])];
      }
    }
    if (startPt) {
      const bpath = _bfsSegPath(startPt, goalPt, usedArc);
      let order2 = 10, curArc = null, curSegs = null;
      for (const s of bpath) {
        if (s.arcId !== curArc) { if (curSegs && curSegs.length) groups.push({ order: order2++, from: -1, to: to, type: 'reconnect', segs: curSegs }); curArc = s.arcId; curSegs = []; }
        curSegs.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, a: s.a });
      }
      if (curSegs && curSegs.length) groups.push({ order: order2++, from: -1, to: to, type: 'reconnect', segs: curSegs });
    }
  }
  groups.sort((a, b) => a.order - b.order);
  return groups;
}
// Compat/verifica: la polilinea PIATTA ordinata (tutti i segmenti dei gruppi in fila).
function computeEdgePath(from, to, branch) {
  const groups = computeEdgeGroups(from, to, branch);
  let segs = []; for (const g of groups) segs = segs.concat(g.segs);
  return _orderSegsFromNode(_dedupeSegs(segs), from);
}


// FUNZIONE PRINCIPALE draw(forme):
//  Calcola quanti collegamenti in entrata (incoming) ha ciascun nodo logico (flow.nodes).
//  Costruisce joinSet = un insieme di indici di nodi che hanno almeno 2 collegamenti in entrata.
//  Disegna i nodi (considerando colori, forme specifiche per tipo, e testo interno).
//  Per ogni collegamento “next” definito in flow.nodes:
//      Se il collegamento proviene da un nodo IF (distinguendo ramo true e false),
//       (le funzioni drawArrowFromRight/drawArrowFromLeft citate qui erano codice morto, rimosse 2026-07-05).
//      Altrimenti (collegamento “normale”), se il nodo di destinazione è in joinSet (cioè ha multipli ingressi),
//       disegna una connessione spezzata (verticale, orizzontale, verticale).
//      Se non è un IF e non va a un join node, disegna una linea retta semplice usando drawLine
function draw(forme) {
  // 1) Calcolo incomingCount e joinSet
  const incomingCount = Array(flow.nodes.length).fill(0); //per contare gli ingressi per ogni nodo
  for (let i = 0; i < flow.nodes.length; i++) {
    const nd = flow.nodes[i];
    if (!nd) continue;
    // isBranchingNodeType (IF + While/For/Do): generalizzato da "solo if" cosi' anche
    // gli ingressi generati da un ciclo (corpo + uscita) contano per il joinSet.
    if (isBranchingNodeType(nd.type) && typeof nd.next === "object" && nd.next !== null) {
      const t = parseInt(nd.next.true, 10); // Indice del nodo successivo per il ramo true
      const f = parseInt(nd.next.false, 10); // Indice del nodo successivo per il ramo false
      if (!isNaN(t) && t < incomingCount.length && t !== i) incomingCount[t]++; // t===i escluso: self-loop di un corpo vuoto non e' un "ingresso" da contare
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
  // FIX (Ismail 2026-07-07): calcola SEMPRE dimensioni/testo (_lines) dei nodi prima di
  // disegnare -- cosi' il contenuto e' visibile fin dal PRIMO render e non solo dopo aver
  // spostato un blocco (prima _lines veniva popolato solo dentro calcoloY, che non gira a
  // ogni draw). E' idempotente: se calcoloY l'ha gia' fatto, i valori restano identici.
  if (typeof computeNodeSizes === 'function') computeNodeSizes(forme);
  resizeCanvasToFitNodes(forme); // Adatta le dimensioni del canvas ai nodi
  // CRISP ZOOM: scala il contesto in modo che le coordinate LOGICHE (relX*w) riempiano il
  // backing supersamplato -> disegno nitido a ogni zoom. clearRect in coord logiche copre tutto.
  if (ctx.setTransform && canvas && canvas.width && w) { try { ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0); } catch (e) {} }
  ctx.clearRect(0, 0, w, h); // Pulisce il canvas
  frecce = []; // Resetta l'array delle frecce visuali

  // R12-G/Fase1 (Ismail 2026-07-12): calcolato UNA volta per frame (non per nodo) l'insieme
  // di tutti gli indici appartenenti a un'unita' multi-selezionata (dedup "outer wins" gia'
  // applicato da getSelectionUnits/_multiSelectMemberSet in interaction.js).
  const _multiSelSet = (typeof _multiSelectMemberSet === "function") ? _multiSelectMemberSet() : new Set();

   // 3) DISEGNO DI TUTTI I NODI
  for (let i = 0; i < forme.length; i++) {
    const node = forme[i]; // Nodo visuale corrente
    if (!node) continue;

    const tipo = flow.nodes[i].type; // Tipo del nodo logico corrispondente
    // Colore dal tema centralizzato (NODE_COLORS in state.js); fallback al colore del nodo.
    // FIX (Ismail 2026-07-07): nel tema B/N i blocchi sono NON colorati (fill bianco,
    // bordo/testo neri), non pastelli desaturati da un filtro grigio -- resa piu' pulita.
    // MIGLIORIA #43 (Ismail 2026-07-08): i colori dei nodi sono ora centralizzati in variabili
    // CSS (--node-<tipo>), con fallback a NODE_COLORS: cosi' l'editor di tema puo' ridefinirli.
    const _nodeDefault = (typeof NODE_COLORS !== "undefined" && NODE_COLORS[tipo]) || node.color || "white";
    let coloreNodo = (typeof currentTheme !== "undefined" && currentTheme === "bw")
      ? "white"
      : cssVar('--node-' + tipo, _nodeDefault);
    // FIX (Ismail 2026-07-07): contenuto vuoto/invalido -> blocco ROSSO (segnalazione errore).
    if (node._error) coloreNodo = cssVar('--exec-error-color', "#e53935");

    let x0 = node.relX * w - node.width / 2;
    const y0 = node.relY * h - node.height / 2;
    const cx = x0 + node.width / 2;
    const cy = y0 + node.height / 2;

    // Disegno della forma (rettangolo arrotondato, parallelogramma, rombo, o rettangolo normale)
    ctx.fillStyle   = coloreNodo; // Imposta il colore di riempimento
    ctx.strokeStyle = "black"; // Imposta il colore del bordo (il nodo resta su sfondo chiaro/pastello anche in dark mode)

    let toWrite = (flow.nodes[i] && typeof nodeDisplayLabel === 'function') ? nodeDisplayLabel(flow.nodes[i].type) : node.text; // Testo base del nodo (tradotto)
      if (flow.nodes[i] && typeof TURTLE_TYPES !== "undefined" && TURTLE_TYPES.indexOf(flow.nodes[i].type) !== -1 && typeof turtleNodeLabel === "function") {
        // Blocchi GRAFICA (turtle): etichetta breve e leggibile (es. "Turn \u21BB90\u00B0"), non "turn:right;90".
        toWrite = turtleNodeLabel(flow.nodes[i].type, flow.nodes[i].info || "");
      } else if (flow.nodes[i] && !["start", "end"].includes(flow.nodes[i].type)) {
        toWrite += ":" + (flow.nodes[i].info || ""); // Aggiunge le informazioni specifiche del nodo se non è start/end
    }
    // (La dimensione del nodo -- width/height/_lines -- e' gia' stata calcolata da
    // computeNodeSizes() in layout.js PRIMA del layout, cosi' l'anti-sovrapposizione
    // riserva lo spazio giusto e i blocchi con testo lungo non si sovrappongono piu'.)

    switch (tipo) { // Disegna la forma specifica in base al tipo di nodo
      case "start":
      case "end":
        drawRoundedRect(x0, y0, node.width, node.height, 10); // 10 è il raggio degli angoli
        break;
      case "read": case "input":
      case "write": case "output": case "print":
        drawParallelogram(x0, y0, node.width, node.height, 20); // 20 è l'inclinazione
        break;
      case "assign": case "assignment":
        // FIX (Ismail 2026-07-07): Assegna e' un RETTANGOLO (coerente col popup e con lo
        // standard Flowgorithm), distinto dai parallelogrammi di Input/Output.
        drawRoundedRect(x0, y0, node.width, node.height, 4);
        break;
      case "if":
        drawDiamond(x0, y0, node.width, node.height);
        break;
      case "while":
      case "for":
      case "do":
        // FIX B1/B2 (review Fable, 2026-07-05, piano Do-While/For): stessa geometria a
        // esagono del While per gli altri due cicli -- solo etichette/colore cambiano
        // (LOOP_LABELS/NODE_COLORS), non la forma.
        drawHexagon(x0, y0, node.width, node.height);
        break;
      case "pause": // Tools: esagono rosa (marcatore non eseguibile)
        drawHexagon(x0, y0, node.width, node.height);
        break;
      case "comment": // Tools: riquadro tratteggiato (annotazione non eseguibile) -- il
        // tratteggio si applica allo stroke condiviso sotto (tipo === "comment").
        drawRoundedRect(x0, y0, node.width, node.height, 6);
        break;
      case "forward": // GRAFICA turtle (Flowgorithm)
        drawForwardShape(x0, y0, node.width, node.height);
        break;
      case "turn":
        // R12-D: la forma segue la direzione GIA' scelta dall'utente (turnDirectionOf,
        // vedi draw.js) -- null finche' il dialog non e' stato salvato con una radio
        // selezionata, quindi doppia freccia per un turn appena creato (comportamento
        // storico invariato).
        drawTurnShape(x0, y0, node.width, node.height, (typeof turnDirectionOf === 'function') ? turnDirectionOf(flow.nodes[i].info) : null);
        break;
      case "home":
        drawHomeShape(x0, y0, node.width, node.height);
        break;
      case "pen":
      case "gclear":
        drawRoundedRect(x0, y0, node.width, node.height, 6);
        break;
      default: // Nodo di tipo non riconosciuto o generico
        ctx.beginPath();
        ctx.rect(x0, y0, node.width, node.height);
        ctx.closePath();
        break;
    }
    // Il nodo "afferrato" durante un drag resta semi-trasparente nella sua
    // posizione originale: il "ghost" che segue il cursore (disegnato in fondo,
    // sopra a tutto) da' la sensazione di trascinamento reale.
    // dragSubtreeEnd copre l'intero blocco trascinato: dragNodeIndex+1 per un nodo
    // semplice, oppure il joinIndex del sottoalbero per un blocco IF (cosi' TUTTO il
    // contenuto dei rami sbiadisce insieme al rombo, dando la sensazione che si stia
    // trascinando un unico blocco e non solo l'IF).
    const dragEnd = (typeof dragSubtreeEnd !== "undefined" && dragSubtreeEnd !== -1) ? dragSubtreeEnd : (typeof dragNodeIndex !== "undefined" ? dragNodeIndex + 1 : -1);
    const isBeingDragged = (typeof isDraggingNode !== "undefined" && isDraggingNode && typeof dragNodeIndex !== "undefined" && dragNodeIndex !== -1 && (
      (i >= dragNodeIndex && i < dragEnd) ||
      // R14: drag SPARSO -- il fade copre TUTTI i membri della selezione, non un range.
      (typeof dragScattered !== "undefined" && dragScattered && _multiSelSet.has(i))
    ));
    if (isBeingDragged) { ctx.save(); ctx.globalAlpha = 0.3; }
    ctx.fill(); // Riempie la forma
    if (tipo === "comment") { ctx.save(); ctx.setLineDash([6, 4]); ctx.stroke(); ctx.restore(); }
    else ctx.stroke(); // Disegna il bordo
    if (isBeingDragged) { ctx.restore(); }

    // Evidenzia il nodo attualmente in esecuzione (step manuale / Run)
    if (typeof executingNodeIndex !== "undefined" && i === executingNodeIndex) {
      ctx.save();
      ctx.strokeStyle = (typeof cssVar === "function") ? cssVar('--exec-node-color', '#ff9800') : '#ff9800';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // C4 (round 11): bordo di selezione (click singolo, PRIMA del dialog). Il path della
    // forma e' ancora quello attivo sul contesto (stesso beginPath/closePath disegnato
    // sopra), quindi si ri-stroka con colore/spessore diversi -- stesso pattern del bordo
    // "in esecuzione" qui sopra, nessun bisogno di richiamare le funzioni drawXxx.
    if (typeof selectedNodeIdx !== "undefined" && i === selectedNodeIdx) {
      ctx.save();
      ctx.strokeStyle = (typeof cssVar === "function") ? cssVar('--node-selected-color', '#1e88e5') : '#1e88e5';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // R12-G/Fase1: bordo TRATTEGGIATO per la selezione multipla (Ctrl+click). Stesso path
    // ancora attivo sul contesto -> ri-stroke, nessuna chiamata a drawXxx necessaria.
    if (_multiSelSet.has(i)) {
      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = (typeof cssVar === "function") ? cssVar('--node-selected-color', '#1e88e5') : '#1e88e5';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // R13-B (Ismail 2026-07-12): flash ROSSO ~400ms sui nodi della selezione appena
    // rifiutata (spostamento/copia di gruppo) -- prima il rifiuto era visibile SOLO in
    // console (warnMoveRejected), invisibile durante un drag reale. Stato in state.js
    // (_bfRejectFlashMembers/_bfRejectFlashUntil), innescato da triggerRejectFlash()
    // (interaction.js). Stesso pattern "ri-stroke del path ancora attivo" del bordo di
    // selezione sopra.
    if (typeof _bfRejectFlashMembers !== 'undefined' && _bfRejectFlashMembers && _bfRejectFlashMembers.has(i) &&
        typeof _bfRejectFlashUntil !== 'undefined' && Date.now() < _bfRejectFlashUntil) {
      ctx.save();
      ctx.strokeStyle = (typeof cssVar === "function") ? cssVar('--exec-error-color', '#e53935') : '#e53935';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // Evidenzia il nodo attualmente trascinato (Drag & Drop)
    if (isBeingDragged) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      // R12-E/E1 (Ismail 2026-07-11): era un blu fisso, non seguiva l'editor tema -- riusa
      // arcDragColor() (stessa var --arc-drag-color gia' usata per l'arrowhead dell'arco
      // target qui sotto), cosi' TUTTO il feedback visivo di un drag ha lo stesso colore
      // personalizzabile (acccettazione E1: "incluse selezione/drag").
      ctx.strokeStyle = (typeof arcDragColor === "function") ? arcDragColor() : "#1e88e5";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.75;
      ctx.stroke();
      ctx.restore();
    }

    if (node.text) {
      ctx.font = `bold 16px Arial`;
      // P (round 15, Ismail): colore del testo dei blocchi via VARIABILE CSS (--node-text,
      // default nero) -- cosi' e' personalizzabile in "crea tema" ed e' la STESSA sorgente
      // usata dalla palette (coerenza garantita su ogni tema). Testo d'errore: --node-error-text.
      ctx.fillStyle = node._error
        ? ((typeof cssVar === "function") ? cssVar('--node-error-text', 'white') : 'white')
        : ((typeof cssVar === "function") ? cssVar('--node-text', 'black') : 'black');
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Testo multi-riga: usa le righe pre-calcolate da computeNodeSizes (wrap del contenuto lungo).
      const _lines = (node._lines && node._lines.length) ? node._lines : [toWrite];
      const _lh = 20;
      const _startY = cy - (_lines.length - 1) * _lh / 2;
      for (let _li = 0; _li < _lines.length; _li++) ctx.fillText(_lines[_li], cx, _startY + _li * _lh);
    }
  }

  // 4) DISEGNO DEI COLLEGAMENTI
  // Raccoglie i nodi che fanno parte di un ramo IF O del corpo di un ciclo: i loro
  // collegamenti sono gestiti dal genitore (IF o While/For/Do), non qui in 4.b.
  const branchNodes = new Set();
  for (let i = 0; i < flow.nodes.length; i++) {
    const n = flow.nodes[i];
    if (n && n.type === "if" && typeof n.next === "object" && n.next !== null) {
      const sub = collectBranchNodes(i);
      sub.trueList.forEach(idx => branchNodes.add(idx));
      sub.falseList.forEach(idx => branchNodes.add(idx));
    }
    else if (n && isBranchingNodeType(n.type) && n.type !== "if" && typeof n.next === "object" && n.next !== null) {
      const body = collectLoopBody(i);
      body.bodyList.forEach(idx => branchNodes.add(idx));
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

    // 4.a-bis) Se è un ciclo (While/For/Do), disegno corpo + back-edge + uscita.
    // FIX BUG 4 (Ismail 2026-07-05 sera): il Do-While ha geometria capovolta rispetto
    // a While/For (corpo PRIMA dell'esagono, non dopo) -- percorso di disegno dedicato,
    // vedi drawDoWhileBranches.
    if (isBranchingNodeType(logicNode.type) && logicNode.type !== "if" && typeof logicNode.next === "object" && logicNode.next !== null) {
      if (logicNode.type === "do") {
        drawDoWhileBranches(i, node);
      } else {
        drawLoopBranches(i, node);
      }
      continue;
    }

    // 4.b) Collegamento “normale” (next è una stringa che indica l'indice del prossimo nodo)
    if (typeof logicNode.next === "string" && logicNode.next !== null) {
      const nextIndex = parseInt(logicNode.next, 10); // Indice del prossimo nodo
      if (isNaN(nextIndex) || !forme[nextIndex]) continue; // Salta se l'indice non è valido o il nodo visuale non esiste

      // Se il nodo corrente fa parte di un ramo IF, il suo collegamento è gestito dal genitore IF
      if (branchNodes.has(i)) continue;

      const targetNodeVisual = forme[nextIndex]; // Nodo visuale di destinazione
      // FIX round-4l: punto d'arrivo = bordo REALE del nodo successivo (entryTopY) --
      // segmento terminale, ci va la punta.
      drawLine(
        xMid, // Dal centro X del nodo di partenza
        yMid + nodeHeight / 2, // Dal bordo inferiore del nodo di partenza
        targetNodeVisual.relX * w, // Al centro X del nodo di destinazione
        entryTopY(nextIndex), // Al bordo superiore del nodo di destinazione (o cima del corpo, se e' un Do-While: BUG 4)
        true,
        i,
        nextIndex,
        'normal',
        null,
        true
      );
    }
  }

  // 5) EVIDENZIAZIONE del ramo/arco sotto il cursore (hover)
  if (typeof hoverArc !== "undefined" && hoverArc) {
    let branchList = null;
    if (hoverArc.kind === "branch") {
      const subH = collectBranchNodes(hoverArc.ifIdx);
      branchList = hoverArc.side === "if_true" ? subH.trueList : subH.falseList;
    }
    ctx.save();
    ctx.strokeStyle = arcHoverColor();
    // C3 (round 11): hover deve cambiare SOLO il colore -- stesso lineWidth del tratto
    // base (drawLine, 2) e stessa scala punta (1), niente piu' "ingrossamento".
    ctx.lineWidth = 2;
    for (const f of frecce) {
      let hit = false;
      if (hoverArc.kind === "branch") {
        hit = (f.fromNodeIndex === hoverArc.ifIdx && f.type === hoverArc.side)
              || (branchList && branchList.indexOf(f.fromNodeIndex) !== -1);
      } else {
        hit = (f.inzioX === hoverArc.ax && f.inzioY === hoverArc.ay
               && f.fineX === hoverArc.bx && f.fineY === hoverArc.by);
      }
      if (hit) {
        ctx.beginPath(); ctx.moveTo(f.inzioX, f.inzioY); ctx.lineTo(f.fineX, f.fineY); ctx.stroke();
        // FIX round-4o (Ismail, "vorrei che anche la punta si illuminasse al click
        // dell'arco"): se questo arco disegna una punta (hasArrow), ridisegnarla nello
        // stesso rosso dell'evidenziazione -- altrimenti restava nera anche quando il
        // resto dell'arco si coloriva, dando l'impressione che l'evidenziazione fosse
        // incompleta.
        if (f.hasArrow) drawArrowhead(f.inzioX, f.inzioY, f.fineX, f.fineY, arcHoverColor(), 1);
        // FIX round-4j (vedi nota su drawLine/visualExtra): il placeholder di un corpo
        // VUOTO di While/For e' visivamente un anello (giu' - lato - su fino
        // all'esagono), ma solo il primo tratto e' cliccabile/in frecce[] -- gli altri
        // tratti (solo visivi, salva=false all'origine) viaggiano qui come
        // visualExtra e vanno ridisegnati in rosso insieme al tratto principale,
        // altrimenti l'utente vede colorarsi "solo la parte alta" invece di tutto
        // l'anello che percepisce come un unico arco.
        if (f.visualExtra) {
          for (const seg of f.visualExtra) {
            ctx.beginPath(); ctx.moveTo(seg[0], seg[1]); ctx.lineTo(seg[2], seg[3]); ctx.stroke();
            // FIX round-4p (Ismail, "deve colorarsi anche dove e' selezionato la
            // punta arco cicli"): seg[4] (booleano) segna quale segmento di
            // continuazione porta davvero una punta -- solo quello la ridisegna nel
            // colore di evidenziazione, altrimenti restava nera anche con l'intero
            // anello/back-edge acceso.
            if (seg[4]) drawArrowhead(seg[0], seg[1], seg[2], seg[3], arcHoverColor(), 1);
          }
        }
      }
    }
    ctx.restore();
  }

  // 6) Evidenziazione dell'arco di destinazione durante il Drag & Drop di un nodo
  if (typeof isDraggingNode !== "undefined" && isDraggingNode && typeof dragOverIndex !== "undefined" && dragOverIndex !== -1 && frecce[dragOverIndex]) {
    const fdrag = frecce[dragOverIndex];
    ctx.save();
    // R12-E/E1: come sopra -- il corpo della linea era fisso, mentre l'arrowhead di questo
    // stesso arco (poco sotto, drawArrowhead) usava GIA' arcDragColor(): incoerente fra loro.
    ctx.strokeStyle = (typeof arcDragColor === "function") ? arcDragColor() : "#1e88e5";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(fdrag.inzioX, fdrag.inzioY);
    ctx.lineTo(fdrag.fineX, fdrag.fineY);
    ctx.stroke();
    // FIX round-4o: stesso principio dell'evidenziazione hover (punto 5) applicato
    // all'evidenziazione del target di drag&drop -- la punta, se presente, si
    // ridisegna nello stesso blu.
    if (fdrag.hasArrow) drawArrowhead(fdrag.inzioX, fdrag.inzioY, fdrag.fineX, fdrag.fineY, arcDragColor(), 1.6);
    // FIX round-4p: stesso aggancio visualExtra gia' applicato all'hover (punto 5),
    // per coerenza -- un anello/back-edge di ciclo evidenziato durante un drag deve
    // accendersi per intero, punta compresa, esattamente come in hover.
    if (fdrag.visualExtra) {
      for (const seg of fdrag.visualExtra) {
        ctx.beginPath(); ctx.moveTo(seg[0], seg[1]); ctx.lineTo(seg[2], seg[3]); ctx.stroke();
        if (seg[4]) drawArrowhead(seg[0], seg[1], seg[2], seg[3], arcDragColor(), 1.6);
      }
    }
    ctx.restore();
  }

  // 6bis) EVIDENZIAZIONE dell'INTERA freccia PERCORSA durante l'esecuzione (C1, round 11).
  // Il check inline dentro drawLine() (sopra, _execHl, FIX #12) colora gia' il PRIMO
  // segmento di un arco -- utile per gli archi lineari semplici -- ma un arco composto da
  // piu' segmenti (rami if/cicli: steli+gomiti+ponti) restava illuminato solo a meta'.
  // Stessa meccanica del punto 5 (hover) sopra: ridisegna l'arco INTERO (segmento +
  // visualExtra + punta) sopra il disegno base. Va DOPO il bordo di selezione dei nodi
  // (C4, punto 3 del ciclo nodi sopra): sezioni diverse di draw(), nessuna interferenza.
  if (typeof executingEdge !== "undefined" && executingEdge) {
    const _execEdgeCol2 = (typeof cssVar === "function") ? cssVar('--exec-edge-color', '#ff9800') : '#ff9800';
    ctx.save();
    ctx.strokeStyle = _execEdgeCol2;
    ctx.lineWidth = 3;
    // P6 (Strategia A): se executingEdge porta un GRUPPO gia' calcolato (segmenti da accendere
    // questo frame), lo si disegna e basta -- niente matching euristico (from,to)+branch+fase.
    // computeEdgeGroups/animateExecEdge forniscono la polilinea esatta F->T (back-edge condivisi
    // inclusi), un arco alla volta. Il vecchio percorso sotto resta come FALLBACK quando litGroup
    // non c'e' (compatibilita' con eventuali chiamate diverse).
    if (executingEdge.litGroup && executingEdge.litGroup.length) {
      for (const s of executingEdge.litGroup) {
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        if (s.a) drawArrowhead(s.x1, s.y1, s.x2, s.y2, _execEdgeCol2, 1);
      }
      ctx.restore();
      return; // salta il matching legacy sotto (durante l'esecuzione non c'e' drag-ghost da disegnare)
    }
    // P5.2/P5.3 (round 15): una singola transizione logica (from->to) puo' essere
    // rappresentata da PIU' archi visivi che condividono gli stessi estremi -- es. un ramo
    // if vuoto che rientra nel while coincide col back-edge del ciclo (loop_body_end +
    // if_false, entrambi from=if to=while). Prima il `break` accendeva solo il PRIMO,
    // lasciando spenta meta' del percorso. Ora si evidenziano TUTTI gli archi che combaciano
    // (ognuno con segmento principale + bracci orizzontali visualExtra + punta), cosi' il
    // percorso della transizione si illumina PER INTERO, non solo il tratto verticale.
    // P5.2 (round 15): quando l'esecuzione RIENTRA nel ciclo con una transizione "normale" di
    // ritorno (un nodo del corpo -> header, branch NULL, es. assign 3->while 1), il ritorno
    // visivo e' composto da due archi con `from` diversi: quello dall'ultimo nodo eseguito E il
    // back-edge strutturale del ciclo (loop_body_end, attribuito dal layout all'ULTIMO elemento
    // del corpo). Il back-edge si accende SOLO in questo caso (branch null).
    // OVER-LIGHT FIX (round 15, Ismail): se invece si sta prendendo un RAMO (branch 'true'/'false'),
    // si accende SOLO l'arco di quel ramo -- non l'altro ramo, non il back-edge del ciclo. Prima,
    // con due rami if VUOTI verso lo stesso punto, si accendevano ENTRAMBI i rami + il back-edge
    // ("illumina tutto"). Ora il ramo preso e' l'unico ad accendersi.
    const _backIntoLoop = (executingEdge.from > executingEdge.to);
    const _br = executingEdge.branch || null;
    const _arcOkBranch = function (t) {
      if (!_br) return true;                                   // transizione normale: nessun filtro
      if (_br === 'true')  return t === 'if_true'  || t === 'loop_body';
      return t === 'if_false' || t === 'loop_exit';           // 'false'
    };
    // P5.6 (round 15): animazione a due fasi del back-edge (vedi drawLine e execute.js).
    // executingEdge.phase: 'out' (uscita/discesa) | 'back' (ritorno all'header) | null (una fase).
    // Il MAIN di ogni arco e' la parte in USCITA (discesa) => solo 'out'/null. Il visualExtra di
    // un loop_body_end e' il RITORNO all'header => solo 'back'/null; il visualExtra dei rami
    // (fork/ponte di if_true/if_false) resta parte dell'uscita => 'out'/null.
    const _phase = executingEdge.phase || null;
    const _fromIsBranch = !!(typeof flow !== "undefined" && flow.nodes && flow.nodes[executingEdge.from]
      && typeof isBranchingNodeType === "function" && isBranchingNodeType(flow.nodes[executingEdge.from].type));
    for (const f of frecce) {
      const _direct = (f.fromNodeIndex === executingEdge.from && f.toNodeIndex === executingEdge.to) && _arcOkBranch(f.type);
      const _loopBack = (!_br) && _backIntoLoop && f.type === 'loop_body_end' && f.toNodeIndex === executingEdge.to;
      if (_direct || _loopBack) {
        // P5.6 fase-aware: MAIN e visualExtra di un loop_body_end (back-edge del ciclo) sono il
        // RITORNO al while (fase 'back') -- inclusa la sua verticale ("parte verticale del while")
        // -- TRANNE quando il loop_body_end e' l'uscita DIRETTA di un blocco semplice ultimo del
        // corpo (from === nodo eseguito, non di diramazione): in quel caso il MAIN e' l'uscita in
        // giu' del blocco (fase 'out') e solo il visualExtra (ponte+risalita) e' ritorno.
        const _isLBE = (f.type === 'loop_body_end');
        const _lbeMainOut = _isLBE && (f.fromNodeIndex === executingEdge.from) && !_fromIsBranch;
        const _mainPhase = (_isLBE && !_lbeMainOut) ? 'back' : 'out';
        const _extraPhase = _isLBE ? 'back' : 'out'; // visualExtra: ritorno per il back-edge, uscita per i rami
        if (!_phase || _phase === _mainPhase) {
          ctx.beginPath(); ctx.moveTo(f.inzioX, f.inzioY); ctx.lineTo(f.fineX, f.fineY); ctx.stroke();
          if (f.hasArrow) drawArrowhead(f.inzioX, f.inzioY, f.fineX, f.fineY, _execEdgeCol2, 1);
        }
        if (f.visualExtra && (!_phase || _phase === _extraPhase)) {
          for (const seg of f.visualExtra) {
            ctx.beginPath(); ctx.moveTo(seg[0], seg[1]); ctx.lineTo(seg[2], seg[3]); ctx.stroke();
            if (seg[4]) drawArrowhead(seg[0], seg[1], seg[2], seg[3], _execEdgeCol2, 1);
          }
        }
        // niente break: piu' archi possono rappresentare la stessa transizione.
      }
    }
    ctx.restore();
  }

  // 7) "Ghost" del nodo trascinato: una copia semi-trasparente che SEGUE il
  // cursore, disegnata per ultima (sopra a tutto). E' questa a dare la vera
  // sensazione di "sto trascinando un blocco", non solo l'evidenziazione
  // dell'arco target.
  if (typeof isDraggingNode !== "undefined" && isDraggingNode && typeof dragNodeIndex !== "undefined" && dragNodeIndex !== -1 && forme[dragNodeIndex]) {
    drawDragGhost(forme[dragNodeIndex], dragNodeIndex);
  }
}

// Disegna il "ghost" del nodo trascinato centrato sulla posizione corrente del
// cursore (dragCurrentX/Y), riusando la stessa forma/colore del nodo reale.
function drawDragGhost(node, nodeIndex) {
  const tipo = flow.nodes[nodeIndex] ? flow.nodes[nodeIndex].type : null;
  const coloreNodo = (typeof NODE_COLORS !== "undefined" && NODE_COLORS[tipo]) || node.color || "white";
  const gx = (typeof dragCurrentX === "number" ? dragCurrentX : node.relX * w);
  const gy = (typeof dragCurrentY === "number" ? dragCurrentY : node.relY * h);
  const x0 = gx - node.width / 2;
  const y0 = gy - node.height / 2;

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = coloreNodo;
  // R12-E/E1: ghost del nodo durante il drag -- stesso colore di feedback-drag degli altri due punti.
  ctx.strokeStyle = (typeof arcDragColor === "function") ? arcDragColor() : "#1e88e5";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 3]);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 10;

  // FIX (Ismail 2026-07-07, revisione): il ghost usa la STESSA mappa di forme del nodo reale
  // (prima quasi tutto cadeva nel default=parallelogramma: assign, cicli, pausa, commento
  // apparivano come parallelogrammi durante il drag -- incoerente con la forma vera).
  switch (tipo) {
    case "start": case "end":
      drawRoundedRect(x0, y0, node.width, node.height, 10);
      break;
    case "read": case "input":
    case "write": case "output": case "print":
      drawParallelogram(x0, y0, node.width, node.height, 20);
      break;
    case "assign": case "assignment":
      drawRoundedRect(x0, y0, node.width, node.height, 4);
      break;
    case "if":
      drawDiamond(x0, y0, node.width, node.height);
      break;
    case "while": case "for": case "do": case "pause":
      drawHexagon(x0, y0, node.width, node.height);
      break;
    case "comment":
    case "pen":
    case "gclear":
      drawRoundedRect(x0, y0, node.width, node.height, 6);
      break;
    case "forward":
      drawForwardShape(x0, y0, node.width, node.height);
      break;
    case "turn":
      drawTurnShape(x0, y0, node.width, node.height);
      break;
    case "home":
      drawHomeShape(x0, y0, node.width, node.height);
      break;
    default:
      ctx.beginPath(); ctx.rect(x0, y0, node.width, node.height); ctx.closePath();
      break;
  }
  ctx.fill();
  ctx.stroke();

  if (node.text) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "black";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let toWrite = (flow.nodes[nodeIndex] && typeof nodeDisplayLabel === 'function') ? nodeDisplayLabel(flow.nodes[nodeIndex].type) : node.text;
    if (flow.nodes[nodeIndex] && !["start", "end"].includes(tipo)) {
      toWrite += ":" + (flow.nodes[nodeIndex].info || "");
    }
    // FIX (Ismail 2026-07-08): il ghost del drag mostrava TUTTO il testo su UNA sola riga
    // (traboccando fuori dal blocco). Ora usa le righe gia' spezzate da computeNodeSizes
    // (node._lines) -- le STESSE del nodo reale -- cosi' il blocco trascinato appare gia'
    // formattato/impaginato come sul canvas. Fallback a una riga sola se _lines mancasse.
    const _lines = (node._lines && node._lines.length) ? node._lines : [toWrite];
    const _lh = 20;
    const _startY = gy - (_lines.length - 1) * _lh / 2;
    for (let _li = 0; _li < _lines.length; _li++) ctx.fillText(_lines[_li], gx, _startY + _li * _lh);
  }
  ctx.restore();
}

// Disegna i rami di un IF secondo la nuova logica:
// - stelo e biforcazione NON cliccabili;
// - archi verticali di ingresso ai rami CLICCABILI;
// - archi orizzontali di ricongiunzione NON cliccabili;
// - arco verticale di uscita dall'IF CLICCABILE.
// FIX M5 (review Fable, 2026-07-04 notte-6): un IF il cui join e' condiviso con un
// ANTENATO che lo tratta come ULTIMO elemento del proprio ramo (o dell'ULTIMO membro
// del corpo di un ciclo) NON deve completare da solo la ricongiunzione: quel
// collegamento e' gia' interamente gestito dall'antenato (drawBranchConnections/
// afterLastArcType per un IF genitore -- che scatta per QUALSIASI ultimo elemento
// branching di un ramo, non solo quando e' l'UNICO elemento: vedi 'afterLastArcType'
// sopra, condizionato solo da lastIsIf/lastIsLoop -- oppure il back-edge/loop_body_end
// per un ciclo genitore) -- disegnarlo ANCHE qui creerebbe un secondo arco duplicato
// con lo stesso (from,to,type) del genitore (vedi Test 13/14, che verificano
// ESATTAMENTE un solo if_join per un IF interno con join condiviso). NOTA: la prima
// versione di questo fix controllava erroneamente "sono l'UNICO elemento" (length===1)
// invece di "sono l'ULTIMO elemento" (qualunque sia la lunghezza) -- corretto dopo aver
// trovato con un harness dedicato un caso con 2 IF in sequenza nello stesso ramo dove
// il secondo (ultimo-ma-non-unico) produceva un if_join duplicato (uno dal padre, uno
// da se stesso) esattamente come i regressi di Test 13/14, solo non coperto da test.
// FIX BUG 4 (Ismail 2026-07-05 sera): un Do-While ha il proprio "box" (esagono)
// disegnato SOTTO il suo corpo (vedi layoutDoWhileNode in layout.js), quindi il
// punto in cui una freccia ENTRANTE deve terminare non e' il bordo superiore del
// box (relY*h - height/2, valido per ogni altro tipo di nodo, compreso While/For
// dove il box e' in cima) ma la CIMA DEL CORPO (v.doBodyTopPxY, calcolata dal
// layout) -- altrimenti l'arco di ingresso punterebbe all'esagono (in fondo alla
// struttura) invece che al vero inizio visivo. I punti di ingresso a un nodo sono
// numerosi (arco normale, rami IF, corpo/join di un ciclo genitore...): centralizzati
// qui invece di ripetere lo stesso controllo in ogni punto (principio N5: una sola
// fonte di verita', mai una condizione sparsa).
function entryTopY(targetIdx) {
  const v = nodi[targetIdx];
  const n = flow.nodes[targetIdx];
  if (!v) return 0;
  if (n && n.type === "do" && typeof v.doBodyTopPxY === "number") {
    // FIX (trovato dal nuovo test-if.js, Test 12): doBodyTopPxY e' un valore in PX
    // ASSOLUTI del layout (la stessa convenzione di reconnectPxY/bodyColX altrove),
    // NON gia' nella convenzione "relY*h = centro" usata dal resto del rendering.
    // Ogni altro ramo di questa funzione sottrae height/2 per passare da "centro" a
    // "bordo superiore" -- va fatto anche qui, altrimenti l'arco di ingresso termina
    // a META' del primo nodo del corpo invece che sul suo bordo superiore (bug reale,
    // non solo cosmetico: verificato che senza questa sottrazione doBodyTopPxY
    // combacia esattamente col CENTRO, non col bordo superiore, del primo nodo).
    // FIX BUG 6 (Ismail 2026-07-08, Do-While con condizione lunga: la freccia superiore
    // veniva allungata inutilmente, anche fuori dal canvas): doBodyTopPxY e' un valore in
    // PX ASSOLUTI del layout (la cima della struttura Do-While, indipendente dall'altezza
    // dell'esagono). Ogni altra conversione layout->render sottrae la COSTANTE
    // NODE_BASE_HEIGHT_PX/2 per passare da "top di layout" a "bordo superiore" (vedi
    // reconnectPxY in drawIfBranches/drawBranchConnections). Qui si usava invece v.height/2:
    // quando l'esagono "Do:" CRESCE (condizione lunga -> height fino a 260px+), height/2
    // diventava enorme e l'arco d'ingresso puntava molto sopra la cima reale del corpo
    // (misurato: y=-43, fuori dal canvas). Si usa la costante come ovunque -> per un Do a
    // altezza base (40) il risultato e' identico (nessuna regressione), per uno alto e'
    // corretto.
    return v.doBodyTopPxY - NODE_BASE_HEIGHT_PX / 2;
  }
  return v.relY * h - v.height / 2;
}

function hasSoleBranchAncestor(targetIdx) {
  for (let i = 0; i < flow.nodes.length; i++) {
    if (i === targetIdx) continue;
    const n = flow.nodes[i];
    if (!n || !isBranchingNodeType(n.type) || typeof n.next !== "object" || n.next === null) continue;
    if (n.type === "if") {
      const s = collectBranchNodes(i);
      if ((s.trueList.length > 0 && s.trueList[s.trueList.length - 1] === targetIdx) ||
          (s.falseList.length > 0 && s.falseList[s.falseList.length - 1] === targetIdx)) return true;
    } else {
      const b = collectLoopBody(i);
      if (b.bodyList.length > 0 && b.bodyList[b.bodyList.length - 1] === targetIdx) return true;
    }
  }
  return false;
}

function drawIfBranches(ifIdx, node) {
  const sub = collectBranchNodes(ifIdx);
  const cx = node.relX * w;
  const cy = node.relY * h;
  const diaBottom = cy + node.height / 2;
  // FIX round-4r (Ismail 2026-07-06, screenshot: l'arco cliccabile sopra il Print
  // sembrava la META' di quello sotto): forkY NON e' piu' una frazione proporzionale di
  // IF_BRANCH_START_Y_OFFSET_PX (che spezzava il gap sopra in due meta' uguali, rombo->
  // forkY invisibile + forkY->nodo cliccabile, facendo apparire l'arco cliccabile sopra
  // lungo la META' di quello sotto, un solo pezzo ininterrotto) -- e' ora uno stelo FISSO
  // e indipendente (IF_FORK_STEM_PX, sempre ben visibile, mai proporzionale a nient'altro
  // quindi mai a rischio di rimpicciolirsi come nella regressione round-4o/4p). La
  // simmetria fra l'arco cliccabile sopra (branchTop - forkY) e quello sotto
  // (reconnectY - fondoNodo) e' garantita in state.js dalla derivazione di
  // IF_BRANCH_START_Y_OFFSET_PX = IF_FORK_STEM_PX + IF_RECONNECT_GAP_PX.
  const forkY = diaBottom + IF_FORK_STEM_PX;
  // Colonna reale dei rami: X del primo nodo del ramo (layout ricorsivo per IF
  // annidati); fallback all'offset fisso per i rami vuoti.
  const trueX = sub.trueList.length ? nodi[sub.trueList[0]].relX * w : cx + IF_BRANCH_X_OFFSET_PX;
  const falseX = sub.falseList.length ? nodi[sub.falseList[0]].relX * w : cx - IF_BRANCH_X_OFFSET_PX;

  // Stelo verticale non cliccabile sotto il rombo
  drawLine(cx, diaBottom, cx, forkY, false);

  // Biforcazione orizzontale non cliccabile
  drawLine(cx, forkY, trueX, forkY, false);
  drawLine(cx, forkY, falseX, forkY, false);

  // Profondità dei due rami (in pixel)
  // Ramo vuoto: profondita' allungata (arco ~3x) coerente col layout, per lasciare spazio.
  const trueBottomY = sub.trueList.length > 0
    ? nodi[sub.trueList[sub.trueList.length - 1]].relY * h + nodi[sub.trueList[sub.trueList.length - 1]].height / 2
    : forkY + IF_EMPTY_BRANCH_LEN_PX;
  const falseBottomY = sub.falseList.length > 0
    ? nodi[sub.falseList[sub.falseList.length - 1]].relY * h + nodi[sub.falseList[sub.falseList.length - 1]].height / 2
    : forkY + IF_EMPTY_BRANCH_LEN_PX;
  // Ricongiunzione LOCALE dell'IF: presa dal layout (node.reconnectPxY = sotto il
  // sottoalbero dei SUOI rami, inclusi IF interni), allineata alla convenzione del
  // rendering (relY*h = centro). Fallback al calcolo locale dai fondi dei rami.
  const reconnectY = (typeof node.reconnectPxY === 'number')
    ? node.reconnectPxY - NODE_BASE_HEIGHT_PX / 2
    : Math.max(trueBottomY, falseBottomY) + IF_RECONNECT_GAP_PX;
  // R13-G/P6.1: JOIN_DOT_GAP_PX (state.js) -- gap in px fra il pallino di ricongiunzione e
  // QUALSIASI arco che lo tocca. Costante GLOBALE (non piu' locale a questa funzione, vedi
  // FIX Ismail 2026-07-15 sotto): serve anche a drawLoopBranches/drawDoWhileBranches quando
  // un IF annidato e' l'ultimo membro del loro corpo -- loro non potrebbero chiuderla per
  // closure, essendo funzioni separate.

  // Archi verticali cliccabili dalle colonne dei rami verso il basso
  // FIX round-4q (Ismail 2026-07-06, "quando clicchi sotto per piazzarne sotto ti
  // colora anche la parte orizzontale sotto... se no non ci sono blocchi ovviamente,
  // quindi si evidenzia tutta la parte 'libera di ramo'"): per un ramo VUOTO, questo
  // arco verticale (fork->reconnectY) e' l'UNICO punto di inserimento del ramo -- ma il
  // ponte orizzontale di ricongiunzione (disegnato piu' sotto in drawBranchConnections,
  // salva=false) resta visivamente "staccato": hover/click sull'arco evidenziava solo
  // il tratto verticale, mai il ponte, anche se insieme formano un'unica "parte libera"
  // continua. Si salva qui il riferimento all'arco (frecce[frecce.length-1]) per
  // agganciargli, piu' sotto, il segmento del ponte come visualExtra.
  let trueEmptyArc = null, falseEmptyArc = null;
  if (sub.trueList.length === 0) {
    // FIX BUG 3b (Ismail 2026-07-07, ramo VUOTO): siccome non ci sono blocchi in mezzo,
    // l'unico arco d'inserimento del ramo copre TUTTA la "parte libera" -- deve accendersi
    // per intero: biforcazione orizzontale in ALTO (cx->colonna, a forkY) + verticale +
    // ponte di ricongiunzione in BASSO (aggiunto poco sotto come visualExtra). Qui si
    // inizializza visualExtra col segmento del fork superiore.
    drawLine(trueX, forkY, trueX, reconnectY, true, ifIdx, sub.joinIndex, 'if_true', [[cx, forkY, trueX, forkY, false]]);
    trueEmptyArc = frecce[frecce.length - 1];
  } else {
    // FIX BUG 3 (Ismail 2026-07-07, "quando prendi la parte in alto dell'arco di un IF per
    // inserire un blocco deve illuminarsi tutta la parte libera, ORIZZONTALE compreso"):
    // l'arco cliccabile "in alto" (fork -> primo blocco) aveva visualExtra=null, quindi
    // l'hover accendeva solo il tratto verticale e NON la biforcazione orizzontale
    // (cx -> colonna del ramo, a forkY) che fa parte della stessa "parte libera" d'ingresso.
    // Si aggancia quel segmento come visualExtra (seg[4]=false: nessuna punta), cosi'
    // l'evidenziazione hover/drag lo ridisegna in rosso insieme al verticale, come gia'
    // accade per il ponte di ricongiunzione sull'arco "dopo l'ultimo".
    drawLine(trueX, forkY, trueX, entryTopY(sub.trueList[0]), true, ifIdx, sub.trueList[0], 'if_true', [[cx, forkY, trueX, forkY, false]], true);
  }

  if (sub.falseList.length === 0) {
    drawLine(falseX, forkY, falseX, reconnectY, true, ifIdx, sub.joinIndex, 'if_false', [[cx, forkY, falseX, forkY, false]]);
    falseEmptyArc = frecce[frecce.length - 1];
  } else {
    drawLine(falseX, forkY, falseX, entryTopY(sub.falseList[0]), true, ifIdx, sub.falseList[0], 'if_false', [[cx, forkY, falseX, forkY, false]], true);
  }

  // Collegamenti interni ai rami e archi di ricongiunzione
  function drawBranchConnections(list, sideX, emptyBranchArc) {
    for (let i = 0; i < list.length - 1; i++) {
      // Se il nodo corrente e' un IF o un ciclo (While/For/Do), il collegamento verso
      // la sua uscita e' gia' disegnato da se stesso (if_join dell'IF interno, o
      // loop_exit del ciclo interno quando l'uscita resta nella sua stessa colonna):
      // non duplicarlo qui. BUG N2 (review Fable, 2026-07-04 notte-4): prima si
      // controllava solo "if", quindi per un ciclo NON ultimo di un ramo (altri nodi
      // lo seguono nello stesso ramo) questo loop disegnava un SECONDO arco 'normal'
      // dal ciclo al nodo successivo, duplicando quello gia' disegnato da
      // drawLoopBranches (stesse coordinate, doppia registrazione in frecce).
      if (flow.nodes[list[i]] && isBranchingNodeType(flow.nodes[list[i]].type)) continue;
      const fromNode = nodi[list[i]];
      const toNode = nodi[list[i + 1]];
      drawLine(
        fromNode.relX * w,
        fromNode.relY * h + fromNode.height / 2,
        toNode.relX * w,
        entryTopY(list[i + 1]),
        true,
        list[i],
        list[i + 1],
        'normal',
        null,
        true
      );
    }
    // FIX round-4q: l'arco a cui agganciare il ponte orizzontale di ricongiunzione come
    // visualExtra -- l'arco del ramo VUOTO (emptyBranchArc, gia' impostato sopra) se il
    // ramo non ha nodi, altrimenti l'arco "inserisci dopo l'ultimo nodo" (impostato piu'
    // sotto, solo se effettivamente cliccabile: canInsertAfter).
    let bridgeOwnerArc = emptyBranchArc || null;
    if (list.length > 0) {
      const lastIdx = list[list.length - 1];
      const last = nodi[lastIdx];
      const lastLogic = flow.nodes[lastIdx];
      const lastIsIf = lastLogic && lastLogic.type === "if";
      // BUG N2/N3 (review Fable, 2026-07-04 notte-4): un ciclo (While/For/Do) ultimo
      // nodo di un ramo IF va trattato come "a diramazione" quanto un IF interno, non
      // come un nodo normale: il tipo dell'arco che lo collega al join deve essere
      // 'loop_exit' (non 'normal'), cosi' inserisciNodo/moveNode sanno che vanno ad
      // aggiornare next.false (oggetto) del ciclo invece di sovrascriverlo con una
      // stringa (B1/N3 -- altrimenti il nuovo nodo restava orfano, mai collegato).
      const lastIsLoop = lastLogic && isBranchingNodeType(lastLogic.type) && lastLogic.type !== "if";
      // Punto di USCITA del ramo: fondo del nodo, oppure la RICONGIUNZIONE se l'ultimo
      // e' un IF interno (il collegamento parte da SOTTO la sua struttura, non dal box).
      // Per un ciclo, invece, il punto di uscita e' semplicemente il fondo dell'esagono
      // (diaBottom), esattamente come per un nodo normale: reconnectPxY di un ciclo
      // rappresenta il fondo del CORPO (per il back-edge), non un punto di uscita.
      // P6.1 fix (round 15-B S6, Ismail 2026-07-15, segnalato dopo test a mano: "il gap non
      // c'e' se annidi un if in un altro if o in un ciclo"): quando lastIsIf, questo fromY E'
      // il pallino di ricongiunzione dell'IF interno (stesso punto di drawIfBranches,
      // reconnectY) -- l'arco che parte da qui verso il basso e' esattamente "l'arco che esce
      // sotto il pallino" del P6.1 originale, solo disegnato dall'ANTENATO invece che dall'IF
      // interno stesso (per via del guard hasSoleBranchAncestor, che nell'IF interno
      // disabilita il proprio if_join proprio perche' ci pensa questo posto). Stesso
      // JOIN_DOT_GAP_PX applicato qui, altrimenti il gap "sparisce" in ogni caso annidato.
      const fromY = (lastIsIf && typeof last.reconnectPxY === "number")
        ? last.reconnectPxY - NODE_BASE_HEIGHT_PX / 2 + JOIN_DOT_GAP_PX
        : last.relY * h + last.height / 2;
      // Cliccabile per inserire dopo l'ultimo. Se l'ultimo del ramo e' un IF annidato,
      // questo segmento e' IN REALTA' l'arco di ricongiunzione (if_join) di quell'IF
      // interno: l'IF interno stesso non lo disegna (la sua ricongiunzione e' su
      // un'altra colonna, condivisa con questo antenato, vedi sotto), quindi va
      // registrato qui con tipo 'if_join' (non 'normal') perche' inserisciNodo/
      // moveNode sappiano redirigere correttamente next.true/next.false dell'IF
      // interno invece di lasciarlo scollegato. Bug segnalato da Ismail: l'arco dopo
      // la fine di un IF annidato non risultava cliccabile. Stesso discorso per
      // 'loop_exit' quando l'ultimo e' un ciclo (vedi sopra).
      // FIX round-4h (Ismail 2026-07-06, "questo non allunga bene altro arco nel while
      // e for" -- errore quando si inserisce un blocco in un ciclo che contiene un IF
      // come ultimo membro del corpo): quando QUESTO if e' a sua volta l'ultimo membro
      // del corpo di un ciclo/if antenato (hasSoleBranchAncestor), il vero punto di
      // inserimento "dopo l'intero if" e' l'arco UNIFICATO che l'antenato stesso
      // disegna (tipo 'loop_body_end'/'if_join', from=ifIdx) -- ESATTAMENTE sovrapposto
      // in schermo a QUESTI due segmenti di coda per-ramo (uno per true, uno per false).
      // Lasciandoli entrambi cliccabili creava TRE bersagli sovrapposti nello stesso
      // punto: cliccando uno dei due per errore (invece dell'arco unificato
      // dell'antenato), inserisciNodo aggiornava SOLO quel ramo, lasciando l'ALTRO ramo
      // ancora puntato al vecchio target -- un ramo "si allungava", l'altro no, esatto
      // sintomo segnalato. Poiche' l'antenato disegna gia' l'arco corretto per questo
      // caso, i due segmenti di coda per-ramo diventano NON cliccabili qui (restano
      // visibili, solo non selezionabili), eliminando l'ambiguita'.
      // FIX (Ismail 2026-07-07, "non mi fa selezionare la parte di arco sotto il print per
      // mettere roba"): il guard round-4h (!hasSoleBranchAncestor) disabilitava l'arco
      // "dopo l'ultimo nodo del ramo" ANCHE quando il ramo ha contenuto e l'ultimo nodo e'
      // SEMPLICE -- rendendo impossibile inserire un blocco dopo, es. dopo un Print, quando
      // l'IF e' annidato (unico membro del corpo di un ciclo/altro IF). Ma la coda di un
      // nodo semplice sta sulla COLONNA del contenuto (trueX/falseX, spostata dal centro),
      // NON sovrapposta all'arco unificato dell'antenato (che sta al centro): nessuna
      // ambiguita'. L'ambiguita' di round-4h riguardava solo code che convergono al centro,
      // cioe' quando l'ultimo nodo e' a sua volta un IF/ciclo (if_join/loop_exit): per quei
      // casi si tiene il guard. Per un ultimo nodo semplice l'arco torna sempre cliccabile.
      // FIX (Ismail 2026-07-07, errorrreee.json: "non posso cliccare dopo il while nel ramo
      // dell'if per inserire nodi"): il fix precedente riabilitava l'arco "dopo l'ultimo"
      // solo per un ultimo nodo SEMPLICE; un CICLO come ultimo membro restava bloccato. Ma
      // la coda di un ciclo (loop_exit) sta sulla COLONNA del ramo (spostata dal centro),
      // NON sovrapposta all'arco unificato dell'antenato (al centro): nessuna ambiguita',
      // esattamente come per un nodo semplice. Si riabilita quindi anche per i cicli;
      // resta guardato solo il caso di un IF annidato come ultimo membro (afterLastArcType
      // 'if_join', l'unico che nel caso originale round-4h poteva convergere al centro).
      // Do-While come ultimo membro: la sua uscita e' in BASSO (esagono sotto il corpo,
      // geometria capovolta), quindi la coda 'loop_exit' cade vicino alla ricongiunzione,
      // dove si sovrappone davvero all'arco unificato dell'antenato (Test 40a / round-4h) --
      // per lui si TIENE il guard. While/For hanno invece l'uscita chiaramente spostata
      // sulla colonna del ramo: la loro coda e' distinguibile, quindi resta cliccabile
      // (errorrreee.json: inserire dopo un While nel ramo di un IF annidato).
      // FIX (Ismail 2026-07-08, adasdas.json: "non e' cliccabile l'arco sotto il do-while
      // dell'if annidato"): la coda 'loop_exit' di un Do-While ultimo membro di un ramo IF
      // sta sulla COLONNA del ramo (last.relX*w = sideX), come While/For -- distinta
      // dall'arco unificato dell'antenato (al CENTRO dell'if, colonna diversa). Il guard
      // che la rendeva non cliccabile (per timore di sovrapposizione con l'arco unificato,
      // round-4h) era troppo conservativo: nessuna sovrapposizione reale del segmento
      // CLICCABILE (verticale sulla colonna del ramo). Ora un Do-While ultimo membro e'
      // cliccabile esattamente come While/For -> si puo' inserire dopo di lui nel ramo.
      // FIX P4.1 (Ismail 2026-07-14, "arco dopo if figlio piu interno non e' cliccabile"):
      // rimosso anche l'ultimo residuo del guard round-4h (l'IF annidato come ultimo membro).
      // La premessa "la sua coda converge al CENTRO cx (dove sta l'arco unificato dell'antenato)"
      // era sbagliata quanto lo era per i cicli: il segmento CLICCABILE va da (last.relX*w, fromY)
      // a (sideX, reconnectY), e last.relX*w e' il CENTRO dell'IF interno -- che COINCIDE con
      // sideX (l'IF interno sta centrato nella COLONNA del ramo trueX/falseX), NON col centro cx
      // dell'IF esterno. Nessuna sovrapposizione reale del tratto cliccabile con l'arco unificato
      // dell'antenato (che sta sulla colonna centrale, a un'altra reconnectY): stessa identica
      // giustificazione gia' accettata sopra per While/For/Do-While ultimi membri. Il guard mordeva
      // in un caso reale: con >=3 IF annidati "figlio unico" (ognuno unico membro del ramo del
      // padre) la delega all'antenato si INCATENAVA fino all'IF piu' esterno -- l'antenato
      // disegna "dopo <IF di mezzo>", MAI "dopo <IF interno>", posizionato a un'altra reconnectY --
      // lasciando l'IF piu' interno SENZA alcun arco "dopo" cliccabile. L'inserimento if_join
      // redirige comunque ENTRAMBI i rami dell'IF interno (interaction.js: redirectBranchToNew su
      // true E false), quindi resta impossibile il sintomo round-4h "un ramo si allunga, l'altro no".
      const canInsertAfter = sub.joinIndex !== null;
      const afterLastArcType = lastIsIf ? 'if_join' : (lastIsLoop ? 'loop_exit' : 'normal');
      drawLine(
        last.relX * w, fromY,
        sideX, reconnectY,
        canInsertAfter, lastIdx, sub.joinIndex, afterLastArcType
      );
      // FIX round-4q: se l'arco "dopo l'ultimo nodo" e' davvero cliccabile, e' lui il
      // punto di inserimento "sotto" per un ramo popolato -- gli si aggancia il ponte
      // (vedi sotto), cosi' hover/click evidenzia INSIEME lo stelo verticale e il ponte
      // orizzontale, tutta la "parte libera" fino alla ricongiunzione.
      if (canInsertAfter) {
        bridgeOwnerArc = frecce[frecce.length - 1];
      }
    }
    // FIX round-4o (Ismail, "negli if vorrei che archi orizzontali in basso avessero
    // entrambi una punta che converge in un punto, cosi' da dare meglio idea dell'if,
    // quindi ->*<-"): questo ponte orizzontale e' chiamato una volta per ramo (sideX =
    // trueX o falseX), SEMPRE verso lo stesso punto centrale (cx, reconnectY) -- basta
    // aggiungere la punta qui perche' entrambe le chiamate convergano visivamente nello
    // stesso punto, ciascuna con la punta orientata correttamente verso il centro (la
    // direzione la calcola comunque drawArrowhead dal vettore del segmento stesso, mai
    // a mano). Resta non cliccabile (salva=false): e' solo un raccordo visivo, non un
    // punto di inserimento.
    // R13-G (Ismail 2026-07-12, "->*<- le frecce si sovrappongono troppo al pallino"):
    // accorcia il ponte di JOIN_DOT_GAP px PRIMA di raggiungere (cx, reconnectY) -- l'estremo
    // resta sul lato corretto (sideX <= cx: si viene da sinistra, ci si ferma un po' prima di
    // cx; sideX > cx: da destra, ci si ferma un po' dopo cx), la PUNTA resta orientata uguale
    // (drawArrowhead la calcola dal vettore del segmento, che non cambia direzione, solo
    // lunghezza). Stesso identico endX va nel visualExtra subito sotto -- altrimenti hover/
    // hit-test (arcHitTest, interaction.js) userebbero ancora il vecchio endpoint non
    // accorciato, disallineati dal segmento REALMENTE disegnato.
    // JOIN_DOT_GAP_PX (state.js, P6.1): costante globale, la STESSA usata anche dall'arco di
    // uscita sotto il pallino (vedi piu' sotto, dopo drawBranchConnections) e da
    // drawLoopBranches/drawDoWhileBranches per il caso "IF annidato ultimo membro".
    const bridgeEndX = (sideX <= cx) ? (cx - JOIN_DOT_GAP_PX) : (cx + JOIN_DOT_GAP_PX);
    drawLine(sideX, reconnectY, bridgeEndX, reconnectY, false, null, null, null, null, true);
    // FIX round-4q: aggancia il ponte appena disegnato come visualExtra dell'arco
    // proprietario (vedi sopra) -- hover/drag (punti 5/6 di draw()) lo ridisegnano
    // insieme allo stelo verticale, arrowhead incluso (5o elemento della tupla = true).
    if (bridgeOwnerArc) {
      bridgeOwnerArc.visualExtra = (bridgeOwnerArc.visualExtra || []).concat([[sideX, reconnectY, bridgeEndX, reconnectY, true]]);
    }
  }

  drawBranchConnections(sub.trueList, trueX, trueEmptyArc);
  drawBranchConnections(sub.falseList, falseX, falseEmptyArc);

  // FIX round-4o (Ismail, "negli if vorrei che archi orizzontali in basso avessero
  // entrambi una punta che converge in un punto... quindi ->*<-"): oltre alle due
  // punte (disegnate dai due drawLine sopra, una per ramo, entrambe verso questo
  // stesso punto), un piccolo pallino pieno segna ESATTAMENTE il punto di
  // convergenza, per rendere immediato a colpo d'occhio che i due rami si
  // ricongiungono qui -- il "*" al centro di "->*<-".
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, reconnectY, 3, 0, Math.PI * 2);
  ctx.fillStyle = themeCanvasLineColor();
  ctx.fill();
  ctx.restore();

  // Arco dal punto di ricongiunzione al nodo di join. Se il join e' "proprio" di questo
  // IF (stessa colonna, direttamente sotto), verticale diretta. FIX M5 (review Fable,
  // 2026-07-04 notte-6): se il join sta su un'altra colonna (condiviso con un
  // contenitore), prima si assumeva che un antenato l'avrebbe sempre ricongiunto -- ma
  // quando la catena di nesting risale attraverso il corpo di un WHILE (che non ha un
  // meccanismo di bridge equivalente a drawBranchConnections per i membri non-ultimi
  // del corpo), nessun livello finiva mai allineato: l'arco restava "a meta'", nella
  // colonna dell'IF, senza mai raggiungere il nodo reale ("finisce nel vuoto"). Fix:
  // completare SEMPRE qui con un gomito (verticale nella colonna dell'IF fino a
  // reconnectY -- gia' fatto sopra come stelo --, poi orizzontale di raccordo fino alla
  // colonna REALE del join, poi verticale fino al nodo), marcando cliccabile SOLA la
  // tratta finale che tocca il nodo reale (principio "un solo proprietario" gia' in uso
  // altrove: la tratta orizzontale di raccordo resta non cliccabile).
  // FIX BUG 1 (Ismail 2026-07-07, "archi che si sovrappongono quando metti un If dentro
  // al Do"): quando QUESTO if e' l'ultimo membro del corpo di un ciclo/if antenato
  // (hasSoleBranchAncestor), la ricongiunzione "dopo l'intero if" e' gia' disegnata
  // dall'antenato -- per un Do-While e' l'arco 'loop_body_end' che scende dal punto di
  // ricongiunzione dell'if (reconnectY) fino alla cima dell'esagono "Do:" (sotto). Il
  // guard `!hasSoleBranchAncestor(ifIdx)` esisteva SOLO sul ramo a colonna disallineata
  // (else if), non su quello a colonna allineata (joinX===cx). Ma per un If dentro un
  // Do-While il join (il nodo "do" stesso) sta SEMPRE nella stessa colonna, quindi si
  // cadeva sempre nel primo ramo, e `entryTopY(do)` restituisce la CIMA DEL CORPO
  // (doBodyTopPxY, il punto d'ingresso in ALTO, y=68) -- l'arco if_join partiva quindi da
  // reconnectY (sotto i due rami) e risaliva DRITTO fino in cima, tagliando l'intero If e
  // i suoi rami. Estendendo il guard anche al ramo allineato, l'If non disegna piu' quel
  // join spurio: ci pensa l'antenato con l'arco (corretto, verso il basso) che gia'
  // disegna. Stesso principio gia' applicato a canInsertAfter/afterLastArc in
  // drawBranchConnections (round-4h).
  if (sub.joinIndex !== null && nodi[sub.joinIndex] && !hasSoleBranchAncestor(ifIdx)) {
    const joinNode = nodi[sub.joinIndex];
    const joinX = joinNode.relX * w;
    const joinTop = entryTopY(sub.joinIndex);
    // P6.1 (round 15-B S6, Ismail 2026-07-15): stesso gap del pallino (JOIN_DOT_GAP, R13-G)
    // applicato anche all'arco che ESCE sotto il pallino -- prima partiva ESATTAMENTE dal suo
    // centro (cx, reconnectY), sovrapponendosi visivamente come gia' successo (e gia' corretto
    // da R13-G) per le due frecce orizzontali che vi convergono dall'alto. Gap solo visivo
    // (nessun segmento disegnato nei JOIN_DOT_GAP px, come i ponti orizzontali sopra): 5px sono
    // ben dentro la tolleranza di hit-test (ARC_TOL 8-14px, isPointNearAnyLineSegment fa
    // distanza punto-segmento CLAMPATA, interaction.js/utils.js), quindi click/hover appena
    // sopra il nuovo inizio del segmento continuano a colpire l'arco -- hit-test/cliccabilita'
    // invariati, come richiesto.
    if (Math.abs(joinX - cx) < 1) {
      drawLine(cx, reconnectY + JOIN_DOT_GAP_PX, cx, joinTop, true, ifIdx, sub.joinIndex, 'if_join', null, true);
    } else {
      // Caso disallineato: il gomito orizzontale (non cliccabile, come sopra) parte anch'esso
      // un po' scostato dal pallino, verso joinX -- stessa logica direzionale di bridgeEndX.
      const elbowStartX = (joinX >= cx) ? (cx + JOIN_DOT_GAP_PX) : (cx - JOIN_DOT_GAP_PX);
      drawLine(elbowStartX, reconnectY, joinX, reconnectY, false);
      drawLine(joinX, reconnectY, joinX, joinTop, true, ifIdx, sub.joinIndex, 'if_join', null, true);
    }
  }

  // Etichette T/F sopra la biforcazione
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = cssVar('--if-true-color', IF_LABEL_TRUE_COLOR);
  // S3 P8.4: "True"/"False" tradotte (prima hard-coded in inglese), vedi i18nLabel/state.js.
  ctx.fillText((typeof i18nLabel === 'function') ? i18nLabel('label_true', 'True') : 'True', (cx + trueX) / 2, forkY - 10);
  ctx.fillStyle = cssVar('--if-false-color', IF_LABEL_FALSE_COLOR);
  ctx.fillText((typeof i18nLabel === 'function') ? i18nLabel('label_false', 'False') : 'False', (cx + falseX) / 2, forkY - 10);
}

// Disegna un ciclo (While/For/Do). GEOMETRIA RIVISTA (2026-07-04 notte-2, richiesta
// di Ismail via screenshot di riferimento + review di Fable, sostituisce la prima
// versione "corpo in colonna, corridoio a sinistra"): il corpo sta a DESTRA, come il
// ramo true di un IF (stelo orizzontale non cliccabile dal vertice destro dell'esagono,
// poi verticale cliccabile 'loop_body' verso il basso); l'uscita (next.false) e'
// DRITTA in giu nella colonna principale (arco cliccabile 'loop_exit' dal fondo
// dell'esagono); il back-edge e' una polilinea stretta (15px) appena a fianco della
// verticale di uscita, NON cliccabile (vedi DECISIONS: l'aritmetica di inserimento
// "all'indietro" non e' generalizzata in questa prima versione).
//
// Mappa di cliccabilita' (fissata esplicitamente da Ismail, NON cambiare senza chiedere):
//   verticale colonna corpo (ingresso/placeholder corpo vuoto)  -> SI, tipo loop_body
//   verticale sotto il nodo (uscita -> nodo successivo)         -> SI, tipo loop_exit
//   back-edge (l'intera polilinea di ritorno)                   -> NO
//   stelo orizzontale verso la colonna del corpo                -> NO
function drawLoopBranches(loopIdx, node) {
  const body = collectLoopBody(loopIdx);
  const cx = node.relX * w;
  const cy = node.relY * h;
  const diaRight = cx + node.width / 2;
  const diaBottom = cy + node.height / 2;
  // Colonna del corpo: SE il corpo non e' vuoto, la X REALE del primo nodo del corpo
  // (nodi[...].relX*w) -- stesso principio gia' in uso per trueX/falseX di un IF
  // (drawIfBranches), mai una colonna memorizzata separatamente. BUG N5 (review Fable,
  // 2026-07-04 notte-4): prima si usava SEMPRE `node.bodyColX` (un valore calcolato e
  // salvato dal LAYOUT, node.bodyColX = centerX + offset), invece della posizione VERA
  // del nodo -- i due dovrebbero coincidere per costruzione, ma sono comunque due fonti
  // di verita' separate (scrivi-e-fidati-della-cache) invece di una sola (interroga la
  // posizione reale): esattamente il pattern fragile segnalato dalla review ("gli archi
  // devono derivare le X dalle posizioni reali dei nodi, mai da colonne memorizzate").
  // Se il corpo e' vuoto non c'e' un nodo reale da interrogare: si usa il valore del
  // layout (o il fallback fisso) solo in quel caso, per il placeholder self-loop.
  // FIX P2 (review Fable, 2026-07-05 pomeriggio, piano nested-while-visuals): il fallback
  // per corpo VUOTO usava `w/2 + node.bodyColX`, assumendo che l'origine del grafo fosse
  // sempre al centro esatto del canvas (originOffsetPx === w/2) -- vero solo per un grafo
  // simmetrico attorno a pxX=0. Con catene di cicli annidati (contenuto sbilanciato a
  // destra) l'origine reale si sposta, quindi l'errore cresceva con la profondita' di
  // annidamento (colonna del placeholder alla deriva, +60px/livello circa). Fix: usare
  // `node.bodyColXRel` (frazione gia' corretta per l'origine reale, calcolata una sola
  // volta in resizeCanvasToFitNodes con la STESSA formula di relX), non piu' il valore
  // px assoluto grezzo del layout riconvertito con un'assunzione di simmetria.
  const bodyColX = body.bodyList.length
    ? nodi[body.bodyList[0]].relX * w
    : ((typeof node.bodyColXRel === 'number') ? (node.bodyColXRel * w) : (cx + LOOP_BODY_X_OFFSET_PX));

  // --- Corpo A DESTRA: stelo orizzontale NON cliccabile dal vertice destro
  // dell'esagono fino alla colonna del corpo, poi verticale CLICCABILE (loop_body). ---
  drawLine(diaRight, cy, bodyColX, cy, false);
  // FIX round-4q (Ismail 2026-07-06, "stessa cosa con i cicli" -- riferito alla stessa
  // richiesta gia' applicata all'IF: hover/click sull'arco 'loop_body' evidenziava solo
  // il tratto verticale, mai questo stelo orizzontale d'ingresso, anche se insieme
  // formano un'unica "parte libera" continua fino alla colonna del corpo). Si tengono le
  // coordinate per agganciarle, poco sotto, come visualExtra all'arco 'loop_body' giusto
  // (placeholder vuoto o primo nodo reale) -- il disegno vero e proprio resta qui sopra,
  // visualExtra serve SOLO a farlo ridisegnare nel colore di evidenziazione su hover/drag.
  const entryStemSeg = [diaRight, cy, bodyColX, cy, false];

  let bodyBottomY; // Y del punto piu' basso del corpo (da cui riparte il back-edge)
  let lastBodyIdx = null; // indice dell'ultimo nodo del corpo (null se corpo vuoto)
  // FIX round-3: flag hoistato per sapere, al momento di calcolare il gap del back-edge
  // (fuori dal blocco else), se l'ultimo membro del corpo e' un Do-While -- nel qual caso
  // la sua etichetta "False" sta subito sotto l'esagono e il back-edge va abbassato di piu'.
  let lastMemberIsDoWhile = false;
  // FIX round-3b: punto di partenza VISIVO dello stub del back-edge (bordo reale del
  // figlio), distinto da bodyBottomY (livello a cui il back-edge AVVOLGE il sottoalbero).
  let stubTopY = null;
  // FIX round-4j: riferimento (impostato sotto, solo per corpo vuoto) all'arco
  // cliccabile del placeholder, per agganciargli i segmenti visivi del "ritorno".
  let emptyBodySelfLoopArc = null;
  if (body.bodyList.length === 0) {
    // Corpo vuoto: arco placeholder verso il basso, cliccabile come self-loop
    // (fromNodeIndex === toNodeIndex === loopIdx), spazio riservato per il primo
    // inserimento (vedi isLoopSelfBodyInsert in interaction.js).
    bodyBottomY = cy + LOOP_EMPTY_BODY_LEN_PX;
    drawLine(bodyColX, cy, bodyColX, bodyBottomY, true, loopIdx, loopIdx, 'loop_body');
    // FIX round-4q: lo stelo orizzontale d'ingresso (esagono -> colonna del corpo) e'
    // parte della stessa "regione libera" di questo placeholder -- lo si aggancia qui
    // come primo elemento di visualExtra (gli altri, del "ritorno", si aggiungono piu'
    // sotto quando backEdgeGapY/backEdgeX sono disponibili).
    frecce[frecce.length - 1].visualExtra = [entryStemSeg];
    // FIX round-4j: riferimento all'arco appena pushato in frecce[], per potergli
    // agganciare (piu' sotto, quando backEdgeGapY/backEdgeX sono disponibili) i
    // segmenti SOLO visivi del "ritorno" del placeholder (vedi visualExtra/drawLine).
    emptyBodySelfLoopArc = frecce[frecce.length - 1];
  } else {
    drawLine(bodyColX, cy, bodyColX, entryTopY(body.bodyList[0]), true, loopIdx, body.bodyList[0], 'loop_body', null, true);
    // FIX round-4q: stesso aggancio del caso corpo vuoto sopra -- lo stelo orizzontale
    // d'ingresso e' parte della stessa "regione libera" dell'arco 'loop_body' che porta
    // al primo nodo reale del corpo.
    frecce[frecce.length - 1].visualExtra = [entryStemSeg];

    // Collegamenti interni fra nodi consecutivi del corpo.
    for (let i = 0; i < body.bodyList.length - 1; i++) {
      // Se il nodo e' a sua volta un IF o un ciclo annidato, il suo collegamento verso
      // l'esterno e' gia' gestito da se stesso (join/uscita propria): non duplicarlo qui.
      const curType = flow.nodes[body.bodyList[i]] && flow.nodes[body.bodyList[i]].type;
      if (curType === "if" || (isBranchingNodeType(curType) && curType !== "if")) continue;
      const fromNode = nodi[body.bodyList[i]];
      const toNode = nodi[body.bodyList[i + 1]];
      drawLine(
        fromNode.relX * w, fromNode.relY * h + fromNode.height / 2,
        toNode.relX * w, entryTopY(body.bodyList[i + 1]),
        true, body.bodyList[i], body.bodyList[i + 1], 'normal', null, true
      );
    }

    const lastIdx = body.bodyList[body.bodyList.length - 1];
    const last = nodi[lastIdx];
    const lastLogic = flow.nodes[lastIdx];
    // FIX BUG 2 (segnalato da Ismail 2026-07-05 sera, screen 1 "while in while" rotto,
    // riprodotto anche per altre combinazioni di tipo ciclo): quando l'ultimo nodo del
    // corpo e' un IF annidato, reconnectPxY e' il suo punto di ricongiunzione (SOTTO
    // tutto il sottoalbero, nella STESSA colonna) -- riferimento corretto per "fondo
    // della struttura". Ma quando l'ultimo nodo del corpo e' invece un CICLO annidato,
    // reconnectPxY rappresenta il fondo del SUO PROPRIO corpo (che vive a DESTRA, in
    // un'altra colonna -- geometria v2, corpo mai sotto) -- NON il fondo visivo del
    // ciclo come unita' (che e' invece il fondo del suo esagono, dato che corpo e
    // back-edge di un ciclo si sviluppano lateralmente, non sotto). Usare reconnectPxY
    // anche per un ciclo interno faceva partire l'arco di chiusura dell'ESTERNO da una
    // Y arbitraria (il fondo del corpo INTERNO, potenzialmente molto piu' in basso/alto
    // del vero bordo dell'esagono interno) nella colonna giusta ma a una quota sbagliata
    // -- il segmento tagliava dritto attraverso l'esagono/back-edge del ciclo interno.
    // drawIfBranches/drawBranchConnections gia' faceva correttamente questa distinzione
    // (lastIsIf vs lastIsLoop, vedi 'fromY' li') per un ciclo ultimo-di-RAMO-IF: stesso
    // fix applicato qui per l'analogo caso ciclo-ULTIMO-DI-CORPO-DI-CICLO, mai coperto
    // prima (il While era stato testato annidato in rami IF, non nel corpo di un altro
    // While/For/Do-While).
    const lastIsIf = lastLogic && lastLogic.type === "if";
    // FIX P3 (review Fable, 2026-07-05 pomeriggio, piano nested-while-visuals): il fix
    // BUG 2 usava il fondo NUDO dell'esagono (last.relY*h+last.height/2) per QUALUNQUE
    // ciclo ultimo-del-corpo, assumendo che corpo/back-edge di un ciclo si sviluppino
    // sempre "lateralmente, non sotto" -- vero SOLO se quel ciclo non ha a sua volta
    // nesting profondo. Con CATENE di cicli (es. while1.body=[while2],
    // while2.body=[while3], ...) questo faceva collassare il back-edge dell'ESTERNO in
    // un rettangolino appena sotto il proprio esagono, invece di avvolgere l'intero
    // sottoalbero che si estende molto piu' in basso (il corpo del ciclo interno, per
    // quanto "a destra", cresce comunque in basso via layoutNode ricorsivo). Fix:
    // `last.reconnectPxY` per un ciclo e' il fondo del SUO corpo (v.reconnectPxY =
    // bodyBottom in layout.js) -- un valore che CASCATA ricorsivamente la profondita' di
    // ogni ulteriore nesting al suo interno (bodyBottom di un ciclo e' sempre >= bottom
    // del proprio esagono, per costruzione: bodyTop = bottom+offset, poi solo crescente),
    // quindi non "taglia mai attraverso" l'esagono interno (a differenza del timore
    // originale del fix BUG 2) -- lo usiamo anche qui, analogamente al ramo lastIsIf.
    const lastIsLoop = lastLogic && isBranchingNodeType(lastLogic.type) && lastLogic.type !== "if";
    // FIX round-2 P2 (piano 2026-07-06-nested-loops-round2): il ramo lastIsLoop sopra
    // (fix P3) usava `last.reconnectPxY` -- il reconnectPxY del FIGLIO -- assumendo che
    // fosse sempre "il fondo del suo corpo, quindi sempre sotto il proprio esagono".
    // Vero per While/For (corpo dopo l'esagono), ma INVERTITO per un Do-While (corpo
    // PRIMA dell'esagono, geometria capovolta: layout.js/layoutDoWhileNode) -- il suo
    // reconnectPxY sta vicino alla CIMA del proprio esagono, non al fondo. Se l'ultimo
    // membro del corpo di QUESTO ciclo e' un Do-While, `last.reconnectPxY` piazzava il
    // back-edge/loop_body_end DENTRO l'esagono del Do-While (la linea che taglia "Do:"
    // a meta', screenshot 3 del piano). Il valore CORRETTO esiste gia' e non va
    // ricostruito dal figlio: `node.reconnectPxY` (QUESTO ciclo, non l'ultimo membro) e'
    // gia' stato calcolato da layout.js (calcoloY/layoutNode, riga ~343) come il valore
    // di RITORNO dell'intera catena ricorsiva di layoutNode/layoutDoWhileNode sul corpo
    // -- che per costruzione e' SEMPRE il vero fondo (sotto l'ultimo membro, qualunque
    // sia il suo tipo: nodo semplice, IF, While/For, o Do-While capovolto), perche' e'
    // la stessa identica quantita' usata per posizionare il nodo SUCCESSIVO nel layout.
    // Elimina la classe di bug riapparsa 2 volte (BUG 2 storico -> P3 -> questo) con
    // un'euristica diversa ogni volta: si smette di ricostruire la geometria qui in
    // rendering, riusando il dato che layout.js ha gia' calcolato correttamente. Il
    // ramo lastIsIf/lastIsLoop storico resta solo come fallback difensivo se per
    // qualche motivo node.reconnectPxY non fosse ancora valorizzato.
    // FIX P8 (stesso bug di drawDoWhileBranches, vedi commento li' per la spiegazione
    // completa): il fast-path sopra si applica SOLO quando l'ultimo membro e' un ciclo
    // (lastIsLoop) -- per un nodo SEMPLICE, node.reconnectPxY eredita lo stesso "+height
    // invece di +height/2" del percorso generico "next===stopIdx" di layoutNode,
    // introducendo un gap vuoto/non cliccabile fra l'ultimo nodo del corpo e il back-edge.
    // FIX P10 (segnalato da Ismail: While con un Do-While a corpo vuoto come unico
    // membro, "Do:" scollegato dal seguito -- "non si aggancia correttamente al blocco/
    // arco dopo"): quando l'ultimo membro e' specificamente un DO-WHILE, ne'
    // `node.reconnectPxY` (valore di RITORNO della catena di layout, pensato per
    // incatenare un eventuale nodo SUCCESSIVO -- include un `LOOP_EXIT_GAP_PX` in piu'
    // che qui non serve, causa del gap di 60px misurato fra il vero fondo di "Do:" e
    // l'inizio dello stub) ne' `last.reconnectPxY` (fondo del SUO corpo, vicino alla
    // CIMA per un Do-While, invertito -- la causa storica di P2) sono corretti. Un
    // Do-While disegna pero' SEMPRE il proprio esagono DOPO il proprio corpo (geometria
    // capovolta): il bordo inferiore del suo esagono e' quindi SEMPRE il punto piu'
    // basso dell'intera sua struttura, per costruzione -- niente da ricostruire da
    // reconnectPxY di alcun tipo, lo stesso calcolo diretto gia' usato per un nodo
    // semplice basta ed e' sempre esatto.
    const lastIsDoWhile = lastLogic && lastLogic.type === "do";
    lastMemberIsDoWhile = !!lastIsDoWhile;
    // FIX P12 (segnalato da Ismail, "foto 2": ciclo dentro un altro senza corpo che
    // sembra scollegato): quando l'ultimo membro del corpo e' un ciclo SEMPLICE
    // (While/For, non Do-While) il cui PROPRIO corpo e' VUOTO, `node.reconnectPxY`/
    // `last.reconnectPxY` non sono il vero bordo inferiore visivo di quel ciclo -- sono
    // un valore "ancora per il prossimo elemento della catena" (bodyTop del corpo vuoto
    // + LOOP_EMPTY_BODY_LEN_PX + LOOP_EXIT_GAP_PX, ~125px) calcolato da layout.js per
    // motivi di concatenamento, non per disegnare un arco che tocchi il bordo del ciclo.
    // Il problema si amplifica (e diventa visibile) quando il corpo di QUESTO contenitore
    // ha PIU' DI UN membro e un membro NON ultimo e' a sua volta un ciclo: la scansione
    // esplicita di `body.bodyList` in layout.js e il meccanismo di `exitIndex` di quel
    // membro si sovrappongono (l'exitIndex del primo ciclo "consuma" gia' il fratello
    // successivo), quindi il valore che risale come reconnectPxY del CONTENITORE
    // corrisponde al "prossimo-anchor" del PRIMO ciclo, non al vero bordo dell'ULTIMO --
    // ma anche col caso piu' semplice (un solo ciclo semplice a corpo vuoto come UNICO
    // membro) il valore era gia' sistematicamente troppo basso, semplicemente mai
    // notato prima (P9/P10 testavano solo casi con un Do-While coinvolto, che ha il
    // proprio bypass diretto qui sotto). Un ciclo semplice a corpo VUOTO non ha nulla
    // che si estenda oltre il proprio esagono nella colonna condivisa (il suo corpo
    // vuoto e' solo uno stub laterale, mai sotto) -- il vero bordo e' quindi sempre e
    // solo `last.relY*h + last.height/2`, stesso principio di lastIsDoWhile.
    // FIX round-4k (Ismail 2026-07-06, indagine sul JSON "erorre.json" per il report
    // "misure sbagliate quando si mettono blocchi in un ciclo, non allunga bene
    // l'altro arco nel while e for"): il commento del fix P12 (sopra) concludeva GIA'
    // correttamente che "il vero bordo [quando l'ultimo membro e' un ciclo semplice]
    // e' SEMPRE E SOLO last.relY*h+last.height/2" -- ma il codice applicava quella
    // conclusione SOLO al caso "corpo dell'ultimo ciclo vuoto"
    // (lastIsEmptyBodySimpleLoop), lasciando il ramo node.reconnectPxY/last.reconnectPxY
    // per il caso "corpo non vuoto". node.reconnectPxY (di QUESTO contenitore) e' un
    // valore di CONCATENAMENTO (dove va posizionato il prossimo fratello DOPO l'intero
    // corpo, comprese le profondita' di qualunque nesting dentro l'ultimo ciclo) --
    // corretto per il LAYOUT (posizionare cio' che segue), ma concettualmente
    // sbagliato come punto di partenza VISIVO del back-edge del CONTENITORE, che deve
    // solo avvolgere il box dell'ultimo ciclo (il suo corpo vive SEMPRE in una colonna
    // scostata a destra in questa geometria, mai sotto, esattamente come nel caso
    // vuoto gia' risolto da P12 -- la profondita' del corpo non vuoto non incide
    // quindi mai su questa colonna). NOTA IMPORTANTE (evitare falsi allarmi in
    // futuro): un primo controllo su erorre.json sembrava mostrare archi che
    // attraversavano nodi estranei (arcCrossesForeignNode non vuoto) -- indagando si
    // e' rivelato un bug nello STRUMENTO di verifica (usava una larghezza/altezza
    // canvas fissa invece di interrogare le dimensioni reali, ricalcolate da
    // resizeCanvasToFitNodes in base al contenuto): con le dimensioni reali,
    // erorre.json risultava GIA' pulito (0 violazioni) anche PRIMA di questo fix. Il
    // fix resta comunque corretto e utile di per se' (elimina un ramo concettualmente
    // fragile mai piu' necessario, verificato senza regressioni sull'intera suite),
    // ma non era la causa della "misura sbagliata" originale del report -- quella era
    // gia' risolta da round-4h (le tre frecce ambigue sullo stesso punto di merge, che
    // se cliccate per errore corrompevano i puntatori .next producendo visivamente
    // "archi che vanno nel posto sbagliato"). drawDoWhileBranches (sotto in questo
    // file) usa gia' SEMPRE last.relY*h+last.height/2 per lastIsLoop, senza
    // distinzione vuoto/pieno: stesso trattamento generalizzato qui, per coerenza ed
    // eliminando i due rami reconnectPxY per i cicli (mai necessari nella geometria
    // attuale, dove il corpo di un ciclo vive sempre in una colonna diversa).
    if (lastIsDoWhile || lastIsLoop) {
      bodyBottomY = last.relY * h + last.height / 2;
    } else if (lastIsIf && typeof last.reconnectPxY === "number") {
      bodyBottomY = last.reconnectPxY - NODE_BASE_HEIGHT_PX / 2;
    } else {
      bodyBottomY = last.relY * h + last.height / 2;
    }
    // FIX round-3b (Ismail: "con 3+ cicli annidati, corpo = un solo ciclo e nient'altro,
    // nessuno si collega; aggiungendo un nodo qualsiasi si ricollegano"): lo stub del
    // back-edge deve PARTIRE dal bordo inferiore reale dell'ultimo membro (esagono per un
    // ciclo, box per un nodo, ricongiunzione per un IF), non dal livello di avvolgimento
    // bodyBottomY -- che per un ciclo annidato NON vuoto e' il fondo dell'INTERO
    // sottoalbero, in una colonna (quella del figlio) che li' e' VUOTA (il corpo del figlio
    // sta a lato): lo stub partiva quindi molto sotto l'esagono del figlio, galleggiando
    // scollegato. Con un secondo membro qualsiasi il tratto veniva colmato dall'uscita di
    // quel membro -- da qui l'osservazione di Ismail. bodyBottomY resta il livello di
    // AVVOLGIMENTO (fineY dello stub), stubTopY diventa il punto di CONNESSIONE (inzioY).
    // P6.1 fix (round 15-B S6, Ismail 2026-07-15): stesso motivo di drawBranchConnections/
    // fromY sopra -- quando lastIsIf, questo e' il pallino di ricongiunzione dell'IF interno
    // (ultimo membro del corpo di QUESTO ciclo): l'arco 'loop_body_end' che parte da qui e'
    // "l'arco che esce sotto il pallino" del P6.1, disegnato dal ciclo antenato. Stesso
    // JOIN_DOT_GAP_PX (state.js), altrimenti nessun gap visibile in questo caso annidato.
    stubTopY = (lastIsIf && typeof last.reconnectPxY === "number")
      ? last.reconnectPxY - NODE_BASE_HEIGHT_PX / 2 + JOIN_DOT_GAP_PX
      : last.relY * h + last.height / 2;
    lastBodyIdx = lastIdx;
  }

  // --- Back-edge: dal fondo del corpo, giu' di un piccolo gap (SEGMENTO CLICCABILE,
  // tipo 'loop_body_end', se il corpo non e' vuoto -- BUG N1, review Fable 2026-07-04
  // notte-4: prima di questo fix l'intero back-edge era salva=false, quindi non
  // esisteva NESSUN modo per inserire un nodo DOPO l'ultimo del corpo -- l'unico punto
  // di inserimento cliccabile restava l'arco 'loop_body' sopra il PRIMO nodo. Il target
  // e' all'INDIETRO (loopIdx < lastBodyIdx): l'aritmetica dedicata e' in inserisciNodo
  // (stesso pattern di isLoopSelfBodyInsert). Poi orizzontale verso sinistra fino a
  // cx+BACKEDGE_SEP_PX, poi su fino al fondo dell'esagono -- parallela e appena a
  // destra della verticale di uscita, questa parte resta NON cliccabile. ---
  let backEdgeX = cx + BACKEDGE_SEP_PX;
  // FIX round-3 (Ismail 2026-07-06): se l'ultimo membro del corpo e' un Do-While, la sua
  // etichetta "False" sta a diaBottom+12 subito sotto l'esagono, proprio dove passerebbe
  // la tratta orizzontale del back-edge con il gap normale -- si abbassa la curva
  // ("arco sotto piu' lungo") per non sovrapporre l'etichetta e rendere chiara la
  // connessione fra il Do-While interno e questo ciclo esterno.
  // FIX (Ismail 2026-07-08, "il while e il for si sovrappongono coi loro stessi archi"):
  // quando l'esagono CRESCE (condizione a testo lungo) diventa alto, e diaBottom scende
  // molto sotto cy. La riga orizzontale del back-edge (e la sua verticale a cx+SEP, che
  // cade DENTRO l'esagono largo) era ancorata a bodyBottomY, calcolato da cy + un gap
  // FISSO -- per un corpo VUOTO o corto restava SOPRA diaBottom, quindi tagliava l'esagono.
  // Si forza la riga del back-edge SEMPRE sotto il bordo inferiore reale dell'esagono
  // (diaBottom). Per un esagono di altezza base (tutti i 308 test) diaBottom+gap e' <=
  // bodyBottomY+gap, quindi il max sceglie il valore storico: nessuna regressione.
  const backEdgeGapY = Math.max(
    bodyBottomY + (lastMemberIsDoWhile ? LOOP_BACKEDGE_GAP_DOWHILE_PX : LOOP_BACKEDGE_GAP_PX),
    diaBottom + LOOP_BACKEDGE_GAP_PX
  );
  // FIX (Ismail 2026-07-08, file sd(1).json): la verticale del back-edge (fra diaBottom e
  // backEdgeGapY, a cx+SEP) veniva TAGLIATA da un nodo del corpo LARGO (es. un Print con testo
  // lungo, o il ramo di un If annidato) che sforava in quella colonna. Ora la colonna del
  // back-edge scansa iterativamente qualunque nodo la occupi in quella fascia verticale,
  // spostandosi a destra oltre di esso. I nodi di larghezza normale non contengono cx+SEP,
  // quindi il comportamento (e i 308 test) resta identico.
  {
    const _yT = Math.min(diaBottom, backEdgeGapY) + 2, _yB = Math.max(diaBottom, backEdgeGapY) - 2;
    const _band = [];
    for (let _bi = 0; _bi < nodi.length; _bi++) {
      if (_bi === loopIdx) continue; const _bn = nodi[_bi]; if (!_bn) continue;
      const _bt = _bn.relY * h - (_bn.height || NODE_BASE_HEIGHT_PX) / 2;
      const _bb = _bn.relY * h + (_bn.height || NODE_BASE_HEIGHT_PX) / 2;
      if (_bb > _yT && _bt < _yB) _band.push({ l: _bn.relX * w - (_bn.width || 100) / 2, r: _bn.relX * w + (_bn.width || 100) / 2 });
    }
    let _moved = true, _guard = 0;
    while (_moved && _guard++ < 60) { _moved = false; for (const _b of _band) { if (_b.l < backEdgeX + 1 && _b.r > backEdgeX - 1) { backEdgeX = _b.r + BACKEDGE_SEP_PX; _moved = true; } } }
  }
  // FIX M4 (review Fable, 2026-07-04 notte-6): quando l'ultimo nodo del corpo e'
  // branching (IF/ciclo annidato), il suo punto di ricongiunzione/uscita reale vive
  // nella SUA colonna (last.relX), che puo' NON coincidere con bodyColX (riservata per
  // il PRIMO nodo del corpo) -- disegnare comunque a bodyColX lasciava il segmento
  // cliccabile 'loop_body_end' una "parentesi" di ~15px scollegata da tutto (ne' dal
  // nodo ne' dalla polilinea del back-edge). Fix: X derivata dalla posizione REALE
  // dell'ultimo nodo del corpo (stessa regola N5: mai una colonna calcolata a parte),
  // usata per l'INTERA tratta verticale+orizzontale fino al back-edge, cosi' la linea
  // resta continua qualunque sia il tipo dell'ultimo nodo.
  const lastNodeReal = lastBodyIdx !== null ? nodi[lastBodyIdx] : null;
  const lastRealX = lastNodeReal ? lastNodeReal.relX * w : bodyColX;
  // FIX round-4p (Ismail, "deve colorarsi anche dove e' selezionato la punta arco
  // cicli"): riferimento all'arco cliccabile 'loop_body_end' appena pushato in
  // frecce[] (solo per corpo NON vuoto), per potergli agganciare -- come gia' fatto
  // per il placeholder del corpo vuoto (round-4j) -- i segmenti di CONTINUAZIONE del
  // back-edge (ponte orizzontale + tratto finale che rientra nell'esagono, dove sta
  // la vera punta): senza questo aggancio, selezionando l'arco l'utente vedeva
  // colorarsi solo il breve tratto cliccabile iniziale, MAI la punta (che vive su un
  // segmento successivo, sempre salva=false, mai in frecce[] di per se').
  let populatedBodyEndArc = null;
  if (lastBodyIdx !== null) {
    drawLine(lastRealX, (stubTopY != null ? stubTopY : bodyBottomY), lastRealX, backEdgeGapY, true, lastBodyIdx, loopIdx, 'loop_body_end');
    populatedBodyEndArc = frecce[frecce.length - 1];
  } else {
    drawLine(bodyColX, bodyBottomY, bodyColX, backEdgeGapY, false);
  }
  // C1 (round 11): back-edge del ciclo (ritorno corpo->condizione) NON e' in frecce[]
  // (non cliccabile, scelta di design 2026-07-04): il punto 7 sopra (che itera frecce[])
  // non lo puo' quindi evidenziare durante l'esecuzione. Si passano comunque
  // lastBodyIdx/loopIdx come fromNodeIndex/toNodeIndex (innocuo qui: salva=false, quindi
  // non finiscono MAI in frecce[]) cosi' il check _execHl gia' presente DENTRO drawLine()
  // (FIX #12) colora anche questi due segmenti -- ponte + rientro nell'esagono -- quando
  // il passo appena eseguito e' esattamente questo back-edge (R12-F: executingEdge.from===
  // lastBodyIdx && executingEdge.to===loopIdx). Il primo segmento del back-edge (riga sopra,
  // 'loop_body_end') e' gia' coperto allo stesso modo, essendo gia' salva=true con gli
  // indici giusti.
  drawLine(lastRealX, backEdgeGapY, backEdgeX, backEdgeGapY, false, lastBodyIdx, loopIdx);
  drawLine(backEdgeX, backEdgeGapY, backEdgeX, diaBottom, false, lastBodyIdx, loopIdx, null, null, true);
  // FIX round-4j (vedi nota su drawLine/visualExtra in cima al file): per un corpo
  // VUOTO, i tre segmenti appena disegnati sopra (giu' - lato - su fino all'esagono)
  // sono il "ritorno" visivo dello stesso placeholder self-loop disegnato piu' in
  // alto (arco cliccabile 'loop_body', fromNodeIndex===toNodeIndex===loopIdx) --
  // l'utente li percepisce come un unico anello. Li agganciamo come visualExtra
  // all'arco cliccabile cosi' l'hover li ridisegna in rosso insieme, invece di
  // lasciarli neri (bug segnalato: "colora solo la parte alta").
  // FIX round-4p: ogni tupla ha ora un QUINTO elemento (booleano) che indica se quel
  // segmento porta una punta -- solo l'ultimo (quello che rientra nell'esagono) la
  // porta davvero (vedi il drawLine subito sopra, arrow=true); l'hover/drag (punto
  // 5/6 di draw()) la ridisegna nel colore di evidenziazione SOLO per quel segmento.
  if (emptyBodySelfLoopArc) {
    // FIX round-4q: si CONCATENA (non si sovrascrive) l'entryStemSeg gia' agganciato
    // subito dopo aver disegnato l'arco placeholder (vedi sopra) -- altrimenti questa
    // riassegnazione lo cancellerebbe, lasciando di nuovo lo stelo d'ingresso "staccato".
    emptyBodySelfLoopArc.visualExtra = (emptyBodySelfLoopArc.visualExtra || []).concat([
      [bodyColX, bodyBottomY, bodyColX, backEdgeGapY, false],
      [bodyColX, backEdgeGapY, backEdgeX, backEdgeGapY, false],
      [backEdgeX, backEdgeGapY, backEdgeX, diaBottom, true]
    ]);
  }
  if (populatedBodyEndArc) {
    populatedBodyEndArc.visualExtra = [
      [lastRealX, backEdgeGapY, backEdgeX, backEdgeGapY, false],
      [backEdgeX, backEdgeGapY, backEdgeX, diaBottom, true]
    ];
  }

  // --- Uscita DRITTA in giu (CLICCABILE, loop_exit): dal fondo dell'esagono, stessa
  // colonna del ciclo, fino al nodo successivo. SOLO se l'uscita e' "locale" (il nodo
  // di uscita sta REALMENTE nella stessa colonna X del ciclo, entro 1px). ---
  // BUG N2 (review Fable, 2026-07-04 notte-4): quando il ciclo e' l'ultimo nodo di un
  // ramo IF, il suo next.false punta al JOIN dell'IF esterno, che il layout piazza
  // nella colonna dell'IF (centerX del padre), NON in quella del ciclo (che vive nella
  // colonna del ramo, offset a destra) -- collectBranchNodes/B4 fa "vedere attraverso"
  // il ciclo per calcolare il join, ma quella X non coincide quasi mai con cx. Prima
  // di questo fix si disegnava comunque una linea VERTICALE a cx fino alla Y del join
  // (che sta ad un'altra X): una linea che non tocca il nodo di destinazione, PIU' un
  // secondo arco (quello vero, gestito da drawIfBranches/drawBranchConnections con
  // tipo 'loop_exit' dopo il fix sopra) che arriva correttamente al join -- due archi
  // sovrapposti di lunghezza diversa (il "arco piu' lungo che va fuori" segnalato da
  // Ismail). Stessa regola gia' in uso per l'if_join di un IF annidato (Math.abs(joinX-cx)<1
  // in drawIfBranches): un solo proprietario del segmento, scelto per allineamento X
  // reale, mai per colonna memorizzata (principio generale N5).
  if (body.exitIndex !== null && nodi[body.exitIndex]) {
    const exitNode = nodi[body.exitIndex];
    const exitLogic = flow.nodes[body.exitIndex];
    const exitX = exitNode.relX * w;
    // FIX round-2 P6 (stesso principio applicato in drawDoWhileBranches): la
    // coincidenza di colonna X non distingue un'uscita locale vera da un ANTENATO
    // (While/For/Do) che ha QUESTO ciclo come proprio ultimo membro di corpo -- caso
    // raro qui (i corpi di While/For sono di norma scostati lateralmente) ma non
    // impossibile (es. profondita' di annidamento che fa coincidere per caso la X),
    // e comunque lo stesso identico criterio semantico va tenuto allineato fra le
    // due funzioni.
    const exitIsAncestorLoop = !!(exitLogic && isBranchingNodeType(exitLogic.type) && exitLogic.type !== "if" &&
      (() => { const b = collectLoopBody(body.exitIndex); return b.bodyList.length > 0 && b.bodyList[b.bodyList.length - 1] === loopIdx; })());
    const isLocalExit = !exitIsAncestorLoop && Math.abs(exitX - cx) < 1;
    if (isLocalExit) {
      drawLine(cx, diaBottom, cx, entryTopY(body.exitIndex), true, loopIdx, body.exitIndex, 'loop_exit', null, true);
    }
    // else: l'uscita e' condivisa con un IF antenato -- il segmento cliccabile lo
    // disegna GIA' drawBranchConnections (con tipo 'loop_exit', vedi rendering.js
    // drawIfBranches) + l'arco if_join dell'IF antenato: non duplicare qui.
  }

  // Etichette del corpo/uscita, stesso stile delle etichette T/F dell'IF. FIX B0
  // (review Fable, 2026-07-05, piano Do-While/For): prima erano SEMPRE "V"/"F"
  // hard-coded, valide solo per il While -- centralizzate in LOOP_LABELS (state.js)
  // per tipo di ciclo, cosi' Do-While mostra True/False e For mostra Next/Done senza
  // toccare altro codice di rendering.
  const loopType = (flow.nodes[loopIdx] && flow.nodes[loopIdx].type) || "while";
  const labels = (typeof LOOP_LABELS !== "undefined" && LOOP_LABELS[loopType]) ? LOOP_LABELS[loopType] : { body: "V", exit: "F" };
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = cssVar('--if-true-color', IF_LABEL_TRUE_COLOR);
  // S3 P8.4: label tradotte (edgeLabelText/state.js), `labels` resta il fallback letterale.
  ctx.fillText((typeof edgeLabelText === 'function') ? edgeLabelText(loopType, 'body') : labels.body, (diaRight + bodyColX) / 2, cy - 10);
  ctx.fillStyle = cssVar('--if-false-color', IF_LABEL_FALSE_COLOR);
  // FIX P11 (segnalato da Ismail su prova12.json: l'etichetta "Done" del For si
  // sovrapponeva all'arco di back-edge quando l'ultimo membro del corpo e' un
  // ciclo/Do-While annidato -- offset da cx-14 a cx-20, in coppia con l'aumento di
  // BACKEDGE_SEP_PX 15->22 in state.js, per allontanare label e arco.
  ctx.fillText((typeof edgeLabelText === 'function') ? edgeLabelText(loopType, 'exit') : labels.exit, cx - 20, diaBottom + 12);
}

// Disegna un Do-While (FIX BUG 4, Ismail 2026-07-05 sera): a differenza di
// While/For, il CORPO sta PRIMA dell'esagono di controllo, stessa colonna, mai
// scostato lateralmente (vedi layoutDoWhileNode/slotExtent in layout.js -- la
// condizione si valuta DOPO aver eseguito il corpo almeno una volta, coerente con
// l'executor). Il back-edge torna DAL BASSO (esagono) VERSO L'ALTO (cima del
// corpo), capovolto rispetto a While/For (dove il corpo segue l'esagono e il
// back-edge torna dal fondo del corpo SU all'esagono). L'uscita (next.false)
// resta identica a While/For: dritta in giu dal fondo dell'esagono.
//
// Mappa di cliccabilita' (stesso principio di drawLoopBranches):
//   verticale colonna corpo (ingresso/placeholder corpo vuoto)      -> SI, tipo loop_body
//   collegamento ultimo-nodo-corpo (o placeholder) -> esagono       -> SI, tipo loop_body_end
//   verticale sotto l'esagono (uscita -> nodo successivo)          -> SI, tipo loop_exit
//   back-edge (l'intera polilinea di ritorno, esagono -> cima corpo) -> NO
function drawDoWhileBranches(loopIdx, node) {
  const body = collectLoopBody(loopIdx);
  const cx = node.relX * w;
  const cy = node.relY * h;
  const diaLeft = cx - node.width / 2;
  const diaTop = cy - node.height / 2;
  const diaBottom = cy + node.height / 2;
  // Cima del corpo: calcolata dal layout (layoutDoWhileNode/doBodyTopPxY), stesso
  // punto in cui termina l'arco di ingresso alla struttura (vedi entryTopY sopra).
  // FIX (trovato dal nuovo test-if.js, Test 12): doBodyTopPxY e' un valore grezzo di
  // layout nella stessa convenzione di relY*h (centro), NON gia' un "bordo superiore"
  // -- va sottratto height/2 esattamente come fa entryTopY, altrimenti questo valore
  // (usato sotto per il placeholder del corpo vuoto e per il punto di ritorno del
  // back-edge) non combacia col punto reale in cui termina l'arco di ingresso.
  // Fallback a diaTop se per qualche motivo il layout non l'ha valorizzata (non
  // dovrebbe succedere per un nodo "do" valido, ma evita un NaN in un caso limite).
  const bodyTopY = (typeof node.doBodyTopPxY === 'number') ? (node.doBodyTopPxY - NODE_BASE_HEIGHT_PX / 2) : diaTop; // FIX BUG 6: costante, non height/2 (vedi entryTopY): l'esagono alto non deve spingere la cima del corpo fuori canvas

  let bodyBottomY;    // Y del punto piu' basso del corpo (da cui si scende all'esagono)
  let lastBodyIdx = null; // indice dell'ultimo nodo del corpo (null se corpo vuoto)

  if (body.bodyList.length === 0) {
    // Corpo vuoto: placeholder cliccabile dritto in giu, dalla cima del corpo
    // (stesso punto dell'ingresso alla struttura) fino alla cima dell'esagono --
    // self-loop, come il placeholder di While/For ma capovolto (qui scende VERSO
    // l'esagono, non parte DALL'esagono).
    drawLine(cx, bodyTopY, cx, diaTop, true, loopIdx, loopIdx, 'loop_body', null, true);
    bodyBottomY = bodyTopY;
  } else {
    // FIX (trovato dal nuovo test-if.js, Test 13, cicli annidati): a differenza del
    // caso corpo-vuoto sopra, questo ramo non disegnava MAI un arco di tipo
    // 'loop_body' -- confidando che l'arco di ingresso esterno (disegnato dal
    // chiamante via entryTopY) bastasse. Ma quell'arco esterno appartiene al
    // GENITORE (es. 'normal' da un nodo precedente, o 'loop_body' di un ciclo
    // ESTERNO che tratta questo Do-While come proprio primo membro del corpo) --
    // non e' mai registrato con from=loopIdx, quindi moveNode/inserisciNodo non
    // hanno modo di inserire un nuovo nodo come NUOVO primo membro DI QUESTO corpo
    // (nessun arco 'loop_body' con fromNodeIndex=loopIdx). Stesso identico gap
    // impediva anche di trovare un arco dedicato quando un Do-While e' annidato nel
    // corpo di un ciclo esterno (l'esterno cercava un arco da se' verso il primo
    // membro, che c'e' -- ma il Do-While stesso non registrava mai la propria
    // versione interna). Per costruzione bodyTopY combacia esattamente con
    // entryTopY(primo nodo del corpo) (nessuno scostamento laterale in questa
    // geometria), quindi il segmento e' degenere (lunghezza zero) ma resta un
    // target cliccabile valido, esattamente come il placeholder del corpo vuoto.
    drawLine(cx, bodyTopY, cx, entryTopY(body.bodyList[0]), true, loopIdx, body.bodyList[0], 'loop_body', null, true);

    // Collegamenti interni fra nodi consecutivi del corpo (stessa colonna: a
    // differenza di While/For qui il corpo non e' mai un ramo scostato lateralmente).
    for (let i = 0; i < body.bodyList.length - 1; i++) {
      const curType = flow.nodes[body.bodyList[i]] && flow.nodes[body.bodyList[i]].type;
      if (curType === "if" || (isBranchingNodeType(curType) && curType !== "if")) continue;
      const fromNode = nodi[body.bodyList[i]];
      const toNode = nodi[body.bodyList[i + 1]];
      drawLine(
        fromNode.relX * w, fromNode.relY * h + fromNode.height / 2,
        toNode.relX * w, entryTopY(body.bodyList[i + 1]),
        true, body.bodyList[i], body.bodyList[i + 1], 'normal', null, true
      );
    }

    const lastIdx = body.bodyList[body.bodyList.length - 1];
    const last = nodi[lastIdx];
    const lastLogic = flow.nodes[lastIdx];
    // Stesso fix di BUG 2 (drawLoopBranches): se l'ultimo nodo del corpo e' un IF
    // annidato, il fondo reale e' la sua ricongiunzione (reconnectPxY), non il box;
    // per un ciclo annidato (While/For/Do) il box stesso (relY*h+height/2) e' gia'
    // il punto giusto, qualunque sia la SUA geometria interna.
    const lastIsIf = lastLogic && lastLogic.type === "if";
    // FIX P3 (review Fable, 2026-07-05 pomeriggio, piano nested-while-visuals): il fix
    // BUG 2 usava il fondo NUDO dell'esagono (last.relY*h+last.height/2) per QUALUNQUE
    // ciclo ultimo-del-corpo, assumendo che corpo/back-edge di un ciclo si sviluppino
    // sempre "lateralmente, non sotto" -- vero SOLO se quel ciclo non ha a sua volta
    // nesting profondo. Con CATENE di cicli (es. while1.body=[while2],
    // while2.body=[while3], ...) questo faceva collassare il back-edge dell'ESTERNO in
    // un rettangolino appena sotto il proprio esagono, invece di avvolgere l'intero
    // sottoalbero che si estende molto piu' in basso (il corpo del ciclo interno, per
    // quanto "a destra", cresce comunque in basso via layoutNode ricorsivo). Fix:
    // `last.reconnectPxY` per un ciclo e' il fondo del SUO corpo (v.reconnectPxY =
    // bodyBottom in layout.js) -- un valore che CASCATA ricorsivamente la profondita' di
    // ogni ulteriore nesting al suo interno (bodyBottom di un ciclo e' sempre >= bottom
    // del proprio esagono, per costruzione: bodyTop = bottom+offset, poi solo crescente),
    // quindi non "taglia mai attraverso" l'esagono interno (a differenza del timore
    // originale del fix BUG 2) -- lo usiamo anche qui, analogamente al ramo lastIsIf.
    const lastIsLoop = lastLogic && isBranchingNodeType(lastLogic.type) && lastLogic.type !== "if";
    // FIX round-2 P2 (piano 2026-07-06-nested-loops-round2): stesso principio applicato
    // sopra in drawLoopBranches -- `last.reconnectPxY` e' invertito (vicino alla CIMA,
    // non al fondo) quando l'ultimo membro del corpo di QUESTO Do-While e' a sua volta
    // un Do-While annidato. Il valore corretto e' gia' disponibile in `node.reconnectPxY`
    // (v.reconnectPxY = bodyBottom, impostato da layoutDoWhileNode in layout.js come il
    // valore di RITORNO della catena ricorsiva sul proprio corpo -- gia' corretto per
    // qualunque tipo di ultimo membro, non va ricostruito qui dal figlio).
    // FIX P8 (segnalato da Ismail con test reale in Chrome su prova12.json: "il do non
    // si collega a pieno con il print"): il fast-path sopra (node.reconnectPxY) e'
    // corretto SOLO quando l'ultimo membro del corpo e' esso stesso un ciclo annidato
    // (While/For/Do-While) -- in quel caso la catena ricorsiva di layout.js usa sempre
    // "+LOOP_EXIT_GAP_PX" (un gap esplicito) per calcolare il valore di ritorno, mai un
    // offset arbitrario. Ma quando l'ultimo membro e' un nodo SEMPLICE (assign/print/...),
    // layout.js lo fa terminare tramite il percorso generico "il mio next e' lo stopIdx"
    // (layoutNode, ramo "return bottom"), che restituisce v.pxY + node.height PER INTERO
    // (convenzione interna per incatenare la posizione del nodo SUCCESSIVO), non
    // v.pxY + height/2 (il vero bordo inferiore del nodo). Usare node.reconnectPxY anche
    // in questo caso piazza l'inizio dell'arco 20px (meta' altezza dell'ultimo nodo del
    // corpo) PIU' IN BASSO del suo vero bordo inferiore, lasciando un gap vuoto e NON
    // CLICCABILE fra l'ultimo nodo del corpo e l'esagono (es. "Print:" e "Do:" in
    // prova12.json -- confermato con ispezione diretta delle coordinate `frecce`/`nodi`
    // nel browser: l'arco iniziava 20px sotto il bordo reale di "Print:"). Fix: il
    // fast-path si applica SOLO se l'ultimo membro e' un ciclo (lastIsLoop, il caso per
    // cui P2/P6 erano stati scritti); altrimenti si ricade sul calcolo esatto del bordo
    // (last.relY*h + last.height/2), gia' corretto prima che il fast-path lo sostituisse
    // incondizionatamente per QUALUNQUE tipo di ultimo membro.
    // FIX P10 (stesso bug di drawLoopBranches, vedi commento li' per la spiegazione
    // completa): quando l'ultimo membro e' specificamente un DO-WHILE annidato, ne'
    // `node.reconnectPxY` (include un `LOOP_EXIT_GAP_PX` di troppo, pensato per un
    // eventuale nodo SUCCESSIVO nella catena di layout) ne' `last.reconnectPxY` (fondo
    // del SUO corpo, vicino alla CIMA, invertito -- causa storica di P2) sono corretti.
    // Un Do-While disegna sempre il proprio esagono DOPO il proprio corpo: il bordo
    // inferiore del suo esagono e' quindi SEMPRE il punto piu' basso della sua intera
    // struttura, per costruzione -- stesso calcolo diretto di un nodo semplice, sempre esatto.
    const lastIsDoWhile = lastLogic && lastLogic.type === "do";
    // FIX P12 (stesso bug di drawLoopBranches, vedi commento li' per la spiegazione
    // completa): un ciclo semplice (While/For) a corpo VUOTO come ultimo membro non ha
    // nulla che si estenda oltre il proprio esagono nella colonna condivisa -- il vero
    // bordo e' sempre `last.relY*h + last.height/2`, mai una ricostruzione da
    // reconnectPxY (che qui vale come "ancora per il prossimo elemento della catena",
    // non come bordo visivo). Riprodotto con un Do-While il cui corpo ha 2+ membri, di
    // cui uno non-ultimo e' gia' un ciclo (es. `do(for(vuoto), while(vuoto))`).
    const lastIsEmptyBodySimpleLoop = lastIsLoop && !lastIsDoWhile &&
      (() => { const b = collectLoopBody(lastIdx); return b.bodyList.length === 0; })();
    if (lastIsLoop) {
      // FIX round-3b: un ciclo (While/For/Do) come ULTIMO membro del corpo di un Do-While
      // si collega al proprio esagono (bordo inferiore reale), non a node.reconnectPxY
      // (fondo dell'intero sottoalbero, che qui farebbe partire lo stub scollegato dal
      // figlio -- stesso bug "corpo = un solo ciclo" di drawLoopBranches). In un Do-While
      // non c'e' avvolgimento del sottoalbero (il back-edge sta a sinistra, a cy), quindi
      // basta il bordo del figlio -- niente stubTopY separato come in drawLoopBranches.
      bodyBottomY = last.relY * h + last.height / 2;
    } else if (lastIsIf && typeof last.reconnectPxY === "number") {
      // P6.1 fix (round 15-B S6, Ismail 2026-07-15): stesso motivo di drawLoopBranches/
      // stubTopY -- questo e' il pallino di ricongiunzione dell'IF interno (ultimo membro
      // del corpo di QUESTO Do-While), da cui parte l'arco 'loop_body_end' cliccabile
      // (drawLine sotto). Stesso JOIN_DOT_GAP_PX (state.js), altrimenti niente gap qui.
      // La guardia P9 subito sotto (bodyBottomY > diaTop -> diaTop) resta comunque un tetto
      // di sicurezza anche con questi 5px in piu'.
      bodyBottomY = last.reconnectPxY - NODE_BASE_HEIGHT_PX / 2 + JOIN_DOT_GAP_PX;
    } else {
      bodyBottomY = last.relY * h + last.height / 2;
    }
    // FIX P9 (segnalato da Ismail: "questo e' quello che succede quando metti un ciclo
    // dentro un do-while" -- screenshot con un For a corpo vuoto dentro un Do-While,
    // esagono "Do:" completamente scollegato). Causa: quando l'ultimo membro del corpo
    // e' un CICLO annidato (lastIsLoop), `node.reconnectPxY`/`last.reconnectPxY` non
    // rappresentano il vero bordo visivo inferiore del ciclo annidato -- includono GIA'
    // il proprio `LOOP_EXIT_GAP_PX` (40px, il gap che quel ciclo riserverebbe per un
    // eventuale FRATELLO successivo nel proprio ramo). La posizione fisica di QUESTO
    // Do-While (`doTop = bodyBottom + LOOP_DO_CHECK_GAP_PX`, solo 10px) non basta a
    // "recuperare" quei 40px, quindi `diaTop` (la cima reale dell'esagono, calcolata da
    // `cy - height/2`) puo' finire SOPRA (numericamente MINORE di) `bodyBottomY`: l'arco
    // andrebbe disegnato all'INSU' invece che in giu', staccandosi visivamente dal corpo
    // (l'esagono "Do:" appare scollegato dal resto, come nello screenshot). Poiche'
    // `diaTop` e' sempre la posizione VERA e definitiva dell'esagono (mai una stima
    // ricostruita), la guardia piu' semplice e robusta e' non lasciare MAI che l'arco
    // punti oltre di essa: se il valore calcolato sopra supera `diaTop`, si aggancia
    // direttamente al bordo (stesso principio "tocca il bordo vero" del fix P8) invece
    // di proiettarsi oltre in una direzione invertita.
    if (bodyBottomY > diaTop) {
      bodyBottomY = diaTop;
    }
    lastBodyIdx = lastIdx;
  }

  // --- Collegamento ultimo-nodo-del-corpo -> esagono: dritto in giu, stessa
  // colonna, CLICCABILE (tipo loop_body_end, come While/For: permette di inserire
  // un nodo subito prima della condizione). Il caso corpo-vuoto e' gia' interamente
  // coperto dal placeholder sopra, niente da aggiungere qui. ---
  if (lastBodyIdx !== null) {
    const lastRealX = nodi[lastBodyIdx].relX * w;
    drawLine(lastRealX, bodyBottomY, cx, diaTop, true, lastBodyIdx, loopIdx, 'loop_body_end', null, true);
  }

  // --- Back-edge: dal vertice sinistro dell'esagono torna SU alla cima del corpo,
  // polilinea NON cliccabile scostata lateralmente a SINISTRA (per non sovrapporsi
  // all'uscita, che scende dritta a destra nella stessa colonna cx -- stesso
  // principio del back-edge di While/For, solo specchiato in verticale). ---
  // FIX BUG 1b (Ismail 2026-07-07, "archi che si sovrappongono quando metti un If dentro
  // al Do"): il back-edge del Do scende/risale a SINISTRA e va scostato a sinistra non
  // solo dell'esagono (diaLeft) ma dell'INTERO contenuto del corpo -- se il corpo contiene
  // un If, il suo ramo False sta piu' a sinistra dell'esagono (falseColX < cx), quindi la
  // verticale del back-edge (diaLeft - BACKEDGE_SEP_PX) cadeva DENTRO il box del ramo
  // False, sovrapponendosi. Si calcola il bordo sinistro reale del nodo del corpo piu' a
  // sinistra e si scosta il back-edge di BACKEDGE_SEP_PX oltre quello (stesso overhang di
  // prima, ma riferito al contenuto vero invece che all'esagono).
  // FIX #11b (Ismail 2026-07-08): il back-edge del Do deve scostarsi a sinistra oltre il
  // contenuto REALE del corpo, inclusi i DISCENDENTI di strutture annidate (rami di un If,
  // corpo di un ciclo) i cui box stanno piu' a sinistra dell'esagono. Prima si guardavano solo
  // i membri diretti di body.bodyList -> con un If/ciclo dentro il Do il ramo sinistro cadeva
  // dentro il back-edge. Mirato ai soli discendenti del corpo del Do (niente over-shift).
  let leftMostBodyLeft = diaLeft;
  const _consider = (idx) => {
    const bn = nodi[idx];
    if (!bn) return;
    const l = bn.relX * w - (bn.width || NODE_BASE_WIDTH_PX || 100) / 2;
    if (l < leftMostBodyLeft) leftMostBodyLeft = l;
  };
  // FIX (Ismail 2026-07-08): il back-edge deve scostarsi a sinistra oltre TUTTA l'estensione
  // visiva del corpo, incluse le COLONNE dei rami di un IF anche quando sono VUOTI (nessun
  // box, ma l'arco del ramo False si spinge comunque a sinistra fino a cx-IF_BRANCH_X_OFFSET_PX
  // -- stessa formula di drawIfBranches). Senza questo, con un Do a corpo = un IF vuoto, la
  // verticale del back-edge cadeva a DESTRA del ramo False dell'IF e ne tagliava gli archi
  // orizzontali (segnalato con screenshot). Ricorsivo per IF/cicli annidati.
  const _considerSubtree = (idx) => {
    _consider(idx);
    const t = flow.nodes[idx] && flow.nodes[idx].type;
    if (t === 'if' && typeof collectBranchNodes === 'function') {
      const _sub = collectBranchNodes(idx);
      const ifcx = nodi[idx] ? nodi[idx].relX * w : 0;
      const fX = _sub.falseList.length ? nodi[_sub.falseList[0]].relX * w : (ifcx - IF_BRANCH_X_OFFSET_PX);
      if (fX < leftMostBodyLeft) leftMostBodyLeft = fX;
      _sub.trueList.forEach(_considerSubtree); _sub.falseList.forEach(_considerSubtree);
    } else if (t && isBranchingNodeType(t) && t !== 'if' && typeof collectLoopBody === 'function') {
      const _lb = collectLoopBody(idx);
      _lb.bodyList.forEach(_considerSubtree);
      // P6.2 (round 15-B S6, Ismail 2026-07-15, screenshot 170939 "do-while annidati: archi
      // False sovrapposti"): un Do-While annidato nel corpo di QUESTO Do-While riserva a SUA
      // volta un back-edge scostato BACKEDGE_SEP_PX oltre il proprio contenuto piu' a sinistra
      // (stessa formula di backEdgeX, sotto) -- un overhang che _consider()/_considerSubtree
      // sopra non vedono (guardano solo i box dei nodi reali, non l'arco che gli sta a fianco).
      // Senza contarlo, il back-edge di QUESTO livello poteva finire troppo vicino (o
      // sovrapposto) a quello del Do-While interno quando condividono il lato sinistro.
      // Si riserva la stessa quota anche qui: essendo dentro la ricorsione di _considerSubtree,
      // questo scatta UNA volta per ogni Do-While annidato incontrato a QUALUNQUE profondita'
      // (un Do dentro un Do dentro un Do accumula piu' BACKEDGE_SEP_PX, non solo un livello),
      // cosi' la separazione cresce con la profondita' di annidamento invece di restare fissa.
      // Puo' solo ALLARGARE lo spazio riservato (mai stringerlo): nessun rischio di introdurre
      // nuove sovrapposizioni, al piu' un margine in piu' del minimo indispensabile.
      if (t === 'do') leftMostBodyLeft -= BACKEDGE_SEP_PX;
    }
  };
  for (const bi of body.bodyList) _considerSubtree(bi);
  const backEdgeX = leftMostBodyLeft - BACKEDGE_SEP_PX;
  // C1 (round 11): back-edge del Do-While (condizione vera -> si ritorna in cima al
  // corpo), NON in frecce[] (non cliccabile). Stesso principio gia' applicato al
  // back-edge di While/For sopra: si passano loopIdx/primo-nodo-del-corpo come
  // fromNodeIndex/toNodeIndex (innocuo, salva resta false) solo cosi' il check _execHl
  // gia' dentro drawLine() colora anche questi segmenti quando il passo appena eseguito
  // e' esattamente "condizione vera -> rientra nel corpo" (R12-F: executingEdge.from===
  // loopIdx && executingEdge.to===primo-nodo-del-corpo). Corpo vuoto: nessun target
  // reale (il placeholder self-loop dedicato, sopra, gestisce gia' quel caso da solo).
  const _backToBody = body.bodyList.length ? body.bodyList[0] : null;
  drawLine(diaLeft, cy, backEdgeX, cy, false, loopIdx, _backToBody);
  drawLine(backEdgeX, cy, backEdgeX, bodyTopY, false, loopIdx, _backToBody);
  drawLine(backEdgeX, bodyTopY, cx, bodyTopY, false, loopIdx, _backToBody, null, null, true);
  // P6 (Ismail 2026-07-14, "nel do-while non si colora la freccia sinistra di ritorno"): questi
  // 3 segmenti della RISALITA sono salva=false -> NON entrano in frecce[], quindi computeEdgeGroups
  // (che legge frecce[]) non li vedeva e la freccia di ritorno restava nera. Li si aggancia come
  // visualExtra all'arco di DISCESA (loop_body, from=loopIdx, gia' in frecce[]): cosi' la
  // transizione do->primoCorpo include ritorno-a-sinistra + risalita + rientro in cima al corpo.
  const _doEntryArc = frecce.find(function (f) { return f.fromNodeIndex === loopIdx && f.type === 'loop_body'; });
  if (_doEntryArc) _doEntryArc.visualExtra = (_doEntryArc.visualExtra || []).concat([
    [diaLeft, cy, backEdgeX, cy, false],
    [backEdgeX, cy, backEdgeX, bodyTopY, false],
    [backEdgeX, bodyTopY, cx, bodyTopY, true]
  ]);

  // FIX (Ismail 2026-07-07): pallino di convergenza in ALTO del Do-While, nel punto in cui
  // arrivano l'arco d'ingresso (dall'alto) e il back-edge di ritorno (dal ciclo) -- analogo
  // al "*" di merge dell'IF, ma qui all'inizio della struttura (geometria capovolta del Do).
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, bodyTopY, 3, 0, Math.PI * 2);
  ctx.fillStyle = themeCanvasLineColor();
  ctx.fill();
  ctx.restore();

  // --- Uscita DRITTA in giu (CLICCABILE, loop_exit): identica a While/For --
  // SOLO se l'uscita e' "locale" (nodo di uscita realmente nella stessa colonna X
  // del ciclo, entro 1px); altrimenti e' gia' gestita dall'IF/ciclo antenato. ---
  if (body.exitIndex !== null && nodi[body.exitIndex]) {
    const exitNode = nodi[body.exitIndex];
    const exitLogic = flow.nodes[body.exitIndex];
    const exitX = exitNode.relX * w;
    // FIX round-2 P6 (trovato con test-if.js batch su Do-While annidato in Do-While,
    // segnalato da Ismail con prova12.json + varianti): la coincidenza di colonna X
    // NON basta per un Do-While, perche' a differenza di While/For il suo corpo non e'
    // MAI scostato lateralmente -- un ciclo Do-While annidato nel corpo di un altro
    // Do-While ha SEMPRE la stessa X del genitore. Se `body.exitIndex` e' un ciclo
    // ANTENATO che ha QUESTO ciclo (loopIdx) come proprio ULTIMO membro di corpo,
    // quell'uscita e' gia' gestita dal back-edge proprio dell'antenato (arco
    // 'loop_body_end' disegnato da drawDoWhileBranches/drawLoopBranches
    // dell'antenato) -- ridisegnarla qui come 'loop_exit' produceva un secondo
    // segmento spurio che punta verso l'ALTO (verso la cima del corpo dell'antenato,
    // via entryTopY) invece che verso il basso, tagliando attraverso qualunque nodo
    // si trovi in mezzo (es. un 'print' fra i due Do-While, screenshot/JSON di test
    // di Ismail). Stessa identica logica del criterio "isLocalExit" usato qui e in
    // drawLoopBranches, solo esteso perche' l'euristica X non distingue i due casi
    // per un Do-While.
    const exitIsAncestorLoop = !!(exitLogic && isBranchingNodeType(exitLogic.type) && exitLogic.type !== "if" &&
      (() => { const b = collectLoopBody(body.exitIndex); return b.bodyList.length > 0 && b.bodyList[b.bodyList.length - 1] === loopIdx; })());
    const isLocalExit = !exitIsAncestorLoop && Math.abs(exitX - cx) < 1;
    if (isLocalExit) {
      drawLine(cx, diaBottom, cx, entryTopY(body.exitIndex), true, loopIdx, body.exitIndex, 'loop_exit', null, true);
    }
  }

  // Etichette True/False (LOOP_LABELS.do), stesso stile delle altre etichette di ciclo.
  // FIX round-2 P7 (segnalato da Ismail, screenshot su prova12.json: l'etichetta
  // "True" si sovrapponeva al nodo "Print"): la Y era `(bodyTopY + diaTop) / 2`, il
  // PUNTO MEDIO dell'intero corpo -- valido solo per un corpo corto/vuoto (dove
  // bodyTopY e diaTop sono vicini), ma con un corpo di piu' nodi (bodyTopY molto piu'
  // in alto) il punto medio cade ovunque nel mezzo del corpo, sovrapponendo qualunque
  // nodo si trovi li'. "False" invece resta sempre vicino all'esagono (`diaBottom +
  // 12`, un offset FISSO) qualunque sia la dimensione del corpo -- stesso principio
  // applicato ora anche a "True": offset fisso vicino alla cima dell'esagono
  // (`diaTop - 12`), dove il back-edge rientra visivamente, invece di scalare con la
  // lunghezza del corpo.
  const labels = (typeof LOOP_LABELS !== "undefined" && LOOP_LABELS.do) ? LOOP_LABELS.do : { body: "True", exit: "False" };
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = cssVar('--if-true-color', IF_LABEL_TRUE_COLOR);
  // S3 P8.4: label tradotte (edgeLabelText/state.js), `labels` resta il fallback letterale.
  // P6.1 cosmetico (round 15-B S6, Ismail 2026-07-15, richiesta a mano): spostata leggermente
  // a destra (cx+16 -> cx+20), in coppia con l'offset della label "False" qui sotto (cx-20,
  // FIX P11) -- ora le due etichette del Do-While sono equidistanti dal centro, come nell'IF.
  ctx.fillText((typeof edgeLabelText === 'function') ? edgeLabelText('do', 'body') : labels.body, cx + 20, diaTop - 12);
  ctx.fillStyle = cssVar('--if-false-color', IF_LABEL_FALSE_COLOR);
  // FIX P11 (stesso fix di drawLoopBranches, vedi commento li'): offset da cx-14 a
  // cx-20 in coppia con BACKEDGE_SEP_PX 15->22 in state.js.
  ctx.fillText((typeof edgeLabelText === 'function') ? edgeLabelText('do', 'exit') : labels.exit, cx - 20, diaBottom + 12);
}

// Disegna il collegamento a forma di Lda:
//   l'ultimo nodo di un ramo IF (lastNode)
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

// Disegna il collegamento "da IF al prossimo nodo esterno" come:
//   1) Spezzone verticale cliccabile (dal centro-inferiore di if fino a un punto di join Y)
//   2) Spezzone orizzontale cliccabile (dal punto di join X,Y fino all'X di next sul medesimo Y)
//   3) Spezzone verticale (dal punto di join X,Y fino al bordo superiore di next)
function drawJoinConnection(fromNode, toNode, fromIndex, toIndex) {
  const fromX = fromNode.relX * w; // X del nodo di partenza
  const fromY = fromNode.relY * h + fromNode.height / 2; // Y del bordo inferiore del nodo di partenza
  const toX = toNode.relX * w; // X del nodo di arrivo
  const toY = toNode.relY * h - toNode.height / 2; // Y del bordo superiore del nodo di arrivo

  // Calcola una coordinata Y intermedia per il segmento orizzontale del "ponte"
    const joinY = Math.max(fromY, toY) + 80; // 80px sotto il piu' basso tra fromY e toY (o sopra se toY e' molto in alto)

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
  // FIX (Ismail 2026-07-07): disegna un vero PARALLELOGRAMMA (I/O), non un rettangolo --
  // lo `skew` (orizzontale) inclina i lati sinistro/destro. Il bounding box resta (x,y,w,h),
  // quindi layout e connessioni degli archi (centro alto/basso) non cambiano.
  const sk = Math.max(6, Math.min((skew || 18), width / 3));
  ctx.beginPath();
  ctx.moveTo(x + sk, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width - sk, y + height);
  ctx.lineTo(x, y + height);
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

// Disegna un esagono (While/For/Do-While): vertici sinistro/destro a punta (stesso
// schema del rombo IF: diaRight = cx+w/2, diaBottom = cy+h/2, usati da drawLoopBranches
// per gli archi corpo/uscita), lati superiore/inferiore piatti. I due vertici a punta
// stanno a meta' altezza (cy) sui bordi sinistro (x) e destro (x+w); i quattro spigoli
// piatti sono rientrati di `inset` (lati laterali a 45°), coerente con le forme rese
// nelle scene di test (While:/For:/Do: esagoni con punte laterali).
function drawHexagon(x, y, w, h) {
  const cy = y + h / 2;
  // FIX #34 (Ismail 2026-07-08): inset LIMITATO. Con inset = h/2, un esagono ALTO (testo su
  // molte righe) aveva gli spigoli alto/basso che si incrociavano -> forma a clessidra
  // (screen For). Limitando a min(h/2, w/4, 24) la forma resta un esagono corretto e per un
  // nodo BASE (100x40) l'inset resta 20 (= h/2), identico a prima -> nessuna regressione.
  const inset = Math.min(h / 2, w / 4, 24);
  ctx.beginPath();
  ctx.moveTo(x, cy);                 // vertice sinistro a punta
  ctx.lineTo(x + inset, y);          // spigolo alto-sinistra
  ctx.lineTo(x + w - inset, y);      // spigolo alto-destra
  ctx.lineTo(x + w, cy);             // vertice destro a punta
  ctx.lineTo(x + w - inset, y + h);  // spigolo basso-destra
  ctx.lineTo(x + inset, y + h);      // spigolo basso-sinistra
  ctx.closePath();
}

// ---- Forme dei blocchi GRAFICA / turtle (Ismail 2026-07-08, round 2) ----
// Costruiscono solo il path (beginPath..closePath); il chiamante fa fill()/stroke().
function drawForwardShape(x, y, w, h) { // "Move/Draw": tag con punta a destra
  const cut = Math.min(w * 0.22, 22); const cy = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w - cut, y); ctx.lineTo(x + w, cy);
  ctx.lineTo(x + w - cut, y + h); ctx.lineTo(x, y + h); ctx.closePath();
}
function drawTurnShape(x, y, w, h, dir) { // "Turn": freccia orizzontale; dir sceglie la punta.
  // Corpo rettangolare a tutta altezza (bordo alto/basso PIATTO: le frecce di
  // collegamento toccano il centro del bordo e agganciano il blocco; il testo sta nel
  // corpo pieno) + testa(e)-freccia triangolare ai lati a meta' altezza (identita' "ruota").
  // R12-D (Ismail 2026-07-11): `dir` e' opzionale (5o parametro, retro-compatibile con i
  // 2 call-site esistenti che non lo passano -- vedi draw() e il ghost del drag, che
  // resta SEMPRE a due punte, per design, vedi piano). null/undefined/valore ignoto ->
  // comportamento storico DOPPIA freccia (nodo nuovo / direzione non ancora scelta).
  // 'right' -> punta SOLO a destra, lato sinistro PIATTO (bordo verticale a x). 'left' ->
  // speculare (punta a sinistra, lato destro piatto a x+w).
  const cy = y + h / 2;
  const head = Math.min(w * 0.20, 20);
  const notch = Math.min(h * 0.30, 14);
  ctx.beginPath();
  if (dir === 'right') {
    ctx.moveTo(x, y);                        // angolo alto-sinistra (lato piatto, niente testa)
    ctx.lineTo(x + w - head, y);             // corpo: alto-destra
    ctx.lineTo(x + w - head, cy - notch);    // testa destra: alto
    ctx.lineTo(x + w, cy);                   // punta destra
    ctx.lineTo(x + w - head, cy + notch);    // testa destra: basso
    ctx.lineTo(x + w - head, y + h);         // corpo: basso-destra
    ctx.lineTo(x, y + h);                    // angolo basso-sinistra (lato piatto)
  } else if (dir === 'left') {
    ctx.moveTo(x + head, y);                 // corpo: alto-sinistra
    ctx.lineTo(x + w, y);                    // angolo alto-destra (lato piatto, niente testa)
    ctx.lineTo(x + w, y + h);                // angolo basso-destra (lato piatto)
    ctx.lineTo(x + head, y + h);             // corpo: basso-sinistra
    ctx.lineTo(x + head, cy + notch);        // testa sinistra: basso
    ctx.lineTo(x, cy);                       // punta sinistra
    ctx.lineTo(x + head, cy - notch);        // testa sinistra: alto
  } else {
    ctx.moveTo(x + head, y);                 // corpo: alto-sinistra
    ctx.lineTo(x + w - head, y);             // corpo: alto-destra (bordo alto piatto)
    ctx.lineTo(x + w - head, cy - notch);    // testa destra: alto
    ctx.lineTo(x + w, cy);                   // punta destra
    ctx.lineTo(x + w - head, cy + notch);    // testa destra: basso
    ctx.lineTo(x + w - head, y + h);         // corpo: basso-destra
    ctx.lineTo(x + head, y + h);             // corpo: basso-sinistra (bordo basso piatto)
    ctx.lineTo(x + head, cy + notch);        // testa sinistra: basso
    ctx.lineTo(x, cy);                       // punta sinistra
    ctx.lineTo(x + head, cy - notch);        // testa sinistra: alto
  }
  ctx.closePath();
}
function drawHomeShape(x, y, w, h) { // "Home": casetta (tetto + corpo)
  const roof = h * 0.4;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + roof); ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h); ctx.lineTo(x, y + roof); ctx.closePath();
}

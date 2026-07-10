
// Ridimensiona il canvas per contenere i nodi e converte le posizioni assolute in
// pixel (node.pxX = offset dal centro, node.pxY = assoluto dall'alto) in relX/relY.
// Le posizioni px NON dipendono dalle dimensioni del canvas: ridimensionando la
// finestra il grafo mantiene la stessa forma, cambia solo la viewport.
function _bfRenderScale() {
  const z = (typeof zoom === 'number' && zoom > 0) ? zoom : 1;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  return Math.min(3, Math.max(1, z * dpr));
}
function resizeCanvasToFitNodes(nodi) {
  const margin = 100;        // Spazio extra in px intorno ai nodi
  const scrollPadding = 300; // Spazio aggiuntivo per consentire sempre lo scorrimento

  // N4 (review Fable, 2026-07-04 notte-4): BUG -- un While nel ramo FALSE di un IF (o
  // qualunque struttura il cui contenuto e' sbilanciato verso un lato, es. quasi tutto
  // a sinistra del centro) usciva dal bordo del canvas. Causa reale: il vecchio calcolo
  // usava SOLO `maxAbsX` (il massimo di |pxX|, raddoppiato per simmetria) per la
  // LARGHEZZA del canvas -- questo di per se' garantisce spazio sufficiente su
  // ENTRAMBI i lati (mai un canvas troppo STRETTO) -- ma poi centrava SEMPRE il grafo
  // assumendo che pxX=0 fosse il centro reale del contenuto (relX = 0.5 + pxX/w). Per
  // un grafo sbilanciato questo NON e' vero: il centro VERO del bounding box reale
  // (minPxX..maxPxX) puo' essere ben lontano da 0, quindi il grafo finiva renderizzato
  // fuori centro rispetto al canvas -- la vista (centerGraph(), che centra sempre sul
  // centro DEL CANVAS) mostrava quindi un viewport che tagliava il lato sbilanciato,
  // anche se il canvas stesso era largo abbastanza. Fix: si calcola il bounding box
  // REALE (minPxX/maxPxX, non piu' simmetrico per costruzione) e si centra il grafo sul
  // centro DI QUEL bounding box, non su pxX=0. Per un grafo simmetrico (il caso comune:
  // IF con rami bilanciati, ecc.) il centro del bounding box coincide con 0 e il
  // risultato e' IDENTICO a prima (nessuna regressione).
  let minPxX = 0, maxPxX = 0;
  let maxY = 0; // massimo pxY + mezza altezza
  for (const node of nodi) {
    if (!node) continue;
    const halfW = (node.width || 100) / 2;
    const halfH = (node.height || NODE_BASE_HEIGHT_PX) / 2;
    const left = (node.pxX || 0) - halfW;
    const right = (node.pxX || 0) + halfW;
    if (left < minPxX) minPxX = left;
    if (right > maxPxX) maxPxX = right;
    const ay = (node.pxY || 0) + halfH;
    if (ay > maxY) maxY = ay;
  }

  const contentW = (maxPxX - minPxX) + margin + scrollPadding;
  const contentH = maxY + margin + scrollPadding;
  const baseW = container ? container.offsetWidth : 0;
  const baseH = container ? container.offsetHeight : 0;

  const requiredWidth = Math.max(baseW, contentW, MIN_CANVAS_W);
  const requiredHeight = Math.max(baseH, contentH, MIN_CANVAS_H);

  // CRISP ZOOM (Ismail 2026-07-09): w/h restano le dimensioni LOGICHE (usate da layout,
  // relX/relY, hit-test e export); il BACKING della tela e' invece supersamplato per
  // zoom x devicePixelRatio (cap 3x) cosi' il contenuto resta NITIDO anche zoomando molto.
  const _rs = _bfRenderScale();
  const _bw = Math.max(1, Math.round(requiredWidth * _rs));
  const _bh = Math.max(1, Math.round(requiredHeight * _rs));
  if (canvas.width !== _bw || canvas.height !== _bh) {
    canvas.width = _bw;
    canvas.height = _bh;
  }
  w = requiredWidth;  // larghezza LOGICA
  h = requiredHeight; // altezza LOGICA

  // Il grafo e' centrato sul centro del SUO bounding box reale (graphCenterPx), non
  // piu' assumendo che pxX=0 lo sia sempre: le distanze RELATIVE fra nodi restano
  // identiche (e' solo un'origine diversa), ma il bounding box intero finisce sempre
  // centrato nella viewport, qualunque sia lo sbilanciamento orizzontale del grafo.
  const graphCenterPx = (minPxX + maxPxX) / 2;
  const originOffsetPx = w / 2 - graphCenterPx;
  for (const node of nodi) {
    if (!node) continue;
    node.relX = (originOffsetPx + (node.pxX || 0)) / w;
    node.relY = (node.pxY || 0) / h;
    // FIX P2 (review Fable, 2026-07-05 pomeriggio, piano nested-while-visuals): node.bodyColX
    // e' un valore in PX ASSOLUTI di LAYOUT (stessa unita' di node.pxX), calcolato SOLO per
    // il caso di corpo VUOTO (nessun nodo reale nella colonna a cui appoggiarsi -- vedi
    // rendering.js, drawLoopBranches). Il rendering lo riconvertiva con `w/2 + node.bodyColX`,
    // che assume l'origine sia sempre al CENTRO del canvas (originOffsetPx === w/2) -- vero
    // SOLO per un grafo perfettamente simmetrico attorno a pxX=0. Con catene di cicli
    // annidati (tutto il contenuto sbilanciato a destra) originOffsetPx si allontana da w/2
    // in proporzione allo sbilanciamento, quindi l'errore CRESCE con la profondita' di
    // annidamento (colonna del placeholder che "deriva" sempre piu' a destra, +60px/livello
    // circa nei casi misurati). Fix: convertire bodyColX in una frazione relativa
    // (bodyColXRel), con la STESSA formula di relX, cosi' il rendering puo' riportarlo in
    // px assoluti con `node.bodyColXRel * w` -- corretto qualunque sia lo sbilanciamento.
    if (typeof node.bodyColX === "number") {
      node.bodyColXRel = (originOffsetPx + node.bodyColX) / w;
    }
  }
  applyZoom(); // mantiene la scala di zoom a ogni ridimensionamento/ridisegno
}

// Zoom SOLO dei blocchi sul canvas: scala CSS del canvas (il backing store resta
// invariato), senza toccare lo zoom del browser. La hit-detection dei click e' resa
// scale-aware in interaction.js, quindi i click restano corretti a ogni livello di zoom.
function applyZoom() {
  if (typeof canvas === 'undefined' || !canvas || !canvas.style) return;
  const z = (typeof zoom === 'number' && zoom > 0) ? zoom : 1;
  canvas.style.width = (w * z) + 'px';
  canvas.style.height = (h * z) + 'px';
}
// Centra la vista sul grafo (orizzontalmente al centro del canvas, dove sta il
// flusso principale). Chiamata sui cambi di zoom: senza, aumentando lo zoom il
// grafo scivolava verso destra fuori dalla viewport.
function centerGraph() {
  if (typeof container === 'undefined' || !container || !canvas) return;
  const z = (typeof zoom === 'number' && zoom > 0) ? zoom : 1;
  const cw = container.clientWidth || 0;
  // Sottrai la parte coperta a destra dalla console agganciata+aperta: cosi' il grafo
  // si centra nell'area EFFETTIVAMENTE visibile (una o due barre aperte). La sidebar
  // variabili invece e' nel grid, quindi e' gia' esclusa da container.clientWidth.
  let rightCover = 0;
  const cons = (typeof document !== 'undefined') ? document.getElementById('console-popup') : null;
  if (cons && cons.classList && typeof cons.classList.contains === 'function' && cons.classList.contains('active') && cons.classList.contains('docked') && typeof cons.getBoundingClientRect === 'function') {
    rightCover = cons.getBoundingClientRect().width || 0;
  }
  const visibleW = Math.max(60, cw - rightCover);
  const _rtl = (typeof document !== 'undefined') && document.documentElement && typeof document.documentElement.getAttribute === 'function' && document.documentElement.getAttribute('dir') === 'rtl';
  // FIX #33c (Ismail 2026-07-08, "in arabo, quando allargo il terminale il grafo non si
  // centra"): in RTL `scrollLeft` ha semantica DIVERSA (Chrome/Brave usano il modello
  // "negativo": 0 = tutto a destra, valori negativi verso sinistra), quindi la vecchia
  // formula assoluta (con Math.max(0, ...)) restava incollata a un bordo. Soluzione robusta e
  // indipendente dalla direzione: si misura lo SFASAMENTO in coordinate FISICHE del viewport
  // (getBoundingClientRect, sempre orientato LTR) fra il centro reale del canvas e il centro
  // dell'area VISIBILE (non coperta dalla console), e si aggiusta scrollLeft di quel DELTA
  // relativo. `scrollLeft += delta` sposta il contenuto della stessa quantita' fisica sia in
  // LTR sia in RTL, e il browser fa da solo il clamp al range valido.
  if (typeof container.getBoundingClientRect !== 'function' || typeof canvas.getBoundingClientRect !== 'function') return;
  const cRect = container.getBoundingClientRect();
  const canRect = canvas.getBoundingClientRect();
  const canvasCenter = canRect.left + canRect.width / 2;
  // Centro dell'area visibile in coordinate viewport: in RTL la console copre la SINISTRA
  // (offset +rightCover da sinistra), in LTR copre la destra (l'area parte dal bordo sinistro).
  const targetCenter = _rtl ? (cRect.left + rightCover + visibleW / 2) : (cRect.left + visibleW / 2);
  container.scrollLeft += (canvasCenter - targetCenter);
}
function zoomIn() { zoom = Math.min(ZOOM_MAX, +(zoom * ZOOM_STEP).toFixed(4)); _bfZoomRerender(); centerGraph(); }
function zoomOut() { zoom = Math.max(ZOOM_MIN, +(zoom / ZOOM_STEP).toFixed(4)); _bfZoomRerender(); centerGraph(); }
function zoomReset() { zoom = 1; _bfZoomRerender(); centerGraph(); }
// Ricalcola il backing supersamplato al nuovo zoom e ridisegna nitido (fallback applyZoom in headless).
function _bfZoomRerender() { if (typeof calcoloY === 'function' && typeof nodi !== 'undefined') { calcoloY(nodi); if (typeof draw === 'function') draw(nodi); } else applyZoom(); }

// Calcola le posizioni dei nodi in PIXEL ASSOLUTI (node.pxX offset dal centro,
// node.pxY dall'alto). La X e' assegnata in modo RICORSIVO in base alla larghezza
// dei sottoalberi, cosi' gli IF annidati non si sovrappongono. La conversione in
// relX/relY avviene in resizeCanvasToFitNodes.
// FIX (Ismail 2026-07-07): la dimensione dei nodi si calcola PRIMA del layout, in modo che
// l'anti-sovrapposizione (che usa width/height) riservi lo spazio giusto. Prima il width
// veniva "gonfiato" in draw() DOPO il layout -> i blocchi con testo lungo si sovrapponevano.
// Testo lungo: va a capo (wrap) e cresce in ALTEZZA (una riga = altezza base, cosi' i test a
// testo corto restano invariati). La larghezza cresce in modo LIMITATO (maxW per forma) per
// non rompere il layout a colonne fisse.
function wrapNodeText(text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = []; let cur = '';
  const fits = (str) => ctx.measureText(str).width <= maxWidth;
  for (let wd of words) {
    // FIX (Ismail 2026-07-07): se una singola "parola" (es. un URL senza spazi) e' piu'
    // larga del blocco, la spezziamo a livello di CARATTERE cosi' il testo non esce mai
    // dal blocco -- il blocco cresce in verticale (piu' righe) invece che sforare in
    // orizzontale. Ricerca binaria del punto di taglio massimo che sta in maxWidth.
    while (wd.length > 1 && !fits(wd)) {
      let lo = 1, hi = wd.length, fit = 1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (fits(wd.slice(0, mid))) { fit = mid; lo = mid + 1; } else hi = mid - 1; }
      if (cur) { lines.push(cur); cur = ''; } // chiudi la riga corrente prima del pezzo lungo
      lines.push(wd.slice(0, fit));
      wd = wd.slice(fit);
    }
    const test = cur ? cur + ' ' + wd : wd;
    if (!cur || fits(test)) cur = test;
    else { lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
// Validazione del CONTENUTO di un nodo (Ismail 2026-07-07): se il contenuto e' vuoto
// dove richiesto o sintatticamente invalido, il blocco viene segnalato in ROSSO nel
// rendering (come nell'esempio Flowgorithm). NB: `new Function(...)` qui COMPILA soltanto
// l'espressione per validarne la sintassi -- NON la esegue (nessun effetto collaterale).
function nodeHasError(n) {
  if (!n) return false;
  const t = n.type;
  if (t === 'start' || t === 'end' || t === 'comment' || t === 'pause') return false;
  const info = (n.info == null ? '' : String(n.info)).trim();
  // Un blocco NUOVO/vuoto NON e' un errore: si segnala in rosso solo se ha un contenuto
  // effettivamente SBAGLIATO. Finche' e' vuoto (appena inserito) resta col colore normale.
  if (info === '') return false;
  try {
    if (t === 'if' || t === 'while' || t === 'do') {
      new Function('return (' + info + ')'); // condizione: espressione valida?
    } else if (t === 'assign' || t === 'assignment') {
      const m = info.match(/^\s*([A-Za-z_]\w*(\s*\[[^\]]*\])?)\s*(=|\+=|-=|\*=|\/=|%=)\s*([\s\S]+)$/);
      if (!m) return true;                    // deve avere forma "var = espr"
      new Function('return (' + m[4] + ')');   // parte destra valida?
    } else if (t === 'output' || t === 'print' || t === 'write') {
      // print/output usano un parsing custom (splitStrings in execute.js) che accetta
      // stringhe e concatenazioni miste: qui NON facciamo un controllo di sintassi rigido
      // (darebbe falsi positivi) -- basta che non sia vuoto, gia' verificato sopra.
    } else if (t === 'input' || t === 'read') {
      if (!/^[A-Za-z_]\w*(\s*\[[^\]]*\])?$/.test(info)) return true; // nome di variabile valido?
    } else if (t === 'for') {
      // FIX (Ismail 2026-07-08): il For va segnalato ROSSO se la struttura e' invalida
      // (es. nome variabile con spazi o parti mancanti). Formato atteso: "v = init; cond; incr".
      const parts = info.split(';');
      if (parts.length !== 3) return true;
      const mi = parts[0].trim().match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (!mi) return true;                              // init: identificatore = espr
      const vn = mi[1];
      const cond = parts[1].trim(), incr = parts[2].trim();
      if (!new RegExp('^' + vn + '\\s*(<=|>=|<|>|!=|==)\\s*.+$').test(cond)) return true; // condizione sulla stessa var
      const incOk = new RegExp('^' + vn + '\\s*(\\+=|-=|\\*=|/=)\\s*.+$').test(incr)
        || new RegExp('^' + vn + '\\s*(\\+\\+|--)$').test(incr)
        || new RegExp('^(\\+\\+|--)' + vn + '$').test(incr);
      if (!incOk) return true;                           // incremento sulla stessa var
      new Function('return (' + mi[2] + ')');            // init: espressione valida?
    }
  } catch (e) {
    return true; // sintassi non valida
  }
  return false;
}
function computeNodeSizes(nodiVisualArray) {
  if (typeof ctx === 'undefined' || !ctx || typeof ctx.measureText !== 'function') return;
  const prevFont = ctx.font;
  ctx.font = 'bold 16px Arial';
  const BASE_W = 100, BASE_H = (typeof NODE_BASE_HEIGHT_PX === 'number' ? NODE_BASE_HEIGHT_PX : 40);
  const LINE_H = 20;
  for (let i = 0; i < nodiVisualArray.length; i++) {
    const v = nodiVisualArray[i], n = flow.nodes[i];
    if (!v || !n) continue;
    let text = (typeof nodeDisplayLabel === 'function' && n) ? nodeDisplayLabel(n.type) : (v.text != null ? v.text : '');
    if (typeof TURTLE_TYPES !== 'undefined' && TURTLE_TYPES.indexOf(n.type) !== -1 && typeof turtleNodeLabel === 'function') {
      text = turtleNodeLabel(n.type, n.info || '');
    } else if (n.type !== 'start' && n.type !== 'end') text += ':' + (n.info || '');
    // FIX #34 (Ismail 2026-07-08): dimensionamento SHAPE-AWARE. Il rombo (if) tiene il testo
    // solo nella fascia centrale -> serve ~2x la larghezza del testo; l'esagono (while/for/do)
    // ha spigoli laterali (inset) -> serve testo + 2*inset; parallelogramma ha inclinazione.
    // Il testo corto (1 riga, come nei 308 test) resta BASE_W x BASE_H: nessuna regressione.
    let shape;
    if (n.type === 'if') shape = 'diamond';
    else if (n.type === 'while' || n.type === 'for' || n.type === 'do' || n.type === 'pause' || n.type === 'forward' || n.type === 'turn' || n.type === 'home') shape = 'hex';
    else if (['input','output','print','read','write'].includes(n.type)) shape = 'para';
    else shape = 'rect';
    // budget di larghezza del TESTO oltre il quale si va a capo, e cap larghezza blocco
    const oneLine = ctx.measureText(text).width;
    // budget di larghezza del TESTO oltre il quale si va a capo, e cap larghezza blocco
    let TEXT_BUDGET = shape === 'diamond' ? 130 : (shape === 'hex' ? 250 : 300);
    const MAXW = shape === 'diamond' ? 440 : (shape === 'hex' ? 380 : 340);
    if (shape === 'diamond') {
      // FIX BUG 2 (Ismail 2026-07-08): il rombo cresceva quasi solo in ALTEZZA (budget di
      // wrap fisso e stretto -> molte righe impilate). Ora la larghezza di wrap e' scelta per
      // BILANCIARE larghezza e altezza (width ~ 2*tw, height ~ 2*(oneLine/tw)*LINE_H ->
      // tw ~ sqrt(oneLine*LINE_H)): il rombo si ALLARGA prima di impilarsi, mantiene una forma
      // proporzionata e contiene il testo. La propagazione dell'estensione in pixel
      // (ifBranchOffsets/subtreePxExtent) assorbe la maggiore larghezza senza sovrapposizioni.
      // Testo corto (1 riga, tutti i 308 test) resta <= 130 <= TEXT_BUDGET -> BASE, nessuna regressione.
      const balanced = Math.sqrt(Math.max(1, oneLine) * LINE_H);
      TEXT_BUDGET = Math.max(130, Math.min(balanced, (MAXW - 34) / 2));
    }
    let lines, tw;
    if (oneLine <= TEXT_BUDGET) { lines = [text]; tw = oneLine; }
    else {
      lines = wrapNodeText(text, TEXT_BUDGET);
      tw = 0; for (const ln of lines) tw = Math.max(tw, ctx.measureText(ln).width);
    }
    const th = lines.length * LINE_H;
    const single = lines.length === 1;
    let width, height;
    if (shape === 'diamond') {
      width = Math.max(BASE_W, Math.min(2 * tw + 34, MAXW));
      height = single ? BASE_H : Math.max(BASE_H, 2 * th + 16);
    } else if (shape === 'hex') {
      // FIX (Ismail 2026-07-08, For/While a testo lungo): gli spigoli inclinati (inset ~24px)
      // restringono l'esagono in alto/basso, dove finivano le righe estreme del testo -> a
      // filo del bordo. Piu' padding orizzontale (72) e verticale (30) tiene le righe estreme
      // ben dentro il corpo dell'esagono. Testo di 1 riga (tutti i 308 test) resta BASE.
      width = Math.max(BASE_W, Math.min(tw + 72, MAXW));
      height = single ? BASE_H : Math.max(BASE_H, th + 30);
    } else if (shape === 'para') {
      width = Math.max(BASE_W, Math.min(tw + 52, MAXW));
      height = single ? BASE_H : Math.max(BASE_H, th + 20);
    } else {
      width = Math.max(BASE_W, Math.min(tw + 28, MAXW));
      height = single ? BASE_H : Math.max(BASE_H, th + 20);
    }
    v.width = width;
    v.height = height;
    v._lines = lines;
    // TASK (Ismail 2026-07-08): come Flowgorithm l'errore NON si mostra subito. Il rosso si
    // accende SOLO a runtime (throwError in execute.js) e NON va azzerato qui (draw richiama
    // computeNodeSizes: azzerarlo cancellerebbe l'evidenziazione appena impostata). Viene
    // pulito esplicitamente all'avvio dell'esecuzione e nel reset (execute.js).

  }
  ctx.font = prevFont;
}

function calcoloY(nodiVisualArray) {
  if (!flow.nodes.length || !nodiVisualArray.length) {
    console.warn("calcoloY: Dati mancanti o flowchart vuoto.");
    return;
  }

  computeNodeSizes(nodiVisualArray); // dimensiona i nodi in base al contenuto PRIMA del layout

  // Reset delle posizioni px
  for (const node of nodiVisualArray) {
    if (!node) continue;
    node.pxY = 0;
    node.pxX = 0;
  }

  // --- Fase bottom-up: estensione orizzontale dei sottoalberi, in "unita' colonna" ---
  // slotExtent(idx) = { L, R } = quante unita' il sottoalbero si estende a sinistra/destra
  // della propria colonna centrale. Un nodo semplice occupa solo la sua colonna (0,0).
  // Un IF riserva spazio ai due rami cosi' da non invadere la colonna del padre.
  const extentMemo = new Map();
  function branchExtent(list) {
    let L = 0, R = 0;
    for (const idx of list) {
      const e = slotExtent(idx);
      if (e.L > L) L = e.L;
      if (e.R > R) R = e.R;
    }
    return { L, R };
  }
  function slotExtent(idx) {
    if (extentMemo.has(idx)) return extentMemo.get(idx);
    const n = flow.nodes[idx];
    let res = { L: 0, R: 0 };
    if (n && n.type === "if" && typeof n.next === "object" && n.next !== null) {
      extentMemo.set(idx, res); // guardia anti-ciclo
      const sub = collectBranchNodes(idx);
      const te = branchExtent(sub.trueList);
      const fe = branchExtent(sub.falseList);
      const dTrue = 1 + te.L;   // il ramo true parte almeno 1 colonna a destra
      const dFalse = 1 + fe.R;  // il ramo false almeno 1 colonna a sinistra
      res = { L: dFalse + fe.L, R: dTrue + te.R };
    }
    else if (n && n.type === "do" && typeof n.next === "object" && n.next !== null) {
      // FIX BUG 4 (Ismail 2026-07-05 sera): a differenza di While/For, il corpo di un
      // Do-While NON si scosta lateralmente (sta DRITTO IN GIU, stessa colonna, prima
      // dell'esagono) -- quindi non serve riservare una colonna aggiuntiva a destra
      // (niente "+1"): l'estensione del Do-While e' semplicemente quella del suo
      // corpo (un eventuale IF/ciclo annidato NEL corpo si scosta lateralmente come
      // al solito, e branchExtent la propaga correttamente).
      extentMemo.set(idx, res); // guardia anti-ciclo
      const body = collectLoopBody(idx);
      const be = branchExtent(body.bodyList);
      res = { L: be.L, R: be.R };
    }
    else if (n && isBranchingNodeType(n.type) && n.type !== "if" && typeof n.next === "object" && n.next !== null) {
      // GEOMETRIA RIVISTA (2026-07-04 notte-2, richiesta di Ismail + review Fable):
      // il corpo di un ciclo sta a DESTRA, come il ramo true di un IF (non piu' nella
      // stessa colonna) -- stesso schema di calcolo di slotExtent per l'if: 1 colonna
      // in piu' rispetto all'estensione L del corpo stesso. (Non si applica al
      // Do-While, gestito nel ramo dedicato sopra.)
      extentMemo.set(idx, res); // guardia anti-ciclo
      const body = collectLoopBody(idx);
      const be = branchExtent(body.bodyList);
      // FIX BUG (Ismail 2026-07-07, errroee.json: "guarda come si sovrappone l'If al
      // layout"): il corpo del ciclo viene POSIZIONATO a `(1 + be.L)` colonne a destra
      // (vedi layoutNode: bodyColX = centerX + (1 + be.L) * LOOP_BODY_X_OFFSET_PX) e da li'
      // si estende ancora di `be.R` verso destra. L'estensione destra REALE del ciclo e'
      // quindi `(1 + be.L) + be.R`, non `1 + be.R`: mancava il termine `be.L`. Con una
      // catena di cicli annidati che cresce a destra (while>while>for>if) l'errore si
      // accumulava a ogni livello, finche' il contenuto del ramo sforava nella colonna
      // dell'ALTRO ramo dell'IF esterno (l'If interno finiva sopra i Do del ramo opposto).
      // Ora la riserva combacia esattamente col posizionamento, quindi l'IF esterno separa
      // i due rami abbastanza da non farli mai sovrapporre.
      res = { L: 0, R: (1 + be.L) + be.R };
    }
    extentMemo.set(idx, res);
    return res;
  }

  // === FIX BUG 1/3/4/7 (Ismail 2026-07-08): propagazione dell'ESTENSIONE IN PIXEL ===
  // I bug 1/3/4/7 condividono la stessa radice: la separazione delle colonne (rami di
  // IF, corpo dei cicli) era calcolata in "unita' colonna" + la mezza larghezza del solo
  // nodo DIRETTO del ramo. Un blocco largo annidato in PROFONDITA' non veniva considerato e
  // sforava oltre lo spine/arco d'uscita del contenitore (bug 1/3/7) o oltre la colonna del
  // ramo opposto (bug 4). Fix: si calcola bottom-up, in PIXEL, quanto ogni sottoalbero si
  // estende a sinistra (L) e a destra (R) della propria colonna, e si ALZA l'offset della
  // colonna quando serve. Per i nodi da 100px (tutti i 308 test) l'estensione in pixel e'
  // sempre <= l'offset a unita'-colonna -> il MAX sceglie il valore storico (nessuna
  // regressione); solo i blocchi CRESCIUTI spingono la colonna piu' in la'. Le funzioni
  // offset qui sono l'UNICA fonte di verita' usata sia dal posizionamento sia dal calcolo
  // dell'estensione, cosi' cio' che il padre riserva combacia con cio' che il figlio occupa.
  const PX_CLEAR_MARGIN = 30;
  const pxMemo = new Map();
  const _half = (i) => { const v = nodiVisualArray[i]; return ((v && v.width) || 100) / 2; };
  function groupPxExtent(list) {
    let L = 0, R = 0;
    for (const idx of list) { const e = subtreePxExtent(idx); if (e.L > L) L = e.L; if (e.R > R) R = e.R; }
    return { L, R };
  }
  function ifBranchOffsets(idx) {
    const v = nodiVisualArray[idx];
    const sub = collectBranchNodes(idx);
    const te = branchExtent(sub.trueList), fe = branchExtent(sub.falseList);
    const U = IF_BRANCH_X_OFFSET_PX;
    const halfClear = (v.width || 100) / 2 + 34;
    const baseOffset = Math.max(U, halfClear);
    const bh = (list) => { let m = 0; for (const i of list) { const bv = nodiVisualArray[i]; if (bv && bv.width) m = Math.max(m, bv.width / 2); } return m; };
    const trueClear = Math.max(baseOffset, bh(sub.trueList) + 30);
    const falseClear = Math.max(baseOffset, bh(sub.falseList) + 30);
    const teP = groupPxExtent(sub.trueList), feP = groupPxExtent(sub.falseList);
    const dTrue = Math.max(trueClear + te.L * U, teP.L + PX_CLEAR_MARGIN);
    const dFalse = Math.max(falseClear + fe.R * U, feP.R + PX_CLEAR_MARGIN);
    return { dTrue, dFalse, teP, feP };
  }
  function loopBodyOffset(idx) {
    const v = nodiVisualArray[idx];
    const body = collectLoopBody(idx);
    const be = branchExtent(body.bodyList);
    const loopHalfClear = (v.width || 100) / 2 + 34;
    let bodyHalf = 0; for (const i of body.bodyList) { const bv = nodiVisualArray[i]; if (bv && bv.width) bodyHalf = Math.max(bodyHalf, bv.width / 2); }
    const bodyClear = Math.max(LOOP_BODY_X_OFFSET_PX, loopHalfClear, bodyHalf + 30);
    const beP = groupPxExtent(body.bodyList);
    const dBody = Math.max(bodyClear + be.L * LOOP_BODY_X_OFFSET_PX, beP.L + PX_CLEAR_MARGIN);
    return { dBody, beP };
  }
  function subtreePxExtent(idx) {
    if (pxMemo.has(idx)) return pxMemo.get(idx);
    const n = flow.nodes[idx];
    const half = _half(idx);
    let res = { L: half, R: half };
    pxMemo.set(idx, res);
    if (n && n.type === "if" && typeof n.next === "object" && n.next !== null) {
      const o = ifBranchOffsets(idx);
      res = { L: Math.max(half, o.dFalse + o.feP.L), R: Math.max(half, o.dTrue + o.teP.R) };
    } else if (n && n.type === "do" && typeof n.next === "object" && n.next !== null) {
      const body = collectLoopBody(idx);
      const beP = groupPxExtent(body.bodyList);
      res = { L: Math.max(half + BACKEDGE_SEP_PX, beP.L), R: Math.max(half, beP.R) };
    } else if (n && isBranchingNodeType(n.type) && n.type !== "if" && typeof n.next === "object" && n.next !== null) {
      const o = loopBodyOffset(idx);
      res = { L: half, R: Math.max(half + BACKEDGE_SEP_PX, o.dBody + o.beP.R) };
    }
    pxMemo.set(idx, res);
    return res;
  }

  // --- Fase top-down: assegna Y (px, con anti-sovrapposizione per colonna) e X ---
  const maxYAtColumn = {}; // px: fondo (con gap) gia' occupato per colonna (chiave = X)

  function placeNode(idx, topPx, centerX) {
    const v = nodiVisualArray[idx];
    const n = flow.nodes[idx];
    if (!v || !n) return null;
    const nodeH = v.height || NODE_BASE_HEIGHT_PX;
    const colKey = centerX.toFixed(1);
    let proposedTop = topPx;
    if (maxYAtColumn[colKey] !== undefined && maxYAtColumn[colKey] > proposedTop) {
      proposedTop = maxYAtColumn[colKey];
    }
    if (v.pxY > proposedTop) {
      proposedTop = v.pxY;
    }
    // FIX (Ismail 2026-07-07): il layout vive in "spazio slot-top" e il rendering applica
    // una correzione COSTANTE (NODE_BASE_HEIGHT_PX/2) valida solo se ogni nodo e' alto BASE.
    // Un nodo PIU' ALTO (testo multi-riga) sforava di (height-BASE)/2 verso l'alto,
    // sovrapponendosi al nodo sopra. Spostando pxY di (height-BASE)/2, il bordo SUPERIORE
    // resta ancorato alla posizione calibrata e il nodo cresce SOLO verso il basso, senza
    // sovrapporsi ai vicini. Per un nodo di altezza BASE (tutti i test) l'offset e' 0 ->
    // comportamento identico a prima.
    const baseH = (typeof NODE_BASE_HEIGHT_PX === 'number' ? NODE_BASE_HEIGHT_PX : 40);
    const _off = Math.max(0, (nodeH - baseH) / 2);
    v.pxY = proposedTop + _off; // centro: ancora il bordo superiore, il blocco cresce verso il basso
    v.pxX = centerX; // offset in px dal centro del canvas (0 = colonna principale)
    // FIX (Ismail 2026-07-08): il "bottom" per la catena di layout resta proposedTop+nodeH e
    // NON pxY+nodeH -- cosi' lo spazio DOPO un blocco alto e' identico a quello di un blocco
    // normale (niente spazio extra, screen 2) e i valori di reconnect restano invariati per i
    // nodi baseH (i 308 test). Con questo lo slot riservato e' [proposedTop, proposedTop+nodeH]
    // e il gap sopra/sotto e' sempre NODE_VERTICAL_SPACING_PX (niente sovrapposizioni).
    const bottom = proposedTop + nodeH;
    const bottomWithGap = bottom + NODE_VERTICAL_SPACING_PX;
    if (!maxYAtColumn[colKey] || bottomWithGap > maxYAtColumn[colKey]) {
      maxYAtColumn[colKey] = bottomWithGap;
    }
    return bottom;
  }

  // FIX BUG 4 (segnalato da Ismail 2026-07-05 sera, screen 2 di riferimento): un
  // Do-While va disegnato con il blocco (l'esagono di controllo) DOPO le frecce del
  // corpo, non prima -- a differenza di While/For (condizione valutata PRIMA del
  // corpo), un Do-While esegue il corpo alla prima visita SENZA valutare nulla (vedi
  // fix executor B2), quindi la rappresentazione visiva deve rispettare lo stesso
  // ordine: ingresso -> corpo (in colonna, dritto in giu, NON a destra come
  // While/For) -> esagono di controllo -> back-edge (su, verso la cima del corpo,
  // capovolto rispetto a While/For) / uscita (giu, invariata). Il nodo "do" stesso
  // (placeNode) viene quindi posizionato SOTTO il corpo, non sopra: per questo il
  // layoutNode generico (che chiama placeNode incondizionatamente in cima) non va
  // bene per questo tipo -- serve un percorso dedicato, intercettato PRIMA della
  // chiamata a placeNode.
  function layoutDoWhileNode(idx, topPx, centerX, visited, stopIdx) {
    const v = nodiVisualArray[idx];
    const n = flow.nodes[idx];
    const body = collectLoopBody(idx);
    let bodyBottom;
    if (body.bodyList.length > 0) {
      // FIX round-4d (Ismail 2026-07-06, "quando metto un blocco dentro a un do while
      // questo non lascia spazio sopra per inserire blocchi, si mette in cima all'arco"):
      // a differenza di While/For (che riservano LOOP_BODY_START_Y_OFFSET_PX fra il
      // ciclo e il primo nodo del corpo, vedi sotto in layoutNode), qui il primo nodo
      // veniva posizionato ESATTAMENTE a topPx, la stessa Y salvata in doBodyTopPxY come
      // punto di arrivo del back-edge/arco di ingresso -- l'arco 'loop_body' cliccabile
      // fra entrata e primo nodo (drawDoWhileBranches, drawLine(cx, bodyTopY, cx,
      // entryTopY(body.bodyList[0]))) risultava quindi lungo ~0px: nessuno spazio per
      // cliccare e inserire un blocco PRIMA del primo.
      // FIX round-4g (Ismail: "per il do while quello sopra e' piu' corto di quello in
      // basso, fagli uguali"): usa LOOP_DO_CHECK_GAP_PX (lo stesso gap del fondo, sotto)
      // invece di LOOP_BODY_START_Y_OFFSET_PX (condiviso con While/For, che non ha lo
      // stesso vincolo di uguaglianza) -- cosi' i due gap del Do-While sono UGUALI per
      // costruzione, qualunque valore assumano in futuro.
      let curTop = topPx + LOOP_DO_CHECK_GAP_PX;
      for (const nodeIdx of body.bodyList) {
        curTop = layoutNode(nodeIdx, curTop, centerX, visited, idx);
      }
      bodyBottom = curTop;
    } else {
      // Corpo vuoto (degenera a While, vedi DECISIONS): riserva comunque spazio
      // PRIMA dell'esagono per il futuro primo inserimento nel corpo.
      bodyBottom = topPx + LOOP_EMPTY_BODY_LEN_PX;
    }
    // L'esagono (nodo "do" stesso) sta SOTTO il corpo, stessa colonna.
    const doTop = bodyBottom + LOOP_DO_CHECK_GAP_PX;
    // FIX round-4f (Ismail 2026-07-06, "per il do while e' il contrario, quello sopra e'
    // piu' corto di quello in basso"): il corpo di un Do-While condivide la STESSA
    // colonna del proprio esagono (a differenza di While/For, che scostano il corpo
    // lateralmente) -- placeNode() aggiorna sempre maxYAtColumn[colonna] a
    // "fondo (convenzione centro+altezza) + NODE_VERTICAL_SPACING_PX" dopo OGNI nodo
    // piazzato, pensato per un generico prossimo nodo SEQUENZIALE nella stessa colonna.
    // Ma qui il "prossimo" e' sempre il proprio esagono, con un gap dedicato piu'
    // piccolo (LOOP_DO_CHECK_GAP_PX=10) -- la prenotazione generica (NODE_VERTICAL_
    // SPACING_PX=28) e' PIU' GRANDE e vince nel controllo anti-sovrapposizione di
    // placeNode (`if (maxYAtColumn[colKey] > proposedTop) proposedTop = maxYAtColumn[...]`),
    // spingendo l'esagono molto piu' in basso del previsto (gap reale misurato: 28px
    // invece di 10px) -- da qui l'asimmetria "sopra piu' corto di sotto" segnalata da
    // Ismail (il gap sopra, LOOP_BODY_START_Y_OFFSET_PX, non soffre di questo problema
    // perche' il primo nodo del corpo e' il PRIMO piazzamento in quella colonna, nessuna
    // prenotazione precedente da rispettare). Fix: abbassare la prenotazione della
    // colonna a `doTop` PRIMA di piazzare l'esagono, cosi' il gap dedicato viene
    // rispettato invece di essere scavalcato da quello generico -- sicuro perche' in
    // questo punto dell'algoritmo (subito dopo aver finito il proprio corpo) l'unica
    // fonte che puo' aver scritto in questa colonna e' la catena del corpo appena
    // processata; si abbassa solo se il valore corrente e' PIU' ALTO di doTop, mai il
    // contrario (nessun rischio di nascondere una collisione legittima).
    const doColKey = centerX.toFixed(1);
    if (maxYAtColumn[doColKey] !== undefined && maxYAtColumn[doColKey] > doTop) {
      maxYAtColumn[doColKey] = doTop;
    }
    const bottom = placeNode(idx, doTop, centerX);
    // reconnectPxY: stesso significato semantico gia' in uso per While/For ("fondo
    // del corpo proprio"), riusato tale e quale da un eventuale antenato che tratti
    // questo Do-While come ultimo membro del proprio ramo/corpo (il fix del bug 2
    // in rendering.js usa gia' il fallback "fondo del box" per qualunque ciclo non-IF,
    // quindi non serve altro qui per quel caso).
    v.reconnectPxY = bodyBottom;
    // Y della cima del corpo (o del placeholder, se vuoto): usata dal rendering per
    // disegnare il back-edge CAPOVOLTO (dall'esagono torna SU fino a qui), invece
    // che in giu come per While/For.
    v.doBodyTopPxY = topPx;

    if (body.exitIndex !== null && !visited.has(body.exitIndex)) {
      const exitTop = bottom + LOOP_EXIT_GAP_PX;
      return layoutNode(body.exitIndex, exitTop, centerX, visited, stopIdx);
    }
    return bottom + LOOP_EXIT_GAP_PX;
  }

  function layoutNode(idx, topPx, centerX, visited, stopIdx) {
    if (idx === null || idx === undefined || visited.has(idx) || idx === stopIdx) {
      return topPx;
    }
    visited.add(idx);
    const v = nodiVisualArray[idx];
    const n = flow.nodes[idx];
    if (!v || !n) return topPx;

    // Do-While: percorso dedicato (vedi layoutDoWhileNode sopra), intercettato PRIMA
    // di placeNode perche' il nodo stesso va posizionato DOPO il corpo, non prima.
    if (n.type === "do" && typeof n.next === "object" && n.next !== null) {
      return layoutDoWhileNode(idx, topPx, centerX, visited, stopIdx);
    }

    const bottom = placeNode(idx, topPx, centerX);

    if (n.type === "if" && typeof n.next === "object" && n.next !== null) {
      const sub = collectBranchNodes(idx);
      const branchTop = bottom + IF_BRANCH_START_Y_OFFSET_PX;
      const U = IF_BRANCH_X_OFFSET_PX;

      // Colonne dei rami calcolate dall'estensione dei rispettivi sottoalberi.
      const te = branchExtent(sub.trueList);
      const fe = branchExtent(sub.falseList);
      // FIX #11 (Ismail 2026-07-08): quando il blocco (rombo/esagono) CRESCE in larghezza per
      // testo lungo, la sua meta' larghezza puo' superare l'offset fisso della colonna del
      // ramo -> il blocco si sovrappone al ramo/etichetta. Si prende quindi il MAX fra
      // l'offset base (U) e (mezza larghezza + margine). Per un blocco di larghezza normale
      // (<= ~160px, tutti i test) l'offset resta U: nessuna regressione.
      const halfClear = (v.width || 100) / 2 + 34;
      const baseOffset = Math.max(U, halfClear);
      // FIX (Ismail 2026-07-08, "il blocco largo nel ramo si sovrappone all'arco a sinistra"):
      // la colonna del ramo deve distare dal centro almeno mezza larghezza del NODO PIU' LARGO
      // del ramo + margine, cosi' un blocco con testo lungo dentro un ramo non sfora verso il
      // centro/arco del ramo opposto. Per nodi da 100px (tutti i test) resta baseOffset.
      const _branchHalf = (list) => { let mh = 0; for (const _bi of list) { const _bv = nodiVisualArray[_bi]; if (_bv && _bv.width) mh = Math.max(mh, _bv.width / 2); } return mh; };
      const trueClear = Math.max(baseOffset, _branchHalf(sub.trueList) + 30);
      const falseClear = Math.max(baseOffset, _branchHalf(sub.falseList) + 30);
      // FIX BUG 1/3/4/7: offset a unita-colonna ALZATO dall estensione in pixel del ramo.
      const _ifo = ifBranchOffsets(idx);
      const trueColX = centerX + _ifo.dTrue;
      const falseColX = centerX - _ifo.dFalse;

      // FIX round-4q (Ismail 2026-07-06, "e' tornato il problema degli if, arco sopra
      // deve essere lungo come arco sotto quando metti blocchi"): quando l'ULTIMO membro
      // di un ramo e' esso stesso branching (IF annidato o ciclo While/For/Do), `curTop`
      // (il valore di ritorno di layoutNode per quel nodo) NON rappresenta il vero fondo
      // visivo del ramo -- rappresenta "dove piazzare il PROSSIMO nodo in catena", che per
      // un IF annidato include gia' il proprio join (spesso CONDIVISO con questo IF
      // esterno: l'IF interno lo piazza per primo, "rubando" il posizionamento a
      // quest'ultimo), e per un ciclo include body+exitGap (pensato per il nodo che segue
      // il ciclo, mai raggiunto qui perche' il ramo finisce li'). Usare `curTop` come
      // trueDepth/falseDepth gonfiava quindi la ricongiunzione ben oltre il dovuto (gap
      // sotto misurato fino a 112px contro i 22px attesi, con un While a corpo popolato
      // come unico membro del ramo) -- stessa causa radice gia' risolta per il back-edge
      // dei cicli (P8-P12) e per drawBranchConnections/fromY qui sotto in rendering.js,
      // mai applicata pero' al calcolo di reconnectPxY qui in layout.js. Fix: quando
      // l'ultimo membro e' un IF, si usa il suo STESSO reconnectPxY (gia' nella forma-
      // -anchor corretta, stessa struttura di trueDepth per un nodo semplice); quando e'
      // un ciclo, si usa `pxY + altezza` del ciclo stesso (il fondo del SUO esagono,
      // trattato come un nodo normale -- esattamente la stessa scelta gia' fatta per
      // fromY in rendering.js/drawBranchConnections, per coerenza fra le due).
      function branchDepthAnchor(list, curTop) {
        if (!list.length) return curTop;
        const lastIdx = list[list.length - 1];
        const lastLogic = flow.nodes[lastIdx];
        const lastV = nodiVisualArray[lastIdx];
        if (!lastLogic || !lastV) return curTop;
        if (lastLogic.type === "if" && typeof lastV.reconnectPxY === "number") {
          return lastV.reconnectPxY;
        }
        if (isBranchingNodeType(lastLogic.type) && lastLogic.type !== "if") {
          // FIX BUG 2 (Ismail 2026-07-07, "quando metti un if e poi una serie di cicli
          // questi vanno sopra ad altri, non si dilata abbastanza il codice"): per un
          // While/For ultimo membro di un ramo IF il vero fondo VISIVO del ramo e' il fondo
          // del suo CORPO (reconnectPxY = bodyBottom), non il fondo del suo esagono. Il
          // corpo (a destra, con eventuali cicli annidati) cresce VERSO IL BASSO ben oltre
          // l'esagono: usando solo pxY+height la ricongiunzione dell'IF (e il ponte
          // orizzontale + il join) restava all'altezza dell'esagono, cioe' alla STESSA Y
          // del corpo del ciclo -> il ponte tagliava dentro il corpo (screenshot Ismail 2c).
          // Si usa il MAX fra fondo-esagono e fondo-corpo cosi' la ricongiunzione finisce
          // sempre SOTTO tutto il contenuto del ramo (il codice "si dilata"). reconnectPxY
          // (bodyBottom) e' PIU' BASSO di curTop (che aggiunge LOOP_EXIT_GAP_PX per un
          // eventuale fratello, qui assente): niente sovra-dilatazione. Un Do-While ha
          // l'esagono DOPO il corpo (geometria capovolta) e reconnectPxY vicino alla CIMA:
          // per lui il fondo visivo E' l'esagono, quindi si tiene solo pxY+height.
          // NOTA: questo SUPERA di proposito la vecchia simmetria arco-sopra/arco-sotto per
          // un While annidato (round-4q / test 47b), che teneva la ricongiunzione vicino
          // all'esagono ignorando la profondita' del corpo -- aggiornata alla nuova
          // richiesta di dilatazione.
          const hexBottom = (lastV.pxY || 0) + (lastV.height || NODE_BASE_HEIGHT_PX);
          if (lastLogic.type !== "do" && typeof lastV.reconnectPxY === "number") {
            // FIX (Ismail 2026-07-08, wasd.json: "l'arco di fine del While interno all'IF si
            // conclude dopo l'arco dell'IF, quando allungo molto il blocco"): il back-edge di
            // un While/For scende LOOP_BACKEDGE_GAP_PX SOTTO il fondo del corpo (reconnectPxY)
            // prima di richiudersi verso l'esagono. La ricongiunzione dell'IF deve finire
            // SOTTO anche il back-edge, non solo sotto il corpo -- altrimenti (con un blocco
            // del corpo molto alto) il back-edge del While taglia il ponte di ricongiunzione
            // dell'IF. Il fondo VISIVO reale del ciclo e' quindi reconnectPxY + il gap del
            // back-edge. Do-While escluso: il suo esagono e' gia' il punto piu' basso (back-
            // edge a sinistra, non sotto), quindi resta hexBottom.
            return Math.max(hexBottom, lastV.reconnectPxY + LOOP_BACKEDGE_GAP_PX);
          }
          return hexBottom;
        }
        return curTop;
      }

      // Ramo vuoto: riserva spazio extra (arco ~3x) per l'inserimento futuro.
      let trueDepth = branchTop + (sub.trueList.length ? 0 : IF_EMPTY_BRANCH_LEN_PX);
      if (sub.trueList.length > 0) {
        let curTop = branchTop;
        for (const nodeIdx of sub.trueList) {
          curTop = layoutNode(nodeIdx, curTop, trueColX, visited, sub.joinIndex);
        }
        // Profondita' REALE del sottoalbero del ramo: normalmente curTop (che include
        // l'estensione verso il basso di eventuali IF interni/cicli), tranne quando
        // l'ultimo membro e' branching (vedi branchDepthAnchor sopra).
        trueDepth = branchDepthAnchor(sub.trueList, curTop);
      }

      let falseDepth = branchTop + (sub.falseList.length ? 0 : IF_EMPTY_BRANCH_LEN_PX);
      if (sub.falseList.length > 0) {
        let curTop = branchTop;
        for (const nodeIdx of sub.falseList) {
          curTop = layoutNode(nodeIdx, curTop, falseColX, visited, sub.joinIndex);
        }
        falseDepth = branchDepthAnchor(sub.falseList, curTop);
      }

      const reconnectPxY = Math.max(trueDepth, falseDepth) + IF_RECONNECT_GAP_PX;
      v.reconnectPxY = reconnectPxY; // ricongiunzione LOCALE dell'IF, usata dal rendering

      if (sub.joinIndex !== null && !visited.has(sub.joinIndex)) {
        // Gap FISSO in px: l'arco finale dell'IF ha lunghezza costante.
        // Il join torna sulla colonna del padre (centerX) e viene piazzato una sola volta.
        const joinTop = reconnectPxY + IF_JOIN_GAP_PX;
        return layoutNode(sub.joinIndex, joinTop, centerX, visited, stopIdx);
      }
      return reconnectPxY;
    }

    // GEOMETRIA RIVISTA (2026-07-04 notte-2, richiesta di Ismail + review Fable): il
    // corpo di un ciclo sta a DESTRA (colonna bodyColX, come il ramo true di un IF),
    // NON piu' nella stessa colonna del ciclo. L'uscita (next.false) resta invece
    // dritta in basso nella colonna PRINCIPALE (centerX) dopo il corpo. stopIdx
    // passato al corpo = idx (il ciclo stesso): il corpo termina quando il suo
    // back-edge torna al ciclo, quindi layoutNode deve fermarsi li' senza rientrarci.
    if (isBranchingNodeType(n.type) && n.type !== "if" && typeof n.next === "object" && n.next !== null) {
      const body = collectLoopBody(idx);
      const be = branchExtent(body.bodyList);
      // FIX #11 (Ismail 2026-07-08): come per l'IF, la colonna del corpo del ciclo deve
      // distare almeno mezza larghezza dell'esagono (piu' margine), cosi' un ciclo con testo
      // lungo non si sovrappone al corpo/etichetta.
      const loopHalfClear = (v.width || 100) / 2 + 34;
      // FIX (Ismail 2026-07-08): anche il NODO PIU' LARGO del corpo deve stare a destra del
      // centro (mezza larghezza + margine), cosi' un blocco largo nel corpo non sfora verso il
      // flusso principale/arco a sinistra. Per nodi da 100px (tutti i test) resta l'offset base.
      let _bodyHalf = 0; for (const _bi of body.bodyList) { const _bv = nodiVisualArray[_bi]; if (_bv && _bv.width) _bodyHalf = Math.max(_bodyHalf, _bv.width / 2); }
      const _bodyClear = Math.max(LOOP_BODY_X_OFFSET_PX, loopHalfClear, _bodyHalf + 30);
      const bodyColX = centerX + loopBodyOffset(idx).dBody; // FIX BUG 1/3/7: offset alzato dalla estensione in pixel del corpo
      const bodyTop = bottom + LOOP_BODY_START_Y_OFFSET_PX;
      let bodyBottom = bodyTop + (body.bodyList.length ? 0 : LOOP_EMPTY_BODY_LEN_PX);
      if (body.bodyList.length > 0) {
        let curTop = bodyTop;
        for (const nodeIdx of body.bodyList) {
                    curTop = layoutNode(nodeIdx, curTop, bodyColX, visited, idx);
        }
        bodyBottom = curTop;
      }
      v.reconnectPxY = bodyBottom; // fondo del corpo, usato dal rendering per il back-edge
      v.bodyColX = bodyColX;       // colonna del corpo (px assoluti), usata dal rendering

      // FIX round-4m (Ismail, screenshot: "il while quando ci metti un blocco dentro si
      // sovrappone l'arco con il blocco successivo"): quando l'ultimo membro del corpo e'
      // un nodo SEMPLICE (non branching) -- o il corpo e' VUOTO, che degenera allo stesso
      // caso -- `bodyBottom` qui sopra coincide ESATTAMENTE col vero bordo inferiore
      // visivo del corpo (rendering.js/drawLoopBranches usa la STESSA identica quantita'
      // come bodyBottomY in quel caso, verificato). Ma il back-edge (disegnato subito
      // dopo in rendering.js) scende ULTERIORMENTE oltre bodyBottom di
      // LOOP_BACKEDGE_GAP_PX (30px, o LOOP_BACKEDGE_GAP_DOWHILE_PX se l'ultimo membro e'
      // un Do-While -- ma un Do-While e' branching, quindi ricade gia' nel ramo "sicuro"
      // sotto) prima di ripiegare verso l'esagono. Il vecchio codice riservava qui SOLO
      // `LOOP_EXIT_GAP_PX` (28px, MINORE di 30) per il nodo successivo (l'uscita del
      // ciclo): il nodo di uscita finiva quindi posizionato 2px PRIMA che il back-edge
      // avesse finito di ripiegare, e poiche' la colonna del back-edge (cx+
      // BACKEDGE_SEP_PX) cade quasi sempre DENTRO la larghezza di un nodo di larghezza
      // normale, il gomito orizzontale del back-edge tagliava visivamente il blocco
      // successivo -- riprodotto ed esaminato con `arcCrossesForeignNode` esteso anche
      // ai segmenti NON cliccabili (il back-edge e' `salva=false`, quindi invisibile ai
      // controlli esistenti che guardano solo `frecce[]`).
      // Per un membro branching (IF/ciclo annidato) `bodyBottom` e' gia' un valore
      // "gonfiato" dalla propria catena ricorsiva di layout (sempre >= il vero bordo +
      // il proprio LOOP_EXIT_GAP_PX di quel figlio), quindi gia' sicuro per costruzione:
      // il fix si applica SOLO quando serve davvero (nodo semplice o corpo vuoto).
      const lastBodyLogic = body.bodyList.length > 0 ? flow.nodes[body.bodyList[body.bodyList.length - 1]] : null;
      const lastIsBranchingMember = !!(lastBodyLogic && isBranchingNodeType(lastBodyLogic.type));
      // FIX (Ismail 2026-07-07, 23.json: "l'arco del while si sovrappone col blocco End"):
      // il back-edge orizzontale sta a bodyBottom + LOOP_BACKEDGE_GAP_PX; il nodo d'uscita
      // era piazzato a bodyBottom + (LOOP_BACKEDGE_GAP_PX + LOOP_BODY_START_Y_OFFSET_PX),
      // quindi il suo BORDO SUPERIORE (centro - NODE_BASE_HEIGHT_PX/2) restava SOPRA il
      // back-edge -> quando il corpo e' profondo/largo il back-edge orizzontale (lungo, che
      // avvolge tutto il sottoalbero) passava dentro il bordo alto del nodo d'uscita (es.
      // End). Aggiungendo NODE_BASE_HEIGHT_PX/2 al gap, il bordo superiore del nodo d'uscita
      // finisce SEMPRE sotto il back-edge, qualunque sia la profondita'/larghezza del corpo.
      const exitGap = Math.max(LOOP_EXIT_GAP_PX, LOOP_BACKEDGE_GAP_PX + LOOP_BODY_START_Y_OFFSET_PX + NODE_BASE_HEIGHT_PX / 2);

      if (body.exitIndex !== null && !visited.has(body.exitIndex)) {
        const exitTop = bodyBottom + exitGap;
        return layoutNode(body.exitIndex, exitTop, centerX, visited, stopIdx);
      }
      return bodyBottom + exitGap;
    }

    if (typeof n.next === "string" && n.next !== null) {
      const nextIdx = parseInt(n.next, 10);
      if (!isNaN(nextIdx)) {
        if (nextIdx === stopIdx) return bottom;
        return layoutNode(nextIdx, bottom + NODE_VERTICAL_SPACING_PX, centerX, visited, stopIdx);
      }
    }


    return bottom + NODE_VERTICAL_SPACING_PX;
  }

  // FIX round-4c (Ismail 2026-07-06): il margine dall'alto usa CANVAS_TOP_MARGIN_PX
  // (dedicato, vedi state.js), non piu' NODE_VERTICAL_SPACING_PX/2.
  const startIndex = flow.nodes.findIndex(nd => nd && nd.type === "start");
  if (startIndex >= 0 && nodiVisualArray[startIndex]) {
    layoutNode(startIndex, CANVAS_TOP_MARGIN_PX, 0, new Set(), null);
  } else if (nodiVisualArray.length > 0) {
    layoutNode(0, CANVAS_TOP_MARGIN_PX, 0, new Set(), null);
  }
}

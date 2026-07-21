
// Ridimensiona il canvas per contenere i nodi e converte le posizioni assolute in
// pixel (node.pxX = offset dal centro, node.pxY = assoluto dall'alto) in relX/relY.
// Le posizioni px NON dipendono dalle dimensioni del canvas: ridimensionando la
// finestra il grafo mantiene la stessa forma, cambia solo la viewport.
function _bfRenderScale() {
  // WP-M2 (Ismail 2026-07-20, nuove impostazioni Prestazioni): "Risoluzione canvas ridotta"
  // salta il supersampling (backing = dimensione logica, mai x zoom x dpr): su telefoni
  // lenti il ridisegno costa fino a 9 volte meno pixel, al prezzo di un filo di nitidezza.
  if (typeof perfSettings !== 'undefined' && perfSettings && perfSettings.lowRes) return 1;
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
  _bfSyncCanvasGrid();
}
// WP-M5v (Ismail 2026-07-21, "con la griglia attiva, chiudendo terminale e variabili resta una
// parte di canvas senza griglia -- e anche zoomando"): la griglia era DIPINTA SUL CANVAS, quindi
// per definizione finiva dove finisce il canvas. E il canvas non copre sempre il contenitore:
//   - la sua dimensione tiene conto della larghezza del contenitore al momento del layout, ma
//     chiudendo sidebar/terminale il contenitore CRESCE senza che il layout venga rifatto;
//   - lo zoom lo scala via CSS (applyZoom qui sopra), quindi sotto il 100% e' piu' PICCOLO del
//     contenitore per costruzione, e con `margin: 0 auto` resta una fascia scoperta per lato.
// Nessuno dei due si risolve ingrandendo il canvas: sarebbe una rincorsa a ogni resize e a ogni
// scatto di zoom, e allo zoom-out il canvas dovrebbe crescere all'infinito. La griglia non e'
// contenuto del disegno, e' lo SFONDO su cui si disegna -- quindi va sul contenitore, dove copre
// sempre tutto lo spazio visibile qualunque siano zoom, pannelli e scroll.
// L'allineamento coi blocchi si mantiene ancorando lo sfondo all'angolo del canvas
// (background-position = offset del canvas) e scalando il passo con lo zoom, come i blocchi.
// `background-attachment: local` lo fa scorrere insieme al contenuto invece di restare fisso.
const BF_GRID_STEP = 24;
function _bfSyncCanvasGrid() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const cont = document.getElementById('canvas-container');
  if (!cont || !cont.style) return;
  const on = (typeof viewSettings !== 'undefined' && viewSettings && viewSettings.showGrid);
  if (!on) { cont.style.backgroundImage = ''; return; }
  const z = (typeof zoom === 'number' && zoom > 0) ? zoom : 1;
  const step = BF_GRID_STEP * z;
  const base = (typeof themeCanvasLineColor === 'function') ? themeCanvasLineColor() : '#000';
  // Stessa resa di prima (colore linea del tema all'8%): discreto su ogni tema, chiaro o scuro.
  const col = 'color-mix(in srgb, ' + base + ' 8%, transparent)';
  let ox = 0, oy = 0;
  try { if (typeof canvas !== 'undefined' && canvas) { ox = canvas.offsetLeft || 0; oy = canvas.offsetTop || 0; } } catch (e) {}
  cont.style.backgroundImage =
    'linear-gradient(to right, ' + col + ' 1px, transparent 1px),' +
    'linear-gradient(to bottom, ' + col + ' 1px, transparent 1px)';
  cont.style.backgroundSize = step + 'px ' + step + 'px, ' + step + 'px ' + step + 'px';
  cont.style.backgroundPosition = ox + 'px ' + oy + 'px, ' + ox + 'px ' + oy + 'px';
  cont.style.backgroundAttachment = 'local, local';
}
if (typeof window !== 'undefined') window._bfSyncCanvasGrid = _bfSyncCanvasGrid;

// WP-M5z (Ismail 2026-07-21): INDICATORE FPS, attivabile da Impostazioni -> Prestazioni.
// Non accelera nulla: serve a MISURARE. Dopo una giornata di segnalazioni "lagga" in cui ogni
// volta ho dovuto scrivere un harness per capire dove andasse il tempo, avere un numero a
// schermo fa partire la prossima diagnosi da un dato invece che da un'impressione.
// Misura i frame reali del browser (requestAnimationFrame): se durante un'esecuzione crolla,
// il collo di bottiglia e' nel disegno o nel DOM; se resta alto ma l'app sembra lenta, il
// tempo se ne va altrove (calcolo, console, layout).
var _bfFpsRaf = 0, _bfFpsCount = 0, _bfFpsLast = 0;
function _bfFpsTick(ts) {
  _bfFpsRaf = 0;
  if (typeof perfSettings === 'undefined' || !perfSettings || !perfSettings.fps) return;
  _bfFpsCount++;
  if (!_bfFpsLast) _bfFpsLast = ts || 0;
  const now = ts || 0;
  if (now - _bfFpsLast >= 500) { // aggiornamento due volte al secondo: leggibile, non nervoso
    const fps = Math.round((_bfFpsCount * 1000) / (now - _bfFpsLast));
    const el = document.getElementById('bf-fps');
    if (el) el.textContent = fps + ' FPS';
    _bfFpsCount = 0; _bfFpsLast = now;
  }
  _bfFpsRaf = (window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); })(_bfFpsTick);
}
function _bfSyncFpsMeter() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const on = (typeof perfSettings !== 'undefined' && perfSettings && perfSettings.fps);
  let el = document.getElementById('bf-fps');
  if (!on) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (_bfFpsRaf) { try { cancelAnimationFrame(_bfFpsRaf); } catch (e) {} _bfFpsRaf = 0; }
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'bf-fps';
    el.textContent = '– FPS';
    if (document.body) document.body.appendChild(el);
  }
  if (!_bfFpsRaf) {
    _bfFpsCount = 0; _bfFpsLast = 0;
    _bfFpsRaf = (window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); })(_bfFpsTick);
  }
}
if (typeof window !== 'undefined') window._bfSyncFpsMeter = _bfSyncFpsMeter;
// Centra la vista sul grafo (orizzontalmente al centro del canvas, dove sta il
// flusso principale). Chiamata sui cambi di zoom: senza, aumentando lo zoom il
// grafo scivolava verso destra fuori dalla viewport.
//
// FIX v2 (Ismail 2026-07-10, "qua non ha centrato bene, funziona ma non sempre"):
// prima la funzione si appoggiava SOLO su scrollLeft, che pero' il browser puo'
// muovere SOLO se il canvas e' PIU' LARGO dell'area visibile del container (c'e'
// overflow reale da scorrere). Per un grafo piccolo (es. solo Inizio/Fine) il canvas
// e' spesso PIU' STRETTO del container -> scrollWidth cede completamente, non c'e'
// overflow da scorrere, scrollLeft resta bloccato a 0 qualunque valore gli si dia, e
// il grafo restava dov'era (a filo della sidebar) invece di centrarsi nello spazio
// vuoto fra sidebar e console. Il CSS (canvas{margin:0 auto} + margin-right dinamico
// sul container) dovrebbe coprire questo caso, ma dipende da un ricalcolo preciso
// della griglia che non sempre e' aggiornato nel momento esatto della chiamata.
// Ora la funzione e' autosufficiente: assorbe quanto puo' con lo scroll (caso canvas
// piu' largo), poi il resto del disallineamento lo applica DIRETTAMENTE come margine
// sul canvas (caso canvas piu' stretto) — cosi' il centraggio funziona SEMPRE,
// indipendentemente da quale dei due casi si presenta.
function centerGraph() {
  if (typeof container === 'undefined' || !container || !canvas) return;
  if (typeof container.getBoundingClientRect !== 'function' || typeof canvas.getBoundingClientRect !== 'function') return;
  // Azzera un eventuale aggiustamento manuale lasciato dalla chiamata precedente,
  // cosi' le misure qui sotto riflettono la posizione "naturale" (CSS pura) del canvas,
  // non quella gia' corretta l'ultima volta (altrimenti l'offset si accumulerebbe).
  canvas.style.marginLeft = '';
  canvas.style.marginRight = '';

  // WP-6 v2 (2026-07-19, algoritmo RIFATTO su richiesta di Ismail — "non viene ancora
  // centrato bene"). BUG del vecchio calcolo: sottraeva SEMPRE l'intera larghezza della
  // console dal rect del container ("rightCover"), ma il container e' GIA' ristretto dal
  // CSS (margin-right/left: var(--console-cover-width), style.css #canvas-container e
  // regola RTL): il suo rect finisce di norma AL BORDO della console. Risultato: console
  // sottratta DUE volte -> bersaglio spostato di mezza console (grafo "spinto" a sinistra
  // in LTR, a destra in RTL, tanto piu' quanto piu' larga e' la console -- il sintomo
  // esatto). L'harness passava perche' il suo stub modellava un container NON ristretto.
  //
  // NUOVO MODELLO (fisico, per rect reali, nessun ramo LTR/RTL): l'area visibile parte
  // dal rect del container e viene RITAGLIATA solo della parte di console (e sidebar,
  // durante le transizioni di apertura/chiusura) che vi si SOVRAPPONE davvero in questo
  // istante. Cosi': var CSS gia' applicata -> sovrapposizione zero -> nessuna sottrazione;
  // var in ritardo di un frame -> si sottrae esattamente la parte scoperta. In arabo non
  // serve alcun ramo dedicato: la console sta fisicamente a sinistra, il ritaglio taglia
  // da solo il bordo giusto ("l'algoritmo si inverte" gratis, per costruzione).
  const cRect = container.getBoundingClientRect();
  let visibleLeft = cRect.left, visibleRight = cRect.right;
  const _bfShaveOverlap = function (el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const r = el.getBoundingClientRect();
    if (!r || !(r.width > 0) || !(visibleRight > visibleLeft)) return;
    if (r.right <= visibleLeft || r.left >= visibleRight) return; // nessuna sovrapposizione
    const fromLeft = r.right - visibleLeft;   // costo se lo si toglie dal bordo sinistro
    const fromRight = visibleRight - r.left;  // costo se lo si toglie dal bordo destro
    if (fromLeft <= fromRight) visibleLeft += fromLeft; else visibleRight -= fromRight;
  };
  const cons = (typeof document !== 'undefined') ? document.getElementById('console-popup') : null;
  if (cons && cons.classList && typeof cons.classList.contains === 'function' && cons.classList.contains('active') && cons.classList.contains('docked')) {
    _bfShaveOverlap(cons);
  }
  const _sb = (typeof document !== 'undefined') ? document.getElementById('sidebar') : null;
  const _mainEl = (typeof document !== 'undefined') ? document.getElementById('main') : null;
  const _sbCollapsed = _mainEl && _mainEl.classList && typeof _mainEl.classList.contains === 'function' && _mainEl.classList.contains('sidebar-collapsed');
  if (_sb && !_sbCollapsed) _bfShaveOverlap(_sb);

  const visibleW = Math.max(60, visibleRight - visibleLeft);
  const targetCenter = visibleLeft + visibleW / 2;

  const canRect = canvas.getBoundingClientRect();
  const canvasCenter = canRect.left + canRect.width / 2;
  let delta = canvasCenter - targetCenter; // >0 = canvas troppo a destra, va spostato a sinistra

  // 1) Assorbi quanto possibile con lo scroll — funziona solo se c'e' overflow reale
  //    (canvas piu' largo dell'area visibile del container).
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  const prevScrollLeft = container.scrollLeft;
  let newScrollLeft = prevScrollLeft + delta;
  newScrollLeft = Math.max(0, Math.min(maxScroll, newScrollLeft));
  container.scrollLeft = newScrollLeft;
  delta -= (newScrollLeft - prevScrollLeft); // quanto NON e' stato assorbito dallo scroll

  // 2) Il resto (caso tipico: canvas piu' STRETTO dell'area visibile, niente overflow da
  //    scorrere) si applica come margine diretto sul canvas, cosi' si centra per davvero
  //    nello spazio libero reale — non importa se il margin-right CSS del container
  //    (--console-cover-width) ha gia' "fatto presa" sulla larghezza del container oppure no.
  if (Math.abs(delta) > 0.5) {
    const cs = (typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(canvas) : null;
    const curML = cs ? (parseFloat(cs.marginLeft) || 0) : 0;
    canvas.style.marginLeft = (curML - delta) + 'px';
    canvas.style.marginRight = '0px';
  }
}
// R14-E (Ismail 2026-07-13): lo zoom e' una delle sorgenti che il piano elenca esplicitamente
// per il tick condiviso _bfSidebarLiveResizeTick() (init.js) -- non cambia S/C, ma passare
// dallo STESSO punto di ricalcolo (invece di un centerGraph() isolato) mantiene un solo
// percorso per "qualunque evento che tocca il layout", coerente con gli altri trigger.
function _bfLayoutTickOrCenter() { if (typeof _bfSidebarLiveResizeTick === 'function') _bfSidebarLiveResizeTick(); else if (typeof centerGraph === 'function') centerGraph(); }
function zoomIn() { zoom = Math.min(ZOOM_MAX, +(zoom * ZOOM_STEP).toFixed(4)); _bfZoomRerender(); _bfLayoutTickOrCenter(); }
function zoomOut() { zoom = Math.max(ZOOM_MIN, +(zoom / ZOOM_STEP).toFixed(4)); _bfZoomRerender(); _bfLayoutTickOrCenter(); }
function zoomReset() { zoom = 1; _bfZoomRerender(); _bfLayoutTickOrCenter(); }
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
// AUDIT 2026-07-19 (falla #4): controllo di sintassi di un'espressione SENZA `new Function`
// e senza `eval`. Prima si usava `new Function('return ('+expr+')')` che COMPILA (non esegue,
// quindi nessun RCE) ma: (a) è un code-smell che un domani qualcuno potrebbe trasformare in
// esecuzione; (b) valida la grammatica JS, non quella di safeEval (l'evaluatore reale) ->
// disallineamento. Ora: si NEUTRALIZZANO gli identificatori (ogni nome di variabile -> `1`,
// tranne Math/true/false/null) e si passa il risultato a safeEvaluate (parser sicuro, allowlist,
// nessun accesso a globali). Se safeEvaluate parsa/valuta senza lanciare, la sintassi è valida;
// se lancia, è un errore -> nodo rosso. Un'espressione con un identificatore diventa es. `1 + 1`,
// una malformata (`2 +`, `(1+2`) fa lanciare safeEvaluate come faceva new Function.
function _bfExprSyntaxOk(expr) {
  if (typeof safeEvaluate !== 'function') return true; // safeEval non caricato: non segnalare falsi errori
  // WP-M2 (Ismail 2026-07-20, tipo Array): `nome.length` va neutralizzato PER INTERO a `1`
  // (non solo il nome: `1.length` non e' grammatica valida), tranne Math.* che resta intatto.
  var neutral = String(expr).replace(/([A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*length\b/g, function (m, id) {
    return id === 'Math' ? m : '1';
  });
  neutral = neutral.replace(/[A-Za-z_$][A-Za-z0-9_$]*/g, function (id, offset, whole) {
    // Lascia intatto il nome di un MEMBRO dopo il punto (es. la `max` in `Math.max`):
    // safeEval accetta solo `Math.<fn>`, neutralizzarlo lo romperebbe. Idem per Math/booleani/null.
    if (offset > 0 && whole[offset - 1] === '.') return id;
    if (id === 'Math' || id === 'true' || id === 'false' || id === 'null') return id;
    return '1';
  });
  // WP-M2: laxIndex -- l'indicizzazione `a[i]` (identificatori gia' neutralizzati a `1`)
  // valida solo la GRAMMATICA, senza pretendere un array/range reale in fase di editing.
  try { safeEvaluate(neutral, { laxIndex: true }); return true; }
  catch (e) { return false; }
}
// Validazione del CONTENUTO di un nodo (Ismail 2026-07-07): se il contenuto e' vuoto
// dove richiesto o sintatticamente invalido, il blocco viene segnalato in ROSSO nel
// rendering (come nell'esempio Flowgorithm). Il controllo di sintassi passa da
// _bfExprSyntaxOk (safeEval, nessun new Function/eval -- vedi sopra).
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
      if (!_bfExprSyntaxOk(info)) return true; // condizione: espressione valida?
    } else if (t === 'assign' || t === 'assignment') {
      const m = info.match(/^\s*([A-Za-z_]\w*(\s*\[[^\]]*\])?)\s*(=|\+=|-=|\*=|\/=|%=)\s*([\s\S]+)$/);
      if (!m) return true;                    // deve avere forma "var = espr"
      if (!_bfExprSyntaxOk(m[4])) return true; // parte destra valida?
      // WP-M5 (audit array 2026-07-21): valida anche l'ESPRESSIONE-INDICE della sinistra
      // ("a[i+1] = 5") -- prima la regex accettava qualunque cosa fra le quadre, quindi un
      // indice malformato ("a[2+] = 5") non veniva mai segnalato in rosso e l'errore
      // arrivava solo a runtime. Indice VUOTO ("a[] = 5") e' comunque invalido.
      if (m[2]) {
        const _idx = m[2].replace(/^\s*\[|\]\s*$/g, '').trim();
        if (_idx === '' || !_bfExprSyntaxOk(_idx)) return true;
      }
    } else if (t === 'output' || t === 'print' || t === 'write') {
      // print/output usano un parsing custom (splitStrings in execute.js) che accetta
      // stringhe e concatenazioni miste: qui NON facciamo un controllo di sintassi rigido
      // (darebbe falsi positivi) -- basta che non sia vuoto, gia' verificato sopra.
    } else if (t === 'input' || t === 'read') {
      const mi2 = info.match(/^([A-Za-z_]\w*)(\s*\[([^\]]*)\])?$/);
      if (!mi2) return true;                       // nome di variabile valido?
      // WP-M5: stessa validazione dell'indice fatta per Assegna ("Ingresso a[i+1]").
      if (mi2[2]) {
        const _idx2 = (mi2[3] || '').trim();
        if (_idx2 === '' || !_bfExprSyntaxOk(_idx2)) return true;
      }
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
      if (!_bfExprSyntaxOk(mi[2])) return true;          // init: espressione valida?
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
      // R13-G (Ismail 2026-07-12, "con testo lungo si allarga un sacco orizzontalmente ma non
      // cresce in verticale -- non sembra piu' un rombo"): il ramo `single` (1 sola riga)
      // ignorava completamente la larghezza appena calcolata e fissava SEMPRE height=BASE_H
      // (40px) -- un rombo che si allarga a 440px di larghezza restando alto 40px e' visivamente
      // uno strato appiattito, non un rombo. Il fattore di forma (rapporto BASE_H/BASE_W, lo
      // stesso di un rombo "normale" a testo corto) va applicato all'ALTEZZA quanto la
      // larghezza cresce, non solo quando il testo va a capo (caso multi-riga, gia' corretto
      // sotto con 2*th+16). Pavimento comune width*aspetto in ENTRAMBI i rami, cosi' anche un
      // rombo multi-riga ma molto largo (poche righe, testo lungo su ciascuna) resta proporzionato.
      const diamondAspect = BASE_H / BASE_W; // rapporto del rombo "base" (testo corto): 40/100
      const shapeFloor = width * diamondAspect;
      height = single ? Math.max(BASE_H, shapeFloor) : Math.max(BASE_H, 2 * th + 16, shapeFloor);
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
    // WP-7 (2026-07-19): ora che il primo nodo del corpo è ancorato in CIMA (all'altezza di
    // cy dell'esagono, non più sotto il suo fondo — vedi bodyTop in layoutNode), il suo BORDO
    // sinistro deve superare il BORDO destro dell'esagono, altrimenti con una condizione lunga
    // (esagono LARGO) il figlio, ora affiancato verticalmente, gli si sovrappone. loopHalfClear
    // garantiva solo che il CENTRO della colonna distasse hexHalf+34, non che il bordo del
    // nodo (che sporge di bodyHalf a sinistra del proprio centro) fosse oltre l'esagono. Nuovo
    // termine: hexHalf + bodyHalf + 15. Per i nodi base (hexHalf=50, bodyHalf=50) vale 115 =
    // esattamente LOOP_BODY_X_OFFSET_PX già dominante -> nessuno spostamento nei 300+ casi
    // base; solo gli esagoni CRESCIUTI in larghezza spingono la colonna del corpo più a destra.
    const hexPlusBodyClear = (v.width || 100) / 2 + bodyHalf + 15;
    const bodyClear = Math.max(LOOP_BODY_X_OFFSET_PX, loopHalfClear, bodyHalf + 30, hexPlusBodyClear);
    const beP = groupPxExtent(body.bodyList);
    const dBody = Math.max(bodyClear + be.L * LOOP_BODY_X_OFFSET_PX, beP.L + PX_CLEAR_MARGIN);
    return { dBody, beP };
  }
  // P6.2 (round 15-B S6, Ismail 2026-07-15): rileva se una lista di nodi (corpo di un
  // Do-While) contiene un Do-While annidato a QUALSIASI profondita' -- ricorre dentro i rami
  // di un If e il corpo di un altro ciclo, stessa forma di traversata del fix gemello in
  // rendering.js (drawDoWhileBranches/_considerSubtree). Usata SOLO per decidere se
  // subtreePxExtent deve riservare l'extra BACKEDGE_SEP_PX (vedi sotto) -- NON per il caso
  // generico (corpo largo/If/ciclo senza alcun Do-While dentro), che non ne ha bisogno.
  function _hasNestedDo(list) {
    for (const bi of list) {
      const bt = flow.nodes[bi] && flow.nodes[bi].type;
      if (bt === 'do') return true;
      if (bt === 'if' && typeof collectBranchNodes === 'function') {
        const s = collectBranchNodes(bi);
        if (_hasNestedDo(s.trueList) || _hasNestedDo(s.falseList)) return true;
      } else if (bt && isBranchingNodeType(bt) && bt !== 'if' && typeof collectLoopBody === 'function') {
        if (_hasNestedDo(collectLoopBody(bi).bodyList)) return true;
      }
    }
    return false;
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
      // P6.2 (round 15-B S6, Ismail 2026-07-15, screenshot 170939 "do-while annidati: archi
      // False sovrapposti"): il corpo di un Do-While non si scosta lateralmente (stessa
      // colonna del proprio esagono, vedi layoutDoWhileNode) -- quindi se il corpo contiene
      // un Do-While annidato (a QUALSIASI profondita', anche dietro un If/altro ciclo, che
      // pero' scostano gia' abbastanza da soli via i propri offset ben piu' larghi), beP.L
      // include GIA' la riserva per il SUO back-edge, misurata dalla STESSA colonna
      // condivisa in caso di annidamento DIRETTO -- serve un BACKEDGE_SEP_PX aggiuntivo
      // perche' i due back-edge (di questo Do-While e di quello annidato) reclamino due
      // fasce distinte, non la stessa.
      // FIX (Ismail 2026-07-15, "non dovevi spostare l'etichetta True dell'if, rimettila
      // come prima"): la prima versione sommava BACKEDGE_SEP_PX a beP.L INCONDIZIONATAMENTE,
      // anche quando il corpo NON contiene alcun Do-While annidato (es. un solo blocco largo,
      // o un If) -- allargando la colonna (e quindi spostando trueX/falseX e le etichette
      // True/False di un IF antenato che lo contenesse) senza alcun motivo reale. Ridotta ad
      // un extra condizionale (nestedDoExtra, sotto _hasNestedDo) SOLO per un Do-While annidato.
      //
      // BUG TROVATO (Ismail 2026-07-19, "For con testo lungo: gli archi si sovrappongono",
      // file reale problemaaa.json -- While{ Do-While{ For{ If{ While } } } }): quel fix era
      // troppo restrittivo. Il back-edge di QUESTO Do-While (drawDoWhileBranches, rendering.js)
      // e' SEMPRE `leftMostBodyLeft - BACKEDGE_SEP_PX`, dove leftMostBodyLeft e' il bordo
      // sinistro REALE del contenuto del corpo (la stessa quantita' misurata da beP.L) --
      // QUALUNQUE sia il contenuto, non solo un Do-While annidato: il back-edge si scosta
      // SEMPRE di un BACKEDGE_SEP_PX aggiuntivo oltre il corpo, e' la sua stessa formula di
      // disegno, non un caso speciale del Do-While annidato. Riservare solo `beP.L` (senza
      // quell'ulteriore scostamento) quando beP.L e' il termine dominante -- caso "un solo
      // blocco LARGO nel corpo, niente Do-While annidato", ESATTAMENTE quello lasciato
      // scoperto dal fix precedente -- sotto-riserva di 22px: con un For abbastanza largo
      // (testo lungo, es. "i = 0; i <= 1; i += 1") il back-edge di questo Do-While finisce
      // per invadere la colonna FISSA dell'uscita di un While/For ANTENATO (che non ha alcuna
      // elasticita' propria, scende sempre dritta nella propria colonna) -- confermato
      // visivamente (SVG headless) e con `problemaaa.json` di Ismail: gap fra le due colonne
      // sceso da 42px (For vuoto) a 8px (For col testo reale), poi negativo/incrociato una
      // volta sommato lo spessore reale dei tratti. Fix: BACKEDGE_SEP_PX si somma SEMPRE a
      // beP.L (non solo quando c'e' un Do-While annidato) -- fattorizzando i due rami del max,
      // e' equivalente a `Math.max(half, beP.L) + BACKEDGE_SEP_PX`, cioe' esattamente la
      // formula reale del back-edge, mai una sotto-stima. Nel ramo "half domina" (corpo non
      // piu' largo dell'esagono stesso -- il caso del fix 2026-07-15, "un solo If normale")
      // il valore resta IDENTICO a prima (half+BACKEDGE_SEP_PX gia' vinceva il max anche
      // prima): nessuna regressione sull'etichetta True segnalata allora. nestedDoExtra
      // (sopra ancora usato per l'annidamento diretto Do-in-Do, dove il figlio e' esso stesso
      // un altro Do-While con la stessa formula ricorsiva) resta com'era.
      const nestedDoExtra = _hasNestedDo(body.bodyList) ? BACKEDGE_SEP_PX : 0;
      res = { L: Math.max(half + BACKEDGE_SEP_PX, beP.L + BACKEDGE_SEP_PX + nestedDoExtra), R: Math.max(half, beP.R) };
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
      // WP-7 (piano gravi P9.4+P9.3, 2026-07-19): il primo nodo del corpo va ancorato in
      // CIMA all'arco (vicino al centro dell'esagono, cy), NON sotto il suo bordo inferiore.
      // Prima: bodyTop = bottom + LOOP_BODY_START_Y_OFFSET_PX -> l'arco d'ingresso al corpo
      // (drawLine da cy a entryTopY(primo), rendering.js) era lungo hexH/2 + offset, quindi
      // CRESCEVA con l'altezza dell'esagono: con una condizione lunga (esagono alto) il primo
      // figlio finiva spinto in basso con molto vuoto sopra (P9.4), e in un while-in-while
      // l'arco del figlio risultava "alto quanto il padre" (P9.3). Il corpo vive in una
      // COLONNA A DESTRA (bodyColX, sempre libera), quindi può iniziare all'altezza di cy
      // senza sovrapporsi all'esagono. Ancorando a `bottom - hexH/2` (= cy in coord. di
      // layout) + una costante, l'arco diventa COSTANTE (~30px) qualunque sia l'altezza.
      // La costante NODE_BASE_HEIGHT_PX/2 + LOOP_BODY_START_Y_OFFSET_PX (=20+10=30) è scelta
      // così che per un esagono di altezza BASE (hexH=40, tutti i 300+ casi degli harness) il
      // valore coincida ESATTAMENTE con il precedente (bottom-20+30 = bottom+10): nessuna
      // regressione, solo gli esagoni CRESCIUTI (condizione lunga) vengono corretti.
      // NB sicurezza: l'uscita del ciclo (colonna centrale, sotto) resta protetta dal guard
      // maxYAtColumn dell'esagono e dall'exitGap (che si clampa comunque sotto diaBottom), e
      // il back-edge è già clampato sotto diaBottom -- spostare il corpo su non li tocca.
      const _hexH = (v.height || NODE_BASE_HEIGHT_PX);
      const bodyTop = bottom - _hexH / 2 + (NODE_BASE_HEIGHT_PX / 2 + LOOP_BODY_START_Y_OFFSET_PX);
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
      // R15D (Ismail 2026-07-15, "dopo i cicli annidati l'arco per il nodo successivo si
      // allunga troppo"): qui NON c'e' un nodo d'uscita reale in avanti -- questo ciclo e'
      // l'ULTIMO membro del corpo di un ciclo/IF PADRE e la sua "uscita" e' il back-edge del
      // padre (indice gia' visitato, ramo else di questo if). Riservare l'intero exitGap
      // (=60px, dimensionato per fare spazio a un NODO sotto il back-edge) qui e' inutile:
      // nessun nodo verra' piazzato. Basta separare il back-edge orizzontale di QUESTO ciclo
      // da quello del padre che lo avvolge -> un solo LOOP_BACKEDGE_GAP_PX (30px). Cosi' una
      // catena di N cicli annidati accumula ~30px/livello invece di ~60, e la linea d'uscita
      // del ciclo piu' esterno si accorcia della meta', mantenendo un gap standard tra i
      // back-edge concentrici (nessuna sovrapposizione). Il ramo con nodo d'uscita REALE
      // (sopra) resta invariato: li' l'intero exitGap serve davvero ed e' mantenuto.
      return bodyBottom + LOOP_BACKEDGE_GAP_PX;
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

// ============================================================================
// TURTLE GRAPHICS (Ismail 2026-07-08, round 2) — replica FEDELE della grafica tartaruga
// di Flowgorithm. Cinque blocchi grafici:
//   forward  (Move/Draw): muove la tartaruga di una distanza; se la penna e' giu' disegna.
//   turn                 : ruota la direzione della tartaruga di N gradi (destra/sinistra).
//   home                 : riporta la tartaruga alla posizione iniziale (centro), heading 0.
//   pen                  : imposta penna giu'/su, colore e spessore.
//   gclear (Clear Screen): pulisce lo schermo e riporta la tartaruga a casa.
// Riferimento: flowgorithm.org/documentation (Forward, Turn, Home, Pen, Clear).
// Convenzione: heading 0 = SU (nord); rotazione positiva = ORARIA (destra).
// Tela 300x300 px, "casa" al centro (150,150).
// ============================================================================

var TURTLE_TYPES = ['forward', 'turn', 'home', 'pen', 'gclear'];
// FIX (Ismail 2026-07-10): tela "teoricamente infinita" come il canvas principale.
// TG_W/TG_H NON sono piu' fissi a 300 -- sono la dimensione LOGICA del contenuto reale
// (bounding box di tutte le tracce + posizione tartaruga, margine incluso), ricalcolata da
// _tgRecomputeBounds() a ogni mossa: cresce SOLO quando la tartaruga esce dall'area gia'
// disegnata. Casa (0,0 in coordinate ASSOLUTE, mai limitate) all'inizio sta al centro di una
// tela 300x300 di default -- identico a prima -- e via via che il disegno si allarga la tela
// segue, restando scrollabile in #draw-scroll (overflow:auto, invariato).
// _tgOriginX/_tgOriginY spostano le coordinate ASSOLUTE della tartaruga (mai clampate, puo'
// andare a X/Y negativi) nello spazio PIXEL della tela corrente: canvasX = x + _tgOriginX.
var TG_W = 300, TG_H = 300;
var TG_HOME_X = 0, TG_HOME_Y = 0; // casa = origine assoluta (0,0), non piu' legata alla dimensione della tela
var _tgOriginX = 150, _tgOriginY = 150; // default: casa al centro di una tela 300x300 (come prima)
// stato tartaruga (coordinate ASSOLUTE, illimitate: NON sono coordinate sulla tela)
var _tg = { x: TG_HOME_X, y: TG_HOME_Y, head: 0, pen: true, color: '#000000', width: 2 };
var _tgShowTurtle = true; // marcatore tartaruga visibile (toggle nel pannello)
var _tgSegments = []; // tracce disegnate {x1,y1,x2,y2,color,width} in coordinate ASSOLUTE (non sulla tela: l'offset si applica solo in fase di rendering, vedi _tgOriginX/Y)
var _TG_SAVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
var _TG_CLEAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
var _TG_EYE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
var _TG_EYE_OFF = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function _dt(key, fb) { try { const s = (typeof i18nText === 'function') ? i18nText(key) : null; return s || fb; } catch (e) { return fb; } }

function ensureTurtlePanel() {
  if (typeof document === 'undefined' || !document.createElement) return null;
  let p = document.getElementById('draw-output-panel');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'draw-output-panel';
  p.innerHTML =
    '<div id="draw-output-head">' +
      '<span id="draw-output-title">' + _dt('tg_output', 'Grafica tartaruga') + '</span>' +
      '<button id="draw-output-turtle" class="x-close bf-icon" data-i18n-title="tg_toggle_turtle" title="' + _dt('tg_toggle_turtle', 'Mostra/nascondi tartaruga') + '" aria-label="turtle">' + _TG_EYE + '</button>' +
      '<button id="draw-output-save" class="x-close bf-icon" data-i18n-title="tg_save" title="' + _dt('tg_save', 'Salva immagine') + '" aria-label="save">' + _TG_SAVE + '</button>' +
      '<button id="draw-output-clear" class="x-close bf-icon" data-i18n-title="tg_clear_btn" title="' + _dt('tg_clear_btn', 'Pulisci disegno') + '" aria-label="clear">' + _TG_CLEAR + '</button>' +
      '<button id="draw-output-close" class="x-close bf-icon" data-i18n-title="close" title="' + _dt('close', 'Chiudi') + '" aria-label="close">&times;</button>' +
    '</div>' +
    '<div id="draw-scroll"><div id="draw-canvas-stack">' +
      '<canvas id="draw-canvas" width="' + TG_W + '" height="' + TG_H + '"></canvas>' +
      '<canvas id="draw-turtle" width="' + TG_W + '" height="' + TG_H + '"></canvas>' +
    '</div></div>' +
    '<div id="draw-zoom">' +
      '<button id="draw-zoom-in" data-i18n-title="tip_zoom_in" title="' + _dt('tip_zoom_in', 'Zoom avanti') + '" onclick="tgZoomIn()">+</button>' +
      '<button id="draw-zoom-out" data-i18n-title="tip_zoom_out" title="' + _dt('tip_zoom_out', 'Zoom indietro') + '" onclick="tgZoomOut()">\u2212</button>' +
      '<button id="draw-zoom-reset" data-i18n-title="tip_zoom_reset" title="' + _dt('tip_zoom_reset', 'Reset zoom') + '" onclick="tgZoomReset()">\u21BA</button>' +
    '</div>' +
    '<div class="tg-rz" data-dir="n"></div><div class="tg-rz" data-dir="s"></div>' +
    '<div class="tg-rz" data-dir="e"></div><div class="tg-rz" data-dir="w"></div>' +
    '<div class="tg-rz" data-dir="ne"></div><div class="tg-rz" data-dir="nw"></div>' +
    '<div class="tg-rz" data-dir="se"></div><div class="tg-rz" data-dir="sw"></div>';
  if (!document.body || typeof document.body.appendChild !== 'function') return null;
  try { document.body.appendChild(p); } catch (e) { return null; }
  const on = function (id, ev, fn) { const el = p.querySelector('#' + id); if (el) el.addEventListener(ev, fn); };
  on('draw-output-close', 'click', function () { p.style.display = 'none'; });
  on('draw-output-clear', 'click', function () { execClearScreen(); });
  on('draw-output-save', 'click', function () { _tgSaveImage(); });
  on('draw-output-turtle', 'click', function () {
    _tgShowTurtle = !_tgShowTurtle;
    const b = p.querySelector('#draw-output-turtle');
    if (b) { b.classList.toggle('off', !_tgShowTurtle); b.innerHTML = _tgShowTurtle ? _TG_EYE : _TG_EYE_OFF; }
    redrawTurtleMarker();
  });
  _tgSetupDragResize(p);
  // Gestione a finestre (come terminale/picker): il click porta il pannello in primo piano.
  p.addEventListener('mousedown', function () { if (typeof bfBringToFront === 'function') bfBringToFront(p); }, true);
  return p;
}

// Salva il disegno come PNG (sfondo bianco + tracce + tartaruga se visibile).
function _tgSaveImage() {
  const src = document.getElementById('draw-canvas'); if (!src) return;
  let tmp; try { tmp = document.createElement('canvas'); } catch (e) { return; }
  tmp.width = TG_W; tmp.height = TG_H;
  const c = tmp.getContext && tmp.getContext('2d'); if (!c) return;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, TG_W, TG_H);
  try { c.drawImage(src, 0, 0); } catch (e) {}
  if (_tgShowTurtle) { const t = document.getElementById('draw-turtle'); if (t) { try { c.drawImage(t, 0, 0); } catch (e) {} } }
  try {
    const a = document.createElement('a'); a.href = tmp.toDataURL('image/png'); a.download = 'turtle-drawing.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } catch (e) {}
}

// Rende il pannello della tartaruga SPOSTABILE (trascina dall'intestazione) e
// RIDIMENSIONABILE (maniglia in basso a destra; le tele scalano via CSS, la risoluzione
// interna 300x300 resta invariata cosi' le coordinate del disegno non cambiano).
function _tgSetupDragResize(p) {
  const head = p.querySelector('#draw-output-head');
  const stack = p.querySelector('#draw-canvas-stack');
  let drag = false, dx = 0, dy = 0, ox = 0, oy = 0;
  if (head) head.addEventListener('mousedown', function (e) {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const r = p.getBoundingClientRect();
    drag = true; ox = r.left; oy = r.top; dx = e.clientX; dy = e.clientY;
    p.style.left = ox + 'px'; p.style.top = oy + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto';
    if (document.body && document.body.style) document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  // Ridimensionamento da TUTTI i lati/angoli (8 maniglie).
  let rz = false, rdir = '', rx = 0, ry = 0, rw = 0, rh = 0, rl = 0, rt = 0;
  const handles = p.querySelectorAll('.tg-rz');
  for (let i = 0; i < handles.length; i++) {
    handles[i].addEventListener('mousedown', function (e) {
      if (!stack) return;
      // FIX (Ismail 2026-07-10): rw/rh devono essere le dimensioni del PANNELLO (p), non
      // della tela (stack) -- il resize sposta/ridimensiona il pannello, non la tela. Prima
      // funzionava "per caso" perche' la tela era sempre forzata quadrata e vicina alla
      // dimensione del pannello; ora che la tela cresce col disegno (es. 600x300 dopo dei
      // Forward) usare le sue dimensioni qui faceva scattare il pannello a una larghezza
      // sballata anche trascinando solo in verticale.
      const pr = p.getBoundingClientRect();
      rz = true; rdir = this.getAttribute('data-dir') || 'se';
      rx = e.clientX; ry = e.clientY; rw = pr.width; rh = pr.height; rl = pr.left; rt = pr.top;
      p.style.left = rl + 'px'; p.style.top = rt + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto';
      if (document.body && document.body.style) document.body.style.userSelect = 'none';
      e.preventDefault(); e.stopPropagation();
    });
  }
  window.addEventListener('mousemove', function (e) {
    if (drag) { p.style.left = (ox + e.clientX - dx) + 'px'; p.style.top = (oy + e.clientY - dy) + 'px'; }
    else if (rz && stack) {
      const ddx = e.clientX - rx, ddy = e.clientY - ry;
      let nw = rw, nh = rh, nl = rl, nt = rt;
      if (rdir.indexOf('e') !== -1) nw = rw + ddx;
      if (rdir.indexOf('w') !== -1) { nw = rw - ddx; nl = rl + ddx; }
      if (rdir.indexOf('s') !== -1) nh = rh + ddy;
      if (rdir.indexOf('n') !== -1) { nh = rh - ddy; nt = rt + ddy; }
      nw = Math.max(200, Math.min(1100, nw)); nh = Math.max(220, Math.min(1100, nh));
      // se avevo ridotto oltre il minimo dal lato N/W, non far scappare il pannello
      if (rdir.indexOf('w') !== -1) nl = rl + (rw - nw);
      if (rdir.indexOf('n') !== -1) nt = rt + (rh - nh);
      // Rilievo 17: ridimensiona il PANNELLO (la tela vive in un contenitore scrollabile + zoom)
      p.style.width = nw + 'px'; p.style.height = nh + 'px';
      p.style.left = nl + 'px'; p.style.top = nt + 'px';
      _tgApplyZoom();
    }
  });
  window.addEventListener('mouseup', function () {
    if (drag || rz) { drag = false; rz = false; if (document.body && document.body.style) document.body.style.userSelect = ''; }
  });
}
// FIX (Ismail 2026-07-10): la tela LOGICA (TG_W x TG_H) ora e' la dimensione del
// CONTENUTO reale (vedi _tgRecomputeBounds), non piu' legata alla dimensione del
// viewport. Lo stack e' sempre TG_W*zoom x TG_H*zoom: se il disegno e' cresciuto oltre
// il viewport visibile, lo stack supera #draw-scroll (overflow:auto) e compaiono le
// scrollbar V+H -- proprio come nel canvas principale.
function _tgApplyZoom() {
  const stack = document.getElementById('draw-canvas-stack');
  if (!stack) return;
  stack.style.width = Math.round(TG_W * _tgZoom) + 'px';
  stack.style.height = Math.round(TG_H * _tgZoom) + 'px';
  _tgResizeCanvases();
}
// Ricalcola la bounding box di tutte le tracce disegnate + la posizione ATTUALE della
// tartaruga (coordinate assolute, illimitate), e ne ricava la dimensione logica della tela
// (TG_W/TG_H, mai sotto 300x300 di default) e l'offset (_tgOriginX/Y) che porta quelle
// coordinate assolute nello spazio pixel della tela corrente. Chiamata dopo ogni mossa che
// puo' allargare il disegno (forward, home, clear) -- MAI durante turn/pen, che non
// spostano la tartaruga.
var TG_MARGIN = 150; // stesso valore di TG_HOME_X/Y originali: default 300x300 invariato
function _tgRecomputeBounds() {
  let minX = 0, maxX = 0, minY = 0, maxY = 0; // includi sempre l'origine (casa)
  for (let i = 0; i < _tgSegments.length; i++) {
    const sg = _tgSegments[i];
    if (sg.x1 < minX) minX = sg.x1; if (sg.x1 > maxX) maxX = sg.x1;
    if (sg.x2 < minX) minX = sg.x2; if (sg.x2 > maxX) maxX = sg.x2;
    if (sg.y1 < minY) minY = sg.y1; if (sg.y1 > maxY) maxY = sg.y1;
    if (sg.y2 < minY) minY = sg.y2; if (sg.y2 > maxY) maxY = sg.y2;
  }
  if (_tg.x < minX) minX = _tg.x; if (_tg.x > maxX) maxX = _tg.x;
  if (_tg.y < minY) minY = _tg.y; if (_tg.y > maxY) maxY = _tg.y;
  TG_W = Math.max(300, (maxX - minX) + TG_MARGIN * 2);
  TG_H = Math.max(300, (maxY - minY) + TG_MARGIN * 2);
  _tgOriginX = TG_MARGIN - minX;
  _tgOriginY = TG_MARGIN - minY;
}
// Scorre #draw-scroll cosi' la tartaruga resta visibile dopo che la tela e' cresciuta
// (stesso spirito di centerGraph() per il canvas principale, ma qui "insegue" la tartaruga
// invece di centrare l'intero contenuto).
function _tgScrollToTurtle() {
  const scroll = document.getElementById('draw-scroll');
  if (!scroll) return;
  const px = (_tg.x + _tgOriginX) * _tgZoom;
  const py = (_tg.y + _tgOriginY) * _tgZoom;
  scroll.scrollLeft = Math.max(0, Math.round(px - scroll.clientWidth / 2));
  scroll.scrollTop = Math.max(0, Math.round(py - scroll.clientHeight / 2));
}
var _tgZoom = 1;
function tgZoomIn() { _tgZoom = Math.min(5, +(_tgZoom * 1.2).toFixed(3)); _tgApplyZoom(); }
function tgZoomOut() { _tgZoom = Math.max(0.4, +(_tgZoom / 1.2).toFixed(3)); _tgApplyZoom(); }
function tgZoomReset() { _tgZoom = 1; _tgApplyZoom(); }
if (typeof window !== 'undefined') { window.tgZoomIn = tgZoomIn; window.tgZoomOut = tgZoomOut; window.tgZoomReset = tgZoomReset; }
// FIX #27/#35: al resize della finestra la tela e i controlli del pannello tartaruga si
// riadattano (come il canvas principale che si ricentra), quando il pannello e' aperto.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', function () {
    const p = document.getElementById('draw-output-panel');
    if (p && p.style.display !== 'none' && typeof _tgApplyZoom === 'function') { try { _tgApplyZoom(); } catch (e) {} }
  });
}
function showTurtlePanel() { const p = ensureTurtlePanel(); if (p) { p.style.display = 'flex'; _tgApplyZoom(); if (typeof bfBringToFront === 'function') bfBringToFront(p); } return p; }
// Adatta la RISOLUZIONE interna delle tele alla dimensione mostrata (x devicePixelRatio) e
// applica una trasformazione cosi' le coordinate logiche 0..300 riempiono la tela: il disegno
// resta NITIDO a qualsiasi zoom/ridimensionamento (niente pixel sgranati).
function _tgApplyTransform(id) {
  const cv = document.getElementById(id); if (!cv || !cv.getContext) return null;
  const g = cv.getContext('2d'); if (!g) return null;
  if (g.setTransform) { try { g.setTransform((cv.width || TG_W) / TG_W, 0, 0, (cv.height || TG_H) / TG_H, 0, 0); } catch (e) {} }
  return g;
}
function _tgResizeCanvases() {
  const stack = document.getElementById('draw-canvas-stack'); if (!stack) return;
  // Rilievo 35: i pulsanti Zoom scalano con la finestra (proporzione costante).
  const panel = document.getElementById('draw-output-panel');
  if (panel && panel.getBoundingClientRect) {
    const pw = panel.getBoundingClientRect().width || 340;
    const bs = Math.max(26, Math.min(46, Math.round(pw * 0.095)));
    panel.style.setProperty('--tg-btn', bs + 'px');
    // FIX #35: anche i pulsanti della toolbar superiore scalano col pannello, cosi' zoom e
    // toolbar si ridimensionano INSIEME mantenendo proporzioni coerenti rispetto alla finestra.
    const hs = Math.max(22, Math.min(38, Math.round(pw * 0.078)));
    panel.style.setProperty('--tg-head-btn', hs + 'px');
  }
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const dw = stack.clientWidth || stack.offsetWidth || TG_W;
  const dh = stack.clientHeight || stack.offsetHeight || TG_H;
  const W = Math.max(1, Math.round(dw * dpr)), H = Math.max(1, Math.round(dh * dpr));
  let changed = false;
  ['draw-canvas', 'draw-turtle'].forEach(function (id) {
    const c = document.getElementById(id);
    if (c && (c.width !== W || c.height !== H)) { c.width = W; c.height = H; changed = true; }
  });
  _tgRenderDrawing();
  redrawTurtleMarker();
  return changed;
}
// Ridisegna TUTTE le tracce dal buffer (usato dopo un resize/ridisegno per rimanere nitido/
// coerente). Le tracce sono salvate in coordinate ASSOLUTE (illimitate): l'offset corrente
// (_tgOriginX/Y, da _tgRecomputeBounds) le porta nello spazio pixel della tela.
function _tgRenderDrawing() {
  const g = _tgApplyTransform('draw-canvas'); if (!g) return;
  g.clearRect(0, 0, TG_W, TG_H);
  for (let i = 0; i < _tgSegments.length; i++) {
    const sg = _tgSegments[i];
    g.strokeStyle = sg.color; g.lineWidth = Math.max(0.4, sg.width); g.lineCap = 'round';
    g.beginPath(); g.moveTo(sg.x1 + _tgOriginX, sg.y1 + _tgOriginY); g.lineTo(sg.x2 + _tgOriginX, sg.y2 + _tgOriginY); g.stroke();
  }
}
function _tgCtx(id) { const c = document.getElementById(id); return (c && c.getContext) ? c.getContext('2d') : null; }

function resetTurtle() {
  _tg = { x: TG_HOME_X, y: TG_HOME_Y, head: 0, pen: true, color: '#000000', width: 2 };
  _tgSegments = [];
  _tgRecomputeBounds(); // torna alla tela 300x300 di default
  _tgRenderDrawing();
  redrawTurtleMarker();
}
// compat: execute.js chiama ancora resetDrawBuffer a inizio esecuzione
function resetDrawBuffer() { resetTurtle(); }

function redrawTurtleMarker() {
  const g = _tgApplyTransform('draw-turtle'); if (!g) return;
  g.clearRect(0, 0, TG_W, TG_H);
  if (!_tgShowTurtle) return; // tartaruga nascosta
  const rad = _tg.head * Math.PI / 180;
  // Posizione della tartaruga sulla TELA (coordinate assolute + offset corrente, vedi
  // _tgOriginX/Y) -- _tg.x/_tg.y da soli sono coordinate ASSOLUTE, non pixel sulla tela.
  const px = _tg.x + _tgOriginX, py = _tg.y + _tgOriginY;
  // Marcatore "aquilone" (kite) orientato: piu' moderno e pulito del vecchio triangolo piatto.
  // Colore coerente col tema (--primary), con nucleo e bordo scuro per staccare sul disegno.
  const sin = Math.sin, cos = Math.cos;
  const tip  = [px + 12 * sin(rad),            py - 12 * cos(rad)];
  const tail = [px - 7  * sin(rad),            py + 7  * cos(rad)];
  const lft  = [px + 6  * sin(rad - Math.PI/2),py - 6  * cos(rad - Math.PI/2)];
  const rgt  = [px + 6  * sin(rad + Math.PI/2),py - 6  * cos(rad + Math.PI/2)];
  let prim = '#6200ea';
  try { const c = getComputedStyle(document.documentElement).getPropertyValue('--primary'); if (c && c.trim()) prim = c.trim(); } catch (e) {}
  g.beginPath(); g.moveTo(tip[0], tip[1]); g.lineTo(lft[0], lft[1]); g.lineTo(tail[0], tail[1]); g.lineTo(rgt[0], rgt[1]); g.closePath();
  g.fillStyle = prim; g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1;
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.2; g.lineJoin = 'round'; g.stroke();
  // piccolo nucleo chiaro al centro
  g.beginPath(); g.arc(px, py, 2, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill();
}

function _tgEval(expr, variables, currentNode) {
  let e = String(expr == null ? '' : expr).trim();
  if (e === '') return 0;
  if (Array.isArray(variables)) variables.forEach(function (v) { e = e.replace(new RegExp('\\b' + v.name + '\\b', 'g'), v.value.toString()); });
  let val;
  try { val = (typeof safeEvaluate === 'function') ? safeEvaluate(e) : parseFloat(e); }
  catch (err) { if (typeof throwError === 'function') throwError(errMsg('err_graphics_expr', {n: currentNode, e: expr})); return NaN; }
  const n = parseFloat(val);
  return isNaN(n) ? NaN : n;
}

function execForward(distExpr, variables, currentNode) {
  const d = _tgEval(distExpr, variables, currentNode); if (isNaN(d)) return false;
  showTurtlePanel();
  const rad = _tg.head * Math.PI / 180;
  const nx = _tg.x + d * Math.sin(rad), ny = _tg.y - d * Math.cos(rad);
  if (_tg.pen) _tgSegments.push({ x1: _tg.x, y1: _tg.y, x2: nx, y2: ny, color: _tg.color, width: _tg.width });
  _tg.x = nx; _tg.y = ny;
  // FIX (Ismail 2026-07-10): la tartaruga puo' andare OLTRE la tela attuale -> ricalcola
  // sempre la bounding box/tela (puo' crescere) e riallinea zoom + scroll di conseguenza,
  // invece di disegnare solo il segmento incrementale su una tela di dimensione fissa.
  _tgRecomputeBounds(); _tgApplyZoom(); _tgScrollToTurtle();
  if (typeof printMessage === 'function') printMessage('Turtle: ' + (_tg.pen ? 'draw' : 'move') + ' ' + d, 'debug');
  return true;
}
function execTurn(dir, angleExpr, variables, currentNode) {
  const a = _tgEval(angleExpr, variables, currentNode); if (isNaN(a)) return false;
  _tg.head += (dir === 'left' ? -a : a); _tg.head = ((_tg.head % 360) + 360) % 360;
  showTurtlePanel(); redrawTurtleMarker();
  if (typeof printMessage === 'function') printMessage('Turtle: turn ' + dir + ' ' + a + '°', 'debug');
  return true;
}
function execHome() {
  _tg.x = TG_HOME_X; _tg.y = TG_HOME_Y; _tg.head = 0;
  showTurtlePanel();
  // Il disegno gia' fatto NON si restringe (la bounding box include comunque tutte le
  // tracce), ma la tela/offset possono comunque cambiare se prima erano centrati sulla
  // vecchia posizione: ricalcola per sicurezza.
  _tgRecomputeBounds(); _tgApplyZoom(); _tgScrollToTurtle();
  if (typeof printMessage === 'function') printMessage('Turtle: home', 'debug');
  return true;
}
function execPen(state, color, width) {
  if (state === 'up') _tg.pen = false; else if (state === 'down') _tg.pen = true;
  if (color) _tg.color = color;
  const w = parseFloat(width); if (!isNaN(w) && w > 0) _tg.width = w;
  if (typeof printMessage === 'function') printMessage('Turtle: pen ' + state + ' ' + (color || '') + ' w' + _tg.width, 'debug');
  return true;
}
function execClearScreen() {
  _tgSegments = [];
  _tg.x = TG_HOME_X; _tg.y = TG_HOME_Y; _tg.head = 0;
  showTurtlePanel();
  _tgRecomputeBounds(); _tgApplyZoom(); // tela torna a 300x300 di default (nessuna traccia)
  if (typeof printMessage === 'function') printMessage('Turtle: clear screen', 'debug');
  return true;
}

// Esegue un nodo turtle dato il suo tipo+info (chiamato da execute.js).
function execTurtleNode(type, info, variables, currentNode) {
  const p = _parseTurtle(type, info);
  if (type === 'forward') return execForward(p.dist, variables, currentNode);
  if (type === 'turn') return execTurn(p.dir, p.angle, variables, currentNode);
  if (type === 'home') return execHome();
  if (type === 'pen') return execPen(p.state, p.color, p.width);
  if (type === 'gclear') return execClearScreen();
  return true;
}

// Descrizione leggibile (per i traduttori: commento).
function turtleCommentText(type, info) {
  const p = _parseTurtle(type, info);
  switch (type) {
    case 'forward': return 'Turtle: forward ' + (p.dist || '0');
    case 'turn': return 'Turtle: turn ' + (p.dir === 'left' ? 'left' : 'right') + ' ' + (p.angle || '0') + ' degrees';
    case 'home': return 'Turtle: home (return to start)';
    case 'pen': return 'Turtle: pen ' + p.state + ', color ' + p.color + ', width ' + p.width;
    case 'gclear': return 'Turtle: clear screen';
    default: return 'Turtle';
  }
}

// Etichetta breve e leggibile mostrata SUL nodo (invece del raw "type:info").
function turtleNodeLabel(type, info) {
  const p = _parseTurtle(type, info);
  switch (type) {
    case 'forward': return _dt('blk_forward', 'Move/Draw') + (p.dist ? ' ' + p.dist : '');
    case 'turn': return _dt('blk_turn', 'Turn') + ' ' + (p.dir === 'left' ? '\u21BA' : '\u21BB') + (p.angle || '') + '\u00B0';
    case 'home': return _dt('blk_home', 'Home');
    case 'pen': return _dt('blk_pen', 'Pen') + ' ' + (p.state === 'up' ? '\u2191' : '\u2193') + ' ' + p.color + ' \u00B7 ' + p.width;
    case 'gclear': return _dt('blk_clearscreen', 'Clear');
    default: return type;
  }
}

// ---- Parsing/serializzazione info ----
function _parseTurtle(type, info) {
  const s = String(info == null ? '' : info);
  if (type === 'forward') return { dist: s.trim() || '50' };
  if (type === 'turn') { const a = s.split(';'); return { dir: (a[0] || 'right').trim() || 'right', angle: (a[1] != null ? a[1] : '90').trim() || '90' }; }
  if (type === 'pen') { const a = s.split(';'); return { state: (a[0] || 'down').trim() || 'down', color: (a[1] || '#000000').trim() || '#000000', width: (a[2] != null ? a[2] : '2').trim() || '2' }; }
  return {};
}

// R12-D (Ismail 2026-07-11): direzione GREZZA del turn, senza il default 'right' che
// _parseTurtle applica per esecuzione/etichetta -- serve a rendering.js per sapere se
// l'utente ha GIA' scelto una direzione (forma a una punta) o no (forma a due punte,
// stato iniziale/non ancora configurato). 'left'|'right' se salvata esplicitamente,
// altrimenti null (info vuota, o dir vuota lasciata da un salvataggio senza scelta).
function turnDirectionOf(info) {
  const s = String(info == null ? '' : info);
  const raw = (s.split(';')[0] || '').trim();
  return (raw === 'left' || raw === 'right') ? raw : null;
}
if (typeof window !== 'undefined') window.turnDirectionOf = turnDirectionOf;

// ---- Dialog di configurazione ----
var turtleNodeIndex = -1;
function ensureTurtleDialog() {
  let d = document.getElementById('draw-popup');
  if (d) return d;
  const host = document.getElementById('canvas-container') || document.body;
  d = document.createElement('div');
  d.id = 'draw-popup';
  d.innerHTML =
    '<button class="blk-help-btn" onclick="openBlockHelp((flow.nodes[turtleNodeIndex]||{}).type)" data-i18n-title="tip_block_help" title="' + _dt('tip_block_help', 'Guida al blocco') + '" aria-label="?">?</button>' +
    '<button class="x-close" onclick="closeTurtleDialog()" data-i18n-title="close" title="' + _dt('close', 'Chiudi') + '" aria-label="close">&times;</button>' +
    '<h3 id="tg-title">' + _dt('tg_title', 'Configura') + '</h3>' +
    '<div id="tg-forward-wrap"><label>' + _dt('tg_distance', 'Distanza') + ':</label>' +
      '<input type="text" id="tg-dist" class="draw-input" value="50"></div>' +
    '<div id="tg-turn-wrap">' +
      '<label>' + _dt('tg_direction', 'Direzione') + ':</label>' +
      '<div class="tg-radios">' +
        '<label><input type="radio" name="tg-dir" value="right"> <span>' + _dt('tg_right', 'Destra') + '</span></label>' +
        '<label><input type="radio" name="tg-dir" value="left"> <span>' + _dt('tg_left', 'Sinistra') + '</span></label>' +
      '</div>' +
      '<label>' + _dt('tg_degrees', 'Gradi') + ':</label><input type="text" id="tg-angle" class="draw-input" value="90"></div>' +
    '<div id="tg-pen-wrap">' +
      '<label>' + _dt('tg_pen_state', 'Penna') + ':</label>' +
      '<div class="tg-radios">' +
        '<label><input type="radio" name="tg-pen" value="down" checked> <span>' + _dt('tg_pen_down', 'Giù (disegna)') + '</span></label>' +
        '<label><input type="radio" name="tg-pen" value="up"> <span>' + _dt('tg_pen_up', 'Su (non disegna)') + '</span></label>' +
      '</div>' +
      '<div class="draw-row">' +
        '<div><label>' + _dt('draw_color', 'Colore') + ':</label><input type="color" id="tg-color" value="#000000"></div>' +
        '<div><label>' + _dt('tg_width', 'Spessore') + ':</label><input type="text" id="tg-width" class="draw-input" value="2" style="width:70px"></div>' +
      '</div></div>' +
    '<div class="draw-actions">' +
      '<button id="tg-ok" onclick="saveTurtleNode()">' + _dt('ok', 'OK') + '</button>' +
    '</div>';
  if (!host || typeof host.appendChild !== 'function') return null;
  try { host.appendChild(d); } catch (e) { return null; }
  return d;
}

// home/gclear non hanno parametri -> nessun dialog.
function openTurtleDialog(idx) {
  if (typeof flow === 'undefined' || !flow.nodes[idx]) return;
  const t = flow.nodes[idx].type;
  if (t === 'home' || t === 'gclear') { turtleNodeIndex = idx; if (typeof openBlockHelp === 'function') openBlockHelp(t); return; }
  turtleNodeIndex = idx;
  ensureTurtleDialog();
  const show = function (id, on) { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('tg-forward-wrap', t === 'forward'); show('tg-turn-wrap', t === 'turn'); show('tg-pen-wrap', t === 'pen');
  const titleKey = { forward: 'tg_title_forward', turn: 'tg_title_turn', pen: 'tg_title_pen' }[t] || 'tg_title';
  const ttl = document.getElementById('tg-title'); if (ttl) ttl.textContent = _dt(titleKey, 'Configura');
  const p = _parseTurtle(t, flow.nodes[idx].info || '');
  if (t === 'forward') { const e = document.getElementById('tg-dist'); if (e) e.value = p.dist; }
  else if (t === 'turn') {
    const e = document.getElementById('tg-angle'); if (e) e.value = p.angle;
    // R12-D: usa la direzione GREZZA (turnDirectionOf), non p.dir di _parseTurtle (che
    // defaulta a 'right') -- un turn appena creato non deve aprire il dialog con una
    // radio gia' selezionata.
    const rawDir = (typeof turnDirectionOf === 'function') ? turnDirectionOf(flow.nodes[idx].info || '') : null;
    const rs = document.getElementsByName('tg-dir'); for (let i = 0; i < rs.length; i++) rs[i].checked = (rs[i].value === rawDir);
  } else if (t === 'pen') {
    const c = document.getElementById('tg-color'); if (c) c.value = /^#([0-9a-f]{6})$/i.test(p.color) ? p.color : '#000000';
    const w = document.getElementById('tg-width'); if (w) w.value = p.width;
    const rs = document.getElementsByName('tg-pen'); for (let i = 0; i < rs.length; i++) rs[i].checked = (rs[i].value === p.state);
  }
  document.getElementById('draw-popup').classList.add('active');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.add('active');
  if (typeof _bfPushOverlay === 'function') _bfPushOverlay('draw-popup'); // R13-F: registro condiviso Esc
}
function closeTurtleDialog() {
  const d = document.getElementById('draw-popup'); if (d) d.classList.remove('active');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active');
  if (typeof _bfPopOverlay === 'function') _bfPopOverlay('draw-popup');
}
function saveTurtleNode() {
  if (turtleNodeIndex < 0 || typeof flow === 'undefined' || !flow.nodes[turtleNodeIndex]) { closeTurtleDialog(); return; }
  const t = flow.nodes[turtleNodeIndex].type;
  const radio = function (name) { const rs = document.getElementsByName(name); for (let i = 0; i < rs.length; i++) if (rs[i].checked) return rs[i].value; return ''; };
  const val = function (id) { const e = document.getElementById(id); return e ? String(e.value).replace(/;/g, ',').trim() : ''; };
  let info = '';
  if (t === 'forward') info = val('tg-dist') || '0';
  // R12-D: NIENTE default 'right' qui -- se l'utente non ha scelto una radio, la
  // direzione resta vuota (turnDirectionOf la rilegge come null, forma a due punte).
  // L'angolo e' comunque salvato: le due scelte sono indipendenti.
  else if (t === 'turn') info = radio('tg-dir') + ';' + (val('tg-angle') || '0');
  else if (t === 'pen') info = (radio('tg-pen') || 'down') + ';' + ((document.getElementById('tg-color') || {}).value || '#000000') + ';' + (val('tg-width') || '2');
  if (typeof pushHistory === 'function') pushHistory();
  flow.nodes[turtleNodeIndex].info = info;
  if (typeof saved !== 'undefined') saved = false;
  closeTurtleDialog();
  if (typeof calcoloY === 'function' && typeof nodi !== 'undefined') calcoloY(nodi);
  if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
}

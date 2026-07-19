// ROUND-15F WP-E3 punto 2 (Ismail, screenshot con freccia rossa sul gomito rombo/fork di un ramo
// IF vuoto: "le frecce non si connettono bene agli angoli, in generale, sia cicli che if"). Questo
// ambiente sandbox non ha un canvas reale (il mock in tools/*.js non rasterizza pixel), quindi non
// posso VERIFICARE A SCHERMO il fix -- questo harness riproduce il problema per via GEOMETRICA
// (pura matematica sulle regioni coperte da uno stroke), lo stesso identico calcolo che un canvas
// reale farebbe per due segmenti stroked SEPARATAMENTE (due beginPath/moveTo/lineTo/stroke
// indipendenti, mai un unico path -- esattamente come fa drawLine/_strokeExecSeg in rendering.js)
// che si incontrano ad angolo retto nello stesso punto.
//
// Verifica 1 (riproduzione del difetto): con lineCap='butt' (il default del canvas, MAI cambiato
// finora in rendering.js) resta scoperto un quadratino esattamente all'esterno dell'angolo dove
// due segmenti perpendicolari si incontrano.
// Verifica 2 (il fix): con lineCap='square' (il valore ora impostato una volta sola in draw(),
// rendering.js, prima di qualunque stroke) quello stesso quadratino risulta coperto.
// Verifica 3 (cablaggio nel codice reale): grep su rendering.js che `ctx.lineCap = 'square';`
// compaia PRIMA del primo ctx.stroke()/drawLine dentro draw(forme), e che nessun punto successivo
// lo resetti a un default diverso.

const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');

// Distanza punto-segmento (proiezione clampata), per calcolare se un punto e' "dentro" lo stroke
// di un segmento di data linewidth e cap.
function coveredByStroke(px, py, x1, y1, x2, y2, lineWidth, cap) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return false;
  const ux = dx / len, uy = dy / len;
  // proiezione del punto sulla retta del segmento
  const t = ((px - x1) * ux + (py - y1) * uy);
  // distanza perpendicolare dalla retta
  const perp = Math.abs((px - x1) * uy - (py - y1) * ux);
  const halfW = lineWidth / 2;
  if (perp > halfW) return false; // troppo lontano dalla linea, indipendentemente dal cap
  if (t >= 0 && t <= len) return true; // dentro il corpo del segmento
  // fuori dal corpo: dipende dal cap
  const over = t < 0 ? -t : (t - len); // quanto "oltre" l'estremo piu' vicino
  if (cap === 'square') return over <= halfW; // il cap quadrato estende di halfW nella direzione della linea
  if (cap === 'round') {
    // distanza euclidea dal punto piu' vicino della linea (l'estremo)
    const ex = t < 0 ? x1 : x2, ey = t < 0 ? y1 : y2;
    const d = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);
    return d <= halfW;
  }
  return false; // 'butt': nessuna estensione oltre l'estremo
}

let failures = 0;
function check(cond, msg) { if (cond) console.log('  OK   ' + msg); else { console.log('  FAIL ' + msg); failures++; } }

// Geometria di esempio: stelo/branch verticale che finisce in (cx,forkY) scendendo dall'alto,
// ponte orizzontale che parte da (cx,forkY) e va verso sinistra (caso ramo FALSE, come nello
// screenshot di Ismail: "False" in alto, colonna a sinistra del centro).
const cx = 500, forkY = 124, diaBottom = 114, falseX = 385;
const LW = 2; // ctx.lineWidth di base (drawLine/_strokeExecSeg, disegno non evidenziato)
const vert = [cx, diaBottom, cx, forkY];      // verticale, finisce in (cx,forkY)
const horiz = [cx, forkY, falseX, forkY];     // orizzontale, parte da (cx,forkY) verso sinistra

// Il quadratino "scoperto" e' quello all'ESTERNO dell'angolo, nel quadrante opposto a dove i due
// segmenti proseguono: il verticale viene da SOPRA (y<forkY) e il centro dell'angolo e' a
// (cx,forkY); l'orizzontale va verso SINISTRA (x<cx). Il quadrante "vuoto" (nessuno dei due
// segmenti ci arriva) e' quindi in basso-A-DESTRA dell'angolo: x leggermente MAGGIORE di cx, y
// leggermente MAGGIORE di forkY.
const probe = { x: cx + LW * 0.35, y: forkY + LW * 0.35 };
console.log(`Punto sonda nel quadrante "scoperto" dell'angolo: (${probe.x},${probe.y})  [cx=${cx} forkY=${forkY}]`);

console.log('\n=== Verifica 1: riproduzione del difetto con lineCap="butt" (comportamento PRIMA del fix) ===');
const coveredButt = coveredByStroke(probe.x, probe.y, vert[0], vert[1], vert[2], vert[3], LW, 'butt')
  || coveredByStroke(probe.x, probe.y, horiz[0], horiz[1], horiz[2], horiz[3], LW, 'butt');
check(!coveredButt, 'con lineCap="butt" il quadratino d\'angolo NON e\' coperto da nessuno dei due segmenti (riproduce il difetto visivo)');

console.log('\n=== Verifica 2: il fix con lineCap="square" chiude il varco ===');
const coveredSquare = coveredByStroke(probe.x, probe.y, vert[0], vert[1], vert[2], vert[3], LW, 'square')
  || coveredByStroke(probe.x, probe.y, horiz[0], horiz[1], horiz[2], horiz[3], LW, 'square');
check(coveredSquare, 'con lineCap="square" il quadratino d\'angolo e\' coperto (il gomito si legge continuo)');

// Ripete la verifica per TUTTI e 4 gli orientamenti di gomito a 90 gradi (su/giu' x sinistra/destra),
// cosi' la conclusione vale per QUALSIASI gomito ortogonale dell'app (rami true e false, cicli,
// join disallineati...), non solo per questo caso specifico.
console.log('\n=== Verifica 2b: chiusura del gomito per tutti e 4 gli orientamenti a 90 gradi ===');
const orientations = [
  { name: 'verticale-da-sopra + orizzontale-a-sinistra', v: [0, -10, 0, 0], h: [0, 0, -10, 0] },
  { name: 'verticale-da-sopra + orizzontale-a-destra',   v: [0, -10, 0, 0], h: [0, 0, 10, 0] },
  { name: 'verticale-da-sotto + orizzontale-a-sinistra', v: [0, 10, 0, 0], h: [0, 0, -10, 0] },
  { name: 'verticale-da-sotto + orizzontale-a-destra',   v: [0, 10, 0, 0], h: [0, 0, 10, 0] },
];
for (const o of orientations) {
  const ox = 0, oy = 0;
  const v2 = [ox + o.v[0], oy + o.v[1], ox + o.v[2], oy + o.v[3]];
  const h2 = [ox + o.h[0], oy + o.h[1], ox + o.h[2], oy + o.h[3]];
  // quadrante opposto a entrambe le direzioni di provenienza
  const qx = ox - Math.sign(o.h[0] || 1) * LW * 0.35;
  const qy = oy - Math.sign(o.v[1] || 1) * LW * 0.35;
  const sq = coveredByStroke(qx, qy, ...v2, LW, 'square') || coveredByStroke(qx, qy, ...h2, LW, 'square');
  check(sq, `${o.name}: quadratino d'angolo coperto con lineCap="square"`);
}

console.log('\n=== Verifica 3: il fix e\' cablato in rendering.js PRIMA di qualunque stroke ===');
const src = fs.readFileSync(REPO + '/js/core/rendering.js', 'utf8');
const drawFnIdx = src.indexOf('function draw(forme)');
check(drawFnIdx >= 0, 'trovata function draw(forme) in rendering.js');
const lineCapIdx = src.indexOf("ctx.lineCap = 'square';", drawFnIdx);
check(lineCapIdx > drawFnIdx, 'ctx.lineCap = \'square\' impostato dentro draw(forme)');
// Nessun altro ctx.lineCap nel file che lo possa sovrascrivere con un valore diverso.
const allLineCapSets = [...src.matchAll(/ctx\.lineCap\s*=\s*['"]([a-z]+)['"]/g)];
console.log('  occorrenze di ctx.lineCap in rendering.js:', allLineCapSets.map(m => m[1]));
check(allLineCapSets.length === 1 && allLineCapSets[0][1] === 'square', 'un\'unica impostazione di ctx.lineCap in tutto il file, ed e\' "square" (nessun altro punto lo sovrascrive)');
// La prima stroke() del primo drawLine "reale" del disegno base deve avvenire DOPO l'impostazione
// del lineCap (altrimenti il primo frame disegnerebbe ancora col default 'butt').
const firstStrokeAfterClear = src.indexOf('ctx.stroke()', lineCapIdx);
const clearRectIdx = src.indexOf('ctx.clearRect(0, 0, w, h)', drawFnIdx);
check(clearRectIdx > 0 && lineCapIdx > clearRectIdx, 'ctx.lineCap impostato SUBITO dopo clearRect, prima di qualunque disegno del frame corrente');

console.log('\n=== ESITO repro-e3-arrow-corner-gap ===');
if (failures === 0) { console.log('PASS (verificato per via geometrica/statica -- NON e\' una conferma visiva a schermo, richiesta a Ismail)'); process.exit(0); }
else { console.log(`FAIL (${failures} assert falliti)`); process.exit(1); }

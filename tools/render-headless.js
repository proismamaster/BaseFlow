const fs = require('fs'); const vm = require('vm'); const path = require('path');
// FIX (verifica finale trasversale round 11, Ismail 2026-07-12): il path era un ASSOLUTO
// legato a una sessione sandbox specifica ormai chiusa (magical-charming-rubin) -- lo
// script quindi falliva "file not found" in QUALSIASI sessione futura. path.join(__dirname,
// '..') e' portabile: funziona in ogni sessione/macchina, dato che tools/ resta sempre
// un livello sotto la root del repo.
const REPO = path.join(__dirname, '..');
const W=1000,H=1000;
let ops = [];
function col(c){ if(!c || typeof c!=='string' || c.startsWith('var(')) return '#000'; return c; }
const ctxMock = {
  fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle',
  _path: [],
  beginPath(){ this._path=[]; },
  moveTo(x,y){ this._path.push(['M',x,y]); },
  lineTo(x,y){ this._path.push(['L',x,y]); },
  quadraticCurveTo(cx,cy,x,y){ this._path.push(['Q',cx,cy,x,y]); },
  rect(x,y,w,h){ this._path.push(['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']); },
  closePath(){ this._path.push(['Z']); },
  stroke(){ if(this._path.length) ops.push({t:'stroke', d:[...this._path], c:col(this.strokeStyle), w:this.lineWidth}); },
  fill(){ if(this._path.length) ops.push({t:'fill', d:[...this._path], c:col(this.fillStyle)}); },
  clearRect(){ ops=[]; },
  fillText(txt,x,y){ ops.push({t:'text', txt, x, y, c:col(this.fillStyle), f:this.font}); },
  measureText(t){ return {width: (t||'').length*8}; },
  // FIX (verifica finale trasversale round 11): ctx.save/restore/setLineDash/setTransform
  // (introdotte da WP-C1/R12-G) e ctx.arc (usata da forme turtle/home) mancavano dal mock --
  // lo script falliva "ctx.save is not a function" su QUALSIASI draw() con l'app attuale.
  // No-op sicuri per save/restore/setTransform (non serve uno stack di trasformazioni per
  // uno snapshot statico di geometria); arc approssimato a un bounding box quadrato intorno
  // al centro, cosi' bbox()/overlap restano significativi anche per le forme che lo usano.
  save(){}, restore(){}, setLineDash(){}, setTransform(){},
  arc(x,y,r){ this._path.push(['M',x-r,y-r],['L',x+r,y-r],['L',x+r,y+r],['L',x-r,y+r]); }
};
function toSVG(){
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="white"/>`];
  for (const o of ops) {
    if (o.t==='text') { parts.push(`<text x="${o.x}" y="${o.y}" font-size="14" font-family="Arial" text-anchor="middle" fill="${o.c}">${o.txt.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`); continue; }
    const d = o.d.map(s=>s[0]==='Z'?'Z':(s[0]==='Q'?`Q ${s[1]} ${s[2]} ${s[3]} ${s[4]}`:`${s[0]} ${s[1]} ${s[2]}`)).join(' ');
    if (o.t==='stroke') parts.push(`<path d="${d}" fill="none" stroke="${o.c}" stroke-width="${o.w||1.5}"/>`);
    else parts.push(`<path d="${d}" fill="${o.c}" stroke="none"/>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const genericEl=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[]});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:genericEl(),addEventListener:()=>{},createElement:()=>genericEl(),querySelector:()=>genericEl(),querySelectorAll:()=>[],body:genericEl(),documentElement:genericEl()};
const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:(...a)=>console.error('[sandbox]', ...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(context);
for (const n of ['theme','state','safeEval','utils','variables','layout','rendering','popups','interaction','fileIO','init']) {
  vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
}
vm.runInContext('window.onload();', context);
const ins = (filter, tipo) => vm.runInContext(`frecceSelected = frecce.findIndex(f=>${filter}); if(frecceSelected===-1) console.error("NO ARC ${tipo}"); else inserisciNodo("${tipo}");`, context);
const snap = (name) => { fs.writeFileSync('/tmp/svg_'+name+'.svg', toSVG()); };

// Scenario A: while > while (annidato), poi blocco nel corpo interno
ins('f.type==="normal"', 'while');                    // while esterno
ins('f.type==="loop_body"', 'while');                 // while interno nel corpo
snap('A_while_in_while');
ins('f.type==="loop_body" && f.fromNodeIndex===2', 'print'); // print nel corpo interno
snap('B_print_in_inner');
// Scenario C: blocco DOPO il while interno (loop_body_end esterno)
ins('f.type==="loop_body_end"', 'assign');
snap('C_assign_after_inner');
console.log('flow:', vm.runInContext('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))', context));
console.log('arch:', vm.runInContext('JSON.stringify(frecce.map(f=>({t:f.type,f:f.fromNodeIndex,to:f.toNodeIndex,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))', context));

// D: terzo while annidato nel corpo del secondo
ins('f.type==="loop_body" && f.fromNodeIndex===2', 'while');
snap('D_triple_while');
// E: if dentro il corpo (VUOTO) del terzo while -- filtro robusto per STRUTTURA (il corpo
// e' vuoto quando il ramo true del while punta a se' stesso), non per indice assoluto: il
// filtro originale (f.fromNodeIndex===3) puntava ad "assign", mai un while -> falliva SEMPRE
// in silenzio (console.error soppresso dal mock), scoperto solo riattivando console.error
// durante questa verifica.
ins('f.type==="loop_body" && flow.nodes[f.fromNodeIndex] && flow.nodes[f.fromNodeIndex].type==="while" && flow.nodes[f.fromNodeIndex].next.true===String(f.fromNodeIndex)', 'if');
snap('E_if_in_third');
console.log('flowE:', vm.runInContext('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))', context));

// Verifica finale trasversale (round 11, sezione 4, punto 3): la fixture originale copriva
// solo while annidati + un if -- estesa qui con do-while, for, if annidato-in-if e testo
// lungo (i tipi/casi elencati esplicitamente dal piano), SENZA toccare gli scenari A-E sopra.
// F-I si agganciano tutti allo STESSO filtro robusto "l'arco che porta a End" (qualunque sia
// il suo tipo/indice, cambia ad ogni inserimento) invece di indici assoluti fragili.
const TO_END = 'flow.nodes[f.toNodeIndex] && flow.nodes[f.toNodeIndex].type==="end"';

// F: do-while in coda, prima di End.
ins(TO_END, 'do');
snap('F_dowhile');

// G: for dopo il do-while, sempre in coda prima di End.
ins(TO_END, 'for');
snap('G_for');

// H: if in coda, poi un SECONDO if annidato nel suo ramo True (ancora vuoto: i due rami
// puntano allo stesso join finche' non ci si inserisce nulla).
ins(TO_END, 'if');
ins('f.type==="if_true" && flow.nodes[f.fromNodeIndex] && flow.nodes[f.fromNodeIndex].type==="if" && flow.nodes[f.fromNodeIndex].next.true===flow.nodes[f.fromNodeIndex].next.false', 'if');
snap('H_if_in_if');

// I: testo lungo su un Output, sempre in coda prima di End (verifica wrapping via
// computeNodeSizes, non solo l'inserimento).
ins(TO_END, 'print');
vm.runInContext(`{
  const idx = flow.nodes.findIndex(n => n.type === 'print' && n.info === '');
  if (idx === -1) { console.error('NO print vuoto per testo lungo'); }
  else {
    flow.nodes[idx].info = "'Questo e\\' un testo di output MOLTO lungo, scritto apposta per forzare il wrapping su piu\\' righe e verificare che computeNodeSizes() allarghi il blocco senza sovrapporsi ai vicini' + x";
    calcoloY(nodi);
  }
}`, context);
snap('I_long_text');

// Controllo automatico: nessuna coordinata NaN/Infinity in nodi o archi (regressione di
// layout facile da introdurre con tipi nuovi/testo lungo, difficile da notare a occhio in
// un SVG con decine di elementi).
const badCoords = vm.runInContext(`
  (function () {
    const bad = [];
    nodi.forEach((n, i) => {
      if (!n) return;
      ['relX','relY','width','height'].forEach(k => { if (!isFinite(n[k])) bad.push('nodo ' + i + '.' + k + '=' + n[k]); });
    });
    frecce.forEach((f, i) => {
      if (!f) return;
      ['inzioX','inzioY','fineX','fineY'].forEach(k => { if (!isFinite(f[k])) bad.push('arco ' + i + '.' + k + '=' + f[k]); });
    });
    return JSON.stringify(bad);
  })()
`, context);
console.log('coordinate non finite (atteso []): ' + badCoords);

// Controllo automatico overlap: bounding-box axis-aligned di ogni RETTANGOLO pieno (fill)
// disegnato nell'ultimo snapshot (I_long_text, il piu' affollato) -- confronta ogni coppia
// di forme-nodo (path chiusi a 4 punti, cioe' i rettangoli/parallelogrammi/esagoni del
// corpo blocco) e segnala sovrapposizioni REALI (area comune > una soglia minima), non i
// contatti di bordo attesi fra un nodo e le sue frecce.
function bbox(pathOps) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const seg of pathOps) { for (let k=1;k<seg.length;k+=2) { const x=seg[k], y=seg[k+1]; if (typeof x==='number') { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); } } }
  return {minX,minY,maxX,maxY};
}
const fillBoxes = ops.filter(o => o.t === 'fill' && o.d.length >= 4).map(o => bbox(o.d));
let overlaps = 0;
for (let i = 0; i < fillBoxes.length; i++) {
  for (let j = i + 1; j < fillBoxes.length; j++) {
    const a = fillBoxes[i], b = fillBoxes[j];
    const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const oy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
    if (ox > 4 && oy > 4) overlaps++; // soglia 4px: ignora il contatto di bordo fisiologico
  }
}
console.log('coppie di forme piene con overlap area>4px (atteso 0, nell\'ultimo snapshot I_long_text): ' + overlaps);

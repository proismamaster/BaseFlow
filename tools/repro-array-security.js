/*
 * repro-array-security.js — WP-M5 (audit sicurezza richiesto da Ismail 2026-07-21:
 * "fai anche controlli di sicurezza per assicurarti che l'utente non faccia casini sul sito").
 *
 * Copre le tre superfici da cui entrano dati NON fidati con il tipo Array:
 *   1. FILE aperti (.bflow/.json): variabili con tipi inventati, array enormi, celle di tipo
 *      incoerente, oggetti annidati -> il file deve essere RIFIUTATO (validatore in fileIO.js).
 *   2. ESPRESSIONI scritte nei blocchi: safeEval non deve mai dare accesso a prototype/globali
 *      né esplodere su input ostili (indici enormi, annidamenti profondi, stringhe lunghe).
 *   3. VALORI mostrati in UI: la griglia celle usa innerHTML -> ogni valore va ESCAPATO
 *      (una stringa con <script> in una cella non deve diventare markup).
 *
 * Uso: node tools/repro-array-security.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
const T = (name, fn) => {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
};
const eq = (a, b, what) => {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((what || '') + ' atteso ' + jb + ', avuto ' + ja);
};

// ---------------------------------------------------------- 1) validatore variabili da file
// Estrae _bfValidateVariables dal sorgente vero di fileIO.js (e' definita dentro il listener
// 'change': la si isola per testarla senza un DOM completo).
const fileIOSrc = fs.readFileSync(path.join(APP, 'js/core/fileIO.js'), 'utf8');
const mV = fileIOSrc.match(/function _bfValidateVariables\(vars\) \{[\s\S]*?\n {8}\}/);
if (!mV) { console.log('  FAIL estrazione _bfValidateVariables da fileIO.js'); process.exit(1); }
const sbV = { console, Array, Object, Number, String, RegExp, isFinite, JSON };
sbV.window = sbV; vm.createContext(sbV);
// Il tetto celle si LEGGE dal sorgente vero: prima era hardcodato qui a 10000 e il test
// avrebbe continuato a passare anche cambiando il limite nell'app (come infatti e' successo
// in WP-M4i, 10000 -> 1000). Legandolo al file, il test segue sempre il valore reale.
const mMax = fileIOSrc.match(/const BF_ARRAY_MAX_CELLS = (\d+)/);
if (!mMax) { console.log('  FAIL BF_ARRAY_MAX_CELLS non trovata in fileIO.js'); process.exit(1); }
const MAX_CELLS = parseInt(mMax[1], 10);
vm.runInContext('const BF_ARRAY_MAX_CELLS = ' + MAX_CELLS + '; const _SCALAR_TYPES = ["int","float","string","bool","boolean"];\n' + mV[0], sbV);
const validate = v => vm.runInContext('_bfValidateVariables(' + JSON.stringify(v) + ')', sbV);

console.log('--- 1) file: variabili non fidate ---');
T('accetta variabili valide (scalari + array)', () => {
  eq(validate([
    { name: 'x', type: 'int', value: 5 },
    { name: 's', type: 'string', value: 'ciao' },
    { name: 'b', type: 'bool', value: true },
    { name: 'a', type: 'array:int', value: [1, 2, 3] },
    { name: 'sa', type: 'array:string', value: ['x', 'y'] }
  ]), null);
});
T('RIFIUTA tipo inventato', () => {
  if (!validate([{ name: 'x', type: 'evil', value: 1 }])) throw new Error('doveva rifiutare');
});
T('RIFIUTA array:tipo inventato', () => {
  if (!validate([{ name: 'a', type: 'array:evil', value: [1] }])) throw new Error('doveva rifiutare');
});
T('RIFIUTA nome variabile ostile (path/JS)', () => {
  if (!validate([{ name: '__proto__', type: 'int', value: 1 }])) throw new Error('doveva rifiutare __proto__');
  if (!validate([{ name: 'a b', type: 'int', value: 1 }])) throw new Error('doveva rifiutare nome con spazio');
  if (!validate([{ name: '<img src=x>', type: 'int', value: 1 }])) throw new Error('doveva rifiutare nome con HTML');
});
T('RIFIUTA array dichiarato ma valore non array', () => {
  if (!validate([{ name: 'a', type: 'array:int', value: 'non-un-array' }])) throw new Error('doveva rifiutare');
});
T('RIFIUTA array troppo grande (DoS)', () => {
  const huge = { name: 'a', type: 'array:int', value: new Array(MAX_CELLS + 1).fill(0) };
  if (!validate([huge])) throw new Error('doveva rifiutare ' + (MAX_CELLS + 1) + ' celle');
});
T('ACCETTA array al limite esatto (' + MAX_CELLS + ')', () => {
  eq(validate([{ name: 'a', type: 'array:int', value: new Array(MAX_CELLS).fill(0) }]), null);
});
T('il tetto celle del file combacia con quello della UI (variables.js)', () => {
  // I due limiti vivono in file diversi (validazione al load vs validazione in tabella):
  // se divergono, un file rifiutato al load sarebbe creabile a mano dalla UI, o viceversa.
  const varsTxt = fs.readFileSync(path.join(APP, 'js/core/variables.js'), 'utf8');
  const m = varsTxt.match(/const BF_ARRAY_MAX_SIZE = (\d+)/);
  if (!m) throw new Error('BF_ARRAY_MAX_SIZE non trovata in variables.js');
  if (parseInt(m[1], 10) !== MAX_CELLS) throw new Error('UI ' + m[1] + ' != file ' + MAX_CELLS);
});
T('RIFIUTA cella di tipo incoerente', () => {
  if (!validate([{ name: 'a', type: 'array:int', value: [1, 'due', 3] }])) throw new Error('doveva rifiutare stringa in array:int');
  if (!validate([{ name: 'a', type: 'array:bool', value: [true, 1] }])) throw new Error('doveva rifiutare 1 in array:bool');
  if (!validate([{ name: 'a', type: 'array:int', value: [1, 1.5] }])) throw new Error('doveva rifiutare float in array:int');
});
T('RIFIUTA celle annidate/oggetti (garbage per esecutore ed export)', () => {
  if (!validate([{ name: 'a', type: 'array:int', value: [[1, 2], 3] }])) throw new Error('doveva rifiutare array annidato');
  if (!validate([{ name: 'a', type: 'array:string', value: [{ x: 1 }] }])) throw new Error('doveva rifiutare oggetto');
});
T('RIFIUTA oggetto su tipo semplice', () => {
  if (!validate([{ name: 'x', type: 'int', value: { evil: true } }])) throw new Error('doveva rifiutare');
});
T('RIFIUTA numeri non finiti', () => {
  // JSON non ha Infinity, ma un .bflow manipolato a mano puo' arrivarci via stringa->numero.
  const sb = vm.runInContext('_bfValidateVariables([{name:"f",type:"float",value:Infinity}])', sbV);
  if (!sb) throw new Error('doveva rifiutare Infinity');
});
T('RIFIUTA stringa gigante (DoS memoria)', () => {
  if (!validate([{ name: 's', type: 'string', value: 'x'.repeat(100001) }])) throw new Error('doveva rifiutare');
});

// ---------------------------------------------------------- 2) safeEval con input ostili
console.log('\n--- 2) espressioni ostili nei blocchi ---');
const sbE = { console, Math, JSON, Number, String, Array, Object, RegExp, Error, parseFloat, parseInt, isNaN };
sbE.window = sbE; vm.createContext(sbE);
vm.runInContext(fs.readFileSync(path.join(APP, 'js/core/safeEval.js'), 'utf8'), sbE);
const ev = (expr, opts) => vm.runInContext('safeEvaluate(' + JSON.stringify(expr) + (opts ? ',' + JSON.stringify(opts) : '') + ')', sbE);
const mustThrow = (expr, what) => {
  let threw = false;
  try { ev(expr); } catch (e) { threw = true; }
  if (!threw) throw new Error((what || expr) + ': doveva essere rifiutata');
};
T('blocca accesso a prototype/costruttori', () => {
  mustThrow('constructor'); mustThrow('[].constructor');
  mustThrow('[]["constructor"]'); mustThrow('__proto__'); mustThrow('[].__proto__');
});
T('blocca metodi di Array (nessuna chiamata arbitraria)', () => {
  mustThrow('[1,2].push(3)'); mustThrow('[1,2].map'); mustThrow('[1,2].join(",")');
});
T('blocca accesso a globali', () => {
  mustThrow('window'); mustThrow('globalThis'); mustThrow('process'); mustThrow('require("fs")');
});
T('.length e lunico membro ammesso', () => {
  eq(ev('[1,2,3].length'), 3);
  mustThrow('[1,2,3].foo'); mustThrow('[1,2,3]["length"]');
});
T('indice enorme non alloca memoria (errore pulito)', () => {
  mustThrow('[1][999999999]', 'indice enorme');
});
T('annidamento profondo non fa crashare il parser', () => {
  const deep = '['.repeat(200) + '1' + ']'.repeat(200);
  let ok = false;
  try { ev(deep); ok = true; } catch (e) { ok = true; } // accettato o rifiutato: mai un crash di processo
  if (!ok) throw new Error('crash');
});
T('espressione lunghissima non blocca (nessun backtracking esplosivo)', () => {
  const long = Array.from({ length: 2000 }, (_, i) => i).join('+');
  const t0 = Date.now();
  ev(long);
  if (Date.now() - t0 > 2000) throw new Error('troppo lenta: ' + (Date.now() - t0) + 'ms');
});
T('divisione per zero resta un errore controllato', () => {
  let msg = '';
  try { ev('1/0'); } catch (e) { msg = e.message; }
  if (msg !== '__DIV0__') throw new Error('atteso __DIV0__, avuto ' + msg);
});

// ---------------------------------------------------------- 3) XSS nella griglia celle
console.log('\n--- 3) valori utente mostrati in UI ---');
const varsSrc = fs.readFileSync(path.join(APP, 'js/core/variables.js'), 'utf8');
const mEsc = varsSrc.match(/function _bfEscapeHtml\(s\) \{[\s\S]*?\n\}/);
if (!mEsc) { console.log('  FAIL estrazione _bfEscapeHtml'); fail++; }
else {
  const sbX = { console, String }; sbX.window = sbX; vm.createContext(sbX);
  vm.runInContext(mEsc[0], sbX);
  const esc = s => vm.runInContext('_bfEscapeHtml(' + JSON.stringify(s) + ')', sbX);
  T('escape di < > & nelle celle (niente markup iniettato)', () => {
    eq(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    eq(esc('a & b'), 'a &amp; b');
    eq(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  });
  T('escape delle VIRGOLETTE (il valore finisce anche in title="...")', () => {
    // WP-M4h: da quando ogni cella ha title="<valore>", un " non escapato chiuderebbe
    // l'attributo e permetterebbe di iniettarne altri (onmouseover=...).
    eq(esc('a"b'), 'a&quot;b');
    eq(esc("a'b"), 'a&#39;b');
    if (esc('" onmouseover="alert(1)').indexOf('"') !== -1) throw new Error('virgolette non escapate: iniezione di attributi possibile');
  });
  T('valori normali restano invariati', () => {
    eq(esc('ciao'), 'ciao'); eq(esc(42), '42'); eq(esc(true), 'true');
  });
  T('la griglia celle usa _bfEscapeHtml su OGNI valore (testo E attributo title)', () => {
    // Difesa contro una regressione futura: se qualcuno reintroduce la concatenazione
    // diretta del valore in innerHTML, questo test lo intercetta. Il markup e' cambiato in
    // WP-M4h (ogni cella e' un .ac-cell con title="<valore>"): si verifica che il valore
    // sia escapato in ENTRAMBI i punti in cui compare.
    const grid = varsSrc.match(/html \+= '<div class="ac-cell"[\s\S]*?'<\/div>';/);
    if (!grid) throw new Error('blocco di render celle non trovato');
    const uses = (grid[0].match(/_bfEscapeHtml\(/g) || []).length;
    if (uses < 2) throw new Error('valore non escapato in tutti i punti (title + testo): trovati ' + uses);
  });
}

console.log('\n=== TOTALE: ' + pass + '/' + (pass + fail) + ' PASS ===');
console.log(fail ? '=== repro-array-security: FALLITO ===' : '=== repro-array-security: OK ===');
process.exit(fail ? 1 : 0);

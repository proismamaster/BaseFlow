/*
 * Verifica il MANUALE: dizionario completo in 4 lingue + RENDER REALE in ognuna.
 * Non conta solo le chiavi: carica manual.html come fa il browser (una volta per lingua,
 * impostando la lingua salvata PRIMA che gli script partano) e controlla che nessun
 * elemento tradotto resti vuoto -- che e' il modo in cui una chiave rotta si manifesta.
 * Nota: la logica del manuale vive in una IIFE, quindi non e' richiamabile da fuori:
 * l'unico modo onesto di provarla e' farla girare davvero.
 * Uso: node tools/repro-manual-i18n-2026-07-21.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'manual.html'), 'utf8');
const LANGS = ['it', 'en', 'ar', 'zh'];
let ok = 0, ko = 0;
const c = (d, g, w) => { const good = String(g) === String(w); good ? ok++ : ko++;
  console.log((good ? '  ok  ' : '  FAIL') + ' ' + d.padEnd(54) + ' -> ' + g + (good ? '' : '   atteso ' + w)); };

// --- 1) dizionario
const re = /^\s{4}([a-zA-Z_][\w]*):\s*\[/gm; const keys = []; let m;
while ((m = re.exec(src))) keys.push({ k: m[1], at: m.index });
let bad = 0, empty = [];
for (const { k, at } of keys) {
  const st = src.indexOf('[', at); let d = 0, j = st;
  for (; j < src.length; j++) { if (src[j] === '[') d++; else if (src[j] === ']') { d--; if (d === 0) break; } }
  let arr; try { arr = eval(src.slice(st, j + 1)); } catch (e) { bad++; continue; }
  if (!Array.isArray(arr) || arr.length !== LANGS.length) bad++;
  else if (arr.some(v => typeof v !== 'string' || !v.trim())) empty.push(k);
}
console.log('  (dizionario: ' + keys.length + ' chiavi)');
c('ogni chiave ha ' + LANGS.length + ' lingue', bad, 0);
c('nessuna traduzione vuota', empty.length, 0);
const used = new Set([...src.matchAll(/data-mi(?:-[a-z]+)?="([\w]+)"/g)].map(x => x[1]));
const dict = new Set(keys.map(x => x.k));
c('nessuna chiave usata ma mancante', [...used].filter(x => !dict.has(x)).length, 0);
c('nessuna chiave orfana', [...dict].filter(x => !used.has(x)).length, 0);

// --- 2) render reale, una pagina per lingua
// Il manuale si traduce all'evento `load`, non durante il parse: ispezionarlo prima
// restituisce 215 elementi "vuoti" in OGNI lingua -- sintomo di un test che guarda troppo
// presto, non di traduzioni mancanti. Si aspetta quindi il load, come fa un browser vero.
function rendi(lang) {
  const vc = new VirtualConsole(); // silenzia i "not implemented" innocui (scrollTo)
  const dom = new JSDOM(src, {
    runScripts: 'dangerously', url: 'https://baseflow.local/manual.html', virtualConsole: vc,
    beforeParse(window) { try { window.localStorage.setItem('baseflow-lang', lang); } catch (e) {} }
  });
  return new Promise(res => {
    if (dom.window.document.readyState === 'complete') return res(dom.window);
    dom.window.addEventListener('load', () => res(dom.window));
  });
}
async function main() {
for (const lang of LANGS) {
  const w = await rendi(lang);
  const vuoti = [...w.document.querySelectorAll('[data-mi]')]
    .filter(el => !(el.textContent || '').trim()).map(el => el.getAttribute('data-mi'));
  c('[' + lang + '] nessun elemento tradotto resta vuoto', vuoti.length, 0);
  if (vuoti.length) console.log('        vuoti:', vuoti.slice(0, 10).join(', '));
  c('[' + lang + '] direzione della pagina', w.document.documentElement.getAttribute('dir') || 'ltr', lang === 'ar' ? 'rtl' : 'ltr');
  // i contenuti NUOVI di oggi devono esserci in ogni lingua
  const txt = w.document.body.textContent;
  c('[' + lang + '] ASCII documentato (Asc/Chr)', txt.includes('Asc(') && txt.includes('Chr('), 'true');
  c('[' + lang + '] capitolo Esecuzione ha i 2 paragrafi nuovi',
    w.document.querySelectorAll('#run [data-mi]').length >= 5, 'true');
}

// --- 3) le affermazioni ormai FALSE non devono piu' comparire
const it = (await rendi('it')).document.body.textContent;
c('non dice piu che i campi For sono "caselle numeriche"', /caselle numeriche/.test(it), 'false');
c('dice che il valore String va fra virgolette', /testo fra virgolette/.test(it), 'true');
c('documenta i riferimenti a variabile nella dichiarazione', /valore di quest'altra variabile/.test(it), 'true');

console.log('\n' + ok + ' ok, ' + ko + ' falliti');
process.exit(ko ? 1 : 0);
}
main();

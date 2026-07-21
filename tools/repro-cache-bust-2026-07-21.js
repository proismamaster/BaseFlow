/*
 * WP-M6l: CONTROLLO DI CACHE. Ismail ha segnalato tre volte lo stesso terminale bianco mentre
 * i test sul file passavano: il CSS corretto non gli arrivava perche' il browser serviva la
 * copia in cache. Le quattro pagine dichiaravano quattro `?v=` DIVERSE, nessuna aggiornata
 * dopo le modifiche, e il service worker aveva ancora la cache vecchia.
 * Questo test rende la svista impossibile da ripetere in silenzio:
 *   - tutte le pagine devono puntare alla STESSA versione di style.css;
 *   - quella versione non deve essere piu' vecchia dell'ultima modifica del file.
 * Uso: node tools/repro-cache-bust-2026-07-21.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
let ok = 0, ko = 0;
const c = (d, g, w) => { const good = String(g) === String(w); good ? ok++ : ko++;
  console.log((good ? '  ok  ' : '  FAIL') + ' ' + d.padEnd(56) + ' -> ' + g + (good ? '' : '   atteso ' + w)); };

const PAGINE = ['index.html', 'manual.html', 'privacy.html', 'cookies.html'];
const versioni = {};
for (const p of PAGINE) {
  const s = fs.readFileSync(path.join(APP, p), 'utf8');
  const m = s.match(/style\.css\?v=([0-9a-z]+)/);
  versioni[p] = m ? m[1] : null;
}
const distinte = [...new Set(Object.values(versioni).filter(Boolean))];
c('tutte le pagine usano la STESSA versione di style.css', distinte.length, 1);
if (distinte.length !== 1) console.log('        ' + JSON.stringify(versioni));
c('ogni pagina dichiara una versione', Object.values(versioni).every(Boolean), 'true');

// la versione deve essere >= alla data di modifica del CSS (formato YYYYMMDD + lettera)
const v = distinte[0] || '';
const dataV = v.slice(0, 8);
const mtime = fs.statSync(path.join(APP, 'style.css')).mtime;
const dataFile = mtime.getFullYear() + String(mtime.getMonth() + 1).padStart(2, '0') + String(mtime.getDate()).padStart(2, '0');
c('la versione non e piu vecchia dell ultima modifica del CSS', dataV >= dataFile, 'true');
if (dataV < dataFile) console.log('        ?v=' + v + ' ma style.css modificato il ' + dataFile + ' -> va bumpato');

// il service worker precachea style.css: la sua cache va invalidata insieme
const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
c('il service worker precachea style.css', /['"]style\.css['"]/.test(sw), 'true');
const cn = (sw.match(/CACHE_NAME\s*=\s*'([^']+)'/) || [])[1];
c('  (cache del service worker)', !!cn, 'true');
console.log('        CACHE_NAME = ' + cn + ' · style.css?v=' + v);
console.log('\n' + ok + ' ok, ' + ko + ' falliti');
process.exit(ko ? 1 : 0);

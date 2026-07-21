/*
 * Verifica la COERENZA del tutorial guidato (WP-M6f):
 *  - ogni passo punta a un elemento che ESISTE davvero in index.html;
 *  - i passi della toolbar seguono l'ORDINE REALE dei pulsanti nel DOM;
 *  - tutte le sezioni della palette (quindi tutti i blocchi) sono coperte, in ordine;
 *  - ogni chiave di testo usata esiste nel dizionario i18n, in tutte e 4 le lingue.
 * Uso: node tools/repro-tutorial-2026-07-21.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const tut = fs.readFileSync(path.join(APP, 'js', 'tutorial.js'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(APP, 'js', 'core', 'i18n.js'), 'utf8');
let ok = 0, ko = 0;
const c = (d, g, w) => { const good = String(g) === String(w); good ? ok++ : ko++;
  console.log((good ? '  ok  ' : '  FAIL') + ' ' + d.padEnd(56) + ' -> ' + g + (good ? '' : '   atteso ' + w)); };

// dizionario i18n
const s = i18nSrc.indexOf('const I18N = {');
let i = i18nSrc.indexOf('{', s), d = 0, j = i;
for (; j < i18nSrc.length; j++) { if (i18nSrc[j] === '{') d++; else if (i18nSrc[j] === '}') { d--; if (d === 0) break; } }
const I18N = eval('(' + i18nSrc.slice(i, j + 1) + ')');

// --- 1) ogni selettore #id citato dal tutorial esiste nel markup
const selettori = [...tut.matchAll(/element:\s*'([#.][\w-]+)'/g)].map(m => m[1]);
const mancanti = [...new Set(selettori)].filter(sel => {
  if (sel.startsWith('#')) return !new RegExp('id="' + sel.slice(1) + '"').test(html);
  return !new RegExp('class="[^"]*\\b' + sel.slice(1) + '\\b').test(html);
});
c('ogni ancoraggio del tutorial esiste nel markup', mancanti.length ? mancanti.join(',') : 0, 0);

// --- 2) ordine dei passi toolbar == ordine reale dei pulsanti
const idsToolbar = [...tut.matchAll(/\['[\w-]+',\s*'#([\w-]+)',\s*'tut_\w+',/g)].map(m => m[1]);
const ordineDom = [...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]);
const posDom = idsToolbar.map(id => ordineDom.indexOf(id));
const inOrdine = posDom.every((v, k) => k === 0 || v > posDom[k - 1]);
c('i passi toolbar seguono l ordine del DOM', inOrdine, 'true');
c('numero di passi toolbar', idsToolbar.length >= 10, 'true');

// --- 3) tutte le sezioni della palette sono coperte, in ordine
const sezioniDom = [...html.matchAll(/id="([\w]+-section)"/g)].map(m => m[1]).filter(x => x !== 'credits-section');
const sezioniTut = [...tut.matchAll(/'#([\w]+-section)'/g)].map(m => m[1]);
c('tutte le sezioni della palette sono nel tutorial', sezioniDom.every(x => sezioniTut.includes(x)), 'true');
c('  (sezioni coperte)', sezioniTut.length + '/' + sezioniDom.length, sezioniDom.length + '/' + sezioniDom.length);
c('le sezioni sono nell ordine del DOM', JSON.stringify(sezioniTut), JSON.stringify(sezioniDom));

// --- 4) ogni chiave di testo esiste, in 4 lingue
const chiavi = [...new Set([...tut.matchAll(/tut\('(\w+)'\)/g)].map(m => m[1]).concat(
  [...tut.matchAll(/'(tut_\w+)'\]/g)].map(m => m[1])))];
const senzaChiave = chiavi.filter(k => !I18N[k]);
const senzaLingue = chiavi.filter(k => I18N[k] && (I18N[k].length !== 4 || I18N[k].some(v => !String(v).trim())));
c('ogni chiave del tutorial esiste in i18n', senzaChiave.length ? senzaChiave.join(',') : 0, 0);
c('ogni chiave ha 4 lingue piene', senzaLingue.length ? senzaLingue.join(',') : 0, 0);
console.log('  (chiavi usate dal tutorial: ' + chiavi.length + ')');


// --- 5) WP-M6h/M6i: i due tour nuovi coprono TUTTO e puntano a bersagli reali
const blocchiTut = [...tut.matchAll(/\['(#[\w-]+)',\s*'(\w+)'\]/g)].map(m => m[1]);
const blocchiDom = [...html.matchAll(/id="([\w-]+)"\s+onclick="inserisciNodo\(/g)].map(m => '#' + m[1]);
c('il tour "?" copre tutti i blocchi della palette', blocchiDom.every(x => blocchiTut.includes(x)), 'true');
c('  (blocchi coperti)', blocchiDom.filter(x => blocchiTut.includes(x)).length + '/' + blocchiDom.length, blocchiDom.length + '/' + blocchiDom.length);
const setTut = [...tut.matchAll(/\['(#[\w-]+)',\s*'tut_set_\w+'\]/g)].map(m => m[1]);
const setMancanti = setTut.filter(sel => !new RegExp('id="' + sel.slice(1) + '"').test(html));
c('ogni controllo del tour Impostazioni esiste', setMancanti.length ? setMancanti.join(',') : 0, 0);
c('  (impostazioni spiegate)', setTut.length >= 10, 'true');
// i due pulsanti "?" esistono e chiamano le funzioni giuste
c('pulsante ? nella palette', /id="palette-help"[^>]*onclick="startAllBlocksTutorial\(\)"/.test(html), 'true');
c('pulsante ? nelle impostazioni', /id="settings-help"[^>]*onclick="startSettingsTutorial\(\)"/.test(html), 'true');
c('le due funzioni sono definite', /function startAllBlocksTutorial/.test(tut) && /function startSettingsTutorial/.test(tut), 'true');
// il paragrafone dei blocchi non e' piu' nel tour principale
c('tolto il paragrafo-elenco dal tour principale', /tut\('tut_blocks'\)/.test(tut), 'false');
c('i comandi di esecuzione hanno un passo ciascuno', ['tut_btn_run','tut_btn_step','tut_btn_pause','tut_btn_stop','tut_btn_reset'].every(k => tut.includes(k)), 'true');


// --- 6) WP-M6j: rilievi del secondo giro
c('il tour Impostazioni non punta piu a #run-speed (toolbar)', /\['#run-speed',\s*'tut_set/.test(tut), 'false');
c('spiega i 4 messaggi del terminale', ['cset-output','cset-cond','cset-loop','cset-debug'].every(id => tut.includes('#' + id)), 'true');
// WP-M6k (Ismail: "quando fa start ti apre subito il popup dei blocchi, ma dovrebbe farlo
// solo quando si parla di quello"): la palette NON deve aprirsi all'avvio del tour, ma dal
// passo che la riguarda. Gli ancoraggi ai suoi elementi sopravvivono grazie a _stepLater,
// che tiene l'ancoraggio se l'elemento ESISTE anche se ora e' nascosto.
const preBuild = tut.slice(tut.indexOf('function startTutorial'), tut.indexOf('buildMainTour();', tut.indexOf('function startTutorial')));
c('la palette NON si apre all avvio del tutorial', /popup-window[\s\S]*add\('active'\)/.test(preBuild), 'false');
c('la apre il passo dedicato (palette-open)', /id: 'palette-open'[\s\S]{0,300}add\('active'\)/.test(tut), 'true');
// NB: si contano le OCCORRENZE nel sorgente, non i passi: le 6 sezioni sono generate da un
// unico forEach, quindi il conteggio giusto e' 4 (definizione + palette-open + blocks-info +
// il forEach delle sezioni). Contare 8 sarebbe stato sbagliato e falliva su codice corretto.
c('palette-open, blocks-info e le sezioni usano _stepLater',
  /id: 'palette-open'/.test(tut) && /_stepLater\({ id: 'blocks-info'/.test(tut) && /SEZIONI_PALETTE\.forEach[\s\S]{0,200}_stepLater\(/.test(tut), 'true');
const i18nTxt = fs.readFileSync(path.join(APP, 'js', 'core', 'i18n.js'), 'utf8');
c('tolta la frase sull arabo da tut_set_lang', /right-to-left/.test(i18nTxt.slice(i18nTxt.indexOf('tut_set_lang'), i18nTxt.indexOf('tut_set_lang') + 600)), 'false');
c('nessuna chiave tut_set_speed orfana', /tut_set_speed/.test(i18nTxt) || /tut_set_speed/.test(tut), 'false');


// --- 7) WP-M6n: freccia del tooltip + tutorial dei popup disattivato su mobile
const cssTxt = fs.readFileSync(path.join(APP, 'style.css'), 'utf8');
c('la punta del tooltip segue il tooltip (non e un rombo bianco)',
  /\.shepherd-element \.shepherd-arrow:before[\s\S]{0,200}border:\s*2px solid var\(--primary\)/.test(cssTxt), 'true');
c('la punta si orienta secondo data-popper-placement',
  ['top','bottom','left','right'].every(d => cssTxt.includes('data-popper-placement^="' + d + '"')), 'true');
c('la punta segue anche il tema scuro',
  /body\.dark-mode[\s\S]{0,80}\.shepherd-arrow:before/.test(cssTxt), 'true');
c('su mobile i ? dei popup sono nascosti',
  /@media \(max-width: 760px\)[\s\S]{0,200}#palette-help[\s\S]{0,120}display:\s*none/.test(cssTxt), 'true');
c('e c e anche la guardia in JS (non basta nascondere)',
  (tut.match(/_bfTutorialPopupBloccato\(\)/g) || []).length >= 4, 'true');
c('il tour PRINCIPALE resta attivo su mobile',
  /function startTutorial\(\)[\s\S]{0,300}_bfTutorialPopupBloccato/.test(tut), 'false');


// --- 8) WP-M6o: intestazione a tema, punta tolta dove non punta, testo Do-While non circolare
c('l intestazione del tooltip non e piu grigia fissa',
  /\.shepherd-element \.shepherd-header[\s\S]{0,120}background:\s*transparent/.test(cssTxt), 'true');
c('i passi centrati sul canvas non mostrano la punta',
  (tut.match(/bf-no-arrow/g) || []).length >= 3 && /\.bf-no-arrow \.shepherd-arrow[\s\S]{0,40}display:\s*none/.test(cssTxt), 'true');
const doTxt = I18N['tut_edit_do'] || [];
c('Do-While: spiegazione non circolare (non "come While ma")',
  /come i While|like While/i.test(doTxt[0] + doTxt[1]), 'false');
c('Do-While: dice QUANDO usarlo (caso d uso)',
  /almeno una volta/i.test(doTxt[0]) && /utente|valid/i.test(doTxt[0]), 'true');
c('Do-While: spiegato in tutte e 4 le lingue', doTxt.length === 4 && doTxt.every(v => v.trim().length > 80), 'true');


// --- 9) WP-M6p: descrizioni dei cicli riscritte + Invio = passo successivo
const CICLI = { tut_edit_for: 'For', tut_edit_while: 'While', tut_edit_do: 'Do-While', tut_edit_pause: 'Pausa' };
for (const k of Object.keys(CICLI)) {
  const arr = I18N[k] || [];
  // Soglia PER LINGUA: il cinese e' molto piu' denso (un carattere = una parola), quindi
  // una soglia unica in caratteri boccia traduzioni corrette. Misurata sui testi reali:
  // it/en/ar stanno sopra i 250, zh sopra i 90. Prima soglia unica a 150 -> falso allarme.
  const minimi = [250, 250, 200, 90];
  const puliti = arr.map(v => v.replace(/<[^>]+>/g, ''));
  c(CICLI[k] + ': spiegazione completa in 4 lingue',
    arr.length === 4 && puliti.every((v, idx) => v.length > minimi[idx]), 'true');
}
// il For NON deve piu dire di scrivere init;condizione;incremento a mano (era falso)
c('For: non dice piu di scrivere la sintassi a mano',
  /init\s*;\s*condizione|init;condition/i.test((I18N.tut_edit_for || [])[0] + (I18N.tut_edit_for || [])[1]), 'false');
// la Pausa non e piu descritta come "non eseguibile"
c('Pausa: non e piu detta "non eseguibile"',
  /non eseguibil|non-executing/i.test((I18N.tut_edit_pause || [])[0] + (I18N.tut_edit_pause || [])[1]), 'false');
c('Pausa: e descritta come punto di sospensione/breakpoint',
  /sospension|breakpoint|暂停点|تعليق/i.test(((I18N.tut_edit_pause || []).join(' '))), 'true');
// Invio
c('Invio avanza al passo successivo', /key !== 'Enter'/.test(tut) && /Shepherd\.activeTour/.test(tut), 'true');
c('Invio NON viene rubato dentro i campi di testo', /inCampoDiTesto/.test(tut), 'true');
c('un solo listener globale (non uno per tour)', (tut.match(/addEventListener\('keydown'/g) || []).length, 1);

console.log('\n' + ok + ' ok, ' + ko + ' falliti');
process.exit(ko ? 1 : 0);

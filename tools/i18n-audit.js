#!/usr/bin/env node
// tools/i18n-audit.js — WP-D1 (round 11), esteso al round 12 (Ismail 2026-07-13).
// Audit automatico delle traduzioni sulle 4 lingue (IT/EN/AR/ZH, vedi I18N_LANGS in
// js/core/i18n.js). Pensato per restare nel repo e girare a ogni round futuro (Rule 9
// del piano round 11: "a fine WP consegna esito verifiche").
//
// Cosa verifica (controlli MECCANICI, nessuna euristica sui contenuti):
//   1) Completezza — ogni chiave di I18N ha esattamente I18N_LANGS.length traduzioni,
//      tutte stringhe non vuote (nessuna entry dimenticata durante un edit).
//   2) Riferimenti HTML — ogni data-i18n="…" / data-i18n-ph="…" / data-i18n-title="…"
//      trovato nei file .html della root del repo deve puntare a una chiave ESISTENTE.
//   3) Riferimenti JS — ogni chiamata i18nText('…') / i18nFormat('…', …) / errMsg('…', …)
//      trovata in js/**/*.js deve puntare a una chiave ESISTENTE.
//   4) Chiavi MAI referenziate (ne' da HTML ne' da JS statico) — segnalate come INFO,
//      NON come errore: possono essere usate dinamicamente (chiave composta a runtime,
//      es. `i18nText('theme_var_' + name)`), quindi un falso positivo qui è normale e
//      va giudicato a mano, non "corretto" ciecamente.
//
// Cosa NON fa (deliberatamente): non individua stringhe UI hardcoded nel codice sorgente.
// Distinguere un messaggio utente da un log tecnico/debug richiede giudizio umano (un
// grep generico su ogni stringa letterale produrrebbe troppi falsi positivi su commenti,
// console.log di debug, nomi di variabili, ecc.) — quel controllo resta un audit manuale,
// documentato nel report di consegna di ogni round che tocca WP-D1.
//
// Uso:  node tools/i18n-audit.js
// Exit: 0 se zero errori (chiavi mancanti/incomplete), 1 altrimenti.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'app');

// Carica il VERO oggetto I18N eseguendo i18n.js in una sandbox minimale (niente DOM/
// localStorage: il file li usa solo dentro funzioni, mai al top-level) — molto più
// affidabile di un parsing regex dell'object literal (stringhe con virgolette escaped,
// apici arabi, ecc.).
function loadI18N() {
  const code = fs.readFileSync(path.join(ROOT, 'js/core/i18n.js'), 'utf8');
  const sandbox = { console };
  vm.createContext(sandbox);
  new vm.Script(code, { filename: 'js/core/i18n.js' }).runInContext(sandbox);
  // i18n.js dichiara I18N/I18N_LANGS con `const` a livello di script: sono binding
  // LESSICALI del contesto vm, non proprieta' dell'oggetto sandbox (stessa distinzione
  // gia' incontrata negli harness di R12-G: `let`/`const` top-level in un vm.Script NON
  // diventano proprieta' del global object, a differenza di `var`/function). Un secondo,
  // piccolo script eseguito nello STESSO contesto puo' pero' leggerli come identificatori
  // e restituirli come valore di completamento — questo e' il modo corretto per "farli
  // uscire" verso il codice Node che ha chiamato runInContext.
  return new vm.Script('({ I18N: I18N, I18N_LANGS: I18N_LANGS })', { filename: 'i18n-audit-bridge.js' }).runInContext(sandbox);
}

// Elenca ricorsivamente i file con una delle estensioni date sotto `dir`.
function listFiles(dir, exts, out) {
  out = out || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, exts, out);
    else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

// 5) Smoke test funzionale di applyLanguage — R13-A (2026-07-12, regressione trovata da
// Ismail: "cambiare lingua non ritraduce, solo l'arabo attiva il RTL"). Causa: applyLanguage
// non assegnava MAI `currentLang = lang`, quindi i18nText()/i18nFormat() (che leggono
// currentLang, non il parametro `lang`) restavano sempre sull'italiano; dir/lang invece
// venivano impostati correttamente perche' usano direttamente il parametro `lang`. Nessuna
// eccezione veniva lanciata: e' un bug SILENZIOSO, non individuabile con un try/catch.
//
// Esegue il VERO js/core/i18n.js in una sandbox vm separata con un DOM finto minimale
// (stesso pattern di tools/repro-round2-harness.js: niente jsdom, solo querySelectorAll/
// getElementById/documentElement mock), poi chiama setLanguage(lang) per OGNI lingua di
// I18N_LANGS e verifica: (a) nessuna eccezione; (b) currentLang segue il parametro; (c) il
// testo/placeholder/title degli elementi data-i18n* vengono aggiornati coerentemente con la
// lingua corrente (confrontati con i18nText() eseguito nella STESSA sandbox, cosi' il check
// resta valido anche se le traduzioni cambiano in futuro); (d) dir/lang sull'html sono
// coerenti (rtl SOLO per 'ar'). Se questo blocco torna a fallire, la regressione R13-A e'
// tornata.
function runApplyLanguageSmoke(I18N_LANGS_REF) {
  const errs = [];
  function makeEl(tag) {
    return {
      tagName: tag || 'DIV', _attrs: {}, textContent: '',
      setAttribute(k, v) { this._attrs[k] = v; },
      getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
    };
  }
  const elText = makeEl('SPAN'); elText.setAttribute('data-i18n', 'new');
  const elPh = makeEl('INPUT'); elPh.setAttribute('data-i18n-ph', 'value_ph');
  const elTitle = makeEl('BUTTON'); elTitle.setAttribute('data-i18n-title', 'undo');
  const htmlEl = { _attrs: {}, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k]; } };
  const langSelect = { value: '' };
  const documentMock = {
    querySelectorAll(sel) {
      if (sel === '[data-i18n]') return [elText];
      if (sel === '[data-i18n-ph]') return [elPh];
      if (sel === '[data-i18n-title]') return [elTitle];
      return [];
    },
    getElementById(id) { return id === 'lang-select' ? langSelect : null; },
    documentElement: htmlEl,
  };
  const localStorageMock = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
  const context = { document: documentMock, localStorage: localStorageMock, console };
  vm.createContext(context);
  const code = fs.readFileSync(path.join(ROOT, 'js/core/i18n.js'), 'utf8');
  try {
    new vm.Script(code, { filename: 'js/core/i18n.js (smoke applyLanguage)' }).runInContext(context);
  } catch (e) {
    errs.push('[smoke applyLanguage] impossibile caricare i18n.js nella sandbox DOM: ' + e.message);
    return errs;
  }
  for (const lang of I18N_LANGS_REF) {
    let threw = null;
    try {
      vm.runInContext('setLanguage(' + JSON.stringify(lang) + ')', context);
    } catch (e) {
      threw = e;
    }
    if (threw) {
      errs.push('[smoke applyLanguage] setLanguage("' + lang + '") ha lanciato un\'eccezione: ' + (threw.stack || threw.message));
      continue;
    }
    const curLang = vm.runInContext('currentLang', context);
    if (curLang !== lang) {
      errs.push('[smoke applyLanguage] dopo setLanguage("' + lang + '"): currentLang e\' rimasta "' + curLang +
        '" invece di "' + lang + '" — il testo tradotto NON segue piu\' la lingua (regressione R13-A).');
    }
    const expectedDir = lang === 'ar' ? 'rtl' : 'ltr';
    if (htmlEl._attrs.dir !== expectedDir) {
      errs.push('[smoke applyLanguage] dopo setLanguage("' + lang + '"): dir="' + htmlEl._attrs.dir + '" atteso "' + expectedDir + '".');
    }
    if (htmlEl._attrs.lang !== lang) {
      errs.push('[smoke applyLanguage] dopo setLanguage("' + lang + '"): lang="' + htmlEl._attrs.lang + '" atteso "' + lang + '".');
    }
    const expectedText = vm.runInContext("i18nText('new')", context);
    const expectedPh = vm.runInContext("i18nText('value_ph')", context);
    const expectedTitle = vm.runInContext("i18nText('undo')", context);
    if (elText.textContent !== expectedText) {
      errs.push('[smoke applyLanguage] testo [data-i18n] non aggiornato per "' + lang + '": "' + elText.textContent + '" atteso "' + expectedText + '".');
    }
    if (elPh._attrs.placeholder !== expectedPh) {
      errs.push('[smoke applyLanguage] placeholder [data-i18n-ph] non aggiornato per "' + lang + '": "' + elPh._attrs.placeholder + '" atteso "' + expectedPh + '".');
    }
    if (elTitle._attrs.title !== expectedTitle) {
      errs.push('[smoke applyLanguage] title [data-i18n-title] non aggiornato per "' + lang + '": "' + elTitle._attrs.title + '" atteso "' + expectedTitle + '".');
    }
  }
  return errs;
}

function main() {
  const { I18N, I18N_LANGS } = loadI18N();
  if (!I18N || !Array.isArray(I18N_LANGS)) {
    console.error('i18n-audit: impossibile caricare I18N/I18N_LANGS da js/core/i18n.js — STOP.');
    process.exit(2);
  }
  const keys = Object.keys(I18N);
  const errors = [];
  const infos = [];
  const referenced = new Set();

  // 1) Completezza di ogni chiave definita.
  for (const k of keys) {
    const entry = I18N[k];
    if (!Array.isArray(entry) || entry.length !== I18N_LANGS.length) {
      errors.push('[completezza] "' + k + '": attese ' + I18N_LANGS.length + ' traduzioni, trovate ' +
        (Array.isArray(entry) ? entry.length : typeof entry));
      continue;
    }
    entry.forEach(function (v, i) {
      if (typeof v !== 'string' || v.trim() === '') {
        errors.push('[completezza] "' + k + '" [' + I18N_LANGS[i] + ']: entry vuota o non-stringa');
      }
    });
  }

  // 2) Riferimenti nei file HTML della root (index.html, privacy.html, cookies.html, ...).
  const htmlFiles = fs.readdirSync(ROOT).filter(function (f) { return f.endsWith('.html'); });
  const attrRe = /data-i18n(?:-ph|-title)?="([^"]+)"/g;
  for (const rel of htmlFiles) {
    const full = path.join(ROOT, rel);
    const content = fs.readFileSync(full, 'utf8');
    let m;
    attrRe.lastIndex = 0;
    while ((m = attrRe.exec(content))) {
      referenced.add(m[1]);
      if (keys.indexOf(m[1]) === -1) errors.push('[html] ' + rel + ': riferimento a chiave inesistente "' + m[1] + '"');
    }
  }

  // 3) Riferimenti nei file JS sotto js/ (core/*.js + js/*.js: tutto cio' che e' "app",
  // vedi mappa file in CLAUDE.md/piano round 11 — tools/, test-*.js (vuoti), script.js
  // (stub morto post-refactor) e sw.js (service worker, nessuna stringa UI) restano
  // fuori deliberatamente).
  const jsFiles = listFiles(path.join(ROOT, 'js'), ['.js']);
  const callRe = /\b(?:i18nText|i18nFormat|errMsg)\(\s*['"]([^'"]+)['"]/g;
  for (const full of jsFiles) {
    const rel = path.relative(ROOT, full);
    const content = fs.readFileSync(full, 'utf8');
    let m;
    callRe.lastIndex = 0;
    while ((m = callRe.exec(content))) {
      referenced.add(m[1]);
      if (keys.indexOf(m[1]) === -1) errors.push('[js] ' + rel + ': riferimento a chiave inesistente "' + m[1] + '"');
    }
  }

  // 4) Chiavi definite ma mai trovate in un riferimento STATICO (info, non errore: una
  // chiave puo' essere referenziata dinamicamente, es. `i18nText('theme_var_' + name)`,
  // che questa regex non puo' seguire — falsi positivi qui vanno giudicati a mano).
  for (const k of keys) {
    if (!referenced.has(k)) infos.push('"' + k + '"');
  }

  // 5) Smoke funzionale di applyLanguage — vedi commento sopra runApplyLanguageSmoke.
  const smokeErrors = runApplyLanguageSmoke(I18N_LANGS);
  errors.push.apply(errors, smokeErrors);

  console.log('i18n-audit: ' + keys.length + ' chiavi definite, ' + I18N_LANGS.length + ' lingue (' + I18N_LANGS.join(', ') + ').');
  console.log('File scansionati: ' + htmlFiles.length + ' html, ' + jsFiles.length + ' js (sotto js/).');
  console.log('');
  if (errors.length) {
    console.log('ERRORI (' + errors.length + '):');
    errors.forEach(function (e) { console.log('  - ' + e); });
  } else {
    console.log('ERRORI: nessuno.');
  }
  console.log('');
  if (infos.length) {
    console.log('INFO — chiavi definite ma mai referenziate STATICAMENTE (' + infos.length + ', possibili falsi positivi se usate con chiave composta a runtime):');
    infos.forEach(function (i) { console.log('  - ' + i); });
  } else {
    console.log('INFO: nessuna chiave orfana.');
  }
  console.log('');
  console.log('Smoke test applyLanguage (R13-A, ' + I18N_LANGS.length + ' lingue): ' +
    (smokeErrors.length ? smokeErrors.length + ' PROBLEMI (vedi sopra, prefisso "[smoke applyLanguage]").' : 'OK, nessuna regressione.'));
  console.log('');
  console.log(errors.length ? '=== i18n-audit: FALLITO ===' : '=== i18n-audit: OK ===');
  process.exit(errors.length ? 1 : 0);
}

main();

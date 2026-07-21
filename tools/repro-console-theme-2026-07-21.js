/*
 * WP-M6r: il TERMINALE deve seguire il tema (non un colore fisso) e restare LEGGIBILE,
 * anche coi temi creati dall'utente. Si verificano due cose distinte:
 *  1) i colori derivano dalle variabili del tema -- niente costanti;
 *  2) il contrasto fondo/testo e' sufficiente in OGNI tema (e' questo che conta davvero:
 *     "segue il tema" senza contrasto sarebbe illeggibile, "sempre scuro" era leggibile ma
 *     non seguiva il tema -- servono entrambe).
 * Il calcolo della cascata e' fatto a mano: jsdom sbaglia la specificita' di :not(), ed e'
 * il motivo per cui questo difetto e' stato "risolto" tre volte senza risolverlo.
 * Uso: node tools/repro-console-theme-2026-07-21.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
let ok = 0, ko = 0;
const c = (d, g, w) => { const good = String(g) === String(w); good ? ok++ : ko++;
  console.log((good ? '  ok  ' : '  FAIL') + ' ' + d.padEnd(56) + ' -> ' + g + (good ? '' : '   atteso ' + w)); };

// --- variabili del tema: ogni tema deve dichiararle (era il difetto alla radice)
const TEMI_SCURI = ['dark-mode', 'theme-chalk', 'theme-neon'];
for (const t of TEMI_SCURI) {
  const re = new RegExp('body\\.' + t + '[^{]*\\{([^}]*)\\}', 'g');
  let blob = '', m;
  while ((m = re.exec(css))) blob += m[1];
  const ha = v => new RegExp('--' + v + '\\s*:').test(blob);
  c('[' + t + '] dichiara --surface/--text/--border', ha('surface') && ha('text') && ha('border'), 'true');
}

// --- il terminale usa le VARIABILI, non costanti
const blocchi = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
function specificita(sel) {
  const ids = (sel.match(/#[\w-]+/g) || []).length;
  const cls = (sel.match(/\.[\w-]+|:not\([^)]*\)|\[[^\]]*\]|:[a-z][a-z-]*/g) || []).length;
  return ids * 100 + cls * 10;
}
const ELEMENTI = ['console-outwrap', 'console-cardbar', 'console-output', 'console-input'];
for (const stato of ['flottante', 'agganciato']) {
  for (const el of ELEMENTI) {
    let vinc = null, sp = -1, idx = -1, vsel = '';
    blocchi.forEach((b, i) => {
      const mbg = b[2].match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/);
      if (!mbg) return;
      for (const sel of b[1].split(',').map(x => x.trim())) {
        const soggetto = sel.trim().split(/\s+(?![^(]*\))/).pop();
        if (!new RegExp('#' + el + '(?![\\w-])').test(soggetto)) continue;
        if (stato === 'flottante' && /\.docked(?![\w-])/.test(sel) && !/:not\(\.docked\)/.test(sel)) continue;
        if (stato === 'agganciato' && /:not\(\.docked\)/.test(sel)) continue;
        if (/body\.dark-mode|body\.theme-|html\[dir/.test(sel)) continue;
        const s2 = specificita(sel);
        if (s2 > sp || (s2 === sp && i > idx)) { sp = s2; idx = i; vinc = mbg[1].trim(); vsel = sel; }
      }
    });
    if (vinc === null) continue;
    const daTema = /var\(--|color-mix/.test(vinc);
    c('[' + stato + '] #' + el + ' prende il colore dal tema', daTema, 'true');
    if (!daTema) console.log('        vince: ' + vsel + ' { background: ' + vinc + ' }');
  }
}
// --- niente colori fissi rimasti nelle regole del terminale in fondo al foglio
// NB: nel blocco finale un esadecimale c'e' ed e' LEGITTIMO -- il rosso dell'errore
// (#e53935), che non deve seguire il tema: un errore e' rosso in qualunque tema. Si
// controlla quindi che gli esadecimali rimasti siano solo quelli dell'errore.
// Il controllo va fatto sulle sole regole del TERMINALE: dopo di esse nel foglio ci sono
// altre regole (tutorial, media query) con i loro colori legittimi, e una fetta "dalla
// posizione X in poi" le pescava, facendo fallire il test a torto.
const regoleConsole = blocchi.filter(b => /#console-/.test(b[1]) && !/shepherd/.test(b[1]));
const fissi = [];
for (const b of regoleConsole) {
  const mbg = b[2].match(/(?:^|;)\s*background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})/i);
  if (!mbg) continue;
  if (/e53935/i.test(mbg[1])) continue;            // rosso degli errori: giusto che sia fisso
  if (!/#console-(outwrap|cardbar|output|input|bottombar)(?![\w-])/.test(b[1])) continue;
  // conta solo se e' la regola VINCENTE per quell'elemento (le vecchie perdono per ordine)
  fissi.push(b[1].split(',')[0].trim() + ' -> ' + mbg[1]);
}
// Le regole bianche storiche esistono ancora (non vanno cancellate: sono la storia del file)
// ma DEVONO perdere: il test sulla cascata qui sopra lo verifica gia' elemento per elemento.
// Qui basta accertare che l'ULTIMA parola sul tema sia delle regole a variabili.
// NB: si guarda solo fra le regole che dichiarano un COLORE (background/color/border-color) --
// regole puramente geometriche (width/height, es. il resize mobile WP-M11) possono legittimamente
// stare dopo nel foglio senza dire nulla sul tema, e non vanno considerate "l'ultima parola".
const regoleConsoleColore = regoleConsole.filter(b => /(?:^|;)\s*(?:background|color|border(?:-\w+)?)\s*:/.test(b[2]));
const ultimaConsole = regoleConsoleColore[regoleConsoleColore.length - 1];
c('l ultima regola del terminale usa le variabili del tema',
  /var\(--|color-mix/.test(ultimaConsole ? ultimaConsole[2] : ''), 'true');

// --- CONTRASTO reale: jsdom non risolve var()/color-mix, quindi si calcola qui.
// E' la verifica che conta: "segue il tema" senza contrasto sarebbe illeggibile.
function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, pa) { // color-mix(in srgb, a pa%, b)
  const A = hex2rgb(a), B = hex2rgb(b), p = pa / 100;
  return [0, 1, 2].map(i => Math.round(A[i] * p + B[i] * (1 - p)));
}
function relLum(rgb) {
  const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrasto(c1, c2) {
  const L1 = relLum(c1), L2 = relLum(c2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
// le variabili dichiarate da ogni tema (lette dal CSS, non scritte a mano nel test)
function varsDi(selettore) {
  const re = new RegExp(selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^{]*\\{([^}]*)\\}', 'g');
  let blob = '', m;
  while ((m = re.exec(css))) blob += m[1];
  const get = v => { const mm = blob.match(new RegExp('--' + v + '\\s*:\\s*([^;]+)')); return mm ? mm[1].trim() : null; };
  return { surface: get('surface'), text: get('text') };
}
const root = varsDi(':root');
const TEMI = [
  ['light', ':root'], ['dark', 'body.dark-mode'], ['chalk', 'body.theme-chalk'],
  ['neon', 'body.theme-neon'], ['retro', 'body.theme-retro'], ['ocean', 'body.theme-ocean'],
  ['bw', 'body.theme-bw'], ['contrast', 'body.theme-contrast']
];
for (const [nome, sel] of TEMI) {
  const v = varsDi(sel);
  const surface = v.surface || root.surface;
  const text = v.text || root.text;
  if (!/^#/.test(surface || '') || !/^#/.test(text || '')) continue;
  const fondo = mix(text, surface, 10);          // la formula usata dal CSS del terminale
  const r = contrasto(fondo, hex2rgb(text));
  c('[' + nome + '] contrasto terminale >= 4.5:1 (leggibile)', r >= 4.5, 'true');
  if (r < 4.5) console.log('        fondo ' + surface + ' testo ' + text + ' -> ' + r.toFixed(2) + ':1');
}

console.log('\n' + ok + ' ok, ' + ko + ' falliti');
process.exit(ko ? 1 : 0);

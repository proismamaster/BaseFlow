#!/usr/bin/env node
// tools/repro-bflow-format.js — harness PERMANENTE del formato .bflow (2026-07-19).
// Verifica il modulo js/core/fileFormat.js: involucro con checksum, rilevamento di
// corruzione/troncamento, retrocompatibilità coi .json legacy, gestione versioni future.
// Uso: node tools/repro-bflow-format.js — exit 0 se tutto passa.

const fs = require('fs'); const vm = require('vm');
const REPO = __dirname + '/..';

const context = { console, Math, JSON, parseFloat, parseInt, String, Array, TextEncoder, TextDecoder, Uint8Array };
vm.createContext(context);
vm.runInContext(fs.readFileSync(REPO + '/js/core/fileFormat.js', 'utf8'), context, { filename: 'fileFormat.js' });
const F = vm.runInContext('BaseFlowFormat', context);

let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; failures.push(name + (extra ? ' -- ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' -- ' + extra : '')); }
}

const sampleFlow = {
  nodes: [
    { type: 'start', next: '1' },
    { type: 'assign', info: 'x = 1 + 2', next: '2' },
    { type: 'end', next: null }
  ],
  variables: [{ name: 'x', type: 'int', value: '0' }, { name: 'اسم', type: 'string', value: '值' }], // unicode: arabo+cinese
  author: 'Ismail'
};

// 1) Round-trip completo v2 opaco: serializza -> parseLoadedText -> payload identico.
{
  const text = F.serializeForSave(sampleFlow);
  const res = F.parseLoadedText(text);
  check('S1 round-trip v2: ok', res.ok === true && res.legacy === false);
  check('S1 round-trip v2: payload identico (unicode incluso)', JSON.stringify(res.flow) === JSON.stringify(sampleFlow));
}

// 2) OPACITÀ: il contenuto NON deve essere leggibile a occhio nel file.
{
  const text = F.serializeForSave(sampleFlow);
  check('S2 opaco: inizia col magic BFLOW1', text.slice(0, 6) === 'BFLOW1');
  check('S2 opaco: nessun nome variabile in chiaro', text.indexOf('اسم') === -1 && text.indexOf('"type"') === -1 && text.indexOf('Ismail') === -1);
  check('S2 opaco: nessun frammento JSON in chiaro', text.indexOf('nodes') === -1 && text.indexOf('start') === -1);
}

// 3) Corruzione del blob opaco (un carattere base64 cambiato) -> rifiutato.
{
  let text = F.serializeForSave(sampleFlow);
  // cambia un carattere nel corpo (dopo il magic e la prima riga)
  const idx = 40;
  const ch = text[idx] === 'A' ? 'B' : 'A';
  text = text.slice(0, idx) + ch + text.slice(idx + 1);
  const res = F.parseLoadedText(text);
  check('S3 blob opaco corrotto -> rifiutato', res.ok === false && (res.reason === 'checksum' || res.reason === 'corrupt'));
}

// 4) Troncamento del file opaco -> rifiutato (mai payload parziale).
{
  const text = F.serializeForSave(sampleFlow);
  const res = F.parseLoadedText(text.slice(0, Math.floor(text.length * 0.6)));
  check('S4 file opaco troncato -> rifiutato', res.ok === false);
}

// 5) Payload mutilato ma involucro valido: difeso dal checksum. Ricostruisco un file opaco
//    con checksum che NON corrisponde al payload (simula manomissione/decodifica parziale).
{
  const goodText = F.serializeForSave(sampleFlow);
  const body = goodText.slice(6).replace(/\s+/g, '');
  const env = JSON.parse(F._utf8Decode(F._obfuscate(F._b64decode(body))));
  env.payload.nodes.pop();           // mutila DOPO la firma
  const badEnvJson = JSON.stringify(env);
  const badText = 'BFLOW1\n' + F._b64encode(F._obfuscate(F._utf8Encode(badEnvJson)));
  const res = F.parseLoadedText(badText);
  check('S5 payload mutilato (checksum non torna) -> rifiutato', res.ok === false && res.reason === 'checksum');
}

// 6) Legacy: un flow .json puro (senza involucro) si apre ancora.
{
  const res = F.parseLoadedText(JSON.stringify(sampleFlow));
  check('S6 legacy .json -> accettato (legacy=true)', res.ok === true && res.legacy === true && Array.isArray(res.flow.nodes));
}

// 7) v1 involucro JSON (formato transitorio) -> ancora leggibile.
{
  const seed = 2; // MAX_READ_VERSION; costruisco un v1-like con checksum coerente al seed dichiarato
  const payloadStr = JSON.stringify(sampleFlow);
  const v1 = { _bfFormat: 'BaseFlow', _bfVersion: 1, _bfAlgo: 'cyrb53', _bfChecksum: F.cyrb53(payloadStr, 1), payload: sampleFlow };
  const res = F.parseLoadedText(JSON.stringify(v1));
  check('S7 v1 involucro JSON in chiaro -> accettato', res.ok === true && res.legacy === false);
}

// 8) Versione futura -> rifiutato (version).
{
  const v = { _bfFormat: 'BaseFlow', _bfVersion: 99, _bfAlgo: 'cyrb53', _bfChecksum: 'x', payload: sampleFlow };
  const res = F.parseLoadedText(JSON.stringify(v));
  check('S8 versione futura -> rifiutato (version)', res.ok === false && res.reason === 'version' && res.detail === '99');
}

// 9) Sensibilità dell'hash.
{
  const a = F.cyrb53('abcdef', 1), b = F.cyrb53('abcdeg', 1), c = F.cyrb53('abcde', 1), d = F.cyrb53('abcdef', 1);
  check('S9 cyrb53: deterministico', a === d);
  check('S9 cyrb53: sensibile a un carattere', a !== b);
  check('S9 cyrb53: sensibile al troncamento', a !== c);
  check('S9 cyrb53: hex 14 cifre', /^[0-9a-f]{14}$/.test(a));
}

// 10) base64/utf8/offuscamento: round-trip a livello byte (unicode).
{
  const s = 'ciao اسم 值 <>&"\' 🚀';
  const back = F._utf8Decode(F._b64decode(F._b64encode(F._utf8Encode(s))));
  check('S10 base64+utf8 round-trip (unicode+emoji)', back === s);
  const bytes = F._utf8Encode(s);
  const deobf = F._obfuscate(F._obfuscate(bytes)); // XOR due volte = identità
  check('S10 offuscamento reversibile', F._utf8Decode(deobf) === s);
}

// 11) Non-opaco malformato -> parse error (non checksum).
{
  const res = F.parseLoadedText('{ questo non è json');
  check('S11 testo non-JSON e non-opaco -> reason parse', res.ok === false && res.reason === 'parse');
}

console.log('');
console.log('=== TOTALE: ' + pass + '/' + (pass + fail) + ' PASS ===');
if (fail) { console.error('FALLITI:'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('=== repro-bflow-format: OK ===');

// fileFormat.js — Formato file BaseFlow con integrità + contenuto OPACO (2026-07-19).
//
// Richieste di Ismail:
//  1) "un formato diverso dal json così ci assicuriamo che non ci sia corruzione nel
//     caricamento" -> CHECKSUM: al load si ricalcola e si confronta; corrotto -> rifiutato.
//  2) "criptare il contenuto e non renderlo leggibile all'utente, tipo binario, con la
//     nostra estensione" (esempio: il file .flogo di Flowgorithm = magic ASCII "flogo1" +
//     dati gzip) -> CONTENUTO OPACO: il flowchart non è più testo JSON leggibile a occhio,
//     ma un blob offuscato+base64 dietro un magic "BFLOW1".
//
// ⚠️ ONESTÀ INTELLETTUALE (commentata apposta per chi legge il codice): BaseFlow è un'app
// PURAMENTE client-side. Qualsiasi chiave di cifratura deve stare nel JS, che l'utente può
// ispezionare -> non esiste cifratura "vera" (segreta) possibile qui. Quindi questo è
// OFFUSCAMENTO robusto, non crittografia: il file non è leggibile né modificabile a mano da
// un utente normale, e col checksum ogni manomissione/corruzione viene rilevata al load. Un
// attaccante determinato che legge questo sorgente può decodificare — è una proprietà
// inevitabile del client-side, identica a .flogo (che è solo gzip, apribile da chiunque).
//
// FORMATI GESTITI IN LETTURA (retrocompatibilità totale):
//  - v2 OPACO (nuovo default in scrittura): file di testo che INIZIA con "BFLOW1\n" seguito
//    da base64 dell'involucro offuscato. Contenuto non leggibile.
//  - v1 involucro JSON (prodotto per poche ore il 2026-07-19): { _bfFormat, _bfChecksum, payload }.
//  - legacy .json puro (senza involucro): l'oggetto flow diretto.
(function (global) {
  'use strict';

  var BF_MAGIC = 'BaseFlow';       // magic dell'involucro JSON (v1/v2 interno)
  var BF_OPAQUE_MAGIC = 'BFLOW1';  // magic ASCII in testa al file v2 (come "flogo1")
  var BF_VERSION = 2;              // versione di FORMATO scritta da oggi (v2 = opaco)
  var BF_MAX_READ_VERSION = 2;     // versioni che questo build sa leggere
  var BF_ALGO = 'cyrb53';
  var BF_EXT = '.bflow';
  // Chiave di offuscamento: NON è un segreto (vedi nota sopra) — serve solo a rendere il
  // file illeggibile/non-editabile a occhio. Cambiarla romperebbe la lettura dei file già
  // salvati, quindi resta fissa.
  var BF_OBF_KEY = 'BaseFlow/obf/v2/keystream';

  // ---- cyrb53 (hash 53 bit, dominio pubblico — Bryc): dipende da ogni byte e dalla
  // lunghezza -> rileva troncamento/bit-flip. Non crittografico (non serve esserlo).
  function cyrb53(str, seed) {
    str = String(str == null ? '' : str);
    seed = seed >>> 0 || 0;
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    var hiHex = ('0000000' + ((h2 & 0x1fffff) >>> 0).toString(16)).slice(-6);
    var loHex = ('0000000' + (h1 >>> 0).toString(16)).slice(-8);
    return hiHex + loHex;
  }

  // ---- UTF-8 <-> bytes. TextEncoder/TextDecoder sono in tutti i browser moderni e in Node;
  // fallback manuale per ambienti minimali (mai realmente usato in produzione).
  function utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return out;
  }
  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(new Uint8Array(bytes));
    var out = '', i = 0, c, c2, c3;
    while (i < bytes.length) {
      c = bytes[i++];
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c < 0xe0) { c2 = bytes[i++]; out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f)); }
      else { c2 = bytes[i++]; c3 = bytes[i++]; out += String.fromCharCode(((c & 0xf) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f)); }
    }
    return out;
  }

  // ---- base64 byte-level (indipendente da btoa/atom, così regge Unicode e gira nel vm).
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64encode(bytes) {
    var out = '', i;
    for (i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      out += B64[b0 >> 2];
      out += B64[((b0 & 3) << 4) | (b1 >> 4)];
      out += (i + 1 < bytes.length) ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
      out += (i + 2 < bytes.length) ? B64[b2 & 63] : '=';
    }
    return out;
  }
  var B64LUT = (function () { var m = {}; for (var i = 0; i < B64.length; i++) m[B64[i]] = i; return m; })();
  function b64decode(str) {
    var clean = String(str).replace(/[^A-Za-z0-9+/]/g, ''), out = [], i;
    for (i = 0; i < clean.length; i += 4) {
      var c0 = B64LUT[clean[i]], c1 = B64LUT[clean[i + 1]], c2 = B64LUT[clean[i + 2]], c3 = B64LUT[clean[i + 3]];
      if (c0 === undefined || c1 === undefined) break;
      out.push((c0 << 2) | (c1 >> 4));
      if (c2 !== undefined) out.push(((c1 & 15) << 4) | (c2 >> 2));
      if (c3 !== undefined) out.push(((c2 & 3) << 6) | c3);
    }
    return out;
  }

  // ---- Offuscamento reversibile (XOR con keystream derivato dalla chiave + posizione).
  function obfuscate(bytes) {
    var key = BF_OBF_KEY, out = new Array(bytes.length), i, k;
    for (i = 0; i < bytes.length; i++) {
      k = key.charCodeAt(i % key.length) ^ ((i * 181 + 59) & 0xff);
      out[i] = (bytes[i] ^ k) & 0xff;
    }
    return out;
  }
  var deobfuscate = obfuscate; // XOR è la sua stessa inversa

  function canonicalPayload(payload) { return JSON.stringify(payload); }

  // Stringa su cui si calcola il checksum. In v2 include ANCHE versione e algoritmo (non solo
  // il payload): così una corruzione che colpisce i METADATI dell'involucro (nome/valore di un
  // campo, versione, algoritmo) — e non il payload — viene comunque rilevata. In v1 (formato
  // transitorio del mattino) il checksum copriva solo il payload: quel caso è gestito a parte
  // in unwrapLoadedFile per retrocompatibilità.
  function checksumInput(versionNum, algo, payload) {
    return String(versionNum) + '|' + String(algo) + '|' + canonicalPayload(payload);
  }

  // Involucro logico (magic/versione/algo/checksum + payload). Usato sia da v1 (scritto in
  // chiaro come JSON) sia da v2 (poi offuscato). unwrapLoadedFile lo valida in entrambi i casi.
  function buildEnvelope(payload) {
    return {
      _bfFormat: BF_MAGIC,
      _bfVersion: BF_VERSION,
      _bfAlgo: BF_ALGO,
      _bfChecksum: cyrb53(checksumInput(BF_VERSION, BF_ALGO, payload), BF_VERSION),
      payload: payload
    };
  }

  // Testo finale da scrivere su file: v2 OPACO = magic + base64(offusca(utf8(envelope JSON))).
  function serializeForSave(payload) {
    var envJson = JSON.stringify(buildEnvelope(payload));
    var opaque = b64encode(obfuscate(utf8Encode(envJson)));
    // A blocchi di 76 char per un minimo di igiene del file (righe non infinite).
    var wrapped = opaque.replace(/(.{76})/g, '$1\n');
    return BF_OPAQUE_MAGIC + '\n' + wrapped + '\n';
  }

  // Riconosce l'involucro JSON v1 (magic presente).
  function isWrapped(obj) {
    return !!(obj && typeof obj === 'object' && obj._bfFormat === BF_MAGIC);
  }

  // Valida un involucro GIÀ in forma oggetto (v1 diretto, o v2 dopo de-offuscamento).
  //   { ok:true, flow:<payload>, legacy:false } | { ok:false, reason, detail }
  function unwrapLoadedFile(parsed) {
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, reason: 'structure', detail: 'contenuto non valido' };
    }
    if (!isWrapped(parsed)) {
      // .json legacy senza involucro: nessun checksum, si usa così.
      return { ok: true, flow: parsed, legacy: true };
    }
    var ver = parsed._bfVersion;
    if (typeof ver === 'number' && ver > BF_MAX_READ_VERSION) {
      return { ok: false, reason: 'version', detail: String(ver) };
    }
    var payload = parsed.payload;
    if (!payload || typeof payload !== 'object') {
      return { ok: false, reason: 'structure', detail: 'payload mancante o non valido' };
    }
    var expected = parsed._bfChecksum;
    var actual;
    if (ver === 1) {
      // v1 (formato transitorio del 2026-07-19 mattino): checksum solo sul payload, seed 1.
      actual = cyrb53(canonicalPayload(payload), 1);
    } else {
      // v2+: checksum su versione+algo+payload (copre anche i metadati dell'involucro). Se un
      // campo dell'involucro è corrotto (es. il nome-chiave _bfVersion mangled -> ver undefined),
      // la stringa ricalcolata differisce da quella firmata -> mismatch -> rifiutato.
      actual = cyrb53(checksumInput(ver, parsed._bfAlgo, payload), (typeof ver === 'number' ? ver : BF_VERSION));
    }
    if (typeof expected !== 'string' || expected !== actual) {
      return { ok: false, reason: 'checksum', detail: 'atteso ' + expected + ', calcolato ' + actual };
    }
    return { ok: true, flow: payload, legacy: false };
  }

  // Il file v2 è opaco: riconoscilo dal magic in testa.
  function isOpaque(text) {
    return typeof text === 'string' && text.slice(0, BF_OPAQUE_MAGIC.length) === BF_OPAQUE_MAGIC;
  }

  // ENTRY POINT unico dal caricatore: prende il TESTO del file e ritorna
  //   { ok:true, flow, legacy } | { ok:false, reason:'parse'|'checksum'|'version'|'structure'|'corrupt', detail }
  function parseLoadedText(text) {
    if (typeof text !== 'string') return { ok: false, reason: 'structure', detail: 'contenuto non testuale' };
    if (isOpaque(text)) {
      // v2 opaco: togli il magic, decodifica, de-offusca, riparse l'involucro.
      var body = text.slice(BF_OPAQUE_MAGIC.length).replace(/\s+/g, '');
      if (!body) return { ok: false, reason: 'corrupt', detail: 'file opaco vuoto' };
      var envJson;
      try {
        envJson = utf8Decode(deobfuscate(b64decode(body)));
      } catch (e) {
        return { ok: false, reason: 'corrupt', detail: 'decodifica fallita: ' + (e && e.message) };
      }
      var env;
      try { env = JSON.parse(envJson); }
      catch (e) { return { ok: false, reason: 'corrupt', detail: 'involucro non decodificabile (file corrotto)' }; }
      // Un file opaco è SEMPRE un involucro BaseFlow: se il magic interno è corrotto,
      // isWrapped sarebbe false e unwrapLoadedFile lo tratterebbe come "legacy .json"
      // (accettando l'intestazione come se fosse un flowchart). Qui lo blocchiamo come corrupt.
      if (!isWrapped(env)) return { ok: false, reason: 'corrupt', detail: 'intestazione interna non valida (file corrotto)' };
      return unwrapLoadedFile(env);
    }
    // Non opaco: v1 involucro JSON o legacy .json.
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { return { ok: false, reason: 'parse', detail: (e && e.message) || 'JSON non valido' }; }
    return unwrapLoadedFile(parsed);
  }

  var api = {
    MAGIC: BF_MAGIC, OPAQUE_MAGIC: BF_OPAQUE_MAGIC, VERSION: BF_VERSION,
    MAX_READ_VERSION: BF_MAX_READ_VERSION, ALGO: BF_ALGO, EXT: BF_EXT,
    cyrb53: cyrb53,
    serializeForSave: serializeForSave,
    isWrapped: isWrapped, isOpaque: isOpaque,
    unwrapLoadedFile: unwrapLoadedFile,
    parseLoadedText: parseLoadedText,
    // esposte per i test
    _obfuscate: obfuscate, _b64encode: b64encode, _b64decode: b64decode, _utf8Encode: utf8Encode, _utf8Decode: utf8Decode
  };
  global.BaseFlowFormat = api;
  global.bfSerializeForSave = serializeForSave;
  global.bfUnwrapLoadedFile = unwrapLoadedFile;  // retrocompat: alcuni call-site potrebbero usarla
  global.bfParseLoadedText = parseLoadedText;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

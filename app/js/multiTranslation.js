// Export multi-linguaggio: JavaScript, C, C++, Java.
// Affianca pythonTranslation.js (non lo modifica) riusando la stessa struttura
// (flow.nodes / flow.variables) e lo stesso tokenizer di execute.js (splitStrings)
// per separare stringhe letterali ed espressioni nei nodi 'print'.
//
// LIMITI NOTI (documentati, non "inventati"): copre start/end/assign/input/print/
// if/while/for/do (aggiunti 2026-07-05, piano Do-While/For, Fase 6 del piano cicli).
// Le espressioni di assign/if/while/for/do sono riportate cosi' come scritte
// dall'utente: sintassi valida per JS, ragionevole per Java/C++ nei casi semplici
// (aritmetica, confronti), ma NON garantita per espressioni con concatenazioni di
// stringa complesse in C++ (che richiederebbe un vero parser di tipi). Da segnalare
// all'utente nel popup, non da nascondere.

let multiCodeLines = [];
let multiTabsCount = 0;
const multiIndent = '    ';

function addMultiLine(code) {
  multiCodeLines.push(multiIndent.repeat(multiTabsCount) + code);
}

function toDoubleQuotes(s) {
  return String(s).replace(/'/g, '"');
}

// R13-M: in C il bareword true/false non e' un identificatore valido senza <stdbool.h>
// (mai incluso da questo export, che per le variabili non modella affatto un tipo
// booleano: sempre int/float/char). Prima le condizioni con true/false non arrivavano
// MAI a un If/While/Assign REALMENTE esportato perche' l'esecuzione in-app le
// rifiutava (checkCondition, execute.js); ora che funzionano in-app (R13-M), l'export C
// deve smettere di copiarle VERBATIM (errore di compilazione: "true"/"false" non
// dichiarati). Sostituzione convenzionale C: true -> 1, false -> 0. Token-aware: le
// stringhe quotate restano intatte (mai toccate dentro gli apici). && || e il ternario
// ?: sono gia' sintassi C valida, nessuna conversione necessaria per quelli. Math.* è
// nativo in JS e in Java (java.lang.Math), quindi corretto lì; per C/C++ resta un limite
// noto MINORE (richiederebbe <math.h> + M_PI + nomi bare tipo sqrt() invece di Math.sqrt(),
// con differenze fra compilatori es. M_PI su MSVC) -- lasciato documentato apposta. NB: il
// ternario e Math.* SONO invece pienamente tradotti nell'export PYTHON (pythonTranslation.js,
// transpiler pyExpr, 2026-07-19), dove ?: non esiste come sintassi.
function cBoolLiteralFix(expr) {
  const s = String(expr);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      const quote = ch; let j = i + 1, lit = ch;
      while (j < s.length) {
        lit += s[j];
        if (s[j] === '\\' && j + 1 < s.length) { lit += s[j + 1]; j += 2; continue; }
        if (s[j] === quote) { j++; break; }
        j++;
      }
      out += lit; i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i, id = ''; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) { id += s[j]; j++; }
      out += (id === 'true') ? '1' : (id === 'false') ? '0' : id;
      i = j; continue;
    }
    out += ch; i++;
  }
  return out;
}

// Converte un'espressione (assign/if) per il linguaggio target. In JS le stringhe
// possono restare con apici singoli; Java e C++ richiedono apici doppi. Java/C++/JS
// supportano gia' nativamente && || true false ternario (stessa grammatica di
// safeEval.js) -- nessuna conversione extra serve li'; C e' l'unico caso speciale
// (vedi cBoolLiteralFix sopra).
function convertExprForLang(expr, lang) {
  if (lang === 'javascript') return expr;
  if (lang === 'c') return toDoubleQuotes(cBoolLiteralFix(expr));
  return toDoubleQuotes(expr);
}

// S9 P9.2 (round 15-B, Ismail 2026-07-15): prima il chiamante scriveva questa stringa in
// multiCodeLines[0], azzerando l'INTERO output gia' generato per il resto del flow (vedi
// renderExportPopup in exportUnified.js, check "startsWith('// Error')"). Ora e' solo un
// placeholder per QUESTO nodo (il chiamante usa addMultiLine, non piu' l'assegnazione a
// multiCodeLines[0]): l'export del resto del flow prosegue normalmente.
function errorLineMulti(nodeType, lang) {
  return '// (empty ' + nodeType + ' block, not translated)';
}

// Ricerca locale di una variabile per nome: evita una dipendenza rigida su
// getVariable() di js/execute.js (ordine di caricamento script), pur restando
// compatibile se quella funzione esiste gia' in globale.
function findVariableMulti(name, variables) {
  if (typeof getVariable === 'function') {
    try { const v = getVariable(name, variables); if (v) return v; } catch (e) { /* fallback sotto */ }
  }
  for (let i = 0; i < variables.length; i++) {
    if (variables[i].name === name) return variables[i];
  }
  return null;
}

// Tokenizzazione locale di un'espressione print in letterali-stringa/espressioni:
// riusa splitStrings() di js/execute.js se disponibile, altrimenti un fallback
// minimo (split sul '+' fuori dagli apici) sufficiente per i casi semplici.
function splitStringsMulti(input) {
  if (typeof splitStrings === 'function') {
    try { return splitStrings(input); } catch (e) { /* fallback sotto */ }
  }
  const parts = [];
  let buf = '';
  let inQuote = null;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuote) {
      buf += c;
      if (c === inQuote) { parts.push(buf.trim()); buf = ''; inQuote = null; }
      continue;
    }
    if (c === "'" || c === '"') { inQuote = c; buf += c; continue; }
    if (c === '+') { if (buf.trim()) parts.push(buf.trim()); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function translateVariableMulti(v, lang) {
  const isString = v.type === 'string';
  // Ismail 2026-07-20 (nuovo tipo Boolean): C non ha un tipo booleano utilizzabile senza
  // <stdbool.h> (mai incluso da questo export, stessa scelta gia' fatta per i letterali
  // true/false dentro le espressioni -- vedi cBoolLiteralFix sopra): una variabile Boolean
  // in C diventa quindi un int (0/1), non un "bool" C99. C++ (bool nativo), Java (boolean
  // primitivo) e JavaScript (nessun tipo dichiarato) non hanno bisogno di conversione: il
  // valore JS true/false si stringifica gia' correttamente per tutti e tre.
  const isBool = v.type === 'bool';
  const valueLiteral = isString ? JSON.stringify(String(v.value))
    : (isBool && lang === 'c') ? (v.value ? 1 : 0)
    : v.value;
  // P (round 15, Ismail): una variabile DICHIARATA SENZA valore (flag `uninit`, checkbox
  // "Assign" off) va emessa come SOLA dichiarazione, stile Flowgorithm ("int x;"), non
  // "int x = 0;" -- il "= 0" non ha senso e in C/Java lascia intendere un valore voluto.
  const uninit = !!v.uninit;
  const init = ' = ' + valueLiteral;
  // WP-M2 (Ismail 2026-07-20, tipo Array): dichiarazione array per linguaggio. La sintassi
  // di INDICIZZAZIONE a[i] e' identica in tutti e 5 i linguaggi, quindi le espressioni coi
  // riferimenti a elementi passano invariate; qui serve solo la DICHIARAZIONE. Limite
  // documentato: in C/C++ un array vuoto/uninit viene dimensionato a 100 di default (come le
  // char[100] gia' usate per le stringhe C); in C un array di stringhe e' const char*.
  if (typeof v.type === 'string' && v.type.indexOf('array:') === 0) {
    const et = v.type.slice(6);
    const els = Array.isArray(v.value) ? v.value : [];
    const serEl = function (el, forC) {
      if (typeof el === 'string') return JSON.stringify(String(el));
      if (typeof el === 'boolean') return forC ? (el ? '1' : '0') : (el ? 'true' : 'false');
      return String(el);
    };
    const braceList = function (forC) { return '{' + els.map(function (el) { return serEl(el, forC); }).join(', ') + '}'; };
    // WP-M3 (Ismail 2026-07-20): la DIMENSIONE dichiarata in tabella e' els.length -- gli
    // array uninit si dichiarano con quella dimensione REALE (niente piu' [100] arbitrario);
    // valori uniformi lunghi in JS usano new Array(n).fill(v) invece di un letterale chilometrico.
    const N = els.length;
    const uniform = N > 0 && els.every(function (el) { return el === els[0]; });
    switch (lang) {
      case 'javascript': {
        if (uninit) return 'let ' + v.name + ' = new Array(' + N + ');';
        if (uniform && N > 8) return 'let ' + v.name + ' = new Array(' + N + ').fill(' + serEl(els[0], false) + ');';
        return 'let ' + v.name + ' = [' + els.map(function (el) { return serEl(el, false); }).join(', ') + '];';
      }
      case 'java': {
        const jt = et === 'int' ? 'int' : (et === 'float' ? 'double' : (et === 'bool' ? 'boolean' : 'String'));
        if (uninit || !N) return jt + '[] ' + v.name + ' = new ' + jt + '[' + N + '];';
        return jt + '[] ' + v.name + ' = ' + braceList(false) + ';';
      }
      case 'cpp': {
        const ct = et === 'int' ? 'int' : (et === 'float' ? 'double' : (et === 'bool' ? 'bool' : 'string'));
        if (uninit || !N) return ct + ' ' + v.name + '[' + Math.max(1, N) + '];' + (N ? '' : ' // array di dimensione 0');
        return ct + ' ' + v.name + '[] = ' + braceList(false) + ';';
      }
      case 'c': {
        if (et === 'string') {
          if (uninit || !N) return 'const char *' + v.name + '[' + Math.max(1, N) + '];' + (N ? '' : ' /* array di dimensione 0 */');
          return 'const char *' + v.name + '[] = ' + braceList(true) + ';';
        }
        const ct = et === 'float' ? 'float' : 'int'; // bool -> int (come per gli scalari)
        if (uninit || !N) return ct + ' ' + v.name + '[' + Math.max(1, N) + '];' + (N ? '' : ' /* array di dimensione 0 */');
        return ct + ' ' + v.name + '[] = ' + braceList(true) + ';';
      }
    }
    return '';
  }
  switch (lang) {
    case 'javascript':
      return uninit ? ('let ' + v.name + ';') : ('let ' + v.name + init + ';');
    case 'c': {
      if (v.type === 'string') return uninit ? ('char ' + v.name + '[100];') : ('char ' + v.name + '[100] = ' + valueLiteral + ';');
      const cType = v.type === 'int' ? 'int' : (v.type === 'bool' ? 'int' : 'float');
      return uninit ? (cType + ' ' + v.name + ';') : (cType + ' ' + v.name + init + ';');
    }
    case 'cpp': {
      const cppType = v.type === 'int' ? 'int' : (v.type === 'float' ? 'double' : (v.type === 'bool' ? 'bool' : 'string'));
      return uninit ? (cppType + ' ' + v.name + ';') : (cppType + ' ' + v.name + init + ';');
    }
    case 'java': {
      const javaType = v.type === 'int' ? 'int' : (v.type === 'float' ? 'double' : (v.type === 'bool' ? 'boolean' : 'String'));
      return uninit ? (javaType + ' ' + v.name + ';') : (javaType + ' ' + v.name + init + ';');
    }
  }
  return '';
}

// Traduce un nodo 'print'. Riusa splitStrings() (definita in js/execute.js) per
// separare i letterali stringa dalle espressioni, cosi' come fa l'interprete a runtime.
// A4 (round 11): 3° parametro `newline` (default true, assente = true per retro-compat
// coi flow salvati prima di questa feature) -- vedi execute.js/pythonTranslation.js.
function translatePrintMulti(info, lang, newline) {
  if (newline === undefined) newline = true;
  if (lang === 'javascript') {
    // console.log() non sa stampare senza newline: unico linguaggio qui senza un
    // equivalente diretto di print-senza-a-capo, quindi si passa a process.stdout.write
    // (Node.js) -- l'export e' gia' dichiaratamente best-effort (vedi header modulo).
    return newline ? ('console.log(' + info + ');') : ('process.stdout.write(String(' + info + ')); // Node.js');
  }
  if (lang === 'java') {
    return newline ? ('System.out.println(' + toDoubleQuotes(info) + ');') : ('System.out.print(' + toDoubleQuotes(info) + ');');
  }
  if (lang === 'cpp') {
    let parts;
    parts = splitStringsMulti(info);
    const stream = parts.map(function (p) {
      if (p.startsWith("'") || p.startsWith('"')) {
        return '"' + p.substring(1, p.length - 1) + '"';
      }
      // Ismail 2026-07-20 ("aggiungere i Boolean, occhio a errori"): scoperto un bug REALE
      // e pre-esistente, non specifico al Boolean, VERIFICATO compilando con g++: quando un
      // pezzo senza apici segue un pezzo tra apici scritto con un "+" esplicito
      // ('Nome: ' + nome), splitStringsMulti() lascia quel '+' dentro il pezzo -> qui
      // diventava un "+" UNARIO C++ davanti alla variabile. Per un int/bool e' innocuo (si
      // compila, ma per bool sopprime la formattazione boolalpha appena impostata: stampa
      // "1" invece di "true"); per una std::string e' un ERRORE DI COMPILAZIONE vero e
      // proprio ("no match for operator+", verificato con g++ reale) -- quindi l'esempio
      // guidato del capitolo 1 del manuale ('Nome: ' + nome) non compilava affatto in C++.
      // Il "+" iniziale e' pero' SEMPRE ridondante quando e' numerico: si toglie prima di
      // emettere, stessa identica causa/fix gia' trovata oggi in execute.js/pythonTranslation.js.
      return '(' + p.replace(/^\s*\+\s*/, '') + ')';
    }).join(' << ');
    return 'cout << ' + stream + (newline ? ' << endl;' : ';');
  }
  if (lang === 'c') {
    const parts = splitStringsMulti(info);
    let fmt = '';
    const args = [];
    parts.forEach(function (p) {
      if (p.startsWith("'") || p.startsWith('"')) {
        fmt += p.substring(1, p.length - 1);
      } else {
        // Stesso fix del ramo 'cpp' sopra: un "+" iniziale ridondante rompeva/alterava
        // l'output (qui e' innocuo per int/float/bool essendo tutti numerici in C, ma
        // rimosso per coerenza e perche' il testo dell'argomento passato a printf deve
        // combaciare col NOME della variabile, non con "+ nome").
        const pClean = p.replace(/^\s*\+\s*/, '');
        const varMatch = (flow.variables || []).find(function (v) { return v.name === pClean.trim(); });
        if (varMatch && varMatch.type === 'string') { fmt += '%s'; args.push(pClean); }
        else if (varMatch && varMatch.type === 'float') { fmt += '%f'; args.push(pClean); }
        else { fmt += '%d'; args.push(pClean); }
      }
    });
    return 'printf("' + fmt + (newline ? '\\n' : '') + '"' + (args.length ? ', ' + args.join(', ') : '') + ');';
  }
  return '';
}

function translateInputMulti(variable, lang) {
  if (!variable) { addMultiLine('// input: variabile non trovata'); return; }
  if (lang === 'javascript') {
    switch (variable.type) {
      case 'string': addMultiLine(variable.name + ' = prompt("Insert a string for ' + variable.name + '");'); return;
      case 'int': addMultiLine(variable.name + ' = parseInt(prompt("Insert an integer for ' + variable.name + '"));'); return;
      case 'float': addMultiLine(variable.name + ' = parseFloat(prompt("Insert a float for ' + variable.name + '"));'); return;
      // Ismail 2026-07-20: Boolean -- stesso contratto testuale "true"/"false" usato
      // ovunque nell'app (Input runtime, valori letterali), non "1"/"0".
      case 'bool': addMultiLine(variable.name + ' = (prompt("Insert true/false for ' + variable.name + '") || "").trim().toLowerCase() === "true";'); return;
    }
  }
  if (lang === 'java') {
    switch (variable.type) {
      case 'string':
        addMultiLine('System.out.print("Insert a string for ' + variable.name + ': ");');
        addMultiLine(variable.name + ' = scanner.nextLine();');
        return;
      case 'int':
        addMultiLine('System.out.print("Insert an integer for ' + variable.name + ': ");');
        addMultiLine(variable.name + ' = scanner.nextInt();');
        return;
      case 'float':
        addMultiLine('System.out.print("Insert a float for ' + variable.name + ': ");');
        addMultiLine(variable.name + ' = scanner.nextDouble();');
        return;
      // Scanner.nextBoolean() accetta gia' nativamente "true"/"false" (case-insensitive):
      // stesso contratto testuale dell'app, nessun parsing manuale necessario.
      case 'bool':
        addMultiLine('System.out.print("Insert true/false for ' + variable.name + ': ");');
        addMultiLine(variable.name + ' = scanner.nextBoolean();');
        return;
    }
  }
  if (lang === 'cpp') {
    switch (variable.type) {
      case 'string': addMultiLine('cout << "Insert a string for ' + variable.name + ': "; cin >> ' + variable.name + ';'); return;
      case 'int': addMultiLine('cout << "Insert an integer for ' + variable.name + ': "; cin >> ' + variable.name + ';'); return;
      case 'float': addMultiLine('cout << "Insert a float for ' + variable.name + ': "; cin >> ' + variable.name + ';'); return;
      // std::boolalpha fa leggere a cin il testo letterale "true"/"false" invece delle
      // cifre 1/0 -- stesso contratto testuale dell'app.
      case 'bool': addMultiLine('cout << "Insert true/false for ' + variable.name + ': "; cin >> boolalpha >> ' + variable.name + ';'); return;
    }
  }
  if (lang === 'c') {
    switch (variable.type) {
      case 'string':
        addMultiLine('printf("Insert a string for ' + variable.name + ': ");');
        addMultiLine('scanf("%99s", ' + variable.name + ');'); // array: niente &
        return;
      case 'int':
        addMultiLine('printf("Insert an integer for ' + variable.name + ': ");');
        addMultiLine('scanf("%d", &' + variable.name + ');');
        return;
      case 'float':
        addMultiLine('printf("Insert a float for ' + variable.name + ': ");');
        addMultiLine('scanf("%f", &' + variable.name + ');');
        return;
      // C non ha un tipo booleano (la variabile e' un int, vedi translateVariableMulti):
      // si legge il testo "true"/"false" in un buffer e si confronta con strcmp (per questo
      // l'header C ora include sempre <string.h>, vedi piu' sotto).
      case 'bool':
        addMultiLine('{ char _b[8]; printf("Insert true/false for ' + variable.name + ': "); scanf("%7s", _b); ' + variable.name + ' = (strcmp(_b, "true") == 0) ? 1 : 0; }');
        return;
    }
  }
}

// Nodi gia' emessi come parte di un ramo IF (per indice): evita che il loop
// principale di translateFlowMulti li ritraduca una seconda volta "in linea".
// A differenza di pythonTranslation.js (che riusa un'unica variabile 'index'
// condivisa tra il loop principale e recreateIfBranches per un effetto
// collaterale "furbo" ma fragile), qui usiamo collectBranchNodes() — lo stesso
// helper gia' testato usato dal rendering — cosi' funziona correttamente anche
// con gli IF annidati (limite noto e documentato dell'export Python attuale).
let multiVisited = new Set();

function translateNodeMulti(node, lang, idx) {
  switch (node.type) {
    case 'start':
    case 'end':
      return;
    case 'assign':
      if (node.info === '') { addMultiLine(errorLineMulti(node.type, lang)); return; }
      addMultiLine(convertExprForLang(node.info, lang) + ';');
      return;
    case 'input':
      if (node.info === '') { addMultiLine(errorLineMulti(node.type, lang)); return; }
      translateInputMulti(findVariableMulti(node.info, flow.variables), lang);
      return;
    case 'print':
      if (node.info === '') { addMultiLine(errorLineMulti(node.type, lang)); return; }
      addMultiLine(translatePrintMulti(node.info, lang, node.newline !== false));
      return;
    case 'forward':
    case 'turn':
    case 'home':
    case 'pen':
    case 'gclear':
      addMultiLine('// ' + ((typeof turtleCommentText === 'function') ? turtleCommentText(node.type, node.info) : 'Turtle'));
      return;
    case 'if':
      if (node.info === '') { addMultiLine(errorLineMulti(node.type, lang)); return; }
      addMultiLine('');
      addMultiLine('if (' + convertExprForLang(node.info, lang) + ') {');
      multiTabsCount++;
      recreateIfBranchesMulti(idx, lang);
      return;
    case 'while':
      if (node.info === '') { addMultiLine(errorLineMulti(node.type, lang)); return; }
      addMultiLine('');
      addMultiLine('while (' + convertExprForLang(node.info, lang) + ') {');
      multiTabsCount++;
      recreateWhileBodyMulti(idx, lang);
      return;
    case 'for':
      // FIX B1 (review Fable, 2026-07-05, piano Do-While/For): a differenza di Python
      // (che non ha un for C-style e richiede la riscrittura a while, vedi
      // pythonTranslation.js), JS/C/C++/Java hanno tutti la stessa sintassi
      // "for (init; cond; incr) { ... }" dell'editor -- traduzione DIRETTA, nessuna
      // riscrittura necessaria (l'incremento resta nell'intestazione del for, non nel corpo).
      if (node.info === '') { addMultiLine(errorLineMulti(node.type, lang)); return; }
      var forPartsMulti = node.info.split(';');
      if (forPartsMulti.length !== 3) {
        multiCodeLines[0] = '// Error: node for has invalid syntax (expected init;condition;increment). Please edit its informations to translate the chart.';
        return;
      }
      addMultiLine('');
      addMultiLine(
        'for (' +
        convertExprForLang(forPartsMulti[0].trim(), lang) + '; ' +
        convertExprForLang(forPartsMulti[1].trim(), lang) + '; ' +
        convertExprForLang(forPartsMulti[2].trim(), lang) +
        ') {'
      );
      multiTabsCount++;
      recreateForBodyMulti(idx, lang);
      return;
    case 'do':
      // FIX B2 (review Fable, 2026-07-05, piano Do-While/For): JS/C/C++/Java hanno
      // tutti un do-while nativo -- traduzione DIRETTA "do { ... } while (cond);",
      // stessa semantica del fix executor (corpo eseguito almeno una volta).
      if (node.info === '') { addMultiLine(errorLineMulti(node.type, lang)); return; }
      addMultiLine('');
      addMultiLine('do {');
      multiTabsCount++;
      recreateDoWhileBodyMulti(idx, lang);
      return;
    default:
      addMultiLine('// TODO: nodo "' + node.type + '" non supportato in questo export (solo assign/input/print/if)');
      return;
  }
}

// Traduce il CORPO di un ciclo While per i linguaggi multi (JS/C/C++/Java). Usa
// collectLoopBody() (stesso helper di layout/rendering/pythonTranslation) per
// l'ordine reale di esecuzione del corpo, e multiVisited (come recreateIfBranchesMulti)
// per evitare che il ciclo esterno di translateFlowMulti ritraduca i nodi del corpo.
function recreateWhileBodyMulti(loopIdx, lang) {
  const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
  body.bodyList.forEach(function (idx) {
    multiVisited.add(idx);
    translateNodeMulti(flow.nodes[idx], lang, idx);
  });
  multiTabsCount--;
  addMultiLine('}');
}

// Traduce il CORPO di un ciclo For (analoga a recreateWhileBodyMulti): l'incremento
// e' gia' nell'intestazione del for emessa da translateNodeMulti, qui si traduce
// solo il contenuto del corpo.
function recreateForBodyMulti(loopIdx, lang) {
  const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
  body.bodyList.forEach(function (idx) {
    multiVisited.add(idx);
    translateNodeMulti(flow.nodes[idx], lang, idx);
  });
  multiTabsCount--;
  addMultiLine('}');
}

// Traduce il CORPO di un ciclo Do-While: chiude con "} while (cond);" invece del
// semplice "}" di un while normale.
function recreateDoWhileBodyMulti(loopIdx, lang) {
  const doNode = flow.nodes[loopIdx];
  const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
  body.bodyList.forEach(function (idx) {
    multiVisited.add(idx);
    translateNodeMulti(flow.nodes[idx], lang, idx);
  });
  multiTabsCount--;
  addMultiLine('} while (' + convertExprForLang(doNode.info, lang) + ');');
}

function recreateIfBranchesMulti(ifIdx, lang) {
  const sub = collectBranchNodes(ifIdx);
  sub.trueList.forEach(function (idx) {
    multiVisited.add(idx);
    translateNodeMulti(flow.nodes[idx], lang, idx);
  });
  multiTabsCount--;
  // FIX #14 (Ismail 2026-07-08): emetti "else" SOLO se il ramo falso ha contenuto,
  // altrimenti si generava un blocco "else { }" vuoto e inutile.
  if (sub.falseList.length > 0) {
    addMultiLine('} else {');
    multiTabsCount++;
    sub.falseList.forEach(function (idx) {
      multiVisited.add(idx);
      translateNodeMulti(flow.nodes[idx], lang, idx);
    });
    multiTabsCount--;
    addMultiLine('}');
  } else {
    addMultiLine('}'); // chiudi l'if senza ramo else
  }
}

function translateFlowMulti(lang) {
  multiCodeLines = [];
  multiTabsCount = 0;
  multiVisited = new Set();

  if (lang === 'c') {
    multiCodeLines.push('#include <stdio.h>');
    // Ismail 2026-07-20: sempre incluso (costo zero se non usato) per strcmp() nell'Input
    // di una variabile Boolean (C non ha un tipo bool nativo, vedi translateInputMulti).
    multiCodeLines.push('#include <string.h>');
    multiCodeLines.push('');
    multiCodeLines.push('int main() {');
    multiTabsCount = 1;
  } else if (lang === 'cpp') {
    multiCodeLines.push('#include <iostream>');
    multiCodeLines.push('#include <string>');
    multiCodeLines.push('using namespace std;');
    multiCodeLines.push('');
    multiCodeLines.push('int main() {');
    multiTabsCount = 1;
    // Ismail 2026-07-20: boolalpha applicato UNA volta a inizio main -- resta attivo per
    // tutta la durata del programma su cin/cout, cosi' un bool si legge/stampa come testo
    // "true"/"false" (contratto usato ovunque nell'app) invece delle cifre 1/0 di default.
    // Costo zero se il flow non ha variabili Boolean.
    addMultiLine('cout << boolalpha;');
  } else if (lang === 'java') {
    multiCodeLines.push('import java.util.Scanner;');
    multiCodeLines.push('');
    multiCodeLines.push('public class FlowProgram {');
    multiCodeLines.push(multiIndent + 'public static void main(String[] args) {');
    multiTabsCount = 2;
    multiCodeLines.push(multiIndent.repeat(2) + 'Scanner scanner = new Scanner(System.in);');
  }

  for (let i = 0; i < flow.variables.length; i++) {
    addMultiLine(translateVariableMulti(flow.variables[i], lang));
  }
  addMultiLine('');
  for (let i = 0; i < flow.nodes.length; i++) {
    if (multiVisited.has(i)) continue;
    translateNodeMulti(flow.nodes[i], lang, i);
  }

  if (lang === 'c' || lang === 'cpp') {
    multiTabsCount = 1;
    addMultiLine('return 0;');
    multiCodeLines.push('}');
  } else if (lang === 'java') {
    multiTabsCount = 1;
    addMultiLine('}'); // chiude main
    multiCodeLines.push('}'); // chiude la classe
  }
}

// Metadati per estensione/etichetta di ciascun linguaggio "multi" (usati dal
// modulo unificato js/exportUnified.js, che pilota un unico popup di export
// per tutti i formati: Python, JS, C, C++, Java, PNG, JPG, PDF).
const MULTI_LANG_META = {
  javascript: { ext: 'js', label: 'JavaScript' },
  c: { ext: 'c', label: 'C' },
  cpp: { ext: 'cpp', label: 'C++' },
  java: { ext: 'java', label: 'Java' }
};

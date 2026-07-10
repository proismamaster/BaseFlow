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

// Converte un'espressione (assign/if) per il linguaggio target. In JS le stringhe
// possono restare con apici singoli; Java e C++ richiedono apici doppi.
function convertExprForLang(expr, lang) {
  if (lang === 'javascript') return expr;
  return toDoubleQuotes(expr);
}

function errorLineMulti(nodeType, lang) {
  return '// Error: node ' + nodeType + ' is empty. Please edit its informations to translate the chart.';
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
  const valueLiteral = isString ? JSON.stringify(String(v.value)) : v.value;
  switch (lang) {
    case 'javascript':
      return 'let ' + v.name + ' = ' + valueLiteral + ';';
    case 'c': {
      if (v.type === 'string') return 'char ' + v.name + '[100] = ' + valueLiteral + ';';
      const cType = v.type === 'int' ? 'int' : 'float';
      return cType + ' ' + v.name + ' = ' + valueLiteral + ';';
    }
    case 'cpp': {
      const cppType = v.type === 'int' ? 'int' : (v.type === 'float' ? 'double' : 'string');
      return cppType + ' ' + v.name + ' = ' + valueLiteral + ';';
    }
    case 'java': {
      const javaType = v.type === 'int' ? 'int' : (v.type === 'float' ? 'double' : 'String');
      return javaType + ' ' + v.name + ' = ' + valueLiteral + ';';
    }
  }
  return '';
}

// Traduce un nodo 'print'. Riusa splitStrings() (definita in js/execute.js) per
// separare i letterali stringa dalle espressioni, cosi' come fa l'interprete a runtime.
function translatePrintMulti(info, lang) {
  if (lang === 'javascript') {
    return 'console.log(' + info + ');';
  }
  if (lang === 'java') {
    return 'System.out.println(' + toDoubleQuotes(info) + ');';
  }
  if (lang === 'cpp') {
    let parts;
    parts = splitStringsMulti(info);
    const stream = parts.map(function (p) {
      if (p.startsWith("'") || p.startsWith('"')) {
        return '"' + p.substring(1, p.length - 1) + '"';
      }
      return '(' + p + ')';
    }).join(' << ');
    return 'cout << ' + stream + ' << endl;';
  }
  if (lang === 'c') {
    const parts = splitStringsMulti(info);
    let fmt = '';
    const args = [];
    parts.forEach(function (p) {
      if (p.startsWith("'") || p.startsWith('"')) {
        fmt += p.substring(1, p.length - 1);
      } else {
        const varMatch = (flow.variables || []).find(function (v) { return v.name === p.trim(); });
        if (varMatch && varMatch.type === 'string') { fmt += '%s'; args.push(p); }
        else if (varMatch && varMatch.type === 'float') { fmt += '%f'; args.push(p); }
        else { fmt += '%d'; args.push(p); }
      }
    });
    return 'printf("' + fmt + '\\n"' + (args.length ? ', ' + args.join(', ') : '') + ');';
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
    }
  }
  if (lang === 'cpp') {
    switch (variable.type) {
      case 'string': addMultiLine('cout << "Insert a string for ' + variable.name + ': "; cin >> ' + variable.name + ';'); return;
      case 'int': addMultiLine('cout << "Insert an integer for ' + variable.name + ': "; cin >> ' + variable.name + ';'); return;
      case 'float': addMultiLine('cout << "Insert a float for ' + variable.name + ': "; cin >> ' + variable.name + ';'); return;
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
      if (node.info === '') { multiCodeLines[0] = errorLineMulti(node.type, lang); return; }
      addMultiLine(convertExprForLang(node.info, lang) + ';');
      return;
    case 'input':
      if (node.info === '') { multiCodeLines[0] = errorLineMulti(node.type, lang); return; }
      translateInputMulti(findVariableMulti(node.info, flow.variables), lang);
      return;
    case 'print':
      if (node.info === '') { multiCodeLines[0] = errorLineMulti(node.type, lang); return; }
      addMultiLine(translatePrintMulti(node.info, lang));
      return;
    case 'forward':
    case 'turn':
    case 'home':
    case 'pen':
    case 'gclear':
      addMultiLine('// ' + ((typeof turtleCommentText === 'function') ? turtleCommentText(node.type, node.info) : 'Turtle'));
      return;
    case 'if':
      if (node.info === '') { multiCodeLines[0] = errorLineMulti(node.type, lang); return; }
      addMultiLine('');
      addMultiLine('if (' + convertExprForLang(node.info, lang) + ') {');
      multiTabsCount++;
      recreateIfBranchesMulti(idx, lang);
      return;
    case 'while':
      if (node.info === '') { multiCodeLines[0] = errorLineMulti(node.type, lang); return; }
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
      if (node.info === '') { multiCodeLines[0] = errorLineMulti(node.type, lang); return; }
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
      if (node.info === '') { multiCodeLines[0] = errorLineMulti(node.type, lang); return; }
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

#!/usr/bin/env node
// tools/repro-py-export-expr.js — harness PERMANENTE del transpiler espressione->Python
// (2026-07-19): verifica la riscrittura di ternario ?:, Math.*, && || !, true/false/null.
// Estrae pyExpr/pyStmt da js/pythonTranslation.js e li esegue in un vm isolato.
// Uso: node tools/repro-py-export-expr.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../app/js/pythonTranslation.js', 'utf8');
// Isola solo le funzioni del transpiler (dal marker fino a pyCond) — evita di caricare
// tutto il file (che referenzia flow/getVariable ecc. non definiti qui).
const start = src.indexOf('let _pyNeedMath');
const end = src.indexOf('// Nota: le funzioni UI');
const chunk = 'function pyCondSyntax(e){return String(e);}\n' + src.slice(start, end);
const ctx = { console, Math, String };
vm.createContext(ctx);
vm.runInContext(chunk, ctx);
const pyExpr = ctx.pyExpr, pyStmt = ctx.pyStmt;
// _pyNeedMath/_pyNeedRandom sono `let` di modulo: nel vm NON diventano proprietà del context,
// si leggono/azzerano valutandoli nello stesso contesto lessicale.
const needMath = () => vm.runInContext('_pyNeedMath', ctx);
const needRandom = () => vm.runInContext('_pyNeedRandom', ctx);

let pass = 0, fail = 0; const fails = [];
function eq(name, got, want) {
  if (got === want) { pass++; console.log('  OK   ' + name); }
  else { fail++; fails.push(name + ' -> got [' + got + '] want [' + want + ']'); console.log('  FAIL ' + name + ' got=[' + got + '] want=[' + want + ']'); }
}

// Ternario
eq('ternario semplice', pyExpr('a ? b : c'), '(b if a else c)');
eq('ternario annidato', pyExpr('a ? b : c ? d : e'), '(b if a else (d if c else e))');
eq('ternario in assign', pyStmt('x = a > 0 ? a : -a'), 'x = (a if a > 0 else -a)');
// Logici / booleani
eq('and/or/not', pyExpr('x && y || !z'), '((x and y) or (not z))');
eq('true/false/null', pyExpr('a ? true : null'), '(True if a else None)');
// Math costanti e funzioni
const r1 = pyExpr('Math.PI * r'); eq('Math.PI', r1, 'math.pi * r'); eq('Math.PI -> import math', needMath(), true);
eq('Math.sqrt', pyExpr('Math.sqrt(x)'), 'math.sqrt(x)');
eq('Math.abs builtin', pyExpr('Math.abs(x)'), 'abs(x)');
eq('Math.max builtin', pyExpr('Math.max(a, b)'), 'max(a, b)');
eq('Math.pow builtin', pyExpr('Math.pow(a, b)'), 'pow(a, b)');
eq('Math.sign inline', pyExpr('Math.sign(x)'), '((x > 0) - (x < 0))');
eq('Math.cbrt inline', pyExpr('Math.cbrt(x)'), '((x) ** (1 / 3))');
vm.runInContext('_pyNeedRandom = false', ctx); eq('Math.random', pyExpr('Math.random()'), 'random.random()'); eq('random -> import random', needRandom(), true);
// Confronti e aritmetica invariati (con normalizzazione spazi)
eq('confronto', pyExpr('x >= 3'), 'x >= 3');
eq('=== -> ==', pyExpr('x === 5'), 'x == 5');
// Fallback: espressione non parsabile -> pyStmt ricade su pyCondSyntax (qui identità)
eq('fallback non parsabile', pyStmt('x = 2 +'), 'x = 2 +');
// Stringhe intatte
eq('stringa concat', pyExpr('"ciao " + nome'), '"ciao " + nome');

// Bonus: se python3 è disponibile, verifica che gli output siano Python VALIDO (compile()).
try {
  const cp = require('child_process');
  const samples = [
    pyExpr('a > 0 ? Math.sqrt(a) : Math.abs(a)'),
    pyExpr('x && y || !z'),
    pyExpr('Math.PI * Math.pow(r, 2)'),
    pyExpr('Math.max(a, b) + Math.sign(c)')
  ];
  const py = 'import math, random\n' + samples.map((s, i) => '_r' + i + ' = lambda a=1,b=1,c=1,r=1,x=1,y=1,z=1: (' + s + ')').join('\n');
  const res = cp.spawnSync('python3', ['-c', 'import sys;compile(sys.argv[1], "<gen>", "exec")', py], { encoding: 'utf8' });
  if (res.status === 0) { pass++; console.log('  OK   output compilabile da python3'); }
  else if (res.error && res.error.code === 'ENOENT') { console.log('  (python3 assente: salto la verifica compile)'); }
  else { fail++; fails.push('python3 compile fallita: ' + (res.stderr || '').trim()); console.log('  FAIL python3 compile: ' + (res.stderr || '').trim()); }
} catch (e) { console.log('  (verifica python3 saltata: ' + e.message + ')'); }

console.log('\n=== TOTALE: ' + pass + '/' + (pass + fail) + ' PASS ===');
if (fail) { console.error('FALLITI:'); fails.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('=== repro-py-export-expr: OK ===');

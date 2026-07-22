/*
 * WP-M7 (Ismail 2026-07-21): la compilazione delle espressioni in closure deve dare risultati
 * IDENTICI all'interprete precedente, e la cache di compilazione deve scattare (stessa
 * espressione -> stessa closure). Verifica semantica + presenza della cache.
 * Uso: node tools/repro-compile-2026-07-21.js
 */
'use strict';
const { sandbox, load } = require('./repro-harness-2026-07-21.js');
sandbox.i18nText = () => null; load('js/execute.js');
const S = sandbox;
let ok = 0, ko = 0;
const c = (d, g, w) => { const good = JSON.stringify(g) === JSON.stringify(w); good ? ok++ : ko++;
  console.log((good ? '  ok  ' : '  FAIL') + ' ' + d.padEnd(48) + ' -> ' + JSON.stringify(g) + (good ? '' : '   atteso ' + JSON.stringify(w))); };
const sc = vars => S._bfScopeAll(vars);

// semantica: aritmetica, stringhe, bool, array, funzioni
c('aritmetica', S.safeEvaluate('2+3*4', sc([])), 14);
c('div0', (() => { try { S.safeEvaluate('1/0', sc([])); return 'no'; } catch (e) { return e.message; } })(), '__DIV0__');
c('scalare da env', S.safeEvaluate('x*2', sc([{ name: 'x', value: 7 }])), 14);
c('stringa: "a" non e la variabile a', S.safeEvaluate('"a"+1', sc([{ name: 'a', value: 5 }])), 'b');
c('confronto stringa', S.safeEvaluate('s=="hi"', sc([{ name: 's', value: 'hi' }])), true);
c('array per riferimento', S.safeEvaluate('a[i]+1', sc([{ name: 'a', value: [10, 20] }, { name: 'i', value: 1 }])), 21);
c('length', S.safeEvaluate('a.length', sc([{ name: 'a', value: [1, 2, 3] }])), 3);
c('Asc/Chr', S.safeEvaluate('Chr(Asc("a")+2)', sc([])), 'c');
c('ternario', S.safeEvaluate('x>0 ? "pos" : "neg"', sc([{ name: 'x', value: -1 }])), 'neg');
c('toFixed/end/CURRENT_TS', typeof S.safeEvaluate('toFixed(end([1,2,3]),1)', sc([])), 'string');

// condizioni: risultato + errori
c('checkCondition vera', S.checkCondition('i < 10', [{ name: 'i', value: 3 }]), true);
c('checkCondition su cella', S.checkCondition('a[0] > 5', [{ name: 'a', type: 'array:int', value: [9] }]), true);
S.throwError = m => { S.thrown = m; }; S.errMsg = (k) => k;
S.thrown = null; S.checkCondition('zz > 0', [{ name: 'i', value: 1 }]);
c('condizione: variabile non dichiarata', S.thrown, 'err_not_declared');
S.thrown = null; S.checkCondition('a[9] > 0', [{ name: 'a', type: 'array:int', value: [1, 2, 3] }]);
c('condizione: indice fuori range tradotto', S.thrown, 'err_index_range');

// la CACHE scatta: stessa espressione, stessa closure identica
c('cache: stessa espressione -> stessa closure', S.safeCompile('total+i*j') === S.safeCompile('total+i*j'), true);
c('cache: laxIndex separa le chiavi', S.safeCompile('a[i]', { laxIndex: true }) !== S.safeCompile('a[i]'), true);

// prestazioni: 1M valutazioni sotto una soglia larga (segnala una regressione grave, non micro)
const vars = [{ name: 'total', value: 0 }, { name: 'i', value: 0 }, { name: 'j', value: 0 }];
let total = 0; const t0 = Date.now();
for (let i = 1; i <= 1000; i++) for (let j = 1; j <= 1000; j++) { vars[0].value = total; vars[1].value = i; vars[2].value = j; total = S.safeEvaluate('total + i*j', sc(vars)); }
const ms = Date.now() - t0;
c('1M valutazioni sotto 1500ms (era ~3090)', ms < 1500, true);
console.log('        (Test 3 misurato: ' + ms + 'ms)');

console.log('\n' + ok + ' ok, ' + ko + ' falliti');
process.exit(ko ? 1 : 0);

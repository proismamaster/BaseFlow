/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {sandbox,load}=require('./repro-harness-2026-07-21.js');
sandbox.i18nText=()=>null; load('js/execute.js');
const S=sandbox._bfSubstituteVars;
// WP-M5k: gli array viaggiano nell'AMBIENTE, non piu' incollati nel testo
const SC=()=>sandbox._bfEvalScope(vars);
const EV=(e)=>sandbox.safeEvaluate(e, SC());
const vars=[{name:'a',type:'array:string',value:['x','y','z']},{name:'i',type:'int',value:1},{name:'nome',type:'string',value:'Ada'}];
let ok=0,ko=0;
function c(d,g,w){const good=String(g)===String(w);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(40),'->',g,good?'':(' atteso '+w));}
c('"a"+1 non tocca la stringa', S("'a'+1",vars), "'a'+1");
c('valutata da',                EV(S("'a'+1",vars)), 'b');
c('array NON serializzato nel testo', S('a[i]',vars), 'a[i]'.replace('i','1'));
c('valutata da',                EV(S('a[i]',vars)), 'y');
c('nome dentro stringa intatto',S("'nome'",vars), "'nome'");
c('nome fuori sostituito',      S('nome',vars), "'Ada'");
c('Math non toccato',           S('Math.floor(i)',vars), 'Math.floor(1)');
c('Asc/Chr passano',            S('Chr(Asc("a")+i)',vars), 'Chr(Asc("a")+1)');
c('valutata da',                EV(S('Chr(Asc("a")+i)',vars)), 'b');
c('sconosciuta invariata',      S('zz+1',vars), 'zz+1');
// il caso dello screenshot, per intero
c('screenshot: a[i] = "a"+1',   EV(S('"a"+1',vars)), 'b');
console.log('\n'+ok+' ok, '+ko+' falliti');
process.exit(ko?1:0);

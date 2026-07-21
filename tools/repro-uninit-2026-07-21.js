/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {sandbox,load}=require('./repro-harness-2026-07-21.js');
sandbox.i18nText=()=>null; load('js/execute.js');
const U=sandbox._bfUninitUsedIn, I=sandbox._bfIdentifiersIn;
const V=[{name:'a',type:'array:string',value:new Array(3).fill(''),uninit:true},
         {name:'i',type:'int',value:0},
         {name:'x',type:'int',value:0,uninit:true}];
let ok=0,ko=0;
function c(d,g,w){const good=JSON.stringify(g)===JSON.stringify(w);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(46),'->',JSON.stringify(g),good?'':(' atteso '+JSON.stringify(w)));}
c("identificatori di \"'a'+1\"",      I("'a'+1"), []);
c("identificatori di 'a[i]'",         I('a[i]'), ['a','i']);
c('identificatori di Math.floor(i)',  I('Math.floor(i)'), ['Math','i']);
c("caso screenshot: 'a'+1 -> nessun uninit", U("'a'+1", V), null);
c('lettura vera di a -> uninit',      U('a[i]', V), 'a');
c('uninit dentro stringa ignorata',   U('"x vale"', V), null);
c('uninit fuori rilevata',            U('x+1', V), 'x');
c('stringa con apostrofo escapato',   U("'l\\'auto'", V), null);
console.log('\n'+ok+' ok, '+ko+' falliti');
process.exit(ko?1:0);

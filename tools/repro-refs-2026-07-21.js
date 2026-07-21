/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {sandbox,load}=require('./repro-harness-2026-07-21.js');
sandbox.i18nText=()=>null;
load('js/execute.js');
const R=sandbox._bfResolveVarRefs, D=sandbox._bfDeclDisplay;
let ok=0,ko=0;
function c(d,g,w){const good=JSON.stringify(g)===JSON.stringify(w);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(44),'->',JSON.stringify(g),good?'':(' atteso '+JSON.stringify(w)));}

// riferimento IN AVANTI: a cita b, ma b e' dichiarata dopo
let v=[{name:'a',type:'int',value:0,ref:'b'},{name:'b',type:'int',value:7}];
R(v); c('riferimento in avanti (a=b, b dopo)', v[0].value, 7);

// catena scritta al contrario
v=[{name:'a',type:'int',value:0,ref:'b'},{name:'b',type:'int',value:0,ref:'c'},{name:'c',type:'int',value:5}];
R(v); c('catena a->b->c', [v[0].value,v[1].value], [5,5]);

// ciclo: non deve bloccarsi
v=[{name:'a',type:'int',value:0,ref:'b'},{name:'b',type:'int',value:0,ref:'a'}];
R(v); c('ciclo a<->b: uninit, niente loop', [v[0].uninit,v[1].uninit], [true,true]);

// variabile citata inesistente
v=[{name:'a',type:'int',value:0,ref:'zz'}];
R(v); c('riferimento a variabile inesistente', v[0].uninit, true);

// riferimento a una uninit
v=[{name:'a',type:'int',value:0,ref:'b'},{name:'b',type:'int',value:0,uninit:true}];
R(v); c('riferimento a variabile non inizializzata', v[0].uninit, true);

// array copiato per VALORE, non condiviso
v=[{name:'a',type:'array:int',value:[],ref:'b'},{name:'b',type:'array:int',value:[1,2]}];
R(v); v[0].value.push(9);
c('array copiato, non condiviso', v[1].value, [1,2]);

// visualizzazione della dichiarazione
c('stringa mostrata con virgolette', D({type:'string',value:'ciao'}), '"ciao"');
c('stringa con virgoletta interna',  D({type:'string',value:'a"b'}), '"a\\"b"');
c('riferimento mostrato com\'e\'',   D({type:'int',ref:'b',src:'b'}), 'b');
c('intero invariato',                D({type:'int',value:5}), 5);

// parser dei letterali
const P=sandbox._bfParseStringLiteral||null;
console.log('\n'+ok+' ok, '+ko+' falliti');
process.exit(ko?1:0);

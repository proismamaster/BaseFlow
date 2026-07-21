/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {sandbox,load}=require('./repro-harness-2026-07-21.js');
sandbox.errMsg=(k,p)=>k+' '+JSON.stringify(p||{});
sandbox.i18nText=()=>null;
sandbox.throwError=m=>{ sandbox.thrown=m; };
load('js/execute.js');
// execute.js ridefinisce throwError/errMsg: si ri-stubbano DOPO il caricamento
sandbox.throwError=m=>{ sandbox.thrown=m; };
sandbox.errMsg=(k,p)=>k+' '+JSON.stringify(p||{});
const V=[
  {name:'a', type:'array:int', value:[1,2,3]},
  {name:'i', type:'int', value:5},
  {name:'vuoto', type:'array:int', value:[]},
  {name:'nonInit', type:'array:int', value:[0,0,0], uninit:true},
  {name:'s', type:'int', value:7}
];
const cases=[
  'a[0] > 0',        // ok
  'a[i] > 0',        // fuori range (i=5, len 3)
  'a[-1] > 0',       // indice negativo
  'vuoto[0] > 0',    // array vuoto
  's[0] > 0',        // non e' un array
  'nonInit[0] > 0'   // array dichiarato senza valore
];
for (const c of cases) {
  sandbox.thrown=null;
  let r;
  try { r = sandbox.checkCondition(c, V); } catch(e){ r='EXCEPTION '+e.message; }
  console.log(String(c).padEnd(16), '->', sandbox.thrown ? 'ERRORE: '+sandbox.thrown : 'risultato '+JSON.stringify(r));
}

/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
// Harness: carica safeEval.js + le funzioni pure di execute.js in una sandbox e
// verifica il comportamento degli ARRAY nei casi limite.
const fs=require('fs'), vm=require('vm'), path=require('path');
const APP=path.join(__dirname,'..','app');
const sandbox={ console, Math, Number, String, Array, Object, JSON, RegExp, isNaN, parseInt, parseFloat };
sandbox.window=sandbox; sandbox.globalThis=sandbox;
sandbox.document={ getElementById:()=>null, querySelectorAll:()=>[], querySelector:()=>null,
  createElement:()=>({style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(){},setAttribute(){},addEventListener(){}}),
  addEventListener(){}, documentElement:{dir:'ltr'} };
sandbox.addEventListener=()=>{}; sandbox.requestAnimationFrame=fn=>fn();
sandbox.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
sandbox.setTimeout=setTimeout; sandbox.clearTimeout=clearTimeout;
vm.createContext(sandbox);
function load(f){ vm.runInContext(fs.readFileSync(path.join(APP,f),'utf8'), sandbox, {filename:f}); }
load('js/core/safeEval.js');
module.exports={sandbox,load,vm};

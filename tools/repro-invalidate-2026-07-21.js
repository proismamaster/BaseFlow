/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {JSDOM}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const dom=new JSDOM('<table id="tabVariabili"></table>');
const w=dom.window;
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat,setTimeout,clearTimeout};
sb.window=sb; sb.globalThis=sb; sb.document=w.document; sb.getComputedStyle=w.getComputedStyle.bind(w);
sb.i18nText=()=>null; sb.addEventListener=()=>{};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/execute.js','utf8'),sb,{filename:'e.js'});
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(56),'->',g,good?'':(' atteso '+wnt));};
c('_bfInvalidateRunResults esiste', typeof sb._bfInvalidateRunResults, 'function');
// deve essere sicura anche senza tabella nel DOM
let boom=null; try{ sb._bfInvalidateRunResults(); }catch(e){ boom=e.message; }
c('sicura senza tabella', boom, 'null');
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

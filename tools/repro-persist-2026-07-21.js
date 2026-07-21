/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {JSDOM}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const dom=new JSDOM('<table id="tabVariabili"><tr><th>N</th><th>T</th><th>V</th></tr><tr><td></td><td></td><td><div class="value-cell"><input class="value-input"></div></td></tr></table>');
const w=dom.window;
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat,setTimeout,clearTimeout};
sb.window=sb; sb.globalThis=sb; sb.document=w.document; sb.getComputedStyle=w.getComputedStyle.bind(w);
sb.i18nText=()=>null; sb.addEventListener=()=>{};
sb.tabVariabili=w.document.getElementById('tabVariabili');
vm.createContext(sb);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/core/variables.js','utf8'),sb,{filename:'v.js'});
const tr=sb.tabVariabili.rows[1];
sb._bfSyncArrayValueControl({value:'array', closest:()=>tr});
const btn=tr.cells[2].querySelector('.array-expand');
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(52),'->',g,good?'':(' atteso '+wnt));};

// pannello parte CHIUSO
sb._bfRenderArrayCells(tr,['','',''],false,true);
let g=tr.cells[2].querySelector('.array-cells');
c('parte chiuso', g.hidden, true);

// durante l'esecuzione (live) si apre DA SOLO
sb._bfRenderArrayCells(tr,['a','b','c'],true,false);
g=tr.cells[2].querySelector('.array-cells');
c('si apre da solo al cambio in esecuzione', g.hidden, false);
c('caret aggiornato', btn.querySelector('.ae-caret').textContent, '▴');
c('celle disegnate', g.children.length, 3);

// l'utente lo chiude a mano
btn.dispatchEvent(new w.Event('click'));
c('chiuso a mano', g.hidden, true);
c('flag utente registrato', g._bfUserClosed, true);
sb._bfRenderArrayCells(tr,['x','y','z'],true,false);
c('NON si riapre dopo chiusura manuale', g.hidden, true);

// nuova esecuzione -> il flag si azzera
sb.document.querySelectorAll('#tabVariabili .array-cells').forEach(x=>{x._bfUserClosed=false;});
sb._bfRenderArrayCells(tr,['q','w','e'],true,false);
c('nuova run: torna ad aprirsi', g.hidden, false);
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

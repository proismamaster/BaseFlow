/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
// WP-M5w: a fine esecuzione i pannelli devono mostrare i valori FINALI, non l'ultimo
// stato intermedio disegnato prima della coalescenza per frame.
const {JSDOM}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const w=new JSDOM('<table id="tabVariabili"><tr><th>N</th><th>T</th><th>V</th></tr><tr><td></td><td></td><td><div class="value-cell"><input class="value-input"></div></td></tr></table>').window;
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat,setTimeout,clearTimeout};
sb.window=sb; sb.globalThis=sb; sb.document=w.document; sb.getComputedStyle=w.getComputedStyle.bind(w);
sb.i18nText=()=>null; sb.addEventListener=()=>{};
// rAF che NON scatta mai da solo: simula la run sincrona che non lascia respirare il browser
sb.requestAnimationFrame=fn=>999; sb.cancelAnimationFrame=()=>{};
sb.tabVariabili=w.document.getElementById('tabVariabili');
vm.createContext(sb);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/core/variables.js','utf8'),sb,{filename:'v.js'});
const tr=sb.tabVariabili.rows[1];
sb._bfSyncArrayValueControl({value:'array', closest:()=>tr});
const btn=tr.cells[2].querySelector('.array-expand');
const vals=['a','b','c'];
sb._bfRenderArrayCells(tr,vals,false,false);
btn.dispatchEvent(new w.Event('click'));
const g=tr.cells[2].querySelector('.array-cells');
let ok=0,ko=0;
const c=(d,gg,wnt)=>{const good=String(gg)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(52),'->',gg,good?'':(' atteso '+wnt));};
c('stato iniziale', g.children[0].textContent, '0a');
// aggiornamenti "in esecuzione": la ripittura resta in sospeso (rAF che non scatta)
sb._bfRenderArrayCells(tr,['X','b','c'],true,false);
sb._bfRenderArrayCells(tr,['Z','b','c'],true,false);
c('durante la run: pannello ancora indietro', g.children[0].textContent, '0a');
// fine run: il flush finale deve portare il valore DEFINITIVO
sb._bfFlushArrayCellsNow();
c('dopo il flush finale: valore definitivo', g.children[0].textContent, '0Z');
c('nessuna ripittura residua in coda', g._bfNext, 'null');
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

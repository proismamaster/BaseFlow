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
sb.HTMLElement=w.HTMLElement; sb.addEventListener=()=>{}; sb.i18nText=()=>null;
sb.tabVariabili=w.document.getElementById('tabVariabili');
vm.createContext(sb);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/core/variables.js','utf8'),sb,{filename:'variables.js'});
const tr=sb.tabVariabili.rows[1];
const sel={value:'array', closest:()=>tr, addEventListener(){}, };
// crea il pulsante espansore come fa l'app
sb._bfSyncArrayValueControl({value:'array', closest:()=>tr});
const btn=tr.cells[2].querySelector('.array-expand');
console.log('pulsante creato:', !!btn);
const vals=new Array(1000).fill('a');
sb._bfRenderArrayCells(tr, vals, false, false);
let grid=tr.cells[2].querySelector('.array-cells');
console.log('griglia creata:', !!grid, '| nascosta:', grid.hidden, '| celle:', grid.children.length, '| pending:', !!grid._bfPending);
console.log('contatore sul pulsante:', btn.querySelector('.ae-n').textContent);
// l'utente APRE il pannello
btn.dispatchEvent(new w.Event('click'));
grid=tr.cells[2].querySelector('.array-cells');
console.log('dopo il click -> nascosta:', grid.hidden, '| celle:', grid.children.length);
console.log('prima cella:', grid.children[0] && grid.children[0].textContent);
// aggiornamento runtime con pannello APERTO
const vals2=vals.slice(); vals2[0]='b';
sb._bfRenderArrayCells(tr, vals2, true, false);
console.log('dopo update incrementale -> celle:', grid.children.length, '| cella 0:', grid.children[0] && grid.children[0].textContent);

// carico: 1000 aggiornamenti con il pannello APERTO (il caso peggiore)
let t0=Date.now();
const live=vals.slice();
for(let k=0;k<1000;k++){ live[k]='b'; sb._bfRenderArrayCells(tr, live, true, false); }
console.log('1000 refresh a pannello APERTO:', Date.now()-t0, 'ms');
// e con il pannello CHIUSO -- WP-M5m: va simulata una chiusura MANUALE, altrimenti
// l'apertura automatica lo riaprirebbe al primo cambio di valore.
grid.hidden=true; grid._bfUserClosed=true;
t0=Date.now();
for(let k=0;k<1000;k++){ live[k]='c'; sb._bfRenderArrayCells(tr, live, true, false); }
console.log('1000 refresh a pannello CHIUSO:', Date.now()-t0, 'ms');
// riapertura: deve mostrare i valori aggiornati nel frattempo
btn.dispatchEvent(new w.Event('click'));
console.log('riaperto -> celle:', grid.children.length, '| cella 0:', grid.children[0].textContent, '(atteso 0c)');
// array vuoto (pannello aperto)
grid.hidden=false; grid._bfUserClosed=false;
sb._bfRenderArrayCells(tr, [], false, false);
console.log('array vuoto -> celle:', grid.children.length, '| testo:', grid.textContent.trim());

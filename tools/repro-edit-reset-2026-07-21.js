/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
// Simula: esecuzione finita (valori runtime a schermo) -> l'utente MODIFICA qualcosa.
// Verifica la catena reale: pushHistory -> _bfAbortExecOnEdit -> restoreVariablesTable.
const {JSDOM}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const html='<table id="tabVariabili">'
 +'<tr><th>N</th><th>T</th><th>V</th></tr>'
 +'<tr><td></td><td></td><td><div class="value-cell"><input class="value-input"></div></td></tr>'
 +'<tr><td></td><td></td><td><div class="value-cell"><input class="value-input"></div></td></tr>'
 +'</table>';
const w=new JSDOM(html).window;
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat,setTimeout,clearTimeout};
sb.window=sb; sb.globalThis=sb; sb.document=w.document; sb.getComputedStyle=w.getComputedStyle.bind(w);
sb.i18nText=()=>null; sb.addEventListener=()=>{};
sb.tabVariabili=w.document.getElementById('tabVariabili');
vm.createContext(sb);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/execute.js','utf8'),sb,{filename:'e.js'});
sb.flow={nodes:[],variables:[{name:'i',type:'int',value:0},{name:'s',type:'string',value:'ciao'}]};
// stato "run finita": nessuna esecuzione attiva, ma valori runtime a schermo
sb._bfRunning=false; sb.currentNode=null; sb.executingEdge=null; sb.executingNodeIndex=-1;
const inputs=[...w.document.querySelectorAll('.value-input')];
const dirty=()=>inputs.forEach(i=>{i.value='999'; i.classList.add('live-value');});
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(50),'->',JSON.stringify(g),good?'':(' atteso '+JSON.stringify(wnt)));};

dirty();
c('prima: valori runtime a schermo', inputs[0].value, '999');
sb._bfAbortExecOnEdit();   // <- cio' che pushHistory chiama a ogni modifica
c('modifica blocco -> variabile 1 ripristinata', inputs[0].value, '0');
c('modifica blocco -> variabile 2 ripristinata', inputs[1].value, '"ciao"');
c('evidenziazione live tolta', inputs[0].classList.contains('live-value'), 'false');

// e deve funzionare ANCHE con un'esecuzione in corso (comportamento storico)
dirty(); sb._bfRunning=true; sb.currentNode='3';
sb._bfAbortExecOnEdit();
c('con run in corso: ripristina comunque', inputs[0].value, '0');
// NB: currentNode e' un `let` di modulo, non una proprieta' del global: dall'esterno non si
// puo' ne' impostare ne' leggere. L'abbattimento dell'esecuzione e' comportamento storico gia'
// coperto altrove; qui interessa che il RIPRISTINO avvenga in entrambi gli stati.
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

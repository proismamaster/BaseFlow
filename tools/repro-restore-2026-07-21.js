/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {JSDOM}=require('jsdom');
const fs=require('fs'), vm=require('vm');
// tabella con una riga di ERRORE in mezzo: e' il caso che sfasava tutto
const html='<table id="tabVariabili">'
 +'<tr><th>N</th><th>T</th><th>V</th></tr>'
 +'<tr><td></td><td></td><td><div class="value-cell"><input class="value-input"></div></td></tr>'
 +'<tr class="error-message-row"><td colspan="3">errore</td></tr>'
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
sb.flow={nodes:[],variables:[
  {name:'a',type:'int',value:10},
  {name:'b',type:'string',value:'ciao'},
  {name:'c',type:'int',value:0,uninit:true}
]};
const rows=[...w.document.querySelectorAll('tr')].filter(r=>!r.classList.contains('error-message-row')).slice(1);
// simula i valori RUNTIME rimasti a schermo dopo una run
rows.forEach(r=>{const i=r.querySelector('.value-input'); if(i){i.value='RUNTIME'; i.classList.add('live-value');}});
sb.restoreVariablesTable();
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(52),'->',JSON.stringify(g),good?'':(' atteso '+JSON.stringify(wnt)));};
c('variabile 1 (prima della riga di errore)', rows[0].querySelector('.value-input').value, '10');
c('variabile 2 (DOPO la riga di errore)',     rows[1].querySelector('.value-input').value, '"ciao"');
c('variabile 3 (ultima, prima si perdeva)',   rows[2].querySelector('.value-input').value, '');
c('classe live rimossa',                      rows[1].querySelector('.value-input').classList.contains('live-value'), 'false');
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
// WP-M6c: i tre campi del For accettano ESPRESSIONI/variabili, non solo numeri.
// Verifica il giro completo: salvataggio -> info del nodo -> riletura nel dialog.
const {JSDOM, VirtualConsole}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'..','app') + '/index.html','utf8');
const w=new JSDOM(html,{virtualConsole:new VirtualConsole()}).window;
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(52),'->',g,good?'':(' atteso '+wnt));};
// 1) i campi non sono piu' numerici
['for-init','for-final','for-step'].forEach(id=>{
  const el=w.document.getElementById(id);
  c('campo '+id+' e di tipo testo', el && el.getAttribute('type'), 'text');
});
// 2) round-trip: salvataggio con variabili e rilettura
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat};
sb.window=sb; sb.globalThis=sb; sb.document=w.document;
sb.flow={nodes:[{type:'for',info:''}]}; sb.forNodeIndex=0;
sb.pushHistory=()=>{}; sb.calcoloY=()=>{}; sb.draw=()=>{}; sb.saved=true;
sb._bfPopOverlay=()=>{}; sb.nodi=[];
vm.createContext(sb);
const src=fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/core/popups.js','utf8');
const i=src.indexOf('function parseForInfo');
const j=src.indexOf('function saveForNode');
const end=src.indexOf('\n}', src.indexOf('closeForPopup();', j));
vm.runInContext(src.slice(i, src.indexOf('\n}\n', end)+3), sb, {filename:'p.js'});
w.document.getElementById('for-var').value='i';
w.document.getElementById('for-init').value='inizio';
w.document.getElementById('for-final').value='n - 1';
w.document.getElementById('for-step').value='passo';
sb.saveForNode();
c('info composta con le variabili', sb.flow.nodes[0].info, 'i = inizio; i <= n - 1; i += passo');
const back=sb.parseForInfo(sb.flow.nodes[0].info);
c('rilettura: valore iniziale', back.init, 'inizio');
c('rilettura: valore finale', back.final, 'n - 1');
c('rilettura: passo', back.step, 'passo');
c('rilettura: direzione', back.dir, 'inc');
// 3) i numeri continuano a funzionare come prima
w.document.getElementById('for-init').value='0';
w.document.getElementById('for-final').value='10';
w.document.getElementById('for-step').value='1';
sb.saveForNode();
c('numeri: nessuna regressione', sb.flow.nodes[0].info, 'i = 0; i <= 10; i += 1');
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

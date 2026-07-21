/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {JSDOM}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const w=new JSDOM('<div id="console-output"></div>').window;
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat,setTimeout,clearTimeout};
sb.window=sb; sb.globalThis=sb; sb.document=w.document; sb.getComputedStyle=w.getComputedStyle.bind(w);
sb.i18nText=()=>null; sb.addEventListener=()=>{}; sb.requestAnimationFrame=fn=>setTimeout(fn,0);
sb.cancelAnimationFrame=id=>clearTimeout(id);
sb.perfSettings={turbo:false, consoleMax:false};
sb.consoleSettings={};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/execute.js','utf8'),sb,{filename:'e.js'});
const out=w.document.getElementById('console-output');
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(50),'->',g,good?'':(' atteso '+wnt));};

// --- batching: a riposo la riga compare SUBITO
sb.printMessage('a riposo','debug');
c('a riposo: scrive subito nel DOM', out.children.length, 1);

// --- in esecuzione le righe si accodano
sb._setRunning(true);
for(let i=0;i<50;i++) sb.printMessage('riga '+i,'debug');
c('in esecuzione: DOM ancora fermo', out.children.length, 1);
sb._bfFlushConsoleNow();
c('dopo il flush: tutte presenti', out.children.length, 51);

// --- fine esecuzione: flush automatico
for(let i=0;i<10;i++) sb.printMessage('coda '+i,'debug');
sb._setRunning(false);
c('fine run: flush automatico', out.children.length, 61);

// --- TURBO: le righe di servizio spariscono, l'output resta
out.innerHTML=''; sb.perfSettings.turbo=true; sb._setRunning(true);
sb.printMessage('servizio','debug');
sb.printMessage('condizione','cond');
sb.printMessage('RISULTATO','output');
sb._bfFlushConsoleNow();
c('turbo: solo output', out.children.length, 1);
c('turbo: e il contenuto e quello giusto', out.textContent.trim(), '> RISULTATO');
sb._setRunning(false);

// --- WP-M5u: con il tetto storico attivo, nel DOM finiscono solo le ultime righe
out.innerHTML=''; sb.perfSettings.turbo=false; sb.perfSettings.consoleMax=true;
sb._setRunning(true);
for(let i=0;i<3000;i++) sb.printMessage('riga '+i,'debug');
sb._bfFlushConsoleNow();
const n=out.children.length;
c('3000 righe -> nel DOM ne finiscono al piu 300', n<=300, 'true');
c('sono tenute le ULTIME, non le prime', out.lastChild.textContent, '> riga 2999');
sb._setRunning(false);
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

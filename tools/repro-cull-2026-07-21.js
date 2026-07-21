/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
// WP-M5y: il culling deve saltare SOLO i blocchi fuori vista, e mai durante l'export.
const fs=require('fs'), vm=require('vm');
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat};
sb.window=sb; sb.globalThis=sb;
let cont={clientWidth:1000, clientHeight:800, scrollLeft:0, scrollTop:0};
sb.document={ getElementById:(id)=> id==='canvas-container'? cont : null };
sb.canvas={offsetLeft:0, offsetTop:0};
sb.zoom=1;
vm.createContext(sb);
// estrae solo _bfViewportBox + il flag
const src=fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/core/rendering.js','utf8');
const i=src.indexOf('var _bfExporting = false;');
const j=src.indexOf('function draw(forme) {');
vm.runInContext(src.slice(i,j), sb, {filename:'r.js'});
let ok=0,ko=0;
const c=(d,g,w)=>{const good=String(g)===String(w);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(52),'->',g,good?'':(' atteso '+w));};
const inBox=(b,x,y)=> !(x < b.x1 || x > b.x2 || y < b.y1 || y > b.y2);

let b=sb._bfViewportBox();
c('riquadro calcolato', !!b, 'true');
c('blocco al centro: visibile', inBox(b,500,400), 'true');
c('blocco appena fuori (margine 300): ancora dentro', inBox(b,1200,400), 'true');
c('blocco molto lontano: cullato', inBox(b,5000,400), 'false');
// scroll: la finestra si sposta
cont.scrollTop=2000; b=sb._bfViewportBox();
c('dopo scroll, y=2400 visibile', inBox(b,500,2400), 'true');
c('dopo scroll, y=100 fuori', inBox(b,500,100), 'false');
// zoom out: si vede piu' area
cont.scrollTop=0; sb.zoom=0.5; b=sb._bfViewportBox();
c('zoom 0.5: area visibile raddoppiata', b.x2 > 2000, 'true');
// export: niente culling
sb.zoom=1; sb._bfExporting=true;
c('durante export: nessun culling', sb._bfViewportBox(), 'null');
sb._bfExporting=false;
// contenitore non misurabile: nessun culling
cont={clientWidth:0, clientHeight:0, scrollLeft:0, scrollTop:0};
c('contenitore non misurabile: nessun culling', sb._bfViewportBox(), 'null');
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

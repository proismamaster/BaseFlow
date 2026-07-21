/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {JSDOM}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const w=new JSDOM('<div id="canvas-container" style="position:relative"><canvas id="canvas"></canvas></div>').window;
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat,setTimeout,clearTimeout};
sb.window=sb; sb.globalThis=sb; sb.document=w.document; sb.getComputedStyle=w.getComputedStyle.bind(w);
sb.addEventListener=()=>{};
sb.canvas=w.document.getElementById('canvas');
sb.themeCanvasLineColor=()=>'#334455';
sb.viewSettings={showGrid:false};
sb.zoom=1;
vm.createContext(sb);
// carica solo la funzione della griglia (layout.js intero richiede troppe dipendenze)
const src=fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/core/layout.js','utf8');
const i=src.indexOf('const BF_GRID_STEP'); const j=src.indexOf('if (typeof window !== \'undefined\') window._bfSyncCanvasGrid');
vm.runInContext(src.slice(i, src.indexOf('\n', j)), sb, {filename:'grid.js'});
const cont=w.document.getElementById('canvas-container');
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(48),'->',g,good?'':(' atteso '+wnt));};

sb._bfSyncCanvasGrid();
c('griglia spenta: nessuno sfondo', cont.style.backgroundImage, '');

sb.viewSettings.showGrid=true; sb._bfSyncCanvasGrid();
c('accesa: sfondo sul CONTENITORE', cont.style.backgroundImage.indexOf('linear-gradient')>=0, 'true');
c('passo a zoom 1', cont.style.backgroundSize, '24px 24px, 24px 24px');
c('scorre col contenuto', cont.style.backgroundAttachment, 'local, local');

sb.zoom=0.5; sb._bfSyncCanvasGrid();
c('zoom 0.5: passo dimezzato', cont.style.backgroundSize, '12px 12px, 12px 12px');
sb.zoom=2; sb._bfSyncCanvasGrid();
c('zoom 2: passo raddoppiato', cont.style.backgroundSize, '48px 48px, 48px 48px');

sb.viewSettings.showGrid=false; sb._bfSyncCanvasGrid();
c('rispenta: sfondo rimosso', cont.style.backgroundImage, '');
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

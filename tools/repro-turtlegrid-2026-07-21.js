/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
// WP-M6a/M6b: griglia coerente nella tartaruga + reset del disegno con gli stessi trigger
// delle variabili.
const {JSDOM, VirtualConsole}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const w=new JSDOM('<body></body>',{virtualConsole:new VirtualConsole()}).window;
const ctx={ set strokeStyle(v){}, set lineWidth(v){}, set lineCap(v){}, set fillStyle(v){}, set font(v){},
  beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, arc(){}, closePath(){}, clearRect(){},
  save(){}, restore(){}, setTransform(){}, translate(){}, rotate(){}, scale(){}, fillText(){},
  measureText(){return {width:10};}, drawImage(){} };
w.HTMLCanvasElement.prototype.getContext=function(){ return ctx; };
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat,setTimeout,clearTimeout};
sb.window=sb; sb.globalThis=sb; sb.document=w.document; sb.getComputedStyle=w.getComputedStyle.bind(w);
sb.addEventListener=()=>{}; sb.i18nText=()=>null; sb.devicePixelRatio=1; sb.printMessage=()=>{};
sb.themeCanvasLineColor=()=>'#334455';
sb.viewSettings={showGrid:false};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/core/draw.js','utf8'),sb,{filename:'d.js'});
sb._tgEval=(e)=>parseFloat(e);
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(54),'->',g,good?'':(' atteso '+wnt));};

sb.execHome();
const cv=w.document.getElementById('draw-canvas');
c('griglia spenta: nessuno sfondo sulla tela', cv.style.backgroundImage, '');
sb.viewSettings.showGrid=true; sb._bfSyncTurtleGrid();
c('accesa: sfondo sulla TELA (non sul contenitore)', cv.style.backgroundImage.indexOf('linear-gradient')>=0, 'true');
c('stesso passo del canvas principale (24)', cv.style.backgroundSize, '24px 24px, 24px 24px');
c('ancorata alla casa della tartaruga', cv.style.backgroundPosition, sb._tgOriginX+'px '+sb._tgOriginY+'px, '+sb._tgOriginX+'px '+sb._tgOriginY+'px');
sb._tgZoom=2; sb._bfSyncTurtleGrid();
c('zoom 2: passo raddoppiato come nel canvas', cv.style.backgroundSize, '48px 48px, 48px 48px');
sb._tgZoom=1;
// M6b: il disegno si azzera quando il risultato non vale piu'
for(let k=0;k<10;k++){ sb.execForward('20',[],0); sb.execTurn('right','90',[],0); }
c('disegno presente dopo l esecuzione', sb._tgSegments.length, 10);
sb.resetTurtle();
c('resetTurtle azzera il disegno', sb._tgSegments.length, 0);
c('e riporta la tela al default', sb.TG_W, 300);
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
// WP-M5x: il disegno tartaruga non deve piu' essere quadratico nel numero di mosse.
const {JSDOM, VirtualConsole}=require('jsdom');
const fs=require('fs'), vm=require('vm');
const vc=new VirtualConsole(); // silenzia "getContext not implemented"
const w=new JSDOM('<body></body>',{virtualConsole:vc}).window;
// mock minimo del contesto 2D: conta le operazioni di disegno
let strokes=0, clears=0;
const ctx={ set strokeStyle(v){}, set lineWidth(v){}, set lineCap(v){}, set fillStyle(v){}, set font(v){},
  beginPath(){}, moveTo(){}, lineTo(){}, stroke(){strokes++;}, fill(){}, arc(){}, closePath(){},
  clearRect(){clears++;}, save(){}, restore(){}, setTransform(){}, translate(){}, rotate(){}, scale(){},
  fillText(){}, measureText(){return {width:10};}, drawImage(){}, createLinearGradient(){return {addColorStop(){}};} };
w.HTMLCanvasElement.prototype.getContext=function(){ return ctx; };
const sb={console,Math,Number,String,Array,Object,JSON,RegExp,isNaN,parseInt,parseFloat,setTimeout,clearTimeout};
sb.window=sb; sb.globalThis=sb; sb.document=w.document; sb.getComputedStyle=w.getComputedStyle.bind(w);
sb.addEventListener=()=>{}; sb.i18nText=()=>null; sb.devicePixelRatio=1; sb.printMessage=()=>{};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','app') + '/js/core/draw.js','utf8'),sb,{filename:'d.js'});
sb._tgEval=(e)=>parseFloat(e);
let full=0, incr=0;
const origFull=sb._tgRenderDrawing, origSeg=sb._tgStrokeSegment;
sb._tgRenderDrawing=function(){ full++; return origFull.apply(this,arguments); };
sb._tgStrokeSegment=function(){ incr++; return origSeg.apply(this,arguments); };
let ok=0,ko=0;
const c=(d,g,wnt)=>{const good=String(g)===String(wnt);good?ok++:ko++;console.log((good?' ok ':' FAIL'),d.padEnd(54),'->',g,good?'':(' atteso '+wnt));};

sb.execHome(); full=0; incr=0; strokes=0;
const N=2000, t0=Date.now();
for(let k=0;k<N;k++){ sb.execForward('20', [], 0); sb.execTurn('right','90', [], 0); }
const ms=Date.now()-t0;
console.log('  '+N+' mosse in '+ms+' ms | ridisegni completi: '+full+' | disegni incrementali: '+incr+' | stroke totali: '+strokes);
c('pochi ridisegni completi (la tela cresce di rado)', full < 50, 'true');
c('quasi tutte le mosse sono incrementali', incr > N*0.9, 'true');
// soglia: lineare = ~N + (ridisegni completi x N). Il comportamento QUADRATICO misurato
// prima del fix era ~4.000.000 di stroke per 2000 mosse: qualsiasi soglia in O(N) lo scarta.
c('stroke totali lineari (era ~4.000.000 = quadratico)', strokes < N*5, 'true');
c('tutti i segmenti registrati', sb._tgSegments.length, N);
const W=sb.TG_W, H=sb.TG_H, OX=sb._tgOriginX, OY=sb._tgOriginY;
sb._tgRecomputeBoundsFull();
c('limiti incrementali == riscansione completa (W)', sb.TG_W, W);
c('limiti incrementali == riscansione completa (H)', sb.TG_H, H);
c('origine identica (X)', sb._tgOriginX, OX);
c('origine identica (Y)', sb._tgOriginY, OY);
console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);

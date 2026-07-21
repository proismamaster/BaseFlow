/*
 * WP-M6e: le tabelle del manuale devono seguire il TEMA (la regola globale
 * `th, td { background-color:#fff }` di style.css le rendeva bianche ovunque).
 * Uso: node tools/repro-manual-tables-2026-07-21.js
 */
// WP-M6e: le tabelle del manuale NON devono avere sfondo bianco fisso in tema scuro.
const fs=require('fs'), path=require('path');
const {JSDOM, VirtualConsole}=require('jsdom');
const dir=path.join(__dirname);
const html=fs.readFileSync(path.join(__dirname,'..','app','manual.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','app','style.css'),'utf8');
// jsdom non carica il css esterno: lo si inietta per avere la CASCATA vera (e' proprio la
// regola globale di style.css il colpevole, quindi senza di essa il test non proverebbe nulla)
const conCss = html.replace('<link rel="stylesheet" href="style.css?v=20260713i">', '<style>'+css+'</style>');
let ok=0,ko=0;
const c=(d,g,w)=>{const good=String(g)===String(w);good?ok++:ko++;console.log((good?'  ok  ':'  FAIL')+' '+d.padEnd(56)+' -> '+g+(good?'':'   atteso '+w));};
function apri(tema){
  return new Promise(res=>{
    const dom=new JSDOM(conCss,{runScripts:'dangerously',url:'https://baseflow.local/manual.html',virtualConsole:new VirtualConsole(),
      beforeParse(w){ try{ w.localStorage.setItem('baseflow-theme',tema); }catch(e){} }});
    dom.window.addEventListener('load',()=>res(dom.window));
  });
}
(async()=>{
  for (const tema of ['light','dark','neon','chalk']) {
    const w=await apri(tema);
    const td=w.document.querySelector('table.man-table td');
    const bg=w.getComputedStyle(td).backgroundColor;
    const scuro=['dark','neon','chalk'].includes(tema);
    c('['+tema+'] la cella NON ha sfondo bianco fisso', /255,\s*255,\s*255/.test(bg)===false, 'true');
    c('['+tema+'] allineamento a start (non center dell app)', w.getComputedStyle(td).textAlign, 'start');
    c('['+tema+'] larghezza non forzata a 33%', w.getComputedStyle(td).width !== '33.333%', 'true');
    if (scuro) c('['+tema+'] body ha dark-mode (testo chiaro)', w.document.body.classList.contains('dark-mode'), 'true');
  }
  console.log('\n'+ok+' ok, '+ko+' falliti'); process.exit(ko?1:0);
})();

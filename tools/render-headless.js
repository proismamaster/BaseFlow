const fs = require('fs'); const vm = require('vm');
const REPO = '/sessions/magical-charming-rubin/mnt/web-flowcharts';
const W=1000,H=1000;
let ops = [];
function col(c){ if(!c || typeof c!=='string' || c.startsWith('var(')) return '#000'; return c; }
const ctxMock = {
  fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle',
  _path: [],
  beginPath(){ this._path=[]; },
  moveTo(x,y){ this._path.push(['M',x,y]); },
  lineTo(x,y){ this._path.push(['L',x,y]); },
  quadraticCurveTo(cx,cy,x,y){ this._path.push(['Q',cx,cy,x,y]); },
  rect(x,y,w,h){ this._path.push(['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']); },
  closePath(){ this._path.push(['Z']); },
  stroke(){ if(this._path.length) ops.push({t:'stroke', d:[...this._path], c:col(this.strokeStyle), w:this.lineWidth}); },
  fill(){ if(this._path.length) ops.push({t:'fill', d:[...this._path], c:col(this.fillStyle)}); },
  clearRect(){ ops=[]; },
  fillText(txt,x,y){ ops.push({t:'text', txt, x, y, c:col(this.fillStyle), f:this.font}); },
  measureText(t){ return {width: (t||'').length*8}; }
};
function toSVG(){
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="white"/>`];
  for (const o of ops) {
    if (o.t==='text') { parts.push(`<text x="${o.x}" y="${o.y}" font-size="14" font-family="Arial" text-anchor="middle" fill="${o.c}">${o.txt.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`); continue; }
    const d = o.d.map(s=>s[0]==='Z'?'Z':(s[0]==='Q'?`Q ${s[1]} ${s[2]} ${s[3]} ${s[4]}`:`${s[0]} ${s[1]} ${s[2]}`)).join(' ');
    if (o.t==='stroke') parts.push(`<path d="${d}" fill="none" stroke="${o.c}" stroke-width="${o.w||1.5}"/>`);
    else parts.push(`<path d="${d}" fill="${o.c}" stroke="none"/>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const genericEl=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[]});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:genericEl(),addEventListener:()=>{},createElement:()=>genericEl(),querySelector:()=>genericEl(),querySelectorAll:()=>[],body:genericEl(),documentElement:genericEl()};
const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(context);
for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) {
  vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
}
vm.runInContext('window.onload();', context);
const ins = (filter, tipo) => vm.runInContext(`frecceSelected = frecce.findIndex(f=>${filter}); if(frecceSelected===-1) console.error("NO ARC ${tipo}"); else inserisciNodo("${tipo}");`, context);
const snap = (name) => { fs.writeFileSync('/tmp/svg_'+name+'.svg', toSVG()); };

// Scenario A: while > while (annidato), poi blocco nel corpo interno
ins('f.type==="normal"', 'while');                    // while esterno
ins('f.type==="loop_body"', 'while');                 // while interno nel corpo
snap('A_while_in_while');
ins('f.type==="loop_body" && f.fromNodeIndex===2', 'print'); // print nel corpo interno
snap('B_print_in_inner');
// Scenario C: blocco DOPO il while interno (loop_body_end esterno)
ins('f.type==="loop_body_end"', 'assign');
snap('C_assign_after_inner');
console.log('flow:', vm.runInContext('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))', context));
console.log('arch:', vm.runInContext('JSON.stringify(frecce.map(f=>({t:f.type,f:f.fromNodeIndex,to:f.toNodeIndex,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))', context));

// D: terzo while annidato nel corpo del secondo
ins('f.type==="loop_body" && f.fromNodeIndex===2', 'while');
snap('D_triple_while');
// E: if dentro il corpo del terzo while
ins('f.type==="loop_body" && flow.nodes[f.fromNodeIndex] && flow.nodes[f.fromNodeIndex].info==="" && f.fromNodeIndex===3', 'if');
snap('E_if_in_third');
console.log('flowE:', vm.runInContext('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))', context));

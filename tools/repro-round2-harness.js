// Harness di riproduzione per PLANS/2026-07-06-nested-loops-round2.md.
// Espone setFlow/run/ins/snap (SVG + dump JSON di nodi/frecce in /tmp/repro/) per
// riprodurre scenari di cicli annidati misti senza bisogno di un browser reale.
// Uso: const { setFlow, run, ins, snap } = require('./repro-round2-harness.js');
// NB: REPO qui sotto punta al path della sandbox CORRENTE -- adattare se cambia.
const fs = require('fs'); const vm = require('vm');
const REPO = require('path').join(__dirname, '..', 'app');
const W=1400,H=1400;
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
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""}};
const genericEl=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[]});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:genericEl(),addEventListener:()=>{},createElement:()=>genericEl(),querySelector:()=>genericEl(),querySelectorAll:()=>[],body:genericEl(),documentElement:genericEl()};
const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:(...a)=>console.log(...a),error:(...a)=>console.error(...a),warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(context);
for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) {
  vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
}
function setFlow(nodesSpec) {
  vm.runInContext(`
    flow = { nodes: ${JSON.stringify(nodesSpec)}, variables: [] };
    nodi = flow.nodes.map(function(){ return {relX:0.5, relY:0, width:100, height:40, color:'white', text:'x'}; });
    undoStack = []; redoStack = []; frecce = []; nodoSelected = -1; frecceSelected = -1;
    calcoloY(nodi); draw(nodi);
  `, context);
}
function run(js){ return vm.runInContext(js, context); }
function ins(filterExpr, tipo){
  const msg = JSON.stringify('NO ARC for '+tipo+': '+filterExpr);
  const tipoStr = JSON.stringify(tipo);
  run(`frecceSelected = frecce.findIndex(f=>${filterExpr}); if(frecceSelected===-1) console.error(${msg}); else inserisciNodo(${tipoStr});`);
}
function snap(name){
  fs.writeFileSync('/tmp/repro/svg_'+name+'.svg', toSVG());
  const nodi = run('JSON.stringify(nodi.map((n,i)=>({i,t:(flow.nodes[i]||{}).type, relX:+n.relX.toFixed(3), relY:+n.relY.toFixed(3), pxX:Math.round(n.relX*'+W+'), pxY:Math.round(n.relY*'+H+'), w:n.width, h:n.height, bodyColXRel:n.bodyColXRel, reconnectPxY:n.reconnectPxY})))');
  fs.writeFileSync('/tmp/repro/nodi_'+name+'.json', nodi);
  const arcs = run('JSON.stringify(frecce.map(f=>({t:f.type,f:f.fromNodeIndex,to:f.toNodeIndex,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))');
  fs.writeFileSync('/tmp/repro/arcs_'+name+'.json', arcs);
}
module.exports = { setFlow, run, ins, snap };

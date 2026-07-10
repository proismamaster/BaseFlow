// Renders each resize-bug scenario to an SVG for visual verification.
const fs=require('fs'),vm=require('vm');
const REPO=__dirname+'/..';
const W=1500,H=1400;
let ops=[];
function col(c){ if(!c||typeof c!=='string'||c.startsWith('var('))return '#333'; return c; }
const ctx={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',_path:[],
  save(){},restore(){},setLineDash(){},arc(x,y,r){ops.push({t:'circle',x,y,r,c:col(this.fillStyle)});},
  beginPath(){this._path=[];},moveTo(x,y){this._path.push(['M',x,y]);},lineTo(x,y){this._path.push(['L',x,y]);},
  quadraticCurveTo(cx,cy,x,y){this._path.push(['L',x,y]);},rect(x,y,w,h){this._path.push(['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']);},
  closePath(){this._path.push(['Z']);},
  stroke(){if(this._path.length)ops.push({t:'stroke',d:[...this._path],c:col(this.strokeStyle),w:this.lineWidth});},
  fill(){if(this._path.length)ops.push({t:'fill',d:[...this._path],c:col(this.fillStyle)});},
  clearRect(){ops=[];},fillText(txt,x,y){ops.push({t:'text',txt,x,y,c:col(this.fillStyle)});},
  measureText(t){return{width:(t||'').length*8};}};
const canvas={width:W,height:H,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0}),addEventListener(){},style:{}};
const el=()=>({addEventListener(){},classList:{add(){},remove(){},contains:()=>false,toggle(){}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild(){},innerHTML:'',textContent:'',dataset:{},rows:[],getBoundingClientRect:()=>({width:0,height:0,left:0,top:0})});
const document={getElementById:id=>id==='canvas'?canvas:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener(){},scrollLeft:0,clientWidth:W,clientHeight:H}:el(),addEventListener(){},createElement:()=>el(),querySelector:()=>el(),querySelectorAll:()=>[],body:el(),documentElement:{getAttribute:()=>null,style:{setProperty(){}}}};
const context={document,window:{addEventListener(){},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener(){}})},localStorage:{getItem:()=>null,setItem(){}},MutationObserver:function(){this.observe=()=>{}},console:{log(){},warn(){},error(){}},getComputedStyle:()=>({getPropertyValue:()=>''}),Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert(){},confirm:()=>true,location:{}};
vm.createContext(context);
for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),context,{filename:n+'.js'});
vm.runInContext('window.onload();',context);
const run=c=>vm.runInContext(c,context);
function reset(){run('flow={nodes:[{type:"start",next:"1"},{type:"end",next:null}]};nodi=[{text:"Start",color:"#7ed957",width:100,height:40},{text:"End",color:"#e63946",width:100,height:40}];calcoloY(nodi);draw(nodi);');}
function ins(f,t){const i=run(`frecce.findIndex(x=>${f})`);if(i===-1)throw new Error('no arc '+t+' '+f);run(`frecceSelected=${i};inserisciNodo("${t}");`);}
function setInfo(i,t){run(`flow.nodes[${i}].info=${JSON.stringify(t)};`);}
function redraw(){run('calcoloY(nodi);draw(nodi);');}
function bbox(){return run('(()=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const v of nodi){x0=Math.min(x0,v.relX*w-v.width/2);x1=Math.max(x1,v.relX*w+v.width/2);y0=Math.min(y0,v.relY*h-v.height/2);y1=Math.max(y1,v.relY*h+v.height/2);}return{x0,y0,x1,y1};})()');}
function toSVG(){const b=bbox();const pad=40;const vx=b.x0-pad,vy=b.y0-pad,vw=(b.x1-b.x0)+2*pad,vh=(b.y1-b.y0)+2*pad;
  const p=[`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(vw)}" height="${Math.round(vh)}" viewBox="${Math.round(vx)} ${Math.round(vy)} ${Math.round(vw)} ${Math.round(vh)}"><rect x="${Math.round(vx)}" y="${Math.round(vy)}" width="${Math.round(vw)}" height="${Math.round(vh)}" fill="#f7f7fb"/>`];
  for(const o of ops){
    if(o.t==='text'){p.push(`<text x="${o.x}" y="${o.y}" font-size="13" font-family="Arial" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="${o.c}">${String(o.txt).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`);continue;}
    if(o.t==='circle'){p.push(`<circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="${o.c}"/>`);continue;}
    const d=o.d.map(s=>s[0]==='Z'?'Z':`${s[0]} ${s[1]} ${s[2]}`).join(' ');
    if(o.t==='stroke')p.push(`<path d="${d}" fill="none" stroke="${o.c}" stroke-width="${o.w||1.5}"/>`);
    else p.push(`<path d="${d}" fill="${o.c}" stroke="none"/>`);
  }
  p.push('</svg>');return p.join('\n');
}
function snap(name){fs.writeFileSync('/tmp/bug_'+name+'.svg',toSVG());console.log('wrote /tmp/bug_'+name+'.svg');}
const LONG='asdasDasdasDasdasDasdasDasdasDasdasDasdasD asdasDasdasDasdasDasdasD asdasDasdasDasdasDasdasDasdasD';
const LONGER=(LONG+' ').repeat(3);

reset();ins('x.type==="normal"','for');ins('x.type==="loop_body"','if');ins('x.type==="if_false"','print');setInfo(3,LONG);redraw();snap('1_3_for_if_tallfalse');
reset();ins('x.type==="normal"','if');ins('x.type==="if_false"','if');ins('x.type==="if_true"&&x.fromNodeIndex===2','print');setInfo(run('flow.nodes.findIndex(n=>n.type==="print")'),LONGER);redraw();snap('4_if_falseif_hugetrue');
reset();ins('x.type==="normal"','while');setInfo(1,LONGER);ins('x.type==="loop_body"','print');redraw();snap('5_while_longcond');
reset();ins('x.type==="normal"','do');setInfo(1,LONGER);ins('x.type==="loop_body"','print');redraw();snap('6_dowhile_longcond');
reset();ins('x.type==="normal"','if');setInfo(1,LONG);redraw();snap('2_if_diamond');

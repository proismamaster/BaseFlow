const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1400,H=1600;
function makeApp(){
 const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
 const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
 const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
 const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
 const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},error:function(){},warn:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
 vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
 const run=c=>vm.runInContext(c,ctx);
 const ins=function(f,t){run('frecceSelected=frecce.findIndex(function(ff){return '+f+';});');run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
 run('calcoloY(nodi);draw(nodi);');
 return {run,ins};
}
function crossings(run){
 const segs=JSON.parse(run(`(function(){var out=[];for(var i=0;i<frecce.length;i++){var f=frecce[i];out.push({id:f.id,a:[f.inzioX,f.inzioY],b:[f.fineX,f.fineY]});if(f.visualExtra)for(var k=0;k<f.visualExtra.length;k++){var s=f.visualExtra[k];out.push({id:f.id,a:[s[0],s[1]],b:[s[2],s[3]]});}}return JSON.stringify(out);})()`));
 const boxes=JSON.parse(run(`JSON.stringify(nodi.map(function(v,i){return {i:i,type:flow.nodes[i].type,x0:v.relX*w-v.width/2,y0:v.relY*h-v.height/2,x1:v.relX*w+v.width/2,y1:v.relY*h+v.height/2};}))`));
 function hit(a,b,box){const m=3;const x0=box.x0+m,y0=box.y0+m,x1=box.x1-m,y1=box.y1-m;let t0=0,t1=1;const dx=b[0]-a[0],dy=b[1]-a[1];const p=[-dx,dx,-dy,dy],q=[a[0]-x0,x1-a[0],a[1]-y0,y1-a[1]];for(let i=0;i<4;i++){if(p[i]===0){if(q[i]<0)return false;}else{const r=q[i]/p[i];if(p[i]<0){if(r>t1)return false;if(r>t0)t0=r;}else{if(r<t0)return false;if(r<t1)t1=r;}}}return t0<t1;}
 let c=0,det=[];for(const s of segs)for(const box of boxes)if(hit(s.a,s.b,box)){c++;if(det.length<6)det.push('arc'+s.id+'->nodo'+box.i+'('+box.type+')');}
 return {c,det};
}
// SCEN 1: for{ while{ do{} } } misti + input dopo
let a=makeApp();
a.ins('ff.type==="normal"','for');a.ins('ff.type==="loop_body"','while');a.ins('ff.type==="loop_body"&&ff.fromNodeIndex===2','do');
a.ins('ff.type==="loop_exit"&&ff.fromNodeIndex===1','input');
let r=crossings(a.run);
console.log('SCEN1 for{while{do{}}}+input: nodi='+a.run('JSON.stringify(flow.nodes.map(function(n){return n.type;}))')+' crossings='+r.c+(r.det.length?' '+JSON.stringify(r.det):''));
// SCEN 2: while{ assign; while{ assign } } blocchi nel corpo
let b=makeApp();
b.ins('ff.type==="normal"','while');b.ins('ff.type==="loop_body"','assign');b.ins('ff.type==="loop_body_end"&&ff.fromNodeIndex===2','while');b.ins('ff.type==="loop_body"&&ff.fromNodeIndex===3','assign');
let r2=crossings(b.run);
console.log('SCEN2 while{assign;while{assign}}: nodi='+b.run('JSON.stringify(flow.nodes.map(function(n){return n.type;}))')+' crossings='+r2.c+(r2.det.length?' '+JSON.stringify(r2.det):''));
// SCEN 3 (regressione): singolo while{assign} + input dopo -> il posizionamento del nodo d'uscita NON deve cambiare
let c=makeApp();
c.ins('ff.type==="normal"','while');c.ins('ff.type==="loop_body"','assign');c.ins('ff.type==="loop_exit"&&ff.fromNodeIndex===1','input');
const inIdx=c.run('flow.nodes.findIndex(function(n){return n.type==="input";})');
const r3=crossings(c.run);
console.log('SCEN3 while{assign}+input (singolo, ramo con uscita reale INVARIATO): inputY='+Math.round(c.run('nodi['+inIdx+'].relY*h'))+' crossings='+r3.c);

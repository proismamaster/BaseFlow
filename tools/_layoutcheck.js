const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1200,H=1200;
function boot(){
 const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
 const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
 const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
 const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
 const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},error:function(){},warn:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
 vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
 return ctx;
}
const ctx=boot();const run=c=>vm.runInContext(c,ctx);
const ins=function(f,t){run('frecceSelected=frecce.findIndex(function(ff){return '+f+';});');run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');
// 7 while annidati: ogni while nel corpo del precedente
ins('ff.type==="normal"','while'); // w1
for(let k=2;k<=7;k++){ ins('ff.type==="loop_body"&&ff.fromNodeIndex==='+(k-1)+'','while'); }
// un input dopo il while esterno (nel main)
ins('ff.type==="loop_exit"&&ff.fromNodeIndex===1','input');
console.log('NODI:',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))'));
// Y del nodo input (uscita del ciclo esterno) e altezza contenuto
const inputIdx=run('flow.nodes.findIndex(function(n){return n.type==="input";})');
console.log('Y assoluto del nodo input (uscita ciclo esterno):',Math.round(run('nodi['+inputIdx+'].relY*h')));
console.log('altezza while esterno (rombo) Y:',Math.round(run('nodi[1].relY*h')));
console.log('distanza verticale ciclo-esterno -> input:',Math.round(run('(nodi['+inputIdx+'].relY-nodi[1].relY)*h')));
// Y dei back-edge (reconnectPxY) di ogni while, per vedere la separazione concentrica
console.log('reconnectPxY per while (back-edge bodyBottom):',run('JSON.stringify(nodi.map(function(v,i){return flow.nodes[i].type==="while"?{i:i,rc:Math.round(v.reconnectPxY)}:null;}).filter(Boolean))'));
// OVERLAP CHECK: ogni segmento di ogni freccia vs bbox di ogni nodo estraneo
const segs=JSON.parse(run(`(function(){var out=[];for(var i=0;i<frecce.length;i++){var f=frecce[i];out.push({id:f.id,a:[f.inzioX,f.inzioY],b:[f.fineX,f.fineY]});if(f.visualExtra)for(var k=0;k<f.visualExtra.length;k++){var s=f.visualExtra[k];out.push({id:f.id,a:[s[0],s[1]],b:[s[2],s[3]]});}}return JSON.stringify(out);})()`));
const boxes=JSON.parse(run(`JSON.stringify(nodi.map(function(v,i){return {i:i,type:flow.nodes[i].type,x0:v.relX*w-v.width/2,y0:v.relY*h-v.height/2,x1:v.relX*w+v.width/2,y1:v.relY*h+v.height/2};}))`));
function segIntersectsBox(a,b,box){ // clip test (Liang-Barsky semplificato) con piccolo margine interno
 const m=3; const x0=box.x0+m,y0=box.y0+m,x1=box.x1-m,y1=box.y1-m;
 let t0=0,t1=1; const dx=b[0]-a[0],dy=b[1]-a[1];
 const p=[-dx,dx,-dy,dy],q=[a[0]-x0,x1-a[0],a[1]-y0,y1-a[1]];
 for(let i=0;i<4;i++){ if(p[i]===0){ if(q[i]<0)return false; } else { const r=q[i]/p[i]; if(p[i]<0){ if(r>t1)return false; if(r>t0)t0=r; } else { if(r<t0)return false; if(r<t1)t1=r; } } }
 return t0<t1;
}
let crossings=0,details=[];
for(const s of segs){ for(const box of boxes){ if(segIntersectsBox(s.a,s.b,box)){ crossings++; if(details.length<12)details.push('arc'+s.id+' attraversa nodo'+box.i+'('+box.type+')'); } } }
console.log('SEGMENTI che attraversano un nodo (dovrebbe 0):',crossings);
details.forEach(d=>console.log('  '+d));

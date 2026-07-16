const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
function makeApp(){
 const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
 const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
 const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
 const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
 const warns=[];
 const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:function(){warns.push(Array.prototype.join.call(arguments,' '));}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
 vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
 const run=c=>vm.runInContext(c,ctx);
 const ins=function(f,t){const ok=run('frecceSelected=frecce.findIndex(function(ff){return '+f+';}); frecceSelected!==-1');if(!ok){console.log('  INS FAIL '+f);return;}run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
 const ev=function(x,y){return '({clientX:'+x+',clientY:'+y+',pointerId:1,button:0,preventDefault:function(){},stopPropagation:function(){}})';};
 const drag=function(nodeIdx,candSel,label){
  const pn=JSON.parse(run('JSON.stringify((function(){var v=nodi['+nodeIdx+'];return {x:v.relX*w,y:v.relY*h};})())'));
  const cand=JSON.parse(run('JSON.stringify((function(){var f='+candSel+';return f?{id:f.id,type:f.type,ve:f.visualExtra||[],inzio:[f.inzioX,f.inzioY],fine:[f.fineX,f.fineY]}:null;})())'));
  if(!cand){console.log('  '+label+': TARGET NON TROVATO');return;}
  const seg=cand.ve.length?cand.ve[cand.ve.length-1]:[cand.inzio[0],cand.inzio[1],cand.fine[0],cand.fine[1]];
  const tx=Math.round((seg[0]+seg[2])/2),ty=Math.round((seg[1]+seg[3])/2);
  run('onCanvasMouseDown('+ev(Math.round(pn.x),Math.round(pn.y))+');');const dni=run('dragNodeIndex');
  run('onCanvasMouseMove('+ev(tx,ty)+');');const aid=run('(dragOverIndex>=0?frecce[dragOverIndex].id:null)');
  warns.length=0;run('onCanvasMouseUp('+ev(tx,ty)+');');
  const nodi2=run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))');const ok=run('validateFlow(flow).valid');
  console.log('  '+label+': grab='+dni+' '+(aid!==null?'HIT arc'+aid+'('+cand.type+')':'MISS')+' VE@('+tx+','+ty+') -> '+nodi2+' valid='+ok+(warns.length?' WARN='+JSON.stringify(warns):''));
 };
 run('calcoloY(nodi);draw(nodi);');
 return {run,ins,drag};
}
// STRUTTURA 1
console.log('### while{ while{ assign; print } } — drag su back-edge L del while interno');
let a=makeApp();
a.ins('ff.type==="normal"','while');a.ins('ff.type==="loop_body"','while');a.ins('ff.type==="loop_body"&&ff.fromNodeIndex===2','assign');a.ins('ff.type==="loop_body_end"&&ff.fromNodeIndex===3','print');
console.log('  start:',a.run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))'));
a.drag(3,'frecce.find(function(x){return x.type==="loop_body_end"&&x.fromNodeIndex===4;})','B) assign -> back-edge L (loop_body_end 4->2)');
// STRUTTURA 2
console.log('### for{ if{ assign } } + print — drag print su loop_exit VE');
let b=makeApp();
b.ins('ff.type==="normal"','for');b.ins('ff.type==="loop_body"','if');b.ins('ff.type==="if_true"','assign');b.ins('ff.type==="loop_body_end"','print');
console.log('  start:',b.run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))'));
b.drag(b.run('flow.nodes.findIndex(function(n){return n.type==="print";})'),'frecce.find(function(x){return x.type==="loop_exit";})','C) print -> loop_exit VE');

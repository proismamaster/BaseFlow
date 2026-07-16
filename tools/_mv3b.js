const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
const warns=[];
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:function(){warns.push(Array.prototype.join.call(arguments,' '));}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);
const ins=function(f,t){const ok=run('frecceSelected=frecce.findIndex(function(ff){return '+f+';}); frecceSelected!==-1');if(!ok){console.log('  INS FAIL '+f);return;}run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');
ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','while');ins('ff.type==="loop_body"&&ff.fromNodeIndex===2','while');ins('ff.type==="loop_exit"&&ff.fromNodeIndex===1','assign');
console.log('NODI:',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))'));
const arc2=JSON.parse(run('JSON.stringify((function(){var f=frecce.find(function(a){return a.id===2;});return {inzio:[f.inzioX,f.inzioY],fine:[f.fineX,f.fineY],ve:f.visualExtra||[]};})())'));
console.log('arc2 (loop_body_end 2->1) inzio=',JSON.stringify(arc2.inzio.map(Math.round)),'fine=',JSON.stringify(arc2.fine.map(Math.round)),'VE=',JSON.stringify(arc2.ve.map(s=>s.map(Math.round))));
const ev=function(x,y){return '({clientX:'+x+',clientY:'+y+',pointerId:1,button:0,preventDefault:function(){},stopPropagation:function(){}})';};
function tryDrop(px,py,label){
  // reset drag state
  run('dragNodeIndex=-1;dragOverIndex=-1;isDraggingNode=false;');
  const pn=JSON.parse(run('JSON.stringify((function(){var v=nodi[4];return {x:Math.round(v.relX*w),y:Math.round(v.relY*h)};})())'));
  run('onCanvasMouseDown('+ev(pn.x,pn.y)+');');const grab=run('dragNodeIndex');
  run('onCanvasMouseMove('+ev(px,py)+');');const aid=run('(dragOverIndex>=0?frecce[dragOverIndex].id:null)');
  warns.length=0;run('onCanvasMouseUp('+ev(px,py)+');');
  const nd=run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))');const ok=run('validateFlow(flow).valid');
  console.log('  '+label+' @('+px+','+py+'): grab='+grab+' HITarc='+aid+' -> '+nd+' valid='+ok+(warns.length?' WARN='+JSON.stringify(warns):''));
  // ripristina per il prossimo test
  return {aid,nd};
}
// prova a droppare sul MAIN di arc2
tryDrop(Math.round(arc2.inzio[0]),Math.round((arc2.inzio[1]+arc2.fine[1])/2),'MAIN arc2');

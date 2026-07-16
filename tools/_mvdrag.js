const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const warns=[];
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:function(){warns.push(Array.prototype.join.call(arguments,' '));}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);
for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});
vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);
const ins=function(f,t){const ok=run('frecceSelected=frecce.findIndex(function(ff){return '+f+';}); frecceSelected!==-1');if(!ok){console.log('INS FAIL '+f);return;}run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');
ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','while');ins('ff.type==="loop_body"&&ff.fromNodeIndex===2','assign');ins('ff.type==="loop_body_end"&&ff.fromNodeIndex===3','print');
console.log('NODI prima:',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))'));
const ev=function(x,y){return '({clientX:'+x+',clientY:'+y+',pointerId:1,button:0,preventDefault:function(){},stopPropagation:function(){}})';};
function drag(nodeIdx,candSel,label){
  const pn=JSON.parse(run('JSON.stringify((function(){var v=nodi['+nodeIdx+'];return {x:v.relX*w,y:v.relY*h};})())'));
  const cand=JSON.parse(run('JSON.stringify((function(){var f='+candSel+';return f?{id:f.id,type:f.type,ve:f.visualExtra||[]}:null;})())'));
  if(!cand){console.log(label+': target non trovato');return;}
  const seg=cand.ve[0]||[run('frecce.find(function(f){return f.id==='+cand.id+';}).inzioX'),0,run('frecce.find(function(f){return f.id==='+cand.id+';}).fineX'),0];
  const tx=Math.round((seg[0]+seg[2])/2),ty=Math.round((seg[1]+seg[3])/2);
  run('onCanvasMouseDown('+ev(Math.round(pn.x),Math.round(pn.y))+');');
  const dni=run('dragNodeIndex');
  run('onCanvasMouseMove('+ev(tx,ty)+');');
  const doi=run('dragOverIndex'),aid=run('(dragOverIndex>=0?frecce[dragOverIndex].id:null)');
  warns.length=0;run('onCanvasMouseUp('+ev(tx,ty)+');');
  const nodi2=run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))');
  const ok=run('validateFlow(flow).valid');
  console.log(label+': grab='+dni+' targetArc='+aid+' (VE@'+tx+','+ty+')  ->  '+nodi2+'  valid='+ok+(warns.length?'  WARN='+JSON.stringify(warns):''));
}
// A) sposta print(4) sulla piega VE dello stub d'ingresso del while interno (loop_body 2->3) = primo nel corpo
drag(4,'frecce.find(function(a){return a.type==="loop_body"&&a.fromNodeIndex===2;})','A) print -> primo nel while interno (VE stub ingresso)');

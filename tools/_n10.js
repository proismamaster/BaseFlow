const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,disabled:false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},error:function(){},warn:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},prompt:function(){return '1';},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);
// flusso semplice: start -> print("ok") -> end (nessun input/eval)
run('frecceSelected=frecce.findIndex(function(ff){return ff.type==="normal";}); inserisciNodo("print"); calcoloY(nodi); draw(nodi);');
run('var _pi=flow.nodes.findIndex(function(n){return n.type==="print";}); if(_pi>=0) flow.nodes[_pi].info="\\"ok\\"";');
run('runSpeed=350; currentNode=null;');
run('globalThis.__animCalls=0; var __origAnim=animateExecEdge; animateExecEdge=async function(){__animCalls++; return __origAnim.apply(this,arguments);};');
(async()=>{
 try{
  for(let i=0;i<3;i++){ await run('(async()=>{ try{ await executeStep(); }catch(e){ globalThis.__err=String(e&&e.stack||e);} })()'); }
 }catch(e){ console.log('THROW:', e && (e.stack||e.message)); }
 console.log('err interno:', run('globalThis.__err||"nessuno"'));
 console.log('animateExecEdge chiamata durante gli Step:', run('__animCalls'), '(atteso 0)');
 console.log('executingEdge dopo Step:', run('JSON.stringify(executingEdge)'), '(atteso null)');
 console.log('executingNodeIndex dopo Step:', run('executingNodeIndex'));
 console.log('currentNode:', run('String(currentNode)'));
})();

const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,disabled:false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
let msgs=[];
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},error:function(){},warn:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},prompt:function(){return '7';},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);
run('flow.variables=[{name:"x",type:"int",value:0,uninit:true},{name:"y",type:"int",value:0}];');
run('frecceSelected=frecce.findIndex(function(ff){return ff.type==="normal";}); inserisciNodo("assign"); calcoloY(nodi); draw(nodi);');
run('var _ai=flow.nodes.findIndex(function(n){return n.type==="assign";}); flow.nodes[_ai].info="y = x + 1";');
run('currentNode=null; _runtimeVars=null;');
(async()=>{
 for(let s=1;s<=3;s++){
   await run('(async()=>{try{await executeStep();}catch(e){globalThis.__err=String(e&&e.stack||e);}})()');
   console.log('dopo step'+s+': currentNode='+run('String(currentNode)')+' rtVars='+run('JSON.stringify(_runtimeVars)')+' stop='+run('String(stopRequested)'));
 }
 console.log('throwInterno:', run('globalThis.__err||"no"'));
 // prova diretta: esiste _varValueForExpr e cosa dà per x uninit?
 console.log('_varValueForExpr({value:0,uninit:true}) =', run('_varValueForExpr({name:"x",type:"int",value:0,uninit:true})'));
})();

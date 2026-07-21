const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1000,H=1000;
const errs=[];
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},style:{}};
const consoleOut={appendChild:(el)=>{ if(el&&el.textContent) errs.push(el.textContent); },scrollTop:0,scrollHeight:0,style:{}};
const gg=()=>{const o={appendChild:function(){},addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',innerHTML:'',textContent:'',dataset:{},rows:[],cells:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,disabled:false};o.querySelector=()=>gg();o.querySelectorAll=()=>[];return o;};
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='console-output'?consoleOut:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},error:function(){},warn:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},prompt:function(){return '1';},location:{},matchMedia:function(){return {matches:false};},errMsg:function(k,p){return k+' '+JSON.stringify(p||{});},i18nText:function(){return null;},i18nFormat:function(){return null;}};
vm.createContext(ctx);for(const n of ['theme','state','safeEval','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);
run('try{printMessage=function(){};}catch(e){}');
run('executingNodeIndex=-1;');
// i dichiarata SENZA valore (uninit), for che la inizializza
run('globalThis.__V=[{name:"i",type:"int",value:0,uninit:true}];');
const forNode='{type:"for",info:"i = 0; i < 3; i = i + 1",next:{true:"2",false:"3"},_forInitialized:false}';
(async()=>{
 errs.length=0;
 // 1a chiamata: init + prima valutazione condizione
 const r=await run('(async()=>{try{ globalThis.__F='+forNode+'; return await executeNode(__F,"1",__V,null);}catch(e){return "THROW:"+(e&&e.message);}})()');
 console.log('for init+condizione (i uninit): ret='+JSON.stringify(r));
 console.log('  i dopo init:', run('JSON.stringify(__V.find(v=>v.name==="i"))'));
 console.log('  errori generati:', JSON.stringify(errs));
 const hasUninitErr = errs.some(e=>/uninit/i.test(e));
 console.log('  -> err_uninit_var sollevato?', hasUninitErr, hasUninitErr?' <== REGRESSIONE!':' (ok, nessun errore uninit)');
})().catch(e=>console.log('OUTER',e&&e.message));

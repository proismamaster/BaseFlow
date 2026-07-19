const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const styleMock=()=>({setProperty:function(){},removeProperty:function(){},getPropertyValue:function(){return '';}});
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},style:styleMock(),offsetWidth:W,offsetHeight:H};
// righe finte del terminale con key/params salvati
function pMock(key,params){let tc='';return {getAttribute:function(n){return n==='data-run-key'?key:(n==='data-run-params'?params:null);},setAttribute:function(){},get textContent(){return tc;},set textContent(v){tc=v;}};}
const rows=[pMock('run_if_res','{"c":"i>0","res":true}'),pMock('run_while','{"c":"i%2==0"}'),pMock('run_do_res','{"c":"true","res":false}'),pMock('exec_paused','{}'),pMock('nd_start','{}')];
const consoleOut={querySelectorAll:function(sel){return rows;},appendChild:function(){},scrollTop:0,scrollHeight:0,style:styleMock()};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:styleMock(),value:'',querySelector:()=>gg(),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,offsetWidth:W,offsetHeight:H,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H,right:W,bottom:H})});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='console-output'?consoleOut:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0,style:styleMock()}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:{style:styleMock(),classList:{toggle:()=>{},add:()=>{},remove:()=>{}},setAttribute:()=>{}}};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},warn:function(){},error:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:()=>0,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','i18n','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});try{vm.runInContext('window.onload();',ctx);}catch(e){}
const run=c=>vm.runInContext(c,ctx);
for(const L of ['it','en','ar']){
 run('currentLang="'+L+'"; retranslateConsole();');
 console.log('['+L+']');
 rows.forEach(function(r){ console.log('   '+r.textContent); });
}

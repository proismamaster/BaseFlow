const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1000,H=1000;
const styleMock=()=>({setProperty:function(){},removeProperty:function(){},getPropertyValue:function(){return '';}});
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},style:styleMock(),offsetWidth:W,offsetHeight:H};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:styleMock(),value:'',querySelector:()=>gg(),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,offsetWidth:W,offsetHeight:H,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H,right:W,bottom:H})});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0,style:styleMock()}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:{style:styleMock(),classList:{toggle:()=>{},add:()=>{},remove:()=>{}},setAttribute:()=>{}}};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},warn:function(){},error:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:()=>0,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});try{vm.runInContext('window.onload();',ctx);}catch(e){}
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run('frecceSelected=frecce.findIndex(function(ff){return '+f+';});');run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','assign');
run('_execBranch=null;');
function dump(fr,to,label){
 const segs=JSON.parse(run('JSON.stringify(computeEdgeGroups('+fr+','+to+',null,true).map(function(g){return g.segs.map(function(s){return {seg:Math.round(s.x1)+","+Math.round(s.y1)+"->"+Math.round(s.x2)+","+Math.round(s.y2), a:!!s.a};});}))'));
 console.log('### '+label+':');
 segs.forEach(function(grp,gi){ grp.forEach(function(s,i){ console.log('  g'+gi+' s'+i+') '+s.seg+(s.a?'  <== ARROWHEAD'+(i===grp.length-1?' (ULTIMO=ok)':' (NON ultimo!)'):''));}); });
}
dump(2,1,'ritorno assign(2)->while(1) [back-edge]');
dump(1,2,'ingresso while(1)->assign(2)');

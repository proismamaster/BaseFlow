const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},style:{}};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},error:function(){},warn:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run('frecceSelected=frecce.findIndex(function(ff){return '+f+';});');run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','assign');
run('_execBranch="true";');
const CUR=run('JSON.stringify(computeEdgeGroups(1,2,"true",true)[0].segs.map(function(s){return Math.round(s.x1)+","+Math.round(s.y1)+"->"+Math.round(s.x2)+","+Math.round(s.y2);}))');
// executingEdge con litGroup STANTIO/finto + _grp corretto
run('executingEdge={from:1,to:2,branch:"true",litGroup:[{x1:-99,y1:-99,x2:-99,y2:-99,a:false}],_grp:{from:1,to:2,branch:"true",showRis:true,gi:0}}; executingNodeIndex=-1;');
console.log('litGroup STANTIO prima:', run('JSON.stringify(executingEdge.litGroup.map(function(s){return s.x1+","+s.y1+"->"+s.x2+","+s.y2;}))'));
run('refreshExecEdgeGeometry();');
const AFT=run('JSON.stringify(executingEdge.litGroup.map(function(s){return Math.round(s.x1)+","+Math.round(s.y1)+"->"+Math.round(s.x2)+","+Math.round(s.y2);}))');
console.log('litGroup dopo refresh:  ', AFT);
console.log('geometria corrente:     ', CUR);
console.log('\n-> ricalcolato dalla geometria corrente (non piu stantio):', AFT===CUR);
// guardia: senza _grp non fa nulla
run('executingEdge={from:1,to:2,branch:"true",litGroup:[{x1:7,y1:7,x2:7,y2:7}]}; refreshExecEdgeGeometry();');
console.log('-> senza _grp non tocca il litGroup (guardia):', run('executingEdge.litGroup[0].x1===7'));

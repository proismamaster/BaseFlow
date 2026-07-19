const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},style:{}};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},error:function(){},warn:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run('frecceSelected=frecce.findIndex(function(ff){return '+f+';});');run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','assign'); // while(1){assign(2)}
run('_execBranch="true";');
// accendi la transizione while(1)->assign(2) come fa animateExecEdge (con _grp)
run('(function(){var g=computeEdgeGroups(1,2,"true",true); executingEdge={from:1,to:2,branch:"true",litGroup:g[0].segs,_grp:{from:1,to:2,branch:"true",showRis:true,gi:0}}; executingNodeIndex=-1;})();');
const OLD=run('JSON.stringify(executingEdge.litGroup.map(function(s){return Math.round(s.x1)+","+Math.round(s.y1)+"->"+Math.round(s.x2)+","+Math.round(s.y2);}))');
console.log('litGroup PRIMA (layout originale):', OLD);
// SIMULA RESIZE: sposto i nodi (relX ridotta) e ridisegno
run('nodi.forEach(function(v){ v.relX = v.relX*0.6 + 0.05; }); draw(nodi);');
const NEW=run('JSON.stringify(executingEdge.litGroup.map(function(s){return Math.round(s.x1)+","+Math.round(s.y1)+"->"+Math.round(s.x2)+","+Math.round(s.y2);}))');
console.log('litGroup DOPO resize+draw:       ', NEW);
// atteso: la geometria del gruppo CORRENTE dopo lo spostamento
const CUR=run('JSON.stringify(computeEdgeGroups(1,2,"true",true)[0].segs.map(function(s){return Math.round(s.x1)+","+Math.round(s.y1)+"->"+Math.round(s.x2)+","+Math.round(s.y2);}))');
console.log('geometria CORRENTE attesa:        ', CUR);
console.log('\n-> highlight SEGUE il resize (NEW != OLD):', NEW!==OLD);
console.log('-> NEW == geometria corrente:', NEW===CUR);

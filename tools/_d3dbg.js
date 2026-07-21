const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1000,H=1000;
let rec=[]; let cur={x:0,y:0}; let last=null;
const styleMock=()=>({setProperty:function(){},removeProperty:function(){},getPropertyValue:function(){return '';}});
const ctxMock={_ss:'#000',_fs:'#000',get strokeStyle(){return this._ss;},set strokeStyle(v){this._ss=v;},get fillStyle(){return this._fs;},set fillStyle(v){this._fs=v;},lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){last=null;},moveTo(x,y){cur={x:x,y:y};last={x:x,y:y};},lineTo(x,y){if(last)rec.push({t:'line',c:this._ss,a:[Math.round(last.x),Math.round(last.y)],b:[Math.round(x),Math.round(y)]});last={x:x,y:y};cur={x:x,y:y};},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){rec.push({t:'arrow',c:this._fs});},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},style:styleMock(),offsetWidth:W,offsetHeight:H};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:styleMock(),value:'',querySelector:()=>gg(),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false,offsetWidth:W,offsetHeight:H,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H,right:W,bottom:H})});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0,style:styleMock()}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:{style:styleMock(),classList:{toggle:()=>{},add:()=>{},remove:()=>{}},setAttribute:()=>{}}};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:function(){},warn:function(){},error:function(){}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:()=>0,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});try{vm.runInContext('window.onload();',ctx);}catch(e){}
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run('frecceSelected=frecce.findIndex(function(ff){return '+f+';});');run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','assign');
// accendi il ritorno assign(2)->while(1)
run('_execBranch=null; (function(){var g=computeEdgeGroups(2,1,null,true); executingEdge={from:2,to:1,branch:null,litGroup:g[0].segs,_grp:{from:2,to:1,branch:null,showRis:true,gi:0}}; executingNodeIndex=-1;})();');
const col=run('(typeof cssVar==="function"?cssVar("--exec-edge-color","#ff9800"):"#ff9800")');
const blk=run('themeCanvasLineColor()');
rec=[]; run('draw(nodi);');
// segmenti NERI (arco normale) e ARANCIONI (highlight)
const black=rec.filter(function(r){return r.t==="line" && r.c!==null && String(r.c)!==String(col);});
const orange=rec.filter(function(r){return r.t==="line" && String(r.c)===String(col);});
console.log('col exec=',col,' black=',blk);
console.log('\n--- SEGMENTI NERI (arco normale) vicino all header while(1) ---');
black.forEach(function(r){ console.log('  '+r.a+'->'+r.b+'  ['+r.c+']'); });
console.log('\n--- SEGMENTI ARANCIONI (highlight) ---');
orange.forEach(function(r){ console.log('  '+r.a+'->'+r.b); });
console.log('\n--- ARROWHEADS (fill) ---'); rec.filter(function(r){return r.t==="arrow";}).forEach(function(r){console.log('  fill '+r.c);});

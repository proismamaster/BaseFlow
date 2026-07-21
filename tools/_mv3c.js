const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:gg()};
const warns=[];
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:function(){warns.push(Array.prototype.join.call(arguments,' '));}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);
const ins=function(f,t){run('frecceSelected=frecce.findIndex(function(ff){return '+f+';});');run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');
ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','while');ins('ff.type==="loop_body"&&ff.fromNodeIndex===2','while');ins('ff.type==="loop_exit"&&ff.fromNodeIndex===1','assign');
console.log('PRIMA:',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type+" next="+JSON.stringify(n.next);}))'));
// disattiva il guard: forziamo validateFlow a dire sempre valid, per vedere il grafo grezzo prodotto da moveNode
run('validateFlow=function(){return {valid:true,errors:[]};};');
// moveNode(4, id=2)
run('moveNode(4,2);');
console.log('DOPO (grezzo, guard OFF):',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type+" next="+JSON.stringify(n.next);}))'));
console.log('\nATTESO: while1{true:2,false:5} while2{true:3,false:4} while3{true:3,false:2} assign4->1  (sottoalbero while1 = {2,3,4} contiguo)');

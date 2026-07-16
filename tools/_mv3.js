const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},setPointerCapture:()=>{},releasePointerCapture:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const warns=[];
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:function(){warns.push(Array.prototype.join.call(arguments,' '));}},Math:Math,JSON:JSON,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,Set:Set,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Promise:Promise,setTimeout:setTimeout,eval:eval,alert:function(){},confirm:function(){return true;},location:{},matchMedia:function(){return {matches:false};}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);
const ins=function(f,t){const ok=run('frecceSelected=frecce.findIndex(function(ff){return '+f+';}); frecceSelected!==-1');if(!ok){console.log('  INS FAIL '+f);return;}run('inserisciNodo('+JSON.stringify(t)+');');run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');
// while1{ while2{ while3{ } } } + un assign dopo tutto (in main) da trascinare
ins('ff.type==="normal"','while');            // while1 @1
ins('ff.type==="loop_body"','while');         // while2 @2 (dentro while1)
ins('ff.type==="loop_body"&&ff.fromNodeIndex===2','while'); // while3 @3 (dentro while2)
ins('ff.type==="loop_exit"&&ff.fromNodeIndex===1','assign'); // assign dopo while1 (main)
console.log('NODI:',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type+" next="+JSON.stringify(n.next);}))'));
console.log('\nTUTTI GLI ARCHI:');
const arcs=JSON.parse(run('JSON.stringify(frecce.map(function(f){return {id:f.id,type:f.type,from:f.fromNodeIndex,to:f.toNodeIndex,inzio:[Math.round(f.inzioX),Math.round(f.inzioY)],fine:[Math.round(f.fineX),Math.round(f.fineY)],hasVE:!!(f.visualExtra&&f.visualExtra.length)};}))'));
for(const a of arcs)console.log('  id='+a.id+' '+a.type+' '+a.from+'->'+a.to+' inzio='+JSON.stringify(a.inzio)+' fine='+JSON.stringify(a.fine)+(a.hasVE?' [VE]':''));
// "arco dopo il primo figlio (while2) nel corpo di while1" = il ritorno dal sottoalbero di while2 verso while1 (loop_body_end from=1? o il back-edge condiviso)
console.log('\nArchi loop_body_end (ritorni ai cicli):');
for(const a of arcs.filter(a=>a.type==='loop_body_end'))console.log('  id='+a.id+' from='+a.from+' to='+a.to);

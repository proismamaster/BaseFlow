const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const warns=[];
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:(...a)=>warns.push(a.join(' '))},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{const ok=run(`frecceSelected=frecce.findIndex(ff=>${f}); frecceSelected!==-1`);if(!ok){console.log('INS FAIL:'+f);return;}run(`inserisciNodo(${JSON.stringify(t)});`);run('draw(nodi);');};
run('draw(nodi);');ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','while');ins('ff.type==="loop_body"&&ff.fromNodeIndex===2','assign');ins('ff.type==="loop_body_end"&&ff.fromNodeIndex===3','print');
console.log('NODI:',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type+" next="+JSON.stringify(n.next);}))'));
// sposta print(4) sull'arco loop_body 2->3 (primo nel corpo del while interno)
const tid=run('(frecce.find(function(f){return f.type==="loop_body"&&f.fromNodeIndex===2;})||{}).id');
warns.length=0; run('moveNode(4,'+tid+');');
console.log('DOPO move print(4) su loop_body(2->3) id='+tid+':',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))'));
console.log('WARN:',JSON.stringify(warns));

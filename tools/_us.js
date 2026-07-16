const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run(`frecceSelected=frecce.findIndex(ff=>${f});`);run(`inserisciNodo(${JSON.stringify(t)});`);run('draw(nodi);');};
run('draw(nodi);');
ins('ff.type==="normal"','if'); ins('ff.type==="if_true"&&ff.fromNodeIndex===1','if'); ins('ff.type==="if_true"&&ff.fromNodeIndex===2','if');
ins('ff.type==="if_join"&&ff.fromNodeIndex===3','output'); // Uscita dopo if3
console.log('NODI:',run('JSON.stringify(flow.nodes.map(function(n,i){return {i:i,t:n.type,next:n.next};}))'));
console.log('ARCHI(uscita e join):',run('JSON.stringify(frecce.filter(function(f){return f.toNodeIndex===5||f.fromNodeIndex===4;}).map(function(f){return {t:f.type,from:f.fromNodeIndex,to:f.toNodeIndex};}))'));
console.log('\nUscita(4)->Fine(5) gruppi:',run('JSON.stringify(computeEdgeGroups(4,5,null).map(function(x){return {t:x.type,from:x.from};}))'));
console.log('path completo:',run('JSON.stringify(computeEdgePath(4,5,null).map(function(s){return "("+s.x1+","+s.y1+")->("+s.x2+","+s.y2+")";}))'));

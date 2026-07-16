const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run(`frecceSelected=frecce.findIndex(ff=>${f});`);run(`inserisciNodo(${JSON.stringify(t)});`);run('draw(nodi);');};
run('draw(nodi);');ins('ff.type==="normal"','do');ins('ff.type==="loop_body"','print');
console.log('NODI:',run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type})))'));
// D1: prima visita (da start=0, fuori corpo) vs successiva (da print=2)
console.log('D1 prima-visita (do da start):', run('_isFirstVisitDo(1,"0")'),' (atteso true)');
console.log('D1 visita-succ (do da print):', run('_isFirstVisitDo(1,"2")'),' (atteso false)');
run('executingNodeIndex=99; _highlightExecNodeSafe(1,"0");'); console.log('  _highlightExecNodeSafe(do,start) -> executingNodeIndex=',run('executingNodeIndex'),'(atteso -1: esagono saltato)');
run('executingNodeIndex=99; _highlightExecNodeSafe(1,"2");'); console.log('  _highlightExecNodeSafe(do,print) -> executingNodeIndex=',run('executingNodeIndex'),'(atteso 1: esagono mostrato)');
// D2: ordine del path do(1)->print(2): primo tratto deve essere la RISALITA (parte a sinistra dell'esagono)
const p=JSON.parse(run('JSON.stringify(computeEdgePath(1,2,"true"))'));
console.log('D2 path do->print (primi 2 tratti):', JSON.stringify(p.slice(0,2).map(s=>`(${s.x1},${s.y1})->(${s.x2},${s.y2})`)));
const doCx=run('Math.round(nodi[1].relX*w)'); console.log('  esagono cx=',doCx,' -> il primo tratto deve partire a SINISTRA di cx (risalita), non da cx (discesa)');

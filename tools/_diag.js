const fs=require('fs'),vm=require('vm'),path=require('path');
const REPO=path.join(__dirname,'..','app'); const W=1000,H=1000; let strokes=[];
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',_path:[],beginPath(){this._path=[];},moveTo(x,y){this._path.push(['M',x,y]);},lineTo(x,y){this._path.push(['L',x,y]);},quadraticCurveTo(){},rect(){},closePath(){},stroke(){for(let i=1;i<this._path.length;i++){const a=this._path[i-1],b=this._path[i];if(b[0]==='L')strokes.push({x1:Math.round(a[1]),y1:Math.round(a[2]),x2:Math.round(b[1]),y2:Math.round(b[2]),c:(''+this.strokeStyle).toLowerCase()});}},fill(){},clearRect(){strokes=[];},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(ctx);
for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});
vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'),ctx,{filename:'execute.js'});
vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);
const ins=(f,t)=>{run(`frecceSelected=frecce.findIndex(ff=>${f});`);run(`inserisciNodo(${JSON.stringify(t)});`);run('draw(nodi);');};
function arcs(){return JSON.parse(run('JSON.stringify(frecce.map(f=>({t:f.type,from:f.fromNodeIndex,to:f.toNodeIndex,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)})))'));}
function nodes(){return JSON.parse(run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type})))'));}
function cap(from,to,branch,phase){strokes.length=0;run(`_execBranch=${JSON.stringify(branch)}; highlightExecEdge(${from},${to}${phase?','+JSON.stringify(phase):''});`);return strokes.filter(s=>s.c==='#ff9800').map(s=>`(${s.x1},${s.y1})->(${s.x2},${s.y2})`);}

console.log('==== CASO A: while { assign } ====');
run('draw(nodi);'); ins('ff.type==="normal"','while'); ins('ff.type==="loop_body"','assign');
console.log('nodi:',JSON.stringify(nodes()));
console.log('archi:',JSON.stringify(arcs()));
console.log('transizione assign(2)->while(1) [ritorno, branch null]:');
console.log('  FULL:',JSON.stringify(cap(2,1,null,null)));
console.log('  OUT :',JSON.stringify(cap(2,1,null,'out')));
console.log('  BACK:',JSON.stringify(cap(2,1,null,'back')));

console.log('\n==== CASO B: for { if { while { assign } } }  (erroe1.json) ====');
vm.runInContext('window.onload();',ctx); run('draw(nodi);');
ins('ff.type==="normal"','for'); ins('ff.type==="loop_body"','if'); ins('ff.type==="if_true"&&ff.fromNodeIndex===2','while'); ins('ff.type==="loop_body"&&ff.fromNodeIndex===3','assign');
console.log('nodi:',JSON.stringify(nodes()));
console.log('archi:',JSON.stringify(arcs()));
const back=[[2,1,'false','if(2)->for(1) [if.false, back-edge del for]'],[3,1,'false','while(3)->for(1) [while.false]'],[4,3,'true','assign(4)->while(3) [ritorno while]']];
for(const [f,t,b,lab] of back){ console.log('\n'+lab+':'); console.log('  FULL:',JSON.stringify(cap(f,t,b,null))); }

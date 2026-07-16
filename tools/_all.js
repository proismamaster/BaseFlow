const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run(`frecceSelected=frecce.findIndex(ff=>${f});`);run(`inserisciNodo(${JSON.stringify(t)});`);run('draw(nodi);');};
// JSON
const J=fs.readFileSync('/sessions/trusting-amazing-davinci/mnt/uploads/asdasdasdasds.json','utf8');
run('flow = '+J+'; nodi=[]; for(let i=0;i<flow.nodes.length;i++){ nodi.push({relX:0.35,relY:0.05+i*0.1,width:100,height:NODE_BASE_HEIGHT_PX,color:"white",text:flow.nodes[i].type}); } draw(nodi);');
console.log('JSON print(9)->while(4):',run('JSON.stringify(computeEdgeGroups(9,4,null).map(function(x){return x.type;}))'));
const p=JSON.parse(run('JSON.stringify(computeEdgePath(9,4,null))'));
// connesso?
let conn=true; for(let i=0;i<p.length-1;i++){ if(Math.abs(p[i].x2-p[i+1].x1)>10||Math.abs(p[i].y2-p[i+1].y1)>10) conn=false; }
console.log('  path connesso?',conn,' n.segmenti:',p.length,' arriva a while(4)?',p.length&&Math.abs(p[p.length-1].y2-Math.round(run('nodi[4].relY*h')))<50);
// erroe1
vm.runInContext('window.onload();',ctx);run('draw(nodi);');ins('ff.type==="normal"','for');ins('ff.type==="loop_body"','if');ins('ff.type==="if_true"&&ff.fromNodeIndex===2','while');ins('ff.type==="loop_body"&&ff.fromNodeIndex===3','assign');
console.log('erroe1 while(3).false->for(1):',run('JSON.stringify(computeEdgeGroups(3,1,"false").map(function(x){return x.type;}))'));

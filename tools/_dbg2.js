const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run(`frecceSelected=frecce.findIndex(ff=>${f});`);run(`inserisciNodo(${JSON.stringify(t)});`);run('draw(nodi);');};
run('draw(nodi);');ins('ff.type==="normal"','if');ins('ff.type==="if_true"&&ff.fromNodeIndex===1','if');ins('ff.type==="if_true"&&ff.fromNodeIndex===2','if');ins('ff.type==="if_join"&&ff.fromNodeIndex===3','output');
// tutti i segmenti (escl arco 4->5), coi loro estremi
const dbg = run(`(function(){
  var excl=frecce.find(function(f){return f.fromNodeIndex===4&&f.toNodeIndex===5;}).id;
  var segs=[];
  frecce.forEach(function(f){ var aid=f.id; if(aid===excl)return; _segsOfArc(f).forEach(function(s){segs.push([s.x1,s.y1,s.x2,s.y2,f.type,f.fromNodeIndex]);}); });
  return JSON.stringify(segs.filter(function(s){ return (Math.abs(s[1]-442)<30||Math.abs(s[3]-442)<30||Math.abs(s[1]-464)<30||Math.abs(s[3]-464)<30) && s[0]<600 && s[2]<600; }));
})()`);
console.log('segmenti vicini al percorso (x<600, y~442/464):');
JSON.parse(dbg).forEach(s=>console.log('  ('+s[0]+','+s[1]+')->('+s[2]+','+s[3]+')  '+s[4]+' from='+s[5]));

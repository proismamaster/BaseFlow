const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0,width:W,height:H}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{},matchMedia:()=>({matches:false})};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{const ok=run(`frecceSelected=frecce.findIndex(ff=>${f}); frecceSelected!==-1`);if(!ok){console.log('INS FAIL '+f);return;}run(`inserisciNodo(${JSON.stringify(t)});`);run('calcoloY(nodi);draw(nodi);');};
run('calcoloY(nodi);draw(nodi);');
ins('ff.type==="normal"','while');ins('ff.type==="loop_body"','while');ins('ff.type==="loop_body"&&ff.fromNodeIndex===2','assign');ins('ff.type==="loop_body_end"&&ff.fromNodeIndex===3','print');
console.log('NODI:',run('JSON.stringify(flow.nodes.map(function(n,i){return i+":"+n.type;}))'));
const arcs=JSON.parse(run('JSON.stringify(frecce.map(function(f){return {id:f.id,type:f.type,from:f.fromNodeIndex,to:f.toNodeIndex,inzio:[Math.round(f.inzioX),Math.round(f.inzioY)],fine:[Math.round(f.fineX),Math.round(f.fineY)],hasVE:!!(f.visualExtra&&f.visualExtra.length),ve:(f.visualExtra||[]).map(function(s){return [Math.round(s[0]),Math.round(s[1]),Math.round(s[2]),Math.round(s[3])];})};}))'));
for(const a of arcs){if(a.hasVE){console.log('ARC id='+a.id+' '+a.type+' '+a.from+'->'+a.to+' inzio='+JSON.stringify(a.inzio)+' fine='+JSON.stringify(a.fine)+' VE='+JSON.stringify(a.ve));}}
let fails=0,fixed=0;
for(const cand of arcs.filter(a=>a.hasVE)){
  for(const seg of cand.ve){
    const mx=Math.round((seg[0]+seg[2])/2),my=Math.round((seg[1]+seg[3])/2);
    const old=run(`isPointNearAnyLineSegment(${mx},${my},${cand.inzio[0]},${cand.inzio[1]},${cand.fine[0]},${cand.fine[1]},14)`);
    const neu=run(`arcHitTest(frecce.find(function(f){return f.id===${cand.id};}),${mx},${my},14)`);
    const tag=(!old&&neu)?'  <-- VECCHIO MANCA, NUOVO TROVA':'';
    if(!old&&neu){fails++;fixed++;}
    console.log('  arc'+cand.id+'('+cand.type+') pt('+mx+','+my+') vecchio='+old+' nuovo='+neu+tag);
  }
}
console.log('\nSEGMENTI VE mancati dal vecchio hit-test ma trovati da arcHitTest: '+fixed);

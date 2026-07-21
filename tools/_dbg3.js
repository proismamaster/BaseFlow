const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..','app');const W=1000,H=1000;
const ctxMock={strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){}};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const g=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,hasAttribute:()=>false});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener:()=>{},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g()};
const ctx={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(ctx);for(const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init'])vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});vm.runInContext('window.onload();',ctx);
const run=c=>vm.runInContext(c,ctx);const ins=(f,t)=>{run(`frecceSelected=frecce.findIndex(ff=>${f});`);run(`inserisciNodo(${JSON.stringify(t)});`);run('draw(nodi);');};
run('draw(nodi);');ins('ff.type==="normal"','if');ins('ff.type==="if_true"&&ff.fromNodeIndex===1','if');ins('ff.type==="if_true"&&ff.fromNodeIndex===2','if');ins('ff.type==="if_join"&&ff.fromNodeIndex===3','output');
const out=run(`(function(){
  var startPt=[503,442], goalPt=[268,492], TOL=8;
  var excl=new Set([frecce.find(function(f){return f.fromNodeIndex===4&&f.toNodeIndex===5;}).id]);
  var segs=[]; frecce.forEach(function(f){ var aid=f.id; if(excl.has(aid))return; _segsOfArc(f).forEach(function(s){segs.push({x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,a:s.a,arcId:aid});}); });
  var pts=[]; function nodeId(x,y){for(var i=0;i<pts.length;i++)if(Math.abs(pts[i].x-x)<=TOL&&Math.abs(pts[i].y-y)<=TOL)return i; pts.push({x:x,y:y}); return pts.length-1;}
  var adj={}; segs.forEach(function(s){var a=nodeId(s.x1,s.y1),b=nodeId(s.x2,s.y2); if(a===b)return; (adj[a]=adj[a]||[]).push({to:b,seg:s,dir:1});(adj[b]=adj[b]||[]).push({to:a,seg:s,dir:-1});});
  function nearest(pt){var bi=-1,bd=1e9;for(var i=0;i<pts.length;i++){var d=Math.abs(pts[i].x-pt[0])+Math.abs(pts[i].y-pt[1]);if(d<bd){bd=d;bi=i;}}return bi;}
  var start=nearest(startPt), goal=nearest(goalPt);
  var prev={}, seen={}; seen[start]=1; var q=[start]; var reached=false;
  while(q.length){var u=q.shift(); if(u===goal){reached=true;break;} (adj[u]||[]).forEach(function(e){ if(seen[e.to])return; seen[e.to]=1; prev[e.to]={from:u,edge:e}; q.push(e.to); });}
  return JSON.stringify({nPts:pts.length,start:start,startPt:pts[start],goal:goal,goalPt:pts[goal],reached:reached, adjStart:(adj[start]||[]).map(function(e){return e.to;}), adjGoal:(adj[goal]||[]).map(function(e){return e.to;})});
})()`);
console.log(out);

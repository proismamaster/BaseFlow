// Headless reproduction harness for the 7 resize/propagation layout bugs.
// Builds each topology via the real inserisciNodo() UI path, sets long text on
// specific nodes, re-runs calcoloY()+draw(), then measures:
//   - arc segments that cross the interior of a foreign node box (overlap)
//   - node-node box overlaps
//   - backward-pointing structural arcs (if_join/loop arcs drawn upward)
const fs = require('fs'); const vm = require('vm');
const REPO = __dirname + '/..';
const W = 1400, H = 2000;
let ops = [];
function col(c){ if(!c || typeof c!=='string' || c.startsWith('var(')) return '#000'; return c; }
const ctxMock = {
  fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'', textAlign:'center', textBaseline:'middle',
  _path: [],
  save(){}, restore(){}, setLineDash(){}, arc(){},
  beginPath(){ this._path=[]; },
  moveTo(x,y){ this._path.push(['M',x,y]); },
  lineTo(x,y){ this._path.push(['L',x,y]); },
  quadraticCurveTo(cx,cy,x,y){ this._path.push(['L',x,y]); },
  rect(x,y,w,h){ this._path.push(['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']); },
  closePath(){ this._path.push(['Z']); },
  stroke(){ if(this._path.length) ops.push({t:'stroke', d:[...this._path]}); },
  fill(){ },
  clearRect(){ ops=[]; },
  fillText(){ },
  measureText(t){ return {width: (t||'').length*8}; }
};
const canvasMock={width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener:()=>{},style:{}};
const genericEl=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild:()=>{},removeChild:()=>{},remove:()=>{},setAttribute:()=>{},removeAttribute:()=>{},getAttribute:()=>null,innerHTML:'',textContent:'',dataset:{},rows:[],getBoundingClientRect:()=>({width:0,height:0,left:0,top:0})});
const documentMock={getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener:()=>{},scrollLeft:0,scrollTop:0,clientWidth:W,clientHeight:H}:id==='tabVariabili'?{rows:[]}:genericEl(),addEventListener:()=>{},createElement:()=>genericEl(),querySelector:()=>genericEl(),querySelectorAll:()=>[],body:genericEl(),documentElement:{getAttribute:()=>null,style:{setProperty:()=>{}}}};
const context={document:documentMock,window:{addEventListener:()=>{},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener:()=>{}})},localStorage:{getItem:()=>null,setItem:()=>{}},MutationObserver:function(){this.observe=()=>{}},console:{log:()=>{},error:()=>{},warn:()=>{}},getComputedStyle:()=>({getPropertyValue:()=>''}),Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert:()=>{},confirm:()=>true,location:{}};
vm.createContext(context);
for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) {
  vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n+'.js'});
}
vm.runInContext('window.onload();', context);

const run = (code) => vm.runInContext(code, context);
function reset(){ run('flow={nodes:[{type:"start",next:"1"},{type:"end",next:null}]}; nodi=[]; state={nodi:[]}; calcoloY&&0; frecce=[];');
  // rebuild visual array from scratch using the app's own loader path
  run('nodi=[{text:"Start",color:"#7ed957",width:100,height:40},{text:"End",color:"#e63946",width:100,height:40}]; calcoloY(nodi); draw(nodi);');
}
function ins(filter, tipo){
  const idx = run(`frecce.findIndex(f=>${filter})`);
  if (idx === -1) { throw new Error('NO ARC for '+tipo+' filter='+filter); }
  run(`frecceSelected=${idx}; inserisciNodo("${tipo}");`);
}
function setInfo(i, text){ run(`flow.nodes[${i}].info=${JSON.stringify(text)};`); }
function redraw(){ run('calcoloY(nodi); draw(nodi);'); }

// ---- measurement ----
function nodeBoxes(){
  return run(`nodi.map((v,i)=>({i,t:flow.nodes[i]&&flow.nodes[i].type,cx:v.relX*w,cy:v.relY*h,w:v.width,h:v.height,left:v.relX*w-v.width/2,right:v.relX*w+v.width/2,top:v.relY*h-v.height/2,bot:v.relY*h+v.height/2}))`);
}
function segments(){
  // decompose recorded stroke ops into line segments
  const out=[];
  for(const o of ops){ if(o.t!=='stroke') continue; let px=null,py=null;
    for(const s of o.d){ if(s[0]==='M'){px=s[1];py=s[2];} else if(s[0]==='L'){ if(px!==null) out.push([px,py,s[1],s[2]]); px=s[1];py=s[2]; } else if(s[0]==='Z'){ } }
  }
  return out;
}
function frecceArcs(){
  return run(`frecce.map(f=>({type:f.type,from:f.fromNodeIndex,to:f.toNodeIndex,x1:Math.round(f.inzioX),y1:Math.round(f.inzioY),x2:Math.round(f.fineX),y2:Math.round(f.fineY)}))`);
}
function ptInBox(x,y,b,pad){ return x>=b.left-pad && x<=b.right+pad && y>=b.top-pad && y<=b.bot+pad; }
// does segment (x1,y1)-(x2,y2) pass through the shrunk interior of box b?
// Excludes a node's OWN shape outline: if BOTH endpoints sit on/within box b
// (a diamond/hexagon/rect edge), it's that node's own border, not a crossing arc.
function segCrossesBox(x1,y1,x2,y2,b,margin){
  const L=b.left+margin,R=b.right-margin,T=b.top+margin,B=b.bot-margin;
  if(R<=L||B<=T) return false;
  if(ptInBox(x1,y1,b,2) && ptInBox(x2,y2,b,2)) return false; // own shape edge
  const N=60;
  for(let k=1;k<N;k++){ const t=k/N; const x=x1+(x2-x1)*t, y=y1+(y2-y1)*t;
    if(x>L&&x<R&&y>T&&y<B) return true; }
  return false;
}
function analyze(name){
  const boxes=nodeBoxes(); const segs=segments(); const arcs=frecceArcs();
  const nodeOverlaps=[];
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){
    const A=boxes[a],B=boxes[b];
    const ox=Math.min(A.right,B.right)-Math.max(A.left,B.left);
    const oy=Math.min(A.bot,B.bot)-Math.max(A.top,B.top);
    if(ox>2&&oy>2) nodeOverlaps.push(`${A.t}#${A.i}<->${B.t}#${B.i} (${Math.round(ox)}x${Math.round(oy)}px)`);
  }
  const arcCross=[];
  for(const s of segs){ for(const b of boxes){
    if(segCrossesBox(s[0],s[1],s[2],s[3],b,7)) arcCross.push(`seg(${Math.round(s[0])},${Math.round(s[1])})-(${Math.round(s[2])},${Math.round(s[3])}) crosses ${b.t}#${b.i}`);
  }}
  // backward structural arcs (if_join/loop_exit going UP = drawn upward = bug1)
  const backward=[];
  for(const f of arcs){ if((f.type==='if_join'||f.type==='loop_exit'||f.type==='normal') && f.y2 < f.y1-5){
    backward.push(`${f.type} from#${f.from}->#${f.to} y1=${f.y1} y2=${f.y2} (UP ${f.y1-f.y2}px)`);
  }}
  // dedupe arcCross
  const uniqCross=[...new Set(arcCross)];
  console.log(`\n===== ${name} =====`);
  console.log('nodes:', run('JSON.stringify(flow.nodes.map((n,i)=>({i,t:n.type,next:n.next})))'));
  console.log('boxes:', boxes.map(b=>`${b.t}#${b.i}[x${Math.round(b.left)}..${Math.round(b.right)},y${Math.round(b.top)}..${Math.round(b.bot)}]`).join(' '));
  console.log('nodeOverlaps:', nodeOverlaps.length?nodeOverlaps:'none');
  console.log('arcCrossesNode:', uniqCross.length?uniqCross:'none');
  console.log('backwardStructuralArcs:', backward.length?backward:'none');
  return {nodeOverlaps,uniqCross,backward,boxes,arcs};
}

const LONG = 'asdasDasdasDasdasDasdasDasdasDasdasDasdasD asdasDasdasDasdasDasdasD asdasDasdasDasdasDasdasDasdasD';
const LONGER = (LONG+' ').repeat(3);

// ---------- BUG 1 & 3 & 7: For > If, tall block in False branch ----------
reset();
ins('f.type==="normal"','for');                 // For at idx1 (start->for->end)
ins('f.type==="loop_body"','if');               // If inside For body -> idx2
// If has empty branches now; insert a print into the FALSE branch
ins('f.type==="if_false"','print');             // print in False -> idx3
setInfo(3, LONG);                                // tall/large block
redraw();
const r1 = analyze('BUG1/3 For>If>tallFalse');

// BUG 7: also add a big block in the TRUE branch of the same If
ins('f.type==="if_true"','print');
redraw();
// find the two prints
setInfo(run('flow.nodes.findIndex((n,i)=>n.type==="print"&&i!==3)'), LONG);
redraw();
const r7 = analyze('BUG7 For>If> big both branches');

// ---------- BUG 4: If, False->nested If, nested True has huge block ----------
reset();
ins('f.type==="normal"','if');                  // outer If idx1
ins('f.type==="if_false"','if');                // nested If in False -> idx2
ins('f.type==="if_true"&&f.fromNodeIndex===2','print');  // big block in nested If's TRUE
setInfo(run('flow.nodes.findIndex(n=>n.type==="print")'), LONGER);
redraw();
const r4 = analyze('BUG4 If>falseIf>hugeTrue');

// ---------- BUG 5: While with very long condition ----------
reset();
ins('f.type==="normal"','while');
setInfo(1, LONGER);
// give the while a body node too
ins('f.type==="loop_body"','print');
redraw();
const r5 = analyze('BUG5 While longCond');

// ---------- BUG 6: Do-While with very long condition, empty-ish body ----------
reset();
ins('f.type==="normal"','do');
setInfo(1, LONGER);
ins('f.type==="loop_body"','print');
redraw();
const r6 = analyze('BUG6 DoWhile longCond');

// ---------- BUG 2: If diamond with long condition (shape aspect) ----------
reset();
ins('f.type==="normal"','if');
setInfo(1, LONG);
redraw();
const b=nodeBoxes().find(x=>x.t==='if');
console.log('\n===== BUG2 If diamond shape =====');
console.log(`if box: w=${Math.round(b.w)} h=${Math.round(b.h)} ratio(w/h)=${(b.w/b.h).toFixed(2)}`);
const totalIssues = [r1,r7,r4,r5,r6].reduce((a,r)=>a+r.nodeOverlaps.length+r.uniqCross.length+r.backward.length,0);
console.log('\n>>> TOTAL ISSUES ACROSS SCENARIOS:', totalIssues);

// ===== BUG 3/5 follow-up (Ismail 2026-07-08): cicli a TESTO LUNGO con corpo VUOTO =====
// L'esagono cresce alto/largo; il back-edge (loop_body_end / ritorno del placeholder) e la
// sua verticale a cx+BACKEDGE_SEP cadevano DENTRO l'esagono -> il ciclo si sovrapponeva ai
// PROPRI archi. Regressione permanente: nessun arco deve attraversare l'esagono del ciclo.
const LOOPTXT='asdbyghuasdyghasdbyghuasdyghasdbyghuasdyghasdbyghuasdyghasdbyghuasdygh = 0; asdbyghuasdyghasdbyghuasdygh <= 10; asdbyghuasdyghasdbyghuasdygh += 1';
reset(); ins('f.type==="normal"','for'); setInfo(1,LOOPTXT); redraw();
const rFor = analyze('FOLLOWUP for longcond emptyBody');
reset(); ins('f.type==="normal"','while'); setInfo(1,LOOPTXT); redraw();
const rWhile = analyze('FOLLOWUP while longcond emptyBody');
const followIssues = [rFor,rWhile].reduce((a,r)=>a+r.nodeOverlaps.length+r.uniqCross.length+r.backward.length,0);
console.log('\n>>> FOLLOWUP ISSUES:', followIssues);

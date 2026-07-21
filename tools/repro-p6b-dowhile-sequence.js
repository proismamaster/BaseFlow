// Harness P6-b (Ismail 2026-07-14): verifica la SEQUENZA di evidenziazione senza dipendere dal
// motore async (inaffidabile in headless). Un simulatore cammina il grafo con la semantica reale
// (if/while/for: ramo true; do-while: prima visita entra nel corpo, poi valuta) e per OGNI passo
// stampa: NODO(i) [saltato se esagono do-while alla prima visita] e i GRUPPI dell'arco (con
// showRisalita = !prima-visita, esattamente come animateExecEdge). Copre do-while: vuoto, 1 blocco,
// IF dentro, e do-while annidato in un while. Serve a fissare l'ordine come rete di regressione.
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = path.join(__dirname, '..', 'app'); const W = 1000, H = 1000;
function makeApp() {
  const ctxMock = { strokeStyle:'#000',fillStyle:'#000',lineWidth:1,font:'',textAlign:'center',textBaseline:'middle',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},rect(){},closePath(){},stroke(){},fill(){},clearRect(){},fillText(){},measureText(t){return{width:(t||'').length*8};},save(){},restore(){},setLineDash(){},setTransform(){},arc(){} };
  const canvasMock = { width:W,height:H,getContext:()=>ctxMock,getBoundingClientRect:()=>({left:0,top:0}),addEventListener(){},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""} };
  const g=()=>({addEventListener(){},classList:{add(){},remove(){},contains(){return false;},toggle(){}},style:{setProperty(){},removeProperty(){},getPropertyValue:()=>""},value:'',querySelector:()=>({value:''}),querySelectorAll:()=>[],appendChild(){},innerHTML:'',textContent:'',dataset:{},rows:[],setAttribute(){},removeAttribute(){},getAttribute:()=>null,hasAttribute:()=>false});
  const documentMock = { getElementById:(id)=>id==='canvas'?canvasMock:id==='canvas-container'?{offsetWidth:W,offsetHeight:H,addEventListener(){},scrollLeft:0,scrollTop:0}:id==='tabVariabili'?{rows:[]}:g(),addEventListener(){},createElement:()=>g(),querySelector:()=>g(),querySelectorAll:()=>[],body:g(),documentElement:g() };
  const context = { document:documentMock,window:{addEventListener(){},innerWidth:W,innerHeight:H,matchMedia:()=>({matches:false,addEventListener(){}})},localStorage:{getItem:()=>null,setItem(){}},MutationObserver:function(){this.observe=()=>{};},console:{log(){},error(){},warn(){}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout,eval,alert(){},confirm:()=>true,location:{} };
  vm.createContext(context);
  for (const n of ['theme','state','utils','variables','layout','rendering','popups','interaction','fileIO','init']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'), context, {filename:n});
  vm.runInContext(fs.readFileSync(REPO+'/js/execute.js','utf8'), context, {filename:'execute.js'});
  vm.runInContext('window.onload();', context);
  const run=(c)=>vm.runInContext(c, context);
  const ins=(f,t)=>{ run(`frecceSelected=frecce.findIndex(ff=>${f});`); run(`inserisciNodo(${JSON.stringify(t)});`); run('draw(nodi);'); };
  return { run, ins,
    nodes:()=>JSON.parse(run('JSON.stringify(flow.nodes.map(function(n,i){return {i:i,t:n.type,next:n.next};}))')),
    groups:(from,to,branch,cameFrom)=>{ const sr = run(`!_isFirstVisitDo(${from},${JSON.stringify(cameFrom)})`); return JSON.parse(run(`JSON.stringify(computeEdgeGroups(${from},${to},${JSON.stringify(branch)},${sr}).map(function(x){return x.type;}))`)); },
    skipNode:(idx,cameFrom)=>run(`_isFirstVisitDo(${idx},${JSON.stringify(cameFrom)})`),
    inBody:(loop,idx)=>run(`(function(){var b=collectLoopBody(${loop});return b.bodyList.indexOf(${idx})>=0;})()`) };
}
// Simula la semantica d'esecuzione (rami true; do-while: prima visita entra) e produce la sequenza.
function simulate(app, maxSteps){
  const nodes = app.nodes(); const seq = [];
  const nextOf = (idx, prev) => {
    const n = nodes[idx]; if (!n) return { to:null, branch:null };
    if (typeof n.next === 'string') return { to: parseInt(n.next,10), branch:null };
    if (n.type === 'do') {
      const first = app.skipNode(idx, prev==null?null:String(prev)); // prima visita?
      return { to: parseInt(n.next.true,10), branch:'true' }; // do entra/ripete sul true (test: condizione vera)
    }
    // if / while / for: ramo true (test)
    return { to: parseInt(n.next.true,10), branch:'true' };
  };
  let cur = 0, prev = null;
  for (let s=0; s<maxSteps; s++){
    const n = nodes[cur]; if (!n || n.type==='end') { seq.push('NODO('+cur+':end)'); break; }
    // fase-NODO (saltata per esagono do-while alla prima visita)
    if (n.type==='do' && app.skipNode(cur, prev==null?null:String(prev))) { /* esagono saltato (D1) */ }
    else seq.push('NODO('+cur+')');
    const { to, branch } = nextOf(cur, prev);
    if (to==null) break;
    const grp = app.groups(cur, to, branch, prev==null?null:String(prev));
    seq.push('['+grp.join(',')+']');
    prev = cur; cur = to;
  }
  return seq.join(' -> ');
}
const cases = [
  ['do VUOTO', (a)=>{ a.ins('ff.type==="normal"','do'); }, 7],
  ['do{ print }', (a)=>{ a.ins('ff.type==="normal"','do'); a.ins('ff.type==="loop_body"','print'); }, 9],
  ['do{ if{} }', (a)=>{ a.ins('ff.type==="normal"','do'); a.ins('ff.type==="loop_body"','if'); }, 10],
  ['while{ do{ print } }', (a)=>{ a.ins('ff.type==="normal"','while'); a.ins('ff.type==="loop_body"','do'); a.ins('ff.type==="loop_body" && flow.nodes[ff.fromNodeIndex] && flow.nodes[ff.fromNodeIndex].type==="do"','print'); }, 12],
];
for (const [label, build, steps] of cases) {
  const app = makeApp(); app.run('draw(nodi);'); build(app); app.run('draw(nodi);');
  const nd = app.nodes().map(n=>n.i+':'+n.t).join(' ');
  console.log('\n### ' + label + '   [' + nd + ']');
  console.log('  ' + simulate(app, steps));
}

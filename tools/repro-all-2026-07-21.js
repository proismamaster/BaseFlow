/*
 * Suite di regressione della sessione 2026-07-21 (WP-M4q -> M6c).
 * Copre zone che in quella sessione hanno prodotto REGRESSIONI VERE: ripristino della
 * tabella variabili, coalescenze (console / celle array / pannello), culling, tartaruga.
 * Richiede jsdom (devDependency): `npm install`. Uso: `node tools/<questo-file>.js`
 * Runner di tutti: `node tools/run-repro-2026-07-21.js`
 */
const {sandbox,load}=require('./repro-harness-2026-07-21.js');
sandbox.i18nText=()=>null;
load('js/execute.js');
sandbox.throwError=m=>{ sandbox.thrown=m; };
sandbox.errMsg=(k,p)=>k+' '+JSON.stringify(p||{});
const S=sandbox;
let pass=0, fail=0;
function check(desc, got, want){
  const ok = String(got).indexOf(want)===0 || String(got)===want;
  (ok?pass++:fail++);
  console.log((ok?'  ok  ':'  FAIL'), desc.padEnd(46), '->', got, ok?'':('   ATTESO: '+want));
}
console.log('\n== parsing di a[i] ==');
const P=S._bfParseIndexedName;
check('a[0]',              JSON.stringify(P('a[0]')),        '{"name":"a","idxExpr":"0"}');
check('a[i+1] (espressione)', JSON.stringify(P('a[i+1]')),   '{"name":"a","idxExpr":"i+1"}');
check('a (non indicizzato)', JSON.stringify(P('a')),         'null');
check('a[] (vuoto)',       JSON.stringify(P('a[]')),         'null');

console.log('\n== valutazione indice ==');
const V=[{name:'i',type:'int',value:2},{name:'f',type:'float',value:1.5},{name:'u',type:'int',value:0,uninit:true}];
function idx(e){ S.thrown=null; const r=S._bfEvalIndex(e,V,3); return S.thrown||('valore '+r); }
check('indice 2',              idx('2'),     'valore 2');
check('indice i+1',            idx('i+1'),   'valore 3');
check('indice decimale 1.5',   idx('f'),     'err_index_int');
check('indice da var uninit',  idx('u'),     'err_uninit_var');
check('indice divisione /0',   idx('1/0'),   'err_div_zero');

console.log('\n== traduzione errori del valutatore ==');
const E=(m)=>S._evalErrMsg(new Error(m), 9, 'err_invalid_expr');
check('__IDXRANGE__ (len>0)', E('__IDXRANGE__:5:3'), 'err_index_range');
check('__IDXRANGE__ (len=0)', E('__IDXRANGE__:0:0'), 'err_index_empty');
check('__IDXTYPE__',          E('__IDXTYPE__'),      'err_index_int');
check('__IDXNOTARR__',        E('__IDXNOTARR__'),    'err_not_array');
check('__DIV0__',             E('__DIV0__'),         'err_div_zero');

console.log('\n== coerenza di tipo degli elementi ==');
function at(type,val){ S.thrown=null; const ok=S._assertVarType({type:type},val,4); return S.thrown||('ok '+ok); }
check('array:int con [1,2]',        at('array:int',[1,2]),        'ok true');
check('array:int con [1,"x"]',      at('array:int',[1,'x']),      'err_type_mismatch');
check('array:int con [1,2.5]',      at('array:int',[1,2.5]),      'err_type_mismatch');
check('array:int con scalare 5',    at('array:int',5),            'err_type_mismatch');
check('array:string con ["a"]',     at('array:string',['a']),     'ok true');
check('array:bool con [true,false]',at('array:bool',[true,false]),'ok true');
check('array:int con [] (vuoto)',   at('array:int',[]),           'ok true');

console.log('\n== serializzazione array nelle espressioni (iniezione) ==');
const q=S._varValueForExpr({value:["a'b", 'c\\d']});
check('stringhe con apice/backslash', q, "['a\\'b','c\\\\d']");
check('rivalutabile',  JSON.stringify(S.safeEvaluate(q)), '["a\'b","c\\\\d"]');

console.log('\n== output di un array ==');
check('formato [1, 2, 3]', S._bfFormatValueForDisplay([1,2,3]), '[1, 2, 3]');
check('array vuoto',       S._bfFormatValueForDisplay([]),      '[]');

console.log('\nRISULTATO: '+pass+' ok, '+fail+' falliti');
process.exit(fail?1:0);

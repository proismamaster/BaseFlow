const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',options:[],querySelector:()=>gg(),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',setAttribute:()=>{},getAttribute:()=>null});
const documentMock={getElementById:()=>gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:{setAttribute:()=>{},classList:{toggle:()=>{}}}};
const ctx={document:documentMock,window:{addEventListener:()=>{},matchMedia:()=>({matches:false})},localStorage:{getItem:()=>null,setItem:()=>{}},console:{log:function(){},warn:function(){},error:function(){}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout:()=>0,eval,location:{}};
vm.createContext(ctx);
for(const n of ['i18n','variables']) vm.runInContext(fs.readFileSync(REPO+'/js/core/'+n+'.js','utf8'),ctx,{filename:n});
const run=c=>vm.runInContext(c,ctx);
for(const L of ['it','en','ar','zh']){
 run('currentLang="'+L+'";');
 console.log('['+L+'] int="'+run('_varTypeLabel("int",false)')+'"  float="'+run('_varTypeLabel("float",false)')+'"  string="'+run('_varTypeLabel("string",false)')+'"');
}

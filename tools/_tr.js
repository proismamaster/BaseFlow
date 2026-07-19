const fs=require('fs'),vm=require('vm'),path=require('path');const REPO=path.join(__dirname,'..');
const gg=()=>({addEventListener:()=>{},classList:{add:()=>{},remove:()=>{},contains:()=>false,toggle:()=>{}},style:{},value:'',querySelector:()=>gg(),querySelectorAll:()=>[],appendChild:()=>{},innerHTML:'',textContent:'',setAttribute:()=>{},getAttribute:()=>null});
const documentMock={getElementById:()=>gg(),addEventListener:()=>{},createElement:()=>gg(),querySelector:()=>gg(),querySelectorAll:()=>[],body:gg(),documentElement:{lang:'',dir:'',classList:{toggle:()=>{}}}};
const ctx={document:documentMock,window:{addEventListener:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{}},console:{log:function(){},warn:function(){},error:function(){}},Math,JSON,parseInt,parseFloat,isNaN,Set,Array,Object,String,Number,RegExp,Promise,setTimeout:()=>0,eval,location:{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(REPO+'/js/core/i18n.js','utf8'),ctx,{filename:'i18n.js'});
const run=c=>vm.runInContext(c,ctx);
for(const L of ['it','en','ar','zh']){
 run('currentLang="'+L+'";');
 const t=run('i18nText("run_is_true")'), f=run('i18nText("run_is_false")');
 console.log('['+L+'] is_true="'+t+'" is_false="'+f+'"');
 console.log('     if_res:  '+run('i18nFormat("run_if_res",{c:"i%2==0",r:i18nText("run_is_true")})'));
 console.log('     while:   '+run('i18nFormat("run_while",{c:"i<10"})'));
 console.log('     for:     '+run('i18nFormat("run_for",{v:"i",val:0})'));
 console.log('     assign:  '+run('i18nFormat("run_assign",{info:"i = i + 1"})'));
 console.log('     forcond: '+run('i18nFormat("run_for_cond",{c:"i<=10",r:i18nText("run_is_true")})'));
}

'use strict';
// Validation bridges evaluate crystal-app.js in a VM with its imports
// stripped. cifData() needs the bounded CIF2 helpers, so load those pure
// modules into the same context (no other browser module is executed).
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const CIF2_MODULES=['cif2-lex.js','cif2-symmetry.js','cif2-document.js'];
function loadCif2Helpers(context,dir=ROOT){
 for(const file of CIF2_MODULES){
  const code=fs.readFileSync(path.join(dir,file),'utf8');
  const names=[...code.matchAll(/^export (?:async )?function\*? ?(\w+)/gm)].map(m=>m[1]);
  const body=code.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');
  const exported=vm.runInContext('(function(){'+body+'\n;return {'+names.join(',')+'};})()',context,{filename:file,timeout:5000});
  Object.assign(context,exported);
 }
 return context;
}
module.exports={loadCif2Helpers,CIF2_MODULES};

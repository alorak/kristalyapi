'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {parserFromHtml} = require('./js_cif_runner.cjs');

const root=path.resolve(__dirname,'../..');
const htmlPath=path.join(root,'index.html');
const modulePath=path.join(root,'crystal-app.js');
const examplePath=path.join(__dirname,'fixtures','synthetic','s01_p1_cubic.cif');

test('headless CIF extraction does not execute browser-only initialization',()=>{
 const parse=parserFromHtml(htmlPath);
 assert.equal(typeof parse.exportText,'function');
 assert.equal(typeof parse.originalRecord,'function');
 assert.equal(typeof parse.exportPreservingSource,'function');
 const data=parse(fs.readFileSync(examplePath,'utf8'));
 assert.equal(data.cell.a,5);
 assert.equal(data.sites.length,1);
 assert.equal(data.sites[0].symbol,'Si');
});
test('future UI bootstrap changes cannot affect the independent CIF parser',()=>{
 const original=fs.readFileSync(modulePath,'utf8');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'crystal-cif-runner-'));
 try{
  const changed=original.replace(
   '// @kristalyapi/browser-bootstrap: browser UI entry point, not part of the CIF parser',
   '// @kristalyapi/browser-bootstrap: browser UI entry point, not part of the CIF parser\n' +
    'this.IS_UI_STARTUP = nonexistentBrowserApi();'
  );
  fs.writeFileSync(path.join(temp,'index.html'),fs.readFileSync(htmlPath,'utf8'));
  fs.writeFileSync(path.join(temp,'crystal-app.js'),changed);
  // The runner also loads the bounded CIF2 helpers from beside the page.
  for(const helper of ['cif2-lex.js','cif2-symmetry.js','cif2-document.js'])
   fs.copyFileSync(path.join(path.dirname(modulePath),helper),path.join(temp,helper));
  const parse=parserFromHtml(path.join(temp,'index.html'));
  const crystal=parse(fs.readFileSync(examplePath,'utf8'));
  assert.equal(crystal.sites.length,1);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('missing browser boundary marker fails closed rather than executing app startup',()=>{
 const original=fs.readFileSync(modulePath,'utf8');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'crystal-cif-no-bootstrap-'));
 try{
  fs.writeFileSync(path.join(temp,'index.html'),fs.readFileSync(htmlPath,'utf8'));
  fs.writeFileSync(path.join(temp,'crystal-app.js'),
   original.replace('// @kristalyapi/browser-bootstrap:', '// unknown-browser-entry:'));
  assert.throws(()=>parserFromHtml(path.join(temp,'index.html')),/bootstrap marker missing/i);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {parserFromHtml} = require('./js_cif_runner.cjs');

const root=path.resolve(__dirname,'../..');
const htmlPath=path.join(root,'index.html');
const examplePath=path.join(__dirname,'fixtures','synthetic','s01_p1_cubic.cif');

test('headless CIF extraction does not execute browser-only initialization',()=>{
 const parse=parserFromHtml(htmlPath);
 const data=parse(fs.readFileSync(examplePath,'utf8'));
 assert.equal(data.cell.a,5);
 assert.equal(data.sites.length,1);
 assert.equal(data.sites[0].symbol,'Si');
});
test('future UI bootstrap changes cannot affect the independent CIF parser',()=>{
 const original=fs.readFileSync(htmlPath,'utf8');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'crystal-cif-runner-'));
 try{
  const changed=original.replace(
   '// @kristalyapi/browser-bootstrap: browser UI entry point, not part of the CIF parser',
   '// @kristalyapi/browser-bootstrap: browser UI entry point, not part of the CIF parser\n' +
    'this.IS_UI_STARTUP = nonexistentBrowserApi();'
  );
  const filepath=path.join(temp,'index.html');
  fs.writeFileSync(filepath,changed);
  const parse=parserFromHtml(filepath);
  const crystal=parse(fs.readFileSync(examplePath,'utf8'));
  assert.equal(crystal.sites.length,1);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('missing browser boundary marker fails closed rather than executing app startup',()=>{
 const original=fs.readFileSync(htmlPath,'utf8');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'crystal-cif-no-bootstrap-'));
 try{
  fs.writeFileSync(path.join(temp,'index.html'),
    original.replace('// @kristalyapi/browser-bootstrap:', '// unknown-browser-entry:'));
  assert.throws(()=>parserFromHtml(path.join(temp,'index.html')),/bootstrap marker missing/i);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

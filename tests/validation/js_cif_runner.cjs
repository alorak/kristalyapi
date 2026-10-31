#!/usr/bin/env node
'use strict';
/* Extracts the browser CIF parser from the module referenced by index.html,
   without a backend, external dependencies or duplicating parser logic. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

class Vector3 {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  clone(){return new Vector3(this.x,this.y,this.z);}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
  multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
  dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
  length(){return Math.hypot(this.x,this.y,this.z);}
  normalize(){return this.multiplyScalar(1/(this.length()||1));}
  crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
  toArray(){return [this.x,this.y,this.z];}
}
function parserFromHtml(filename) {
  const html=fs.readFileSync(filename,'utf8');
  const match=html.match(/<script\b[^>]*\btype=["']module["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!match)throw Error('Module script missing from index.html');
  const src=match[0].match(/\bsrc=["']([^"']+)["']/i);
  let script=match[1];
  if(src){
    // Fail closed on external or path-traversing sources; this runner only
    // executes the app's checked-in, local JavaScript before the bootstrap.
    const relative=src[1];
    if(!/^\.\/[\w./-]+\.js$/.test(relative)||relative.split('/').includes('..'))
      throw Error('CIF runner only accepts a relative local module script');
    const modulePath=path.resolve(path.dirname(filename),relative);
    script=fs.readFileSync(modulePath,'utf8');
  }
  // Separate pure data routines from browser UI startup using a stable marker.
  // The previous exact-match startup regexp silently stopped matching when
  // restoreInitialCrystal() was added, crashing the headless validation job.
  const marker='// @kristalyapi/browser-bootstrap:';
  const boundary=script.indexOf(marker);
  if(boundary<0)throw Error('Browser bootstrap marker missing: CIF runner must not execute the UI');
  const source=script.slice(0,boundary).replace(/^import .*?;\s*$/gm,'');
  const context={THREE:{Vector3,SphereGeometry:class{},CylinderGeometry:class{}},URLSearchParams,document:{getElementById(){return null;}}};
  vm.createContext(context);
  // Load only our two bounded, pure CIF2 helpers into the same isolated VM.
  // Browser imports are stripped above; otherwise CIF2 would be undefined
  // in independent CI measurements. No arbitrary npm modules are executed.
  for(const [moduleName,names] of [
   ['cif2-lex.js',['isCif2','tokenizeCif2']],
   ['cif2-symmetry.js',['validateCif2Symmetry']],
   ['cif2-document.js',['readCif2Document','listCif2Structures','selectCif2Structure','safeCif2Metadata']]
  ]){
   const helperPath=path.join(path.dirname(filename),moduleName);
   const code=fs.readFileSync(helperPath,'utf8').replace(/^export /gm,'').replace(/^import .*?;\s*$/gm,'');
   const bridge=vm.runInContext('(function(){'+code+
      ';return {'+names.map(name=>name+':'+name).join(',')+'};})()',context,
      {timeout:5000,filename:moduleName});
   for(const name of names)context[name]=bridge[name];
  }
  vm.runInContext(source+'\nthis.__cifParser = cifData; this.__cifExportText = cifExportText; this.__originalCifRecord = originalCifRecord; this.__cifExportPreservingSource = cifExportPreservingSource;',context,{timeout:15000,filename:src?'browser-crystal-app.js':'browser-index-inline.js'});
  if(typeof context.__cifParser!=='function')throw Error('cifData() not found');
  // Keep the callable parser API stable; expose the SAME production exporter
  // for independent Gemmi syntax/reference validation.
  return Object.assign(context.__cifParser,{
    exportText:context.__cifExportText,
    originalRecord:context.__originalCifRecord,
    exportPreservingSource:context.__cifExportPreservingSource,
    listCif2Structures:context.listCif2Structures,
    readCif2Document:context.readCif2Document
  });
}
function main(){
  const root=path.resolve(__dirname,'../..'),base=__dirname;
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
  const parse=parserFromHtml(path.join(root,'index.html'));
  const output=[];
  for(const entry of manifest.cases){
    const name=path.resolve(base,entry.path);
    if(!name.startsWith(path.join(base,'fixtures')+path.sep))throw Error('Fixture path escaped fixtures/: '+entry.path);
    const buffer=fs.readFileSync(name);
    const record={id:entry.id,kind:entry.kind,path:entry.path,sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
    const blobSha=crypto.createHash('sha1').update('blob '+buffer.length+'\0').update(buffer).digest('hex');
    if(blobSha!==entry.git_blob_sha1){
      record.result='error';
      record.error='Fixture differs from pinned Git blob SHA-1 ('+entry.git_blob_sha1+')';
      output.push(record);
      continue;
    }
    try{
      const data=parse(buffer.toString('utf8'));
      const c=data.cell;
      record.result='parsed';
      record.cell={a:+c.a,b:+c.b,c:+c.c,alpha:+c.alpha,beta:+c.beta,gamma:+c.gamma};
      record.sites=data.sites.map(site=>({
        element:String(site.symbol),x:+site.x,y:+site.y,z:+site.z,occupancy:+(site.occupancy??1)
      }));
      record.spacegroup=data.sgNumber??null;
      record.assumption=String(data.warning||'');
    }catch(error){record.result='error';record.error=String(error.message||error).slice(0,600);}
    output.push(record);
  }
  const dest=process.argv[2]||path.join(root,'validation-results','browser.json');
  fs.mkdirSync(path.dirname(path.resolve(dest)),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify({target:'browser module CIF parser',cases:output},null,2)+'\n');
  console.log('Browser parser measured '+output.length+' CIF fixtures. Output: '+dest);
}
if(require.main===module)main();
module.exports={parserFromHtml};

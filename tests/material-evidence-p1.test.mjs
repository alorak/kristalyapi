import test from 'node:test';
import assert from 'node:assert/strict';
import {capturedMaterialCard,canonicalMaterialGeometry,sha256Hex,attachEvidenceFile,verifyEvidenceBundle} from '../material-evidence-core.js';
const structure={name:'GaN test',workspace:'Lab',symmetry:'P63mc',cell:{
 a:3.18,b:3.18,c:5.16,alpha:90,beta:90,gamma:120},
 sites:[{symbol:'N',x:0,y:0,z:0},{symbol:'Ga',x:1/3,y:2/3,z:.5}]};
test('SHA-256 is computed locally for canonical ordered P1 geometry',async()=>{
 assert.equal(await sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 const a=await capturedMaterialCard(structure,{sourceLabel:'Lab',sourceReference:'operator-1'});
 const b=await capturedMaterialCard({...structure,sites:[...structure.sites].reverse()});
 assert.equal(a.geometrySha256,b.geometrySha256);
 assert.deepEqual(canonicalMaterialGeometry(structure),canonicalMaterialGeometry({...structure,sites:[...structure.sites].reverse()}));
 assert.equal((await verifyEvidenceBundle([a]))[0].structureDigestVerified,true);
 assert.equal((await verifyEvidenceBundle([a]))[0].independentSourceVerified,false);
});
test('typed file digest records keep identity explicitly unverified',async()=>{
 const card=await capturedMaterialCard(structure);
 const contents=new TextEncoder().encode('measurement,unverified\n');
 const file={name:'synthetic.csv',size:contents.byteLength,async arrayBuffer(){return contents.buffer;}};
 const attached=await attachEvidenceFile(card,file,{kind:'xrd-scan',sourceId:'sample-001',recordedAt:'2026-11-01T00:00:00Z'});
 assert.equal(attached.artifacts.length,1);
 assert.equal(attached.artifacts[0].sha256,await sha256Hex(contents));
 assert.match(attached.artifacts[0].verification,/unverified/);
 assert.equal((await verifyEvidenceBundle([attached]))[0].artifactBytesAvailable,false);
 assert.equal(card.artifacts.length,0);
});
test('fail closed on geometry manipulation, forged records, invalid inputs',async()=>{
 const card=await capturedMaterialCard(structure);
 const changed=JSON.parse(JSON.stringify(card));changed.geometry.sites[0].fractional[0]=.3;
 await assert.rejects(verifyEvidenceBundle([changed]),/mismatch|canonical/i);
 const altered=JSON.parse(JSON.stringify(card));altered.volumeA3+=1;
 await assert.rejects(verifyEvidenceBundle([altered]),/summary mismatch/);
 const wrong=JSON.parse(JSON.stringify(card));wrong.artifacts.push({kind:'xrd-scan',sourceId:'s'});
 await assert.rejects(verifyEvidenceBundle([wrong]),/invalid/i);
 await assert.rejects(attachEvidenceFile(card,{name:'x',size:13*1024*1024,async arrayBuffer(){return new ArrayBuffer(0)}},{kind:'cif',sourceId:'COD'}));
 await assert.rejects(attachEvidenceFile(card,{name:'x',size:1,async arrayBuffer(){return new ArrayBuffer(1)}},{kind:'qe-output',sourceId:''}));
});

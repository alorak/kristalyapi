import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {protocolTemplates,protocolById,protocolRequestMatches,protocolPreflightMatches} from '../qe-protocol-templates.js';
test('templates preserve exact recorded requests and UPF identities',()=>{
 assert.equal(protocolTemplates.length,2);
 for(const p of protocolTemplates){const bytes=readFileSync(new URL('../'+p.request_path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),p.request_sha256);assert.deepEqual(JSON.parse(bytes),p.request);assert.ok(Object.isFrozen(p.request.structure));assert.match(p.structure_hash,/^[a-f0-9]{64}$/);}
 assert.equal(protocolById('si-functional').acceptance,'functional-only');assert.equal(protocolById('mos2-d41').acceptance,'finite-band-mesh');assert.throws(()=>protocolById('custom'));
});
test('parameter or geometry changes invalidate protocol scope',()=>{
 const p=protocolById('mos2-d41'),r=structuredClone(p.request);assert.equal(protocolRequestMatches(p,r),true);
 r.profile_id='operator-alias';assert.equal(protocolRequestMatches(p,r),true);
 r.electronic.dos.degauss_ry=.005;assert.equal(protocolRequestMatches(p,r),false);
 r.electronic.dos.degauss_ry=.01;r.structure.atoms[1].fractional[2]+=.001;assert.equal(protocolRequestMatches(p,r),false);
});
test('matching settings require independent server structure and exact UPF hashes',()=>{
 const p=protocolById('mos2-d41'),response={valid:true,structure_hash:p.structure_hash,upf_sha256:Object.fromEntries(Object.entries(p.pseudopotentials).map(([el,upf])=>[el,upf.sha256]))};
 assert.equal(protocolPreflightMatches(p,p.request,null),false);assert.equal(protocolPreflightMatches(p,p.request,response),true);
 response.upf_sha256.Mo='0'.repeat(64);assert.equal(protocolPreflightMatches(p,p.request,response),false);
 response.upf_sha256.Mo=p.pseudopotentials.Mo.sha256;response.structure_hash='a'.repeat(64);assert.equal(protocolPreflightMatches(p,p.request,response),false);
});

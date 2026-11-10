import test from 'node:test';
import assert from 'node:assert/strict';
import {GANSU_UPSTREAM_COMMIT,GANSU_ASSET_ROOT,parseGansuXyz,validateGansuRequest,runGansuDft} from '../gansu-local-engine.js';

const H2='2\nHydrogen molecule\nH 0 0 0\nH 0 0 0.74';
const SIH4='5\nSilane tetrahedron · Si-H 1.480 Å\nSi 0 0 0\nH 0.85448 0.85448 0.85448\nH -0.85448 -0.85448 0.85448\nH -0.85448 0.85448 -0.85448\nH 0.85448 -0.85448 -0.85448';
const basis='****\n'+'H 0\nS 3 1.00\n'.repeat(1100);

test('GANSU bridge is pinned to a same-origin subdirectory and parses finite H2',()=>{
 assert.equal(GANSU_UPSTREAM_COMMIT.length,40);
 assert.match(GANSU_ASSET_ROOT.pathname,/vendor\/gansu-lite\/$/);
 const atoms=parseGansuXyz(H2);assert.equal(atoms.length,2);
 assert.equal(validateGansuRequest({xyz:H2}).electrons,2);
});
test('SiH4 is neutral, 18-electron, five-atom closed-shell silicon with tetrahedral bonds',()=>{
 const atoms=parseGansuXyz(SIH4);
 assert.equal(atoms.length,5);
 assert.equal(atoms[0].symbol,'Si');
 assert.equal(atoms[0].atomicNumber,14);
 const request=validateGansuRequest({xyz:SIH4,functional:'PBE',grid:'medium'});
 assert.equal(request.electrons,18);
 assert.equal(request.multiplicity,1);
 for(const atom of atoms.slice(1))
  assert.ok(Math.abs(Math.hypot(...atom.xyz)-1.48)<1e-3);
});
test('rejects invalid XYZ, heavy elements, overlapping atoms and inconsistent electrons/spin',()=>{
 assert.throws(()=>parseGansuXyz('2\nwrong\nH 0 0 0'),/XYZ/);
 assert.throws(()=>parseGansuXyz('1\nNi\nNi 0 0 0'),/H–Ne/);
 assert.throws(()=>parseGansuXyz('2\nCollision\nH 0 0 0\nH 0 0 0'),/0,25/);
 assert.throws(()=>validateGansuRequest({xyz:H2,multiplicity:2}),/tutarsız/);
 assert.throws(()=>validateGansuRequest({xyz:H2,charge:5}),/Yük/);
 assert.throws(()=>validateGansuRequest({xyz:H2,functional:'UNRECOGNISED'}),/fonksiyonel/);
});
class MockWorker {
 constructor(mode){this.mode=mode;this.terminated=false;this.request=null;}
 postMessage(payload){
  this.request=payload;
  queueMicrotask(()=>{
   this.onmessage({data:{type:'progress',message:'Config: '+(this.mode==='wasm'?'WASM SIMD':'JS')+', convergence 1e-8'}});
   this.onmessage({data:{type:'iteration',iter:3,energy:-1.1,deltaE:-0.01}});
   this.onmessage({data:{type:'result',totalEnergy:-1.1,orbitalEnergies:[-0.3,0.2],numOccupied:1,mullikenCharges:[0,0],dipole:{debye:0},gridElectrons:2}});
  });
 }
 terminate(){this.terminated=true;}
}
const fakeFetch=async()=>({ok:true,text:async()=>basis});
test('sends real GANSU WorkerRequest with DFTConfig and enforces WASM evidence',async()=>{
 const w=new MockWorker('wasm');
 const result=await runGansuDft({xyz:H2,functional:'PBE'},{
  workerFactory:()=>w,fetcher:fakeFetch
 });
 assert.equal(result.energyHartree,-1.1);
 assert.equal(result.backend,'WASM');
 assert.equal(result.iterations,3);
 assert.equal(w.request.dftConfig.functional,'PBE');
 assert.equal(w.request.method,'RHF');
 assert.equal(w.request.eriBackend,'wasm');
 assert.equal(w.request.baseUrl,GANSU_ASSET_ROOT.pathname);
 assert.equal(w.terminated,true);
});
test('rejects silent JS fallback instead of calling it browser WASM DFT',async()=>{
 const w=new MockWorker('js');
 await assert.rejects(runGansuDft({xyz:H2},{
  workerFactory:()=>w,fetcher:fakeFetch
 }),/JS fallback/);
 assert.equal(w.terminated,true);
});
test('supports explicit cancellation before starting a Worker',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(runGansuDft({xyz:H2},{signal:controller.signal,fetcher:fakeFetch}),/iptal/);
});

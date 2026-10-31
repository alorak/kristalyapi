import test from 'node:test';
import assert from 'node:assert/strict';
import {hungarian,alignmentRefusals,alignPhases,alignmentCsv} from '../phase-alignment.js';

const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,a+' ≉ '+b);
// Deterministic pseudo-random numbers (no external dependency).
function rng(seed){let s=seed>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/2**32);}

function permutations(n){
 if(n===1)return [[0]];
 return permutations(n-1).flatMap(p=>Array.from({length:n},(_,i)=>[...p.slice(0,i),n-1,...p.slice(i)]));
}

test('Hungarian assignment equals the brute-force optimum',()=>{
 const random=rng(7);
 for(let trial=0;trial<40;trial++){
  const n=1+trial%6,cost=Array.from({length:n},()=>Array.from({length:n},()=>Math.round(random()*100)/10));
  const assignment=hungarian(cost),total=assignment.reduce((s,j,i)=>s+cost[i][j],0);
  assert.deepEqual([...assignment].sort((a,b)=>a-b),Array.from({length:n},(_,i)=>i),'a permutation');
  const best=Math.min(...permutations(n).map(p=>p.reduce((s,j,i)=>s+cost[i][j],0)));
  close(total,best,1e-9);
 }
 assert.deepEqual(hungarian([]),[]);
 assert.throws(()=>hungarian([[1,2]]),/kare/);
});

// Cubic perovskite ABO3, a = 3.905 Å.
const cubic={a:3.905,b:3.905,c:3.905,alpha:90,beta:90,gamma:90};
const perovskite=[
 {symbol:'Sr',label:'Sr1',x:0,y:0,z:0},{symbol:'Ti',label:'Ti1',x:.5,y:.5,z:.5},
 {symbol:'O',label:'O1',x:.5,y:.5,z:0},{symbol:'O',label:'O2',x:.5,y:0,z:.5},{symbol:'O',label:'O3',x:0,y:.5,z:.5}
].map(s=>({...s,occupancy:1}));

test('recovers a known origin shift and atom displacements in a 2×2×1 supercell',()=>{
 // Supercell to have many atoms of each element.
 const cell={...cubic,a:7.81,b:7.81};
 const primarySites=[];
 // A fixed distortion (±0.04 fractional) removes the supercell's internal (½,0,0) and (0,½,0)
 // translations; with them two shifts would fit equally well.
 const distort=rng(3);
 for(const i of [0,1])for(const j of [0,1])for(const s of perovskite)
  primarySites.push({...s,label:s.label+'_'+i+j,x:(s.x+i)/2+(distort()-.5)*.08,y:(s.y+j)/2+(distort()-.5)*.08,z:s.z+(distort()-.5)*.08});
 const random=rng(11),shift=[.37,.11,.62];
 const displacements=primarySites.map(()=>[0,1,2].map(()=>(random()-.5)*.004)); // fractional, < 0.016 Å
 // Overlay atom = primary atom moved by −shift plus a small displacement, listed in reverse order.
 const overlaySites=primarySites.map((s,i)=>({...s,label:'o'+i,
  x:s.x-shift[0]+displacements[i][0],y:s.y-shift[1]+displacements[i][1],z:s.z-shift[2]+displacements[i][2]})).reverse();
 const result=alignPhases({cell,sites:primarySites},{cell,sites:overlaySites});
 // Least squares removes the mean displacement; the expected RMSD is that of the centred displacements.
 const mean=[0,1,2].map(k=>displacements.reduce((s,d)=>s+d[k],0)/displacements.length);
 const lengths=[cell.a,cell.b,cell.c];
 const expected=Math.sqrt(displacements.reduce((s,d)=>s+d.reduce((q,v,k)=>q+((v-mean[k])*lengths[k])**2,0),0)/displacements.length);
 close(result.rmsd,expected,1e-9);
 [0,1,2].forEach(k=>close(((result.shift[k]-(shift[k]-mean[k]))%1+1.5)%1-.5,0,1e-9));
 assert.equal(result.inverted,false);
 // Every overlay atom is paired with the primary atom it came from.
 for(const pair of result.pairs)assert.equal(pair.overlay,'o'+pair.primaryIndex);
 assert.equal(result.pairs.length,20);
 close(result.cell.volumeChange,0);
 assert.match(alignmentCsv(result),/^primary,overlay,element,displacement_A,dx_A,dy_A,dz_A\nSr1_00,o0,Sr,0\.\d{6},/);
});

test('inversion is found only when allowed; strain shows as cell differences',()=>{
 const chiral=[{symbol:'Si',label:'Si1',x:.12,y:.21,z:.33},{symbol:'O',label:'O1',x:.41,y:.17,z:.08},{symbol:'O',label:'O2',x:.27,y:.44,z:.71}].map(s=>({...s,occupancy:1}));
 const mirror=chiral.map(s=>({...s,x:-s.x+.25,y:-s.y+.5,z:-s.z}));
 const tri={a:5,b:6,c:7,alpha:80,beta:95,gamma:105};
 const plain=alignPhases({cell:tri,sites:chiral},{cell:tri,sites:mirror});
 const inverted=alignPhases({cell:tri,sites:chiral},{cell:tri,sites:mirror},{allowInversion:true});
 assert.equal(inverted.inverted,true);close(inverted.rmsd,0,1e-9);
 assert.ok(plain.rmsd>.1,'without inversion the enantiomorph does not fit');
 const strained=alignPhases({cell:tri,sites:chiral},{cell:{...tri,a:5.1},sites:chiral});
 close(strained.cell.deltas.a,.1,1e-12);close(strained.rmsd,0,1e-9);
 assert.ok(strained.cell.volumeChange>.019&&strained.cell.volumeChange<.021);
});

test('incompatible phases are refused with the reason',()=>{
 const p={cell:cubic,sites:perovskite};
 assert.deepEqual(alignmentRefusals(p,p),[]);
 assert.match(alignmentRefusals(p,{cell:cubic,sites:perovskite.slice(1)}).join(' '),/bileşim farklı: Sr 1\/0/);
 assert.match(alignmentRefusals(p,{cell:{...cubic,a:5},sites:perovskite}).join(' '),/a ekseni/);
 assert.match(alignmentRefusals(p,{cell:{...cubic,gamma:120},sites:perovskite}).join(' '),/gamma/);
 assert.match(alignmentRefusals(p,{cell:cubic,sites:perovskite.map((s,i)=>i?s:{...s,occupancy:.5})}).join(' '),/kısmi dolu/);
 assert.throws(()=>alignPhases(p,{cell:cubic,sites:perovskite.map(s=>s.symbol==='Sr'?{...s,symbol:'Ba'}:s)}),/bileşim/);
});

test('an exact internal translation leaves equally good shifts (no false preference)',()=>{
 const cell={...cubic,a:7.81};
 const doubled=[0,1].flatMap(i=>perovskite.map(s=>({...s,label:s.label+'_'+i,x:(s.x+i)/2})));
 const result=alignPhases({cell,sites:doubled},{cell,sites:doubled.map(s=>({...s,x:s.x+.5}))});
 close(result.rmsd,0,1e-9);
});

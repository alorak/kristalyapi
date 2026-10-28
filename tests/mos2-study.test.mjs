import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMos2Structure,createMos2StudyManifest} from '../mos2-defect-study-core.js';

// Synthetic 1H-MoS2 single-layer cell, used only to test geometry bookkeeping.
// It does not claim reproducing the published SIESTA-relaxed coordinates.
const cell={a:12.64,b:12.64,c:25,alpha:90,beta:90,gamma:120};
const base=[
 {symbol:'Mo',x:0,y:0,z:0.5,occupancy:1},
 {symbol:'S',x:1/3,y:2/3,z:0.562,occupancy:1},
 {symbol:'S',x:1/3,y:2/3,z:0.438,occupancy:1}
];
function structure(){
 const sites=[];
 for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(const atom of base)
  sites.push({...atom,x:(atom.x+i)/4,y:(atom.y+j)/4});
 return {name:'MoS2 4x4x1',cell:{...cell},sites,explicitP1:true,nonPeriodic:false};
}
function withoutSulfur(model,count=1){
 let removed=0;
 model.sites=model.sites.filter(atom=>{
  if(atom.symbol==='S'&&removed<count){removed++;return false;}
  return true;
 });
 return model;
}
const analyze=model=>analyzeMos2Structure(model);

test('pristine explicit 4x4x1 MoS2 is recognized without pretending DFT was run',()=>{
 const a=analyze(structure());
 assert.deepEqual(a.counts,{Mo:16,S:32});
 assert.equal(a.candidate,'pristine');
 assert.equal(a.moPlanes,1);
 assert.ok(a.largestPeriodicEmptyGapAngstrom>20);
 assert.equal(a.geometryReady,true);
 assert.match(a.warnings.join(' '),/DFT/);
});
test('one missing S and two missing S atoms are candidate vacancies, not adjacency claims',()=>{
 const v1=analyze(withoutSulfur(structure()));
 assert.equal(v1.candidate,'V_S');
 assert.equal(v1.sulfurDeficit,1);
 const v2=analyze(withoutSulfur(structure(),2));
 assert.equal(v2.candidate,'V_2S');
 assert.match(v2.candidateLabel,/komşuluk doğrulanmadı/);
});
test('oxygen substitution is distinct from an O2 vacancy candidate',()=>{
 const sub=structure();
 sub.sites.find(site=>site.symbol==='S').symbol='O';
 assert.equal(analyze(sub).candidate,'O_S');
 const ads=withoutSulfur(structure());
 ads.sites.push(
  {symbol:'O',x:.2,y:.3,z:.67,occupancy:1},
  {symbol:'O',x:.2,y:.3,z:.72,occupancy:1}
 );
 const result=analyze(ads);
 assert.equal(result.candidate,'O2_at_VS_candidate');
 assert.match(result.candidateLabel,/doğrulanmadı/);
});
test('multi-layer model and insufficient c vacuum fail the geometry preflight',()=>{
 const bulk=structure();
 for(const atom of structure().sites)bulk.sites.push({...atom,z:atom.z<.5?atom.z-.25:atom.z+.25});
 const a=analyze(bulk);
 assert.equal(a.moPlanes,2);
 assert.equal(a.geometryReady,false);
 const short=structure();short.cell.c=8;
 const b=analyze(short);
 assert.ok(b.largestPeriodicEmptyGapAngstrom<15);
 assert.equal(b.geometryReady,false);
});
test('non-P1, nonperiodic and tilted c-axis cannot pass as ready',()=>{
 const noP1=structure();noP1.explicitP1=false;
 assert.equal(analyze(noP1).geometryReady,false);
 const free=structure();free.nonPeriodic=true;
 assert.equal(analyze(free).geometryReady,false);
 const skew=structure();skew.cell.beta=83;
 assert.equal(analyze(skew).largestPeriodicEmptyGapAngstrom,null);
 assert.equal(analyze(skew).geometryReady,false);
});
test('partial occupancy, invalid coordinates and missing cell block manifest export',()=>{
 const partial=structure();partial.sites[0].occupancy=.5;
 assert.ok(analyze(partial).errors.length>0);
 assert.throws(()=>createMos2StudyManifest(partial),/doluluk/);
 const invalid=structure();invalid.sites[0].z=1.3;
 assert.ok(analyze(invalid).errors.length>0);
 const missing=structure();delete missing.cell.gamma;
 assert.ok(analyze(missing).errors.length>0);
});
test('manifest records only geometry and explicit absence of calculations and experiments',()=>{
 const model=withoutSulfur(structure());
 const manifest=createMos2StudyManifest(model);
 assert.equal(manifest.schema,'kristalyapi.mos2-defect-preflight.v1');
 assert.equal(manifest.reference.doi,'10.1021/acsnano.2c09209');
 assert.equal(manifest.analysis.candidate,'V_S');
 assert.equal(manifest.sites.length,47);
 assert.equal(manifest.calculation.performed,false);
 assert.equal(manifest.experiment.performed,false);
 assert.equal(manifest.experiment.photonAntibunching,false);
 assert.equal(manifest.cell.c,25);
 assert.match(manifest.limitations.join(' '),/not physical UV irradiation/);
});

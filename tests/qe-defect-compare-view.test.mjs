import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../qe-defect-compare-view.js',import.meta.url),'utf8');
const {parseDefectComparisonResult,renderDefectComparison}=await import(
 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')
);
const makeCase=(id,shift=null)=>{
 const definitions={pristine:[2,4,0],V_S:[2,3,0],V_2S:[2,2,0],O_S:[2,3,1],O2_at_VS:[2,3,2]};
 const [mo,s,o]=definitions[id];
 const moGroup={atom_count:2,orbitals_mean_per_atom:{d:[.02,.05,.03]}};
 const near={Mo:moGroup};
 const far={Mo:{atom_count:1,orbitals_mean_per_atom:{d:[.01,.03,.02]}}};
 return {id,kind:id,label:id,counts:{Mo:mo,S:s,O:o},
  energy_ev_raw:[-1,0,1],
  energy_ev_aligned:shift===null?null:[-1-shift,-shift,1-shift],
  reference_energy_ev:shift,
  reference_evidence:shift===null?null:'planar average electrostatic potential output',
  pdos:{near,far},reference_mapping:{
   matches:[{case_atom_index:1,pristine_atom_index:1,distance_angstrom:0}],
   unmatched_case_indices:[]},
  center_fractional:[1/3,2/3,.55],
  near_atom_indices:[1,2],far_atom_indices:Array.from({length:mo+s+o-2},(_,i)=>i+3),
  input_sha256:'a'.repeat(64)};
};
const make=(aligned=false)=>({
 schema:'kristalyapi.mos2-defect-comparison.v1',
 alignment_status:aligned?'user_supplied_vacuum_alignment_unverified':'unaligned',
 alignment_method:aligned?'vacuum_potential':null,
 near_radius_angstrom:3.6,
 cases:[makeCase('pristine',aligned?-4:null),makeCase('V_S',aligned?-3.9:null),
  makeCase('V_2S',aligned?-4.1:null),makeCase('O_S',aligned?-3.8:null),
  makeCase('O2_at_VS',aligned?-3.7:null)]
});
test('five distinct models accepted without an invented energy zero',()=>{
 const result=parseDefectComparisonResult(make());
 assert.equal(result.cases.length,5);
 assert.equal(result.aligned,false);
 assert.deepEqual(result.cases[0].energy,[-1,0,1]);
});
test('externally supplied vacuum alignment is labeled unverified',()=>{
 const result=parseDefectComparisonResult(make(true));
 assert.equal(result.aligned,true);
 assert.deepEqual(result.cases[0].energy,[3,4,5]);
 assert.match(result.alignmentStatus,/unverified/);
});
test('no aligned values permitted without all external references',()=>{
 const mixed=make();mixed.cases[0].energy_ev_aligned=[3,4,5];
 assert.throws(()=>parseDefectComparisonResult(mixed),/Referans yokken/);
 const bad=make(true);bad.cases[1].reference_evidence=null;
 assert.throws(()=>parseDefectComparisonResult(bad),/kanıt/);
 const badAxis=make(true);badAxis.cases[1].energy_ev_aligned=[0,1,2];
 assert.throws(()=>parseDefectComparisonResult(badAxis),/tutarsız/);
});
test('reject unsupported case names, wrong stoichiometry and bad structure indices',()=>{
 const name=make();name.cases[1].id='unknown';
 assert.throws(()=>parseDefectComparisonResult(name),/kusur türleri/);
 const chemistry=make();chemistry.cases[1].counts.S=4;
 assert.throws(()=>parseDefectComparisonResult(chemistry),/bileşimi/);
 const atomCount=make();atomCount.cases[1].far_atom_indices=[];
 assert.throws(()=>parseDefectComparisonResult(atomCount),/atom sayıları/);
});
test('reject nonfinite, unsorted and negative PDOS curves',()=>{
 const nonfinite=make();nonfinite.cases[0].energy_ev_raw[1]=NaN;
 assert.throws(()=>parseDefectComparisonResult(nonfinite),/sayısal eksen/);
 const decreasing=make();decreasing.cases[0].energy_ev_raw=[2,0,-1];
 assert.throws(()=>parseDefectComparisonResult(decreasing),/artan sırada/);
 const negative=make();negative.cases[0].pdos.near.Mo.orbitals_mean_per_atom.d[1]=-.2;
 assert.throws(()=>parseDefectComparisonResult(negative),/uyumsuz/);
});
test('renderer keeps independent energy axes when unaligned and overlays only on evidence',()=>{
 class Fake {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={};this.textContent='';this.value='';this.handlers={};}
  setAttribute(name,value){this.attributes[name]=value;}
  append(...nodes){this.children.push(...nodes);if(this.tag==='select'&&!this.value)this.value=this.children[0]?.value;}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(event,cb){this.handlers[event]=cb;}
 }
 const prior=globalThis.document;
 globalThis.document={createElement:tag=>new Fake(tag),createElementNS:(ns,tag)=>new Fake(tag)};
 try{
  const host=new Fake('div');
  renderDefectComparison(host,parseDefectComparisonResult(make()));
  const charts=host.children.find(c=>c.tag==='div'&&c.children.some(x=>x.tag==='svg'));
  assert.equal(charts.children.filter(c=>c.tag==='svg').length,2);
  const aligned=new Fake('div');
  renderDefectComparison(aligned,parseDefectComparisonResult(make(true)));
  const overlay=aligned.children.find(c=>c.tag==='div'&&c.children.some(x=>x.tag==='svg'));
  assert.equal(overlay.children.filter(c=>c.tag==='svg').length,1);
 }finally{
  if(prior===undefined)delete globalThis.document;
  else globalThis.document=prior;
 }
});

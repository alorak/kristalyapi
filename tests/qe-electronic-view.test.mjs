import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../qe-electronic-view.js',import.meta.url),'utf8');
const {parseQeElectronicResult}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const valid=()=>({
 schema:'kristalyapi.qe-electronic.v1',
 source:'Quantum ESPRESSO, local pw.x calculation',
 energy_zero:'QE internal',
 input_sha256:'a'.repeat(64),
 band_path_labels:['Gamma','M','K','Gamma'],
 bands:{distance:[0,.5,1],energies_ev:[[-1,-.8,-.4],[.2,.4,.6]]},
 dos:{energy_ev:[-1,0,1],dos_states_per_ev:[.1,.2,.3]},
 pdos_total:{energy_ev:[-1,0,1],sum_projected_states_per_ev:[.02,.15,.21]}
});
test('strict schema parses real calculation shaped bands and DOS without Fermi alignment',()=>{
 const x=parseQeElectronicResult(valid());
 assert.deepEqual(x.bands.curves[1],[.2,.4,.6]);
 assert.deepEqual(x.pdos,[.02,.15,.21]);
 assert.match(x.energyZero,/QE internal/);
 assert.equal(x.inputHash,'a'.repeat(64));
});
test('wrong schema or empty payload is not accepted as DFT output',()=>{
 assert.throws(()=>parseQeElectronicResult({schema:'kristalyapi.qe-pipeline.v1'}),/şema/);
 assert.throws(()=>parseQeElectronicResult({schema:'kristalyapi.qe-electronic.v1'}),/Bant veya DOS/);
});
test('nonfinite, unsorted or mismatched band data are rejected',()=>{
 const bad=valid();bad.bands.energies_ev[0][1]=NaN;
 assert.throws(()=>parseQeElectronicResult(bad),/geçersiz/);
 const unsorted=valid();unsorted.bands.distance=[1,0,2];
 assert.throws(()=>parseQeElectronicResult(unsorted),/sıralı/);
 const unequal=valid();unequal.bands.energies_ev[0]=[.5,.8];
 assert.throws(()=>parseQeElectronicResult(unequal),/eşleşmiyor/);
});
test('DOS requires strictly ordered axes and rejects negative data',()=>{
 const bad=valid();bad.dos.energy_ev=[-1,-1,0];
 assert.throws(()=>parseQeElectronicResult(bad),/artan/);
 const badY=valid();badY.dos.dos_states_per_ev=[.1,-.2,.3];
 assert.throws(()=>parseQeElectronicResult(badY),/uyumsuz/);
});
test('PDOS must use the same eV grid as DOS',()=>{
 const bad=valid();bad.pdos_total.energy_ev=[-1.2,0,1];
 assert.throws(()=>parseQeElectronicResult(bad),/uyumsuz/);
});
test('plot inputs have deterministic computational bound',()=>{
 const bad=valid();bad.bands.distance=Array.from({length:2000},(_,i)=>i);
 bad.bands.energies_ev=Array.from({length:100},()=>Array.from({length:2000},()=>1));
 assert.throws(()=>parseQeElectronicResult(bad),/120.000/);
});

function atomPdos(){
 const v=valid();
 v.pdos_total.sum_projected_states_per_ev=[.06,.2,.27];
 v.pdos_atoms={
  spin_mode:'collinear-unpolarized',
  energy_ev:[-1,0,1],
  atoms:[
   {atom_index:1,element:'Mo',total_dos_states_per_ev:[.02,.1,.12],
    orbitals:{d:[.02,.1,.12]}},
   {atom_index:2,element:'S',total_dos_states_per_ev:[.04,.1,.15],
    orbitals:{s:[.01,.02,.03],p:[.03,.08,.12]}}
  ],
  elements:[
   {element:'Mo',total_dos_states_per_ev:[.02,.1,.12],orbitals:{d:[.02,.1,.12]}},
   {element:'S',total_dos_states_per_ev:[.04,.1,.15],
    orbitals:{s:[.01,.02,.03],p:[.03,.08,.12]}}
  ]
 };
 return v;
}
test('atom-resolved Mo-d and S-p PDOS is accepted against total projection',()=>{
 const result=parseQeElectronicResult(atomPdos());
 assert.equal(result.pdosDetailed.atoms.length,2);
 assert.deepEqual(result.pdosDetailed.elements[0].orbitals.d,[.02,.1,.12]);
 assert.deepEqual(result.pdosDetailed.elements[1].orbitals.p,[.03,.08,.12]);
});
test('atomic contributions must reconcile with overall projected DOS',()=>{
 const input=atomPdos();
 input.pdos_atoms.atoms[0].total_dos_states_per_ev[1]=.5;
 input.pdos_atoms.atoms[0].orbitals.d[1]=.5;
 assert.throws(()=>parseQeElectronicResult(input),/uyuşmuyor/);
});
test('reject spin-resolved output, extra orbital names and mismatched grids',()=>{
 const spin=atomPdos();spin.pdos_atoms.spin_mode='spin-polarized';
 assert.throws(()=>parseQeElectronicResult(spin),/spin-polarize/);
 const unsupported=atomPdos();unsupported.pdos_atoms.atoms[0].orbitals.j=[.02,.1,.12];
 assert.throws(()=>parseQeElectronicResult(unsupported),/Desteklenmeyen/);
 const grid=atomPdos();grid.pdos_atoms.energy_ev=[-1,0.2,1];
 assert.throws(()=>parseQeElectronicResult(grid),/enerji ekseni/);
});
test('old QE output without per-atom PDOS remains backward compatible',()=>{
 const result=parseQeElectronicResult(valid());
 assert.equal(result.pdosDetailed,null);
});

test('orbital selector renders per-atom PDOS against total projection without claiming PL',async()=>{
 const previous=globalThis.document;
 class FakeNode{
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.style={};this.textContent='';this.value='';this.listeners={};}
  append(...children){this.children.push(...children);if(this.tag==='select'&&!this.value)this.value=this.children[0]?.value||'';}
  replaceChildren(...children){this.children=children;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(name,callback){this.listeners[name]=callback;}
  set selectedIndex(i){this.value=this.children[i]?.value||'';}
 }
 globalThis.document={
  createElement(tag){return new FakeNode(tag);},
  createElementNS(ns,tag){return new FakeNode(tag);}
 };
 try{
  const {renderQeElectronicResults}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const host=new FakeNode('div');
  const result=parseQeElectronicResult(atomPdos());
  renderQeElectronicResults(host,result);
  const selects=host.children.filter(node=>node.tag==='select');
  assert.equal(selects.length,1);
  assert.ok(selects[0].children.some(child=>String(child.textContent).includes('Mo')));
  const slots=host.children.filter(node=>node.tag==='div');
  assert.ok(slots.some(slot=>slot.children[0]?.tag==='svg'));
  assert.match(host.children.at(-1).textContent,/optik geçiş kanıtı değildir/);
  assert.equal(result.pdosDetailed.elements.length,2);
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
});

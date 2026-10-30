import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../qe-electronic-view.js',import.meta.url),'utf8');
const {parseQeElectronicResult,electronicEnergyRange,checkedEnergyWindow,electronicCsv}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

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
  const walk=node=>[node,...node.children.flatMap(walk)];
  const all=walk(host);
  const selects=all.filter(node=>node.tag==='select');
  assert.equal(selects.length,1);
  assert.ok(selects[0].children.some(child=>String(child.textContent).includes('Mo')));
  const slots=all.filter(node=>node.tag==='div');
  assert.ok(slots.some(slot=>slot.children[0]?.tag==='svg'));
  assert.ok(all.some(node=>/optik geçiş kanıtı değildir/.test(node.textContent)));
  assert.equal(result.pdosDetailed.elements.length,2);
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
});

test('energy windows bound display without changing full raw samples',()=>{
 const data=parseQeElectronicResult(valid()),before=JSON.stringify(data);
 assert.deepEqual(electronicEnergyRange(data),[-1,1]);
 assert.deepEqual(checkedEnergyWindow(data,-.5,.5),[-.5,.5]);
 for(const [lo,hi] of [[1,1],[2,3],[NaN,1],[-1,Infinity]])assert.throws(()=>checkedEnergyWindow(data,lo,hi));
 assert.equal(JSON.stringify(data),before);
 const bands=electronicCsv(data,'bands').trim().split('\n');assert.equal(bands.length,4);assert.match(bands[1],/^-?0,/);assert.match(bands[0],/band_1_ev.*energy_zero.*input_sha256/);
 const dos=electronicCsv(data,'dos').trim().split('\n');assert.equal(dos.length,4);assert.match(dos[1],/^-1,/);assert.match(dos.at(-1),/^1,/);
});
test('CSV preserves all atom/orbital groups and escapes untrusted energy labels',()=>{
 const data=parseQeElectronicResult(atomPdos());data.energyZero='=unsafe,"label"';
 const csv=electronicCsv(data,'dos');assert.match(csv,/Mo_d_states_per_ev/);assert.match(csv,/atom_1_Mo_d_states_per_ev/);assert.ok(csv.includes('"\'=unsafe,""label"""'));
 assert.throws(()=>electronicCsv({bands:null,dos:null},'bands'));
});

test('large band windows and CSV retain original band numbers',()=>{
 const raw=valid();raw.bands.band_index_start=101;raw.bands.total_bands=416;
 const parsed=parseQeElectronicResult(raw);assert.equal(parsed.bands.firstBand,101);assert.equal(parsed.bands.totalBands,416);
 assert.match(electronicCsv(parsed,'bands').split('\n')[0],/band_101_ev.*band_102_ev/);
 raw.bands.band_index_start=416;assert.throws(()=>parseQeElectronicResult(raw));
});

function spinFixture(){
 const base=atomPdos(),channel=c=>({schema:'kristalyapi.qe-spin-channel.v1',spin_mode:'collinear-polarized',spin_channel:c,bands:structuredClone(base.bands),dos:structuredClone(base.dos),pdos_total:structuredClone(base.pdos_total),pdos_atoms:{...structuredClone(base.pdos_atoms),spin_mode:'collinear-polarized',spin_channel:c}});
 return {...base,schema:'kristalyapi.qe-electronic.v2',spin_mode:'collinear-polarized',channels:{up:channel('up'),down:channel('down')},magnetization:{total_mu_b_per_cell:0,absolute_mu_b_per_cell:.1},integrated_dos_total:{energy_ev:base.dos.energy_ev,states:[0,1,2]}};
}
test('spin v2 keeps up/down channels and shared integral separate in parsing and CSV',()=>{
 const raw=spinFixture(),before=JSON.stringify(raw),result=parseQeElectronicResult(raw);
 assert.equal(result.channels.up.spinChannel,'up');assert.equal(result.channels.down.spinChannel,'down');
 assert.deepEqual(result.integratedDosTotal.states,[0,1,2]);assert.equal(JSON.stringify(raw),before);
 const csv=electronicCsv(result.channels.down,'dos');assert.match(csv,/spin_channel/);assert.match(csv,/,"down",/);
 assert.throws(()=>electronicCsv(result,'dos'),/kanal/);
});
test('spin v2 rejects mixed identities, missing channels, grids and projection sums',()=>{
 for(const mutate of [v=>delete v.channels.down,v=>v.channels.down.spin_channel='up',v=>v.channels.down.pdos_atoms.spin_channel='up',
  v=>v.channels.down.bands.distance[1]=.6,v=>v.channels.up.pdos_atoms.atoms[0].orbitals.d[0]=99,
  v=>v.integrated_dos_total.states[1]=-1,v=>v.magnetization.total_mu_b_per_cell=10,v=>v.input_sha256='bad',
  v=>v.channels.up.schema='kristalyapi.qe-electronic.v1']){
  const raw=spinFixture();mutate(raw);assert.throws(()=>parseQeElectronicResult(raw));
 }
});

test('archived real Si spin spectra parse both eight-band channels without altering raw data',()=>{
 const data=JSON.parse(readFileSync(new URL('../validation-results/qe-spin-si-20261030-arm64/pipeline/electronic-results.json',import.meta.url),'utf8'));
 const parsed=parseQeElectronicResult(data);
 for(const channel of ['up','down']){assert.equal(parsed.channels[channel].bands.curves.length,8);assert.equal(parsed.channels[channel].dos.energy.length,1401);assert.equal(parsed.channels[channel].pdosDetailed.atoms.length,2);}
});

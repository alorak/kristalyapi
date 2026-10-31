import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shelxSymmetry,shelxResText,castepCellText,qeStructureInputText,xsfStructureText,magneticCifText} from '../structure-export.js';

const app=fs.readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
const SPACE_GROUPS=JSON.parse(app.match(/^const SPACE_GROUPS=(\{.*\});$/m)[1]);
const settingKey=n=>Object.keys(SPACE_GROUPS).find(k=>k===String(n)||k.startsWith(n+'-'));
const pairs=key=>{const [centring,ops]=SPACE_GROUPS[SPACE_GROUPS[key]?key:settingKey(key)];return ops.flatMap(op=>centring.map(shift=>[op,shift]));};
const cubic=a=>({cell:{a,b:a,c:a,alpha:90,beta:90,gamma:90},basis:[[a,0,0],[0,a,0],[0,0,a]]});

test('SHELX LATT/SYMM: centring type, centrosymmetry and the listed operations',()=>{
 assert.deepEqual(shelxSymmetry([['x,y,z','0,0,0']]),{latt:-1,symm:[],count:1});
 assert.deepEqual(shelxSymmetry(pairs('2')),{latt:1,symm:[],count:2},'P-1');
 const p21c=shelxSymmetry(pairs('14'));
 assert.equal(p21c.latt,1);assert.equal(p21c.symm.length,1,'P2_1/c lists one operation beside the inversion');
 // Origin choice 1 of Fd-3m has its inversion centre at 1/8,1/8,1/8, not at
 // the origin: SHELX then needs a negative LATT and every operation listed.
 const fd3m=shelxSymmetry(pairs('227-1'));
 assert.equal(fd3m.latt,-4,'F centring, no inversion at the origin');assert.equal(fd3m.count,192);
 assert.equal(fd3m.symm.length,47,'48 point operations minus x,y,z');
 for(const key of Object.keys(SPACE_GROUPS)){
  const s=shelxSymmetry(pairs(key));
  if(!s)continue; // reverse-setting rhombohedral etc. fall back to P1
  assert.ok(Math.abs(s.latt)>=1&&Math.abs(s.latt)<=7,key);
  assert.ok(s.symm.every(op=>/^[-+0-9XYZ/,]+$/.test(op)),key);
 }
});

test('SHELX .res: special positions get m/M occupancies and UNIT counts the cell',()=>{
 const si={name:'Si',...cubic(5.431),sites:[{symbol:'Si',label:'Si1',x:0,y:0,z:0,occupancy:1}],symmetry:{pairs:pairs('227-1')}};
 const {text,losses}=shelxResText(si);
 assert.match(text,/^TITL Si\n/);assert.match(text,/\nCELL 0\.71073 5\.43100 5\.43100 5\.43100 90\.00000 90\.00000 90\.00000\n/);
 assert.match(text,/\nLATT -4\n/);assert.match(text,/\nSFAC Si\nUNIT 8\n/,'eight Si atoms per conventional cell');
 // Site 8a in Fd-3m: 8 of the 192 general positions → SOF 10 + 8/192.
 assert.match(text,/\nSi1  1 0\.000000 0\.000000 0\.000000 10\.04167 0\.05000\n/);
 assert.ok(losses.some(l=>l.code==='wavelength')&&losses.some(l=>l.code==='uiso'));
 assert.match(text,/\nREM Not exported \/ limitation: CELL wavelength unknown/);
 assert.match(text,/\nHKLF 4\nEND\n$/);
 const long=shelxResText({...si,sites:[{...si.sites[0],label:'Si_long(1)'}]});
 assert.match(long.text,/\nSilo 1 /);assert.ok(long.losses.some(l=>l.code==='labels'));
});

test('CASTEP, QE and XSF list every atom; DFT formats refuse partial occupancy',()=>{
 const nacl={name:'NaCl',...cubic(5.64),sites:[{symbol:'Na',label:'Na1',x:0,y:0,z:0,occupancy:1},{symbol:'Cl',label:'Cl1',x:.5,y:.5,z:.5,occupancy:1}]};
 const cell=castepCellText(nacl).text;
 assert.match(cell,/%BLOCK LATTICE_CART\nang\n5\.640000000 0\.000000000 0\.000000000\n/);
 assert.match(cell,/%BLOCK POSITIONS_FRAC\nNa 0\.000000000 0\.000000000 0\.000000000\nCl 0\.500000000 0\.500000000 0\.500000000\n%ENDBLOCK POSITIONS_FRAC/);
 const qe=qeStructureInputText(nacl).text;
 assert.match(qe,/nat = 2\n  ntyp = 2\n/);assert.match(qe,/ATOMIC_SPECIES\nNa 22\.98977 Na\.UPF\nCl 35\.45000 Cl\.UPF\n/);
 assert.match(qe,/CELL_PARAMETERS angstrom\n/);assert.match(qe,/ATOMIC_POSITIONS crystal\n/);assert.match(qe,/! Not exported \/ limitation: Pseudopotential/);
 const xsf=xsfStructureText(nacl).text;
 assert.match(xsf,/^CRYSTAL\nPRIMVEC\n/);assert.match(xsf,/PRIMCOORD\n2 1\n11 0\.000000000 0\.000000000 0\.000000000\n17 2\.820000000 2\.820000000 2\.820000000\n$/);
 const molecule=xsfStructureText({...nacl,nonPeriodic:true});
 assert.match(molecule.text,/\nATOMS\n11 /);assert.ok(molecule.losses.some(l=>l.code==='molecule'));
 const half={...nacl,sites:[{...nacl.sites[0],occupancy:.5},nacl.sites[1]]};
 assert.throws(()=>castepCellText(half),/Kısmi/);assert.throws(()=>qeStructureInputText(half),/Kısmi/);
 assert.ok(xsfStructureText(half).losses.some(l=>l.code==='occupancy'),'XSF writes the atom but says so');
});

test('magnetic CIF: P1 BNS 1.1 with crystal-axis moment components',()=>{
 const a=5,c=7,beta=110*Math.PI/180;
 const basis=[[a,0,0],[0,6,0],[c*Math.cos(beta),0,c*Math.sin(beta)]];
 const moment=[1,0,2]; // Cartesian μB
 const model={name:'Fe',cell:{a,b:6,c,alpha:90,beta:110,gamma:90},basis,
  sites:[{symbol:'Fe',label:'Fe1',x:.1,y:.2,z:.3,occupancy:1,magneticMoment:moment}]};
 const {text}=magneticCifText(model);
 assert.match(text,/_space_group_magn\.number_BNS 1\.1\n/);assert.match(text,/_space_group_symop_magn_operation\.xyz\n1 x,y,z,\+1\n/);
 const [mx,my,mz]=text.match(/\nFe1 (\S+) (\S+) (\S+)\n?$/).slice(1).map(Number);
 // Rebuild the Cartesian moment from the components along unit a, b, c.
 const unit=basis.map(v=>v.map(x=>x/Math.hypot(...v)));
 const back=[0,1,2].map(k=>mx*unit[0][k]+my*unit[1][k]+mz*unit[2][k]);
 back.forEach((v,i)=>assert.ok(Math.abs(v-moment[i])<1e-4,back+' vs '+moment));
 assert.throws(()=>magneticCifText({...model,symmetry:{pairs:[['x,y,z','0,0,0']]}}),/P1/);
 assert.throws(()=>magneticCifText({...model,sites:[{...model.sites[0],magneticMoment:undefined}]}),/moment/);
});

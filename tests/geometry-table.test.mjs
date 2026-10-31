import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSymop,formatSymop,symmetryOperations,symmetryCode,geometryTable,formatWithSu,geometryCsv,geometryCif,
 bondLength,bondAngle,torsionAngle,hydrogenBonds,hydrogenBondCifLoop,HBOND_DEFAULTS} from '../geometry-table.js';

const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,a+' ≉ '+b);
const app=fs.readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
const SPACE_GROUPS=JSON.parse(app.match(/^const SPACE_GROUPS=(\{.*\});$/m)[1]);
const pairs=key=>{const [centring,ops]=SPACE_GROUPS[key];return ops.flatMap(op=>centring.map(shift=>[op,shift]));};
const cubic=a=>({a,b:a,c:a,alpha:90,beta:90,gamma:90});

test('every bundled setting parses, starts with the identity and formats back to the same matrices',()=>{
 for(const key of Object.keys(SPACE_GROUPS)){
  const ops=symmetryOperations(pairs(key));
  for(const op of ops){
   const again=parseSymop(formatSymop(op));
   assert.deepEqual(again.R,op.R,key);again.t.forEach((v,i)=>close(v,op.t[i],1e-9));
  }
 }
 assert.equal(Object.keys(SPACE_GROUPS).length,274);
 assert.equal(formatSymop(parseSymop('x-y,-y+1/2, z')),'x-y,-y+1/2,z');
 assert.throws(()=>parseSymop('x,y'),/üç/);assert.throws(()=>symmetryOperations([['-x,-y,-z','0,0,0']]),/birim/);
 assert.equal(symmetryCode(0,[0,0,0]),'.');assert.equal(symmetryCode(2,[1,-1,0]),'3_645');
});

test('diamond silicon: bonds, angles and torsions in P1 and in Fd-3m with symmetry codes',()=>{
 const f=[[0,0,0],[.25,.25,.25],[.5,.5,0],[.75,.75,.25],[.5,0,.5],[.75,.25,.75],[0,.5,.5],[.25,.75,.75]];
 const p1=geometryTable(f.map((p,i)=>({label:'Si'+(i+1),symbol:'Si',x:p[0],y:p[1],z:p[2]})),cubic(5.431),
  symmetryOperations([['x,y,z','0,0,0']]),()=>[.5,2.6],{torsions:true});
 assert.equal(p1.bonds.length,16,'8 atoms × 4 bonds / 2');
 for(const b of p1.bonds)close(b.value,5.431*Math.sqrt(3)/4);
 assert.equal(p1.angles.length,48);for(const a of p1.angles)close(a.value,109.4712206,1e-6);
 assert.equal(p1.torsions.length,144,'16 bonds × 3 × 3, each torsion once');
 const counts={};for(const t of p1.torsions){const k=Math.round(t.value);counts[k]=(counts[k]||0)+1;}
 assert.deepEqual(counts,{'60':48,'-60':48,'180':48});
 const fd=geometryTable([{label:'Si1',symbol:'Si',x:0,y:0,z:0}],cubic(5.431),symmetryOperations(pairs('227-1')),()=>[.5,2.6]);
 assert.equal(fd.bonds.length,4,'four symmetry-related bonds of the single site');
 assert.ok(fd.bonds.every(b=>/^\d+_\d{3}$/.test(b.codes[1])),'neighbours are symmetry images with codes');
 assert.equal(fd.angles.length,6);
 assert.equal(geometryTable([{label:'Cu1',symbol:'Cu',x:0,y:0,z:0}],cubic(3),symmetryOperations([['x,y,z','0,0,0']]),()=>[.5,3.2]).bonds.length,3,
  '±a are one bond moved by a lattice translation');
});

test('standard uncertainties follow uncorrelated cell and coordinate e.s.d.s',()=>{
 const ops=symmetryOperations([['x,y,z','0,0,0']]),range=()=>[.5,3];
 const two=[{label:'A',symbol:'Na',x:0,y:0,z:0},{label:'B',symbol:'Cl',x:.5,y:0,z:0}];
 // d = a·Δx = 2.5 Å; σ(a) = 0.002 → σ(d) = 0.001.
 const cell=geometryTable(two,cubic(5),ops,range,{cellSu:{a:.002}});
 close(cell.bonds[0].value,2.5);close(cell.bonds[0].su,.001,1e-9);
 // Independent x e.s.d.s of both atoms: σ(d) = a·√2·σ(x).
 const coords=geometryTable(two.map(s=>({...s,su:{x:.0002,y:.0002,z:.0002}})),cubic(5),ops,range);
 close(coords.bonds[0].su,5*Math.SQRT2*.0002,1e-9);
 // The same site and its translation image move together: a·Δx has no coordinate s.u.
 const self=geometryTable([{label:'Cu1',symbol:'Cu',x:.1,y:.2,z:.3,su:{x:.001,y:.001,z:.001}}],cubic(3),ops,()=>[.5,3.2]);
 close(self.bonds[0].su,0,1e-12);
 assert.equal(geometryTable(two,cubic(5),ops,range).bonds[0].su,null,'no e.s.d.s: no s.u.');
});

test('crystallographic number formatting, CSV and CIF _geom output',()=>{
 assert.equal(formatWithSu(2.35174,.00023),'2.3517(2)');assert.equal(formatWithSu(2.35174,.00015),'2.35174(15)');
 assert.equal(formatWithSu(109.4712,.015,{decimals:2}),'109.471(15)');assert.equal(formatWithSu(1.2,null),'1.2000');
 assert.equal(formatWithSu(123.4,25),'123(25)');
 const ops=symmetryOperations(pairs('227-1'));
 const rows=geometryTable([{label:'Si1',symbol:'Si',x:0,y:0,z:0}],cubic(5.431),ops,()=>[.5,2.6],{torsions:true});
 const csv=geometryCsv(rows);
 assert.match(csv,/^type,atoms,symmetry_codes,value,su,unit\n/);assert.match(csv,/\nbond,Si1-Si1,\. \d+_\d{3},2\.351\d+,,angstrom\n/);
 const cif=geometryCif(rows,ops,{name:'Si',spaceGroup:'F d -3 m',note:'test'});
 assert.match(cif,/^data_Si_geom\n/);assert.match(cif,/_space_group_symop_operation_xyz\n1 x,y,z\n/);
 assert.equal((cif.match(/^\d+ \S+$/gm)||[]).length,ops.length,'every operation a code may refer to is listed');
 assert.match(cif,/_geom_bond_site_symmetry_2\n_geom_bond_publ_flag\nSi1 Si1 2\.3517 \d+_\d{3} \?\n/);
 assert.match(cif,/_geom_angle_site_symmetry_3/);assert.match(cif,/_geom_torsion_site_symmetry_4/);
 assert.match(cif,/_audit_comment\n;test\n;\n/);
});

test('geometric quantities and torsion sign convention',()=>{
 close(bondLength([[0,0,0],[3,4,0]]),5);close(bondAngle([[1,0,0],[0,0,0],[0,1,0]]),90);
 // Positive when A turns clockwise onto D, looking along B→C (IUPAC).
 close(torsionAngle([[1,0,0],[0,0,0],[0,0,1],[0,1,1]]),90);
 close(torsionAngle([[1,0,0],[0,0,0],[0,0,1],[-1,0,1]]),180);
});

test('hydrogen bonds: D–H···A geometry, symmetry codes, criteria and CIF loop',()=>{
 const ops=symmetryOperations([['x,y,z','0,0,0']]);
 // A chain: O1–H1 0.96 Å along a, and H1···O1 of the next cell 1.90 Å further on.
 const a=2.86,chain=[{label:'O1',symbol:'O',x:0,y:0,z:0},{label:'H1',symbol:'H',x:.96/a,y:0,z:0}];
 const rows=hydrogenBonds(chain,{a,b:6,c:6,alpha:90,beta:90,gamma:90},ops);
 assert.equal(rows.length,1);
 const [r]=rows;
 assert.deepEqual(r.labels,['O1','H1','O1']);assert.deepEqual(r.codes,['.','.','1_655'],'the acceptor is the next cell along a');
 close(r.dh,.96);close(r.ha,1.9);close(r.da,2.86);close(r.angle,180);
 assert.equal(r.su.ha,null,'no e.s.d.s: no s.u.');
 assert.equal(hydrogenBonds(chain,{a,b:6,c:6,alpha:90,beta:90,gamma:90},ops,{maxHA:1.8}).length,0,'H···A above the limit');
 // Bend the chain so the D–H···A angle drops below 120°.
 const bent=[chain[0],chain[1],{label:'O2',symbol:'O',x:.96/a+.3/a,y:1.85/6,z:0}];
 assert.equal(hydrogenBonds(bent,{a:20,b:6,c:6,alpha:90,beta:90,gamma:90},ops,{periodic:false}).filter(x=>x.labels[2]==='O2').length,0);
 assert.equal(HBOND_DEFAULTS.minAngle,120);
 assert.throws(()=>hydrogenBonds(chain,{a,b:6,c:6,alpha:90,beta:90,gamma:90},ops,{maxHA:1}),/ölçüt/);
 const loop=hydrogenBondCifLoop(rows);
 assert.match(loop,/_geom_hbond_site_symmetry_A\n_geom_hbond_publ_flag\nO1 H1 O1 0\.960 1\.900 2\.860 180\.0 \. \. 1_655 \?\n$/);
 const withH=geometryTable(chain,{a,b:6,c:6,alpha:90,beta:90,gamma:90},ops,()=>[.5,1.2]);withH.hbonds=rows;
 assert.match(geometryCsv(withH),/\nhbond_HA,O1-H1-O1,\. \. 1_655,1\.900000,,angstrom\n/);
 assert.match(geometryCif(withH,ops),/_geom_hbond_angle_DHA/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, {x, y, z}); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  crossVectors(a, b) {
    this.x = a.y * b.z - a.z * b.y;
    this.y = a.z * b.x - a.x * b.z;
    this.z = a.x * b.y - a.y * b.x;
    return this;
  }
  toArray() { return [this.x, this.y, this.z]; }
}
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const moduleScript = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(moduleScript, 'HTML must contain the inline module script');
const script = moduleScript
  .replace(/^import .*?;\s*$/gm, '')
  .replace(/try\{initScene\(\);bind\(\);syncControls\(\);build\(\);fit\(\);\}catch\(err\)\{[\s\S]*?\}\s*$/, '');
const context = { THREE: { Vector3, SphereGeometry: class {}, CylinderGeometry: class {} } };
vm.createContext(context);
vm.runInContext(script + '\nthis.api={validateCell,basis,toCart,toFrac,volume,metric,examples,cifData,poscarData,xyzData,applySymmetry,SPACE_GROUPS,sgKeys,settingOps,expandSites,planeNormal,planeIntersections,minimumPeriodicImage,clipSegmentToCell,periodicBondSegments,parseBondRules,matrixDet,transformCrystal};', context);
const api = context.api;
function approx(a, b, eps = 1e-7) { assert.ok(Math.abs(a - b) < eps, a + ' expected ' + b); }
const cubic = { a: 5, b: 5, c: 5, alpha: 90, beta: 90, gamma: 90 };
test('unit cell: cubic volume', () => approx(api.volume(api.basis(cubic)), 125));
test('unit cell: triclinic fractional/cartesian round-trip', () => {
  const B = api.basis({a: 3, b: 4, c: 5, alpha: 75, beta: 85, gamma: 95});
  const f = [.16, .43, .81];
  const back = api.toFrac(api.toCart(f, B), B);
  f.forEach((v, i) => approx(back[i], v));
});
test('unit cell: geometrically invalid lattice is rejected', () => {
  assert.throws(() => api.validateCell({a: 3, b: 4, c: 5, alpha: 1, beta: 1, gamma: 179}));
});
test('presets: conventional Si and NaCl cells each contain eight sites', () => {
  assert.equal(api.examples('silicon').sites.length, 8);
  assert.equal(api.examples('nacl').sites.length, 8);
});
const header = [
'data_demo',
'_cell_length_a 4.000(3) # uncertainty',
'_cell_length_b 5',
'_cell_length_c 6',
'_cell_angle_alpha 90',
'_cell_angle_beta 90',
'_cell_angle_gamma 90',
''
].join('\n');
test('CIF: reads numeric uncertainties, strips comments and expands explicit symmetry', () => {
  const cif = header + [
'loop_',
'_space_group_symop_operation_xyz',
"'x,y,z'",
"'-x,-y,-z'",
'loop_',
'_atom_site_label',
'_atom_site_type_symbol',
'_atom_site_fract_x',
'_atom_site_fract_y',
'_atom_site_fract_z',
'_atom_site_occupancy',
'Si1 Si .1 .2 .3 1 # single atom',
''
].join('\n');
  const d = api.cifData(cif);
  assert.equal(d.sites.length, 2);
  approx(d.cell.a, 4);
  approx(d.sites[1].x, .9);
});
test('CIF: warns when non-P1 space group has no operators', () => {
  const cif = header + [
"_space_group_name_H-M_alt 'F m -3 m'",
'loop_',
'_atom_site_label',
'_atom_site_fract_x',
'_atom_site_fract_y',
'_atom_site_fract_z',
'Si1 0 0 0',
''
].join('\n');
  const d = api.cifData(cif);
  assert.equal(d.sites.length, 1);
  assert.match(d.warning, /simetri işlemleri yok/);
});
test('CIF: supports fractional shifts in symmetry expression', () => {
  const got = api.applySymmetry('-x+1/2,y+1/2,-z', [.1, .3, .4]);
  approx(got[0], .4); approx(got[1], .8); approx(got[2], -.4);
});
test('POSCAR: Direct species/counts and positions', () => {
  const poscar = 'NaCl\n1.0\n5 0 0\n0 5 0\n0 0 5\nNa Cl\n1 1\nDirect\n0 0 0\n.5 .5 .5';
  const d = api.poscarData(poscar);
  assert.equal(d.sites.length, 2);
  assert.equal(d.sites[1].symbol, 'Cl');
  approx(d.sites[1].x, .5);
});
test('POSCAR: negative volume scale', () => {
  const poscar = 'negative\n-64\n2 0 0\n0 2 0\n0 0 2\nSi\n1\nDirect\n0 0 0';
  approx(api.poscarData(poscar).cell.a, 4);
});
test('XYZ: places Cartesian positions in a padded non-periodic visual box', () => {
  const d = api.xyzData('2\nCO molecule\nC 0 0 0\nO 1 0 0');
  assert.equal(d.sites.length, 2);
  approx(d.cell.a, 6);
  assert.match(d.warning, /yapay/);
});

test('all 230 space-group numbers have at least one dataset setting', () => {
  for(let n = 1; n <= 230; n++) assert.ok(api.sgKeys(n).length > 0, 'missing SG ' + n);
});
test('all 274 space-group settings reproduce general-position multiplicity', () => {
  for(const [key, data] of Object.entries(api.SPACE_GROUPS)){
    const site = [{symbol:'X', x:.137, y:.237, z:.341}];
    const actual = api.expandSites(site, key).length;
    const expected = data[2][data[2].length-1][1];
    assert.equal(actual, expected, 'SG '+key);
  }
});
test('special positions reduce orbit multiplicity (Fm-3m)', () => {
  assert.equal(api.expandSites([{symbol:'Cu',x:0,y:0,z:0}], '225').length, 4);
  assert.equal(api.expandSites([{symbol:'Cu',x:.137,y:.237,z:.341}], '225').length, 192);
});
test('cubic Miller d111 and finite (111) section polygon', () => {
  const B = api.basis(cubic), info = api.planeNormal(1,1,1,B);
  approx(info.d,5/Math.sqrt(3));
  assert.equal(api.planeIntersections(1,1,1,1,[1,1,1],B).length,3);
});
test('triclinic Miller plane produces positive d spacing', () => {
  const B=api.basis({a:4,b:5,c:6,alpha:75,beta:85,gamma:95});
  const info=api.planeNormal(1,1,1,B);
  assert.ok(info.d>0 && info.d<8);
});
test('Miller 000 is rejected', () => assert.throws(()=>api.planeNormal(0,0,0,api.basis(cubic))));
test('periodic minimum image across cell boundary',()=>{
  const B=api.basis(cubic);
  approx(api.minimumPeriodicImage([.9,0,0],[.1,0,0],B).distance,1);
});
test('boundary clipped periodic bond segment',()=>{
  const result=api.clipSegmentToCell([.9,.5,.5],[1.1,.5,.5],[1,1,1]);
  approx(result[1][0],1);approx(result[0][0],.9);
});
test('periodic self-bond along boundary for primitive simple-cubic',()=>{
  const sites=[{symbol:'Cu',x:0,y:0,z:0}],B=api.basis(cubic);
  const segments=api.periodicBondSegments(sites,[1,1,1],B,new Map(),5.1);
  assert.ok(segments.segments.length>=3);
});
test('pair-specific bond rule parses and rejects invalid ranges',()=>{
  const rules=api.parseBondRules('Si-O:1.2-2.4; Ti-O:1.8-2.5');
  assert.equal(rules.get('O-Si')[1],2.4);
  assert.throws(()=>api.parseBondRules('Si-O:4-2'));
});
test('FCC conventional to primitive and reverse preserve physical atom count',()=>{
  const cu=api.examples('fcc'),P=[[0,.5,.5],[.5,0,.5],[.5,.5,0]];
  const primitive=api.transformCrystal(cu.cell,cu.sites,P);
  assert.equal(primitive.sites.length,1);
  approx(primitive.det,.25);
  const reverse=api.transformCrystal(primitive.cell,primitive.sites,[[-1,1,1],[1,-1,1],[1,1,-1]]);
  assert.equal(reverse.sites.length,4);
  approx(api.volume(api.basis(reverse.cell)),api.volume(api.basis(cu.cell)));
});
test('CIF with SG 225 number and no explicit operators uses reference group',()=>{
  const d=api.cifData([
    'data_Cu',
    '_cell_length_a 4',
    '_cell_length_b 4',
    '_cell_length_c 4',
    '_cell_angle_alpha 90',
    '_cell_angle_beta 90',
    '_cell_angle_gamma 90',
    '_space_group_IT_number 225',
    'loop_',
    '_atom_site_type_symbol',
    '_atom_site_fract_x',
    '_atom_site_fract_y',
    '_atom_site_fract_z',
    'Cu 0 0 0'
  ].join('\n'));
  assert.equal(d.sites.length,4);
  assert.equal(d.sgNumber,225);
  assert.match(d.warning,/referans ayarı/);
});

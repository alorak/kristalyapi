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
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  normalize() { return this.multiplyScalar(1 / (this.length() || 1)); }
  applyQuaternion(q) {
    const {x,y,z}=this;
    const ix=q.w*x+q.y*z-q.z*y,iy=q.w*y+q.z*x-q.x*z,iz=q.w*z+q.x*y-q.y*x,iw=-q.x*x-q.y*y-q.z*z;
    this.x=ix*q.w+iw*-q.x+iy*-q.z-iz*-q.y;
    this.y=iy*q.w+iw*-q.y+iz*-q.x-ix*-q.z;
    this.z=iz*q.w+iw*-q.z+ix*-q.y-iy*-q.x;
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
const context = { THREE: { Vector3, SphereGeometry: class {}, CylinderGeometry: class {} }, URLSearchParams, document: {getElementById(){return null;}} };
vm.createContext(context);
vm.runInContext(script + '\nthis.api={validateCell,basis,toCart,toFrac,volume,metric,examples,cifData,poscarData,xyzData,applySymmetry,PERIODIC_SYMBOLS,elementColor,bondRange,gizmoProjection,SPACE_GROUPS,sgKeys,settingOps,expandSites,identifyWyckoff,validateSymmetryMetric,loadProject,surfaceVectors,createSurfaceSlab,planeNormal,planeIntersections,minimumPeriodicImage,clipSegmentToCell,periodicBondSegments,parseBondRules,matrixDet,transformCrystal,codCifUrl,codEntryUrl,codCleanSymbol,codSearchParamsFromForm,codSearchUrl,codRequestUrls,normalizeCodRecord,normalizeCodResults,codRecordForStorage,loadCodBookmarks,saveCodBookmarks,isLibraryHash};', context);
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
test('CIF: reference group expands atoms when operations are absent', () => {
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
  assert.equal(d.sites.length, 4);
  assert.match(d.warning, /referans ayarı/);
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

test('space group metric validation accepts FCC cubic symmetry',()=>{
  const f=api.examples('fcc');
  assert.ok(api.validateSymmetryMetric(f.cell,'225'));
});
test('space group metric validation rejects Fm-3m on orthorhombic cell',()=>{
  const f=api.examples('fcc');
  assert.ok(!api.validateSymmetryMetric({...f.cell,b:f.cell.b*1.2},'225'));
});
test('project JSON validates and restores new settings',()=>{
  const obj={cell:cubic,sites:[{symbol:'Si',x:0,y:0,z:0}],sgNumber:225,sgSetting:'225',symmetryEnabled:true,
    rep:[2,1,1],bondRules:'Si-O:1.2-2.2',plane:{h:1,k:1,l:0,offset:.75,thickness:1,visible:true,slab:true},style:'wire',cut:3.2};
  const read=api.loadProject(JSON.stringify(obj));
  assert.equal(read.sgNumber,225);
  assert.equal(read.plane.offset,.75);
  assert.equal(read.plane.slab,true);
  assert.equal(read.style,'wire');
});
test('project JSON rejects forged spacegroup settings / invalid atom coords',()=>{
  const obj={cell:cubic,sites:[{symbol:'O',x:null,y:0,z:0}],sgNumber:999};
  assert.throws(()=>api.loadProject(JSON.stringify(obj)));
});

test('Wyckoff labels distinguish 4a, 4b and general sites in Fm-3m',()=>{
  assert.equal(api.identifyWyckoff({x:0,y:0,z:0},'225').matches[0],'4a');
  assert.equal(api.identifyWyckoff({x:.5,y:.5,z:.5},'225').matches[0],'4b');
  assert.equal(api.identifyWyckoff({x:.137,y:.231,z:.345},'225').matches[0],'192l');
});
test('diamond structure Wyckoff 8a (Fd-3m setting 1)',()=>{
  assert.equal(api.identifyWyckoff({x:0,y:0,z:0},'227-1').matches[0],'8a');
});
test('Miller slab surface vectors form primitive orientation',()=>{
  const cell=api.examples('fcc').cell,B=api.basis(cell);
  const surface=api.surfaceVectors(1,1,1,B);
  const u=surface.u,v=surface.v;
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  cross.forEach(x=>assert.equal(x,1));
});
test('FCC 100 slab forms vacuum-separated periodic slab along normal',()=>{
  const cu=api.examples('fcc');
  const slab=api.createSurfaceSlab(cu.cell,cu.sites,{h:1,k:0,l:0,offset:1,thickness:7},12);
  approx(slab.cell.c,19);
  approx(slab.area,cu.cell.a**2);
  assert.ok(slab.sites.length>0);
  assert.ok(slab.sites.every(x=>x.z>0&&x.z<1));
  approx(slab.cell.alpha,90);approx(slab.cell.beta,90);
});
test('Si and NaCl (111) oriented slabs produce atom positions and vacuum',()=>{
  for(const id of ['silicon','nacl']){
    const c=api.examples(id),slab=api.createSurfaceSlab(c.cell,c.sites,{h:1,k:1,l:1,offset:1,thickness:7},12);
    assert.ok(slab.sites.length>=4);
    assert.ok(slab.sites.every(x=>x.z>0&&x.z<1));
  }
});
test('Miller slab rejects zero plane and insufficient vacuum',()=>{
  const cu=api.examples('fcc');
  assert.throws(()=>api.createSurfaceSlab(cu.cell,cu.sites,{h:0,k:0,l:0,offset:1,thickness:5},12));
  assert.throws(()=>api.createSurfaceSlab(cu.cell,cu.sites,{h:1,k:0,l:0,offset:1,thickness:5},1));
});

test('all 118 periodic table elements have stable, nonempty colors', () => {
  assert.equal(api.PERIODIC_SYMBOLS.length,118);
  for(const symbol of api.PERIODIC_SYMBOLS){
    const color=api.elementColor(symbol);
    assert.ok(/^#[0-9a-f]{6}$/i.test(color)||/^hsl\(/.test(color),'missing '+symbol);
    assert.equal(api.elementColor(symbol),color);
  }
  assert.ok(api.elementColor('O')!==api.elementColor('Fe'));
  assert.ok(api.elementColor('Fe')!==api.elementColor('Cl'));
  assert.ok(api.elementColor('Ba')!==api.elementColor('La'));
});
test('automatic bond threshold is element-aware and obeys explicit rules', () => {
  const rules=new Map();
  approx(api.bondRange('O','O',rules,3,true)[1],1.2*(.66+.66));
  approx(api.bondRange('Si','O',rules,3,true)[1],1.2*(1.11+.66));
  approx(api.bondRange('Si','O',rules,1.7,true)[1],1.7);
  approx(api.bondRange('Si','O',rules,3,false)[1],3);
  rules.set('O-Si',[1.5,3.4]);
  approx(api.bondRange('Si','O',rules,2,true)[1],3.4);
});
test('XYZ orientation gizmo projects world axes into the camera plane', () => {
  const q={x:0,y:0,z:0,w:1,clone(){return {...this,invert(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this}}}};
  const axes=api.gizmoProjection(q);
  assert.equal(axes.length,3);
  approx(axes[0].x,1);approx(axes[0].y,0);
  approx(axes[1].x,0);approx(axes[1].y,-1);
  approx(axes[2].depth,1);
});
test('light theme and axis widget are present in single HTML', () => {
  assert.match(html,/#viewport\{background:#fff\}/);
  assert.match(html,/<div id="axisGizmo"/);
  assert.match(html,/id="axisGizmoSvg"/);
  assert.match(html,/id="autoBond"/);
  assert.ok(!html.includes('Kristalografi ve yapı görselleştirme laboratuvarı'));
});

test('new library header has exactly the two navigation entries',()=>{
 assert.match(html,/id="homeLink"[^>]*>Kristal Yapı<\/a>/);
 assert.match(html,/id="libraryNav"[^>]*>Kütüphane<\/a>/);
 assert.ok(!html.includes('3B Studio</span>'));
 assert.match(html,/id="libraryPage"/);
 assert.match(html,/id="codSearchForm"/);
 assert.match(html,/id="libBookmarksPane"/);
});
test('COD record normalization uses COD data schema and safe URLs',()=>{
 const entry=api.normalizeCodRecord({file:4335507,formula:'Ge4 In0.94 La4 Mn2',sg:'C 1 2/m 1',a:'16.646',b:'4.419',c:'7.4834',vol:'526.72',year:2013,journal:'Inorganic Chemistry',doi:'10.1021/ic401234'});
 assert.equal(entry.codId,'4335507');
 assert.equal(entry.spacegroup,'C 1 2/m 1');
 assert.equal(entry.cifUrl,'https://www.crystallography.net/cod/4335507.cif');
 assert.equal(entry.entryUrl,'https://www.crystallography.net/cod/4335507.html');
 assert.equal(entry.volume,'526.72');
 assert.equal(entry.year,'2013');
 assert.throws(()=>api.codCifUrl('javascript:alert(1)'));
});
test('COD search normalizes arrays, keyed objects, duplicate entries',()=>{
 const entry={file:'4335507',formula:'La4 Mn2 Ge4'};
 assert.equal(api.normalizeCodResults([entry,entry]).length,1);
 assert.equal(api.normalizeCodResults({'4335507':{formula:'La4 Mn2 Ge4'}})[0].codId,'4335507');
 assert.equal(api.normalizeCodResults({results:[entry]})[0].formula,entry.formula);
 assert.equal(api.normalizeCodResults({data:[entry]}).length,1);
 assert.equal(api.normalizeCodResults({}).length,0);
});
test('COD search parameters map element, count and volume filters correctly',()=>{
 const values={
  codText:'',codId:'',codFormula:'',codSpacegroup:'',codJournal:'',codYear:'2013',codVolume:'',codIssue:'',codDoi:'',
  codDistinctMin:'4',codDistinctMax:'4',codVolMin:'100',codVolMax:'700',codZMin:'',codZMax:'',codZpMin:'',codZpMax:''
 };
 const elements=['La','Mn','Ge','In'];
 const omitted=['Fe'];
 context.document.getElementById=id=>{
  if(id==='codMustElements')return {querySelectorAll(){return elements.map(value=>({value}))}};
  if(id==='codNotElements')return {querySelectorAll(){return omitted.map(value=>({value}))}};
  return {value:values[id]??'',checked:false};
 };
 const params=api.codSearchParamsFromForm();
 assert.equal(params.get('format'),'json');
 assert.equal(params.get('el1'),'La');
 assert.equal(params.get('el4'),'In');
 assert.equal(params.get('nel1'),'Fe');
 assert.equal(params.get('strictmin'),'4');
 assert.equal(params.get('strictmax'),'4');
 assert.equal(params.get('vmin'),'100');
 assert.equal(params.get('vmax'),'700');
 assert.equal(params.get('year'),'2013');
 assert.ok(api.codSearchUrl(params).includes('format=json'));
 values.codVolMin='800';assert.throws(()=>api.codSearchParamsFromForm());
 values.codVolMin='';
 values.codDistinctMin='';values.codDistinctMax='';values.codYear='';
 elements.length=0;omitted.length=0;values.codVolMax='';
 assert.throws(()=>api.codSearchParamsFromForm());
});
test('COD bookmark storage keeps metadata/CIF URL, never CIF text',()=>{
 const item=api.normalizeCodRecord({file:'4335507',formula:'La4 Mn2 Ge4',sg:'C 1 2/m 1',year:'2013'});
 const db=new Map(),storage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v)};
 const bookmark=api.codRecordForStorage({...item,cif:'data_huge',text:'data_4335507',atomSites:[1,2]});
 assert.equal(bookmark.cifUrl,api.codCifUrl('4335507'));
 assert.ok(!JSON.stringify(bookmark).includes('data_4335507'));
 api.saveCodBookmarks(storage,[bookmark]);
 const restored=api.loadCodBookmarks(storage);
 assert.equal(restored.length,1);assert.equal(restored[0].codId,'4335507');
 assert.equal(restored[0].formula,'La4 Mn2 Ge4');
 assert.equal(restored[0].cifUrl,item.cifUrl);
});
test('COD connection modes stay within the fixed COD endpoint and explicit proxy domains',()=>{
 const url=api.codCifUrl('4335507');
 assert.equal(api.codRequestUrls(url,'direct').length,1);
 assert.equal(api.codRequestUrls(url,'auto').length,3);
 assert.equal(api.codRequestUrls(url,'proxy').length,2);
 assert.throws(()=>api.codRequestUrls('https://example.com/secrets','auto'));
 assert.equal(api.isLibraryHash('#kutuphane'),true);
 assert.equal(api.isLibraryHash('#kristal'),false);
});
test('COD element validation rejects unknown elements and normalizes case',()=>{
 assert.equal(api.codCleanSymbol('la'),'La');
 assert.equal(api.codCleanSymbol('MN'),'Mn');
 assert.throws(()=>api.codCleanSymbol('Nn'));
 assert.throws(()=>api.codCleanSymbol('Fe2'));
});

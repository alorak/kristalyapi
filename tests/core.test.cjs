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
  negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
}
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const moduleScript = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(moduleScript, 'HTML must contain the inline module script');
const bootstrapMarker = '// @kristalyapi/browser-bootstrap:';
const bootstrapIndex = moduleScript.indexOf(bootstrapMarker);
assert.ok(bootstrapIndex > 0, 'Browser startup marker must exist');
const script = moduleScript.slice(0, bootstrapIndex).replace(/^import .*?;\s*$/gm, '');
const context = { THREE: { Vector3, SphereGeometry: class {}, CylinderGeometry: class {} }, URLSearchParams, URL, document: {getElementById(){return null;}} };
vm.createContext(context);
vm.runInContext(script + '\nthis.api={validateCell,basis,toCart,toFrac,volume,metric,examples,cifData,poscarData,xyzData,applySymmetry,PERIODIC_SYMBOLS,elementColor,bondRange,gizmoProjection,SPACE_GROUPS,sgKeys,settingOps,preferredSetting,expandSites,identifyWyckoff,validateSymmetryMetric,loadProject,surfaceVectors,createSurfaceSlab,planeNormal,planeIntersections,millerPlaneOffsets,minimumPeriodicImage,clipSegmentToCell,periodicBondSegments,parseBondRules,matrixDet,transformCrystal,codCifUrl,codEntryUrl,codCleanSymbol,codSearchParamsFromForm,codSearchUrl,codOptimadeItemUrl,codOptimadeSearchUrl,codSearchUrls,codRequestUrls,codValidateWorkerBase,codWorkerUrlFor,codOptimadeToCif,normalizeCodRecord,normalizeCodResults,codRecordForStorage,loadCodBookmarks,saveCodBookmarks,isLibraryHash,presetMetadata,PRESET_KEYS,LIBRARY_PANES,setLibraryPane,updatePresetPreview,EXPORT_FORMATS,exportFunction,LEFT_SIDEBAR_TABS,setLeftSidebarTab,initLeftSidebarTabs,RIGHT_SIDEBAR_TABS,setRightSidebarTab,volumeNumber,readCube,readChgcar,readXsf,readVolumetric,volumeGrid,volumeShape,volumeVoxel,gridIndex,volumeWorld,volumeCoord,volumeSample,volumeAtWorld,volumesSameFrame,volumeGridCompatible,validateVolumeIsoLayer,sliceSampleMatrix,volumeSliceCsv,volumeBounds,isoTriangles,colorFromScalar,sliceWorldCorners,LAST_CRYSTAL_KEY,lastCrystalPayload,storeLastCrystal,restoreLastCrystal,coordinationNeighbors,coordinateBondSuggestion,setPairBondRule,removePairBondRule,dihedralDegrees,measurementCsv,normalizedMillerLayers,millerLayerKey,MAX_MILLER_LAYERS,createEditorHistory,isEditableHistoryTarget,historyShortcut,adpMatrix,adpToCartesian,adpFromCartesian,adpRotateBySymmetry,adpEllipsoid,adpEigen,cifExportText,cifScientificFingerprint,originalCifRecord,cifExportPreservingSource,cifMetaFromTags,cifMetaValid,normalizedLayerState,normalizedLayerOrder,normalizedMorphology,morphologyOrbit,morphologyHalfspaces,morphologyPolyhedron,normalizedOverlays,comparisonMetrics,BVS_PARAMETERS,bondValenceSum,bvsCsv,leastSquaresPlane,angleBetweenPlanes,stage3FitFromIndices,structureFactor,powderPattern,xrdCsv,PRIMITIVE_TRANSFORMS,CENTER_TRANSLATIONS,centeringFromSetting,verifyCenteringTranslations,primitiveFromSetting,shortBasisTransform,niggliReduceCell,moyoInputCell,moyoMatrix,moyoTransformDetails,moyoApplyCell};', context);
const api = context.api;
vm.runInContext('this.cameraScaleApi={projectionVisibleHeight,perspectiveFovForHeight};',context);
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
test('CIF: unknown explicit occupancy must never become full occupancy', () => {
 const structure=header+'loop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\n_atom_site_occupancy\nSi1 Si 0 0 0 ?\n';
 assert.throws(()=>api.cifData(structure),/doluluğu/);
 assert.throws(()=>api.cifData(structure.replace('0 ?','0 .')),/doluluğu/);
 assert.equal(api.cifData(structure.replace('0 ?','0 .5')).sites[0].occupancy,.5);
});
test('CIF: distinct data blocks cannot silently combine cells and atomic sites', () => {
 const blocks=header+'data_second\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\nSi1 Si 0 0 0\n';
 assert.throws(()=>api.cifData(blocks),/birden çok data_/);
});
test('CIF: exact source round-trip is retained until scientific state changes', () => {
 const cif=header+'_extra_original_record 123.4(5)\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\nSi1 Si 0 0 0\n';
 const crystal=api.cifData(cif);
 crystal.cifOriginal=api.originalCifRecord(crystal,cif);
 const untouched=api.cifExportPreservingSource(crystal);
 assert.equal(untouched.original,true);
 assert.equal(untouched.text,cif);
 crystal.cell.a+=.01;
 const changed=api.cifExportPreservingSource(crystal);
 assert.equal(changed.original,false);
 assert.doesNotMatch(changed.text,/_extra_original_record/);
 assert.equal(api.cifData(changed.text).cell.a,crystal.cell.a);
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
 assert.match(html,/id="codImportHelp"/);
 assert.match(html,/id="codImportLocalFile"/);
 assert.ok(!html.includes('proxy.cors.dev'));
 assert.ok(!html.includes('allorigins.win'));
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
test('COD connection modes use official COD endpoints only (no public proxy)',()=>{
 const url=api.codCifUrl('4335507');
 assert.equal(api.codRequestUrls(url,'direct').length,1);
 assert.equal(api.codRequestUrls(url,'auto').length,1);
 assert.equal(api.codRequestUrls(url,'optimade').length,1);
 assert.throws(()=>api.codRequestUrls(url,'worker')); // Worker mode requires configuration.
 assert.throws(()=>api.codRequestUrls(url,'proxy'));
 assert.throws(()=>api.codRequestUrls('https://example.com/secrets','auto'));
 assert.throws(()=>api.codRequestUrls('https://www.crystallography.net/other/file','auto'));
 assert.equal(api.codOptimadeItemUrl('4335507'),'https://www.crystallography.net/cod/optimade/v1/structures/4335507');
 assert.equal(api.isLibraryHash('#kutuphane'),true);
 assert.equal(api.isLibraryHash('#kristal'),false);
});
test('Cloudflare Worker rewrites only allowlisted COD routes to a configured HTTPS origin',()=>{
 const worker='https://kristalyapi-cod-api.example.workers.dev';
 assert.equal(api.codValidateWorkerBase(worker+'/'),worker);
 assert.equal(api.codWorkerUrlFor(api.codCifUrl('4335507'),worker),
   worker+'/api/cif/4335507');
 assert.equal(api.codWorkerUrlFor(api.codOptimadeItemUrl('4335507'),worker),
   worker+'/api/structures/4335507');
 assert.equal(api.codWorkerUrlFor(api.codSearchUrl(new URLSearchParams({id:'4335507',format:'json'})),worker),
   worker+'/api/search?id=4335507&format=json');
 assert.equal(api.codWorkerUrlFor(api.codOptimadeSearchUrl(new URLSearchParams({id:'4335507'})),worker).startsWith(worker+'/api/structures?'),true);
 assert.throws(()=>api.codValidateWorkerBase('http://untrusted.example'));
 assert.throws(()=>api.codValidateWorkerBase('https://example.com/path'));
 assert.throws(()=>api.codValidateWorkerBase('https://foo:pass@example.com'));
 assert.throws(()=>api.codValidateWorkerBase('https://example.com/?url=attacker'));
 assert.throws(()=>api.codWorkerUrlFor('https://untrusted.example/index.cif',worker));
 assert.match(html,/id="codWorkerTest"/);
 assert.match(html,/id="codWorkerSave"/);
 assert.match(html,/id="codWorkerClear"/);
});
test('COD OPTIMADE search preserves standardized element and count constraints',()=>{
 const p=new URLSearchParams({format:'json',el1:'Si',el2:'O',nel1:'Fe',strictmin:'2',strictmax:'3'});
 const url=new URL(api.codOptimadeSearchUrl(p));
 assert.equal(url.hostname,'www.crystallography.net');
 assert.match(url.searchParams.get('filter'),/elements HAS ALL "Si","O"/);
 assert.match(url.searchParams.get('filter'),/elements HAS NONE "Fe"/);
 assert.match(url.searchParams.get('filter'),/nelements>=2/);
 assert.match(url.searchParams.get('filter'),/nelements<=3/);
 assert.equal(api.codSearchUrls(p,'auto').length,2);
 assert.equal(api.codSearchUrls(p,'optimade').length,1);
 p.set('year','2013');
 assert.equal(api.codOptimadeSearchUrl(p),null);
 assert.equal(api.codSearchUrls(p,'auto').length,1);
 assert.throws(()=>api.codSearchUrls(p,'optimade'));
 assert.match(api.codSearchUrl(p),/result\.php\?/);
});
test('COD OPTIMADE JSON structures can be reconstructed into native P1 CIF',()=>{
 const payload={data:{id:'4335507',attributes:{
  lattice_vectors:[[5,0,0],[0,5,0],[0,0,5]],
  cartesian_site_positions:[[0,0,0],[2.5,2.5,2.5]],
  species_at_sites:['na','cl'],
  species:[
   {name:'na',chemical_symbols:['Na'],concentration:[1]},
   {name:'cl',chemical_symbols:['Cl'],concentration:[1]}
  ]
 }}};
 const cif=api.codOptimadeToCif(payload,'4335507');
 assert.match(cif,/data_COD_4335507/);
 assert.match(cif,/_cell_length_a 5\.00000000/);
 assert.match(cif,/Cl2 Cl 0\.500000000 0\.500000000 0\.500000000 1\.000000/);
 const crystal=api.cifData(cif);
 assert.equal(crystal.sites.length,2);
 assert.equal(crystal.cell.a,5);
 assert.deepEqual([...new Set(crystal.sites.map(x=>x.symbol))].sort(),['Cl','Na']);
 assert.throws(()=>api.codOptimadeToCif(payload,'1000001'));
 assert.throws(()=>api.codOptimadeToCif({data:{id:'4335507',attributes:{}}},'4335507'));
 const record=api.normalizeCodRecord({id:'4335507',attributes:{chemical_formula_reduced:'ClNa'}});
 assert.equal(record.formula,'ClNa');
});
test('COD element validation rejects unknown elements and normalizes case',()=>{
 assert.equal(api.codCleanSymbol('la'),'La');
 assert.equal(api.codCleanSymbol('MN'),'Mn');
 assert.throws(()=>api.codCleanSymbol('Nn'));
 assert.throws(()=>api.codCleanSymbol('Fe2'));
});

test('Kütüphane has an independent Örnek Yapılar tab and no old sidebar presets',()=>{
 assert.match(html,/id="libPresetsTab"[^>]*>Örnek Yapılar<\/button>/);
 assert.match(html,/id="libPresetsPane"[^>]*role="tabpanel"/);
 assert.match(html,/id="preset" type="hidden" value="silicon"/);
 assert.match(html,/id="presetList" class="preset-list"/);
 assert.match(html,/id="presetFavorite"/);
 assert.match(html,/id="presetFavoritesOnly"/);
 assert.ok(!html.includes('<select id="preset"'));
 assert.match(html,/id="importPreset"/);
 assert.match(html,/id="newStructureBtn"/);
 assert.ok(!html.includes('<h2>Kristal kütüphanesi'));
 assert.ok(!html.includes('id="resetBtn"'));
 assert.ok(!html.includes('id="newBtn"'));
 assert.deepEqual(Array.from(api.LIBRARY_PANES),['search','presets','bookmarks','worker']);
});
test('Kütüphane spans the workspace with filters and results side by side; Worker has its own tab',()=>{
 assert.match(html,/\.library-wrap\{width:100%;max-width:none/);
 assert.match(html,/class="lib-search-layout"[\s\S]*?id="codSearchForm"[\s\S]*?id="codResultsBox"/);
 assert.match(html,/id="libWorkerTab"[^>]*aria-controls="libWorkerPane"/);
 assert.match(html,/id="libWorkerPane"[^>]*role="tabpanel"/);
 assert.match(html,/class="lib-advanced-filters"/);
 assert.match(html,/id="codWorkerUrl"/);
 assert.match(html,/@media\(max-width:760px\)\{\s*\.lib-search-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
});
test('all seven sample structures have valid metadata without loading editor',()=>{
 const examples=['silicon','nacl','cscl','diamond','fcc','perovskite','graphite'];
 assert.deepEqual(Array.from(api.PRESET_KEYS),examples);
 for(const key of examples){
  const m=api.presetMetadata(key),p=api.examples(key);
  assert.equal(m.key,key);
  assert.equal(m.sites,p.sites.length);
  assert.ok(m.sites>0);
  assert.ok(m.elements.length>=1);
  approx(m.cell.a,p.cell.a);
  assert.ok(m.volume>0);
  assert.match(m.spacegroup,/\d{3}/);
 }
 assert.equal(api.presetMetadata('silicon').sites,8);
 assert.equal(api.presetMetadata('perovskite').sites,5);
 assert.throws(()=>api.presetMetadata('not-a-crystal'));
});
test('preset tab shows preview without immediately importing or changing edit controls',()=>{
 const created={};
 const node=()=>({children:[],hidden:false,tabIndex:0,value:'',textContent:'',
  classList:{toggle(){}},setAttribute(){},replaceChildren(){this.children=[];},
  append(...children){this.children.push(...children);}
 });
 const el=id=>(created[id] ||= Object.assign(node(),{value:id==='preset'?'nacl':''}));
 const before=context.document.getElementById;
 const beforeCreate=context.document.createElement;
 context.document.getElementById=el;
 context.document.createElement=node;
 try{
  api.setLibraryPane('presets');
  assert.equal(el('libSearchPane').hidden,true);
  assert.equal(el('libPresetsPane').hidden,false);
  assert.equal(el('libBookmarksPane').hidden,true);
  assert.equal(el('libWorkerPane').hidden,true);
  assert.match(el('presetName').textContent,/Sodyum klorür/);
  assert.equal(el('presetSiteCount').textContent,'8');
  assert.equal(el('presetElements').textContent,'Na, Cl');
  assert.match(el('presetSpacegroup').textContent,/225/);
  assert.equal(el('presetList').children.length,7);
  el('preset').value='silicon';
  api.updatePresetPreview();
  assert.match(el('presetName').textContent,/Silisyum/);
  assert.equal(el('presetElements').textContent,'Si');
  api.setLibraryPane('worker');
  assert.equal(el('libWorkerPane').hidden,false);
  assert.equal(el('libPresetsPane').hidden,true);
  assert.throws(()=>api.setLibraryPane('other'));
 }finally{context.document.getElementById=before;context.document.createElement=beforeCreate;}
});
test('preset favorites store only allowlisted structure keys',()=>{
 const saved=JSON.stringify(['graphite','not-a-crystal','silicon','silicon']);
 const loaded=vm.runInContext('loadPresetFavorites({getItem(){return '+JSON.stringify(saved)+';}})',context);
 assert.deepEqual(Array.from(loaded),['silicon','graphite']);
 const broken=vm.runInContext('loadPresetFavorites({getItem(){return "invalid JSON";}})',context);
 assert.deepEqual(Array.from(broken),[]);
});
test('Save button opens an export dialog with JSON, CIF, POSCAR, XYZ and PNG choices',()=>{
 assert.match(html,/id="saveBtn"[^>]*aria-haspopup="dialog"/);
 assert.match(html,/id="exportModal"[^>]*role="dialog"[^>]*aria-modal="true"/);
 assert.deepEqual(Array.from(api.EXPORT_FORMATS),['project','cif','poscar','xyz','png']);
 for(const name of api.EXPORT_FORMATS){
  assert.match(html,new RegExp('data-export="'+name+'"'));
  assert.equal(typeof api.exportFunction(name),'function');
 }
 assert.equal(api.exportFunction('project').name,'saveProject');
 assert.equal(api.exportFunction('cif').name,'exportCif');
 assert.equal(api.exportFunction('poscar').name,'exportPoscar');
 assert.equal(api.exportFunction('xyz').name,'exportXyz');
 assert.equal(api.exportFunction('png').name,'screenshot');
 assert.throws(()=>api.exportFunction('unsafe'));
 assert.ok(!html.includes('<h2>Dışa aktarma</h2>'));
 assert.ok(!html.includes('id="pngBtn"'));
});
test('library import and Save handlers are registered, old sidebar handlers removed',()=>{
 assert.match(script,/\$\('importPreset'\)\.onclick/);
 assert.match(script,/\$\('presetFavorite'\)\.onclick=\(\)=>togglePresetFavorite/);
 assert.match(script,/\$\('libWorkerTab'\)\.onclick=\(\)=>setLibraryPane\('worker'\)/);
 assert.match(script,/\$\('saveBtn'\)\.onclick=openExportModal/);
 assert.match(script,/initExportModal\(\);/);
 for(const id of ['resetBtn','newBtn','pngBtn','exportCif','exportPoscar','exportXyz','exportPng']){
  assert.ok(!script.includes("$('"+id+"')"),'stale event handler: '+id);
 }
});

test('workspace has distinct whites and cool grays with clear visual hierarchy',()=>{
 assert.match(html,/--workspace-shell:#eaf0f6/);
 assert.match(html,/--workspace-left:#eff4f9/);
 assert.match(html,/--workspace-right:#f2f6fa/);
 assert.match(html,/#viewport\{\s*background:#fff;/);
 assert.match(html,/header\{\s*position:relative;\s*z-index:12;\s*background:#fbfdff/);
 assert.match(html,/#app>\.panel>\.section\{/);
 assert.match(html,/#app>\.panel\.left \.left-tab-panel>\.section\{/);
});
test('sidebar General and Atomlar tabs are in bottom nav outside scroll content',()=>{
 const start=html.indexOf('<aside class="panel left"');
 const end=html.indexOf('</aside>',start);
 const sidebar=html.slice(start,end);
 const general=sidebar.indexOf('id="leftGeneralPane"');
 const atom=sidebar.indexOf('id="leftAtomsPane"');
 const scrollClose=sidebar.indexOf('class="left-tabbar"');
 assert.ok(general>0&&atom>general&&scrollClose>atom);
 assert.match(sidebar,/id="leftGeneralTab"[^>]*role="tab"[^>]*aria-controls="leftGeneralPane"/);
 assert.match(sidebar,/id="leftAtomsTab"[^>]*role="tab"[^>]*aria-controls="leftAtomsPane"/);
 assert.ok(sidebar.indexOf('Asimetrik konumlar / atomlar')>atom);
 assert.ok(sidebar.indexOf('Asimetrik konumlar / atomlar')<scrollClose);
 assert.ok(sidebar.indexOf('Birim hücre')>general&&sidebar.indexOf('Birim hücre')<atom);
 assert.ok(!sidebar.slice(general,atom).includes('id="siteRows"'));
 assert.equal((sidebar.match(/id="siteRows"/g)||[]).length,1);
 assert.equal((sidebar.match(/id="siteCount"/g)||[]).length,1);
});
test('tab switch preserves independent scroll offsets, toggles ARIA selection, rejects invalid tabs',()=>{
 assert.deepEqual(Array.from(api.LEFT_SIDEBAR_TABS),['general','atoms']);
 const nodes={};
 const getNode=id=>nodes[id]??(nodes[id]={
  hidden:false,scrollTop:0,tabIndex:0,selected:false,
  classList:{toggle(c,v){this[c]=v}},
  setAttribute(name,value){this[name]=value}
 });
 const prev=context.document.getElementById;
 context.document.getElementById=getNode;
 try{
  const scroll=getNode('leftTabContent');
  scroll.scrollTop=179;
  api.setLeftSidebarTab('atoms');
  assert.equal(getNode('leftGeneralPane').hidden,true);
  assert.equal(getNode('leftAtomsPane').hidden,false);
  assert.equal(getNode('leftGeneralTab')['aria-selected'],'false');
  assert.equal(getNode('leftAtomsTab')['aria-selected'],'true');
  assert.equal(scroll.scrollTop,0);
  scroll.scrollTop=72;
  api.setLeftSidebarTab('general');
  assert.equal(scroll.scrollTop,179);
  api.setLeftSidebarTab('atoms');
  assert.equal(scroll.scrollTop,72);
  assert.throws(()=>api.setLeftSidebarTab('other'));
  api.setLeftSidebarTab('general');
 }finally{context.document.getElementById=prev;}
});
test('atom badge follows imported structures by updating during every renderSites',()=>{
 assert.match(script,/function renderSites\(\)\{[\s\S]{0,1500}\$\('leftAtomsBadge'\)\.textContent=String\(state\.sites\.length\)/);
 assert.match(script,/async function importFile\(file\)[\s\S]*syncControls\(\);build\(\);fit\(\);/);
 assert.match(script,/function syncControls\(\)[\s\S]*fillPoly\(\);renderSites\(\);/);
});
test('mobile layout hides closed tabbed sidebar and preserves bottom navigation',()=>{
 assert.match(html,/#app>\.panel\.left\{display:none\}/);
 assert.match(html,/#app>\.panel\.left\.open\{display:flex\}/);
 assert.match(html,/\.left-tabbar\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/\.left-tab-content\{[\s\S]*?overflow-y:auto/);
 assert.match(html,/\.left-tab-panel\[hidden\]\{display:none!important\}/);
});

test('layout: independent Miller tool and docked quick controls with 12 icon buttons',()=>{
 const left=html.slice(html.indexOf('id="leftGeneralPane"'),html.indexOf('id="leftAtomsPane"'));
 assert.ok(left.indexOf('<h2>Görünüm')<left.indexOf('<h2>Birim hücre'));
 assert.ok(!left.includes('Miller düzlemleri (hkl)'));
 const right=html.slice(html.indexOf('id="rightMillerPane"'),html.indexOf('id="rightToolRail"'));
 assert.ok(right.includes('Miller düzlemleri (hkl)'));
 assert.ok(!html.includes('class="view-help"'));
 assert.ok(!html.includes('class="gizmo-caption"'));
 assert.ok(!html.includes('<footer>Tarayıcıda çalışır'));
 assert.ok(!html.includes('class="floating footbar"'));
 assert.deepEqual(Array.from(api.RIGHT_SIDEBAR_TABS),['info','comparison','measurement','bvs','plane','xrd','volume','layers','bonds','lattice','miller','symmetry']);
 const rail=html.slice(html.indexOf('id="rightToolRail"'),html.indexOf('</nav>',html.indexOf('id="rightToolRail"')));
 assert.equal((rail.match(/data-right-tool="/g)||[]).length,12);
 for(const key of ['bonds','lattice','symmetry'])assert.match(left,new RegExp('data-right-section="'+key+'"'));
 assert.match(html,/if\(name==='miller'\)while\(\$\('rightMillerPane'\)/);
 const quickbar=html.slice(html.indexOf('id="workbenchQuickbar"'),html.indexOf('id="toast"'));
 assert.equal((quickbar.match(/data-quick-flag="/g)||[]).length,8);
 for(const id of ['quickStyle','quickAtomScale','quickBondCut','quickH','quickK','quickL',
  'quickSlabThickness','quickShowPlane','quickRepeatMillerPlanes',
  'adpLevel','polyElement','polyCut','polyNeighbors'])assert.ok(quickbar.includes('id="'+id+'"'),id);
 for(const type of ['ball','space','stick','wire'])assert.match(quickbar,new RegExp('<option value="'+type+'"'));
 assert.match(html,/#viewport #stage\{bottom:var\(--quickbar-height\)\}/);
 assert.match(html,/#viewport\{--quickbar-height:98px\}/);
 assert.match(html,/\.quickbar-hkl \.quickbar-field\{flex:0 0 41px;width:41px\}/);
 for(const id of ['quickShowPlane','quickRepeatMillerPlanes'])
  assert.match(quickbar,new RegExp('<button id="'+id+'"[^>]*aria-pressed="(?:true|false)"[^>]*><svg'));
 const leftView=html.slice(html.indexOf('<div class="section"><h2>Görünüm</h2>'),html.indexOf('<div class="section"><h2>Birim hücre'));
 for(const id of ['adpLevel','polyElement','polyCut','polyNeighbors'])
  assert.ok(!leftView.includes('id="'+id+'"'),id+' must leave the left sidebar');
});
test('right tool rail toggles one drawer at a time, restores scroll and updates ARIA',()=>{
 const nodes={};const get=id=>nodes[id] ||= {
  hidden:false,scrollTop:0,tabIndex:0,
  classList:{toggle(){}},setAttribute(name,value){this[name]=value}
 };
 const oldGet=context.document.getElementById,oldQuery=context.document.querySelector;
 context.document.getElementById=get;
 context.document.querySelector=selector=>get(selector.match(/data-right-tool="([^"]+)/)?.[1]||selector);
 try{
  api.setRightSidebarTab('info');
  assert.equal(get('rightDrawerPane-info').hidden,false);
  assert.equal(get('info')['aria-expanded'],'true');
  get('rightDrawerContent').scrollTop=53;
  api.setRightSidebarTab('lattice');
  assert.equal(get('rightDrawerPane-info').hidden,true);
  assert.equal(get('rightDrawerPane-lattice').hidden,false);
  assert.equal(get('info')['aria-expanded'],'false');
  get('rightDrawerContent').scrollTop=87;
  api.setRightSidebarTab('info');
  assert.equal(get('rightDrawerContent').scrollTop,53);
  api.setRightSidebarTab('lattice');
  assert.equal(get('rightDrawerContent').scrollTop,87);
  api.setRightSidebarTab('lattice');
  assert.equal(get('rightDrawerContent').hidden,true);
  assert.equal(get('lattice')['aria-expanded'],'false');
  assert.throws(()=>api.setRightSidebarTab('wrong'));
 }finally{context.document.getElementById=oldGet;context.document.querySelector=oldQuery;}
});
test('Gaussian CUBE parses bohr units, origin, counts and z-fastest scalar data',()=>{
 const input=[
  'Water scalar test','electron density',
  '1 0 0 0','2 1 0 0','2 0 1 0','2 0 0 1',
  '8 0 0 0 0',
  '0 1 2 3','4 5 6 7'
 ].join('\n');
 const g=api.readCube(input);
 assert.deepEqual(Array.from(g.dims),[2,2,2]);
 approx(g.axes[0][0],.529177210903,1e-11);
 approx(g.values[api.gridIndex(g,1,0,1)],5);
 approx(api.volumeSample(g,[1,1,1]),7);
 approx(api.volumeSample(g,[.5,.5,.5]),3.5);
 const world=api.volumeWorld(g,1,1,1),back=api.volumeCoord(g,world);
 back.forEach(v=>approx(v,1));
 assert.equal(api.readVolumetric(input,'charge.cube').kind,'CUBE');
});
test('CHGCAR parses x-fastest VASP storage and correct charge density scaling',()=>{
 const data=['Grid example','1.0','2 0 0','0 2 0','0 0 2','H','1','Direct','0 0 0',
  '','2 2 2','0 1 2 3','4 5 6 7'].join('\n');
 const g=api.readChgcar(data);
 assert.deepEqual(Array.from(g.dims),[2,2,2]);
 approx(g.axes[0][0],1);approx(g.values[api.gridIndex(g,1,0,0)],1/8);
 approx(g.values[api.gridIndex(g,0,1,0)],2/8);
 approx(g.values[api.gridIndex(g,0,0,1)],4/8);
 assert.equal(g.units,'e/Å³ (CHGCAR / V)');
});
test('XSF DATAGRID uses x-fastest data and n-1 spacings to include endpoints',()=>{
 const data=['BEGIN_BLOCK_DATAGRID_3D','scalar',
 'BEGIN_DATAGRID_3D_density','2 2 2','0 0 0','2 0 0','0 2 0','0 0 2',
 '0 1 2 3','4 5 6 7','END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 const g=api.readXsf(data);
 approx(g.axes[0][0],2);
 approx(g.values[api.gridIndex(g,0,0,1)],4);
 approx(g.values[api.gridIndex(g,1,1,1)],7);
 assert.equal(api.readVolumetric(data,'scalar.xsf').kind,'XSF');
});
test('volume readers reject invalid/oversized data and incompatible grid frames',()=>{
 assert.throws(()=>api.volumeGrid([500,500,500],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],[],'bad',''));
 assert.throws(()=>api.readCube('incomplete'));
 const a=api.volumeGrid([2,2,2],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],Array(8).fill(0),'a','');
 const b=api.volumeGrid([2,2,2],[.01,0,0],[[1,0,0],[0,1,0],[0,0,1]],Array(8).fill(1),'b','');
 assert.ok(!api.volumesSameFrame(a,b));
 assert.ok(api.volumesSameFrame(a,a));
});
test('isosurface geometry generates finite triangle coordinates in world Å',()=>{
 const v=[0,0,0,0,0,1,1,1];
 const g=api.volumeGrid([2,2,2],[1,2,3],[[1,0,0],[0,1,0],[0,0,1]],v,'synthetic','');
 const iso=api.isoTriangles(g,.5,null,'thermal',5000);
 assert.ok(iso.triangles>0);
 assert.equal(iso.positions.length,iso.triangles*9);
 assert.ok(Array.from(iso.positions).every(Number.isFinite));
 assert.equal(iso.colors,null);
 const pot=api.volumeGrid([2,2,2],[1,2,3],[[1,0,0],[0,1,0],[0,0,1]],v,'potential','');
 const colored=api.isoTriangles(g,.5,pot,'viridis',5000);
 assert.equal(colored.colors.length,colored.positions.length);
 assert.ok(Array.from(colored.colors).every(v=>v>=0&&v<=1));
});
test('localStorage state round trip preserves last imported structure and selected display options',()=>{
 const example=api.examples('nacl');
 const item={...example,name:'Imported NaCl',sgNumber:225,sgSetting:'225',symmetryEnabled:false,
  bondRules:'',plane:{h:1,k:1,l:1,offset:1,thickness:2,visible:false,slab:false},
  rep:[2,1,1],style:'wire',cut:2.65,autoBond:true,bonds:true,
  cellVisible:true,boundary:false,labels:true,axes:false,autoRotate:false,atomScale:.75,poly:'Na'};
 const stored=new Map(),storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
 api.storeLastCrystal(storage,item);
 const restored=api.restoreLastCrystal(storage);
 assert.equal(restored.name,'Imported NaCl');
 assert.equal(restored.sites.length,item.sites.length);
 assert.deepEqual(Array.from(restored.rep),[2,1,1]);
 assert.equal(restored.style,'wire');
 assert.equal(restored.boundary,false);
 assert.equal(restored.labels,true);
 assert.equal(restored.atomScale,.75);
 assert.equal(restored.poly,'Na');
 assert.equal(api.restoreLastCrystal({getItem(){return null;}}),null);
});

test('CHGCAR can extract and align atomic sites and triclinic cell metadata',()=>{
 const txt=['CHGCAR structure','1.0','4 0 0','0 4 0','0 0 4','Fe O','1 1','Direct',
  '0.0 0.0 0.0','0.5 0.5 0.5','','2 2 2','0 0 0 0 0 0 0 0'].join('\n');
 const g=api.readChgcar(txt);
 assert.ok(g.crystal);
 assert.equal(g.crystal.sites.length,2);
 assert.equal(g.crystal.sites[0].symbol,'Fe');
 assert.equal(g.crystal.sites[1].symbol,'O');
 approx(g.crystal.cell.a,4);
 approx(g.crystal.sites[1].x,.5);
});
test('XSF PRIMVEC/PRIMCOORD atom list is correctly placed in volume coordinates',()=>{
 const txt=['CRYSTAL','PRIMVEC','2 0 0','0 2 0','0 0 2','PRIMCOORD','1 1',
  'Si 1 1 1','BEGIN_BLOCK_DATAGRID_3D','density','BEGIN_DATAGRID_3D_density',
  '2 2 2','0 0 0','2 0 0','0 2 0','0 0 2','0 0 0 0 0 0 0 0','END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 const g=api.readXsf(txt);
 assert.equal(g.crystal.sites.length,1);
 approx(g.crystal.sites[0].x,.5);
 approx(g.crystal.cell.a,2);
});

test('fitting volume returns correctly offset physical Cartesian bounds',()=>{
 const g=api.volumeGrid([2,2,2],[10,20,30],[[2,0,0],[0,3,0],[0,0,4]],Array(8).fill(0),'demo','');
 const result=api.volumeBounds(g);
 assert.deepEqual(Array.from(result.center),[11,21.5,32]);
 approx(result.span,Math.sqrt(29));
});

test('VASP periodic grid closes at unit-cell boundary without duplicating stored voxels',()=>{
 const data=['Periodicity','1.0','2 0 0','0 2 0','0 0 2','H','1','Direct','0 0 0',
  '','2 2 2','0 1 2 3','4 5 6 7'].join('\n');
 const g=api.readChgcar(data);
 assert.equal(g.periodic,true);
 assert.deepEqual(Array.from(api.volumeShape(g)),[3,3,3]);
 approx(api.volumeSample(g,[2,0,0]),api.volumeSample(g,[0,0,0]));
 approx(api.volumeSample(g,[2,1,0]),api.volumeSample(g,[0,1,0]));
 approx(api.volumeWorld(g,2,0,0)[0],2);
 approx(api.volumeBounds(g).max[0],2);
 const iso=api.isoTriangles(g,.2);
 assert.ok(iso.triangles>=0);
 assert.ok(Array.from(iso.positions).every(Number.isFinite));
});

test('CIF fractional symmetry operators accept leading-decimal translations',()=>{
 const out=api.applySymmetry('z+.5, y-.5, -x+1/2',[.1,.2,.3]);
 approx(out[0],.8);approx(out[1],-.3);approx(out[2],.4);
 assert.throws(()=>api.applySymmetry('z+bad, y, x',[0,0,0]));
});
test('single-column CIF cell loop and quoted comments parse without losing lattice angles',()=>{
 const p=fs.readFileSync(path.join(__dirname,'validation','fixtures','real','FePO4.cif'),'utf8');
 const c=api.cifData(p);
 assert.equal(c.sites.length,24);
 approx(c.cell.alpha,91);approx(c.cell.beta,92);approx(c.cell.gamma,93);
 assert.equal(c.sites.filter(s=>s.symbol==='Fe').length,4);
});
test('graphite short-precision equivalent Wyckoff sites are deduplicated with metric tolerance',()=>{
 const p=fs.readFileSync(path.join(__dirname,'validation','fixtures','real','Graphite.cif'),'utf8');
 const c=api.cifData(p);
 assert.equal(c.sites.length,4);
 assert.equal(c.sites.filter(s=>s.symbol==='C').length,4);
});
test('body centered Fe cubic CIF expands explicit half-translation to two atomic sites',()=>{
 const p=fs.readFileSync(path.join(__dirname,'validation','fixtures','real','Fe.cif'),'utf8');
 const c=api.cifData(p);
 assert.equal(c.sites.length,2);
 assert.equal(c.sites.every(s=>s.symbol==='Fe'),true);
});
test('unknown CIF atomic positions cannot silently disappear from imported crystal',()=>{
 const p=fs.readFileSync(path.join(__dirname,'validation','fixtures','real','ICSD59959.cif'),'utf8');
 assert.throws(()=>api.cifData(p),/atom koordinatı eksik/);
});
test('COD 4335507 keeps all 22 crystallographic sites',()=>{
 const p=fs.readFileSync(path.join(__dirname,'validation','fixtures','real','COD_4335507.cif'),'utf8');
 const c=api.cifData(p);
 assert.equal(c.sites.length,22);
});

test('(111) Miller family repeats at integer offsets across a 2×2×2 supercell',()=>{
 const values=Array.from(api.millerPlaneOffsets(1,1,1,1,[2,2,2],true));
 assert.deepEqual(values,[0,1,2,3,4,5,6]);
 const B=api.basis({a:5.431,b:5.431,c:5.431,alpha:90,beta:90,gamma:90});
 const polygons=values.map(t=>api.planeIntersections(1,1,1,t,[2,2,2],B)).filter(p=>p.length>=3);
 assert.equal(polygons.length,5);
});
test('Miller single-plane mode preserves requested t and signed indices are supported',()=>{
 assert.deepEqual(Array.from(api.millerPlaneOffsets(1,1,1,1,[2,2,2],false)),[1]);
 assert.deepEqual(Array.from(api.millerPlaneOffsets(-1,0,1,.5,[2,2,2],true)),
  [-1.5,-.5,.5,1.5]);
 assert.throws(()=>api.millerPlaneOffsets(1,1,1,NaN,[2,2,2],true));
});
test('Miller family checkbox and project round-trip retain the chosen display mode',()=>{
 assert.match(html,/id="repeatMillerPlanes" type="checkbox" checked/);
 const obj={name:'family',detail:'test',cell:{a:5,b:5,c:5,alpha:90,beta:90,gamma:90},
  sites:[{symbol:'Si',x:0,y:0,z:0,occupancy:1}],
  plane:{h:1,k:1,l:1,offset:1,visible:true,repeat:false,slab:false,thickness:2}};
 const restored=api.loadProject(JSON.stringify(obj));
 assert.equal(restored.plane.repeat,false);
 delete obj.plane.repeat;
 const oldProject=api.loadProject(JSON.stringify(obj));
 assert.equal(oldProject.plane.repeat,true);
});

test('viewport removes duplicate structure title and shows five accessible icon-only camera controls',()=>{
 assert.ok(!html.includes('id="viewTitle"'));
 assert.ok(!html.includes('id="viewSubtitle"'));
 for(const id of ['fitBtn','topBtn','frontBtn','sideBtn','projectionBtn']){
  const tag=html.match(new RegExp('<button id="'+id+'"[^>]*>[^<]*<svg[^>]*>'));
  assert.ok(tag,'icon missing for '+id);
  assert.match(tag[0],/aria-label="/);
  assert.match(tag[0],/title="/);
 }
 assert.match(html,/id="projectionBtn"[^>]*aria-pressed="false"/);
});
test('perspective and orthographic cameras keep the same target-plane scale and distance',()=>{
 const {projectionVisibleHeight,perspectiveFovForHeight}=context.cameraScaleApi;
 const distance=42,fov=44;
 const perspectiveView={isPerspectiveCamera:true,getEffectiveFOV:()=>fov};
 const height=projectionVisibleHeight(perspectiveView,distance);
 const orthographicView={isOrthographicCamera:true,top:height/2,bottom:-height/2,zoom:1};
 approx(projectionVisibleHeight(orthographicView,distance),height);
 approx(perspectiveFovForHeight(height,distance),fov);
 orthographicView.zoom=2.5;
 const zoomHeight=projectionVisibleHeight(orthographicView,distance);
 const returnFov=perspectiveFovForHeight(zoomHeight,distance);
 approx(projectionVisibleHeight({isPerspectiveCamera:true,getEffectiveFOV:()=>returnFov},distance),zoomHeight);
 assert.ok(returnFov<fov,'orthographic zoom must not cause a jump when returning to perspective');
 assert.throws(()=>perspectiveFovForHeight(0,distance));
});
test('bond pair editor can add and remove an independent distance interval',()=>{
 const txt=api.setPairBondRule('Si-O:1.4-2.0','Fe','O',1.6,2.4);
 assert.deepEqual(Array.from(api.parseBondRules(txt).get('Fe-O')),[1.6,2.4]);
 assert.deepEqual(Array.from(api.parseBondRules(txt).get('O-Si')),[1.4,2.0]);
 const revised=api.setPairBondRule(txt,'O','Fe',1.5,2.25);
 assert.equal(api.parseBondRules(revised).size,2);
 assert.deepEqual(Array.from(api.parseBondRules(revised).get('Fe-O')),[1.5,2.25]);
 assert.equal(api.parseBondRules(api.removePairBondRule(revised,'Fe-O')).size,1);
 assert.throws(()=>api.setPairBondRule('','Si','O',2,1));
 assert.throws(()=>api.setPairBondRule('','Si','O',0,16));
});
test('geometric bond radius suggestion produces increasing finite thresholds',()=>{
 const [min,max]=api.coordinateBondSuggestion('Si','O');
 assert.ok(Number.isFinite(min)&&Number.isFinite(max));
 assert.ok(min<max&&max<=15);
});
test('periodic CsCl center finds eight distinct Cl images, including beyond cell boundary',()=>{
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90},B=api.basis(cell);
 const sites=[{symbol:'Cs',x:0,y:0,z:0},{symbol:'Cl',x:.5,y:.5,z:.5}];
 const rules=api.parseBondRules('Cs-Cl:3.1-3.9; Cs-Cs:4.4-4.5');
 const neighbors=api.coordinationNeighbors(sites,0,B,rules,5,false,24);
 assert.equal(neighbors.length,8);
 assert.ok(neighbors.every(item=>item.element==='Cl'));
 neighbors.forEach(item=>approx(item.distance,Math.sqrt(12),1e-5));
 assert.equal(new Set(neighbors.map(item=>item.shift.join('/'))).size,8);
});
test('coordination analysis retains separate overlapping species and respects max count',()=>{
 const B=api.basis({a:5,b:5,c:5,alpha:90,beta:90,gamma:90});
 const sites=[{symbol:'Fe',x:0,y:0,z:0},{symbol:'O',x:.5,y:0,z:0},{symbol:'N',x:.5,y:0,z:0}];
 const r=api.parseBondRules('Fe-O:2-3; Fe-N:2-3; Fe-Fe:4.9-5.1');
 const result=api.coordinationNeighbors(sites,0,B,r,5,false,24);
 assert.equal(result.filter(i=>i.element==='O').length,2);
 assert.equal(result.filter(i=>i.element==='N').length,2);
 assert.equal(api.coordinationNeighbors(sites,0,B,r,5,false,2).length,2);
});
test('dihedral angle uses four atoms and protects against collinear degeneracy',()=>{
 const d=api.dihedralDegrees([0,1,0],[0,0,0],[1,0,0],[1,0,1]);
 approx(Math.abs(d),90,1e-6);
 assert.throws(()=>api.dihedralDegrees([0,0,0],[1,0,0],[2,0,0],[3,0,0]));
});
test('measurement CSV quotes atom labels, exports 2/3/4-atom values safely',()=>{
 const csv=api.measurementCsv([{structure:'A,"B"',atoms:['Si1','O2'],values:{distance_A:2.12,periodic_A:2.01,angle_deg:109.5,dihedral_deg:-90}}]);
 assert.match(csv,/"A,""B"""/);
 assert.match(csv,/2.12/);
 assert.match(csv,/-90/);
 assert.match(csv,/Dihedral/);
});
test('Miller layer validation accepts independent color and rejects malformed geometry',()=>{
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const layers=api.normalizedMillerLayers([{h:1,k:1,l:1,offset:.5,color:'#ff8800',visible:false}],cell);
 assert.equal(layers.length,1);
 assert.equal(layers[0].repeat,true);
 assert.equal(layers[0].visible,false);
 assert.equal(layers[0].color,'#ff8800');
 assert.equal(api.millerLayerKey(layers[0]),'1/1/1/0.5/true');
 assert.throws(()=>api.normalizedMillerLayers([{h:0,k:0,l:0,offset:1,color:'#abcdef'}],cell));
 assert.throws(()=>api.normalizedMillerLayers([{h:1,k:0,l:0,offset:1,color:'red'}],cell));
 assert.throws(()=>api.normalizedMillerLayers(Array.from({length:9},()=>layers[0]),cell));
});
test('standalone Miller layers and polyhedron settings survive project and last-crystal save/restore',()=>{
 const source={name:'Layered structure',detail:'test',cell:{a:5,b:5,c:5,alpha:90,beta:90,gamma:90},
 sites:[{symbol:'Si',x:0,y:0,z:0,occupancy:1}],
 rep:[1,1,1],sgNumber:1,sgSetting:'1',poly:'Si',polyCut:3.5,polyNeighbors:8,
 planeLayers:[{h:1,k:1,l:0,offset:.2,repeat:true,visible:true,color:'#ff9900'}]};
 const loaded=api.loadProject(JSON.stringify(source));
 assert.equal(loaded.planeLayers.length,1);
 assert.equal(loaded.planeLayers[0].color,'#ff9900');
 assert.equal(loaded.poly,'Si');assert.equal(loaded.polyCut,3.5);assert.equal(loaded.polyNeighbors,8);
 const storage=new Map(),db={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 api.storeLastCrystal(db,loaded);
 const restored=api.restoreLastCrystal(db);
 assert.equal(restored.planeLayers[0].offset,.2);
 assert.equal(restored.polyNeighbors,8);
 assert.equal(restored.polyCut,3.5);
});
test('short-term VESTA controls exist for coordination, measurement history and Miller layers',()=>{
 for(const id of ['bondPairA','bondPairB','bondMin','bondMax','bondSuggest','bondRuleAdd','bondRuleList',
  'polyCut','polyNeighbors','torsionResult','coordinationInfo','measurementHistory',
  'saveMeasurement','exportMeasurements','addMillerLayer','clearMillerLayers','millerLayerList']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
});


test('Undo/Redo: record, replay and new edits clear the redo branch',()=>{
 const h=api.createEditorHistory(5,1000);
 assert.equal(h.current(),null);
 assert.equal(h.canUndo(),false);
 assert.equal(h.record('first'),true); // snapshot created, no history step yet
 assert.equal(h.canUndo(),false);
 assert.equal(h.current(),'first');
 assert.equal(h.record('first'),false); // idempotent render must not make a step
 h.record('second');h.record('third');
 assert.deepEqual(Array.from(Object.values(h.counts())),[2,0]);
 assert.equal(h.undo(),'second');
 assert.equal(h.undo(),'first');
 assert.equal(h.canUndo(),false);
 assert.equal(h.canRedo(),true);
 assert.equal(h.redo(),'second');
 h.record('branch');
 assert.equal(h.canRedo(),false);
 assert.equal(h.current(),'branch');
});
test('Undo/Redo: cap previous snapshots and reset safely when snapshot is too large',()=>{
 const h=api.createEditorHistory(2,100);
 for(const name of ['a','b','c','d'])h.record(name);
 assert.equal(h.counts().undo,2);
 assert.equal(h.undo(),'c');
 assert.equal(h.undo(),'b');
 assert.equal(h.undo(),null); // 'a' discarded
 h.record('x'.repeat(101)); // oversize state should invalidate stale history
 assert.deepEqual(Array.from(Object.values(h.counts())),[0,0]);
 assert.equal(h.current(),null);
 assert.throws(()=>api.createEditorHistory(0,200));
});
test('Undo/Redo: complete CIF + display state snapshot can round-trip through loadProject',()=>{
 const sample=api.examples('silicon');
 const state={...sample,name:'edited',detail:'undo fixture',rep:[2,1,1],sgNumber:227,sgSetting:'227-1',
  symmetryEnabled:false,bondRules:'Si-O:1.5-2.0',autoBond:true,bonds:false,
  cellVisible:false,boundary:true,labels:true,axes:false,autoRotate:true,atomScale:.6,
  cut:2.65,style:'wire',poly:'Si',polyCut:2.7,polyNeighbors:6,
  plane:{h:1,k:1,l:1,offset:.75,visible:true,repeat:false,thickness:2,slab:false},
  planeLayers:[{h:1,k:0,l:0,offset:.5,repeat:true,visible:true,color:'#ff9900'}]};
 const h=api.createEditorHistory();
 const snapshot=JSON.stringify(api.lastCrystalPayload(state));
 h.record(snapshot);
 h.record(JSON.stringify(api.lastCrystalPayload({...state,name:'second',sites:state.sites.slice(0,3)})));
 const saved=api.loadProject(h.undo());
 assert.equal(saved.name,'edited');
 assert.deepEqual(Array.from(saved.rep),[2,1,1]);
 assert.equal(saved.sites.length,state.sites.length);
 assert.equal(saved.bonds,false);
 assert.equal(saved.style,'wire');
 assert.equal(saved.polyNeighbors,6);
 assert.equal(saved.plane.repeat,false);
 assert.equal(saved.planeLayers[0].color,'#ff9900');
 const redone=api.loadProject(h.redo());
 assert.equal(redone.name,'second');
 assert.equal(redone.sites.length,3);
});
test('Undo/Redo: icons have accessible labels, stay disabled initially and are only in workspace',()=>{
 for(const [id,label] of [['undoBtn','Geri al'],['redoBtn','Yinele']]){
  const re=new RegExp('<button id="'+id+'"[^>]*aria-label="'+label+'"[^>]*disabled>');
  assert.match(html,re);
 }
 assert.match(html,/recordHistoryChange\(\);\s*persistLastCrystal\(\)/);
 assert.ok(html.includes("$('undoBtn').onclick="));
 assert.ok(html.includes("$('redoBtn').onclick="));
 assert.ok(html.includes('if(historyShortcut(e))return'));
});
test('Undo/Redo: keyboard interception ignores text editors and unrelated key chords',()=>{
 assert.equal(api.isEditableHistoryTarget({closest:s=>s.includes('input')?{}:null}),true);
 assert.equal(api.isEditableHistoryTarget({closest:()=>null}),false);
 let prevented=false;
 const evt=(key,opts={})=>({key,ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,
  target:{closest:()=>null},preventDefault(){prevented=true;},...opts});
 assert.equal(api.historyShortcut(evt('z',{target:{closest:()=>({})}})),false);
 assert.equal(api.historyShortcut(evt('k')),false);
 assert.equal(api.historyShortcut(evt('z',{altKey:true})),false);
 assert.equal(api.historyShortcut(evt('z')),true);
 assert.equal(prevented,true);
});

test('Undo/Redo: controller restores editor snapshots without recording replay as new edits',()=>{
 const mockButtons={};
 const isolated={
  THREE:{Vector3,SphereGeometry:class{},CylinderGeometry:class{}},
  URLSearchParams,
  document:{getElementById(id){return mockButtons[id]??(mockButtons[id]={disabled:true});}}
 };
 vm.createContext(isolated);
 const operations=[
  'build=function(){recordHistoryChange();return true;};',
  'syncControls=function(){};',
  'fit=function(){};',
  'recordHistoryChange();',
  "state={...state,name:'Second crystal',sites:state.sites.slice(0,3)};",
  'recordHistoryChange();',
  'this.editorView=()=>({name:state.name,sites:state.sites.length,history:editorHistory.counts()});',
  "this.editorUndo=()=>applyHistory('undo');",
  "this.editorRedo=()=>applyHistory('redo');"
 ].join('\n');
 vm.runInContext(script+'\n'+operations,isolated);
 assert.equal(isolated.editorView().name,'Second crystal');
 assert.equal(isolated.editorView().sites,3);
 assert.equal(isolated.editorUndo(),true);
 assert.equal(isolated.editorView().name,api.examples('silicon').name);
 assert.equal(isolated.editorView().sites,8);
 assert.deepEqual(JSON.parse(JSON.stringify(isolated.editorView().history)),{undo:0,redo:1});
 assert.equal(isolated.editorRedo(),true);
 assert.equal(isolated.editorView().name,'Second crystal');
 assert.equal(isolated.editorView().sites,3);
 assert.deepEqual(JSON.parse(JSON.stringify(isolated.editorView().history)),{undo:1,redo:0});
 assert.equal(isolated.editorRedo(),false);
});


test('CIF ADP: reads Uij, rotates anisotropic tensors with the symmetry operation',()=>{
 const cif=[
  'data_adp',
  '_cell_length_a 5','_cell_length_b 5','_cell_length_c 5',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  "_journal_name_full 'Test Journal'",
  "loop_","_space_group_symop_operation_xyz","'x,y,z'","'y,x,z'",
  "loop_","_atom_site_label","_atom_site_type_symbol",
  "_atom_site_fract_x","_atom_site_fract_y","_atom_site_fract_z",
  "_atom_site_occupancy","_atom_site_U_iso_or_equiv",
  "Si1 Si 0.1 0.2 0.3 1 0.025",
  "loop_","_atom_site_aniso_label",...['11','22','33','23','13','12'].map(v=>'_atom_site_aniso_U_'+v),
  "Si1 0.04 0.01 0.02 0 0 0"
 ].join('\n')+'\n';
 const parsed=api.cifData(cif);
 assert.equal(parsed.sites.length,2);
 assert.equal(parsed.cifMeta._journal_name_full,'Test Journal');
 const first=parsed.sites.find(s=>Math.abs(s.x-.1)<1e-8);
 const second=parsed.sites.find(s=>Math.abs(s.x-.2)<1e-8);
 approx(first.adp[0],.04);
 approx(first.adp[1],.01);
 approx(second.adp[0],.01);
 approx(second.adp[1],.04);
 assert.equal(first.uIso,.025);
 const stored=api.loadProject(JSON.stringify({...parsed,format:'kristalyapi-v1'}));
 assert.equal(stored.sites[1].adp.length,6);
 const output=api.cifExportText({...stored,name:'ADP test'});
 assert.match(output,/_atom_site_aniso_U_11/);
 assert.match(output,/_atom_site_U_iso_or_equiv/);
 assert.match(output,/_journal_name_full 'Test Journal'/);
 const again=api.cifData(output);
 assert.equal(again.sites.length,2);
 approx(again.sites[0].adp[0],first.adp[0],1e-6);
});
test('ADP: triclinic tensor roundtrip and non-positive ellipsoids rejected',()=>{
 const cell={a:6,b:7,c:8,alpha:76,beta:84,gamma:101};
 const tensor=[.04,.025,.03,.001,.003,-.002];
 const cart=api.adpToCartesian(tensor,cell);
 const again=api.adpFromCartesian(cart,cell);
 tensor.forEach((v,i)=>approx(v,again[i],1e-7));
 const e=api.adpEllipsoid({label:'Si1',adp:tensor},cell,90);
 assert.equal(e.scales.length,3);
 assert.ok(e.scales.every(v=>v>0&&Number.isFinite(v)));
 assert.throws(()=>api.adpEllipsoid({label:'Invalid',adp:[-1,.02,.02,0,0,0]},cell,90));
 assert.throws(()=>api.loadProject(JSON.stringify({cell,sites:[{symbol:'Si',x:0,y:0,z:0,adp:[.01,.02]}]})));
});
test('CIF selected publication metadata survives project and P1 CIF export',()=>{
 const input=[
  'data_metadata',
  '_cell_length_a 4','_cell_length_b 4','_cell_length_c 4',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  "_journal_name_full 'Nature Materials'",
  "_journal_paper_doi '10.1234/sample'",
  "_publ_section_title 'A test with phase'",
  "loop_","_atom_site_label","_atom_site_type_symbol",
  "_atom_site_fract_x","_atom_site_fract_y","_atom_site_fract_z",
  'C1 C 0 0 0'
 ].join('\n');
 const parsed=api.cifData(input);
 const stored=api.loadProject(JSON.stringify(parsed));
 assert.equal(stored.cifMeta._journal_paper_doi,'10.1234/sample');
 const roundtrip=api.cifData(api.cifExportText({...stored,name:'Test'}));
 assert.equal(roundtrip.cifMeta._publ_section_title,'A test with phase');
 assert.equal(roundtrip.cifMeta._journal_name_full,'Nature Materials');
 assert.equal(roundtrip.sites[0].symbol,'C');
});
test('Layer manager: canonical order, visibility, opacity and color are bounded',()=>{
 const layers=api.normalizedLayerState({bonds:{visible:false,opacity:50,color:'#ab12cd'},
  atoms:{opacity:-1,color:'javascript:alert(1)'}});
 assert.equal(layers.bonds.visible,false);
 assert.equal(layers.bonds.opacity,1);
 assert.equal(layers.bonds.color,'#ab12cd');
 assert.equal(layers.atoms.opacity,.1);
 assert.equal(layers.atoms.color,'');
 const order=Array.from(api.normalizedLayerOrder(['volume','atoms','volume','invalid']));
 assert.deepEqual(order.slice(0,2),['volume','atoms']);
 assert.equal(order.length,11);
 assert.match(html,/id="layerManager"/);
 assert.match(html,/id="adpVisible"/);
 assert.match(html,/id="adpLevel"/);
});


test('CIF scientific roundtrip: five diverse real structures preserve P1 geometry',()=>{
 const paths=['COD_4335507.cif','Fe3O4.cif','Graphite.cif','LiFePO4.cif','CuCl.cif'];
 for(const name of paths){
  const content=fs.readFileSync(path.join(__dirname,'validation','fixtures','real',name),'utf8');
  const one=api.cifData(content),two=api.cifData(api.cifExportText({...one,name:'Roundtrip'}));
  assert.equal(two.sites.length,one.sites.length,name+' site count');
  for(let i=0;i<one.sites.length;i++){
   const a=one.sites[i],b=two.sites[i];
   assert.equal(b.symbol,a.symbol,name+' atom '+i+' element');
   approx(b.occupancy,a.occupancy,.001);
   for(const k of ['x','y','z'])approx(b[k],a[k],.00001);
  }
  for(const k of ['a','b','c'])approx(one.cell[k],two.cell[k],.00001);
  for(const k of ['alpha','beta','gamma'])approx(one.cell[k],two.cell[k],.00001);
 }
});
test('CIF source formula is dropped after composition change, while bibliography remains',()=>{
 const source=[
  'data_formula','_cell_length_a 4','_cell_length_b 4','_cell_length_c 4',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  "_chemical_formula_sum 'Na Cl'","_journal_name_full 'Example Journal'",
  'loop_','_atom_site_label','_atom_site_type_symbol','_atom_site_fract_x',
  '_atom_site_fract_y','_atom_site_fract_z',
  'Na1 Na 0 0 0','Cl1 Cl 0.5 0.5 0.5'
 ].join('\n');
 const crystal=api.cifData(source);
 assert.match(api.cifExportText(crystal),/_chemical_formula_sum/);
 crystal.sites[0].symbol='K';
 const edited=api.cifExportText(crystal);
 assert.doesNotMatch(edited,/_chemical_formula_sum/);
 assert.match(edited,/_journal_name_full/);
});
test('Isotropic Uiso gives spherical Cartesian ellipsoid even in triclinic cell',()=>{
 const cell={a:5,b:6,c:7,alpha:78,beta:84,gamma:98};
 const e=api.adpEllipsoid({label:'Iso',uIso:.03},cell,90);
 e.scales.forEach(v=>approx(v,Math.sqrt(.03*6.251388631),1e-8));
});


test('Layer visibility, opacity and order survive snapshot restore and project roundtrip',()=>{
 const source=api.examples('silicon');
 const input={...source,rep:[1,1,1],sgNumber:1,sgSetting:'1',plane:{h:1,k:1,l:1,offset:1,thickness:2},
  layers:api.normalizedLayerState({bonds:{visible:false,opacity:.4,color:'#225588'}}),
  layerOrder:api.normalizedLayerOrder(['volume','bonds','atoms'])};
 const snapshot=api.lastCrystalPayload(input);
 assert.equal(snapshot.layers.bonds.visible,false);
 assert.equal(snapshot.layers.bonds.opacity,.4);
 assert.equal(snapshot.layerOrder[0],'volume');
 const restored=api.loadProject(JSON.stringify(snapshot));
 assert.equal(restored.layers.bonds.visible,false);
 assert.equal(restored.layers.bonds.color,'#225588');
 assert.equal(restored.layers.bonds.opacity,.4);
 assert.equal(restored.layerOrder[0],'volume');
 const history=api.createEditorHistory(5,100000);
 history.record(JSON.stringify(snapshot));
 const next={...snapshot,layers:api.normalizedLayerState({...snapshot.layers,bonds:{visible:true,opacity:1,color:''}})};
 history.record(JSON.stringify(next));
 const undo=api.loadProject(history.undo());
 assert.equal(undo.layers.bonds.visible,false);
 assert.equal(undo.layers.bonds.opacity,.4);
});


test('phase2 multi-volume: validates compatible Cartesian frames despite different grid sampling',()=>{
 const g=api.volumeGrid([2,2,2],[1,2,3],[[2,0,0],[0,3,0],[0,0,4]],
  Array(8).fill(0),'density','e/Å³');
 const compatible=api.volumeGrid([3,3,3],[1,2,3],[[1,0,0],[0,1.5,0],[0,0,2]],
  Array(27).fill(1),'potential','V');
 assert.equal(api.volumeGridCompatible(g,compatible),true);
 const incompatible=api.volumeGrid([2,2,2],[1.01,2,3],[[2,0,0],[0,3,0],[0,0,4]],
  Array(8).fill(0),'shifted','V');
 assert.equal(api.volumeGridCompatible(g,incompatible),false);
});
test('phase2 isosurfaces reject invalid opacities, colors and NaN levels',()=>{
 const g=api.volumeGrid([2,2,2],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],
  Array(8).fill(1),'field','');
 const iso=api.validateVolumeIsoLayer({value:0.5,visible:false,opacity:.35,color:'#33aabb'},g);
 assert.equal(iso.visible,false);
 assert.equal(iso.opacity,.35);
 assert.throws(()=>api.validateVolumeIsoLayer({value:NaN,opacity:.5,color:'#334455'},g));
 assert.throws(()=>api.validateVolumeIsoLayer({value:.5,opacity:4,color:'#334455'},g));
 assert.throws(()=>api.validateVolumeIsoLayer({value:.5,opacity:.5,color:'red'},g));
});
test('phase2 quantitative slice: correct physical axes, mean and CSV values for a linear field',()=>{
 const vals=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)vals.push(i+2*j+3*k);
 const g=api.volumeGrid([3,3,3],[10,20,30],[[2,0,0],[0,1,0],[0,0,3]],vals,'linear','e/Å³');
 const slice=api.sliceSampleMatrix(g,2,50,3);
 approx(slice.width,4);approx(slice.height,2);
 approx(slice.min,3);approx(slice.max,9);approx(slice.mean,6);
 approx(slice.rows[0].z,33);approx(slice.rows[0].x,10);
 const csv=api.volumeSliceCsv(slice);
 assert.match(csv,/x_A,y_A,z_A/);
 assert.equal(csv.trim().split('\n').length,10);
 assert.throws(()=>api.sliceSampleMatrix(g,8,50,3));
 assert.throws(()=>api.sliceSampleMatrix(g,2,101,3));
});

test('phase2 cubic morphology {100} produces a closed cube with correct metric volume and area',()=>{
 const cube={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const families=[{h:1,k:0,l:0,distance:3,color:'#4488cc',visible:true,cubic:true}];
 const planes=api.morphologyHalfspaces(cube,families);
 assert.equal(planes.length,6);
 const solid=api.morphologyPolyhedron(planes);
 assert.ok(solid.closed);
 assert.equal(solid.faces.length,6);
 assert.equal(solid.vertices.length,8);
 approx(solid.volume,216);
 approx(solid.area,216);
});
test('phase2 non-cubic morphology only generates inversion-related ±hkl, not false cubic symmetry',()=>{
 const nonCubic={a:5,b:6,c:7,alpha:75,beta:85,gamma:102};
 const face={h:1,k:0,l:0,distance:3,color:'#4488cc',visible:true,cubic:true};
 const planes=api.morphologyHalfspaces(nonCubic,[face]);
 assert.equal(planes.length,2);
 assert.equal(api.morphologyPolyhedron(planes).closed,false);
 assert.throws(()=>api.normalizedMorphology([{...face,distance:-1}],nonCubic));
 assert.throws(()=>api.normalizedMorphology(Array(9).fill(face),nonCubic));
});
test('phase2 morphology geometry is restored after a project state roundtrip',()=>{
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const original={...api.examples('silicon'),cell,sgNumber:1,sgSetting:'1',
   morphology:[{h:1,k:0,l:0,distance:3,color:'#4488cc',visible:true,cubic:true}],morphVisible:true};
 const snapshot=api.lastCrystalPayload(original);
 const restored=api.loadProject(JSON.stringify(snapshot));
 assert.equal(restored.morphology[0].distance,3);
 assert.equal(restored.morphVisible,true);
 const solid=api.morphologyPolyhedron(api.morphologyHalfspaces(restored.cell,restored.morphology));
 approx(solid.volume,216);
 assert.match(html,/id="morphPreset"/);
});

test('phase2 independent CIF structure overlay accepts distinct cell metrics and safe positioning',()=>{
 const a=api.examples('silicon'),b=api.examples('nacl');
 const sample=[{name:'NaCl comparison',cell:b.cell,sites:b.sites,offset:[2,0,-1],
   align:'center',color:'#8c5bba',opacity:.45,visible:true}];
 const overlays=api.normalizedOverlays(sample);
 assert.equal(overlays[0].sites.length,8);
 assert.deepEqual(Array.from(overlays[0].offset),[2,0,-1]);
 const metric=api.comparisonMetrics(a.cell,overlays[0]);
 assert.equal(metric.sameMetric,false);
 assert.equal(metric.sites,8);
 assert.throws(()=>api.normalizedOverlays([{...sample[0],offset:[Infinity,0,0]}]));
 assert.throws(()=>api.normalizedOverlays([{...sample[0],color:'javascript:bad()'}]));
 assert.throws(()=>api.normalizedOverlays(Array(4).fill(sample[0])));
});
test('phase2 multi-CIF comparison stays in project, last structure and undo snapshots',()=>{
 const a=api.examples('silicon'),b=api.examples('cscl');
 const overlay={name:'CsCl',cell:b.cell,sites:b.sites,offset:[0,0,0],align:'origin',
  color:'#cc7711',opacity:.6,visible:true};
 const project={...a,sgNumber:1,sgSetting:'1',overlays:[overlay]};
 const normalized=api.loadProject(JSON.stringify(project));
 assert.equal(normalized.overlays.length,1);
 assert.equal(normalized.overlays[0].name,'CsCl');
 const last=api.lastCrystalPayload(normalized);
 assert.equal(last.overlays[0].sites.length,2);
 const again=api.loadProject(JSON.stringify(last));
 assert.equal(again.overlays[0].color,'#cc7711');
 const history=api.createEditorHistory(5,380000);
 history.record(JSON.stringify({...last,overlays:[]}));
 history.record(JSON.stringify(last));
 assert.equal(JSON.parse(history.undo()).overlays.length,0);
 assert.match(html,/id="overlayAdd"/);
});

test('stage3 BVS: rock salt NaCl has six 2.82 Å Cl neighbors and valence close to +1',()=>{
 const structure=api.examples('nacl');
 const index=structure.sites.findIndex(site=>site.symbol==='Na');
 const result=api.bondValenceSum(structure.sites,index,structure.cell,'Na1-Cl',3.5);
 assert.equal(result.count,6);
 approx(result.mean,2.82,1e-5);
 assert.ok(Math.abs(result.sum-1)<.025);
 assert.equal(result.neighbors.every(x=>x.label.includes('Cl')),true);
 assert.match(api.bvsCsv(result),/bond_valence/);
 assert.throws(()=>api.bondValenceSum(structure.sites,index,structure.cell,'Fe3-O',3.5),/Merkez atom/);
});
test('stage3 BVS: partial ligand occupancy scales contributions, no oxidation inference',()=>{
 const cell={a:5.64,b:5.64,c:5.64,alpha:90,beta:90,gamma:90};
 const atoms=[{symbol:'Na',x:0,y:0,z:0},{symbol:'Cl',x:.5,y:0,z:0,occupancy:.5}];
 const result=api.bondValenceSum(atoms,0,cell,'Na1-Cl',3.5);
 assert.equal(result.count,2);
 approx(result.sum,Math.exp((2.15-2.82)/.37),1e-6);
});
test('stage3 best-fit plane: zero RMS for exact plane and stable tilted plane',()=>{
 const plane=api.leastSquaresPlane([[0,0,3],[1,0,3],[0,1,3],[1,1,3]]);
 approx(plane.rms,0,1e-10);
 approx(plane.max,0,1e-10);
 assert.ok(Math.abs(plane.normal[2])>.999999);
 const tilted=api.leastSquaresPlane([[0,0,0],[1,0,1],[0,1,1],[2,2,4],[.5,2,2.5]]);
 approx(tilted.rms,0,1e-8);
 approx(api.angleBetweenPlanes(plane,tilted),Math.acos(1/Math.sqrt(3))*180/Math.PI,1e-6);
 assert.throws(()=>api.leastSquaresPlane([[0,0,0],[1,0,0],[2,0,0]]),/doğrusal/);
 assert.throws(()=>api.leastSquaresPlane([[0,0,0],[1,1,0]]));
});
test('stage3 structure factor: BCC 100 extinction, 110 allowed and P1 100 allowed',()=>{
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 const pair=[{symbol:'Fe',x:0,y:0,z:0},{symbol:'Fe',x:.5,y:.5,z:.5}];
 assert.ok(api.structureFactor(1,0,0,pair,cell).intensity<1e-20);
 approx(api.structureFactor(1,1,0,pair,cell).intensity,4*26*26,1e-6);
 approx(api.structureFactor(1,0,0,pair.slice(0,1),cell).intensity,26*26,1e-6);
 const pattern=api.powderPattern(cell,pair,{wavelength:1.5406,maxIndex:2,maxAngle:90});
 assert.ok(pattern.groups.length>0);
 assert.ok(pattern.extinctions>0);
 assert.ok(pattern.groups[0].angle>30&&pattern.groups[0].angle<33);
 assert.match(api.xrdCsv(pattern),/2theta_deg/);
});
test('stage3 structure factor: anomalous scattering omitted; occupancy and Biso attenuate F',()=>{
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const atom={symbol:'Si',x:0,y:0,z:0,occupancy:.5};
 const half=api.structureFactor(1,0,0,[atom],cell).intensity;
 approx(half,49,1e-7);
 const thermal=api.structureFactor(1,0,0,[{...atom,uIso:.05}],cell).intensity;
 assert.ok(thermal<half);
 assert.throws(()=>api.powderPattern(cell,[atom],{wavelength:0,maxIndex:2}));
 assert.throws(()=>api.structureFactor(0,0,0,[atom],cell));
});

test('stage3 F-centered NaCl conventional -> primitive conserves two atomic species and quarter volume',()=>{
 const nacl=api.examples('nacl');
 const primitive=api.primitiveFromSetting(nacl.cell,nacl.sites,api.preferredSetting(225));
 assert.equal(primitive.kind,'F');
 assert.equal(primitive.sites.length,2);
 approx(primitive.det,.25);
 approx(api.volume(api.basis(primitive.cell)),api.volume(api.basis(nacl.cell))*.25,1e-6);
 assert.deepEqual([...primitive.sites.map(s=>s.symbol)].sort(),['Cl','Na']);
 assert.ok(primitive.sites.every(s=>s.occupancy===1));
});
test('stage3 I-centered BCC conventional -> primitive produces one atom and half volume',()=>{
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 const sites=[{symbol:'Fe',x:0,y:0,z:0},{symbol:'Fe',x:.5,y:.5,z:.5}];
 const result=api.primitiveFromSetting(cell,sites,api.preferredSetting(229));
 assert.equal(result.kind,'I');assert.equal(result.sites.length,1);
 approx(result.det,.5);
 approx(api.volume(api.basis(result.cell)),32,1e-6);
});
test('stage3 C-centered primitive translation and absent equivalent site fails closed',()=>{
 const cell={a:4,b:5,c:6,alpha:90,beta:90,gamma:90};
 const sites=[{symbol:'Na',x:0,y:0,z:0,occupancy:1},{symbol:'Na',x:.5,y:.5,z:0,occupancy:1}];
 const result=api.primitiveFromSetting(cell,sites,api.preferredSetting(63));
 assert.equal(result.kind,'C');assert.equal(result.sites.length,1);
 const incomplete=sites.slice(0,1);
 assert.throws(()=>api.primitiveFromSetting(cell,incomplete,api.preferredSetting(63)));
 const different=[sites[0],{...sites[1],symbol:'K'}];
 assert.throws(()=>api.primitiveFromSetting(cell,different,api.preferredSetting(63)));
 assert.equal(api.centeringFromSetting(api.preferredSetting(166)),'unsupported');
});
test('stage3 noncanonical short-basis: unimodular right-handed, preserves volume and atom count',()=>{
 const cell={a:10,b:4,c:5,alpha:90,beta:90,gamma:90},atom=[{symbol:'Si',x:.1,y:.2,z:.3}];
 const reduction=api.shortBasisTransform(cell);
 approx(api.matrixDet(reduction.P),1);
 approx(reduction.cell.a,4);
 approx(reduction.cell.b,5);
 const changed=api.transformCrystal(cell,atom,reduction.P);
 assert.equal(changed.sites.length,1);
 approx(api.volume(api.basis(changed.cell)),api.volume(api.basis(cell)),1e-6);
 const oblique={a:4,b:5,c:6,alpha:90,beta:90,gamma:35};
 const short=api.shortBasisTransform(oblique);
 const transformed=api.transformCrystal(oblique,atom,short.P);
 approx(api.volume(api.basis(transformed.cell)),api.volume(api.basis(oblique)),1e-6);
 assert.ok(short.steps>=1);
});

test('P0 Niggli canonical metrics match independent Gemmi GruberVector fixtures',()=>{
 // Baseline generated with gemmi 0.7.4: GruberVector(UnitCell(...),None).niggli_reduce()
 const fixtures=[
 [[5,5,5,90,90,90],[5,5,5,90,90,90]],
 [[10,4,5,90,90,90],[4,5,10,90,90,90]],
 [[6,7,8,76,84,101],[6,7,8,104,96,101]],
 [[4,5,6,90,90,35],[2.869480480581864,4,6,90,90,91.91242822046347]],
 [[7,6,5,62,78,89],[5,5.729895830889647,7,80.61010230027725,78,67.60349269215772]]
 ];
 for(const [values,expected] of fixtures){
  const cell=Object.fromEntries(['a','b','c','alpha','beta','gamma'].map((key,i)=>[key,values[i]]));
  const r=api.niggliReduceCell(cell);
  const actual=['a','b','c','alpha','beta','gamma'].map(k=>r.cell[k]);
  actual.forEach((v,i)=>approx(v,expected[i],2e-5));
  approx(api.matrixDet(r.P),1);
  approx(api.volume(api.basis(r.cell)),api.volume(api.basis(cell)),1e-5);
  const again=api.niggliReduceCell(r.cell);
  assert.equal(again.iterations,0);
 }
});
test('P0 Niggli change-of-basis preserves fractional positions and displacement tensors',()=>{
 const cell={a:4,b:5,c:6,alpha:90,beta:90,gamma:35};
 const site={symbol:'Si',x:.13,y:.21,z:.34,occupancy:1,adp:[.03,.02,.04,.001,.002,-.001]};
 const result=api.niggliReduceCell(cell);
 const transformed=api.transformCrystal(cell,[site],result.P);
 assert.equal(transformed.sites.length,1);
 // Distances from a site to its images remain identical after unimodular change.
 const next=[transformed.sites[0].x,transformed.sites[0].y,transformed.sites[0].z];
 const old=[site.x,site.y,site.z];
 for(let i=0;i<3;i++){
  const mapped=next.reduce((total,v,j)=>total+result.P[i][j]*v,0);
  approx(mapped-old[i],Math.round(mapped-old[i]),1e-6);
 }
 // A re-oriented conventional Cartesian basis rotates ADP; compare its invariants.
 const before=api.adpToCartesian(site.adp,cell),after=api.adpToCartesian(transformed.sites[0].adp,transformed.cell);
 const invariants=m=>[m[0][0]+m[1][1]+m[2][2],m.flat().reduce((total,v)=>total+v*v,0)];
 invariants(before).forEach((v,i)=>approx(v,invariants(after)[i],1e-6));
});

test('P0 Moyo cell encoding uses column-major A/B/C, fractional sites and atomic numbers',()=>{
 const cell={a:5,b:6,c:7,alpha:90,beta:90,gamma:90};
 const data=api.moyoInputCell(cell,[{symbol:'Si',x:.25,y:.5,z:.75,occupancy:1}]);
 assert.deepEqual(Array.from(data.numbers),[14]);
 assert.deepEqual(Array.from(data.positions[0]),[.25,.5,.75]);
 Array.from(data.lattice.basis).forEach((v,i)=>approx(v,[5,0,0,0,6,0,0,0,7][i],1e-10));
 assert.throws(()=>api.moyoInputCell(cell,[{symbol:'Si',x:0,y:0,z:0,occupancy:.5}]),/Kısmi/);
 assert.throws(()=>api.moyoInputCell(cell,[{symbol:'X',x:0,y:0,z:0}]),/Bilinmeyen/);
});
test('P0 Moyo standardization matrix is column-major and explicit input origin shift is applied',()=>{
 const c={a:4,b:6,c:7,alpha:90,beta:90,gamma:90};
 const rowMajor=[[0,1,0],[0,0,1],[1,0,0]];
 const flat=[0,0,1,1,0,0,0,1,0]; // column-major encoding
 const ds={
  number:1,hall_number:1,hm_symbol:'P1',std_linear:flat,
  std_origin_shift:[.25,0,0],prim_std_linear:flat,prim_std_origin_shift:[.25,0,0]
 };
 assert.deepEqual(Array.from(api.moyoMatrix(flat)[0]),rowMajor[0]);
 const orig=[{symbol:'Si',label:'Si1',x:.35,y:.15,z:.45,occupancy:1}];
 const out=api.moyoApplyCell(ds,false,c,orig);
 assert.equal(out.sites.length,1);
 approx(out.det,1);
 // P maps new coordinates [x',y',z'] to old [y',z',x'].
 const newFrac=[out.sites[0].x,out.sites[0].y,out.sites[0].z];
 approx(newFrac[0],.45,1e-6);
 approx(newFrac[1],.10,1e-6);
 approx(newFrac[2],.15,1e-6);
 assert.throws(()=>api.moyoTransformDetails({...ds,std_linear:Array(9).fill(0)},false));
});
test('P0 Moyo transform does not invent occupancy equivalence or crystal volume',()=>{
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const flatF=[0,.5,.5,.5,0,.5,.5,.5,0];
 const ds={number:225,hall_number:523,hm_symbol:'Fm-3m',std_linear:[1,0,0,0,1,0,0,0,1],
  std_origin_shift:[0,0,0],prim_std_linear:flatF,prim_std_origin_shift:[0,0,0]};
 const sites=[{symbol:'Cu',x:0,y:0,z:0},{symbol:'Cu',x:0,y:.5,z:.5},
  {symbol:'Cu',x:.5,y:0,z:.5},{symbol:'Cu',x:.5,y:.5,z:0}];
 const result=api.moyoApplyCell(ds,true,cell,sites);
 assert.equal(result.sites.length,1);
 approx(result.det,.25);
 assert.throws(()=>api.moyoApplyCell(ds,true,cell,sites.slice(0,3)),/atom sayısı|doluluk/i);
});

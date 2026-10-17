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
const htmlShell = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.match(htmlShell,/"three":"\.\/vendor\/three\/build\/three\.module\.js"/);
assert.doesNotMatch(htmlShell,/cdn\.jsdelivr\.net|unpkg\.com/,'the editor must not depend on a Three.js CDN');
for(const name of ['build/three.core.js','build/three.module.js','examples/jsm/controls/OrbitControls.js',
 'examples/jsm/geometries/ConvexGeometry.js','examples/jsm/math/ConvexHull.js',
 'examples/jsm/exporters/STLExporter.js','examples/jsm/exporters/GLTFExporter.js','LICENSE'])
 assert.ok(fs.statSync(path.join(__dirname,'..','vendor/three',name)).size>0,'missing local Three.js '+name);
const moduleScript = fs.readFileSync(path.join(__dirname, '..', 'crystal-app.js'), 'utf8');
// The application's sources are separate deployable files; assertions below
// intentionally inspect their combined content without re-embedding it in HTML.
const html = htmlShell + '\n' + fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8') + '\n' + moduleScript;
assert.ok(html.includes('<script type="module" src="./crystal-app.js"></script>'), 'HTML must load the modular app entry');
const bootstrapMarker = '// @kristalyapi/browser-bootstrap:';
const bootstrapIndex = moduleScript.indexOf(bootstrapMarker);
assert.ok(bootstrapIndex > 0, 'Browser startup marker must exist');
const script = moduleScript.slice(0, bootstrapIndex).replace(/^import .*?;\s*$/gm, '');
const context = { THREE: { Vector3, SphereGeometry: class {}, CylinderGeometry: class {} }, URLSearchParams, URL, TextEncoder, document: {getElementById(){return null;}} };
vm.createContext(context);
vm.runInContext(script + '\nthis.api={validateCell,basis,toCart,toFrac,volume,metric,examples,cifData,poscarData,xyzData,applySymmetry,PERIODIC_SYMBOLS,elementColor,bondRange,gizmoProjection,SPACE_GROUPS,sgKeys,settingOps,preferredSetting,expandSites,identifyWyckoff,validateSymmetryMetric,loadProject,surfaceVectors,createSurfaceSlab,planeNormal,planeIntersections,millerPlaneOffsets,minimumPeriodicImage,clipSegmentToCell,periodicBondSegments,parseBondRules,matrixDet,transformCrystal,codCifUrl,codEntryUrl,codCleanSymbol,codSearchParamsFromForm,codSearchUrl,codOptimadeItemUrl,codOptimadeSearchUrl,codSearchUrls,codRequestUrls,codValidateWorkerBase,codWorkerUrlFor,codOptimadeToCif,normalizeCodRecord,normalizeCodResults,codRecordForStorage,loadCodBookmarks,saveCodBookmarks,isLibraryHash,presetMetadata,PRESET_KEYS,LIBRARY_PANES,setLibraryPane,updatePresetPreview,EXPORT_FORMATS,exportFunction,LEFT_SIDEBAR_TABS,setLeftSidebarTab,initLeftSidebarTabs,RIGHT_SIDEBAR_TABS,setRightSidebarTab,volumeNumber,readCube,readChgcar,readXsf,readVolumetric,volumeGrid,volumeCubeText,volumeXsfText,interpretVolumeUnits,volumeShape,volumeVoxel,gridIndex,volumeWorld,volumeCoord,volumeSample,volumeAtWorld,volumesSameFrame,volumeGridCompatible,validateVolumeIsoLayer,sliceSampleMatrix,volumeSliceCsv,volumeBounds,isoTriangles,colorFromScalar,sliceWorldCorners,LAST_CRYSTAL_KEY,lastCrystalPayload,storeLastCrystal,restoreLastCrystal,coordinationNeighbors,coordinateBondSuggestion,setPairBondRule,removePairBondRule,dihedralDegrees,measurementCsv,normalizedMillerLayers,millerLayerKey,MAX_MILLER_LAYERS,createEditorHistory,isEditableHistoryTarget,historyShortcut,adpMatrix,adpToCartesian,adpFromCartesian,adpRotateBySymmetry,adpEllipsoid,adpEigen,cifExportText,cifScientificFingerprint,originalCifRecord,cifExportPreservingSource,cifMetaFromTags,cifMetaValid,normalizedLayerState,normalizedLayerOrder,normalizedMorphology,morphologyOrbit,morphologyHalfspaces,morphologyPolyhedron,normalizedOverlays,comparisonMetrics,BVS_PARAMETERS,bondValenceSum,bvsCsv,leastSquaresPlane,stage3FitFromIndices,angleBetweenPlanes,structureFactor,powderPattern,xrdCsv,PRIMITIVE_TRANSFORMS,CENTER_TRANSLATIONS,centeringFromSetting,verifyCenteringTranslations,primitiveFromSetting,shortBasisTransform,niggliReduceCell,moyoInputCell,moyoMatrix,moyoTransformDetails,moyoApplyCell};', context);
const api = context.api;
vm.runInContext('Object.assign(this.api,{bestPolyhedronElement,normalizedPolyCenters,pngExportLimits});',context);
vm.runInContext('Object.assign(this.api,{crystalSvgText,sliceContourLevels,sliceContourSegments,sliceLineProfile,sliceLineProfileCsv});',context);
vm.runInContext('Object.assign(this.api,{morphologyPointOrbit,tiffRgbBytes,pdfJpegBytes});',context);
vm.runInContext('Object.assign(this.api,{vectorPageLayout,vectorPdfBytes,vectorEpsText,vrmlEscape,bondIsPeriodic,bondNetwork,bondNetworkCsv});',context);
vm.runInContext('Object.assign(this.api,{pseudoVoigt,cagliotiFwhm,powderProfile,parsePowderCsv,powderProfileCsv});',context);
vm.runInContext('Object.assign(this.api,{shelxData,qeData,qeBravaisVectors,castepData,structureImportData});',context);
vm.runInContext('this.p1={linearVolumeCombination,linearVolumeCombination3,volumeIntegral,volumeFindPeaks,volumePeaksCsv,sliceMillerFrame,scatteringFactor,modelFourierMap,readFcf,observedFourierMap,parseMagneticOperation,rotateMagneticMoment,volumeVoronoiIntegration,volumeVoronoiCsv,pdbData,pdbSpaceGroup,pdbExportText,parseIonicCharges,madelungEwald};',context);
const p1=context.p1;
vm.runInContext('this.visualV2={validatedBounds,visibleTranslations,validatedVisualSite,MAX_ATOMS,MAX_BONDS};',context);
const visualV2=context.visualV2;
vm.runInContext('this.cameraScaleApi={projectionVisibleHeight,perspectiveFovForHeight};',context);
vm.runInContext('this.pageApi={pageFromHash,isLibraryHash,isReciprocalHash};',context);
function approx(a, b, eps = 1e-7) { assert.ok(Math.abs(a - b) < eps, a + ' expected ' + b); }
const cubic = { a: 5, b: 5, c: 5, alpha: 90, beta: 90, gamma: 90 };
test('fractional x/y/z bounds include negative periodic images without unbounded extents',()=>{
 const input=[[-.1,1.1],[0,1],[0,1]];
 assert.equal(JSON.stringify(visualV2.validatedBounds(input)),JSON.stringify(input));
 const translated=visualV2.visibleTranslations([.95,.5,.5],input,[1,1,1],true);
 assert.equal(JSON.stringify(translated[0]),'[-1,0]');
 assert.equal(JSON.stringify(translated[1]),'[0]');
 assert.throws(()=>visualV2.validatedBounds([[1.1,-.1],[0,1],[0,1]]),/Sınır aralığı/);
 assert.throws(()=>visualV2.validatedBounds([[-9,2],[0,1],[0,1]]),/Sınır aralığı/);
 assert.equal(visualV2.MAX_ATOMS,20000);assert.equal(visualV2.MAX_BONDS,65000);
});
test('polyhedron center skips uncoordinated Ba and chooses sixfold Ti in perovskite',()=>{
 const p=api.examples('perovskite'),B=api.basis(p.cell);
 const rules=new Map(),cut=p.cut;
 assert.ok(api.coordinationNeighbors(p.sites,0,B,rules,cut,true,12).length<4);
 assert.equal(api.coordinationNeighbors(p.sites,1,B,rules,cut,true,12).length,6);
 assert.equal(api.bestPolyhedronElement(p.sites,B,rules,cut,true,12),'Ti');
 assert.doesNotMatch(moduleScript,/count\s*<\s*64\s*;i\+\+/,'polyhedra must not silently truncate at 64');
});
test('multi-element polyhedron centers roundtrip and legacy single-center projects still work',()=>{
 const crystal=api.examples('perovskite');
 assert.deepEqual(Array.from(api.normalizedPolyCenters(undefined,'Ti',crystal.sites)),['Ti']);
 assert.deepEqual(Array.from(api.normalizedPolyCenters(['Ti','O','Ti','Xe'],'Ba',crystal.sites)),['Ti','O']);
 assert.throws(()=>api.normalizedPolyCenters('Ti','',crystal.sites),/en fazla 16/);
 assert.throws(()=>api.normalizedPolyCenters(['Ti','<script>'],'',crystal.sites),/element simgesi/);
 const multi=api.loadProject(JSON.stringify({...crystal,poly:'Ti',polyCenters:['Ti','O']}));
 assert.equal(multi.poly,'Ti');assert.deepEqual(Array.from(multi.polyCenters),['Ti','O']);
 const legacy=api.loadProject(JSON.stringify({...crystal,poly:'Ba'}));
 assert.equal(legacy.poly,'Ba');assert.deepEqual(Array.from(legacy.polyCenters),['Ba']);
 const storage=new Map(),adapter={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
 api.storeLastCrystal(adapter,{...multi,format:'kristalyapi-last-v2'});
 const restored=api.restoreLastCrystal(adapter);
 assert.deepEqual(Array.from(restored.polyCenters),['Ti','O']);
});
test('PNG checks actual viewport and renderbuffer limits, not texture size alone',()=>{
 const gl={MAX_VIEWPORT_DIMS:1,MAX_RENDERBUFFER_SIZE:2,getParameter(k){return k===1?[5000,2100]:3000;}};
 assert.deepEqual(JSON.parse(JSON.stringify(api.pngExportLimits(gl,8192))),
  {width:3000,height:2100,maxPixels:24000000});
 assert.throws(()=>api.pngExportLimits({...gl,getParameter:()=>null},8192),/WebGL PNG/);
});
test('TIFF export encodes lossless RGB pixels, dimensions and 300-DPI rational tags',()=>{
 const rgba=Uint8ClampedArray.from([12,34,56,255,200,150,100,255]);
 const tiff=api.tiffRgbBytes(2,1,rgba,300),dv=new DataView(tiff.buffer);
 assert.equal(dv.getUint16(0,true),0x4949);assert.equal(dv.getUint16(2,true),42);
 assert.equal(dv.getUint16(8,true),13);
 const tag=id=>{for(let i=0;i<13;i++){const p=10+i*12;if(dv.getUint16(p,true)===id)return {type:dv.getUint16(p+2,true),count:dv.getUint32(p+4,true),value:dv.getUint32(p+8,true)};}};
 assert.equal(tag(256).value,2);assert.equal(tag(257).value,1);
 assert.equal(tag(258).count,3);assert.equal(dv.getUint16(tag(258).value,true),8);
 assert.equal(tag(262).value,2);assert.equal(tag(259).value,1);
 assert.equal(tag(279).value,6);
 assert.equal(dv.getUint32(tag(282).value,true),300);assert.equal(dv.getUint32(tag(283).value,true),300);
 assert.deepEqual(Array.from(tiff.subarray(tag(273).value)),[12,34,56,200,150,100]);
 assert.throws(()=>api.tiffRgbBytes(2,1,rgba,72),/TIFF/);
 assert.throws(()=>api.tiffRgbBytes(2,1,rgba.subarray(0,4),300),/TIFF/);
});
test('A4 PDF export includes JPEG XObject, stream offsets and fitting page dimensions',()=>{
 const pseudoJpeg=Uint8Array.from([255,216,255,224,0,2,255,217]);
 const output=api.pdfJpegBytes(1200,800,pseudoJpeg);
 const pdf=Buffer.from(output.bytes).toString('latin1');
 assert.match(pdf,/^%PDF-1\.4/);assert.match(pdf,/\/MediaBox \[0 0 842 595\]/);
 assert.match(pdf,/\/Filter \/DCTDecode/);assert.match(pdf,/\/Width 1200 \/Height 800/);
 assert.match(pdf,/\/Im0 Do/);
 assert.ok(output.dpi>100&&output.dpi<200);
 const offset=Number(pdf.match(/startxref\n(\d+)/)[1]);
 assert.equal(pdf.slice(offset,offset+4),'xref');
 const portrait=api.pdfJpegBytes(800,1200,pseudoJpeg);
 assert.match(Buffer.from(portrait.bytes).toString('latin1'),/\/MediaBox \[0 0 595 842\]/);
 assert.throws(()=>api.pdfJpegBytes(1200,800,new Uint8Array(6)),/JPEG/);
});
test('vector PDF/EPS draws real Bezier geometry, no JPEG/image XObjects',()=>{
 const items=[
  {type:'circle',x:200,y:120,r:20,fill:'#cc6644',opacity:1,depth:2},
  {type:'line',x1:1,y1:2,x2:50,y2:60,width:3,stroke:'#1188aa',opacity:.6,depth:5},
  {type:'triangle',points:[[20,30],[50,30],[25,50]],fill:'#aabbcc',opacity:.4,depth:8},
  {type:'ellipse',x:130,y:100,rx:16,ry:9,angle:30,fill:'#226644',opacity:.7,depth:3},
  {type:'label',x:200,y:80,text:'C(1)',opacity:1,depth:1}
 ];
 const pdf=api.vectorPdfBytes(items,480,330),value=Buffer.from(pdf).toString('latin1');
 assert.match(value,/^%PDF-1\.4/);assert.match(value,/\/MediaBox \[0 0 842 595\]/);
 assert.match(value,/\/ExtGState/);assert.match(value,/\/BaseFont \/Helvetica/);
 assert.match(value,/ c\n/,'circles/ellipses must be cubic vector paths');
 assert.match(value,/Tj ET/);assert.doesNotMatch(value,/\/DCTDecode|\/Subtype \/Image|\/XObject/);
 const xref=Number(value.match(/startxref\n(\d+)/)[1]);assert.equal(value.slice(xref,xref+4),'xref');
 const eps=api.vectorEpsText(items,480,330);
 assert.match(eps,/^%!PS-Adobe-3\.0 EPSF-3\.0/);
 assert.match(eps,/%%BoundingBox: 0 0 842 595/);assert.match(eps,/curveto/);
 assert.match(eps,/setrgbcolor/);assert.match(eps,/stringwidth/);
 assert.doesNotMatch(eps,/colorimage|image\s*$/m);
 assert.throws(()=>api.vectorPdfBytes([{...items[0],fill:'javascript:alert(1)'}],480,330),/rengi/);
 assert.throws(()=>api.vectorEpsText(items,0,330),/boyutu/);
});
test('molecule and periodic crystal bond networks preserve different boundary semantics',()=>{
 const cell={a:10,b:10,c:10,alpha:90,beta:90,gamma:90};
 const square=[[0,0],[1.42,0],[1.42,1.42],[0,1.42]].map(([x,y],i)=>({symbol:'C',label:'C'+i,x:(x+2)/10,y:(y+2)/10,z:.5}));
 const finite=api.bondNetwork(square,cell,{periodic:false,cut:2,auto:true});
 assert.equal(finite.edges.length,4);assert.equal(finite.components.length,1);assert.equal(finite.cycleRank,1);
 assert.equal(finite.periodicEdges,0);
 assert.equal(api.bondNetworkCsv(finite,square).trim().split('\n').length,5);
 const one=[{symbol:'Si',x:0,y:0,z:0}],tiny={a:2,b:2,c:2,alpha:90,beta:90,gamma:90};
 const periodic=api.bondNetwork(one,tiny,{periodic:true,cut:2.1,auto:false});
 assert.equal(periodic.edges.length,3,'simple cubic neighbors form three independent undirected periodic edge classes');
 assert.equal(periodic.periodicEdges,3);assert.equal(periodic.cycleRank,null);
 assert.equal(api.bondNetwork(one,tiny,{periodic:false,cut:2.1,auto:false}).edges.length,0);
 assert.equal(api.bondIsPeriodic('auto',true),false);assert.equal(api.bondIsPeriodic('auto',false),true);
 assert.equal(api.bondIsPeriodic('periodic',true),true);
 assert.throws(()=>api.bondIsPeriodic('invalid',true),/modu/);
 assert.throws(()=>api.bondNetwork(Array(301).fill(one[0]),cell),/300/);
 assert.equal(api.vrmlEscape('A "B"\nC'),'A \\"B\\" C');
 const water=api.xyzData('3\nH2O\nO 0 0 0\nH .9584 0 0\nH -.239 0 .927');
 assert.equal(water.nonPeriodic,true);
 const restored=api.loadProject(JSON.stringify({...water,bondMode:'molecule'}));
 assert.equal(restored.nonPeriodic,true);assert.equal(restored.bondMode,'molecule');
 assert.throws(()=>api.loadProject(JSON.stringify({...water,bondMode:'bad-mode'})),/bağ arama modu/);
});
test('SVG vector export serializes projected atoms, bonds and polygon faces without raster images',()=>{
 const shapes=[
  {type:'circle',x:50,y:30,r:12,fill:'#cc3300',opacity:1,depth:2},
  {type:'line',x1:5,y1:6,x2:60,y2:40,width:3,stroke:'#778899',opacity:.7,depth:5},
  {type:'triangle',points:[[0,0],[30,0],[8,20]],fill:'#335577',opacity:.3,depth:8},
  {type:'label',x:50,y:12,text:'C<&"',depth:1,opacity:1}
 ];
 const svg=api.crystalSvgText(shapes,320,200,'Quartz<&"',false);
 assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svg,/<radialGradient/);assert.match(svg,/<circle/);assert.match(svg,/<path/);
 assert.match(svg,/Quartz&lt;&amp;&quot;/);assert.match(svg,/C&lt;&amp;&quot;/);
 assert.doesNotMatch(svg,/<image|data:image|foreignObject/);
 assert.ok(svg.indexOf('fill="#335577"')<svg.indexOf('<circle'),'distant face must paint behind atom');
 assert.doesNotMatch(api.crystalSvgText([],10,10,'',true),/<rect/);
 assert.throws(()=>api.crystalSvgText([{...shapes[0],fill:'url(javascript:alert(1))'}],10,10),/renk/);
});
test('2D contour levels are evenly spaced, finite, and include reference threshold',()=>{
 const levels=api.sliceContourLevels(new Float32Array([0,2,4,NaN,6,8]),3,5);
 assert.equal(levels.length,4);approx(levels[0],2);approx(levels[1],4);approx(levels[2],5);approx(levels[3],6);
 assert.equal(api.sliceContourLevels(new Float32Array([1,1,1]),4).length,0);
 assert.throws(()=>api.sliceContourLevels(new Float32Array([0,1]),21),/2–20/);
});
test('marching squares gives correct linear-field contours and preserves holes',()=>{
 const values=new Float32Array([0,1,2,0,1,2,0,1,2]);
 const linear=api.sliceContourSegments(values,3,[.5,1.5]);
 assert.equal(linear.segments.length,4);
 for(const s of linear.segments)approx(s.x1,s.level);
 const hole=api.sliceContourSegments(new Float32Array([0,1,2,0,NaN,2,0,1,2]),3,[.5]);
 assert.equal(hole.segments.length,0,'undefined Miller pixels must not be connected');
 const saddle=api.sliceContourSegments(new Float32Array([1,0,0,1]),2,[.5]);
 assert.equal(saddle.segments.length,2,'ambiguous saddle requires two disjoint arcs');
});
test('line profile reports real Cartesian Angstrom distance in a skew slice',()=>{
 const slice={resolution:3,values:new Float32Array([0,1,2,0,1,2,0,1,2]),units:'e/Å³',
  corners:[[0,0,0],[4,0,0],[6,3,0],[2,3,0]]};
 const profile=api.sliceLineProfile(slice,[0,0],[1,1],5);
 approx(profile.length,Math.sqrt(6*6+3*3));
 approx(profile.rows[2].value,1);approx(profile.rows.at(-1).distance,profile.length);
 approx(profile.rows.at(-1).world[0],6);
 const csv=api.sliceLineProfileCsv(profile);
 assert.match(csv,/distance_A,u,v,x_A,y_A,z_A,value_e___/);
 assert.equal(csv.trim().split('\n').length,6);
 assert.throws(()=>api.sliceLineProfile(slice,[0,0],[0,0]),/iki farklı/);
});
test('per-site atom/polyhedron styles and fractional bounds survive validated project roundtrip',()=>{
 const model=JSON.parse(vm.runInContext('JSON.stringify(lastCrystalPayload(state))',context));
 model.style='poly';model.poly='Si';model.polyColor='#125588';model.polyOpacity=.5;
 model.bounds=[[-.1,1.1],[0,1],[.1,.9]];
 Object.assign(model.sites[0],{visualColor:'#dd9944',visualScale:1.6,polyColor:'#4499bb',polyOpacity:.65});
 context.__styleProject=JSON.stringify(model);
 const restored=JSON.parse(vm.runInContext('JSON.stringify(loadProject(__styleProject))',context));
 assert.equal(restored.style,'poly');assert.equal(restored.polyOpacity,.5);
 assert.deepEqual(restored.bounds,model.bounds);
 assert.equal(restored.sites[0].visualColor,'#dd9944');
 assert.equal(restored.sites[0].visualScale,1.6);
 assert.equal(restored.sites[0].polyColor,'#4499bb');
 assert.equal(restored.sites[0].polyOpacity,.65);
 assert.throws(()=>visualV2.validatedVisualSite({visualScale:999}),/ölçeği/);
 assert.throws(()=>visualV2.validatedVisualSite({polyColor:'red'}),/rengi/);
});
test('Workspaces: independent crystals persist and active selection restores with ten-item validation',()=>{
 const sandbox={THREE:{Vector3,SphereGeometry:class{},CylinderGeometry:class{}},URLSearchParams,URL,
  document:{getElementById(){return null;}},window:{localStorage:{data:{},getItem(key){return this.data[key]??null;},setItem(key,value){this.data[key]=value;}}}};
 vm.createContext(sandbox);vm.runInContext(script,sandbox);
 const initial=JSON.parse(vm.runInContext('JSON.stringify(lastCrystalPayload(state))',sandbox));
 const another=JSON.parse(JSON.stringify(initial));another.name='Yapı B';another.cell.a=7.25;
 const key='kristalyapi.workspaces.v1';
 const valid={format:'kristalyapi-workspaces-v1',activeId:'ws-2',items:[
  {id:'ws-1',label:'Örnek Si',crystal:initial,camera:null},
  {id:'ws-2',label:'Yeni model',crystal:another,camera:null}
 ]};
 sandbox.window.localStorage.setItem(key,JSON.stringify(valid));
 assert.equal(vm.runInContext('restoreWorkspaceSession(window.localStorage)',sandbox),true);
 const recovered=JSON.parse(vm.runInContext('JSON.stringify({activeId:activeWorkspaceId,name:state.name,cell:state.cell,items:workspaces.map(x=>({label:x.label,name:x.state.name}))})',sandbox));
 assert.equal(recovered.activeId,'ws-2');assert.equal(recovered.name,'Yapı B');
 assert.equal(recovered.cell.a,7.25);assert.equal(recovered.items[0].name,initial.name);
 vm.runInContext('persistWorkspaceSession()',sandbox);
 const saved=JSON.parse(sandbox.window.localStorage.getItem(key));
 assert.equal(saved.items.length,2);assert.equal(saved.items[0].crystal.cell.a,initial.cell.a);
 assert.equal(saved.items[1].crystal.cell.a,7.25);
 for(const malicious of [
  {...valid,items:Array.from({length:11},(_,i)=>({id:'ws-'+(i+1),label:'Yapı',crystal:initial}))},
  {...valid,items:[valid.items[0],valid.items[0]]},
  {...valid,items:[{id:'invalid',label:'X',crystal:another}]}
 ]){
  sandbox.window.localStorage.setItem(key,JSON.stringify(malicious));
  assert.throws(()=>vm.runInContext('restoreWorkspaceSession(window.localStorage)',sandbox),/geçersiz|kimliği/i);
 }
});
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
test('SHELXL .res: LATT inversion, SFAC species, FVAR occupancies and fractional coordinates',()=>{
 const source=`TITL Mineral sample
CELL 0.71073 6 7 8 90 90 90
LATT 1
SFAC C O
FVAR 1.0 0.35
C1 1 0.2 0.3 0.4 11.00000 0.04
O1 2 0.1 0.2 0.3 21.00000 0.03
HKLF 4
Q1 1 .2 .3 .4 11 .05
END`;
 const result=api.shelxData(source);
 assert.equal(result.name,'Mineral sample');assert.equal(result.sites.length,4);
 const oxygen=result.sites.filter(s=>s.symbol==='O');assert.equal(oxygen.length,2);
 oxygen.forEach(s=>approx(s.occupancy,.35));
 assert.ok(result.sites.some(s=>s.symbol==='C'&&Math.abs(s.x-.8)<1e-6));
 assert.match(result.warning,/LATT\/SYMM/);
});
test('SHELXL .ins: F-centered acentric and free-variable complement produce no double images',()=>{
 const input=`CELL 0.7 5 5 5 90 90 90
LATT -4
SFAC O
FVAR 1 .2
O1 1 .1 .2 .3 -21.0 .06
END`;
 const result=api.structureImportData(input,'sample.ins');
 assert.equal(result.sites.length,4);
 result.sites.forEach(s=>approx(s.occupancy,.8));
 assert.throws(()=>api.shelxData(input.replace('FVAR 1 .2','FVAR 1')),/FVAR 2/);
 assert.throws(()=>api.shelxData(input.replace('LATT -4','LATT 0')),/LATT/);
});
test('SHELXL SYMM expressions expand correctly and duplicate special positions collapse',()=>{
 const source='CELL .7 4 4 4 90 90 90\nLATT -1\nSYMM -X,Y,Z\nSFAC Si\nSi1 1 .25 .2 .3 11 .02';
 const a=api.shelxData(source);assert.equal(a.sites.length,2);
 approx(a.sites[1].x,.75);
 assert.equal(api.shelxData(source.replace('.25 .2 .3','0 .2 .3')).sites.length,1);
});
test('SHELXL Uiso and anisotropic Uij survive symmetry-expanded import',()=>{
 const iso=api.shelxData('CELL .7 4 4 4 90 90 90\nLATT 1\nSFAC C\nC1 1 .2 .3 .4 11 .05');
 assert.equal(iso.sites.length,2);iso.sites.forEach(s=>approx(s.uIso,.05));
 const adp=api.shelxData('CELL .7 4 4 4 90 90 90\nLATT 1\nSFAC C\nC1 1 .2 .3 .4 11 .03 .04 .05 .001 .002 .003');
 assert.equal(adp.sites.length,2);adp.sites.forEach(s=>{
  assert.equal(s.adp.length,6);approx(s.adp[0],.03);approx(s.adp[3],.001);
 });
});
test('QE pw.x: ibrav=0 CELL_PARAMETERS angstrom and fractional atomic positions',()=>{
 const text=`&CONTROL
/
&SYSTEM
 ibrav=0, nat=2, ntyp=2
/
CELL_PARAMETERS (angstrom)
3 0 0
0 4 0
0 0 5
ATOMIC_SPECIES
Na 22.99 Na.UPF
Cl 35.4 Cl.UPF
ATOMIC_POSITIONS {crystal}
Na 0 0 0 1 1 1
Cl .5 .5 .5 1 0 1
K_POINTS gamma`;
 const result=api.structureImportData(text,'qe.pwi');
 assert.equal(result.sites.length,2);approx(result.cell.c,5);approx(result.sites[1].z,.5);
 assert.throws(()=>api.qeData(text.replace('ATOMIC_POSITIONS {crystal}','ATOMIC_POSITIONS {crystal_sg}')),/crystal_sg/);
 assert.throws(()=>api.qeData(text.replace('nat=2','nat=3')),/QE atom koordinatı/);
});
test('QE pw.x: Bohr and alat Cartesian units preserve off-axis fractional positions',()=>{
 const p=`&SYSTEM ibrav=0, nat=1, celldm(1)=10.0 /\nCELL_PARAMETERS {alat}\n1 0 0\n0 1 0\n0 0 1\nATOMIC_POSITIONS {bohr}\nFe1 5 0 0`;
 const d=api.qeData(p);approx(d.cell.a,10*.529177210903);approx(d.sites[0].x,.5);
 const ang=`&SYSTEM ibrav=0, nat=1 /\nCELL_PARAMETERS (bohr)\n10 0 0\n0 10 0\n0 0 10\nATOMIC_POSITIONS alat\nSi 0 .5 0`;
 approx(api.qeData(ang).sites[0].y,.5);
 assert.throws(()=>api.qeData(p.replace('celldm(1)=10.0','')),/alat birimi/);
});
test('QE ibrav primitive Bravais axes: fcc, bcc, hexagonal, monoclinic and triclinic',()=>{
 const sample=(ibrav,params='')=>api.qeData(`&SYSTEM ibrav=${ibrav}, nat=1, A=4 ${params} /\nATOMIC_POSITIONS crystal\nSi 0 0 0`);
 approx(sample(2).cell.a,4/Math.sqrt(2));
 approx(sample(3).cell.a,4*Math.sqrt(3)/2);
 approx(sample(4,', C=6').cell.gamma,120);
 approx(sample(12,', B=5, C=6, cosAB=0.5').cell.gamma,60);
 approx(sample(14,', B=5, C=6, cosBC=.2, cosAC=.1, cosAB=-.15').cell.alpha,Math.acos(.2)*180/Math.PI);
 assert.throws(()=>sample(14,', B=5, C=6'),/kosinüs/);
 assert.throws(()=>sample(8,', C=6'),/b veya/);
});
test('CASTEP .cell: LATTICE_CART bohr with POSITIONS_ABS and comments',()=>{
 const text=`%BLOCK LATTICE_CART
bohr
10 0 0 # a
0 10 0
0 0 10
%ENDBLOCK LATTICE_CART
%BLOCK POSITIONS_ABS
bohr
Si 5 0 0
Si 0 5 0 ! second
%ENDBLOCK POSITIONS_ABS`;
 const d=api.structureImportData(text,'Si.cell');
 approx(d.cell.a,10*.529177210903);approx(d.sites[0].x,.5);approx(d.sites[1].y,.5);
});
test('CASTEP LATTICE_ABC, fractional positions, reject ambiguous or unknown units',()=>{
 const text=`%block lattice_abc
ang
4 5 6
90 90 120
%endblock lattice_abc
%block positions_frac
C .2 .4 .6
%endblock positions_frac`;
 const d=api.castepData(text);approx(d.cell.gamma,120);approx(d.sites[0].z,.6);
 assert.throws(()=>api.castepData(text.replace('ang','furlong')),/birimi/);
 assert.throws(()=>api.castepData(text+'\n%block positions_abs\nSi 0 0 0\n%endblock positions_abs'),/bir POSITIONS/);
 assert.throws(()=>api.castepData(text.replace('%endblock lattice_abc','%endblock positions_frac')),/%ENDBLOCK/);
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
test('COD classic and OPTIMADE/Worker records preserve identical scientific metadata',()=>{
 const classic={
  file:'4335507',formula:'- Ge4 In0.94 La4 Mn2 -',calcformula:'- Ge4 In0.945 La4 Mn2 -',
  commonname:'lanthanum manganese indium germanide (4/2/1/4)',
  sg:'C 1 2/m 1',sgHall:'-C 2y',sgNumber:'12',
  a:'16.646',siga:'0.002',b:'4.419',sigb:'0.0006',c:'7.4834',sigc:'0.001',
  alpha:'90',beta:'106.893',sigbeta:'0.002',gamma:'90',vol:'526.72',sigvol:'0.12',
  celltemp:'173',sigcelltemp:'2',authors:'Anton O. Oliynyk; Stanislav S. Stoyko; Arthur Mar',
  title:'Quaternary Germanides RE4Mn2InGe4',journal:'Inorganic Chemistry',year:'2013',
  volume:'52',firstpage:'8264',lastpage:'8271',doi:'10.1021/ic401171v',nel:'4',
  Rall:'0.0234',Robs:'0.0195',wRobs:'0.0406',wRref:'0.0417',gofref:'1.054',
  wavelength:'0.71073',radType:'MoKα',flags:'has coordinates'
 };
 const optimade={id:'4335507',attributes:{
  chemical_formula_descriptive:'Ge4In0.94La4Mn2',
  ...Object.fromEntries(Object.entries(classic).map(([key,value])=>['_cod_'+key,value]))
 }};
 const direct=api.normalizeCodRecord(classic);
 const viaWorker=api.normalizeCodResults({data:[optimade]})[0];
 for(const key of ['formula','calculatedFormula','commonName','spacegroup','spacegroupNumber','spacegroupHall',
  'cellA','cellB','cellC','sigmaA','sigmaB','sigmaC','beta','sigmaBeta','volume','sigmaVolume',
  'cellTemperature','sigmaCellTemperature','journal','year','journalVolume','authors','title',
  'firstPage','lastPage','doi','elements','residualAll','residualObserved','weightedResidualObserved',
  'weightedResidualRefined','goodnessOfFit','radiationWavelength','radiationType','hasCoordinates','hasDisorder','hasFobs']){
  assert.ok(direct[key],key+' must be populated from classic COD');
  assert.equal(viaWorker[key],direct[key],key+' must match OPTIMADE/Worker data');
 }
 assert.equal(direct.formula,'Ge4 In0.94 La4 Mn2');
 const stored=api.codRecordForStorage(viaWorker);
 assert.equal(stored.sigmaVolume,'0.12');
 assert.equal(stored.journalVolume,'52');
 assert.equal(stored.spacegroupHall,'-C 2y');
 const normalized=JSON.stringify(viaWorker);
 const details=vm.runInContext('codDetailGroups('+normalized+')',context);
 assert.ok(details.find(group=>group.title==='Yapı parametreleri').fields.some(item=>item.label==='a'&&item.value==='16.646 ± 0.002 Å'));
 assert.ok(details.find(group=>group.title==='Kırınım ve rafinman').fields.some(item=>item.label==='Fobs mevcut'&&item.value==='Hayır'));
});
test('COD detail modal, locale controls, favicon and deployment assets are wired',()=>{
 assert.match(html,/id="codDetailModal"/);
 assert.match(html,/id="codDetailGroups"/);
 assert.match(html,/id="languageEnglish"/);
 assert.match(html,/id="languageTurkish"/);
 assert.match(html,/<html lang="en">/);
 assert.match(html,/rel="icon" type="image\/svg\+xml" href=".\/favicon.svg"/);
 const translations=fs.readFileSync(path.join(__dirname,'..','translations.js'),'utf8');
 assert.match(translations,/\['Kütüphane','Library'\]/);
 assert.match(translations,/MutationObserver/);
 const favicon=fs.readFileSync(path.join(__dirname,'..','favicon.svg'),'utf8');
 assert.match(favicon,/<svg/);
 const workflow=fs.readFileSync(path.join(__dirname,'..','.github/workflows/pages.yml'),'utf8');
 assert.match(workflow,/cp translations\.js public\/translations\.js/);
 assert.match(workflow,/cp favicon\.svg public\/favicon\.svg/);
});
test('English dictionary covers the existing static editor, library and analysis texts',()=>{
 const uiContext={window:{},document:{title:'',readyState:'loading',addEventListener(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','translations.js'),'utf8'),uiContext);
 const fragment=html.slice(html.indexOf('<header>'),html.indexOf('<script type="module" src="./crystal-app.js">'));
 const labels=[...new Set([...fragment.matchAll(/>([^<>]+)</g)]
  .map(match=>match[1].trim()).filter(text=>text.length>5&&/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text)))];
 const languageNeutral=new Set(['GitHub ↗','Element A','Element B','FCC conventional → primitive',
  'BCC conventional → primitive','FCC primitive → conventional','Standard (ITA)','3B / 2B',
  'Cloudflare Worker · COD API','Otomatik','Fd-3m · 227','Crystallography Open Database · COD','POSCAR',
  'Cu Kα1 · 1.5406 Å','Co Kα1 · 1.7890 Å','Mo Kα1 · 0.7093 Å','Ag Kα1 · 0.5594 Å']);
 assert.deepEqual(labels.filter(label=>!languageNeutral.has(label)&&
  uiContext.window.CrystalI18n.t(label)===label),[]);
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
test('Save dialog offers offline STL and binary glTF 3D exports alongside existing formats',()=>{
 assert.match(html,/id="saveBtn"[^>]*aria-haspopup="dialog"/);
 assert.match(html,/id="exportModal"[^>]*role="dialog"[^>]*aria-modal="true"/);
 assert.deepEqual(Array.from(api.EXPORT_FORMATS),['project','cif','poscar','xyz','pdb','png','tiff','pdf','svg','pdf-vector','eps','stl','glb','vrml']);
 for(const name of api.EXPORT_FORMATS){
  assert.match(html,new RegExp('data-export="'+name+'"'));
  assert.equal(typeof api.exportFunction(name),'function');
 }
 assert.equal(api.exportFunction('project').name,'saveProject');
 assert.equal(api.exportFunction('cif').name,'exportCif');
 assert.equal(api.exportFunction('poscar').name,'exportPoscar');
 assert.equal(api.exportFunction('xyz').name,'exportXyz');
 assert.equal(api.exportFunction('pdb').name,'exportPdb');
 assert.equal(api.exportFunction('png').name,'screenshot');
 assert.equal(api.exportFunction('tiff').name,'exportTiff');
 assert.equal(api.exportFunction('pdf').name,'exportPdf');
 assert.equal(api.exportFunction('svg').name,'exportSvg');
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
 assert.ok(!left.includes('<h2>Görünüm'),'old duplicate appearance section must be removed');
 assert.ok(left.includes('<h2>Birim hücre'));
 for(const id of ['style','bonds','autoBond','cellVisible','boundary','labels','axes','autoRotate','adpVisible','atomScale','bondCut'])
  assert.ok(!left.includes('id="'+id+'"'),id+' should be controlled by the bottom bar');
 assert.match(html,/id="legacyViewControls" hidden aria-hidden="true"/);
 assert.ok(!left.includes('Miller düzlemleri (hkl)'));
 const right=html.slice(html.indexOf('id="rightMillerPane"'),html.indexOf('id="rightToolRail"'));
 assert.ok(right.includes('Miller düzlemleri (hkl)'));
 assert.ok(!html.includes('class="view-help"'));
 assert.ok(!html.includes('class="gizmo-caption"'));
 assert.ok(!html.includes('<footer>Tarayıcıda çalışır'));
 assert.ok(!html.includes('class="floating footbar"'));
 assert.deepEqual(Array.from(api.RIGHT_SIDEBAR_TABS),['info','comparison','measurement','history','bvs','plane','xrd','volume','layers','bonds','lattice','miller','symmetry']);
 const rail=html.slice(html.indexOf('id="rightToolRail"'),html.indexOf('</nav>',html.indexOf('id="rightToolRail"')));
 assert.equal((rail.match(/data-right-tool="/g)||[]).length,13);
 assert.match(rail,/data-right-tool="measurement"[\s\S]*?data-right-tool="history"/);
 assert.match(html,/\.right-drawer-pane>\.section\[data-right-section\]>h2:first-child\{display:none\}/);
 assert.ok(!html.includes('Bilimsel kapsam</h2>'),'redundant scientific scope block should be removed');
 assert.ok(html.includes('id="notice"'),'dynamic scientific notices should still have an outlet');
 const measurement=html.slice(html.indexOf('data-right-section="measurement"'),html.indexOf('data-right-section="history"'));
 const measurementHistory=html.slice(html.indexOf('data-right-section="history"'),html.indexOf('data-right-section="bvs"'));
 assert.ok(measurement.includes('id="measurementCount"'));
 assert.ok(measurement.includes('id="openMeasurementHistory"'));
 assert.ok(!measurement.includes('id="measurementHistory"'),'history records must not crowd the measurement pane');
 assert.ok(measurementHistory.includes('id="measurementHistory"'));
 assert.ok(measurementHistory.includes('id="exportMeasurements"'));
 assert.match(html,/#distanceResult,#periodicResult/);
 assert.match(html,/#angleResult,#torsionResult/);
 for(const key of ['bonds','lattice','symmetry'])assert.match(left,new RegExp('data-right-section="'+key+'"'));
 assert.match(html,/if\(name==='miller'\)while\(\$\('rightMillerPane'\)/);
 const quickbar=html.slice(html.indexOf('id="workbenchQuickbar"'),html.indexOf('id="toast"'));
 assert.equal((quickbar.match(/data-quick-flag="/g)||[]).length,8);
 for(const id of ['quickStyle','quickAtomScale','quickBondCut','quickH','quickK','quickL',
  'quickSlabThickness','quickShowPlane','quickRepeatMillerPlanes',
  'adpLevel','polyElement','polyCut','polyNeighbors'])assert.ok(quickbar.includes('id="'+id+'"'),id);
 for(const type of ['ball','space','stick','wire'])assert.match(quickbar,new RegExp('<option value="'+type+'"'));
 assert.match(html,/#viewport #stage\{bottom:var\(--quickbar-height\)\}/);
 assert.match(html,/#viewport\{--quickbar-height:80px\}/);
 assert.match(html,/\.workbench-quickbar\{[^}]*grid-template-columns:minmax\(420px,1fr\) minmax\(345px,auto\)[^}]*overflow-x:auto/);
 assert.match(html,/#app\.right-drawer-open \.quickbar-group:last-child\{justify-self:start\}/);
 assert.doesNotMatch(html,/#app\.right-drawer-open #viewport\{--quickbar-height:142px\}/);
 assert.match(html,/\.quickbar-ranges\{display:flex;gap:12px;justify-content:flex-start\}/);
 assert.match(html,/\.quickbar-range input\{[^}]*max-width:142px/);
 assert.match(html,/\.quickbar-analysis \.quickbar-poly\{[^}]*max-width:155px/);
 assert.match(html,/function syncAnalysisAvailability\(\)/);
 assert.match(html,/\.quickbar-hkl \.quickbar-field\{flex:0 0 41px;width:41px\}/);
 for(const id of ['quickShowPlane','quickRepeatMillerPlanes'])
  assert.match(quickbar,new RegExp('<button id="'+id+'"[^>]*aria-pressed="(?:true|false)"[^>]*><svg'));
 for(const id of ['adpLevel','polyElement','polyCut','polyNeighbors'])
  assert.ok(!left.includes('id="'+id+'"'),id+' must stay outside the left sidebar');
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
test('P1+ CHGCAR reads collinear and noncollinear spin blocks after PAW augmentation',()=>{
 const header=['Spin CHGCAR','1.0','2 0 0','0 2 0','0 0 2','Fe','1','Direct','0 0 0','','2 2 2'];
 const charge=['0 0 0 0 0 0 0 0'];
 const spin=['2 2 2','8 8 8 8 8 8 8 8'];
 const col=api.readChgcar([...header,...charge,'augmentation occupancies   1 10','9 8 7',...spin].join('\n'));
 assert.equal(col.spinMode,'collinear');assert.equal(col.spinComponents.length,1);
 assert.equal(col.spinComponents[0].axis,'z');
 assert.equal(col.spinComponents[0].grid.quantity,'magnetization');
 approx(col.spinComponents[0].grid.values[0],1);
 const nc=api.readChgcar([...header,...charge,...spin,...spin,...spin].join('\n'));
 assert.equal(nc.spinMode,'noncollinear');
 assert.deepEqual(Array.from(nc.spinComponents.map(s=>s.axis)),['x','y','z']);
 assert.throws(()=>api.readChgcar([...header,...charge,...spin,...spin].join('\n')),/üç bileşen/);
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
test('CUBE export preserves skew Cartesian Angstrom geometry, scalar ordering and units comment',()=>{
 const g=api.volumeGrid([2,3,2],[1.2,-2.5,.75],[[.2,0,0],[.1,.4,0],[0,.07,.35]],
  Array.from({length:12},(_,i)=>i-.25),'derived','e/Å³');
 g.quantity='density';g.title='A − B';
 const text=api.volumeCubeText(g);
 assert.match(text,/^A − B\nKristal Yapi \| quantity=density \| units=e\/Å³\n0 /);
 assert.match(text,/\n-2 /);assert.match(text,/\n-3 /);
 const again=api.readCube(text);
 assert.deepEqual(Array.from(again.dims),[2,3,2]);
 for(let k=0;k<3;k++)for(let j=0;j<3;j++)approx(again.axes[k][j],g.axes[k][j],1e-9);
 for(let k=0;k<3;k++)approx(again.origin[k],g.origin[k],1e-9);
 Array.from(again.values).forEach((v,i)=>approx(v,g.values[i],1e-6));
});
test('XSF export respects x-fastest order; periodic datasets close their boundary planes',()=>{
 const g=api.volumeGrid([2,2,2],[1,-1,2],[[2,0,0],[0,3,0],[0,0,4]],
  [0,1,2,3,4,5,6,7],'CHGCAR-SPIN','μB/Å³');
 g.quantity='magnetization';g.periodic=true;
 const text=api.volumeXsfText(g);
 assert.match(text,/BEGIN_DATAGRID_3D_scalar\n3 3 3\n/);
 assert.match(text,/units=μB\/Å³/);
 const expanded=api.readXsf(text);
 assert.deepEqual(Array.from(expanded.dims),[3,3,3]);
 approx(expanded.values[api.gridIndex(expanded,2,0,0)],g.values[api.gridIndex(g,0,0,0)]);
 approx(expanded.values[api.gridIndex(expanded,1,2,1)],g.values[api.gridIndex(g,1,0,1)]);
 const restored=api.interpretVolumeUnits(expanded,'density-angstrom',{periodic:true});
 assert.deepEqual(Array.from(restored.dims),[2,2,2]);
 Array.from(restored.values).forEach((v,i)=>approx(v,g.values[i]));
 const nonPeriodic=api.volumeGrid([2,2,2],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],
  [0,1,2,3,4,5,6,7],'FO-FC','relative');
 const plain=api.readXsf(api.volumeXsfText(nonPeriodic));
 assert.deepEqual(Array.from(plain.dims),[2,2,2]);
 Array.from(plain.values).forEach((v,i)=>approx(v,nonPeriodic.values[i]));
 assert.throws(()=>api.volumeCubeText({...g,values:[NaN,...g.values.slice(1)]}),/NaN/);
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
test('supercell multipliers use bounded plus/minus stepper controls',()=>{
 const panel=html.slice(html.indexOf('<h2>Süperhücre</h2>'),html.indexOf('id="applyRepeat"'));
 assert.equal((panel.match(/class="supercell-stepper"/g)||[]).length,3);
 for(const name of ['ra','rb','rc']){
  assert.match(panel,new RegExp('id="'+name+'" type="number" min="1" max="6" step="1"'));
  for(const step of ['-1','1'])assert.match(panel,new RegExp('data-repeat-target="'+name+'" data-repeat-step="'+step+'"'));
 }
 assert.match(html,/function syncRepeatSteppers\(\)/);
 assert.match(html,/function initRepeatSteppers\(\)/);
 assert.match(html,/initRepeatSteppers\(\);/);
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
 assert.ok(moduleScript.includes("$('undoBtn').onclick="));
 assert.ok(moduleScript.includes("$('redoBtn').onclick="));
 assert.ok(moduleScript.includes('if(historyShortcut(e))return'));
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
 assert.equal(order.length,12);
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
test('P1 volumetric arithmetic interpolates mismatched resolution without silently mixing units',()=>{
 const valsA=[],valsB=[];
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)valsA.push(2*(i+j+k));
 for(let i=0;i<5;i++)for(let j=0;j<5;j++)for(let k=0;k<5;k++)valsB.push((i+j+k)/2);
 const a=api.volumeGrid([3,3,3],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],valsA,'rho A','e/Å³');
 const b=api.volumeGrid([5,5,5],[0,0,0],[[.5,0,0],[0,.5,0],[0,0,.5]],valsB,'rho B','e/Å³');
 const diff=p1.linearVolumeCombination(a,b,-1);
 assert.equal(diff.derivation.resampled,true);
 approx(diff.values[api.gridIndex(diff,2,1,1)],4,1e-5);
 approx(diff.min,0);approx(diff.max,6);
 const doubled=p1.linearVolumeCombination(a,a,1);
 assert.equal(doubled.derivation.resampled,false);approx(doubled.max,24);
 const voltage=api.volumeGrid([5,5,5],[0,0,0],[[.5,0,0],[0,.5,0],[0,0,.5]],valsB,'V','volt');
 assert.throws(()=>p1.linearVolumeCombination(a,voltage,-1),/birim/i);
 assert.throws(()=>p1.linearVolumeCombination(a,b,Infinity));
});
test('P1 3D peak search finds interior maxima/minima, excludes boundaries and exports Å coordinates',()=>{
 const vals=Array(7**3).fill(0),index=(i,j,k)=>(i*7+j)*7+k;
 vals[index(2,2,2)]=10;vals[index(4,4,4)]=-5;vals[index(0,0,0)]=99;
 const g=api.volumeGrid([7,7,7],[10,20,30],[[.5,0,0],[0,1,0],[0,0,2]],vals,'synthetic','e/Å³');
 const peaks=p1.volumeFindPeaks(g,{mode:'max',threshold:6,limit:5});
 assert.equal(peaks.length,1);approx(peaks[0].value,10);
 approx(peaks[0].x,11);approx(peaks[0].y,22);approx(peaks[0].z,34);
 const troughs=p1.volumeFindPeaks(g,{mode:'min',threshold:4,limit:5});
 assert.equal(troughs.length,1);approx(troughs[0].value,-5);
 assert.match(p1.volumePeaksCsv(peaks,g.units),/11\.00000000,22\.00000000,34\.00000000/);
 assert.throws(()=>p1.volumeFindPeaks(g,{mode:'max',threshold:Infinity}));
});
test('P1 oblique Miller slice uses real unit-cell reciprocal normal and clips to the volume grid',()=>{
 const vals=[];for(let i=0;i<=4;i++)for(let j=0;j<=4;j++)for(let k=0;k<=4;k++)vals.push(i+j+k);
 const g=api.volumeGrid([5,5,5],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],vals,'linear','e/Å³');
 const cell={...cubic,a:4,b:4,c:4};
 const frame=p1.sliceMillerFrame(g,cell,1,1,1,50);
 assert.ok(frame.intersectionCount>=3);
 for(const corner of frame.corners)approx(corner.reduce((a,b)=>a+b,0),6,1e-6);
 const cut=api.sliceSampleMatrix(g,'hkl',50,33,{cell,hkl:[1,1,1]});
 assert.ok(cut.rows.length>400&&cut.rows.length<33**2);
 approx(cut.min,6,1e-4);approx(cut.max,6,1e-4);approx(cut.mean,6,1e-4);
 for(const row of cut.rows)approx(row.x+row.y+row.z,6,1e-4);
 const tilted={a:4,b:5,c:6,alpha:70,beta:80,gamma:75};
 const vectors=api.basis(tilted).map(v=>v.toArray().map(q=>q/4));
 const angled=api.volumeGrid([5,5,5],[0,0,0],vectors,vals,'triclinic','e/Å³');
 const tiltedFrame=p1.sliceMillerFrame(angled,tilted,1,1,0,50);
 const gstar=api.planeNormal(1,1,0,api.basis(tilted)).g;
 const values=tiltedFrame.corners.map(point=>gstar.dot(new Vector3(...point)));
 values.forEach(value=>approx(value,values[0],1e-6));
 assert.throws(()=>p1.sliceMillerFrame(angled,tilted,0,0,0,50));
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
test('point-group morphology respects tetragonal, orthorhombic, hexagonal and triclinic settings',()=>{
 const point={h:1,k:0,l:0,distance:3,color:'#4488cc',visible:true,mode:'point'};
 const tet={a:5,b:5,c:7,alpha:90,beta:90,gamma:90};
 const hkl=api.morphologyPointOrbit(1,0,0,'123').map(x=>x.join(','));
 assert.deepEqual(Array.from(hkl).sort(),['-1,0,0','0,-1,0','0,1,0','1,0,0'].sort());
 assert.equal(api.morphologyHalfspaces(tet,[point], '123').length,4);
 const prism=api.morphologyPolyhedron(api.morphologyHalfspaces(tet,[point,{...point,h:0,k:0,l:1}], '123'));
 assert.equal(prism.faces.length,6);assert.ok(prism.closed);
 const ortho={a:4,b:5,c:6,alpha:90,beta:90,gamma:90};
 assert.equal(api.morphologyPointOrbit(1,1,1,'47').length,8);
 assert.equal(api.morphologyHalfspaces(ortho,[point],'47').length,2);
 const hex={a:5,b:5,c:8,alpha:90,beta:90,gamma:120};
 assert.equal(api.morphologyPointOrbit(1,0,0,'191').length,6);
 assert.equal(api.morphologyHalfspaces(hex,[point],'191').length,6);
 const tri={a:5,b:6,c:7,alpha:75,beta:85,gamma:102};
 assert.equal(api.morphologyPointOrbit(1,0,0,'1').length,1,'P1 cannot imply a Friedel opposite face');
 assert.equal(api.morphologyPointOrbit(1,0,0,'2').length,2,'P-1 has true inversion');
 assert.equal(api.morphologyHalfspaces(tri,[point],'1').length,1);
 assert.equal(api.morphologyHalfspaces(tri,[{...point,mode:'pair'}],'1').length,2);
 assert.throws(()=>api.morphologyHalfspaces(ortho,[point],'123'),/metriğine uymuyor/);
});
test('saved morphology family modes preserve legacy models and reject unknown symmetry modes',()=>{
 const legacy=api.normalizedMorphology([{h:1,k:0,l:0,distance:2,color:'#4488cc',cubic:true}],cubic)[0];
 assert.equal(legacy.mode,'legacy');assert.equal(api.morphologyHalfspaces(cubic,[legacy]).length,6);
 const point=api.normalizedMorphology([{...legacy,mode:'point'}],cubic)[0];
 assert.equal(point.mode,'point');assert.equal(api.morphologyHalfspaces(cubic,[point],'221').length,6);
 assert.throws(()=>api.normalizedMorphology([{...legacy,mode:'imaginary'}],cubic),/simetri modu/);
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
test('P1 IT92 X-ray structure factor: BCC 100 extinction, 110 agrees with Gemmi',()=>{
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 const pair=[{symbol:'Fe',x:0,y:0,z:0},{symbol:'Fe',x:.5,y:.5,z:.5}];
 assert.ok(api.structureFactor(1,0,0,pair,cell).intensity<1e-20);
 const gemmiFe110=20.854787826538086; // Gemmi 0.7.4 IT92, stol² = 1/32 Å⁻².
 approx(api.structureFactor(1,1,0,pair,cell).intensity,4*gemmiFe110**2,2e-4);
 const f100=p1.scatteringFactor('Fe',4,'xray');
 approx(api.structureFactor(1,0,0,pair.slice(0,1),cell).intensity,f100**2,1e-7);
 approx(api.structureFactor(1,1,0,pair,cell,'point').intensity,4*26*26,1e-6);
 approx(api.structureFactor(1,1,0,pair,cell,'neutron').intensity,4*9.45**2,1e-6);
 const pattern=api.powderPattern(cell,pair,{wavelength:1.5406,maxIndex:2,maxAngle:90});
 assert.ok(pattern.groups.length>0);
 assert.ok(pattern.extinctions>0);
 assert.ok(pattern.groups[0].angle>30&&pattern.groups[0].angle<33);
 assert.match(api.xrdCsv(pattern),/2theta_deg/);
});
test('pseudo-Voigt profile uses normalized Gaussian/Lorentzian shapes and Caglioti FWHM',()=>{
 approx(api.cagliotiFwhm(90,.04,-.01,.02),Math.sqrt(.05),1e-12);
 const H=.2,dx=.002;
 let areaG=0,areaL=0;
 for(let i=-10000;i<=10000;i++){
  areaG+=api.pseudoVoigt(i*dx,H,0)*dx;
  areaL+=api.pseudoVoigt(i*dx,H,1)*dx;
 }
 approx(areaG,1,1e-5);
 assert.ok(areaL>.995&&areaL<1);
 approx(api.pseudoVoigt(H/2,H,.4),api.pseudoVoigt(0,H,.4)/2,1e-12);
 assert.throws(()=>api.cagliotiFwhm(30,-1,0,0),/pozitif/);
});
test('powder profile adds Cu Kα2 at Bragg shifted angle while conserving relative spectral weights',()=>{
 const model={maxAngle:70,wavelength:1.5406,scattering:'xray',lorentzPolarization:false,
  reflections:[{d:2,angle:360/Math.PI*Math.asin(1.5406/4),powderIntensity:10,lp:1}]};
 const one=api.powderProfile(model,{W:.01,eta:0,step:.005});
 const two=api.powderProfile(model,{W:.01,eta:0,step:.005,kalpha2:true,lambda2:1.54443,ratio:.5});
 const integrate=p=>p.intensity.reduce((acc,v)=>acc+v*p.step,0);
 approx(integrate(one),10,1e-3);approx(integrate(two),10,1e-3);
 const angle2=360/Math.PI*Math.asin(1.54443/4);
 assert.ok(angle2>model.reflections[0].angle);
 const shifted=Math.round(angle2/.005),base=Math.round(model.reflections[0].angle/.005);
 assert.ok(two.intensity[shifted]>one.intensity[shifted]);
 assert.ok(two.intensity[base]<one.intensity[base]);
 assert.match(api.powderProfileCsv(two),/^2theta_deg,simulated_intensity,simulated_relative_percent/);
 assert.throws(()=>api.powderProfile({...model,scattering:'neutron'},{kalpha2:true}),/yalnız X-ışınları/);
 assert.throws(()=>api.powderProfile(model,{W:-1}),/pozitif/);
});
test('measured 2theta/intensity CSV accepts headers and semicolon decimals, rejects malformed scans',()=>{
 const data=api.parsePowderCsv('2theta_deg,intensity\n30,40\n20,20\n40,80\n');
 assert.equal(data.rows.length,3);assert.deepEqual(Array.from(data.rows,p=>p.angle),[20,30,40]);
 approx(data.max,80);
 const semicolon=api.parsePowderCsv('Angle;Intensity\n20,5;100,3\n21,0;200,6');
 approx(semicolon.rows[0].angle,20.5);
 assert.throws(()=>api.parsePowderCsv('2theta,intensity\n20,1\n20,2'),/tekrarlanıyor/);
 assert.throws(()=>api.parsePowderCsv('20,nope\n21,100'),/en az iki/);
});
test('P1 X-ray and neutron: tabulated f0, negative H scattering and ADP attenuation',()=>{
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const atom={symbol:'Si',x:0,y:0,z:0,occupancy:.5};
 const half=api.structureFactor(1,0,0,[atom],cell).intensity;
 const gemmiSi100=12.133805274963379; // Gemmi IT92 stol² = .01 Å⁻².
 approx(half,(gemmiSi100/2)**2,2e-4);
 approx(p1.scatteringFactor('Si',5,'xray'),gemmiSi100,3e-5);
 approx(p1.scatteringFactor('H',2,'neutron'),-3.739,1e-9);
 const thermal=api.structureFactor(1,0,0,[{...atom,uIso:.05}],cell).intensity;
 assert.ok(thermal<half);
 assert.throws(()=>api.powderPattern(cell,[atom],{wavelength:0,maxIndex:2}));
 assert.throws(()=>api.structureFactor(0,0,0,[atom],cell));
 assert.throws(()=>p1.scatteringFactor('Og',2,'xray'),/IT92/);
});
test('P1 anisotropic ADP uses full triclinic reciprocal vector; Bragg-Brentano LP stays optional',()=>{
 const cell={a:4.8,b:5.2,c:6.1,alpha:72,beta:83,gamma:76},u=.035;
 const adp=vm.runInContext('adpFromCartesian([[.035,0,0],[0,.035,0],[0,0,.035]],'+JSON.stringify(cell)+')',context);
 const atom={symbol:'O',x:.12,y:.3,z:.45};
 const iso=api.structureFactor(1,2,1,[{...atom,uIso:u}],cell);
 const aniso=api.structureFactor(1,2,1,[{...atom,adp}],cell);
 approx(iso.intensity,aniso.intensity,1e-8);
 const base=api.powderPattern(cell,[atom],{scattering:'xray',maxIndex:2,maxAngle:90});
 const lp=api.powderPattern(cell,[atom],{scattering:'xray',maxIndex:2,maxAngle:90,lorentzPolarization:true});
 assert.equal(base.lorentzPolarization,false);assert.equal(lp.lorentzPolarization,true);
 approx(base.reflections[0].intensity,lp.reflections[0].intensity,1e-7);
 assert.notEqual(base.reflections[0].powderIntensity,lp.reflections[0].powderIntensity);
 const neut=api.powderPattern(cell,[atom],{scattering:'neutron',maxIndex:2,maxAngle:90,lorentzPolarization:true});
 assert.equal(neut.lorentzPolarization,true);
 assert.equal(neut.correction,'neutron-Lorentz');
 const theta=neut.reflections[0].angle*Math.PI/360;
 approx(neut.reflections[0].lp,1/(Math.sin(theta)**2*Math.cos(theta)),1e-8);
 const neutRaw=api.powderPattern(cell,[atom],{scattering:'neutron',maxAngle:90});
 assert.notEqual(neutRaw.reflections[0].powderIntensity,neut.reflections[0].powderIntensity);
});
test('P1 model Fourier density conserves F000 mean and Patterson is translation-invariant',()=>{
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 const silicon=[{symbol:'Si',x:0,y:0,z:0}];
 const density=p1.modelFourierMap(cell,silicon,{kind:'density',dMin:1.2,size:16});
 assert.equal(density.periodic,true);
 assert.ok(density.modelFourier.reflectionCount>125);
 const expectedMean=p1.scatteringFactor('Si',Infinity,'xray')/64;
 const mean=density.values.reduce((a,b)=>a+b,0)/density.values.length;
 approx(mean,expectedMean,1e-5);
 assert.ok(density.values[api.gridIndex(density,0,0,0)]>
  density.values[api.gridIndex(density,8,8,8)]);
 const pat=p1.modelFourierMap(cell,silicon,{kind:'patterson',dMin:1.2,size:16});
 const translated=p1.modelFourierMap(cell,[{symbol:'Si',x:.25,y:.25,z:.5}],
  {kind:'patterson',dMin:1.2,size:16});
 for(const ijk of [[0,0,0],[1,3,5],[7,9,11]]){
  const n=api.gridIndex(pat,...ijk),opposite=ijk.map(q=>(16-q)%16);
  approx(pat.values[n],translated.values[n],5e-5);
  approx(pat.values[n],pat.values[api.gridIndex(pat,...opposite)],5e-5);
 }
 assert.throws(()=>p1.modelFourierMap(cell,silicon,{kind:'density',size:128}));
});
test('Paket B neutron absorbers warn, while X-ray LP remains independent',()=>{
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 for(const sym of ['B','Cd','Sm','Eu','Gd']){
  const pattern=api.powderPattern(cell,[{symbol:sym,x:0,y:0,z:0}],{scattering:'neutron'});
  assert.ok(pattern.warnings.length>0);
  assert.match(pattern.warnings[0],new RegExp(sym));
 }
 assert.equal(api.powderPattern(cell,[{symbol:'Si',x:0,y:0,z:0}],{scattering:'neutron'}).warnings.length,0);
 assert.equal(api.powderPattern(cell,[{symbol:'Gd',x:0,y:0,z:0}],{scattering:'xray'}).warnings.length,0);
});
test('Paket B 64³ Fourier resolves a 10 Å cell at d_min=0.8 Å, with no Nyquist alias',()=>{
 const cell={a:10,b:10,c:10,alpha:90,beta:90,gamma:90};
 const sites=[{symbol:'Si',x:.2,y:.3,z:.4}];
 const map=p1.modelFourierMap(cell,sites,{kind:'density',dMin:.8,size:64});
 assert.equal(map.dims[0],64);
 assert.equal(map.modelFourier.dMin,.8);
 assert.ok(map.modelFourier.reflectionCount>5000);
 approx(map.values.reduce((sum,v)=>sum+v,0)/map.values.length,
  p1.scatteringFactor('Si',Infinity,'xray')/1000,1e-7);
 assert.throws(()=>p1.modelFourierMap(cell,sites,{kind:'density',dMin:.8,size:16}),/Nyquist/);
});
test('Paket B FFT matches an independent direct Fourier sum at non-origin sample sites',()=>{
 const cell={a:4,b:5,c:6,alpha:90,beta:90,gamma:90},sites=[
  {symbol:'C',x:.17,y:.38,z:.41},{symbol:'O',x:.62,y:.12,z:.76}];
 const map=p1.modelFourierMap(cell,sites,{kind:'density',dMin:2.8,size:16});
 for(const [i,j,k] of [[0,0,0],[1,3,7],[8,5,13]]){
  let direct=p1.scatteringFactor('C',Infinity)+p1.scatteringFactor('O',Infinity);
  for(let h=-2;h<=2;h++)for(let m=-2;m<=2;m++)for(let l=-3;l<=3;l++){
   if(!(h||m||l))continue;
   const d=1/Math.hypot(h/4,m/5,l/6);
   if(d+1e-9<2.8)continue;
   const F=api.structureFactor(h,m,l,sites,cell);
   const phi=2*Math.PI*(h*i+m*j+l*k)/16;
   direct+=F.real*Math.cos(phi)+F.imag*Math.sin(phi);
  }
  approx(map.values[api.gridIndex(map,i,j,k)],direct/120,1e-5);
 }
});
test('Paket B triple-field Δρ subtracts both sources in one pass with unit/frame checks',()=>{
 const A=api.volumeGrid([3,3,3],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],Array(27).fill(10),'CUBE','e/Å³');
 const B=api.volumeGrid([3,3,3],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],Array(27).fill(3),'CUBE','e/Å³');
 const C=api.volumeGrid([5,5,5],[0,0,0],[[.5,0,0],[0,.5,0],[0,0,.5]],Array(125).fill(2),'XSF','e/Å³');
 for(const g of [A,B,C])g.quantity='density';
 const diff=p1.linearVolumeCombination3(A,B,C,-1,-1);
 assert.ok(diff.values.every(v=>v===5));
 assert.deepEqual(Array.from(diff.derivation.resampled),[false,true]);
 assert.throws(()=>p1.linearVolumeCombination3(A,B,{...C,units:'V'},-1,-1),/birim/);
 assert.throws(()=>p1.linearVolumeCombination3(A,B,{...C,origin:[1,0,0]},-1,-1),/kapsama/);
 assert.throws(()=>p1.linearVolumeCombination3(A,B,C,100,-1),/Katsayı/);
});
test('P1+ Δρ integral uses periodic voxel sums and nonperiodic trapezoids',()=>{
 const periodic=api.volumeGrid([4,4,4],[0,0,0],[[.5,0,0],[0,.5,0],[0,0,.5]],Array(64).fill(.25),'rho','e/Å³');
 periodic.periodic=true;
 approx(p1.volumeIntegral(periodic).value,2,1e-9);
 const open=api.volumeGrid([3,3,3],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],Array(27).fill(.25),'rho','e/Å³');
 approx(p1.volumeIntegral(open).value,2,1e-9);
 const ramp=api.volumeGrid([3,3,3],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],
  Array.from({length:27},(_,index)=>Math.floor(index/9)),'rho','e/Å³');
 approx(p1.volumeIntegral(ramp).value,8,1e-9);
});
test('P1+ peaks return fractional and subvoxel extrema; inversion merges equivalents',()=>{
 const dims=[9,9,9],values=[];
 for(let i=0;i<9;i++)for(let j=0;j<9;j++)for(let k=0;k<9;k++)
  values.push(10-(i-3.2)**2-(j-4.3)**2-(k-5.1)**2);
 const g=api.volumeGrid(dims,[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],values,'rho','e/Å³');
 const peak=p1.volumeFindPeaks(g,{threshold:0})[0];
 approx(peak.x,3.2,1e-4);approx(peak.y,4.3,1e-4);approx(peak.z,5.1,1e-4);
 approx(peak.gridFraction[0],3.2/8,1e-5);
 assert.match(p1.volumePeaksCsv([peak],g.units),/frac_u,frac_v,frac_w/);
 const periodic=api.volumeGrid([8,8,8],[0,0,0],[[1,0,0],[0,1,0],[0,0,1]],Array(512).fill(0),'rho','e/Å³');
 periodic.periodic=true;
 periodic.values[api.gridIndex(periodic,1,1,1)]=10;
 periodic.values[api.gridIndex(periodic,7,7,7)]=9;
 const raw=p1.volumeFindPeaks(periodic,{threshold:8,refine:false});
 const merged=p1.volumeFindPeaks(periodic,{threshold:8,refine:false,mergeSymmetry:true,
  cell:{a:8,b:8,c:8,alpha:90,beta:90,gamma:90},sgSetting:'2'});
 assert.equal(raw.length,2);assert.equal(merged.length,1);
});
test('P1+ SHELX FCF requires phases and produces phase-controlled Fo−Fc FFT maps',()=>{
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const text=['data_test','loop_','_refln_index_h','_refln_index_k','_refln_index_l',
  '_refln_F_squared_meas','_refln_F_squared_calc','_refln_phase_calc',
  '1 0 0 100 64 0','0 1 0 25 16 90','-1 0 0 100 64 0'].join('\n');
 const fcf=p1.readFcf(text);
 assert.equal(fcf.reflections.length,3);assert.equal(fcf.hasPhases,true);
 const map=p1.observedFourierMap(cell,fcf,{kind:'difference',size:16,dMin:1});
 assert.equal(map.experimental.used,2);assert.equal(map.periodic,true);
 approx(map.values[api.gridIndex(map,0,0,0)],2*2/(125),1e-6);
 assert.throws(()=>p1.observedFourierMap(cell,p1.readFcf(text.replace(/_refln_phase_calc/,'_refln_unrelated')),{}),/faz bilgisi/);
 const noCalc=p1.readFcf(text.replace('_refln_F_squared_calc','_refln_other_calc'));
 assert.throws(()=>p1.observedFourierMap(cell,noCalc,{kind:'difference'}),/Fcalc/);
 assert.equal(p1.observedFourierMap(cell,noCalc,{kind:'observed',size:16,dMin:1}).experimental.used,2);
});
test('P1+ mCIF magnetic translation flips time-reversed vectors, and P1 export retains moments',()=>{
 const cif=['data_magnetic','_cell_length_a 4','_cell_length_b 4','_cell_length_c 4',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  'loop_','_atom_site_label','_atom_site_type_symbol','_atom_site_fract_x','_atom_site_fract_y',
  '_atom_site_fract_z','Fe1 Fe 0.1 0.2 0.3','loop_',
  '_atom_site_moment.label','_atom_site_moment.Cartn_x','_atom_site_moment.Cartn_y','_atom_site_moment.Cartn_z',
  'Fe1 0 0 2','loop_','_space_group_symop_magn_operation.xyz',
  "'x,y,z,+1'","'x+1/2,y,z,-1'"].join('\n');
 const result=api.cifData(cif);
 assert.equal(result.sites.length,2);approx(result.sites[1].x,.6);
 approx(result.sites[0].magneticMoment[2],2);approx(result.sites[1].magneticMoment[2],-2);
 assert.match(result.warning,/zaman tersleme/);
 const exportCif=api.cifExportText(result),again=api.cifData(exportCif);
 assert.equal(again.sites.length,2);approx(again.sites[1].magneticMoment[2],-2);
 assert.throws(()=>p1.parseMagneticOperation('x,y,z;0,+1'),/Desteklenmeyen/);
 const mirror=p1.parseMagneticOperation('x,y,-z,+1');
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 assert.deepEqual(Array.from(p1.rotateMagneticMoment([1,0,0],mirror,cell)).map(n=>Math.round(n)||0),[-1,0,0],
  'moments are axial, so an improper reflection changes in-plane components');
 assert.deepEqual(Array.from(p1.rotateMagneticMoment([0,0,2],mirror,cell)).map(n=>Math.round(n)||0),[0,0,2],
  'normal-to-mirror axial moment retains its direction');
});
test('P1 numerical periodic Voronoi integration partitions electron density and conserves charge',()=>{
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 const g=api.volumeGrid([8,8,8],[0,0,0],[[.5,0,0],[0,.5,0],[0,0,.5]],
  Array(8**3).fill(2),'density','e/Å³');g.periodic=true;
 const sites=[{symbol:'Na',x:0,y:0,z:0},{symbol:'Cl',x:.5,y:.5,z:.5}];
 const result=p1.volumeVoronoiIntegration(g,cell,sites);
 approx(result.total,128,1e-5);
 approx(result.sites.reduce((s,x)=>s+x.charge,0),128,1e-5);
 assert.ok(result.sites.every(s=>Math.abs(s.charge-64)<15));
 assert.match(p1.volumeVoronoiCsv(result),/electrons/);
 const coarse=p1.volumeVoronoiIntegration(g,cell,sites,100);
 approx(coarse.total,128,1e-5);assert.ok(coarse.sampled<=100);
 const nonperiodic={...g,periodic:false};
 assert.throws(()=>p1.volumeVoronoiIntegration(nonperiodic,cell,sites));
 assert.throws(()=>p1.volumeVoronoiIntegration({...g,units:'V'},cell,sites));
});
test('P1 PDB CRYST1, ATOM occupancy and ANISOU roundtrip preserve cell and Cartesian tensor',()=>{
 const cell={a:5.3,b:6.2,c:7.4,alpha:76,beta:83,gamma:71};
 const sites=[{symbol:'Fe',label:'Fe1',x:.1,y:.2,z:.3,occupancy:.75,uIso:.025,
  adp:[.03,.04,.05,.001,.002,.003]},
  {symbol:'O',label:'O1',x:.5,y:.6,z:.7,occupancy:1,uIso:.015}];
 const pdb=p1.pdbExportText(cell,sites);
 assert.match(pdb,/^CRYST1/);assert.match(pdb,/ANISOU/);assert.match(pdb,/HETATM/);
 const ironLine=pdb.split('\n').find(line=>line.startsWith('HETATM'));
 assert.equal(ironLine.slice(76,78),'FE','PDB element field must be uppercase for two-letter elements');
 const round=p1.pdbData(pdb);
 approx(round.cell.a,cell.a,1e-4);approx(round.cell.gamma,cell.gamma,1e-4);
 assert.equal(round.sites.length,2);assert.equal(round.sites[0].symbol,'Fe');
 approx(round.sites[0].occupancy,.75,1e-5);
 for(const axis of ['x','y','z'])approx(round.sites[0][axis],sites[0][axis],2e-4);
 assert.ok(round.sites[0].adp);
 round.sites[0].adp.forEach((v,i)=>approx(v,sites[0].adp[i],2e-4));
 const withoutCell=p1.pdbData(pdb.split('\n').filter(line=>!line.startsWith('CRYST1')).join('\n'));
 assert.match(withoutCell.warning,/yapay kutu/);
 assert.throws(()=>p1.pdbData('HEADER empty PDB'));
});
test('P1 Ewald reproduces NaCl Madelung lattice energy and rejects nonneutral ion models',()=>{
 const nacl=api.examples('nacl');
 const charges=p1.parseIonicCharges('Na:+1, Cl:-1',nacl.sites);
 const result=p1.madelungEwald(nacl.cell,nacl.sites,charges);
 const expected=-4*1.747564594633*14.3996454784255/(nacl.cell.a/2);
 approx(result.energy,expected,.03);
 assert.ok(result.convergenceEv<.02);
 approx(result.energy,result.potentials.reduce((s,p,i)=>s+.5*p*charges[i],0),1e-8);
 assert.throws(()=>p1.madelungEwald(nacl.cell,nacl.sites,charges.map(()=>1)),/nötr|Nötr/);
 assert.throws(()=>p1.parseIonicCharges('Na:+1',nacl.sites),/Yük tanımlanmamış/);
 assert.throws(()=>p1.madelungEwald(nacl.cell,[{...nacl.sites[0],occupancy:.5},...nacl.sites.slice(1)],charges),/Kısmi doluluk/);
});

test('Paket A powder XRD uses a reciprocal metric sphere and retains hexagonal reflection families',()=>{
 const cell={a:3,b:3,c:5,alpha:90,beta:90,gamma:120};
 const sites=[{symbol:'Si',x:0,y:0,z:0}];
 const pattern=api.powderPattern(cell,sites,{wavelength:.5,maxAngle:150});
 const family=pattern.groups.find(group=>Math.abs(group.d-1.5)<.00001);
 assert.ok(family,'hexagonal (110) family should exist');
 assert.equal(family.members,3,'three Friedel pairs must be retained');
 approx(family.intensity,3*2*api.structureFactor(1,1,0,sites,cell).intensity,1e-6);
 const large=api.powderPattern({...cell,a:10,b:10},sites,{wavelength:1.5406,maxAngle:90});
 assert.ok(large.scanBounds[0]>=9&&large.scanBounds[1]>=9);
 assert.ok(large.reflections.some(r=>Math.max(Math.abs(r.h),Math.abs(r.k))>7));
 assert.ok(!('maxIndex' in large),'fixed Miller-index cutoff is removed');
 assert.throws(()=>api.powderPattern({...cell,a:900,b:900,c:900},sites,{wavelength:.2,maxAngle:150}),/bütçe/);
});
test('Paket A signed threshold finds positive minima and negative extrema correctly',()=>{
 const data=Array(5**3).fill(.5),g=api.volumeGrid([5,5,5],[0,0,0],
  [[1,0,0],[0,1,0],[0,0,1]],data,'density','e/Å³');
 g.values[api.gridIndex(g,2,2,2)]=.01;
 assert.equal(p1.volumeFindPeaks(g,{mode:'min',threshold:.05}).length,1);
 assert.equal(p1.volumeFindPeaks(g,{mode:'max',threshold:.6}).length,0);
 const negative={...g,values:g.values.slice()};
 negative.values[api.gridIndex(g,2,2,2)]=-.2;
 assert.equal(p1.volumeFindPeaks(negative,{mode:'min',threshold:-.1}).length,1);
});
test('Paket A CUBE/XSF typed density units normalize values and block ambiguous arithmetic',()=>{
 const source=api.volumeGrid([2,2,2],[0,0,0],[[.5,0,0],[0,.5,0],[0,0,.5]],
  Array(8).fill(1),'CUBE','dosya ölçeği');
 const unknown=api.interpretVolumeUnits(source,'unknown');
 assert.equal(unknown.quantity,'unknown');
 assert.throws(()=>p1.linearVolumeCombination(unknown,unknown,-1),/nicelik/);
 const rho=api.interpretVolumeUnits(source,'density-bohr',{periodic:true});
 assert.equal(rho.quantity,'density');assert.equal(rho.units,'e/Å³');
 approx(rho.values[0],1/.529177210903**3,1e-6);
 const rho2=api.interpretVolumeUnits(source,'density-angstrom',{periodic:true});
 assert.equal(rho2.values[0],1);
 assert.throws(()=>p1.linearVolumeCombination(rho,
  api.interpretVolumeUnits(source,'potential-volt',{periodic:true}),-1),/nicelik/);
 const cell={a:1,b:1,c:1,alpha:90,beta:90,gamma:90};
 const total=p1.volumeVoronoiIntegration(rho,cell,[{symbol:'H',x:0,y:0,z:0}]);
 approx(total.total,1/.529177210903**3,1e-5);
 const xsf=api.volumeGrid([3,3,3],[0,0,0],[[.5,0,0],[0,.5,0],[0,0,.5]],
  Array(27).fill(2),'XSF','kaynak birim');
 const periodic=api.interpretVolumeUnits(xsf,'density-angstrom',{periodic:true});
 assert.deepEqual(Array.from(periodic.dims),[2,2,2]);assert.equal(periodic.values.length,8);
 approx(p1.volumeVoronoiIntegration(periodic,cell,[{symbol:'H',x:0,y:0,z:0}]).total,2,1e-6);
});
test('Paket A PDB aligns uppercase atom-name fallbacks and enables recognized CRYST1 symmetry',()=>{
 const cell={a:5,b:6,c:7,alpha:90,beta:90,gamma:90};
 const original=p1.pdbExportText(cell,[{symbol:'Fe',x:.2,y:.3,z:.4},{symbol:'Ca',x:.5,y:.6,z:.7}]);
 const lines=original.split('\n').map(line=>{
  if(line.startsWith('CRYST1'))return line.padEnd(80).slice(0,55)+'P 21 21 21'.padEnd(11)+line.padEnd(80).slice(66);
  if(line.startsWith('HETATM'))return line.padEnd(80).slice(0,12)+
   line.slice(12,16).toUpperCase()+line.padEnd(80).slice(16,76)+'  '+line.padEnd(80).slice(78);
  return line;
 });
 const restored=p1.pdbData(lines.join('\n'));
 assert.deepEqual(Array.from(restored.sites.map(s=>s.symbol)),['Fe','Ca']);
 assert.equal(restored.sgNumber,19);assert.equal(restored.symmetryEnabled,true);
 assert.match(restored.warning,/element sütunu boş/);
 const protein=p1.pdbData(lines.join('\n').replace(/^HETATM/m,'ATOM  ')
  .replace(/^(ATOM  .{6}).{4}/m,'$1 CA ').replace(/^(ATOM  .{11}).{3}/m,'$1ALA'));
 assert.equal(protein.sites[0].symbol,'C','CA in aligned protein ATOM record is C-alpha');
 const unrecognized=p1.pdbData(lines.join('\n').replace('P 21 21 21','X 99 99 99'));
 assert.match(unrecognized.warning,/eşlenemedi/);assert.equal(unrecognized.symmetryEnabled,false);
 assert.match(unrecognized.warning,/sonuçlarına güvenmeyin, bağımsız olarak doğrulayın/);
});
test('Paket A symmetry-expanded charges and Voronoi labels refer to asymmetric sites',()=>{
 const asymmetric=[{symbol:'Na',label:'Na1',x:.12,y:.21,z:.31},
  {symbol:'Cl',label:'Cl1',x:.38,y:.27,z:.45}];
 const expanded=api.expandSites(asymmetric,'2');
 assert.equal(expanded.length,4);
 assert.deepEqual(Array.from(expanded.map(s=>s.sourceSiteIndex)),[0,0,1,1]);
 assert.deepEqual(Array.from(p1.parseIonicCharges('1:+1,2:-1',expanded,asymmetric)),[1,1,-1,-1]);
 assert.deepEqual(Array.from(p1.parseIonicCharges('Na1:+2,Cl1:-2',expanded,asymmetric)),[2,2,-2,-2]);
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 const g=api.volumeGrid([8,8,8],[0,0,0],[[.5,0,0],[0,.5,0],[0,0,.5]],
  Array(512).fill(1),'density','e/Å³');g.periodic=true;
 const charge=p1.volumeVoronoiIntegration(g,cell,expanded);
 assert.deepEqual(Array.from(charge.sites.map(s=>s.index)),[1,1,2,2]);
 assert.deepEqual(Array.from(charge.sites.map(s=>s.expandedIndex)),[1,2,3,4]);
 assert.match(p1.volumeVoronoiCsv(charge),/^asymmetric_site,expanded_site/);
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

test('reciprocal-space page is routed, wired to the editor and deployed with its modules',()=>{
 const pages=context.pageApi;
 assert.equal(pages.pageFromHash('#kutuphane'),'library');
 assert.equal(pages.pageFromHash('#karsi-uzay'),'reciprocal');
 assert.equal(pages.pageFromHash('#kristal'),'editor');
 assert.equal(pages.pageFromHash(''),'editor');
 assert.match(html,/<a id="reciprocalNav" href="#karsi-uzay">Karşı Uzay<\/a>/);
 assert.match(html,/<main id="reciprocalPage" hidden/);
 for(const id of ['rsPaneLattice','rsPaneEwald','rsPaneZone','rsPaneBz','rsRealView','rsRecipView','rsPhasor',
  'rsEwaldSvg','rsRingsSvg','rsStickSvg','rsZoneSvg','rsBzView','rsBandSvg'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(moduleScript,/import \{ initReciprocalPage \} from '\.\/reciprocal-page\.js';/);
 // The optional page is initialised after, and isolated from, the editor bootstrap.
 const boot=moduleScript.slice(moduleScript.indexOf('// @kristalyapi/browser-bootstrap:'));
 assert.match(boot,/try\{reciprocalPage=initReciprocalPage\(reciprocalHost\(\)\);syncLibraryNavigation\(\);\}catch/);
 const page=fs.readFileSync(path.join(__dirname,'..','reciprocal-page.js'),'utf8');
 assert.match(page,/from '\.\/reciprocal-core\.js'/);
 const workflow=fs.readFileSync(path.join(__dirname,'..','.github/workflows/pages.yml'),'utf8');
 assert.match(workflow,/cp reciprocal-core\.js public\/reciprocal-core\.js/);
 assert.match(workflow,/cp reciprocal-page\.js public\/reciprocal-page\.js/);
 assert.match(workflow,/tests\/reciprocal\.test\.mjs/);
});


test('P7.6 CIF untouched source is exported byte-for-byte, including unsupported tags',()=>{
 const input=[
  'data_p76',
  '_cell_length_a 5','_cell_length_b 6','_cell_length_c 7',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  "_custom_experimental_note 'must remain verbatim'",
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Si1 Si 0.125 0.25 0.375'
 ].join('\n')+'\n';
 const structure=api.cifData(input);
 const record=api.originalCifRecord(structure,input);
 const preserved=api.cifExportPreservingSource({...structure,cifOriginal:record});
 assert.equal(preserved.original,true);
 assert.equal(preserved.text,input);
 assert.match(preserved.text,/_custom_experimental_note/);
});

test('P7.6 CIF changed structure must not silently reuse original source',()=>{
 const input=[
  'data_p76','_cell_length_a 5','_cell_length_b 6','_cell_length_c 7',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Si1 Si 0.125 0.25 0.375'
 ].join('\n')+'\n';
 const structure=api.cifData(input);
 const record=api.originalCifRecord(structure,input);
 const changed={...structure,sites:structure.sites.map((site,i)=>i?site:{...site,x:site.x+.125}),cifOriginal:record};
 const output=api.cifExportPreservingSource(changed);
 assert.equal(output.original,false);
 const parsed=api.cifData(output.text);
 approx(parsed.sites[0].x,.25,1e-6);
 assert.notEqual(output.text,input);
});

test('P7.6 CIF roundtrip retains partial occupancies and anisotropic ADP',()=>{
 const input=[
  'data_p76','_cell_length_a 6','_cell_length_b 7','_cell_length_c 8',
  '_cell_angle_alpha 76','_cell_angle_beta 84','_cell_angle_gamma 101',
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  '_atom_site_occupancy','Si1 Si .125 .25 .375 .65',
  'loop_','_atom_site_aniso_label','_atom_site_aniso_U_11',
  '_atom_site_aniso_U_22','_atom_site_aniso_U_33',
  '_atom_site_aniso_U_12','_atom_site_aniso_U_13','_atom_site_aniso_U_23',
  'Si1 .04 .03 .02 .001 -.002 .003'
 ].join('\n')+'\n';
 const first=api.cifData(input);
 const exported=api.cifExportText(first);
 const second=api.cifData(exported);
 assert.equal(second.sites.length,1);
 approx(second.sites[0].occupancy,.65,1e-6);
 for(const axis of ['x','y','z'])approx(second.sites[0][axis],first.sites[0][axis],1e-6);
 assert.ok(Array.isArray(second.sites[0].adp));
 first.sites[0].adp.forEach((value,i)=>approx(second.sites[0].adp[i],value,1e-6));
});


test('P7.7 cubic symmetry rotates anisotropic ADP Uij with analytic component signs',()=>{
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 // CIF Uij order: U11,U22,U33,U23,U13,U12.
 const u=[.045,.025,.015,.002,-.003,.004];
 const rotated=api.adpRotateBySymmetry(u,cell,'y,-x,z');
 const expected=[.025,.045,.015,.003,.002,-.004];
 expected.forEach((v,i)=>approx(rotated[i],v,1e-10));
 let full=u;
 for(let i=0;i<4;i++)full=api.adpRotateBySymmetry(full,cell,'y,-x,z');
 u.forEach((v,i)=>approx(full[i],v,1e-10));
});

test('P7.7 inversion, translation and monoclinic twofold obey tensor rules',()=>{
 const triclinic={a:6,b:7,c:8,alpha:76,beta:84,gamma:101};
 const u=[.04,.028,.02,.003,-.002,.004];
 for(const op of ['-x,-y,-z','x+1/2,y,z']){
  const next=api.adpRotateBySymmetry(u,triclinic,op);
  u.forEach((v,i)=>approx(next[i],v,1e-9));
 }
 const monoclinic={a:5,b:6,c:7,alpha:90,beta:104,gamma:90};
 const rotated=api.adpRotateBySymmetry(u,monoclinic,'-x,y,-z');
 const expected=[u[0],u[1],u[2],-u[3],u[4],-u[5]];
 expected.forEach((v,i)=>approx(rotated[i],v,1e-9));
});

test('P7.7 symmetry preserves Cartesian ADP ellipsoid spectrum in hexagonal lattice',()=>{
 const cell={a:5,b:5,c:8,alpha:90,beta:90,gamma:120};
 const u=[.04,.035,.025,.002,-.003,.004];
 const before=api.adpEigen(api.adpToCartesian(u,cell)).values.slice().sort((a,b)=>a-b);
 const site={symbol:'Si',label:'Si1',x:.173,y:.271,z:.391,occupancy:.75,adp:u};
 const expanded=api.expandSites([site],'143',16,cell);
 assert.equal(expanded.length,3);
 for(const atom of expanded){
  const after=api.adpEigen(api.adpToCartesian(atom.adp,cell)).values.slice().sort((a,b)=>a-b);
  before.forEach((v,i)=>approx(after[i],v,1e-8));
  approx(atom.occupancy,.75,1e-12);
  const e=api.adpEllipsoid(atom,cell,90);
  assert.ok(e.scales.every(n=>Number.isFinite(n)&&n>0));
 }
});

test('P7.7 accepts small CIF rounding in a hexagonal cell angle',()=>{
 const nearlyHex={a:5,b:5,c:8,alpha:90,beta:90,gamma:119.99};
 const rotated=api.adpRotateBySymmetry([.04,.035,.025,.002,-.003,.004],nearlyHex,'-y,x-y,z');
 assert.equal(rotated.length,6);
 assert.ok(rotated.every(Number.isFinite));
});

test('P7.7 rejects symmetry operations incompatible with the supplied cell',()=>{
 const orthorhombic={a:4,b:5,c:6,alpha:90,beta:90,gamma:90};
 const u=[.04,.025,.03,.002,.001,.003];
 assert.throws(()=>api.adpRotateBySymmetry(u,orthorhombic,'y,-x,z'),/metriğiyle uyumsuz/);
 assert.throws(()=>api.expandSites(
  [{symbol:'Si',x:.17,y:.23,z:.31,adp:u}], '143',16,orthorhombic),/metriğiyle uyumsuz/);
});


test('P7.7 explicit CIF P2 expansion rotates ADP and preserves partial occupancy',()=>{
 const input=[
  'data_adp_p2',
  '_cell_length_a 5','_cell_length_b 6','_cell_length_c 7',
  '_cell_angle_alpha 90','_cell_angle_beta 104','_cell_angle_gamma 90',
  '_space_group_IT_number 3',
  'loop_','_space_group_symop_operation_xyz',
  "'x,y,z'","'-x,y,-z'",
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  '_atom_site_occupancy','Si1 Si .17 .23 .31 .60',
  'loop_','_atom_site_aniso_label','_atom_site_aniso_U_11',
  '_atom_site_aniso_U_22','_atom_site_aniso_U_33',
  '_atom_site_aniso_U_23','_atom_site_aniso_U_13','_atom_site_aniso_U_12',
  'Si1 .04 .025 .03 .004 -.003 .002'
 ].join('\n')+'\n';
 const imported=api.cifData(input);
 assert.equal(imported.sites.length,2);
 const first=imported.sites.find(s=>Math.abs(s.x-.17)<1e-7);
 const second=imported.sites.find(s=>Math.abs(s.x-.83)<1e-7);
 assert.ok(first&&second);
 assert.deepEqual(Array.from(first.adp).map(v=>+v.toFixed(8)),[.04,.025,.03,.004,-.003,.002]);
 assert.deepEqual(Array.from(second.adp).map(v=>+v.toFixed(8)),[.04,.025,.03,-.004,-.003,-.002]);
 approx(first.occupancy,.6);
 approx(second.occupancy,.6);
 const before=api.adpEigen(api.adpToCartesian(first.adp,imported.cell)).values.slice().sort((a,b)=>a-b);
 const after=api.adpEigen(api.adpToCartesian(second.adp,imported.cell)).values.slice().sort((a,b)=>a-b);
 before.forEach((v,i)=>approx(after[i],v,1e-9));
});


test('P7.7 mCIF composes magnetic symmetry and centering for ADP covariance',()=>{
 const input=[
  'data_madp',
  '_cell_length_a 5','_cell_length_b 6','_cell_length_c 7',
  '_cell_angle_alpha 90','_cell_angle_beta 104','_cell_angle_gamma 90',
  'loop_','_space_group_symop_magn_operation.xyz',"'x,y,z,+1'",
  'loop_','_space_group_symop_magn_centering.xyz',"'-x,y,-z,+1'",
  'loop_','_atom_site_moment.label','_atom_site_moment.cartn_x',
  '_atom_site_moment.cartn_y','_atom_site_moment.cartn_z',
  'Si1 0 0 1',
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Si1 Si .17 .23 .31',
  'loop_','_atom_site_aniso_label','_atom_site_aniso_U_11',
  '_atom_site_aniso_U_22','_atom_site_aniso_U_33',
  '_atom_site_aniso_U_23','_atom_site_aniso_U_13','_atom_site_aniso_U_12',
  'Si1 .04 .025 .03 .004 -.003 .002'
 ].join('\n')+'\n';
 const imported=api.cifData(input);
 assert.equal(imported.sites.length,1);
 const site=imported.sites[0];
 approx(site.x,.83);
 approx(site.y,.23);
 approx(site.z,.69);
 const expected=[.04,.025,.03,-.004,-.003,-.002];
 expected.forEach((v,i)=>approx(site.adp[i],v,1e-9));
});



test('P8.1 edited CIF retains safe bibliographic loops and multiline provenance',()=>{
 const source=[
  'data_literature',
  '_cell_length_a 5','_cell_length_b 6','_cell_length_c 7',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  "_journal_name_full 'Journal of Crystal Studies'",
  '_citation_title',';','A "crystal" with O\'Brien','and a second line',';',
  "_citation_doi '10.1107/example'",
  '_refine_ls_R_factor_all 0.019',
  '_database_code_csd 000001',
  'loop_','_publ_author_name',
  "'Ada Example'","\"O'Brien\"",
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Si1 Si 0.125 0.25 0.375'
 ].join('\n')+'\n';
 const first=api.cifData(source),record=api.originalCifRecord(first,source);
 assert.equal(api.cifExportPreservingSource({...first,cifOriginal:record}).text,source);
 assert.equal(record.provenance.loops.length,1);
 const edited={...first,cifOriginal:record,sites:[{...first.sites[0],x:.5}]};
 const exported=api.cifExportPreservingSource(edited);
 assert.equal(exported.original,false);
 assert.match(exported.text,/_publ_author_name/);
 assert.match(exported.text,/_citation_title/);
 assert.match(exported.text,/A "crystal" with O'Brien/);
 assert.match(exported.text,/second line/);
 assert.match(exported.text,/_citation_doi/);
 assert.match(exported.text,/_journal_name_full/);
 assert.doesNotMatch(exported.text,/_database_code_csd/);
 assert.doesNotMatch(exported.text,/_refine_ls_R_factor_all/);
 const parsed=api.cifData(exported.text);
 approx(parsed.sites[0].x,.5);
 // Re-import, then repeat the mutation and export: the bibliography survives
 // without duplicating data names.
 const replay=api.originalCifRecord(parsed,exported.text);
 const repeated=api.cifExportText({...parsed,cifOriginal:replay,sites:[{...parsed.sites[0],y:.125}]});
 assert.equal((repeated.match(/_citation_title/g)||[]).length,1);
 assert.equal((repeated.match(/_publ_author_name/g)||[]).length,1);
 approx(api.cifData(repeated).sites[0].y,.125);
});

test('P8.1 uncertain CIF missing-value tokens are not presented as source citations',()=>{
 const source=[
  'data_unknown','_cell_length_a 4','_cell_length_b 4','_cell_length_c 4',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  '_citation_title ?',
  'loop_','_publ_author_name','?',
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Si1 Si .1 .2 .3'
 ].join('\n')+'\n';
 const parsed=api.cifData(source);
 const record=api.originalCifRecord(parsed,source);
 assert.equal(record.provenance.scalars.length,0);
 assert.equal(record.provenance.loops.length,0);
 const out=api.cifExportText({...parsed,cifOriginal:record,
  sites:[{...parsed.sites[0],x:.4}]});
 assert.doesNotMatch(out,/_citation_title|_publ_author_name/);
});

test('P8.1 source COD identifier is not falsely attributed to an edited structure',()=>{
 const source=[
  'data_cod','_cell_length_a 4','_cell_length_b 4','_cell_length_c 4',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  '_cod_database_code 12345',
  "_chemical_name_common 'silicon'",
  "_chemical_formula_sum 'Si'",
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Si1 Si .1 .2 .3'
 ].join('\n')+'\n';
 const first=api.cifData(source),record=api.originalCifRecord(first,source);
 const edited={...first,cifOriginal:record,sites:[{...first.sites[0],x:.2}]};
 assert.doesNotMatch(api.cifExportText(edited),/_cod_database_code/);
 // An old project JSON also contains the COD field, but it is not the
 // deposition identifier of a newly generated derivative CIF.
 assert.doesNotMatch(api.cifExportText(api.loadProject(JSON.stringify(first))),/_cod_database_code/);
 assert.match(api.cifExportText(edited),/_chemical_name_common/);
 const changed={...edited,sites:[{...edited.sites[0],symbol:'Ge'}]};
 const result=api.cifExportText(changed);
 assert.doesNotMatch(result,/_chemical_formula_sum|_chemical_name_common|_cod_database_code/);
 assert.equal(api.cifData(result).sites[0].symbol,'Ge');
});

test('P8.1 provenance excludes structure-dependent loops after a chemical edit',()=>{
 const source=[
  'data_metadata',
  '_cell_length_a 4','_cell_length_b 4','_cell_length_c 4',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  "_chemical_formula_sum 'Si'",
  'loop_','_publ_author_name',"'Researcher One'",
  'loop_','_geom_bond_atom_site_label_1','_geom_bond_atom_site_label_2','_geom_bond_distance',
  'Si1 Si2 2.32',
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Si1 Si 0 0 0'
 ].join('\n')+'\n';
 const first=api.cifData(source),original=api.originalCifRecord(first,source);
 const edited={...first,cifOriginal:original,sites:[{...first.sites[0],symbol:'Ge'}]};
 const output=api.cifExportText(edited);
 assert.doesNotMatch(output,/_geom_bond_distance/);
 assert.doesNotMatch(output,/_chemical_formula_sum/);
 assert.match(output,/_publ_author_name/);
 assert.equal(api.cifData(output).sites[0].symbol,'Ge');
});

test('P8.1 mirror-site ADP must obey crystallographic site-symmetry restrictions',()=>{
 const cif=(x,u12,u13)=>[
  'data_mirror','_cell_length_a 5','_cell_length_b 6','_cell_length_c 7',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  'loop_','_space_group_symop_operation_xyz',"'x,y,z'","'-x,y,z'",
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Si1 Si '+x+' .21 .32',
  'loop_','_atom_site_aniso_label',
  '_atom_site_aniso_U_11','_atom_site_aniso_U_22','_atom_site_aniso_U_33',
  '_atom_site_aniso_U_23','_atom_site_aniso_U_13','_atom_site_aniso_U_12',
  'Si1 .04 .03 .02 .002 '+u13+' '+u12
 ].join('\n')+'\n';
 const good=api.cifData(cif(0,0,0));
 assert.equal(good.sites.length,1);
 const invalid=cif(0,.015,.012);
 assert.throws(()=>api.cifData(invalid),/özel konum ADP.*site simetrisi/);
 const general=api.cifData(cif(.13,.015,.012));
 assert.equal(general.sites.length,2);
 approx(general.sites[0].adp[5],.015,1e-9);
 approx(general.sites[1].adp[5],-.015,1e-9);
});

test('P8.1 fourfold-site Uij has equal in-plane diagonals and zero mixed terms',()=>{
 const cif=(u22,u23,u13)=>[
  'data_fourfold','_cell_length_a 5','_cell_length_b 5','_cell_length_c 7',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  'loop_','_space_group_symop_operation_xyz',"'x,y,z'","'-y,x,z'",
  'loop_','_atom_site_label','_atom_site_type_symbol',
  '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z',
  'Ti1 Ti 0 0 .25',
  'loop_','_atom_site_aniso_label',
  '_atom_site_aniso_U_11','_atom_site_aniso_U_22','_atom_site_aniso_U_33',
  '_atom_site_aniso_U_23','_atom_site_aniso_U_13','_atom_site_aniso_U_12',
  'Ti1 .035 '+u22+' .02 '+u23+' '+u13+' 0'
 ].join('\n')+'\n';
 assert.equal(api.cifData(cif(.035,0,0)).sites.length,1);
 assert.throws(()=>api.cifData(cif(.017,0,0)),/özel konum ADP/);
 assert.throws(()=>api.cifData(cif(.035,.015,0)),/özel konum ADP/);
});

test('P8.1 28 pinned experimental CIFs preserve source, provenance and atom multiplicities',()=>{
 // Excludes known inconclusive real-15 (undefined positions) and real-30
 // (unterminated string in upstream source); neither is a validated pass.
 const cases=["COD_4335507.cif","Co8.cif","CoO19128.cif","Cod_2100513.cif","Cod_4115344.cif","CsI3Pb.cif","CsSnI3.cif","Cu7Te5.cif","CuCl.cif","Fe.cif","Fe3O4.cif","FePO4.cif","Graphite.cif","H6PbCI3N_mp-977013_symmetrized.cif","La2CoO4.cif","La4Fe4O12.cif","Li.cif","Li10GeP2S12.cif","Li2O.cif","Li4Fe3Mn1(PO4)4.cif","Li8Fe2NiCoO8.cif","LiFePO4.cif","MgNiF6.cif","OneLineSymmP1.cif","V2O3.cif","bcc_1927.cif","hex_1170.cif","monoc_1028.cif"];
 for(const name of cases){
  const input=fs.readFileSync(path.join(__dirname,'validation','fixtures/real',name),'utf8');
  const structure=api.cifData(input),record=api.originalCifRecord(structure,input);
  const untouched=api.cifExportPreservingSource({...structure,cifOriginal:record});
  assert.equal(untouched.original,true,'pinned original '+name);
  assert.equal(untouched.text,input,'source byte fidelity '+name);
  const edited={...structure,cifOriginal:record,
   sites:structure.sites.map((site,i)=>i?site:{...site,x:site.x+.003})};
  const output=api.cifExportPreservingSource(edited);
  assert.equal(output.original,false,'edited source may not be reused '+name);
  const parsed=api.cifData(output.text);
  assert.equal(parsed.sites.length,structure.sites.length,'multiplicity '+name);
  approx(parsed.sites[0].x-structure.sites[0].x,.003,1e-5);
  const preserved=api.originalCifRecord(parsed,output.text).provenance;
  assert.equal(JSON.stringify(preserved),JSON.stringify(record.provenance),
   'publication provenance '+name);
 }
});


test('P8.2 FCF source unit cell is checked before Fourier synthesis',()=>{
 const cell={a:5,b:6,c:7,alpha:90,beta:90,gamma:90};
 const input=[
  'data_fofc','_cell_length_a 5','_cell_length_b 6','_cell_length_c 7',
  '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
  'loop_','_refln_index_h','_refln_index_k','_refln_index_l',
  '_refln_F_squared_meas','_refln_F_squared_calc','_refln_phase_calc',
  '1 0 0 100 64 0'
 ].join('\n')+'\n';
 const f=p1.readFcf(input);
 assert.equal(f.cell.a,5);
 assert.equal(p1.observedFourierMap(cell,f,{kind:'difference',size:16,dMin:1}).experimental.sourceCell,true);
 assert.throws(()=>p1.observedFourierMap({...cell,a:5.2},f,
  {kind:'difference',size:16,dMin:1}),/hücresi.*uyuşmuyor/);
 assert.throws(()=>p1.readFcf(input.replace('_cell_angle_gamma 90','')),/hücre parametreleri eksik/);
});

test('P8.2 Friedel conjugacy, circular phase equivalence and conflicting duplicates',()=>{
 const make=(second)=>[
  'data_pairs','loop_',
  '_refln_index_h','_refln_index_k','_refln_index_l',
  '_refln_F_meas','_refln_F_calc','_refln_phase_calc',
  '1 0 0 10 8 90',second
 ].join('\n')+'\n';
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const consistent=p1.readFcf(make('-1 0 0 10 8 -270'));
 const map=p1.observedFourierMap(cell,consistent,{kind:'difference',size:16,dMin:1});
 assert.equal(map.experimental.used,1);
 assert.equal(map.experimental.duplicates,1);
 assert.throws(()=>p1.observedFourierMap(cell,p1.readFcf(make('-1 0 0 10 8 90')),
  {kind:'difference',size:16,dMin:1}),/Friedel hkl çelişkili/);
 assert.throws(()=>p1.observedFourierMap(cell,p1.readFcf(make('-1 0 0 9 8 -90')),
  {kind:'difference',size:16,dMin:1}),/Friedel hkl çelişkili/);
});

test('P8.2 Fo minus LSQ-scaled Fc and raw Fo-Fc are scientifically distinct',()=>{
 const cell={a:5,b:5,c:5,alpha:90,beta:90,gamma:90};
 const f=p1.readFcf([
  'data_scale','loop_',
  '_refln_index_h','_refln_index_k','_refln_index_l',
  '_refln_F_meas','_refln_F_calc','_refln_phase_calc',
  '1 0 0 12 6 0'
 ].join('\n')+'\n');
 const raw=p1.observedFourierMap(cell,f,{size:16,dMin:1,scaleMode:'raw'});
 const fitted=p1.observedFourierMap(cell,f,{size:16,dMin:1,scaleMode:'lsq'});
 approx(raw.experimental.fcScale,1,1e-12);
 approx(fitted.experimental.fcScale,2,1e-12);
 approx(raw.values[api.gridIndex(raw,0,0,0)],12/125,1e-6);
 for(const value of fitted.values)approx(value,0,1e-6);
 const fo=p1.observedFourierMap(cell,f,{kind:'observed',size:16,dMin:1,scaleMode:'lsq'});
 approx(fo.values[api.gridIndex(fo,0,0,0)],24/125,1e-6);
 assert.equal(fo.experimental.scaleMode,'not-applicable');
});

test('P8.2 phase-controlled Fo-Fc FFT matches independent one-pair Fourier sum',()=>{
 const cell={a:4,b:4,c:4,alpha:90,beta:90,gamma:90};
 const f=p1.readFcf([
  'data_fourier','loop_',
  '_refln_index_h','_refln_index_k','_refln_index_l',
  '_refln_F_meas','_refln_F_calc','_refln_phase_calc',
  '1 0 0 10 8 90'
 ].join('\n'));
 const g=p1.observedFourierMap(cell,f,{kind:'difference',size:16,dMin:1});
 for(const n of [0,1,2,3,4,8,12,15]){
  const expected=2*(10-8)/64*Math.cos(Math.PI/2+2*Math.PI*n/16);
  approx(g.values[api.gridIndex(g,n,0,0)],expected,1e-6);
 }
});

test('P8.2 Nyquist and d_min exclusions are explicitly counted without folding',()=>{
 const cell={a:10,b:10,c:10,alpha:90,beta:90,gamma:90};
 const f=p1.readFcf([
  'data_sampling','loop_',
  '_refln_index_h','_refln_index_k','_refln_index_l',
  '_refln_F_meas','_refln_F_calc','_refln_phase_calc',
  '1 0 0 10 8 0','8 0 0 3 2 0','12 0 0 3 2 0'
 ].join('\n'));
 const g=p1.observedFourierMap(cell,f,{kind:'difference',size:16,dMin:1});
 assert.equal(g.experimental.used,1);
 assert.equal(g.experimental.skippedResolution,1);
 assert.equal(g.experimental.skippedNyquist,1);
 assert.ok(g.experimental.gridP1Coverage>0&&g.experimental.gridP1Coverage<1);
 assert.match(g.experimental.warning,/tamlık değildir/);
});

test('P8.2 negative measured F² is traceable, while bad calculated F² is rejected',()=>{
 const source=[
  'data_negative','loop_','_refln_index_h','_refln_index_k','_refln_index_l',
  '_refln_F_squared_meas','_refln_F_squared_calc','_refln_phase_calc',
  '1 0 0 -4 25 0'
 ].join('\n');
 const f=p1.readFcf(source);
 assert.equal(f.clippedNegativeFo2,1);
 approx(f.reflections[0].fo,0);
 assert.throws(()=>p1.readFcf(source.replace('-4 25','4 -25')),/hesaplanan F² geçersiz/);
 assert.throws(()=>p1.readFcf(source+'\ndata_second\n'),/Birden çok FCF/);
 assert.throws(()=>p1.observedFourierMap({a:5,b:5,c:5,alpha:90,beta:90,gamma:90},
  p1.readFcf(source.replace('_refln_phase_calc','_unused')),{}),/faz bilgisi/);
});

test('P8.2 frontend provides scale selection and prevents maps after structure edits',()=>{
 assert.match(htmlShell,/id="fcfScaleMode"/);
 assert.match(moduleScript,/fcf.structureFingerprint=cifScientificFingerprint\(state\)/);
 assert.match(moduleScript,/fcf.structureFingerprint!==cifScientificFingerprint\(state\)/);
});

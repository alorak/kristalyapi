import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {CAMERA_RADIATION,CAMERA_DIAMETERS,cameraArcDistance,
 cameraFromPattern,cameraFilmScale,cameraReflectionLabel} from '../powder-camera-core.js';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(resolve(here,'..',path),'utf8');
const close=(actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<tol,`Expected ${actual} ≈ ${expected}`);

test('Cu Kα (111) geometry matches historic 57.3 mm Debye camera',()=>{
 const d=3.615/Math.sqrt(3),lambda=CAMERA_RADIATION.Cu.alpha;
 const twoTheta=2*Math.asin(lambda/(2*d))*180/Math.PI;
 const s=cameraArcDistance(twoTheta,57.3);
 assert.ok(twoTheta>43.3&&twoTheta<43.4);
 close(s,57.3/2*twoTheta*Math.PI/180);
 close(cameraArcDistance(twoTheta,114.6),2*s);
 close(cameraFilmScale(57.3).mmPerDegree,Math.PI*57.3/360);
});

test('structure-derived powder groups preserve general-cell hkl/d/angles, without cubic assumptions',()=>{
 const p={groups:[
  {angle:25.60,d:3.4800,hkl:[0,1,2],relative:72,members:2},
  {angle:35.18,d:2.5509,hkl:[1,0,4],relative:100,members:4}
 ]};
 const results=cameraFromPattern(p,57.3);
 assert.equal(results.length,2);
 assert.deepEqual(results.map(x=>x.hkl),[[0,1,2],[1,0,4]]);
 close(results[0].d,3.48);
 close(results[1].twoThetaDeg,35.18);
 close(results[1].positionsMm[0],-results[1].arcMm);
 close(results[1].positionsMm[1],results[1].arcMm);
 assert.equal(cameraReflectionLabel([1,0,-4]),'(1 0 -4)');
});

test('inaccessible and missing peaks do not turn into synthetic camera lines',()=>{
 const p={groups:[
  {angle:0,d:3,hkl:[0,0,0],relative:100},
  {angle:179,d:1.1,hkl:[1,1,1],relative:8},
  {angle:180,d:1,hkl:[2,2,0],relative:100},
  {angle:42,d:2,hkl:[2,0,0],relative:0}
 ]};
 const lines=cameraFromPattern(p,57.3);
 assert.deepEqual(lines.map(x=>x.hkl),[[1,1,1]]);
 assert.throws(()=>cameraFromPattern({groups:[]},90),/diameter/);
 assert.throws(()=>cameraArcDistance(180,57.3),RangeError);
});

test('camera radiations and filters are explicit, and film scale changes not Bragg angles',()=>{
 assert.deepEqual(Object.keys(CAMERA_RADIATION),['Cu','Co','Mo','Cr','Fe']);
 assert.deepEqual([...CAMERA_DIAMETERS],[57.3,114.6]);
 assert.equal(CAMERA_RADIATION.Cu.filter,'Ni');
 assert.equal(CAMERA_RADIATION.Mo.filter,'Zr');
 const original={groups:[{angle:40,d:2,hkl:[1,1,1],relative:100}]};
 const a=cameraFromPattern(original,57.3)[0],b=cameraFromPattern(original,114.6)[0];
 close(a.twoThetaDeg,b.twoThetaDeg);close(b.arcMm,2*a.arcMm);
});

test('camera is third sibling tab, routed into powder family and auto-refreshes on crystal changes',()=>{
 const html=read('index.html'),app=read('crystal-app.js'),page=read('powder-camera-page.js');
 const idx=['id="pwTabPowder"','id="pwTabReciprocal"','id="pwTabCamera"'].map(x=>html.indexOf(x));
 assert.ok(idx.every(x=>x>=0));assert.ok(idx[0]<idx[1]&&idx[1]<idx[2]);
 assert.match(html,/id="pwCameraPage" class="pw-tab-panel" role="tabpanel" aria-labelledby="pwTabCamera" hidden/);
 for(const id of ['pwCameraSource','pwCameraReflection','pwCameraDiameter','pwCameraFilter',
  'pwCameraRotation','pwCameraDiagram','pwCameraFilm','pwCameraMetrics'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(app, /if\(hash==='#toz-kirinimi\/kamera'\)return 'camera'/);
 assert.match(app, /powderFamily=page==='powder'\|\|reciprocal\|\|camera/);
 assert.match(app, /powderCameraPage\?\.setVisible\(camera\)/);
 assert.match(app, /if\(powderCameraPage\?\.visible\)powderCameraPage\.refresh\(\)/);
 assert.match(page, /host\.structure\(\)/);
 assert.match(page, /host\.powderPattern\(structure\.cell,structure\.sites/);
 assert.doesNotMatch(page,/SAMPLES\s*=|makeSample\(/);
});

test('camera is cached offline and its failure is isolated from editor bootstrap',()=>{
 const sw=read('sw.js'),app=read('crystal-app.js'),html=read('index.html');
 for(const file of ['powder-camera-core.js','powder-camera-page.js','powder-camera.css'])
  assert.ok(sw.includes("'./"+file+"'"));
 assert.match(html,/href="\.\/powder-camera\.css"/);
 assert.match(app,/import\('\.\/powder-camera-page\.js'\)\.then/);
 assert.match(app,/\.catch\(error=>\{/);
});

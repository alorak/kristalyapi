import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {TITANIUM_PEAKS,TITANIUM_WAVELENGTH} from '../powder-indexing-core.js';
import {autoIndexPowder,cubicAllowed,cubicFamilies,hexagonalFamilies,
 parseMeasuredAngles} from '../powder-auto-index-core.js';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(resolve(here,'..',path),'utf8');
const near=(a,b,eps=.01)=>assert.ok(Math.abs(a-b)<=eps,`Expected ${a} ≈ ${b} (±${eps})`);
const lambda=TITANIUM_WAVELENGTH;
function powderPositions({system,a,c=a,indices}){
 return indices.map(([h,k,l])=>{
  const q=system==='cubic'?(h*h+k*k+l*l)/(a*a):
   4*(h*h+h*k+k*k)/(3*a*a)+l*l/(c*c);
  const s=lambda*Math.sqrt(q)/2;
  assert.ok(s>0&&s<1,'synthetic reflection accessible');
  return {twoTheta:2*Math.asin(s)*180/Math.PI};
 }).sort((x,y)=>x.twoTheta-y.twoTheta);
}

test('Bravais P/I/F rules exclude only centering-forbidden cubic reflections',()=>{
 assert.equal(cubicAllowed(1,0,0,'P'),true);
 assert.equal(cubicAllowed(1,0,0,'I'),false);
 assert.equal(cubicAllowed(1,1,0,'I'),true);
 assert.equal(cubicAllowed(1,1,0,'F'),false);
 assert.equal(cubicAllowed(1,1,1,'F'),true);
 assert.equal(cubicAllowed(2,0,0,'F'),true);
 assert.throws(()=>cubicAllowed(1,1,1,'H'),RangeError);
 for(const family of cubicFamilies('I',8))
  assert.equal((family.h+family.k+family.l)%2,0);
 assert.ok(hexagonalFamilies(3,5).some(x=>x.h===1&&x.k===0&&x.l===2));
});
test('P1.2 Ti indexed from measured angles only (all hkl hidden)',()=>{
 const data=TITANIUM_PEAKS.map(x=>({twoTheta:x.twoTheta}));
 const out=autoIndexPowder({peaks:data,system:'hexagonal',wavelength:lambda});
 assert.equal(out.peakCount,7);
 assert.ok(out.candidates.length>1,'return competing cell candidates');
 const top=out.candidates[0];
 near(top.a,2.951,.015);near(top.c,4.686,.02);
 assert.equal(top.matched.length,7);
 assert.ok(top.rmse<.05);
 assert.deepEqual(top.matched.map(m=>[m.h,m.k,m.l]),
  TITANIUM_PEAKS.map(m=>[m.h,m.k,m.l]));
 assert.ok(top.unpredicted>=0);
 assert.match(out.warning,/not verified/);
});
test('P1.2 ideal hexagonal lattice indexes without hkl inputs',()=>{
 const a=3.2,c=5.1;
 const peaks=powderPositions({system:'hexagonal',a,c,indices:[
  [0,0,1],[1,0,0],[0,0,2],[1,0,1],[1,0,2],[1,1,0],[1,0,3],[2,0,0]
 ]});
 const out=autoIndexPowder({peaks,system:'hexagonal',wavelength:lambda,toleranceDeg:.15});
 near(out.candidates[0].a,a,.001);near(out.candidates[0].c,c,.001);
 assert.equal(out.candidates[0].matched.length,peaks.length);
});
test('P1.1 ideal FCC diffraction ranks F centering at correct a',()=>{
 const a=5.431;
 const peaks=powderPositions({system:'cubic',a,indices:[
  [1,1,1],[2,0,0],[2,2,0],[3,1,1],[2,2,2],[4,0,0]
 ]});
 const out=autoIndexPowder({system:'cubic',peaks,wavelength:lambda});
 assert.equal(out.candidates[0].centering,'F');
 near(out.candidates[0].a,a,.001);
 assert.equal(out.candidates[0].matched.length,peaks.length);
 assert.ok(out.candidates.some(c=>c.centering==='P'),
  'competing primitive models are kept, not silently discarded');
});
test('P1.1 ideal BCC dataset includes exact I indexing; can constrain centering',()=>{
 const a=2.866;
 const peaks=powderPositions({system:'cubic',a,indices:[
  [1,1,0],[2,0,0],[2,1,1],[2,2,0],[3,1,0],[2,2,2]
 ]});
 const out=autoIndexPowder({system:'cubic',centering:'I',peaks,wavelength:lambda});
 assert.ok(out.candidates.length);
 near(out.candidates[0].a,a,.001);
 assert.equal(out.candidates[0].centering,'I');
 assert.equal(out.candidates[0].matched.length,peaks.length);
});
test('search supports missing peak and visibly reports unexplained reflections',()=>{
 const data=powderPositions({system:'cubic',a:5.431,indices:[
  [1,1,1],[2,0,0],[2,2,0],[3,1,1],[2,2,2],[4,0,0]
 ]});
 data.splice(2,1);
 const out=autoIndexPowder({system:'cubic',centering:'F',peaks:data,wavelength:lambda});
 assert.ok(out.candidates.length);
 near(out.candidates[0].a,5.431,.02);
 assert.equal(out.candidates[0].matched.length,data.length);
 assert.ok(out.candidates[0].unpredicted>=1,'missing predicted line is reported');
});
test('2theta-only CSV paste accepts named header and decimal-comma single column',()=>{
 assert.deepEqual(parseMeasuredAngles('2theta,intensity\n35.10,12\n38.39,5\n40.17,9\n53.00,22\n62.94,10').map(p=>p.twoTheta),
  [35.1,38.39,40.17,53,62.94]);
 assert.deepEqual(parseMeasuredAngles('35,10\n38,39\n40,17\n53,00\n62,94').map(p=>p.twoTheta),
  [35.1,38.39,40.17,53,62.94]);
 assert.throws(()=>parseMeasuredAngles('2theta\n35.10'),/5–40/);
});
test('search rejects invalid, duplicate, excessive data and bounds',()=>{
 const peaks=TITANIUM_PEAKS.map(x=>({twoTheta:x.twoTheta}));
 assert.throws(()=>autoIndexPowder({peaks:peaks.slice(0,3)}),/5–40/);
 assert.throws(()=>autoIndexPowder({peaks:[...peaks,{twoTheta:peaks[0].twoTheta}]}),/Repeated/);
 assert.throws(()=>autoIndexPowder({peaks,system:'orthorhombic'}),/system/);
 assert.throws(()=>autoIndexPowder({peaks,toleranceDeg:3}),/Tolerance/);
 assert.throws(()=>autoIndexPowder({peaks,aMin:0,aMax:10}),/range/);
 assert.throws(()=>autoIndexPowder({peaks,wavelength:-1}),/wavelength/);
 assert.throws(()=>autoIndexPowder({peaks,limit:100}),/limit/);
});
test('automatic panel loads without replacing manual index table, with offline assets',()=>{
 const html=read('index.html'),page=read('powder-indexing-page.js');
 const sw=read('sw.js'),pages=read('.github/workflows/pages.yml');
 for(const id of ['piModeManual','piModeAuto','piAutoPanel','piAutoRun','piAutoStatus',
  'piAutoResults','piAutoTolerance','piAutoAngles','piAutoCenter','piAutoAmin','piAutoAmax',
  'piAutoCmin','piAutoCmax','piAutoLoadAngles','piRows','piExport'])
  assert.ok(html.includes('id="'+id+'"'),'missing '+id);
 assert.match(page,/autoIndexPowder\(/);
 assert.match(page,/parseMeasuredAngles\(/);
 assert.match(page,/candidate\.matched\.length===lastAuto\.peakCount/);
 for(const asset of ['powder-auto-index-core.js']){
  assert.ok(sw.includes("'./"+asset+"'"));
  assert.ok(pages.includes('cp '+asset+' public/'+asset));
  assert.ok(pages.includes('test -s public/'+asset));
 }
});

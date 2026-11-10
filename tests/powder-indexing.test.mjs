import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {TITANIUM_PEAKS,TITANIUM_WAVELENGTH,observedPeak,
 fitPowderPeaks,parsePeakCsv,peakCsv} from '../powder-indexing-core.js';
const near=(x,y,tol)=>assert.ok(Math.abs(x-y)<tol,`${x} differs from ${y} by more than ${tol}`);
const read=path=>readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'..',path),'utf8');

test('Ti hexagonal reference reproduces a, c and c/a within measured peak precision',()=>{
 const r=fitPowderPeaks({system:'hexagonal',wavelength:TITANIUM_WAVELENGTH,peaks:TITANIUM_PEAKS});
 near(r.a,2.951,.018);near(r.c,4.686,.025);near(r.cOverA,1.588,.014);
 assert.equal(r.rows.length,7);
 assert.ok(r.rmseTwoTheta<.15);
 assert.ok(r.rows.every(p=>p.dObserved>0&&p.sinSquared>0));
});
test('ideal cubic reflections recover a from Bragg positions',()=>{
 const lattice=5.431,lambda=1.540562;
 const peaks=[[1,1,1],[2,2,0],[3,1,1],[4,0,0]].map(([h,k,l])=>({
  h,k,l,twoTheta:2*Math.asin(lambda*Math.sqrt(h*h+k*k+l*l)/(2*lattice))*180/Math.PI
 }));
 const r=fitPowderPeaks({system:'cubic',wavelength:lambda,peaks});
 near(r.a,lattice,1e-10);near(r.b,lattice,1e-10);near(r.c,lattice,1e-10);
 near(r.rmseTwoTheta,0,1e-9);
});
test('Bragg d and sin squared theta use half the recorded 2theta',()=>{
 const p=observedPeak({twoTheta:60,h:1,k:1,l:0},1.540562);
 near(p.sinSquared,.25,1e-12);
 near(p.dObserved,1.540562,1e-12);
});
test('missing peaks, impossible angles, noninteger hkl, negative wavelength fail explicitly',()=>{
 assert.throws(()=>observedPeak({twoTheta:0,h:1,k:1,l:0},1.5),/2theta/);
 assert.throws(()=>observedPeak({twoTheta:33,h:0,k:0,l:0},1.5),/000/);
 assert.throws(()=>observedPeak({twoTheta:33,h:.2,k:0,l:1},1.5),/integers/);
 assert.throws(()=>fitPowderPeaks({peaks:TITANIUM_PEAKS,wavelength:0}),/Wavelength/);
 assert.throws(()=>fitPowderPeaks({peaks:TITANIUM_PEAKS,system:'tetragonal'}),/cubic and hexagonal/);
});
test('hexagonal rank-deficient reflections cannot determine both a and c',()=>{
 const peaks=[{twoTheta:30,h:1,k:0,l:0},{twoTheta:40,h:2,k:0,l:0},{twoTheta:50,h:3,k:0,l:0}];
 assert.throws(()=>fitPowderPeaks({peaks,system:'hexagonal'}),/independently constrain/);
});
test('CSV accepts exported extra calculation columns and semicolon-separated inputs',()=>{
 const r=fitPowderPeaks({peaks:TITANIUM_PEAKS,system:'hexagonal'});
 const parsed=parsePeakCsv(peakCsv(TITANIUM_PEAKS,r));
 assert.equal(parsed.length,7);near(parsed[2].twoTheta,40.17,1e-9);
 const semicolons=parsePeakCsv('2θ;h;k;l\n35,10;1;0;0\n38,39;0;0;2');
 assert.equal(semicolons.length,2);
 near(semicolons[0].twoTheta,35.10,1e-9);
 assert.throws(()=>parsePeakCsv('2theta,h,k,l\n35,hi,0,0'),/invalid numbers/);
});
test('new powder indexing tab is nested and navigable without replacing old siblings',()=>{
 const index=read('index.html'),app=read('crystal-app.js'),sw=read('sw.js');
 assert.match(index,/id="pwTabIndexing"[^>]+href="#toz-kirinimi\/pik-indisleme"/);
 assert.match(index,/id="pwIndexingPage"[^>]+role="tabpanel"/);
 assert.match(app,/page==='indexing'/);
 assert.match(sw,/\.\/powder-indexing-core\.js/);
 assert.match(sw,/\.\/powder-indexing-page\.js/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {measuredPeaks,matchPowderPeaks,matchReportCsv} from '../xrd-peak-match-core.js';
const scan=Array.from({length:1201},(_,i)=>{
 const angle=i*0.05;
 const gaussian=(p,width,amplitude)=>amplitude*Math.exp(-.5*((angle-p)/width)**2);
 return {angle,intensity:8+gaussian(20.1,.12,100)+gaussian(40,.17,60)};
});
test('extracts local maxima with baseline and distinguishes unmatched reflections',()=>{
 const found=measuredPeaks(scan);
 assert.equal(found.length,2);assert.ok(Math.abs(found[0].angle-20.1)<1e-6);
 assert.ok(Math.abs(found[1].angle-40)<1e-6);
 const groups=[{angle:20,relative:100,hkl:[1,1,1]},{angle:40.05,relative:65,hkl:[2,2,0]},{angle:55,relative:35,hkl:[3,1,1]}];
 const report=matchPowderPeaks(groups,scan,{toleranceDeg:.2});
 assert.equal(report.matches.length,2);assert.equal(report.unmatchedModel.length,1);
 assert.equal(report.unmatchedMeasured.length,0);
 assert.ok(Math.abs(report.matches[0].deltaDeg-.1)<1e-6);
 assert.match(matchReportCsv(report,{wavelengthA:1.5406,measurementName:'sample.csv'}),/sample.csv/);
 assert.match(matchReportCsv(report),/Screening only/);
});
test('nearest one-to-one matching never reuses one measured peak',()=>{
 const report=matchPowderPeaks([{angle:20,relative:100,hkl:[1,1,1]},{angle:20.2,relative:90,hkl:[2,0,0]}],
  scan,{toleranceDeg:.3});
 assert.equal(report.matches.length,1);assert.equal(report.unmatchedModel.length,1);
});
test('rejects disorder, invalid intensity/tolerance and gracefully handles flat data',()=>{
 assert.deepEqual(measuredPeaks([{angle:1,intensity:0},{angle:2,intensity:0},{angle:3,intensity:0}]),[]);
 assert.throws(()=>measuredPeaks([{angle:2,intensity:1},{angle:1,intensity:2},{angle:3,intensity:1}]));
 assert.throws(()=>measuredPeaks([{angle:0,intensity:-1},{angle:1,intensity:1},{angle:2,intensity:2}]));
 assert.throws(()=>matchPowderPeaks([],scan,{toleranceDeg:3}));
 assert.throws(()=>matchPowderPeaks([{angle:NaN,relative:20}],scan));
});

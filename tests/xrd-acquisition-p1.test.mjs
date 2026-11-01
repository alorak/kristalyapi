import test from 'node:test';
import assert from 'node:assert/strict';
import {xrdAcquisitionMetadata,xrdMetadataCompatibility,xrdScanEvidence} from '../xrd-acquisition-core.js';
const make=(overrides={})=>xrdAcquisitionMetadata({sampleId:'S1',instrument:'XRD-1',
 source:'Cu-Kalpha1+2',wavelengthA:1.5406,twoThetaUnit:'deg',kalpha2:'present',
 calibration:'standard-recorded',calibrationRef:'Si standard',...overrides});
test('metadata matching requires operator check and wavelength compatibility',()=>{
 const m=make();
 const model={scattering:'xray',wavelengthA:1.5406,modelKalpha2:true};
 assert.equal(xrdMetadataCompatibility(model,m,{operatorConfirmed:true}).compatible,true);
 assert.equal(xrdMetadataCompatibility(model,m,{operatorConfirmed:false}).compatible,false);
 const wrong=make({wavelengthA:1.5415});
 const result=xrdMetadataCompatibility(model,wrong,{operatorConfirmed:true});
 assert.equal(result.compatible,false);assert.match(result.warnings.join(' '),/wavelength/i);
 assert.equal(result.phaseIdentified,false);assert.equal(result.calibrated,false);
});
test('calibration and Kα2 are recorded, not assumed to be physically verified',()=>{
 const unknown=make({kalpha2:'unknown',calibration:'none',calibrationRef:''});
 const result=xrdMetadataCompatibility({scattering:'xray',wavelengthA:1.5406},unknown,{operatorConfirmed:true});
 assert.ok(result.warnings.some(w=>w.includes('Kα₂')));
 assert.ok(result.warnings.some(w=>w.includes('calibration')));
 assert.throws(()=>make({calibrationRef:'',calibration:'standard-recorded'}));
 assert.throws(()=>make({twoThetaUnit:'rad'}));
 assert.throws(()=>make({sampleId:''}));
 assert.throws(()=>xrdMetadataCompatibility({scattering:'neutron',wavelengthA:1.5406},unknown));
});
test('raw scan digest manifest preserves operator metadata',()=>{
 const x=xrdScanEvidence(make(),'a'.repeat(64),1024,'scan.csv');
 assert.equal(x.scanByteLength,1024);assert.equal(x.acquisition.sampleId,'S1');
 assert.match(x.verification,/unverified/);
 assert.throws(()=>xrdScanEvidence(make(),'bad',1024,'scan.csv'));
});

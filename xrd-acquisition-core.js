/* P1 operator-declared XRD acquisition metadata. No automatic calibration,
 * device certification, background fitting or wavelength inference. */
const ok=v=>typeof v==='number'&&Number.isFinite(v);
const short=(v,n)=>String(v??'').trim().slice(0,n);
export function xrdAcquisitionMetadata(input){
 if(!input||typeof input!=='object')throw Error('Missing acquisition metadata.');
 const wavelengthA=Number(input.wavelengthA);
 if(!ok(wavelengthA)||wavelengthA<.2||wavelengthA>5)throw Error('Measured wavelength must be 0.2–5 Å.');
 const sampleId=short(input.sampleId,120),instrument=short(input.instrument,160);
 if(!sampleId||!instrument)throw Error('Sample ID and instrument name are required.');
 if(!['Cu-Kalpha1','Cu-Kalpha1+2','Mo-Kalpha1','Co-Kalpha1','custom','unknown'].includes(input.source))
  throw Error('Unrecognized X-ray source designation.');
 if(!['present','stripped','unknown'].includes(input.kalpha2))
  throw Error('Kα₂ handling must be specified.');
 if(!['none','standard-recorded','unknown'].includes(input.calibration))
  throw Error('Calibration record status must be specified.');
 const calibrationRef=short(input.calibrationRef,200);
 if(input.calibration==='standard-recorded'&&!calibrationRef)
  throw Error('Calibration reference is required when a standard is declared.');
 const twoThetaUnit=input.twoThetaUnit;
 if(twoThetaUnit!=='deg')throw Error('P1 expects diffraction angles in 2θ degrees.');
 return {schema:'kristalyapi.xrd-acquisition.v1',sampleId,instrument,
  source:input.source,wavelengthA,twoThetaUnit,kalpha2:input.kalpha2,
  calibration:input.calibration,calibrationRef,
  measuredAt:short(input.measuredAt,60),notes:short(input.notes,300),
  provenance:'operator-declared;not-verified-with-instrument'};
}
export function xrdMetadataCompatibility(model,metadata,{operatorConfirmed=false}={}){
 if(metadata?.schema!=='kristalyapi.xrd-acquisition.v1')throw Error('Invalid acquisition metadata.');
 const warnings=[];
 if(model?.scattering!=='xray')throw Error('This screening supports X-ray diffraction only.');
 if(!ok(model.wavelengthA)||model.wavelengthA<=0)throw Error('Invalid model wavelength.');
 const delta=Math.abs(model.wavelengthA-metadata.wavelengthA);
 const same=delta<=0.0005;
 if(!same)warnings.push('Measured and modeled primary wavelengths differ by '+delta.toFixed(6)+' Å.');
 if(metadata.source==='unknown')warnings.push('Source spectrum is unverified.');
 if(metadata.calibration!=='standard-recorded')
  warnings.push('No explicit calibration standard record; zero-offset and displacement remain unverified.');
 if(metadata.kalpha2==='present'||metadata.kalpha2==='unknown')
  warnings.push('Kα₂ component may cause unresolved doublets; this matcher does not deconvolve them.');
 if(model.modelKalpha2!==undefined &&
   metadata.kalpha2==='stripped'&&model.modelKalpha2===true)
  warnings.push('Simulated profile includes Kα₂ while the observed scan declares it stripped.');
 if(!operatorConfirmed)warnings.push('Operator confirmation is required.');
 return {compatible:same&&operatorConfirmed,deltaWavelengthA:delta,
  warnings,calibrated:false,phaseIdentified:false};
}
export function xrdScanEvidence(metadata,sha256,byteLength,filename){
 if(metadata?.schema!=='kristalyapi.xrd-acquisition.v1'||!(/^[a-f0-9]{64}$/).test(sha256)||
  !Number.isSafeInteger(byteLength)||byteLength<0||byteLength>4_000_000)
  throw Error('Invalid scan evidence.');
 return {schema:'kristalyapi.xrd-scan-evidence.v1',acquisition:metadata,
  scanSha256:sha256,scanByteLength:byteLength,filename:short(filename,180),
  verification:'raw-scan-hash-only;operator-metadata-unverified'};
}

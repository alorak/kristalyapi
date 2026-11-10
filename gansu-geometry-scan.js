/* P0.4: finite-molecule radial scans from independent same-origin WASM SCF runs.
 * No fitted, interpolated or precomputed energies. Not a periodic DFT solver.
 */
import {parseGansuXyz,validateGansuRequest,GANSU_UPSTREAM_COMMIT} from './gansu-local-engine.js';
const HA_TO_EV=27.211386245988;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const fail=message=>{throw Error('P0.4: '+message);};
function identify(atoms){
 const count=atoms.length,types=atoms.map(a=>a.symbol);
 if(count===2&&types.every(x=>x==='H'))return {id:'H2',center:0,ends:[1],label:'H–H'};
 if(count===3&&types.filter(x=>x==='O').length===1&&types.filter(x=>x==='H').length===2)
  return {id:'H2O',center:types.indexOf('O'),ends:types.flatMap((x,i)=>x==='H'?[i]:[]),label:'O–H (simetrik)'};
 if(count===5&&types.filter(x=>x==='Si').length===1&&types.filter(x=>x==='H').length===4)
  return {id:'SiH4',center:types.indexOf('Si'),ends:types.flatMap((x,i)=>x==='H'?[i]:[]),label:'Si–H (eşölçekli)'};
 fail('Yalnız H₂, H₂O ve SiH₄ sonlu XYZ molekülleri taranır.');
}
export const SCAN_DEFAULTS=Object.freeze({
 H2:{startA:0.60,endA:1.25},H2O:{startA:0.75,endA:1.25},SiH4:{startA:1.25,endA:1.75}
});
export function geometryScanPlan(settings,{startA,endA,points=5}={}){
 if(!settings||typeof settings!=='object')fail('DFT ayarları gerekli.');
 const parsed=validateGansuRequest(settings),atoms=parsed.atoms;
 const mol=identify(atoms),center=atoms[mol.center].xyz;
 const baseDistances=mol.ends.map(i=>distance(center,atoms[i].xyz));
 const mean=baseDistances.reduce((a,b)=>a+b,0)/baseDistances.length;
 if(mean<0.40||baseDistances.some(x=>Math.abs(x-mean)>0.06))
  fail('Bağ uzunlukları eşit değil; sabit açılı simetrik tarama uygulanamaz.');
 if(!Number.isInteger(points)||points<3||points>9)fail('Nokta sayısı 3–9 olmalıdır.');
 if(!finite(startA)||!finite(endA)||startA<0.45||endA>2.50||endA<=startA||
    (endA-startA)/(points-1)<0.025)fail('Bağ aralığı 0,45–2,50 Å içinde artan ve yeterli aralıklı olmalı.');
 const samples=[];
 for(let j=0;j<points;j++){
  const bondA=startA+(endA-startA)*j/(points-1);
  const positions=atoms.map(x=>[...x.xyz]);
  for(const i of mol.ends){
   const d=baseDistances[mol.ends.indexOf(i)];
   positions[i]=center.map((v,k)=>v+(atoms[i].xyz[k]-v)*bondA/d);
  }
  const xyz=atoms.length+'\nP0.4 '+mol.id+' · bond '+bondA.toFixed(8)+' Angstrom\n'+
   atoms.map((a,i)=>a.symbol+' '+positions[i].map(x=>x.toFixed(10)).join(' ')).join('\n');
  validateGansuRequest({...settings,xyz});
  samples.push({bondA,xyz});
 }
 return {schema:'kristalyapi.gansu-geometry-plan.p04.v1',molecule:mol.id,bondLabel:mol.label,
  referenceBondA:mean,referenceXyz:settings.xyz,settings:{
   functional:parsed.functional,grid:parsed.grid,charge:parsed.charge,multiplicity:parsed.multiplicity,basis:'STO-3G'
  },samples};
}
export async function runGansuGeometryScan(plan,{engine,signal,onProgress=()=>{}}={}){
 if(plan?.schema!=='kristalyapi.gansu-geometry-plan.p04.v1'||!Array.isArray(plan.samples)||
   plan.samples.length<3||plan.samples.length>9||typeof engine!=='function')
  fail('Geçersiz tarama planı veya hesaplama motoru.');
 const rows=[];
 for(let i=0;i<plan.samples.length;i++){
  if(signal?.aborted)throw new DOMException('İşlem iptal edildi','AbortError');
  const sample=plan.samples[i];
  // A fresh independent Worker/SCF calculation is required at every distance.
  const result=await engine({...plan.settings,xyz:sample.xyz},{signal,timeoutMs:120000});
  if(signal?.aborted)throw new DOMException('İşlem iptal edildi','AbortError');
  if(result?.backend!=='WASM'||result?.upstreamCommit!==GANSU_UPSTREAM_COMMIT||
    !finite(result.energyHartree)||!Number.isInteger(result.iterations)||result.iterations<1)
   fail('SCF sonucu/WASM kökeni doğrulanamadı; eğri yayımlanmadı.');
  rows.push({bondA:sample.bondA,energyHartree:result.energyHartree,
   iterations:result.iterations,backend:'WASM'});
  onProgress({completed:rows.length,total:plan.samples.length,bondA:sample.bondA,
   energyHartree:result.energyHartree});
 }
 const minimum=rows.reduce((a,b)=>a.energyHartree<=b.energyHartree?a:b);
 return {schema:'kristalyapi.gansu-geometry-scan.p04.v1',molecule:plan.molecule,
  bondLabel:plan.bondLabel,settings:plan.settings,referenceBondA:plan.referenceBondA,
  upstreamCommit:GANSU_UPSTREAM_COMMIT,periodic:false,
  minimumSampledBondA:minimum.bondA,minimumSampledEnergyHartree:minimum.energyHartree,
  points:rows.map(x=>({...x,relativeEnergyEv:(x.energyHartree-minimum.energyHartree)*HA_TO_EV})),
  limitations:'Sampled minimum only, no geometry optimization or vibrational proof; STO-3G finite molecule, not periodic bulk DFT.'};
}

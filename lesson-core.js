/* Dependency-free teaching models. These are NOT material-specific DFT results. */
export const HBAR2_OVER_2ME_EV_A2=3.80998212;
export const KB_EV_K=8.617333262145e-5;

export function braggTwoTheta(dAngstrom,wavelengthAngstrom){
 if(!(dAngstrom>0&&wavelengthAngstrom>0))throw Error('Bragg: d ve dalga boyu pozitif olmalı.');
 const argument=wavelengthAngstrom/(2*dAngstrom);
 return argument>1?null:2*Math.asin(argument)*180/Math.PI;
}

/* Two equally weighted coherent waves scattered at successive lattice planes.
   This is a teaching illustration of geometric path difference, NOT the
   structure factor, powder-profile intensity or a dynamical XRD solver. */
export function braggInterference(dAngstrom,wavelengthAngstrom,thetaDeg){
 if(!(dAngstrom>0&&wavelengthAngstrom>0)||!Number.isFinite(thetaDeg)||thetaDeg<0||thetaDeg>=90)
  throw Error('Bragg girişimi: d, λ pozitif ve 0 ≤ θ < 90° olmalı.');
 const pathDifference=2*dAngstrom*Math.sin(thetaDeg*Math.PI/180);
 const order=pathDifference/wavelengthAngstrom;
 const phaseRadians=2*Math.PI*order;
 return {pathDifference,order,phaseRadians,relativeIntensity:Math.cos(phaseRadians/2)**2};
}

/* Two-plane-wave nearly-free-electron Hamiltonian folded into the 1D BZ.
   The second branch represents the nearest reciprocal vector at either edge.
   The model is most informative near |k|=pi/a, not a full material band solver. */
export function twoWaveBands(kReduced,periodA,massRatio,potentialEV){
 if(!Number.isFinite(kReduced)||Math.abs(kReduced)>1||!(periodA>0)||
    !(massRatio>0)||!Number.isFinite(potentialEV)||potentialEV<0)
  throw Error('Geçersiz 1B bant modeli parametreleri.');
 const edge=Math.PI/periodA;
 const primary=HBAR2_OVER_2ME_EV_A2*(edge*kReduced)**2/massRatio;
 const folded=HBAR2_OVER_2ME_EV_A2*(edge*(2-Math.abs(kReduced)))**2/massRatio;
 const middle=(primary+folded)/2;
 const split=Math.hypot((primary-folded)/2,potentialEV);
 return {lower:middle-split,upper:middle+split};
}

/* One orbital per atom, nearest-neighbour hopping -t in a finite OPEN chain.
   Exactly N eigenlevels, ordered from low to high. In the infinite PERIODIC
   limit the related Bloch dispersion is E(k) = eps0 - 2t cos(ka).
   Neither model by itself produces distinct valence/conduction bands or a gap. */
export function tightBindingChainLevels(atomCount,hoppingEV,centerEV=0){
 if(!Number.isInteger(atomCount)||atomCount<1||atomCount>128||
    !Number.isFinite(hoppingEV)||hoppingEV<0||!Number.isFinite(centerEV))
  throw Error('Atom zinciri: N = 1–128 ve sonlu |t| ≥ 0 gerekli.');
 if(atomCount===1||hoppingEV===0)return Array(atomCount).fill(centerEV);
 return Array.from({length:atomCount},(_,m)=>
  centerEV-2*hoppingEV*Math.cos(Math.PI*(m+1)/(atomCount+1)));
}
export function tightBindingBandEnergy(kReduced,hoppingEV,centerEV=0){
 if(!Number.isFinite(kReduced)||Math.abs(kReduced)>1||!Number.isFinite(hoppingEV)||
    hoppingEV<0||!Number.isFinite(centerEV))throw Error('Geçersiz Bloch bant parametresi.');
 return centerEV-2*hoppingEV*Math.cos(Math.PI*kReduced);
}

/* Two orbitals A/B per primitive cell; a minimal Rice–Mele / SSH-type 1D
   Bloch Hamiltonian. Its off-diagonal hopping is -(tIn+tOut exp(-ika));
   diagonal on-site energies are +/- delta/2 about centerEV.
   For nonnegative hoppings the direct fundamental gap lies at |ka|=pi:
   Eg = sqrt(delta^2 + 4(tIn-tOut)^2). Spin and interactions are omitted. */
export function twoOrbitalBands(kReduced,intraEV,interEV,onsiteDeltaEV=0,centerEV=0){
 if(!Number.isFinite(kReduced)||Math.abs(kReduced)>1||
    ![intraEV,interEV,onsiteDeltaEV,centerEV].every(Number.isFinite)||
    intraEV<0||interEV<0)throw Error('Geçersiz iki-orbital bant parametreleri.');
 const ka=Math.PI*kReduced;
 const re=intraEV+interEV*Math.cos(ka),im=interEV*Math.sin(ka);
 const halfSplit=Math.hypot(onsiteDeltaEV/2,re,im);
 return {valence:centerEV-halfSplit,conduction:centerEV+halfSplit};
}
export function twoOrbitalBandGap(intraEV,interEV,onsiteDeltaEV=0){
 const edge=twoOrbitalBands(1,intraEV,interEV,onsiteDeltaEV);
 return edge.conduction-edge.valence;
}

/* Squared A/B coefficients of the two normalized Bloch eigenvectors. At a
   genuine band touching the eigenvectors are not unique, so do not assign a
   misleading orbital character. These are NOT Fermi occupations. */
export function twoOrbitalWeights(kReduced,intraEV,interEV,onsiteDeltaEV=0){
 const {valence,conduction}=twoOrbitalBands(kReduced,intraEV,interEV,onsiteDeltaEV);
 const radius=(conduction-valence)/2;
 if(radius<1e-12)return {degenerate:true,valence:null,conduction:null};
 const conductionA=(1+onsiteDeltaEV/(2*radius))/2;
 return {
  degenerate:false,
  valence:{A:1-conductionA,B:conductionA},
  conduction:{A:conductionA,B:1-conductionA}
 };
}

export function fermiDirac(energyEV,fermiEV,temperatureK){
 if(![energyEV,fermiEV,temperatureK].every(Number.isFinite)||temperatureK<=0)
  throw Error('Fermi dağılımı: sonlu enerji ve pozitif sıcaklık gerekli.');
 const x=(energyEV-fermiEV)/(KB_EV_K*temperatureK);
 if(x>40)return 0;
 if(x< -40)return 1;
 return 1/(1+Math.exp(x));
}

/* Occupation of ONE ideal state at each band edge, not a carrier density.
   The electron at Ec and the vacancy at Ev are evaluated independently.
   Their probabilities only match for the symmetric mid-gap Fermi reference. */
export function edgeStateOccupancies(gapEV,fermiEV,temperatureK){
 if(![gapEV,fermiEV,temperatureK].every(Number.isFinite)||
    gapEV<0||temperatureK<=0)
  throw Error('Bant kenarı doluluğu için Eg ≥ 0 ve T > 0 gerekli.');
 const ec=gapEV/2,ev=-gapEV/2,kT=KB_EV_K*temperatureK;
 const electronX=(ec-fermiEV)/kT,holeX=(fermiEV-ev)/kT;
 const probability=x=>{
  if(x>=0){const e=Math.exp(-x);return e/(1+e);}
  const e=Math.exp(x);return 1/(1+e);
 };
 const log10Probability=x=>-(Math.max(x,0)+Math.log1p(Math.exp(-Math.abs(x))))/Math.LN10;
 return {
  conductionEdgeEV:ec,valenceEdgeEV:ev,
  electronProbability:probability(electronX),
  holeProbability:probability(holeX),
  electronLog10:log10Probability(electronX),
  holeLog10:log10Probability(holeX)
 };
}

/* P1 teaching model: ideal, non-degenerate Si-like bulk semiconductor.
 * Reference constants are illustrative near 300 K, not extracted from CIF/DFT.
 * Fully ionized donors/acceptors, thermal equilibrium, parabolic 3D bands,
 * Maxwell-Boltzmann carriers and constant Eg; no freeze-out or bandgap narrowing.
 * Stable neutrality solution avoids subtracting nearly equal large numbers. */
export function idealDopedCarriers({donorsCm3=0,acceptorsCm3=0,temperatureK=300}={}){
 if(![donorsCm3,acceptorsCm3,temperatureK].every(Number.isFinite)||
   donorsCm3<0||acceptorsCm3<0||temperatureK<250||temperatureK>450)
  throw Error('Katkılama modeli: Nd, Na ≥ 0 ve 250 ≤ T ≤ 450 K gerekli.');
 const egEV=1.12,evEV=-egEV/2,ecEV=egEV/2;
 const kT=KB_EV_K*temperatureK;
 const scale=Math.pow(temperatureK/300,1.5);
 const ncCm3=2.8e19*scale,nvCm3=1.8e19*scale;
 const intrinsicCm3=Math.sqrt(ncCm3*nvCm3)*Math.exp(-egEV/(2*kT));
 const delta=donorsCm3-acceptorsCm3;
 let electronsCm3,holesCm3;
 if(delta>=0){
  electronsCm3=(delta+Math.hypot(delta,2*intrinsicCm3))/2;
  holesCm3=intrinsicCm3*(intrinsicCm3/electronsCm3);
 }else{
  holesCm3=(-delta+Math.hypot(delta,2*intrinsicCm3))/2;
  electronsCm3=intrinsicCm3*(intrinsicCm3/holesCm3);
 }
 const fermiEV=ecEV+kT*Math.log(electronsCm3/ncCm3);
 const intrinsicFermiEV=ecEV+kT*Math.log(intrinsicCm3/ncCm3);
 const fermiShiftEV=fermiEV-intrinsicFermiEV;
 const nondegenerate=fermiEV>evEV+3*kT&&fermiEV<ecEV-3*kT;
 return {temperatureK,donorsCm3,acceptorsCm3,egEV,evEV,ecEV,
  ncCm3,nvCm3,intrinsicCm3,electronsCm3,holesCm3,
  fermiEV,intrinsicFermiEV,fermiShiftEV,
  majority:Math.abs(delta)<intrinsicCm3*1e-12?'intrinsic':delta>0?'electrons':'holes',
  nondegenerate};
}

/* P2 abrupt, one-dimensional Si-like PN homojunction in the depletion
 * approximation. x<0 is p, x>0 is n. At zero bias E points from n to p.
 * Bias changes the electrostatic barrier but this does not solve carrier
 * injection, diffusion currents or time-dependent junction formation.
 * Sources: MIT OCW 6.012 lecture 4 and 6.720J lecture 13. */
export function idealPnJunction({acceptorsCm3=1e16,donorsCm3=1e16,
 appliedBiasV=0,temperatureK=300}={}){
 if(![acceptorsCm3,donorsCm3,appliedBiasV,temperatureK].every(Number.isFinite)||
  acceptorsCm3<=0||donorsCm3<=0||temperatureK<250||temperatureK>450)
  throw Error('PN modeli: Na, Nd > 0 ve 250 ≤ T ≤ 450 K gerekli.');
 const intrinsicCm3=idealDopedCarriers({temperatureK}).intrinsicCm3;
 if(acceptorsCm3<=intrinsicCm3||donorsCm3<=intrinsicCm3)
  throw Error('PN modeli katkılı her iki bölgenin ni üstünde yoğunluk gerektirir.');
 const q=1.602176634e-19,epsilonFcm=11.7*8.8541878128e-14;
 const builtInPotentialV=KB_EV_K*temperatureK*
  Math.log(acceptorsCm3*donorsCm3/(intrinsicCm3**2));
 const barrierV=builtInPotentialV-appliedBiasV;
 if(!(barrierV>0))
  throw Error('İleri öngerilim modelin pozitif bariyer aralığını aşıyor.');
 const depletionWidthCm=Math.sqrt((2*epsilonFcm*barrierV/q)*
  (1/acceptorsCm3+1/donorsCm3));
 const pWidthCm=depletionWidthCm*donorsCm3/(acceptorsCm3+donorsCm3);
 const nWidthCm=depletionWidthCm*acceptorsCm3/(acceptorsCm3+donorsCm3);
 const peakFieldVcm=q*acceptorsCm3*pWidthCm/epsilonFcm;
 return {acceptorsCm3,donorsCm3,appliedBiasV,temperatureK,intrinsicCm3,
  builtInPotentialV,barrierV,depletionWidthCm,pWidthCm,nWidthCm,
  peakFieldVcm,permittivityFcm:epsilonFcm};
}

export function pnJunctionProfile(junction,xCm){
 if(!junction||!Number.isFinite(xCm))
  throw Error('PN profili: geçerli eklem ve x koordinatı gerekli.');
 const {pWidthCm,nWidthCm,acceptorsCm3,donorsCm3,permittivityFcm,
  peakFieldVcm,barrierV}=junction;
 const q=1.602176634e-19;
 if(xCm<=-pWidthCm)return {chargeCcm3:0,fieldVcm:0,potentialV:0};
 if(xCm>=nWidthCm)return {chargeCcm3:0,fieldVcm:0,potentialV:barrierV};
 if(xCm<0){
  const local=xCm+pWidthCm;
  return {chargeCcm3:-q*acceptorsCm3,
   fieldVcm:-q*acceptorsCm3*local/permittivityFcm,
   potentialV:q*acceptorsCm3*local*local/(2*permittivityFcm)};
 }
 const pStep=q*acceptorsCm3*pWidthCm*pWidthCm/(2*permittivityFcm);
 return {chargeCcm3:q*donorsCm3,
  fieldVcm:-peakFieldVcm+q*donorsCm3*xCm/permittivityFcm,
  potentialV:pStep+peakFieldVcm*xCm-
   q*donorsCm3*xCm*xCm/(2*permittivityFcm)};
}

/* P3 ideal diffusion diode at 300 K in a low-injection, long-base
 * approximation. p (x<0), n (x>0); current is defined positive from p
 * contact into the junction (forward bias). No resistive drop, trap-assisted
 * recombination, avalanche or surface leakage. MIT OCW 6.720J lecture 14. */
export function idealDiodeState({acceptorsCm3=1e16,donorsCm3=1e16,
 appliedBiasV=0,areaMm2=1}={}){
 if(![acceptorsCm3,donorsCm3,appliedBiasV,areaMm2].every(Number.isFinite)||
  acceptorsCm3<=0||donorsCm3<=0||areaMm2<=0)
  throw Error('İdeal diyot: Na, Nd ve alan pozitif/sonlu olmalıdır.');
 const temperatureK=300;
 const junction=idealPnJunction({acceptorsCm3,donorsCm3,appliedBiasV,temperatureK});
 const thermalVoltageV=KB_EV_K*temperatureK;
 const intrinsicCm3=junction.intrinsicCm3;
 const electronMinorityP0Cm3=intrinsicCm3**2/acceptorsCm3;
 const holeMinorityN0Cm3=intrinsicCm3**2/donorsCm3;
 // Fixed illustrative 300 K transport assumptions (not fitted to CIF data).
 const electronDiffusivityCm2s=25,holeDiffusivityCm2s=10;
 const electronDiffusionLengthCm=0.002,holeDiffusionLengthCm=0.001;
 const q=1.602176634e-19,areaCm2=areaMm2/100;
 const saturationDensityAcm2=q*(
  electronDiffusivityCm2s/electronDiffusionLengthCm*electronMinorityP0Cm3+
  holeDiffusivityCm2s/holeDiffusionLengthCm*holeMinorityN0Cm3);
 const saturationCurrentA=saturationDensityAcm2*areaCm2;
 const relativeExcess=Math.expm1(appliedBiasV/thermalVoltageV);
 const boundaryFactor=1+relativeExcess;
 const currentA=saturationCurrentA*relativeExcess;
 const injectionRatio=Math.max(
  electronMinorityP0Cm3*boundaryFactor/acceptorsCm3,
  holeMinorityN0Cm3*boundaryFactor/donorsCm3);
 return {acceptorsCm3,donorsCm3,appliedBiasV,temperatureK,areaMm2,areaCm2,
  thermalVoltageV,intrinsicCm3,junction,
  electronMinorityP0Cm3,holeMinorityN0Cm3,
  electronDiffusivityCm2s,holeDiffusivityCm2s,
  electronDiffusionLengthCm,holeDiffusionLengthCm,
  saturationDensityAcm2,saturationCurrentA,currentA,
  relativeExcess,boundaryFactor,injectionRatio,
  lowInjection:injectionRatio<0.1,
  depletionValid:junction.barrierV>3*thermalVoltageV};
}

/* Distance is measured outwards from the corresponding depletion edge,
 * rather than from the metallurgical junction. */
export function idealDiodeMinorityProfile(state,side,distanceCm){
 if(!state||!['p','n'].includes(side)||!Number.isFinite(distanceCm)||distanceCm<0)
  throw Error('Diyot profili: p/n tarafı ve pozitif sonlu uzaklık gerekli.');
 const base=side==='p'?state.electronMinorityP0Cm3:state.holeMinorityN0Cm3;
 const length=side==='p'?state.electronDiffusionLengthCm:state.holeDiffusionLengthCm;
 const excessCm3=base*state.relativeExcess*Math.exp(-distanceCm/length);
 return {equilibriumCm3:base,excessCm3,concentrationCm3:base+excessCm3};
}


/* P4 pedagogical dark-diode two-branch equivalent circuit at 300 K.
 * I(Vj)=I01(expm1(Vj/VT))+I02(expm1(Vj/(2VT)))+Vj/Rsh;
 * Va=Vj+I*Rs (passive sign convention). I01 comes from P3.
 * I02/I01 is a selectable illustrative ratio, NOT a fitted material property.
 * No avalanche, Zener, illumination, high injection or self-heating. */
export function realDiodeState({acceptorsCm3=1e16,donorsCm3=1e16,
 appliedBiasV=0,areaMm2=1,recombinationRatio=1e4,
 seriesOhms=25,shuntOhms=1e8,
 includeRecombination=true,includeSeries=true,includeShunt=true}={}){
 if(![acceptorsCm3,donorsCm3,appliedBiasV,areaMm2,recombinationRatio,
   seriesOhms,shuntOhms].every(Number.isFinite)||
  acceptorsCm3<=0||donorsCm3<=0||areaMm2<=0||recombinationRatio<0||
  seriesOhms<0||shuntOhms<=0||Math.abs(appliedBiasV)>0.55||
  typeof includeRecombination!=='boolean'||typeof includeSeries!=='boolean'||
  typeof includeShunt!=='boolean')
  throw Error('Gerçek diyot: katkı/alan pozitif, dirençler geçerli, |V| ≤ 0,55 V olmalı.');
 const baseline=idealDiodeState({acceptorsCm3,donorsCm3,areaMm2,appliedBiasV});
 const thermalVoltageV=baseline.thermalVoltageV;
 const diffusionSaturationA=baseline.saturationCurrentA;
 const recombinationSaturationA=includeRecombination?
  diffusionSaturationA*recombinationRatio:0;
 const activeSeriesOhms=includeSeries?seriesOhms:0;
 const activeShuntOhms=includeShunt?shuntOhms:Infinity;
 const branches=voltage=>{
  const diffusionCurrentA=diffusionSaturationA*Math.expm1(voltage/thermalVoltageV);
  const recombinationCurrentA=includeRecombination?
   recombinationSaturationA*Math.expm1(voltage/(2*thermalVoltageV)):0;
  const shuntCurrentA=includeShunt?voltage/shuntOhms:0;
  return {diffusionCurrentA,recombinationCurrentA,shuntCurrentA,
   currentA:diffusionCurrentA+recombinationCurrentA+shuntCurrentA};
 };
 let junctionVoltageV=appliedBiasV;
 // The junction-voltage equation is monotonic because each branch has dI/dV>0.
 // Bracketing + bisection avoids Newton divergence at high forward currents.
 if(activeSeriesOhms>0){
  let low=appliedBiasV-1,high=appliedBiasV+1;
  for(let i=0;i<84;i++){
   const mid=(low+high)/2;
   const residual=mid+activeSeriesOhms*branches(mid).currentA-appliedBiasV;
   if(residual>0)high=mid;else low=mid;
  }
  junctionVoltageV=(low+high)/2;
 }
 const currents=branches(junctionVoltageV);
 const exp1=diffusionSaturationA*Math.exp(junctionVoltageV/thermalVoltageV);
 const exp2=recombinationSaturationA*Math.exp(junctionVoltageV/(2*thermalVoltageV));
 // Branch-slope ratio, meaningful only in forward conduction when shunt is small.
 const effectiveIdeality=(exp1+exp2)>0?(exp1+exp2)/(exp1+exp2/2):1;
 const boundaryFactor=Math.exp(junctionVoltageV/thermalVoltageV);
 const injectionRatio=Math.max(
  baseline.electronMinorityP0Cm3*boundaryFactor/acceptorsCm3,
  baseline.holeMinorityN0Cm3*boundaryFactor/donorsCm3);
 return {...currents,appliedBiasV,junctionVoltageV,
  seriesVoltageV:includeSeries?currents.currentA*activeSeriesOhms:0,
  seriesOhms:activeSeriesOhms,shuntOhms:activeShuntOhms,
  recombinationRatio,areaMm2,acceptorsCm3,donorsCm3,
  includeRecombination,includeSeries,includeShunt,thermalVoltageV,
  diffusionSaturationA,recombinationSaturationA,
  idealCurrentA:baseline.currentA,
  effectiveIdeality,injectionRatio,lowInjection:injectionRatio<0.1,
  depletionValid:baseline.junction.builtInPotentialV-junctionVoltageV>3*thermalVoltageV,
  builtInPotentialV:baseline.junction.builtInPotentialV};
}

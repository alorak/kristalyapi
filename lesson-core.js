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

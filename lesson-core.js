/* Dependency-free teaching models. These are NOT material-specific DFT results. */
export const HBAR2_OVER_2ME_EV_A2=3.80998212;
export const KB_EV_K=8.617333262145e-5;

export function braggTwoTheta(dAngstrom,wavelengthAngstrom){
 if(!(dAngstrom>0&&wavelengthAngstrom>0))throw Error('Bragg: d ve dalga boyu pozitif olmalı.');
 const argument=wavelengthAngstrom/(2*dAngstrom);
 return argument>1?null:2*Math.asin(argument)*180/Math.PI;
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

export function fermiDirac(energyEV,fermiEV,temperatureK){
 if(![energyEV,fermiEV,temperatureK].every(Number.isFinite)||temperatureK<=0)
  throw Error('Fermi dağılımı: sonlu enerji ve pozitif sıcaklık gerekli.');
 const x=(energyEV-fermiEV)/(KB_EV_K*temperatureK);
 if(x>40)return 0;
 if(x< -40)return 1;
 return 1/(1+Math.exp(x));
}

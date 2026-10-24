// Educational bulk semiconductor models; not DFT, spectroscopy, or device-grade transport.
export const KB = 8.617333262145e-5; // eV/K
export const Q = 1.602176634e-19; // coulomb
export const PROFILES = Object.freeze({
 Si: {name:'Silisyum (Si)',alpha:4.73e-4,beta:636,eg0:1.17,nc300:2.8e19,nv300:1.04e19,affinity:4.05,mun:1350,mup:480,atomDensity:4.996e22},
 Ge: {name:'Germanyum (Ge)',alpha:4.774e-4,beta:235,eg0:.7437,nc300:1.04e19,nv300:6.0e18,affinity:4.0,mun:3900,mup:1900},
 GaAs: {name:'Galyum arsenit (GaAs)',alpha:5.405e-4,beta:204,eg0:1.519,nc300:4.7e17,nv300:7.0e18,affinity:4.07,mun:8500,mup:400}
});
export function materialForStructure(structure){
 if(structure?.nonPeriodic)return null;
 const symbols=new Set((structure?.sites||[]).map(site=>site.symbol));
 if(!symbols.size)return null;
 if([...symbols].every(symbol=>symbol==='Si'||symbol==='B'||symbol==='P')&&symbols.has('Si'))return 'Si';
 if(symbols.size===1&&symbols.has('Ge'))return 'Ge';
 if(symbols.size===2&&symbols.has('Ga')&&symbols.has('As'))return 'GaAs';
 return null;
}
export function bandParameters(material,T){
 const p=PROFILES[material];
 if(!p||!Number.isFinite(T)||T<=0)throw new RangeError('Desteklenmeyen malzeme veya sıcaklık');
 const eg=p.eg0-p.alpha*T*T/(T+p.beta);
 const nc=p.nc300*(T/300)**1.5,nv=p.nv300*(T/300)**1.5;
 const thermal=KB*T;
 const ni=Math.sqrt(nc*nv)*Math.exp(-eg/(2*thermal));
 const intrinsicFermi=eg/2+(thermal/2)*Math.log(nv/nc);
 return {...p,eg,nc,nv,ni,thermal,intrinsicFermi,T};
}
function safeExp(value){return Math.exp(Math.max(-700,Math.min(70,value)));}
export function fermiProbability(energy,ef,T){
 return 1/(1+safeExp((energy-ef)/(KB*T)));
}
export function carrierEquilibrium(material,T,nd=0,na=0){
 const p=bandParameters(material,T);
 if(!(nd>=0&&na>=0&&Number.isFinite(nd)&&Number.isFinite(na)))throw new RangeError('Katkılama negatif olamaz');
 // Si-only shallow dopant energies; donor and acceptor degeneracies 2 and 4.
 if((nd||na)&&material!=='Si')throw new RangeError('Katkılama parametreleri yalnız Si:P / Si:B için kalibre edildi');
 const ed=p.eg-.0456,ea=.045;
 const evaluate=ef=>{
  const n=p.nc*safeExp((ef-p.eg)/p.thermal),holes=p.nv*safeExp(-ef/p.thermal);
  const positiveDonors=nd/(1+2*safeExp((ef-ed)/p.thermal));
  const negativeAcceptors=na/(1+4*safeExp((ea-ef)/p.thermal));
  return {n,holes,positiveDonors,negativeAcceptors,neutrality:n+negativeAcceptors-holes-positiveDonors};
 };
 let low=-1.5,high=p.eg+1.5;
 for(let i=0;i<120;i++){const mid=(low+high)/2;if(evaluate(mid).neutrality>0)high=mid;else low=mid;}
 const ef=(low+high)/2;
 return {...p,...evaluate(ef),ef,ed,ea,nd,na,approximation:'Non-degenerate thermal equilibrium; incomplete ionization (Si only)'};
}
export function lowFieldHall(carriers,mun,mup,currentA,fieldTesla,thicknessM){
 const {n,holes}=carriers;
 if(!(thicknessM>0&&Number.isFinite(currentA)&&Number.isFinite(fieldTesla)))throw new RangeError('Geçersiz deney boyutu');
 const denominator=n*mun+holes*mup;
 if(!(denominator>0))return {coefficientM3C:0,voltageV:0};
 const coefficientCm3C=(holes*mup*mup-n*mun*mun)/(Q*denominator*denominator);
 const coefficientM3C=coefficientCm3C*1e-6;
 return {coefficientM3C,voltageV:coefficientM3C*currentA*fieldTesla/thicknessM};
}
// Triclinic unit cell metric: fractional vector -> cartesian (angstrom).
export function fractionalCartesian(f,cell){
 const rad=Math.PI/180;
 const a=Number(cell.a),b=Number(cell.b),c=Number(cell.c);
 const ca=Math.cos(Number(cell.alpha)*rad),cb=Math.cos(Number(cell.beta)*rad),cg=Math.cos(Number(cell.gamma)*rad);
 const sg=Math.sin(Number(cell.gamma)*rad);
 if(!(a>0&&b>0&&c>0&&Math.abs(sg)>1e-8))throw new RangeError('Geçersiz birim hücre');
 const basisA=[a,0,0],basisB=[b*cg,b*sg,0];
 const cx=c*cb,cy=c*(ca-cb*cg)/sg,cz2=c*c-cx*cx-cy*cy;
 const basisC=[cx,cy,Math.sqrt(Math.max(0,cz2))];
 return [0,1,2].map(i=>f[0]*basisA[i]+f[1]*basisB[i]+f[2]*basisC[i]);
}
export function nearestNeighbors(structure,siteIndex,count=8){
 const sites=structure?.sites||[],origin=sites[siteIndex];
 if(!origin)return [];
 const distances=[],seen=new Set();
 for(let j=0;j<sites.length;j++){
  const item=sites[j];
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   if(structure.nonPeriodic&&(x||y||z))continue;
   if(j===siteIndex&&!x&&!y&&!z)continue;
   const vec=fractionalCartesian([Number(item.x)-Number(origin.x)+x,Number(item.y)-Number(origin.y)+y,Number(item.z)-Number(origin.z)+z],structure.cell);
   const distance=Math.hypot(...vec);
   if(distance<1e-6)continue;
   const key=vec.map(v=>v.toFixed(5)).join(',');
   if(seen.has(key))continue;
   seen.add(key);
   distances.push({siteIndex:j,label:item.label||item.symbol,symbol:item.symbol,distance,vector:vec});
  }
 }
 distances.sort((a,b)=>a.distance-b.distance);
 return distances.slice(0,count);
}
export function angleDegrees(a,b){
 const d=Math.hypot(...a)*Math.hypot(...b);
 return d>0?Math.acos(Math.max(-1,Math.min(1,a.reduce((s,x,i)=>s+x*b[i],0)/d)))*180/Math.PI:NaN;
}

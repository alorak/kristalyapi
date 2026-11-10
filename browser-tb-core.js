// Browser-only, nearest-neighbour p_z tight-binding model for primitive graphene.
// NOT DFT. Parameterised one-orbital Hamiltonian; no pseudopotentials or SCF.
const TWO_PI = 2*Math.PI;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const norm=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function vector(value,label){
 if(!Array.isArray(value)||value.length!==3||!value.every(x=>Number.isFinite(x)))throw Error(label+' üç sonlu sayısal bileşen içermeli.');
 return value;
}
export const GRAPHENE_DEMO={
 cell:[[2.46,0,0],[1.23,2.46*Math.sqrt(3)/2,0],[0,0,20]],
 atoms:[{element:'C',fractional:[0,0,0.5]},{element:'C',fractional:[1/3,1/3,0.5]}]
};
export function grapheneGeometry(structure){
 const cell=structure?.cell,atoms=structure?.atoms;
 if(!Array.isArray(cell)||cell.length!==3||!Array.isArray(atoms)||atoms.length!==2||
    atoms.some(a=>a.element!=='C'))throw Error('Bu model yalnız iki karbonlu grafen ilkel hücresini destekler; başka kristallere uygulanamaz.');
 const [a,b,c]=cell.map((v,i)=>vector(v,'Hücre vektörü '+(i+1)));
 const [fa,fb]=atoms.map((atom,i)=>vector(atom.fractional,'Kesirli koordinat '+(i+1)));
 const la=norm(a),lb=norm(b),cosAngle=dot(a,b)/(la*lb);
 if(!(la>=2.25&&la<=2.7&&lb>=2.25&&lb<=2.7&&Math.abs(la-lb)<0.08&&
   (Math.abs(cosAngle-0.5)<0.08||Math.abs(cosAngle+0.5)<0.08)))
  throw Error('Yalnız yaklaşık 2.46 Å kenarlı ve 60°/120° açılı grafen ilkel hücresi desteklenir.');
 const normal=cross(a,b),area=norm(normal);
 if(area<1)throw Error('Grafen örgü vektörleri doğrusal olamaz.');
 const raw=sub(fb,fa);
 const candidates=[];
 for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
  const f=[raw[0]+i,raw[1]+j,raw[2]];
  const d=a.map((v,n)=>v*f[0]+b[n]*f[1]+c[n]*f[2]);
  candidates.push({fractional:f,distance:norm(d),outOfPlane:Math.abs(dot(d,normal))/area,shift:[i,j]});
 }
 candidates.sort((x,y)=>x.distance-y.distance);
 const nearest=candidates.slice(0,3),r=nearest.reduce((s,x)=>s+x.distance,0)/3;
 if(!(r>1.30&&r<1.55)||nearest.some(x=>Math.abs(x.distance-r)>0.07||x.outOfPlane>0.1)||
    candidates[3].distance<r*1.30)
  throw Error('Hücrede grafenin üç eşdeğer en yakın komşu bağı bulunamadı; grafen dışı yapı hesaplanmadı.');
 const g11=dot(a,a),g22=dot(b,b),g12=dot(a,b),det=g11*g22-g12*g12;
 if(det<=0)throw Error('Geçersiz 2B ters örgü metriği.');
 return {cell:cell.map(v=>[...v]),atoms:atoms.map(x=>({element:x.element,fractional:[...x.fractional]})),
  bonds:nearest.map(x=>x.fractional.slice(0,2)),bondLength:r,
  reciprocalMetric:[g22/det,-g12/det,g11/det],source:'graphene-pz-nearest-neighbour'};
}
export function grapheneEigenvalues(geometry,k,t=2.7){
 if(!Array.isArray(k)||k.length!==2||!k.every(Number.isFinite)||!Number.isFinite(t)||t<=0||t>8)
  throw Error('k sonlu iki bileşenli, t ise 0–8 eV aralığında pozitif olmalı.');
 let re=0,im=0;
 for(const [x,y] of geometry.bonds){const phase=TWO_PI*(k[0]*x+k[1]*y);re+=Math.cos(phase);im+=Math.sin(phase);}
 const h=t*Math.hypot(re,im);
 return [-h,h];
}
function reciprocalDistance(g,k1,k2){
 const u=k1[0]-k2[0],v=k1[1]-k2[1],[g11,g12,g22]=g.reciprocalMetric;
 return TWO_PI*Math.sqrt(Math.max(0,g11*u*u+2*g12*u*v+g22*v*v));
}
export function grapheneBands(geometry,{hopping=2.7,steps=50}={}){
 if(!Number.isInteger(steps)||steps<8||steps>400)throw Error('Yol adımı 8–400 olmalı.');
 // Select the actual Dirac corner from the input cell's reciprocal convention.
 const corners=[[1/3,1/3],[1/3,2/3],[2/3,1/3],[2/3,2/3]];
 const K=corners.reduce((best,k)=>Math.abs(grapheneEigenvalues(geometry,k,hopping)[1])<
    Math.abs(grapheneEigenvalues(geometry,best,hopping)[1])?k:best,corners[0]);
 const nodes=[{label:'Γ',k:[0,0]},{label:'M',k:[0.5,0.5]},{label:'K',k:K},{label:'Γ',k:[0,0]}];
 let distance=0;const points=[{distance:0,k:[0,0],energies:grapheneEigenvalues(geometry,[0,0],hopping)}],marks=[{label:'Γ',distance:0}];
 for(let i=1;i<nodes.length;i++){
  let prev=nodes[i-1].k;
  for(let j=1;j<=steps;j++){
   const u=j/steps,k=prev.map((v,m)=>v*(1-u)+nodes[i].k[m]*u);
   const before=j===1?prev:points[points.length-1].k;
   distance+=reciprocalDistance(geometry,before,k);
   points.push({distance,k,energies:grapheneEigenvalues(geometry,k,hopping)});
  }
  marks.push({label:nodes[i].label,distance});
 }
 return {points,marks,diracK:K,diracGap:2*grapheneEigenvalues(geometry,K,hopping)[1],hopping,
  model:'Nearest-neighbour graphene π tight-binding (not DFT)'};
}
export function grapheneDos(geometry,{hopping=2.7,mesh=40,sigma=0.15,bins=181}={}){
 if(!Number.isInteger(mesh)||mesh<8||mesh>100||!Number.isInteger(bins)||bins<60||bins>500||
  !Number.isFinite(sigma)||sigma<0.025||sigma>1)throw Error('DOS ağ/gauss parametreleri izin verilen aralık dışında.');
 if(!Number.isFinite(hopping)||hopping<=0||hopping>8)throw Error('Pozitif ve sonlu hopping gerekli.');
 const span=3*hopping+5*sigma,step=2*span/(bins-1),values=new Float64Array(bins);
 const inv=1/(Math.sqrt(2*Math.PI)*sigma*mesh*mesh),den=1/(2*sigma*sigma);
 for(let i=0;i<mesh;i++)for(let j=0;j<mesh;j++){
  const energies=grapheneEigenvalues(geometry,[(i+0.5)/mesh,(j+0.5)/mesh],hopping);
  for(let n=0;n<bins;n++){
   const e=-span+n*step;
   for(const eigen of energies){const delta=e-eigen; if(Math.abs(delta)<6*sigma)values[n]+=inv*Math.exp(-delta*delta*den);}
  }
 }
 return {points:Array.from(values,(density,n)=>({energy:-span+n*step,density})),mesh,sigma,
   units:'states/(eV · primitive cell · spin)',model:'Gaussian-broadened graphene π tight-binding DOS, two bands'};
}

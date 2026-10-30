/* Structure-aware helpers for the bounded 2D electronic QE workflow.
 * They inspect geometry and server preflight results; they never run DFT. */

// The server accepts kz=0 band paths and kz=1 meshes, which only describe
// layers separated by vacuum along c.
export const MIN_SLAB_VACUUM_ANGSTROM=8;

const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
const dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
const norm=u=>Math.sqrt(dot(u,u));

function checkedCell(cell){
 if(!Array.isArray(cell)||cell.length!==3||cell.some(v=>!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x))))
  throw Error('Hücre vektörleri 3 × 3 sayısal olmalı.');
 const area=norm(cross(cell[0],cell[1]));
 if(area<=1e-9)throw Error('a ve b vektörleri bir düzlem tanımlamıyor.');
 return area;
}

/** Largest periodic empty gap along c, measured normal to the ab plane. */
export function slabAnalysis(cell,atoms){
 const area=checkedCell(cell);
 if(!Array.isArray(atoms)||!atoms.length)throw Error('Atom listesi boş.');
 const height=Math.abs(dot(cross(cell[0],cell[1]),cell[2]))/area;
 const z=atoms.map(a=>{const f=Number(a.fractional?.[2]);if(!Number.isFinite(f))throw Error('Geçersiz kesirli koordinat.');return f-Math.floor(f);}).sort((x,y)=>x-y);
 let gap=1-(z.at(-1)-z[0]);
 for(let i=1;i<z.length;i++)gap=Math.max(gap,z[i]-z[i-1]);
 const vacuum=gap*height;
 return {vacuumAngstrom:vacuum,heightAngstrom:height,isSlab:vacuum>=MIN_SLAB_VACUUM_ANGSTROM};
}

const near=(a,b,tol)=>Math.abs(a-b)<=tol;

/** 2D Bravais class of the ab plane and its conventional high-symmetry path. */
export function suggestBandPath(cell,{points=60}={}){
 checkedCell(cell);
 const [a,b]=[norm(cell[0]),norm(cell[1])];
 const gamma=Math.acos(Math.max(-1,Math.min(1,dot(cell[0],cell[1])/(a*b))))*180/Math.PI;
 const equal=near(a,b,1e-3*Math.max(a,b)),right=near(gamma,90,0.5);
 let lattice,nodes;
 // Fractional coordinates of the reciprocal basis, as used by K_POINTS crystal_b.
 if(equal&&near(gamma,120,0.5)){lattice='hexagonal';nodes=[['Gamma',0,0],['M',.5,0],['K',1/3,1/3],['Gamma',0,0]];}
 else if(equal&&near(gamma,60,0.5)){lattice='hexagonal';nodes=[['Gamma',0,0],['M',.5,0],['K',2/3,1/3],['Gamma',0,0]];}
 else if(equal&&right){lattice='square';nodes=[['Gamma',0,0],['X',.5,0],['M',.5,.5],['Gamma',0,0]];}
 else if(right){lattice='rectangular';nodes=[['Gamma',0,0],['X',.5,0],['S',.5,.5],['Y',0,.5],['Gamma',0,0]];}
 else return {lattice:'oblique',path:null};
 // Reciprocal in-plane basis (2π omitted) spaces samples by true k distance.
 const n=cross(cell[0],cell[1]),volume=dot(n,n);
 const b1=cross(cell[1],n).map(x=>x/volume),b2=cross(n,cell[0]).map(x=>x/volume);
 const k=([,u,v])=>[0,1,2].map(i=>u*b1[i]+v*b2[i]);
 const lengths=nodes.slice(1).map((node,i)=>norm(k(node).map((x,j)=>x-k(nodes[i])[j])));
 const total=lengths.reduce((s,x)=>s+x,0);
 const segments=lengths.map(len=>Math.max(4,Math.round(points*len/total)));
 const text=nodes.map(([label,u,v],i)=>[label,+u.toFixed(12),+v.toFixed(12),0,i<segments.length?segments[i]:1].join(' ')).join('\n');
 return {lattice,path:text};
}

/** Necessary band count from server UPF valence plus a few empty bands. */
export function bandCapacityAdvice({electrons,minimum},maxBands=128){
 if(!Number.isInteger(electrons)||!Number.isInteger(minimum)||minimum<1)throw Error('Bant kapasitesi bilgisi geçersiz.');
 // Mirrors pw.x's default for smeared systems: 20% or at least four extra bands.
 const suggested=Math.min(maxBands,Math.max(minimum+4,Math.ceil(1.2*minimum)));
 return {electrons,minimum,suggested,fits:suggested>=minimum};
}

/** Server preflight success payload or its insufficient-band error message. */
export function bandCapacityFrom(source){
 if(source&&typeof source==='object'){
  const p=source.electronic_preflight;
  if(p&&Number.isInteger(p.neutral_valence_electrons)&&Number.isInteger(p.minimum_nbnd))
   return {electrons:p.neutral_valence_electrons,minimum:p.minimum_nbnd};
  return null;
 }
 const match=/cannot hold (\d+) neutral valence electrons;.*at least (\d+) bands/.exec(String(source||''));
 return match?{electrons:Number(match[1]),minimum:Number(match[2])}:null;
}

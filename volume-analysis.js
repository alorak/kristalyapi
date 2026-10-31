/* V20: numerical volumetric analysis with explicit error reporting.
 *
 * Grids are {dims:[n0,n1,n2], values (k fastest), periodic, axes:[3 step
 * vectors Å], origin:[Å]}. Pure functions: the editor validates units and
 * cell alignment before calling them. */

const index=(dims,i,j,k)=>(i*dims[1]+j)*dims[2]+k;

/* ---------- sub-voxel extrema: 27-point quadratic (Hessian) fit ---------- */

const OFFSETS=[];
for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++)OFFSETS.push([a,b,c]);
// Least-squares quadratic on the 3×3×3 stencil. With the symmetric design the
// normal equations decouple: g_a = Σ f δ_a / 18, H_ab = Σ f δ_a δ_b / 12 (a≠b),
// and the diagonal follows from the moments Σδ_a² = 18, Σδ_a⁴ = 18, Σδ_a²δ_b² = 12.
function quadraticFit(f){
 const g=[0,0,0],H=[[0,0,0],[0,0,0],[0,0,0]];
 let s0=0;const s2=[0,0,0];
 OFFSETS.forEach((d,n)=>{
  s0+=f[n];
  for(let a=0;a<3;a++){g[a]+=f[n]*d[a];s2[a]+=f[n]*d[a]*d[a];}
  H[0][1]+=f[n]*d[0]*d[1];H[0][2]+=f[n]*d[0]*d[2];H[1][2]+=f[n]*d[1]*d[2];
 });
 for(let a=0;a<3;a++)g[a]/=18;
 H[0][1]/=12;H[0][2]/=12;H[1][2]/=12;H[1][0]=H[0][1];H[2][0]=H[0][2];H[2][1]=H[1][2];
 // Model f = c + Σ g δ + ½ Σ H_aa δ_a² + Σ_{a<b} H_ab δ_a δ_b. Normal equations for c and h_a = ½H_aa:
 // s0 = 27c + 18Σh ; s2_a = 18c + 18h_a + 12Σ_{b≠a} h_b.
 // Solve: from the second, s2_a − s2_b = 6(h_a − h_b); summing gives Σs2 = 54c + 42Σh.
 const S2=s2[0]+s2[1]+s2[2];
 const sumH=(27*S2-54*s0)/(27*42-54*18); // eliminate c
 const c=(s0-18*sumH)/27;
 const mean=(S2/3-18*c-12*sumH)/6; // from s2_a = 18c + 6h_a + 12Σh
 for(let a=0;a<3;a++)H[a][a]=2*(mean+(s2[a]-S2/3)/6);
 return {c,g,H};
}
function solve3(A,b){
 const det=A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
 if(Math.abs(det)<1e-14)return null;
 const col=(m,j,v)=>m.map((row,i)=>row.map((x,k)=>k===j?v[i]:x));
 const d=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
 return [0,1,2].map(j=>d(col(A,j,b))/det);
}
/* Eigenvalues of a symmetric 3×3 matrix (closed form). */
export function symmetricEigenvalues(A){
 const p1=A[0][1]**2+A[0][2]**2+A[1][2]**2,q=(A[0][0]+A[1][1]+A[2][2])/3;
 if(p1<1e-30)return [A[0][0],A[1][1],A[2][2]].sort((a,b)=>a-b);
 const p2=(A[0][0]-q)**2+(A[1][1]-q)**2+(A[2][2]-q)**2+2*p1,p=Math.sqrt(p2/6);
 const B=A.map((row,i)=>row.map((v,j)=>(v-(i===j?q:0))/p));
 const r=(B[0][0]*(B[1][1]*B[2][2]-B[1][2]*B[2][1])-B[0][1]*(B[1][0]*B[2][2]-B[1][2]*B[2][0])+B[0][2]*(B[1][0]*B[2][1]-B[1][1]*B[2][0]))/2;
 const phi=r<=-1?Math.PI/3:r>=1?0:Math.acos(r)/3;
 const e1=q+2*p*Math.cos(phi),e3=q+2*p*Math.cos(phi+2*Math.PI/3),e2=3*q-e1-e3;
 return [e3,e2,e1];
}
/* Refine a grid extremum at (i,j,k). Returns the index-space shift, the
 * method used and the Hessian eigenvalues (in value per index step², so the
 * sign pattern tells a true maximum/minimum from a saddle). The quadratic
 * vertex is accepted when the fitted Hessian has the sign of the extremum and
 * the vertex lies within one voxel; otherwise the per-axis parabola is used. */
export function refineExtremum(grid,i,j,k,mode='max'){
 const d=grid.dims,periodic=!!grid.periodic,at=[i,j,k];
 const value=(a,b,c)=>grid.values[index(d,a,b,c)];
 const inside=OFFSETS.every(o=>periodic||o.every((v,q)=>at[q]+v>=0&&at[q]+v<d[q]));
 const axisShift=()=>[0,1,2].map(axis=>{
  const n=d[axis];
  if(!periodic&&(at[axis]===0||at[axis]===n-1))return 0;
  const f=[-1,1].map(delta=>{const xyz=at.slice();xyz[axis]=(at[axis]+delta+n)%n;return value(...xyz);});
  const denom=f[0]-2*value(i,j,k)+f[1];
  return Math.abs(denom)>1e-12?Math.max(-.5,Math.min(.5,.5*(f[0]-f[1])/denom)):0;
 });
 if(!inside)return {shift:axisShift(),method:'axis',eigenvalues:null,reason:'kenar'};
 const f=OFFSETS.map(o=>value(...o.map((v,q)=>(at[q]+v+d[q])%d[q])));
 const {g,H}=quadraticFit(f),eigenvalues=symmetricEigenvalues(H);
 const definite=mode==='max'?eigenvalues[2]<0:eigenvalues[0]>0;
 const step=definite?solve3(H,g.map(v=>-v)):null;
 if(step&&step.every(v=>Math.abs(v)<=1))return {shift:step,method:'quadratic',eigenvalues};
 return {shift:axisShift(),method:'axis',eigenvalues,reason:definite?'tepe noktası bir vokselden uzak':'eğrilik işareti uygun değil (eyer/düzlük)'};
}

/* ---------- nearest-nucleus (Voronoi) partition with an error bound ---------- */

/* Periodic grid aligned with the cell (grid axes = cell vectors / dims).
 * Blocks of stride³ voxels are assigned to the nucleus nearest to the block
 * centre, but every voxel's value is summed, so the total is the exact grid
 * integral. A block whose nearest and second-nearest nuclei differ by less
 * than twice the block's half-diagonal may straddle a Voronoi boundary; such
 * blocks are re-assigned voxel by voxel. What remains is the voxel-scale
 * ambiguity: the |charge| of voxels with the same ambiguity at voxel size,
 * reported per site as an upper bound of charge that a finer grid could move.
 * cellRows: lattice vectors a, b, c (rows, Å). fractions: atom positions. */
export function voronoiPartition(grid,cellRows,fractions,{maxBlocks=12000}={}){
 const d=grid.dims,N=d[0]*d[1]*d[2],volume=Math.abs(det3(cellRows)),dV=volume/N;
 let stride=1;
 while(d.reduce((p,n)=>p*Math.ceil(n/stride),1)>maxBlocks)stride++;
 const cart=f=>[0,1,2].map(q=>f[0]*cellRows[0][q]+f[1]*cellRows[1][q]+f[2]*cellRows[2][q]);
 // All periodic images that can be nearest: shifts −1…1 along each axis.
 const images=[];
 fractions.forEach((f,site)=>{for(let u=-1;u<=1;u++)for(let v=-1;v<=1;v++)for(let w=-1;w<=1;w++)
  {const g=[f[0]-Math.floor(f[0])+u,f[1]-Math.floor(f[1])+v,f[2]-Math.floor(f[2])+w],c=cart(g);images.push({site,f:g,x:c[0],y:c[1],z:c[2]});}});
 const sites=fractions.length,charges=new Float64Array(sites),uncertainty=new Float64Array(sites),voxels=new Float64Array(sites);
 // Distances in Cartesian Å from precomputed image positions (hot loop: no allocation).
 const nearestTwo=(p,list)=>{
  let a=Infinity,b=Infinity,ia=-1,ib=-1;
  const px=p[0]*cellRows[0][0]+p[1]*cellRows[1][0]+p[2]*cellRows[2][0];
  const py=p[0]*cellRows[0][1]+p[1]*cellRows[1][1]+p[2]*cellRows[2][1];
  const pz=p[0]*cellRows[0][2]+p[1]*cellRows[1][2]+p[2]*cellRows[2][2];
  for(let n=0;n<list.length;n++){
   const img=list[n],dx=px-img.x,dy=py-img.y,dz=pz-img.z,dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
   if(dist<a-1e-12){if(ia!==img.site){b=a;ib=ia;}a=dist;ia=img.site;}
   else if(dist<b&&img.site!==ia){b=dist;ib=img.site;}
  }
  return {a,b,ia,ib};
 };
 const halfDiagonal=n=>{ // largest centre-to-corner distance of an n0×n1×n2-voxel block
  let r=0;for(const s of [[1,1,1],[1,1,-1],[1,-1,1],[-1,1,1]])r=Math.max(r,Math.hypot(...cart(s.map((v,q)=>v*n[q]/(2*d[q])))));
  return r;
 };
 const voxelHalf=halfDiagonal([1,1,1]);
 let total=0,refinedBlocks=0,blocks=0,ambiguousVoxels=0;const point=[0,0,0];
 for(let i=0;i<d[0];i+=stride)for(let j=0;j<d[1];j+=stride)for(let k=0;k<d[2];k+=stride){
  const n=[Math.min(stride,d[0]-i),Math.min(stride,d[1]-j),Math.min(stride,d[2]-k)];blocks++;
  let sum=0;
  for(let a=0;a<n[0];a++)for(let b=0;b<n[1];b++)for(let c=0;c<n[2];c++)sum+=grid.values[index(d,i+a,j+b,k+c)];
  sum*=dV;total+=sum;
  // Voxel (i,j,k) sits at fractional (i/d0, j/d1, k/d2); the block centre is the mean of its voxels.
  const centre=[(i+(n[0]-1)/2)/d[0],(j+(n[1]-1)/2)/d[1],(k+(n[2]-1)/2)/d[2]];
  const near=nearestTwo(centre,images),r=stride>1?halfDiagonal(n.map(v=>v-1)):0;
  // Unrefined blocks must keep every voxel clear of the voxel-scale ambiguity band.
  if(stride===1||near.b-near.a>2*r+2*voxelHalf+1e-12){
   charges[near.ia]+=sum;voxels[near.ia]+=n[0]*n[1]*n[2];
   if(stride===1&&near.b-near.a<=2*voxelHalf){uncertainty[near.ia]+=Math.abs(sum);uncertainty[near.ib]+=Math.abs(sum);ambiguousVoxels++;}
   continue;
  }
  // Possible boundary block: assign each voxel, using only images that can win.
  refinedBlocks++;
  // A voxel's nearest image is within a+2r of the block centre; its second within a further 2·(voxel half-diagonal).
  const reach=near.a+2*r+2*voxelHalf+1e-9;
  const cc=cart(centre),candidates=images.filter(img=>Math.hypot(cc[0]-img.x,cc[1]-img.y,cc[2]-img.z)<=reach+1e-9);
  for(let a=0;a<n[0];a++)for(let b=0;b<n[1];b++)for(let c=0;c<n[2];c++){
   point[0]=(i+a)/d[0];point[1]=(j+b)/d[1];point[2]=(k+c)/d[2];
   const v=grid.values[index(d,i+a,j+b,k+c)]*dV,best=nearestTwo(point,candidates);
   charges[best.ia]+=v;voxels[best.ia]++;
   if(best.ib>=0&&best.b-best.a<=2*voxelHalf){uncertainty[best.ia]+=Math.abs(v);uncertainty[best.ib]+=Math.abs(v);ambiguousVoxels++;}
  }
 }
 return {charges:Array.from(charges),uncertainty:Array.from(uncertainty),voxelFractions:Array.from(voxels,v=>v/N),
  total,volume,stride,blocks,refinedBlocks,ambiguousVoxels,voxelHalfDiagonal:voxelHalf};
}
function det3(m){return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);}

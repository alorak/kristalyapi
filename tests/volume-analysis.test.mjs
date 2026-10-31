import test from 'node:test';
import assert from 'node:assert/strict';
import {refineExtremum,voronoiPartition,symmetricEigenvalues} from '../volume-analysis.js';

const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,a+' ≉ '+b);
function rng(seed){let s=seed>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/2**32);}
const index=(d,i,j,k)=>(i*d[1]+j)*d[2]+k;
function sampled(dims,fn,periodic=false){
 const values=new Float64Array(dims[0]*dims[1]*dims[2]);
 for(let i=0;i<dims[0];i++)for(let j=0;j<dims[1];j++)for(let k=0;k<dims[2];k++)values[index(dims,i,j,k)]=fn(i,j,k);
 return {dims,values,periodic};
}

test('quadratic fit: exact vertex and curvature for any quadratic with cross terms',()=>{
 const random=rng(5);
 for(let trial=0;trial<25;trial++){
  // Negative-definite H = −(LLᵀ + I) and a vertex within half a voxel of (4,4,4).
  const L=[0,1,2].map(()=>[0,1,2].map(()=>random()-.5));
  const H=[0,1,2].map(i=>[0,1,2].map(j=>-(L[i].reduce((s,v,k)=>s+v*L[j][k],0)+(i===j?1:0))));
  const c=[4,4,4].map(v=>v+(random()-.5)*.9);
  const grid=sampled([9,9,9],(i,j,k)=>{const x=[i-c[0],j-c[1],k-c[2]];return 7+.5*x.reduce((s,v,a)=>s+v*x.reduce((q,w,b)=>q+H[a][b]*w,0),0);});
  const r=refineExtremum(grid,4,4,4,'max');
  assert.equal(r.method,'quadratic');
  r.shift.forEach((v,a)=>close(4+v,c[a],1e-9));
  const expected=symmetricEigenvalues(H);
  r.eigenvalues.forEach((v,a)=>close(v,expected[a],1e-9));
 }
 // Eigenvalues: a known symmetric matrix.
 symmetricEigenvalues([[2,1,0],[1,2,0],[0,0,5]]).forEach((v,i)=>close(v,[1,3,5][i],1e-12));
});

test('saddles and grid edges fall back to the per-axis parabola with a reason',()=>{
 const saddle=sampled([7,7,7],(i,j,k)=>5-(i-3.1)**2-(j-2.9)**2+.3*(k-3)**2);
 const r=refineExtremum(saddle,3,3,3,'max');
 assert.equal(r.method,'axis');assert.match(r.reason,/eyer/);
 close(3+r.shift[0],3.1,1e-9);close(3+r.shift[1],2.9,1e-9);
 const edge=refineExtremum(sampled([5,5,5],(i,j,k)=>-(i**2)-(j-2)**2-(k-2)**2),0,2,2,'max');
 assert.equal(edge.method,'axis');assert.equal(edge.reason,'kenar');
});

test('sub-voxel peak of an anisotropic, rotated Gaussian in an oblique cell converges with the grid',()=>{
 // Peak at a general point; covariance with strong cross terms; oblique sampling axes.
 const centre=[1.237,0.913,1.481];
 const A=[[2.1,.6,.3],[.6,1.2,-.4],[.3,-.4,.9]]; // inverse covariance (Å⁻²)
 const field=p=>{const x=p.map((v,i)=>v-centre[i]);return Math.exp(-.5*x.reduce((s,v,a)=>s+v*x.reduce((q,w,b)=>q+A[a][b]*w,0),0));};
 const axes=h=>[[h,0,0],[.25*h,.97*h,0],[.2*h,.15*h,.95*h]];
 const errors={quadratic:[],axis:[]};
 for(const h of [.4,.2,.1]){
  const step=axes(h),n=Math.ceil(3/h)+1;
  const world=(i,j,k)=>[0,1,2].map(q=>i*step[0][q]+j*step[1][q]+k*step[2][q]);
  const grid=sampled([n,n,n],(i,j,k)=>field(world(i,j,k)));
  let best=0;for(let n2=1;n2<grid.values.length;n2++)if(grid.values[n2]>grid.values[best])best=n2;
  const i=Math.floor(best/(n*n)),j=Math.floor(best/n)%n,k=best%n;
  const fit=refineExtremum(grid,i,j,k,'max');
  assert.equal(fit.method,'quadratic',h+' Å');
  const axisShift=[0,1,2].map(a=>{const at=[i,j,k],f=[-1,1].map(d=>{const x=at.slice();x[a]+=d;return grid.values[index(grid.dims,...x)];});
   return .5*(f[0]-f[1])/(f[0]-2*grid.values[best]+f[1]);});
  for(const [name,s] of [['quadratic',fit.shift],['axis',axisShift]]){
   const p=world(i+s[0],j+s[1],k+s[2]);errors[name].push(Math.hypot(...p.map((v,q)=>v-centre[q])));
  }
 }
 // The quadratic-fit error shrinks with the grid (asymptotically ~h²; the voxel offset of the
 // peak differs per grid, so only the overall trend is asserted) and stays below 0.01 Å.
 assert.ok(errors.quadratic.every(e=>e<.01),JSON.stringify(errors));
 assert.ok(errors.quadratic[2]<errors.quadratic[0]/4,JSON.stringify(errors));
 // The per-axis parabola ignores the cross terms and the oblique axes: it stalls near 0.05 Å.
 assert.ok(errors.axis[2]>.03,JSON.stringify(errors));
 assert.ok(errors.quadratic[2]<errors.axis[2]/20,JSON.stringify(errors));
});

// Independent brute force: every voxel to its nearest nucleus over 27 images.
function bruteVoronoi(grid,rows,fractions){
 const d=grid.dims,N=d[0]*d[1]*d[2];
 const V=Math.abs(rows[0][0]*(rows[1][1]*rows[2][2]-rows[1][2]*rows[2][1])-rows[0][1]*(rows[1][0]*rows[2][2]-rows[1][2]*rows[2][0])+rows[0][2]*(rows[1][0]*rows[2][1]-rows[1][1]*rows[2][0]));
 const charges=fractions.map(()=>0);
 for(let i=0;i<d[0];i++)for(let j=0;j<d[1];j++)for(let k=0;k<d[2];k++){
  const p=[i/d[0],j/d[1],k/d[2]];let best=Infinity,owner=-1;
  fractions.forEach((f,s)=>{for(let u=-2;u<=2;u++)for(let v=-2;v<=2;v++)for(let w=-2;w<=2;w++){
   const e=[p[0]-f[0]+u,p[1]-f[1]+v,p[2]-f[2]+w],c=[0,1,2].map(q=>e[0]*rows[0][q]+e[1]*rows[1][q]+e[2]*rows[2][q]);
   const dist=Math.hypot(...c);if(dist<best-1e-12){best=dist;owner=s;}
  }});
  charges[owner]+=grid.values[index(d,i,j,k)]*V/N;
 }
 return charges;
}

test('Voronoi partition: block + boundary refinement equals full voxel assignment; exact total',()=>{
 const random=rng(9),rows=[[5,0,0],[1.2,4.6,0],[.7,.9,5.3]],fractions=[[.1,.2,.3],[.6,.55,.4],[.35,.8,.9],[.92,.05,.61]];
 const grid=sampled([23,27,19],()=>random(),true);
 const brute=bruteVoronoi(grid,rows,fractions);
 for(const maxBlocks of [400,2000,1e9]){
  const r=voronoiPartition(grid,rows,fractions,{maxBlocks});
  r.charges.forEach((q,s)=>close(q,brute[s],1e-9));
  const exact=grid.values.reduce((s,v)=>s+v,0)*r.volume/grid.values.length;
  close(r.total,exact,1e-9);close(r.charges.reduce((s,v)=>s+v,0),exact,1e-9);
  assert.ok(r.uncertainty.every(u=>u>=0));
 }
 assert.ok(voronoiPartition(grid,rows,fractions,{maxBlocks:400}).refinedBlocks>0);
 // The voxel-scale bound does not depend on the block size used to get there.
 const fine=voronoiPartition(grid,rows,fractions,{maxBlocks:1e9}).uncertainty;
 voronoiPartition(grid,rows,fractions,{maxBlocks:400}).uncertainty.forEach((u,s)=>close(u,fine[s],1e-9));
});

test('two separated Gaussians: each nucleus gets its own charge within the reported bound',()=>{
 // Cubic 10 Å cell, charges 3 and 5 e at (0.25,0.25,0.25) and (0.75,0.75,0.75); width 0.5 Å.
 const a=10,n=50,rows=[[a,0,0],[0,a,0],[0,0,a]],sigma=.5,centres=[[.25,.25,.25],[.75,.75,.75]],q=[3,5];
 const norm=1/((2*Math.PI)**1.5*sigma**3);
 const grid=sampled([n,n,n],(i,j,k)=>centres.reduce((s,c,m)=>{
  const dx=[i/n,j/n,k/n].map((v,t)=>{const e=v-c[t];return (e-Math.round(e))*a;});
  return s+q[m]*norm*Math.exp(-(dx[0]**2+dx[1]**2+dx[2]**2)/(2*sigma**2));},0),true);
 const r=voronoiPartition(grid,rows,centres);
 close(r.total,8,1e-6);
 r.charges.forEach((c,m)=>close(c,q[m],1e-6+r.uncertainty[m]));
 assert.ok(r.uncertainty.every(u=>u<1e-6),'density is negligible at the boundary: '+r.uncertainty);
});

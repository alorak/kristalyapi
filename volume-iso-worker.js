/* Package 10.6 — offline progressive conforming adaptive preview, slices and final parity.
 * Mirrors the pure numeric routine in crystal-app.js; native tests compare
 * the complete position/color arrays with both synthetic and Gemmi grids.
 * No network access, dynamic imports, or mutable editor state. */
'use strict';
function volumeCross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function volumeDot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function gridIndex(g,i,j,k){return (i*g.dims[1]+j)*g.dims[2]+k;}
function volumeShape(g){return g.periodic?g.dims.map(n=>n+1):g.dims;}
function volumeVoxel(g,i,j,k){return g.values[gridIndex(g,i%g.dims[0],j%g.dims[1],k%g.dims[2])];}
function volumeWorld(g,i,j,k){
 return [0,1,2].map(q=>g.origin[q]+i*g.axes[0][q]+j*g.axes[1][q]+k*g.axes[2][q]);
}
function volumeCoord(g,point){
 const [a,b,c]=g.axes,delta=point.map((v,i)=>v-g.origin[i]);
 const det=volumeDot(a,volumeCross(b,c));
 return [volumeDot(delta,volumeCross(b,c))/det,volumeDot(a,volumeCross(delta,c))/det,volumeDot(a,volumeCross(b,delta))/det];
}
function volumeSample(g,xyz){
 const shape=volumeShape(g),coord=xyz.map((v,a)=>Math.max(0,Math.min(shape[a]-1,v)));
 const lo=coord.map(Math.floor),hi=lo.map((v,i)=>Math.min(v+1,shape[i]-1)),t=coord.map((v,i)=>v-lo[i]);
 let sum=0;
 for(let a=0;a<=1;a++)for(let b=0;b<=1;b++)for(let c=0;c<=1;c++){
  const i=a?hi[0]:lo[0],j=b?hi[1]:lo[1],k=c?hi[2]:lo[2];
  sum+=volumeVoxel(g,i,j,k)*(a?t[0]:1-t[0])*(b?t[1]:1-t[1])*(c?t[2]:1-t[2]);
 }
 return sum;
}
function volumeAtWorld(g,world){return volumeSample(g,volumeCoord(g,world));}

function colorFromScalar(value,min,max,palette){
 const v=Math.max(0,Math.min(1,(value-min)/Math.max(1e-12,max-min)));
 if(palette==='viridis'){
  const stops=[[0.267,.005,.329],[.229,.322,.545],[.128,.566,.551],[.369,.789,.383],[.993,.906,.144]];
  const n=Math.min(3,Math.floor(v*4)),t=v*4-n;
  return stops[n].map((x,i)=>x*(1-t)+stops[n+1][i]*t);
 }
 if(v<.5){const t=v*2;return [.15+.85*t,.32+.68*t,.88+.12*t];}
 const t=(v-.5)*2;return [1,1-.83*t,1-.86*t];
}
function scalarColor(value,g,palette){
 if(palette==='thermal'){
  const r=Math.max(Math.abs(g.min),Math.abs(g.max),1e-12);
  return colorFromScalar(value,-r,r,'thermal');
 }
 return colorFromScalar(value,g.min,g.max,palette);
}
/* Preview-only workload heuristic: probe at most 6³ cells, selecting a
 * uniform conservative stride. Final triangulation remains fully unchanged.
 * This is NOT spatial adaptive meshing or a scientific error estimate. */
function isoPreviewStride(grid,level){
 const d=volumeShape(grid),base=Math.max(1,...d.map(n=>Math.ceil((n-1)/40)));
 const hops=d.map(n=>Math.max(1,Math.ceil((n-1)/6)));
 let crossed=0,checked=0;
 for(let i=0;i<d[0]-1;i+=hops[0])for(let j=0;j<d[1]-1;j+=hops[1])for(let k=0;k<d[2]-1;k+=hops[2]){
  const x=Math.min(d[0]-1,i+hops[0]),y=Math.min(d[1]-1,j+hops[1]),z=Math.min(d[2]-1,k+hops[2]);
  let min=Infinity,max=-Infinity;
  for(const a of [i,x])for(const b of [j,y])for(const c of [k,z]){
   const v=volumeVoxel(grid,a,b,c);min=Math.min(min,v);max=Math.max(max,v);
  }
  if(min<=level&&max>=level&&max>min)crossed++;
  checked++;
 }
 return base*(crossed/Math.max(1,checked)>.25?2:3);
}
/* P10.8.3: maxAxisIntervals is a validation-only override. Runtime calls use
 * the unchanged 40-interval limit. The triangle cap is NEVER bypassed. */
function isoTriangles(g,level,potential=null,palette='thermal',maxTriangles=75000,minStride=1,maxAxisIntervals=40){
 if(!Number.isInteger(maxAxisIntervals)||maxAxisIntervals<1||maxAxisIntervals>64)
  throw Error('Invalid scientific comparison sampling limit');
 const d=volumeShape(g),stride=Math.max(minStride,1,...d.map(n=>Math.ceil((n-1)/maxAxisIntervals)));
 const vertices=[],colors=[];
 const corner=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const emit=(arr)=>{for(const p of arr){vertices.push(...volumeWorld(g,...p));if(potential){
  const world=volumeWorld(g,...p),sample=volumeAtWorld(potential,world);
  colors.push(...scalarColor(sample,potential,palette));
 }}};
 function edge(a,b){
  const va=a[3],vb=b[3],t=Math.abs(vb-va)>1e-14?Math.max(0,Math.min(1,(level-va)/(vb-va))):.5;
  return [0,1,2].map(n=>a[n]+(b[n]-a[n])*t);
 }
 outer:for(let i=0;i<d[0]-1;i+=stride)for(let j=0;j<d[1]-1;j+=stride)for(let k=0;k<d[2]-1;k+=stride){
  const dx=Math.min(stride,d[0]-1-i),dy=Math.min(stride,d[1]-1-j),dz=Math.min(stride,d[2]-1-k);
  const points=corner.map(([a,b,c])=>{
   const xyz=[i+a*dx,j+b*dy,k+c*dz];
   return [...xyz,volumeVoxel(g,...xyz)];
  });
  for(const tet of tetra){
   const inside=tet.map(q=>points[q]).filter(p=>p[3]>=level);
   const outside=tet.map(q=>points[q]).filter(p=>p[3]<level);
   if(!inside.length||!outside.length)continue;
   if(inside.length===1){
    emit(outside.map(p=>edge(inside[0],p)));
   }else if(inside.length===3){
    emit(inside.map(p=>edge(outside[0],p)).reverse());
   }else{
    const [a,b]=inside,[c,d]=outside;
    const p=edge(a,c),q=edge(a,d),r=edge(b,c),t=edge(b,d);
    emit([p,q,r]);emit([q,t,r]);
   }
   if(vertices.length/9>=maxTriangles)break outer;
  }
 }
 return {positions:new Float32Array(vertices),colors:potential?new Float32Array(colors):null,
  triangles:vertices.length/9,decimation:stride,truncated:vertices.length/9>=maxTriangles};
}


function isoConformingAxisTriangles(g,level,potential,palette,maxTriangles,axisCoords){
 const stride=Math.max(1,...axisCoords.flatMap(axis=>axis.slice(1).map((v,i)=>v-axis[i])));
 const vertices=[],colors=[];
 const corner=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const emit=(arr)=>{for(const p of arr){vertices.push(...volumeWorld(g,...p));if(potential){
  const world=volumeWorld(g,...p),sample=volumeAtWorld(potential,world);
  colors.push(...scalarColor(sample,potential,palette));
 }}};
 function edge(a,b){
  const va=a[3],vb=b[3],t=Math.abs(vb-va)>1e-14?Math.max(0,Math.min(1,(level-va)/(vb-va))):.5;
  return [0,1,2].map(n=>a[n]+(b[n]-a[n])*t);
 }
 outer:for(let ii=0;ii<axisCoords[0].length-1;ii++)for(let jj=0;jj<axisCoords[1].length-1;jj++)for(let kk=0;kk<axisCoords[2].length-1;kk++){
  const i=axisCoords[0][ii],j=axisCoords[1][jj],k=axisCoords[2][kk];
  const dx=axisCoords[0][ii+1]-i,dy=axisCoords[1][jj+1]-j,dz=axisCoords[2][kk+1]-k;
  const points=corner.map(([a,b,c])=>{
   const xyz=[i+a*dx,j+b*dy,k+c*dz];
   return [...xyz,volumeVoxel(g,...xyz)];
  });
  for(const tet of tetra){
   const inside=tet.map(q=>points[q]).filter(p=>p[3]>=level);
   const outside=tet.map(q=>points[q]).filter(p=>p[3]<level);
   if(!inside.length||!outside.length)continue;
   if(inside.length===1){
    emit(outside.map(p=>edge(inside[0],p)));
   }else if(inside.length===3){
    emit(inside.map(p=>edge(outside[0],p)).reverse());
   }else{
    const [a,b]=inside,[c,d]=outside;
    const p=edge(a,c),q=edge(a,d),r=edge(b,c),t=edge(b,d);
    emit([p,q,r]);emit([q,t,r]);
   }
   if(vertices.length/9>=maxTriangles)break outer;
  }
 }
 return {positions:new Float32Array(vertices),colors:potential?new Float32Array(colors):null,
  triangles:vertices.length/9,decimation:stride,truncated:vertices.length/9>=maxTriangles};
}




/* P10.6: conforming nonuniform tensor-grid *preview*.
 * Every plane at a chosen axis coordinate spans the whole grid: neighbors
 * therefore share identical face vertices/diagonals (no T-junctions).
 * Refinement decisions are local samples projected onto axis intervals.
 * The residual is sampled scalar error, NOT a rigorous Hausdorff bound;
 * the numerically validated final mesh still uses isoTriangles verbatim.
 * This deliberately is not an octree with arbitrary local 2:1 transitions. */
function isoAdaptiveAxisPlan(g,level,minStride,maxAxisNodes=32){
 const shape=volumeShape(g),step=Math.max(1,Math.trunc(minStride));
 const nodes=shape.map(n=>{
  const out=[];for(let i=0;i<n-1;i+=step)out.push(i);
  out.push(n-1);return out;
 });
 const tolerance=Math.max(1e-8,Math.abs(g.max-g.min)*.005);
 let refined=0,passes=0;
 const sampleCell=(lo,hi)=>{
  const vals=[];
  for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]])
   vals.push(volumeVoxel(g,x,y,z));
  const center=lo.map((v,a)=>(v+hi[a])/2),actual=volumeSample(g,center);
  const predicted=vals.reduce((sum,v)=>sum+v,0)/8;
  const minimum=Math.min(...vals),maximum=Math.max(...vals);
  const oneSign=minimum>=level?1:maximum<level?-1:0;
  const missingCrossing=oneSign!==0&&(actual>=level)!==(oneSign>0);
  const nearby=(minimum<=level&&maximum>=level)||missingCrossing||
   Math.abs(actual-level)<=Math.abs(actual-predicted)*2;
  return {error:Math.abs(actual-predicted),nearby,missingCrossing};
 };
 for(let pass=0;pass<3;pass++){
  const proposals=[new Map(),new Map(),new Map()];
  for(let i=0;i<nodes[0].length-1;i++)for(let j=0;j<nodes[1].length-1;j++)for(let k=0;k<nodes[2].length-1;k++){
   const lo=[nodes[0][i],nodes[1][j],nodes[2][k]],
    hi=[nodes[0][i+1],nodes[1][j+1],nodes[2][k+1]];
   if(hi.every((v,a)=>v-lo[a]<2))continue;
   const result=sampleCell(lo,hi);
   if(!result.nearby||(!result.missingCrossing&&result.error<=tolerance))continue;
   for(let axis=0;axis<3;axis++){
    if(hi[axis]-lo[axis]<2)continue;
    const midpoint=Math.floor((hi[axis]+lo[axis])/2);
    const score=(result.missingCrossing?100:0)+result.error/tolerance;
    proposals[axis].set(midpoint,Math.max(score,proposals[axis].get(midpoint)||0));
   }
  }
  let added=0;
  for(let axis=0;axis<3;axis++){
   const capacity=Math.max(0,maxAxisNodes-nodes[axis].length);
   const perPass=Math.min(capacity,Math.max(1,Math.ceil(capacity/(3-pass))));
   const selected=[...proposals[axis]].sort((a,b)=>b[1]-a[1]||a[0]-b[0])
    .slice(0,perPass).map(([coord])=>coord);
   if(selected.length){
    nodes[axis]=[...new Set([...nodes[axis],...selected])].sort((a,b)=>a-b);
    added+=selected.length;
   }
  }
  passes++;refined+=added;
  if(!added)break;
 }
 let maxSampledError=0,centerSamples=0;
 for(let i=0;i<nodes[0].length-1;i++)for(let j=0;j<nodes[1].length-1;j++)for(let k=0;k<nodes[2].length-1;k++){
  const lo=[nodes[0][i],nodes[1][j],nodes[2][k]],
   hi=[nodes[0][i+1],nodes[1][j+1],nodes[2][k+1]];
  const result=sampleCell(lo,hi);
  if(result.nearby){centerSamples++;maxSampledError=Math.max(maxSampledError,result.error);}
 }
 return {nodes,stats:{kind:'conforming-axis-preview',axisCells:nodes.map(a=>a.length-1),
  sampledCenterErrorMax:maxSampledError,scalarTolerance:tolerance,
  sampledToleranceMet:maxSampledError<=tolerance,
  centerSamples,refinedAxisIntervals:refined,passes}};
}


/* Package 10.7: experimental local octree preview. Rectangles on a coarse
 * face are tiled by the actual opposite (fine) leaf faces. Both sides fan
 * identical canonical face triangles to their own cell center: no face T
 * junctions, including 2:1 interfaces. This only affects progressive preview;
 * isoTriangles remains the unmodified final scientific extraction. */
function isoOctreeFaces(leaves){
 const planes=new Map(),faces=[];
 for(let index=0;index<leaves.length;index++){
  const leaf=leaves[index];
  for(let axis=0;axis<3;axis++){
   const [u,v]=[0,1,2].filter(n=>n!==axis);
   for(let side=0;side<=1;side++){
    const f={index,axis,side,coord:leaf[side?'hi':'lo'][axis],
     loU:leaf.lo[u],hiU:leaf.hi[u],loV:leaf.lo[v],hiV:leaf.hi[v],u,v};
    const key=axis+':'+f.coord;
    if(!planes.has(key))planes.set(key,[]);
    planes.get(key).push(f);faces.push(f);
   }
  }
 }
 return {planes,faces};
}
function isoOctreeSplit(leaf){
 const mids=leaf.lo.map((x,a)=>Math.floor((x+leaf.hi[a])/2));
 const intervals=leaf.lo.map((x,a)=>leaf.hi[a]-x>1?
  [[x,mids[a]],[mids[a],leaf.hi[a]]]:[[x,leaf.hi[a]]]);
 const result=[];
 for(const x of intervals[0])for(const y of intervals[1])for(const z of intervals[2])
  result.push({lo:[x[0],y[0],z[0]],hi:[x[1],y[1],z[1]],depth:leaf.depth+1});
 return result;
}
function isoOctreePlan(g,level,maxLeaves=4500){
 const shape=volumeShape(g),scalarTolerance=Math.max(1e-8,(g.max-g.min)*.005);
 const leaves=[],root={lo:[0,0,0],hi:shape.map(n=>n-1),depth:0};
 let probes=0,refined=0,overBudget=false;
 const cornerOffsets=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],
  [0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const examine=leaf=>{
  const cs=cornerOffsets.map(bit=>leaf.lo.map((x,a)=>bit[a]?leaf.hi[a]:x));
  const vals=cs.map(p=>volumeVoxel(g,...p));
  let lo=Math.min(...vals),hi=Math.max(...vals),residual=0;
  const center=leaf.lo.map((x,a)=>(x+leaf.hi[a])/2);
  const samplePoints=[center];
  for(let axis=0;axis<3;axis++)for(let side=0;side<2;side++)
   samplePoints.push(center.map((x,a)=>a===axis?(side?leaf.hi[a]:leaf.lo[a]):x));
  for(const p of samplePoints){
   const actual=volumeSample(g,p),t=p.map((x,a)=>(x-leaf.lo[a])/(leaf.hi[a]-leaf.lo[a]));
   let predicted=0;
   for(let c=0;c<8;c++){
    const bits=cornerOffsets[c];
    predicted+=vals[c]*bits.reduce((prod,bit,a)=>prod*(bit?t[a]:1-t[a]),1);
   }
   residual=Math.max(residual,Math.abs(actual-predicted));
   lo=Math.min(lo,actual);hi=Math.max(hi,actual);probes++;
  }
  return {residual,nearby:lo<=level&&hi>=level};
 };
 const queue=[root];
 while(queue.length){
  const leaf=queue.pop(),check=examine(leaf);
  const canSplit=leaf.depth<7&&leaf.hi.some((v,a)=>v-leaf.lo[a]>1);
  if(check.nearby&&check.residual>scalarTolerance&&canSplit){
   const children=isoOctreeSplit(leaf);
   if(leaves.length+queue.length+children.length>maxLeaves){overBudget=true;break;}
   queue.push(...children);refined++;
  }else{leaf.error=check.nearby?check.residual:0;leaf.nearby=check.nearby;leaves.push(leaf);}
 }
 if(overBudget)return {ok:false,stats:{kind:'octree-2to1-preview',accepted:false,
  reason:'leaf budget',leafBudget:maxLeaves,scalarTolerance}};
 let balancePasses=0,transitionFaces=0;
 for(;balancePasses<9;balancePasses++){
  const {planes}=isoOctreeFaces(leaves),split=new Set();
  for(const faces of planes.values()){
   const low=faces.filter(f=>f.side===0),high=faces.filter(f=>f.side===1);
   for(const a of low)for(const b of high){
    if(a.loU>=b.hiU||b.loU>=a.hiU||a.loV>=b.hiV||b.loV>=a.hiV)continue;
    const da=leaves[a.index].depth,db=leaves[b.index].depth;
    if(Math.abs(da-db)>1)split.add(da<db?a.index:b.index);
   }
  }
  if(!split.size)break;
  const grown=[];
  for(let i=0;i<leaves.length;i++){
   if(split.has(i))grown.push(...isoOctreeSplit(leaves[i]));
   else grown.push(leaves[i]);
  }
  if(grown.length>maxLeaves){overBudget=true;break;}
  leaves.splice(0,leaves.length,...grown);
 }
 if(overBudget||balancePasses>=9)return {ok:false,stats:{kind:'octree-2to1-preview',accepted:false,
  reason:'2:1 balancing budget',leafBudget:maxLeaves,scalarTolerance}};
 let maxError=0,nearbyLeaves=0,leafDepths={},surfaceDepths={};
 for(const leaf of leaves){
  const check=examine(leaf);
  if(check.nearby){nearbyLeaves++;maxError=Math.max(maxError,check.residual);
   surfaceDepths[leaf.depth]=(surfaceDepths[leaf.depth]||0)+1;}
  leafDepths[leaf.depth]=(leafDepths[leaf.depth]||0)+1;
 }
 const {planes}=isoOctreeFaces(leaves);
 for(const faces of planes.values()){
  const low=faces.filter(f=>f.side===0),high=faces.filter(f=>f.side===1);
  for(const a of low)for(const b of high){
   if(a.loU>=b.hiU||b.loU>=a.hiU||a.loV>=b.hiV||b.loV>=a.hiV)continue;
   if(leaves[a.index].depth!==leaves[b.index].depth)transitionFaces++;
  }
 }
 const stats={kind:'octree-2to1-preview',leaves:leaves.length,leafBudget:maxLeaves,
  leafDepths,surfaceDepths,nearbyLeaves,transitionFaces,
  balancePasses,refinedNodes:refined,scalarTolerance,
  sampledCenterErrorMax:maxError,sampledToleranceMet:maxError<=scalarTolerance,
  sampleProbes:probes,accepted:false};
 return {ok:maxError<=scalarTolerance,leaves,stats,planes};
}
function isoOctreeTriangles(g,level,potential,palette,maxTriangles,plan){
 const vertices=[],colors=[],residuals=[],positionProxies=[];
 let surfacePatches=0,transitionPatches=0,faceTriangles=0;
 const cache=new Map();
 const point=xyz=>{
  const key=xyz.join(',');
  if(!cache.has(key))cache.set(key,[...xyz,volumeSample(g,xyz)]);
  return cache.get(key);
 };
 const edge=(a,b)=>{
  const t=Math.abs(b[3]-a[3])>1e-14?
   Math.max(0,Math.min(1,(level-a[3])/(b[3]-a[3]))):.5;
  return [0,1,2].map(i=>a[i]+(b[i]-a[i])*t);
 };
 const [a,b,c]=g.axes,det=volumeDot(a,volumeCross(b,c));
 const dual=[volumeCross(b,c),volumeCross(c,a),volumeCross(a,b)];
 const gradient=p=>{
  const derivatives=p.map((x,axis)=>{
   const forward=p.slice(),backward=p.slice(),step=.25;
   forward[axis]+=step;backward[axis]-=step;
   return (volumeSample(g,forward)-volumeSample(g,backward))/(2*step);
  });
  const length=Math.hypot(...[0,1,2].map(i=>
   (derivatives[0]*dual[0][i]+derivatives[1]*dual[1][i]+derivatives[2]*dual[2][i])/det));
  return length;
 };
 const emit=arr=>{
  for(const p of arr){
   const world=volumeWorld(g,...p);
   vertices.push(...world);
   const residual=Math.abs(volumeSample(g,p)-level);
   residuals.push(residual);
   // First-order local normal displacement proxy, not a Hausdorff bound.
   const grad=gradient(p);
   if(grad>1e-9)positionProxies.push(residual/grad);
   if(potential)colors.push(...scalarColor(volumeAtWorld(potential,world),potential,palette));
  }
 };
 function tetra(center,p,q,r){
  const pts=[center,p,q,r],inside=pts.filter(x=>x[3]>=level),outside=pts.filter(x=>x[3]<level);
  if(!inside.length||!outside.length)return;
  const before=vertices.length;
  if(inside.length===1)emit(outside.map(o=>edge(inside[0],o)));
  else if(inside.length===3)emit(inside.map(o=>edge(outside[0],o)).reverse());
  else{
   const [a,b]=inside,[c,d]=outside;
   const p=edge(a,c),q=edge(a,d),r=edge(b,c),t=edge(b,d);
   emit([p,q,r]);emit([q,t,r]);
  }
  // Orient iso triangles toward decreasing scalar, using this tetrahedron's
  // exact linear gradient. Mixed-case marching edge order is not reliable.
  const u=p.map((x,i)=>x-center[i]),v=q.map((x,i)=>x-center[i]),
   w=r.map((x,i)=>x-center[i]),volume=volumeDot(u,volumeCross(v,w));
  if(Math.abs(volume)<1e-12)return;
  const dc=[p[3]-center[3],q[3]-center[3],r[3]-center[3]];
  const co=[volumeCross(v,w),volumeCross(w,u),volumeCross(u,v)];
  const gradCell=[0,1,2].map(i=>dc.reduce((sum,d,j)=>sum+d*co[j][i],0)/volume);
  const gradWorld=[0,1,2].map(i=>gradCell.reduce((sum,d,j)=>sum+d*dual[j][i],0)/det);
  for(let i=before;i<vertices.length;i+=9){
   const e1=[0,1,2].map(j=>vertices[i+3+j]-vertices[i+j]);
   const e2=[0,1,2].map(j=>vertices[i+6+j]-vertices[i+j]);
   if(volumeDot(volumeCross(e1,e2),gradWorld)>0){
    for(let j=0;j<3;j++){
     const tmp=vertices[i+3+j];vertices[i+3+j]=vertices[i+6+j];vertices[i+6+j]=tmp;
     if(potential){const t=colors[i+3+j];colors[i+3+j]=colors[i+6+j];colors[i+6+j]=t;}
    }
   }
  }
 }

 // Canonical face rectangles are identical from coarse and fine cells.
 const patches=[],lineEndpoints=new Map();
 const line=(p,q)=>{
  const axis=[0,1,2].find(a=>p[a]!==q[a]);
  if(axis===undefined)return null;
  const fixed=[0,1,2].filter(a=>a!==axis);
  return {key:axis+':'+fixed.map(a=>p[a]).join(':'),axis};
 };
 const patchCorner=(patch,u,v)=>{
  const p=[0,0,0];p[patch.f.axis]=patch.f.coord;
  p[patch.f.u]=u;p[patch.f.v]=v;return p;
 };
 for(const f of isoOctreeFaces(plan.leaves).faces){
  const leaf=plan.leaves[f.index],neighbours=plan.planes.get(f.axis+':'+f.coord)
   .filter(o=>o.side!==f.side&&o.loU<f.hiU&&f.loU<o.hiU&&o.loV<f.hiV&&f.loV<o.hiV);
  const rectangles=neighbours.length?neighbours.map(n=>[
   Math.max(f.loU,n.loU),Math.min(f.hiU,n.hiU),
   Math.max(f.loV,n.loV),Math.min(f.hiV,n.hiV),n.index]):
   [[f.loU,f.hiU,f.loV,f.hiV,-1]];
  for(const [u0,u1,v0,v1,other] of rectangles){
   const patch={f,u0,u1,v0,v1,transition:other>=0&&plan.leaves[other].depth!==leaf.depth};
   patches.push(patch);
   const ring=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]
    .map(([u,v])=>patchCorner(patch,u,v));
   for(let i=0;i<4;i++){
    const p=ring[i],q=ring[(i+1)%4],descriptor=line(p,q);
    if(!lineEndpoints.has(descriptor.key))lineEndpoints.set(descriptor.key,[]);
    lineEndpoints.get(descriptor.key).push(p[descriptor.axis],q[descriptor.axis]);
   }
  }
 }
 for(const [key,coords] of lineEndpoints)lineEndpoints.set(key,
  [...new Set(coords)].sort((a,b)=>a-b));
 // Each patch fans from its shared face center to the perimeter. Edge
 // breakpoints propagate to all adjacent faces, including orthogonal faces.
 for(const patch of patches){
  const {f,u0,u1,v0,v1}=patch,leaf=plan.leaves[f.index];
  const center=point(leaf.lo.map((x,a)=>(x+leaf.hi[a])/2));
  const faceCenter=point(patchCorner(patch,(u0+u1)/2,(v0+v1)/2));
  const corners=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]
   .map(([u,v])=>patchCorner(patch,u,v));
  const ring=[];
  for(let i=0;i<4;i++){
   const p=corners[i],q=corners[(i+1)%4],descriptor=line(p,q);
   const cuts=lineEndpoints.get(descriptor.key)
    .filter(x=>x>=Math.min(p[descriptor.axis],q[descriptor.axis])&&
     x<=Math.max(p[descriptor.axis],q[descriptor.axis]));
   if(p[descriptor.axis]>q[descriptor.axis])cuts.reverse();
   for(const x of cuts.slice(0,-1)){
    const xyz=p.slice();xyz[descriptor.axis]=x;ring.push(point(xyz));
   }
  }
  for(let i=0;i<ring.length;i++){
   tetra(center,faceCenter,ring[i],ring[(i+1)%ring.length]);
   faceTriangles++;
  }
  surfacePatches++;
  if(patch.transition)transitionPatches++;
  if(vertices.length/9>maxTriangles)return {truncated:true};
 }
 // Avoid spreading more than the bounded 225,000 vertex sample array.
 const maximum=values=>values.reduce((a,b)=>Math.max(a,b),0);
 const percentile=(values,p)=>{if(!values.length)return 0;
  values.sort((a,b)=>a-b);return values[Math.min(values.length-1,Math.ceil(p*values.length)-1)];};
 return {positions:new Float32Array(vertices),colors:potential?new Float32Array(colors):null,
  triangles:vertices.length/9,decimation:0,truncated:false,
  metrics:{surfacePatches,transitionPatches,faceTriangles,
   isoVertexScalarResidualMax:maximum(residuals),
   isoVertexScalarResidualP95:percentile(residuals,.95),
   isoPositionProxyMaxAngstrom:maximum(positionProxies),
   isoPositionProxyP95Angstrom:percentile(positionProxies,.95),
   positionProxySamples:positionProxies.length}};
}

function sliceContourLevels(values,count=8,reference=null,mode='uniform'){
 if(!Number.isInteger(count)||count<2||count>20)throw Error('Kontur sayısı 2–20 olmalı.');
 if(!['uniform','balanced','positive','negative'].includes(mode))
  throw Error('Kontur seviye modu geçersiz.');
 let min=Infinity,max=-Infinity;
 for(const value of values)if(Number.isFinite(value)){min=Math.min(min,value);max=Math.max(max,value);}
 if(!(max>min))return [];
 let levels;
 if(mode==='balanced'&&min<0&&max>0){
  const limit=Math.min(-min,max),pairs=Math.floor(count/2);
  levels=[];
  for(let i=1;i<=pairs;i++){
   const magnitude=limit*i/(pairs+1);levels.push(-magnitude,magnitude);
  }
  if(count%2)levels.push(0);
 }else{
  let lower=min,upper=max;
  if(mode==='positive')lower=Math.max(0,min);
  if(mode==='negative')upper=Math.min(0,max);
  if(!(upper>lower))return [];
  levels=Array.from({length:count},(_,i)=>lower+(upper-lower)*(i+1)/(count+1));
 }
 const containsReference=Number.isFinite(reference)&&reference>min&&reference<max&&
  (mode!=='positive'||reference>0)&&(mode!=='negative'||reference<0);
 if(containsReference&&!levels.some(n=>Math.abs(n-reference)<(max-min)*1e-5))levels.push(reference);
 return levels.sort((a,b)=>a-b);
}
function sliceContourStroke(level,reference,style='standard'){
 if(!['standard','signed','mono'].includes(style))throw Error('Kontur çizgi stili geçersiz.');
 if(style==='signed'){
  if(Math.abs(level)<1e-12)return {color:'#1c2b3b',width:1.7,dash:[]};
  return level>0?{color:'#0c766e',width:reference?2.6:1.4,dash:[]}:
   {color:'#be493f',width:reference?2.6:1.4,dash:[5,3]};
 }
 if(style==='mono')return {color:'#1e2835',width:reference?2.3:1.2,dash:reference?[5,2]:[]};
 return {color:reference?'rgba(255,255,255,.96)':'rgba(28,42,63,.8)',width:reference?2.1:.9,dash:[]};
}
/* Marching squares with a center-value saddle disambiguation. Invalid Miller
   pixels remain holes: no contour crosses an undefined outside-grid area. */
function sliceContourSegments(values,resolution,levels,step=1,maxSegments=60000){
 if(!Number.isInteger(resolution)||resolution<2||values.length!==resolution*resolution||
  !Number.isInteger(step)||step<1||step>8||!Array.isArray(levels)||levels.length>21||
  levels.some(v=>!Number.isFinite(v)))throw Error('Kontur örnekleme parametreleri geçersiz.');
 const result=[];let truncated=false;
 outer:for(const level of levels)for(let y=0;y<resolution-1;y+=step)for(let x=0;x<resolution-1;x+=step){
  const X=Math.min(resolution-1,x+step),Y=Math.min(resolution-1,y+step);
  const v=[values[y*resolution+x],values[y*resolution+X],values[Y*resolution+X],values[Y*resolution+x]];
  if(!v.every(Number.isFinite))continue;
  const corners=[[x,y],[X,y],[X,Y],[x,Y]],cross=[];
  for(let edge=0;edge<4;edge++){
   const next=(edge+1)%4;
   if((v[edge]<level)===(v[next]<level))continue;
   const fraction=(level-v[edge])/(v[next]-v[edge]);
   cross.push({edge,point:[corners[edge][0]+fraction*(corners[next][0]-corners[edge][0]),
    corners[edge][1]+fraction*(corners[next][1]-corners[edge][1])]});
  }
  const connect=(a,b)=>{
   const start=cross.find(item=>item.edge===a)?.point,end=cross.find(item=>item.edge===b)?.point;
   if(start&&end)result.push({x1:start[0],y1:start[1],x2:end[0],y2:end[1],level});
  };
  if(cross.length===2)connect(cross[0].edge,cross[1].edge);
  else if(cross.length===4){
   const center=(v[0]+v[1]+v[2]+v[3])/4;
   if((v[0]>=level)===(center>=level)){connect(0,1);connect(2,3);}
   else{connect(0,3);connect(1,2);}
  }
  if(result.length>=maxSegments){truncated=true;break outer;}
 }
 return {segments:result,truncated};
}

function sliceMatrix(g,job){
 const size=job.size,shape=volumeShape(g),hkl=job.axis==='hkl';
 const floating=hkl?null:[0,1,2].filter(n=>n!==job.axis);
 const corners=job.corners;
 const values=new Float32Array(size*size),rows=job.includeRows===false?null:new Float64Array(size*size*4);
 let min=Infinity,max=-Infinity,sum=0,valid=0;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const u=i/(size-1),v=j/(size-1),index=j*size+i;
  let world,coords;
  if(hkl){
   world=corners[0].map((x,k)=>x+u*(corners[1][k]-x)+v*(corners[3][k]-x));
   const frac=volumeCoord(g,world);
   if(frac.some((x,k)=>x< -1e-5||x>shape[k]-1+1e-5)){values[index]=NaN;continue;}
  }else{
   coords=[0,0,0];coords[job.axis]=(shape[job.axis]-1)*job.position/100;
   coords[floating[0]]=(shape[floating[0]]-1)*u;
   coords[floating[1]]=(shape[floating[1]]-1)*v;
   world=volumeWorld(g,...coords);
  }
  const value=hkl?volumeAtWorld(g,world):volumeSample(g,coords);
  values[index]=value;min=Math.min(min,value);max=Math.max(max,value);sum+=value;valid++;
  if(rows)rows.set([...world,value],index*4);
 }
 if(!valid)throw Error('Slice outside grid');
 const width=Math.hypot(...corners[1].map((v,k)=>v-corners[0][k]));
 const height=Math.hypot(...corners[3].map((v,k)=>v-corners[0][k]));
 return {values,rows,min,max,mean:sum/valid,width,height,valid};
}

/* Raster-only export: sample Cartesian skew / signed maps off the UI thread.
 * Miller frames come from the already validated main-thread clipping routine. */
function sliceRaster(grid,potential,job){
 const size=job.size,values=new Float32Array(size*size),rgba=new Uint8ClampedArray(size*size*4);
 const hkl=job.axis==='hkl',shape=volumeShape(grid),floating=hkl?null:[0,1,2].filter(n=>n!==job.axis);
 const corners=job.corners;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const s=i/(size-1),t=j/(size-1),index=j*size+i;
  let world,coord;
  if(hkl){
   world=corners[0].map((v,k)=>v+s*(corners[1][k]-v)+t*(corners[3][k]-v));
   const xyz=volumeCoord(grid,world);
   if(xyz.some((v,k)=>v< -1e-5||v>shape[k]-1+1e-5)){values[index]=NaN;continue;}
  }else{
   coord=[0,0,0];coord[job.axis]=(shape[job.axis]-1)*job.position/100;
   coord[floating[0]]=(shape[floating[0]]-1)*s;
   coord[floating[1]]=(shape[floating[1]]-1)*t;
   world=volumeWorld(grid,...coord);
  }
  const value=hkl?volumeAtWorld(grid,world):volumeSample(grid,coord);
  values[index]=value;
  const colorGrid=potential||grid;
  const colorValue=potential?volumeAtWorld(potential,world):value;
  const rgb=scalarColor(colorValue,colorGrid,job.palette);
  const p=index*4;
  for(let k=0;k<3;k++)rgba[p+k]=Math.round(rgb[k]*255);
  rgba[p+3]=206;
 }
 if(job.contours){
  const opt=job.contours;
  const levels=sliceContourLevels(values,opt.count,opt.reference,opt.mode);
  const traced=sliceContourSegments(values,size,levels,opt.step);
  const lines=new Float32Array(traced.segments.length*5);
  for(let n=0;n<traced.segments.length;n++){
   const item=traced.segments[n];
   lines.set([item.x1,item.y1,item.x2,item.y2,levels.indexOf(item.level)],n*5);
  }
  return {values,rgba,levels,lines,contourTruncated:traced.truncated};
 }
 return {values,rgba};
}
self.onmessage=event=>{
 const data=event.data||{},requestId=data.requestId;
 try{
  if(!Array.isArray(data.grids)||data.grids.length>6||(!['slice','slice-matrix','slice-preview'].includes(data.type)&&(!Array.isArray(data.jobs)||data.jobs.length>8)))
   throw Error('Invalid volume worker budget');
  for(const g of data.grids){
   const n=g?.dims?.reduce((a,b)=>a*b,1);
   if(!Array.isArray(g?.dims)||g.dims.length!==3||g.dims.some(x=>!Number.isInteger(x)||x<2)||
      n>2500000||n<8||g.values?.length!==n)throw Error('Invalid worker voxel grid');
  }
   if(data.type==='slice-matrix'){
    const job=data.matrix,grid=data.grids[job?.grid];
    if(!grid||!Number.isInteger(job.size)||job.size<2||job.size>256||
       !(job.axis==='hkl'||[0,1,2].includes(job.axis))||
       !Number.isFinite(job.position)||job.position<0||job.position>100||
       !Array.isArray(job.corners)||job.corners.length!==4||
       job.corners.some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x))))
     throw Error('Invalid slice matrix');
    const result=sliceMatrix(grid,job);
    self.postMessage({requestId,matrix:result},[result.values.buffer,result.rows.buffer]);
    return;
   }
  if(data.type==='slice'||data.type==='slice-preview'){
   const job=data.slice,grid=data.grids[job?.grid],potential=job?.potential<0?null:data.grids[job?.potential];
   if(!grid||job.potential>=data.grids.length||!Number.isInteger(job.size)||
      job.size<64||job.size>1024||!(job.axis==='hkl'||[0,1,2].includes(job.axis))||
      !Number.isFinite(job.position)||job.position<0||job.position>100||
      !['thermal','viridis','blue-red'].includes(job.palette)||
      (job.axis==='hkl'&&(!Array.isArray(job.corners)||job.corners.length!==4||
       job.corners.some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x))))))
    throw Error('Invalid slice export');
   if(job.contours&&(!Number.isInteger(job.contours.count)||job.contours.count<2||
      job.contours.count>20||!Number.isFinite(job.contours.reference)||
      !['uniform','balanced','positive','negative'].includes(job.contours.mode)||
      !Number.isInteger(job.contours.step)||job.contours.step<1||job.contours.step>8))
    throw Error('Invalid contour settings');
   if(data.type==='slice-preview'&&(job.size!==192||!Array.isArray(job.corners)||
      job.corners.length!==4||job.corners.some(p=>!Array.isArray(p)||p.length!==3||
      p.some(v=>!Number.isFinite(v)))))
    throw Error('Invalid interactive preview');
   const started=performance.now();
   const result=sliceRaster(grid,potential,job);
   if(data.type==='slice-preview'){
    const base={axis:job.axis,position:job.position,corners:job.corners,includeRows:false};
    const matrix=sliceMatrix(grid,{...base,size:128});
    const stats=sliceMatrix(grid,{...base,size:32});
    const transfer=[result.values.buffer,result.rgba.buffer,matrix.values.buffer,stats.values.buffer];
    if(result.lines)transfer.push(result.lines.buffer);
    self.postMessage({requestId,preview:{slice:result,matrix,stats,elapsedMs:performance.now()-started}},transfer);
    return;
   }
   const transfer=[result.values.buffer,result.rgba.buffer];
   if(result.lines)transfer.push(result.lines.buffer);
   self.postMessage({requestId,slice:result},transfer);
   return;
  }
  const started=performance.now(),results=[],transfer=[];
  for(const [jobIndex,job] of data.jobs.entries()){
   const grid=data.grids[job.grid],potential=job.potential<0?null:data.grids[job.potential];
   if(!grid||job.potential>=data.grids.length||!Number.isFinite(job.level)||
      !Number.isInteger(job.maxTriangles)||job.maxTriangles<1||job.maxTriangles>75000||
      !['thermal','viridis','blue-red'].includes(job.palette))
    throw Error('Invalid isosurface job');
   if(data.progressive&&grid.values.length>=200000){
    const stride=isoPreviewStride(grid,job.level);
    const octree=isoOctreePlan(grid,job.level);
    let preview=null,stats=octree.stats;
    if(octree.ok){
     const candidate=isoOctreeTriangles(grid,job.level,potential,job.palette,job.maxTriangles,octree);
     if(!candidate.truncated){
      preview=candidate;stats={...stats,...candidate.metrics,accepted:true};
     }else stats={...stats,reason:'triangle budget',accepted:false};
    }else if(!stats.reason)stats={...stats,reason:'sampled probe tolerance'};
    if(!preview){
     const axisPlan=isoAdaptiveAxisPlan(grid,job.level,stride);
     const axis=axisPlan.stats.sampledToleranceMet?
      isoConformingAxisTriangles(grid,job.level,potential,job.palette,job.maxTriangles,axisPlan.nodes):
      isoTriangles(grid,job.level,potential,job.palette,job.maxTriangles,stride);
     preview=axis;
     stats={...axisPlan.stats,accepted:axisPlan.stats.sampledToleranceMet&&!axis.truncated,
      octreeFallbackReason:stats.reason,octreeLeafBudget:octree.stats.leafBudget};
    }
    preview.adaptive=stats;
    self.postMessage({requestId,previewIndex:jobIndex,previewSurface:preview},
     [preview.positions.buffer,...(preview.colors?[preview.colors.buffer]:[])]);
   }
   const surface=isoTriangles(grid,job.level,potential,job.palette,job.maxTriangles);
   results.push(surface);transfer.push(surface.positions.buffer);
   if(surface.colors)transfer.push(surface.colors.buffer);
  }
  self.postMessage({requestId,results,elapsedMs:performance.now()-started},transfer);
 }catch(error){
  self.postMessage({requestId,error:String(error?.message||error)});
 }
};

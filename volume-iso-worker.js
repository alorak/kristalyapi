/* Package 10.2 — isolated, offline marching-tetrahedra worker.
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
function isoTriangles(g,level,potential=null,palette='thermal',maxTriangles=75000){
 const d=volumeShape(g),stride=Math.max(1,...d.map(n=>Math.ceil((n-1)/40)));
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

self.onmessage=event=>{
 const data=event.data||{},requestId=data.requestId;
 try{
  if(!Array.isArray(data.grids)||data.grids.length>6||!Array.isArray(data.jobs)||data.jobs.length>8)
   throw Error('Invalid volume worker budget');
  for(const g of data.grids){
   const n=g?.dims?.reduce((a,b)=>a*b,1);
   if(!Array.isArray(g?.dims)||g.dims.length!==3||g.dims.some(x=>!Number.isInteger(x)||x<2)||
      n>2500000||n<8||g.values?.length!==n)throw Error('Invalid worker voxel grid');
  }
  const started=performance.now(),results=[],transfer=[];
  for(const job of data.jobs){
   const grid=data.grids[job.grid],potential=job.potential<0?null:data.grids[job.potential];
   if(!grid||job.potential>=data.grids.length||!Number.isFinite(job.level)||
      !Number.isInteger(job.maxTriangles)||job.maxTriangles<1||job.maxTriangles>75000||
      !['thermal','viridis','blue-red'].includes(job.palette))
    throw Error('Invalid isosurface job');
   const surface=isoTriangles(grid,job.level,potential,job.palette,job.maxTriangles);
   results.push(surface);transfer.push(surface.positions.buffer);
   if(surface.colors)transfer.push(surface.colors.buffer);
  }
  self.postMessage({requestId,results,elapsedMs:performance.now()-started},transfer);
 }catch(error){
  self.postMessage({requestId,error:String(error?.message||error)});
 }
};

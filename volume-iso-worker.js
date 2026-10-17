/* Package 10.3 — isolated, offline progressive isosurface and slice worker.
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
function isoTriangles(g,level,potential=null,palette='thermal',maxTriangles=75000,minStride=1){
 const d=volumeShape(g),stride=Math.max(minStride,1,...d.map(n=>Math.ceil((n-1)/40)));
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
 return {values,rgba};
}
self.onmessage=event=>{
 const data=event.data||{},requestId=data.requestId;
 try{
  if(!Array.isArray(data.grids)||data.grids.length>6||(data.type!=='slice'&&(!Array.isArray(data.jobs)||data.jobs.length>8)))
   throw Error('Invalid volume worker budget');
  for(const g of data.grids){
   const n=g?.dims?.reduce((a,b)=>a*b,1);
   if(!Array.isArray(g?.dims)||g.dims.length!==3||g.dims.some(x=>!Number.isInteger(x)||x<2)||
      n>2500000||n<8||g.values?.length!==n)throw Error('Invalid worker voxel grid');
  }
  if(data.type==='slice'){
   const job=data.slice,grid=data.grids[job?.grid],potential=job?.potential<0?null:data.grids[job?.potential];
   if(!grid||job.potential>=data.grids.length||!Number.isInteger(job.size)||
      job.size<64||job.size>1024||!(job.axis==='hkl'||[0,1,2].includes(job.axis))||
      !Number.isFinite(job.position)||job.position<0||job.position>100||
      !['thermal','viridis','blue-red'].includes(job.palette)||
      (job.axis==='hkl'&&(!Array.isArray(job.corners)||job.corners.length!==4||
       job.corners.some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x))))))
    throw Error('Invalid slice export');
   const result=sliceRaster(grid,potential,job);
   self.postMessage({requestId,slice:result},[result.values.buffer,result.rgba.buffer]);
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
    const stride=Math.max(1,...volumeShape(grid).map(n=>Math.ceil((n-1)/40)))*2;
    const preview=isoTriangles(grid,job.level,potential,job.palette,job.maxTriangles,stride);
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

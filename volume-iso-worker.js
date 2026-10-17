/* Package 10.5 — isolated, offline progressive isosurface, interactive slice and export worker.
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

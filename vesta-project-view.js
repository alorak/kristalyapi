/* V17.2 — bounded VESTA 3.x camera-orientation PREVIEW.
 * SCENE's 4x4 is interpreted as scene->view row-major rotation,
 * so preview camera frame uses its ROWS as world-space right/up/eye.
 * This is a TESTABLE MATHEMATICAL HYPOTHESIS, not verified GUI parity.
 * LMATRIX is a LOCAL phase/lattice transformation, not the camera.
 * Pan, zoom, optical perspective parameters, LIGHT0..3 and depth cues
 * are retained as metadata/warnings but NOT applied to the browser.
 */
const NUM=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?$/;
const split=line=>String(line||'').trim().split(/\s+/).filter(Boolean);
const finite=raw=>{
 if(!NUM.test(raw))throw Error('Non-numeric VESTA scene field');
 const n=Number(raw.replace(/[dD]/g,'e'));
 if(!Number.isFinite(n))throw Error('Non-finite VESTA scene field');
 return n;
};
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const near=(x,y,tol=2e-3)=>Math.abs(x-y)<=tol;
function at(lines,name){
 const indexes=[];
 for(let i=0;i<lines.length;i++)if(lines[i].trim()===name)indexes.push(i);
 if(indexes.length>1)throw Error('Duplicate VESTA section: '+name);
 return indexes.length?indexes[0]:-1;
}
function matrix4(lines,index,name){
 const out=[];
 for(let i=1;i<=4;i++){
  const values=split(lines[index+i]);
  if(values.length!==4)throw Error(name+' requires exactly four four-number rows');
  out.push(values.map(finite));
 }
 return out;
}
function orientation(matrix){
 if(!matrix||matrix.length!==4)throw Error('Missing SCENE matrix');
 const r=matrix.slice(0,3).map(row=>row.slice(0,3));
 if(matrix.slice(0,3).some(row=>!near(row[3],0,1e-6))||
    matrix[3].some((v,i)=>!near(v,i===3?1:0,1e-6)))
  throw Error('SCENE includes unsupported projective/translation transform');
 for(let i=0;i<3;i++){
  if(!near(norm(r[i]),1)||!near(dot(r[i],r[(i+1)%3]),0))
   throw Error('SCENE 3x3 must be a rigid orthonormal rotation');
 }
 const determinant=dot(cross(r[0],r[1]),r[2]);
 if(!near(determinant,1,3e-3))throw Error('SCENE is reflected, sheared or left-handed');
 // No normalization by altering R; preserve handedness and use the
 // original geometry, subject to precision of the VESTA source.
 return {right:r[0],up:r[1],eye:r[2],determinant};
}
function isIdentity(matrix){
 return matrix.every((row,i)=>row.every((v,j)=>near(v,i===j?1:0,1e-6)));
}
function projection(lines){
 const inline=lines.map((line,i)=>({i,parts:split(line)}))
  .filter(row=>row.parts[0]==='PROJT');
 if(inline.length>1)throw Error('Duplicate VESTA PROJT section');
 if(!inline.length)return {mode:null,rawFactor:null,status:'MISSING'};
 const item=inline[0],parts=item.parts.length>=3?item.parts.slice(1):split(lines[item.i+1]);
 if(parts.length!==2)throw Error('Invalid VESTA PROJT format');
 const mode=finite(parts[0]),factor=finite(parts[1]);
 if(!Number.isInteger(mode)||!Number.isFinite(factor)||factor<=0||factor>100)
  throw Error('Invalid VESTA PROJT mode/factor');
 if(![0,1].includes(mode))
  return {mode:null,rawCode:mode,rawFactor:factor,status:'UNSUPPORTED'};
 return {mode:mode===0?'orthographic':'perspective',
  rawCode:mode,rawFactor:factor,status:'PREVIEW_MAPPING_UNVERIFIED'};
}
function sceneTail(lines,index){
 const rows=[];
 for(let i=index+5;i<Math.min(index+9,lines.length);i++){
  const p=split(lines[i]);
  if(p.length===0)continue;
  if(p.every(value=>NUM.test(value))&&p.length<=2)rows.push(p.map(finite));
  else break;
 }
 return rows;
}
function background(lines){
 const i=at(lines,'BKGRC');
 if(i<0)return {rgb:null,status:'MISSING'};
 const vals=split(lines[i+1]);
 if(vals.length!==3||!vals.every(v=>/^\d{1,3}$/.test(v)&&+v<=255))
  throw Error('Invalid VESTA BKGRC');
 return {rgb:vals.map(Number),status:'READ_NOT_APPLIED'};
}
function lights(lines){
 const out=[];
 for(let n=0;n<4;n++){
  const key='LIGHT'+n,items=[];
  for(let i=0;i<lines.length;i++){
   const parts=split(lines[i]);
   if(parts[0]===key)items.push(parts);
  }
  if(items.length>1)throw Error('Duplicate VESTA '+key);
  if(items.length)out.push({section:key,status:'NOT_TRANSFERRED',
   enabled:items[0].length===2&&['0','1'].includes(items[0][1])?items[0][1]==='1':null});
 }
 return out;
}
export function parseVesta3View(lines){
 if(!Array.isArray(lines)||lines.length>100000||
   lines.some(line=>typeof line!=='string'||line.length>2000))
  throw Error('Bounded VESTA scene lines required');
 const notes=[],raw={};
 let frame=null,canPreview=false,reason=null;
 try{
  const i=at(lines,'SCENE');
  if(i<0){reason='SCENE missing';}
  else{
   const m=matrix4(lines,i,'SCENE');
   raw.sceneMatrix=m;
   raw.sceneTail=sceneTail(lines,i);
   frame=orientation(m);
   canPreview=true;
   notes.push('SCENE orientation is an unverified row-major scene-to-view preview; VESTA GUI sign, scale and roll must be checked.');
   if(raw.sceneTail.length)
    notes.push('SCENE pan/zoom tail preserved as read-only values; never treated as calibrated zoom.');
  }
 }catch(e){reason='SCENE: '+e.message;notes.push('SCENE orientation not applied: '+reason);}
 try{
  const i=at(lines,'LMATRIX');
  if(i>=0){
   const matrix=matrix4(lines,i,'LMATRIX');
   raw.localMatrix=matrix;
   if(!isIdentity(matrix)){
    canPreview=false;
    reason='Non-identity LMATRIX: local/phase transformation cannot safely be folded into camera';
    notes.push(reason);
   }else notes.push('Identity LMATRIX observed; it is not interpreted as a camera matrix.');
  }
 }catch(e){canPreview=false;reason=e.message;notes.push('LMATRIX rejected: '+reason);}
 let projected={mode:null,status:'MISSING'};
 try{projected=projection(lines);if(projected.status==='UNSUPPORTED')notes.push('PROJT code '+projected.rawCode+' not mapped to browser projection.');else if(projected.mode)notes.push('PROJT '+projected.rawCode+' projection mode only is an unverified mapping; perspective factor '+projected.rawFactor+' is not applied.');}
 catch(e){notes.push('PROJT rejected: '+e.message);projected={mode:null,status:'INVALID'};}
 let bg={rgb:null,status:'MISSING'};
 try{bg=background(lines);if(bg.rgb)notes.push('VESTA BKGRC recorded but not applied; preserve app theme background.');}
 catch(e){notes.push('BKGRC rejected: '+e.message);}
 let light=[];
 try{light=lights(lines);if(light.length)notes.push('LIGHT0..LIGHT3 matrices/intensities are not applied, so publication lighting parity is not claimed.');}
 catch(e){notes.push('LIGHT blocks rejected: '+e.message);}
 return {schema:'kristalyapi.vesta17.2.scene-preview.v1',frame,canPreview:!!canPreview,
  reason:canPreview?null:(reason||'No valid rigid SCENE transformation'),
  projection:projected,background:bg,lights:light,raw,notes,
  provenance:'Unverified scene-to-camera hypothesis; opt-in preview only; no VESTA GUI measurement.'};
}
export function vesta3CameraPreview(view,{distance,target}){
 if(!view||!view.canPreview||!view.frame)throw Error('VESTA camera preview not permitted');
 if(!Number.isFinite(distance)||distance<=0||distance>1e8||
   !Array.isArray(target)||target.length!==3||
   target.some(v=>!Number.isFinite(v)))throw Error('Invalid current camera frame');
 const {eye,up,right}=view.frame;
 // Camera must look toward the orbit target; right/up/eye form a
 // right-handed basis inherited from the validated SCENE rotation.
 const position=target.map((c,i)=>c+distance*eye[i]);
 return {position,target:[...target],up:[...up],right:[...right],
  perspective:view.projection.mode==='orthographic'?false:
   view.projection.mode==='perspective'?true:null,
  assumption:'SCENE rows as right/up/eye (inverse of object-to-view rigid rotation); NOT validated against VESTA 3.5.8 GUI'};
}

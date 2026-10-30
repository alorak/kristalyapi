/* V17.3. VESTA 3.x display vectors and bounded scientific-style metadata.
 * VECTR contains DISPLAY vectors, not intrinsically magnetic moments
 * (nor forces, velocity, or ionic displacements without provenance).
 * THERI factors do not encode independent Uij / betaij tensors.
 * POLYP global RGB is a visual style, not polyhedron topology.
 */
const numeric=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?$/;
const parts=line=>String(line??'').trim().split(/\s+/).filter(Boolean);
const finite=(v,label)=>{
 if(!numeric.test(v))throw Error(label+': expected finite numeric literal');
 const n=Number(v.replace(/[dD]/g,'e'));
 if(!Number.isFinite(n))throw Error(label+': nonfinite');
 return n;
};
const id=(v,label)=>{
 if(!/^[1-9]\d*$/.test(String(v))||Number(v)>100000)throw Error(label+': invalid ID');
 return Number(v);
};
const rgb=p=>p.length===3&&p.every(s=>/^\d{1,3}$/.test(s)&&+s<=255)?
 '#'+p.map(v=>(+v).toString(16).padStart(2,'0')).join(''):null;
const find=(lines,key)=>{
 const indices=[];
 for(let i=0;i<lines.length;i++)if(parts(lines[i])[0]===key)indices.push(i);
 if(indices.length>1)throw Error('Duplicate VESTA section: '+key);
 return indices.length?indices[0]:-1;
};
const isZero=p=>p.length>=4&&p.every(v=>numeric.test(v)&&finite(v,'terminator')===0);
function readVectors(lines,byIndex,warnings){
 const i=find(lines,'VECTR'),j=find(lines,'VECTT');
 if(i<0)return [];
 if(j<0){warnings.push('VECTR without VECTT styles: no display vectors imported.');return [];}
 let pos=i+1,vectorIndex=new Map(),ended=false;
 for(;pos<lines.length;){
  const p=parts(lines[pos]);
  if(!p.length){pos++;continue;}
  if(isZero(p)){ended=true;break;}
  if(vectorIndex.size>=200){warnings.push('VECTR exceeds 200-arrow preview cap; no arrows imported.');return [];}
  if(p.length!==5||pos+2>=lines.length){
   warnings.push('VECTR triple is incomplete; no arrows imported.');return [];
  }
  let key,values,atomIndex;
  try{
   key=id(p[0],'VECTR ID');
   values=p.slice(1,4).map(v=>finite(v,'VECTR xyz'));
   const anchor=parts(lines[pos+1]),terminator=parts(lines[pos+2]);
   if(anchor.length!==5||!isZero(terminator))throw Error('Invalid VECTR anchoring/terminator');
   atomIndex=id(anchor[0],'VECTR atom');
   if(anchor.slice(1).some(v=>!numeric.test(v)||finite(v,'VECTR anchor')!==0))
    throw Error('VECTR nonzero lattice-offset/penetration options are not supported');
   if(!numeric.test(p[4])||finite(p[4],'VECTR flag')!==0)
    throw Error('VECTR advanced vector flag is not supported');
   if(values.some(v=>Math.abs(v)>1000)||Math.hypot(...values)<1e-10)
    throw Error('VECTR zero/excessive vector');
   if(vectorIndex.has(key)||!byIndex.has(atomIndex))
    throw Error('Unmatched/duplicate VECTR site ID');
  }catch(e){warnings.push(e.message+'; no display vectors imported.');return [];}
  vectorIndex.set(key,{id:key,atomIndex,siteLabel:byIndex.get(atomIndex).label,
   cartesian:values});
  pos+=3;
 }
 if(!ended){warnings.push('VECTR has no ending zero row; no arrows imported.');return [];}
 const styles=new Map();ended=false;
 for(let k=j+1;k<lines.length;k++){
  const p=parts(lines[k]);if(!p.length)continue;
  if(isZero(p)){ended=true;break;}
  if(p.length<6||styles.size>=200){warnings.push('Invalid/oversized VECTT; no arrows imported.');return [];}
  try{
   const key=id(p[0],'VECTT ID'),radius=finite(p[1],'VECTT radius'),
    color=rgb(p.slice(2,5)),mode=finite(p[5],'VECTT mode');
   if(styles.has(key)||!vectorIndex.has(key)||!color||radius<=0||radius>5
      ||!Number.isInteger(mode)||mode<0||mode>3)
    throw Error('VECTT style invalid or unmatched');
   styles.set(key,{radius,color,mode});
  }catch(e){warnings.push(e.message+'; no arrows imported.');return [];}
 }
 if(!ended||styles.size!==vectorIndex.size){
  warnings.push('VECTR/VECTT count mismatch or missing VECTT terminator; no arrows imported.');return [];
 }
 const vectors=[...vectorIndex.values()].map(v=>({...v,style:styles.get(v.id)}));
 const scaleIndex=find(lines,'VECTS');
 let scale=1;
 if(scaleIndex>=0){
  const p=parts(lines[scaleIndex]);
  try{
   const raw=p.length>=2?p[1]:parts(lines[scaleIndex+1])[0];
   scale=finite(raw,'VECTS scale');
   if(scale<=0||scale>100)throw Error('VECTS scale outside 0..100');
  }catch(e){warnings.push(e.message+'; no arrows imported.');return [];}
 }
 for(const v of vectors){v.displayScale=scale;v.semanticType='UNSPECIFIED_DISPLAY_ARROW';}
 warnings.push('VECTR vectors are display-only Cartesian components with unverified VESTA scaling; NOT assumed magnetic moments, atomic displacement, force or velocity.');
 if(vectors.some(v=>v.style.mode!==0))
  warnings.push('VECTT penetration/add-atomic-radius flags are recorded, not reproduced in arrow geometry.');
 return vectors;
}
function readThermal(lines,byIndex,warnings){
 const i=find(lines,'THERI');
 if(i<0)return {present:false,siteFactors:[],status:'NOT_AVAILABLE'};
 const head=parts(lines[i]);let flags=null;
 if(head.length===2&&numeric.test(head[1]))flags=finite(head[1],'THERI mode');
 const factors=[],seen=new Set();
 let ended=false;
 for(let k=i+1;k<lines.length;k++){
  const p=parts(lines[k]);if(!p.length)continue;
  if(p[0]==='0'){ended=true;break;}
  if(p.length!==3){warnings.push('THERI block malformed; no thermal settings imported.');return {present:true,status:'REJECTED',siteFactors:[]};}
  try{
   const siteId=id(p[0],'THERI site'),atom=byIndex.get(siteId);
   const multiplier=finite(p[2],'THERI multiplier');
   if(!atom||atom.label!==p[1]||seen.has(siteId)||multiplier<=0||multiplier>100)
    throw Error('THERI site/factor invalid or duplicate');
   seen.add(siteId);factors.push({siteId,label:atom.label,displayMultiplier:multiplier});
   if(factors.length>1000)throw Error('THERI site count exceeds limit');
  }catch(e){warnings.push(e.message+'; no thermal settings imported.');return {present:true,status:'REJECTED',siteFactors:[]};}
 }
 if(!ended){warnings.push('THERI missing end sentinel; not imported.');return {present:true,status:'REJECTED',siteFactors:[]};}
 warnings.push('THERI contains display-site factors only; no Uij, betaij or Uiso may be inferred from it. Anisotropic ellipsoids were NOT generated.');
 return {present:true,modeCode:flags,status:'METADATA_ONLY',siteFactors:factors};
}
function readPoly(lines,warnings){
 const i=find(lines,'POLYP');
 if(i<0)return {present:false,status:'NOT_AVAILABLE'};
 const p=parts(lines[i+1]);
 if(p.length!==6)return {present:true,status:'REJECTED',reason:'POLYP global row incomplete'};
 const color=rgb(p.slice(3,6));
 if(!color||p.slice(0,3).some(v=>!numeric.test(v))){
  return {present:true,status:'REJECTED',reason:'POLYP global color/params invalid'};
 }
 const parameters=p.slice(0,3).map(v=>finite(v,'POLYP global style'));
 warnings.push('POLYP RGB is available as an approximate GLOBAL facet color only; no per-face colors, opacity, centers or polyhedron topology are inferred.');
 return {present:true,status:'COLOR_ONLY',color,otherParameters:parameters,
  source:'POLYP global color fields (last three 8-bit integers)'};
}
export function parseVesta3ScientificStyles(lines,byIndex){
 if(!Array.isArray(lines)||lines.length>100000||
   lines.some(s=>typeof s!=='string'||s.length>2000)||
   !(byIndex instanceof Map)||byIndex.size>1000)
  throw Error('Invalid bounded VESTA scientific-style source');
 const warnings=[];
 const vectors=readVectors(lines,byIndex,warnings);
 const thermal=readThermal(lines,byIndex,warnings);
 const polyhedron=readPoly(lines,warnings);
 if(polyhedron.status==='REJECTED')warnings.push(polyhedron.reason+'; polyhedron style not transferred.');
 return {
  schema:'kristalyapi.vesta17.3.scientific-style.v1',
  vectors,thermal,polyhedron,warnings,
  guiParity:'NOT_ESTABLISHED',
  note:'VESTA display arrows are not magnetic moments. THERI factors are not ADP tensors; POLYP color is not polyhedral geometry.'
 };
}
export function validatedVestaDisplayVectors(raw,siteLabels){
 if(raw==null)return [];
 if(!Array.isArray(raw)||raw.length>200||!Array.isArray(siteLabels))throw Error('Invalid saved VESTA display vectors');
 const seen=new Set();
 return raw.map(obj=>{
  if(!obj||typeof obj!=='object'||typeof obj.siteLabel!=='string'||!siteLabels.includes(obj.siteLabel)||
     !Array.isArray(obj.cartesian)||obj.cartesian.length!==3||
     obj.cartesian.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1000)||
     Math.hypot(...obj.cartesian)<1e-10||
     !obj.style||typeof obj.style.color!=='string'||
     !/^#[0-9a-f]{6}$/i.test(obj.style.color)||
     typeof obj.displayScale!=='number'||!Number.isFinite(obj.displayScale)||
     obj.displayScale<=0||obj.displayScale>100||
     !Number.isInteger(obj.atomIndex)||obj.atomIndex<=0||obj.atomIndex>100000||
     seen.has(obj.siteLabel))throw Error('Unsupported saved VESTA display vector');
  seen.add(obj.siteLabel);
  return {siteLabel:obj.siteLabel,atomIndex:obj.atomIndex,cartesian:[...obj.cartesian],
   style:{color:obj.style.color.toLowerCase()},displayScale:obj.displayScale,
   semanticType:'UNSPECIFIED_DISPLAY_ARROW'};
 });
}

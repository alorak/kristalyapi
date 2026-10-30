/* V17.1: bounded, independently testable VESTA 3.x appearance import.
   SITET/ATOMT radius is a sphere radius in Angstrom in common VESTA 3.x
   writers. The app's ball mode uses a different scaling convention; convert
   only representable values and label the result APPROXIMATED, never lossless.
   This module does not import VESTA cameras, light matrices, ADP or vectors. */
const HEADER=/^\s*([A-Z][A-Z0-9_]*)\s*$/;
const KNOWN={
 'CRYSTAL':'context','TITLE':'imported','CELLP':'imported','STRUC':'imported',
 'GROUP':'conditional','SYMOP':'conditional','TRANM':'not_transferred',
 'BOUND':'conditional','SBOND':'conditional','SITET':'approximated',
 'ATOMT':'approximated','STYLE':'partial','BONDS':'partial','LABEL':'partial',
 'ISURF':'partial','IMPORT_DENSITY':'external_link_only',
 'IMPORT_STRUCTURE':'not_transferred','IMPORT_TEXTURE':'not_transferred',
 'IMPORT_ORFFE':'not_transferred','VECTR':'not_transferred','VECTT':'not_transferred',
 'VECTS':'not_transferred','THERI':'not_transferred','SCENE':'conditional',
 'LMATRIX':'not_transferred','PLN2D':'not_transferred','HKLPP':'not_transferred',
 'POLYP':'not_transferred','POLYS':'not_transferred','BONDP':'not_transferred',
 'FORMP':'not_transferred','UCOLP':'not_transferred','SPLAN':'not_transferred',
 'SURFM':'not_transferred','SURFS':'partial','SECCL':'not_transferred',
 'SECTP':'not_transferred','SECTS':'not_transferred','TEXCL':'not_transferred',
 'TEX3P':'not_transferred','SHAPE':'not_transferred','PROJT':'conditional',
 'ATOMS':'partial','LPOINT':'not_transferred','LIGHT':'not_transferred',
 'LIGHT0':'not_transferred','LIGHT1':'not_transferred',
 'LIGHT2':'not_transferred','LIGHT3':'not_transferred',
 'BKGRC':'not_transferred'
};
const SKIPPED_NOTE={
 'SCENE':'Only opt-in rigid SCENE orientation preview; pan/zoom/GUI camera convention not verified.',
 'PROJT':'Only opt-in projection mode preview; VESTA perspective factor not transferred.',
 'BKGRC':'VESTA background color is recorded but the app theme is preserved.',
 'LMATRIX':'Local/phase orientation matrix is NOT a camera; nonidentity LMATRIX blocks preview.',
 'VECTR':'Atomic arrows/vectors are not imported as magnetic moments or displacements.',
 'VECTT':'Vector radius/color styles are not transferred.',
 'THERI':'Thermal ellipsoid settings/ADP are not inferred from the style block.',
 'POLYP':'Polyhedron facet/center styles require explicit geometry validation.',
 'POLYS':'Polyhedron drawing mode is not transferred.',
 'IMPORT_STRUCTURE':'Externally linked structure is never opened automatically.',
 'IMPORT_TEXTURE':'Externally linked texture is never opened automatically.',
 'IMPORT_ORFFE':'Externally linked ORFFE output is never opened automatically.'
};
const color=parts=>parts.length===3&&parts.every(x=>/^\d{1,3}$/.test(x)&&+x>=0&&+x<=255)
 ?'#'+parts.map(x=>(+x).toString(16).padStart(2,'0')).join(''):null;
function rows(lines,key,limit=1000){
 const index=lines.findIndex(line=>line.trim()===key);
 if(index<0)return null;
 const result=[];
 for(let i=index+1;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line)continue;
  if(HEADER.test(line))throw Error('VESTA '+key+' block missing terminating 0 row');
  const p=line.split(/\s+/);
  if(p[0]==='0')return result;
  if(!/^[1-9]\d*$/.test(p[0]))throw Error('Invalid '+key+' row at line '+(i+1));
  result.push(p);
  if(result.length>limit)throw Error('VESTA '+key+' block exceeds entry limit');
 }
 throw Error('VESTA '+key+' missing terminating row');
}
export function vesta3SectionTransferReport(lines){
 if(!Array.isArray(lines)||lines.length>100000)throw Error('VESTA section list invalid/too long');
 const found=new Set();
 for(const line of lines){
  const m=HEADER.exec(line);
  if(m)found.add(m[1]);
  // LIGHTn and PROJT are typically inline key+parameters in real VESTA 3.x files.
  // Match only known keys; never interpret arbitrary numeric/title text as code.
  else{
   const inline=/^\s*(LIGHT[0-3]|PROJT)\s+(?:[-+]?\d|\.)/.exec(line);
   if(inline)found.add(inline[1]);
  }
 }
 // A one-word UPPERCASE title can look like a header. Never claim an
 // unknown word was a parsed VESTA extension or interpret its payload.
 const sections=[...found].filter(k=>Object.hasOwn(KNOWN,k)).map(section=>({
  section,status:KNOWN[section],notice:SKIPPED_NOTE[section]||null
 }));
 const skipped=sections.filter(x=>x.status==='not_transferred').map(x=>x.section);
 return {schema:'kristalyapi.vesta17.1.transfer-audit.v1',sections,skipped,
  note:'Descriptive import audit only. Partial/conditional fields are NOT lossless and GUI parity is not established.'};
}
export function applyVesta3SiteAppearance(lines,byIndex,radii,{atomScale=.8,ballRadiusScale=.52}={}){
 if(!Array.isArray(lines)||!(byIndex instanceof Map)||!radii||typeof radii!=='object'
    ||!Number.isFinite(atomScale)||atomScale<=0||!Number.isFinite(ballRadiusScale)||ballRadiusScale<=0)
  throw Error('Invalid VESTA site-style input');
 const warnings=[],stats={elementColors:0,siteColors:0,approximatedSiteRadii:0,
  skippedRadii:0,invalidRows:0};
 const elementStyles=new Map();
 const element=rows(lines,'ATOMT'),site=rows(lines,'SITET');
 const parseRadius=(raw,section,id)=>{
  const n=Number(String(raw).replace(/[dD]/g,'E'));
  if(!Number.isFinite(n)||n<=0||n>10){
   warnings.push('VESTA '+section+' radius invalid for '+id+'; radius omitted.');
   stats.skippedRadii++;return null;
  }
  return n;
 };
 const seenElements=new Set();
 for(const p of element||[]){
  if(p.length<6||!/^([A-Za-z]{1,2})$/.test(p[1])||seenElements.has(p[1])){
   stats.invalidRows++;warnings.push('Invalid/duplicate VESTA ATOMT row omitted.');continue;
  }
  seenElements.add(p[1]);
  const radius=parseRadius(p[2],'ATOMT',p[1]),rgb=color(p.slice(3,6));
  if(!rgb){stats.invalidRows++;warnings.push('Invalid VESTA ATOMT RGB omitted for '+p[1]);}
  elementStyles.set(p[1],{radius,rgb});
 }
 for(const obj of byIndex.values()){
  const base=elementStyles.get(obj.symbol);
  if(base?.rgb){obj.visualColor=base.rgb;stats.elementColors++;}
 }
 const chosen=new Set(),convertedSites=new Set();
 const transferRadius=(obj,radius,label)=>{
  if(radius===null)return;
  const base=Number(radii[obj.symbol]??1.1),denominator=Math.min(base,1.6)*atomScale*ballRadiusScale;
  const factor=radius/denominator;
  if(!Number.isFinite(factor)||factor<.2||factor>3){
   stats.skippedRadii++;
   warnings.push('VESTA radius of '+label+' ('+radius+' A) cannot fit app visualScale 0.2..3; kept the previous valid element/default radius.');
   return;
  }
  obj.visualScale=+factor.toFixed(6);
  convertedSites.add(obj);
 };
 for(const [id,obj] of byIndex){
  const base=elementStyles.get(obj.symbol);
  if(base?.radius!==null&&base?.radius!==undefined)transferRadius(obj,base.radius,obj.label);
 }
 for(const p of site||[]){
  const id=Number(p[0]),obj=byIndex.get(id);
  if(p.length<6||!obj||p[1]!==obj.label||chosen.has(id)){
   stats.invalidRows++;
   warnings.push('Unmatched/duplicate VESTA SITET row '+p[0]+' omitted.');
   continue;
  }
  chosen.add(id);
  const rgb=color(p.slice(3,6));
  if(rgb){obj.visualColor=rgb;stats.siteColors++;}
  else{stats.invalidRows++;warnings.push('Invalid VESTA SITET RGB omitted for '+obj.label);}
  const r=parseRadius(p[2],'SITET',obj.label);
  if(r!==null)transferRadius(obj,r,obj.label);
 }
 stats.approximatedSiteRadii=convertedSites.size;
 if(stats.approximatedSiteRadii)warnings.push(
  'VESTA atom radii approximated as ball-mode Angstrom sphere sizes (atomScale='+atomScale+
  '). Exact VESTA renderer/scene camera radius equivalence is NOT established.');
 return {stats,warnings,method:'Approximate sphere radius from SITET/ATOMT A via ball-mode scaling; not a verified VESTA GUI comparison'};
}

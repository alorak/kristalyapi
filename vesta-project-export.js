/* V17.4: deliberately lossy, P1-only VESTA 3.x project writer.
 * This is not a VESTA 3.5.8 GUI round-trip certificate.
 * NO external files are referenced, fetched, embedded or guessed.
 * Every unrepresented scientific field is reported in a separately
 * SHA-256-bindable evidence manifest. Unknown data fails closed.
 */
const MAX_SITES=1000,MAX_BONDS=80;
const SAFE_LABEL=/^[A-Za-z0-9_.'()+-]{1,80}$/;
const SAFE_SYMBOL=/^[A-Z][a-z]?$/;
const RULE=/^([A-Za-z]{1,2})\s*-\s*([A-Za-z]{1,2})\s*:\s*(\d*\.?\d+)\s*-\s*(\d*\.?\d+)$/;
const HEX=/^#[a-fA-F0-9]{6}$/;
const val=(x,kind,low=-Infinity,high=Infinity)=>{
 if(typeof x!=='number'||!Number.isFinite(x)||x<low||x>high)
  throw Error('VESTA export invalid '+kind);
 return x;
};
const fmt=(x,n=6)=>val(x,'value').toFixed(n);
function triplet(hex){
 if(!HEX.test(hex))throw Error('VESTA export invalid RGB');
 return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(' ');
}
function title(value){
 const raw=String(value??'Kristal Yapı').trim();
 return (raw.replace(/[\r\n\u0000-\u001f]+/g,' ').slice(0,110)||'Kristal Yapi');
}
function safeBounds(source){
 const bounds=source??[[0,1],[0,1],[0,1]];
 if(!Array.isArray(bounds)||bounds.length!==3)throw Error('VESTA export invalid fractional bounds');
 return bounds.flatMap((pair,i)=>{
  if(!Array.isArray(pair)||pair.length!==2)throw Error('VESTA export invalid bounds for '+i);
  const a=val(pair[0],'bounds',-1,2),b=val(pair[1],'bounds',-1,2);
  if(a>=b||b-a>3)throw Error('VESTA export requires low < high in each axis');
  return [fmt(a,4),fmt(b,4)];
 });
}
function bonding(raw){
 if(!raw||!String(raw).trim())return [];
 if(typeof raw!=='string'||raw.length>6000)throw Error('VESTA export bond rules oversized');
 const result=[],known=new Set();
 for(const section of raw.split(';')){
  if(!section.trim())continue;
  const m=RULE.exec(section.trim());
  if(!m)throw Error('VESTA export invalid bond rule: '+section);
  const a=m[1][0].toUpperCase()+m[1].slice(1).toLowerCase();
  const b=m[2][0].toUpperCase()+m[2].slice(1).toLowerCase();
  const key=[a,b].sort().join('-'),low=+m[3],high=+m[4];
  if(low<0||high<=low||high>15||known.has(key))throw Error('VESTA export invalid/duplicate bond threshold');
  known.add(key);
  result.push({a,b,low,high});
  if(result.length>MAX_BONDS)throw Error('VESTA export >80 bond rules');
 }
 return result;
}
function manifestEntry(field,status,explanation){
 return {field,status,explanation};
}
export function makeVesta3Export(source,{radii,colorForSymbol,hasVolume=false}={}){
 if(!source||typeof source!=='object'||!radii||typeof radii!=='object'||
    typeof colorForSymbol!=='function')throw Error('VESTA export requires validated visual metadata');
 if(source.nonPeriodic)throw Error('VESTA P1 export refuses nonperiodic structure; use XYZ or PDB instead');
 if(source.symmetryEnabled&&source.sgNumber!==1)
  throw Error('VESTA P1 export refuses active non-P1 symmetry; disable symmetry only after verifying all physical sites or use CIF');
 if(!Array.isArray(source.sites)||!source.sites.length||source.sites.length>MAX_SITES)
  throw Error('VESTA export accepts 1..1000 listed asymmetric sites');
 const cell=source.cell||{},c=['a','b','c','alpha','beta','gamma'].map((name,i)=>
  val(cell[name],name,i<3?1e-6:1,i<3?1e6:179));
 const cos=degree=>Math.cos(degree*Math.PI/180);
 const [al,be,ga]=c.slice(3),vdet=1+2*cos(al)*cos(be)*cos(ga)-cos(al)**2-cos(be)**2-cos(ga)**2;
 if(vdet<=1e-10)throw Error('VESTA export invalid/degenerate lattice metric');
 const atomScale=val(source.atomScale??.8,'atomScale',.3,1.6);
 const bounds=safeBounds(source.bounds),rules=bonding(source.bondRules);
 const items=[],elements=new Map(),labels=new Set();
 for(let i=0;i<source.sites.length;i++){
  const site=source.sites[i];
  const symbol=site.symbol,label=String(site.label??'');
  if(typeof symbol!=='string'||!SAFE_SYMBOL.test(symbol)||!(symbol in radii)||
     !SAFE_LABEL.test(label)||labels.has(label))
   throw Error('VESTA export unsupported/duplicate site symbol or label (use single-token ASCII labels)');
  labels.add(label);
  const x=val(site.x,'site x',-1000,1000),y=val(site.y,'site y',-1000,1000),
   z=val(site.z,'site z',-1000,1000),occ=val(site.occupancy??1,'occupancy',0,1);
  const base=val(radii[symbol],'element radius',.01,20);
  const visualScale=val(site.visualScale??1,'site visualScale',.2,3);
  const radius=Math.min(base,1.6)*atomScale*.52*visualScale;
  if(radius<=0||radius>10)throw Error('VESTA export sphere radius outside safe interval');
  const color=site.visualColor||colorForSymbol(symbol);
  triplet(color);
  items.push({id:i+1,symbol,label,x,y,z,occ,radius,color});
  if(!elements.has(symbol)){
   const baseColor=colorForSymbol(symbol);
   triplet(baseColor);
   elements.set(symbol,{base,baseColor});
  }
 }
 const notes=[
  manifestEntry('cell','WRITTEN','Six cell parameters to 6 decimals; metric preserved to rounding tolerance'),
  manifestEntry('sites','WRITTEN','Listed sites only; fractional coordinate and occupancy quantized to six/four decimals'),
  manifestEntry('symmetry','FORCED_P1','GROUP=1, identity SYMOP; non-P1 active symmetry refused, not silently interpreted'),
  manifestEntry('SITET/ATOMT','APPROXIMATED','Display sphere radius derived from KristalYapı ball-style scale; not VESTA renderer parity'),
  manifestEntry('BOUND','WRITTEN','Fractional display bounds, not repeated supercell geometry'),
  manifestEntry('SBOND','PARTIAL','Only explicit element pair minimum/maximum bonds; auto-bond and coordination topology not represented'),
  manifestEntry('VESTA_GUI','NOT_RUN','Open/save/reopen in real VESTA 3.5.8 has not been verified')
 ];
 if(Number(source.sgNumber??1)!==1)notes.push(manifestEntry('originalSpaceGroup','DROPPED','Only listed P1 atoms exported; original space-group metadata discarded'));
 if(source.sites.some(s=>s.adp!==undefined||s.uIso!==undefined))
  notes.push(manifestEntry('ADP','DROPPED','No VESTA Uij/Bij unit/coordinate conversion invented; export CIF for scientific ADP'));
 if(source.sites.some(s=>s.magneticMoment!==undefined))
  notes.push(manifestEntry('magneticMoment','DROPPED','No magnetic moment or SAXIS representation in VESTA vectors'));
 if(source.sites.some(s=>s.disorderGroup||s.disorderAssembly||s.disorderCopy!==undefined))
  notes.push(manifestEntry('disorderMetadata','DROPPED','Occupancy written, disorder assembly/alternative-site relationships omitted'));
 if(source.polyCenters?.length||source.poly||source.polyCut||source.polyNeighbors!==undefined)
  notes.push(manifestEntry('polyhedronGeometry','DROPPED','Global POLYP RGB only; no connectivity, facet, center/neighbor selection, opacity or volume equivalence'));
 if(source.vestaDisplayVectors?.length)
  notes.push(manifestEntry('VECTR','DROPPED','Untyped display arrows not serialized; no fabricated source arrow radii, units or styles'));
 if(source.rep?.some(x=>x!==1))
  notes.push(manifestEntry('supercellRepetition','DROPPED','Only listed atomic basis sites and display bounds, not replicated atoms'));
 if(source.planeLayers?.length||source.plane?.visible)
  notes.push(manifestEntry('millerPlanes','DROPPED','Plane visualizations/clipping not preserved'));
 if(source.morphology?.length||source.morphVisible)
  notes.push(manifestEntry('morphology','DROPPED','Crystal shape planes not preserved'));
 if(source.overlays?.length)
  notes.push(manifestEntry('overlays','DROPPED','Other structures/overlays not exported'));
 if(hasVolume)
  notes.push(manifestEntry('volumeGrid/ISURF','OMITTED_EXTERNAL','No grid embedded; no IMPORT_DENSITY path, SHA or physical units invented; select and deliver original grid separately'));
 if(source.nonPeriodicOrigin?.some(x=>x!==0))
  notes.push(manifestEntry('nonPeriodicOrigin','DROPPED','No arbitrary Cartesian origin added to cell'));
 notes.push(manifestEntry('SCENE/PROJT/LMATRIX/LIGHT','DROPPED','No unverified view, perspective, local-matrix or lighting conversion'));
 notes.push(manifestEntry('THERI','DROPPED','No thermodynamic/ADP inference or fake ellipsoids'));
 const out=[
  '#VESTA_FORMAT_VERSION 3.5.0','','CRYSTAL','','TITLE',title(source.name),'',
  'GROUP',' 1 1 P 1','SYMOP',' 0.000000 0.000000 0.000000 1 0 0 0 1 0 0 0 1 1',
  'CELLP',' '+c.map(x=>fmt(x)).join(' '),' 0 0 0 0 0 0',
  'STRUC'
 ];
 for(const it of items){
  out.push(' '+it.id+' '+it.symbol+' '+it.label+' '+fmt(it.occ,4)+' '+
    [it.x,it.y,it.z].map(x=>fmt(x)).join(' ')+' 1a 1');
  out.push('  0.000000 0.000000 0.000000 0.00');
 }
 out.push(' 0 0 0 0 0','BOUND',' '+bounds.join(' '),' 0 0 0 0 0',
  'SBOND');
 rules.forEach((r,i)=>out.push(' '+(i+1)+' '+r.a+' '+r.b+' '+fmt(r.low,5)+' '+fmt(r.high,5)+' 0 1 1 0 1 0.1000 2.000 127 127 127'));
 out.push(' 0 0 0 0','SITET');
 items.forEach(it=>{const rgb=triplet(it.color);out.push(' '+it.id+' '+it.label+' '+fmt(it.radius,6)+' '+rgb+' '+rgb+' 204 0');});
 out.push(' 0 0 0 0 0 0','ATOMT');
 let idx=0;
 for(const [symbol,def] of elements){
  const rgb=triplet(def.baseColor),radius=Math.min(def.base,1.6)*atomScale*.52;
  out.push(' '+(++idx)+' '+symbol+' '+fmt(radius,6)+' '+rgb+' '+rgb+' 204');
 }
 out.push(' 0 0 0 0 0','STYLE','BONDS '+(source.bonds===false?0:1),
  'LABEL '+(source.labels?1:0)+' 12 1.000 0',
  'POLYP',' 204 1 1.000 '+triplet(HEX.test(source.polyColor||'')?source.polyColor:'#54a1db'),
  'ISURF',' 0 0 0 0','');
 const vestaText=out.join('\n');
 if(vestaText.length>4000000)throw Error('VESTA project exceeds 4MB import cap');
 return {text:vestaText,manifest:{
  schema:'kristalyapi.vesta17.4.loss-manifest.v1',
  exportFormat:'VESTA_3.5_P1_LIMITED',status:'LOSSY_NONVERIFIED',
  sourceSiteCount:items.length,exportSiteCount:items.length,
  bondRuleCount:rules.length,hasExternalVolume:!!hasVolume,
  externalFiles:hasVolume?[{role:'density-grid',path:null,sha256:null,status:'NOT_BUNDLED_NOT_HASHED'}]:[],
  entries:notes,scientificParity:'NOT_ESTABLISHED',vestaGuiStatus:'NOT_RUN',
  disclaimer:'VESTA desktop load and scientific equivalence require independent human acceptance. For lossless KristalYapı editing use .kristal.json; for crystallographic interchange use CIF/mCIF.'
 }};
}
export async function vestaExportSha256(text,cryptoProvider){
 if(typeof text!=='string'||!cryptoProvider?.subtle?.digest)
  throw Error('Browser SHA-256 unavailable: cannot create bound VESTA loss report');
 const bytes=new TextEncoder().encode(text);
 const digest=await cryptoProvider.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
